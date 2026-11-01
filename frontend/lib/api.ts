import { type AdapterContext, adaptEnvironment, adaptJob, adaptTrajectory } from './adapters'
import {
  ENDPOINTS,
  type RawCellEnvironment,
  type RawConfig,
  type RawConfigValidation,
  type RawFrontendConfig,
  type RawHealth,
  type RawJob,
  type RawJobCreated,
  type RawSimulationRequest,
  type RawTrajectoryState,
} from './backend-contract'
import { buildOverride, extractValues, rawFromApiConfig } from './config-schema'
import { MockTransport } from './mock-api'
import { BackendError, HttpTransport, type Transport } from './transport'
import type { CellEnvironment, ConfigBundle, ConfigValues, HealthStatus, SimulationMode, SimulationSnapshot, Trajectory } from './types'

/**
 * Single entry point the UI uses to talk to the ewsim backend. Mock and real
 * modes share every code path below; only the transport differs.
 */
export class SimulationApi {
  readonly transport: Transport

  constructor(
    readonly mode: SimulationMode,
    readonly baseUrl: string,
  ) {
    this.transport = mode === 'mock' ? new MockTransport() : new HttpTransport(baseUrl)
  }

  async health(): Promise<HealthStatus> {
    const start = performance.now()
    const res = await this.transport.request<RawHealth>('GET', ENDPOINTS.health(), { retries: 0 })
    return { ok: res.status === 'ok', version: res.version ?? null, latencyMs: Math.round(performance.now() - start) }
  }

  async loadConfig(): Promise<ConfigBundle> {
    const [raw, api] = await Promise.allSettled([
      this.transport.request<RawConfig>('GET', ENDPOINTS.rawConfig()),
      this.transport.request<RawFrontendConfig>('GET', ENDPOINTS.frontendConfig()),
    ])
    const rawCfg = raw.status === 'fulfilled' ? raw.value : null
    const apiCfg = api.status === 'fulfilled' ? (api.value as unknown as Record<string, unknown>) : null
    if (!rawCfg && !apiCfg) throw raw.status === 'rejected' ? raw.reason : new Error('Config unavailable')
    const { values, supported } = extractValues(rawCfg, apiCfg)
    return {
      raw: rawCfg ?? rawFromApiConfig(apiCfg!),
      defaults: values,
      supported,
      source: rawCfg && apiCfg ? 'merged' : rawCfg ? '/config/default' : '/api/config',
    }
  }

  buildRequest(values: ConfigValues, bundle: ConfigBundle): RawSimulationRequest {
    const override = buildOverride(values, bundle.defaults, bundle.supported)
    const req: RawSimulationRequest = { config: Object.keys(override).length ? override : null }
    if (values.monteCarloRuns !== undefined) req.runs = Number(values.monteCarloRuns)
    if (values.interceptorMaxSpeedMps !== undefined) req.interceptor_speed_m_s = Number(values.interceptorMaxSpeedMps)
    if (values.randomSeed !== undefined && values.randomSeed !== '') req.seed = Number(values.randomSeed)
    return req
  }

  async validateConfig(request: RawSimulationRequest): Promise<RawConfig> {
    const res = await this.transport.request<RawConfigValidation>('POST', ENDPOINTS.validateConfig(), { body: request.config ?? {} })
    return res.config
  }

  async startSimulation(request: RawSimulationRequest): Promise<string> {
    const res = await this.transport.request<RawJobCreated>('POST', ENDPOINTS.createSimulation(), { body: request })
    return res.job_id
  }

  async getSimulation(id: string, ctx: AdapterContext, signal?: AbortSignal): Promise<{ raw: RawJob; snapshot: SimulationSnapshot }> {
    const raw = await this.transport.request<RawJob>('GET', ENDPOINTS.simulation(id), { signal })
    return { raw, snapshot: adaptJob(raw, ctx) }
  }

  /** Returns false when the backend has no stop route (ewsim 0.1.0). */
  async stopSimulation(id: string): Promise<boolean> {
    try {
      await this.transport.request('POST', ENDPOINTS.stopSimulation(id))
      return true
    } catch (err) {
      if (err instanceof BackendError && (err.status === 404 || err.status === 405)) return false
      throw err
    }
  }

  /** Tries the trajectory route, then falls back to the trajectory embedded in the run result. */
  async getTrajectory(id: string, run: number, rawJob: RawJob | null): Promise<Trajectory | null> {
    const embedded = rawJob?.result?.results?.find((r) => r.run === run)
    try {
      const res = await this.transport.request<unknown>('GET', ENDPOINTS.trajectory(id), { retries: 0 })
      const states = pickStates(res, run)
      if (states?.length) return { simulationId: id, run, states: adaptTrajectory(states), outcome: null, source: 'endpoint' }
    } catch (err) {
      if (!(err instanceof BackendError)) throw err
    }
    if (embedded?.trajectory?.length) {
      return { simulationId: id, run, states: adaptTrajectory(embedded.trajectory), outcome: null, source: 'embedded-result' }
    }
    return null
  }

  async getEnvironment(layer: string, x: number, y: number, signal?: AbortSignal): Promise<CellEnvironment> {
    const raw = await this.transport.request<RawCellEnvironment>('GET', ENDPOINTS.environment(), {
      query: { layer, x: Math.floor(x), y: Math.floor(y) },
      signal,
      retries: 0,
    })
    return adaptEnvironment(raw)
  }
}

function pickStates(res: unknown, run: number): RawTrajectoryState[] | null {
  if (Array.isArray(res)) {
    if (res.length && Array.isArray(res[0])) return (res[run] as RawTrajectoryState[]) ?? null
    return res as RawTrajectoryState[]
  }
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>
    const byRun = obj[String(run)]
    if (Array.isArray(byRun)) return byRun as RawTrajectoryState[]
    if (Array.isArray(obj.states)) return obj.states as RawTrajectoryState[]
  }
  return null
}
