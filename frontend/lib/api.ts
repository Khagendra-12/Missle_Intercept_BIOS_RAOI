
import {
  type AdapterContext,
  adaptEnvironment,
  adaptJob,
  adaptTrajectory,
} from './adapters'

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

import {
  buildOverride,
  extractValues,
  rawFromApiConfig,
} from './config-schema'

import { MockTransport } from './mock-api'
import { BackendError, HttpTransport, type Transport } from './transport'

import type {
  CellEnvironment,
  ConfigBundle,
  ConfigValues,
  HealthStatus,
  SimulationMode,
  SimulationSnapshot,
  Trajectory,
} from './types'

const MIN_MONTE_CARLO_RUNS = 1
const MAX_MONTE_CARLO_RUNS = 1_000_000

/**
 * Single entry point the UI uses to communicate with the ewsim backend.
 *
 * Mock and real modes share the same API methods; only the transport differs.
 */
export class SimulationApi {
  readonly transport: Transport

  constructor(
    readonly mode: SimulationMode,
    readonly baseUrl: string,
  ) {
    this.transport =
      mode === 'mock'
        ? new MockTransport()
        : new HttpTransport(baseUrl)
  }

  async health(): Promise<HealthStatus> {
    const start = performance.now()

    const res = await this.transport.request<RawHealth>(
      'GET',
      ENDPOINTS.health(),
      { retries: 0 },
    )

    return {
      ok: res.status === 'ok',
      version: res.version ?? null,
      latencyMs: Math.round(performance.now() - start),
    }
  }

  async loadConfig(): Promise<ConfigBundle> {
    const [raw, api] = await Promise.allSettled([
      this.transport.request<RawConfig>(
        'GET',
        ENDPOINTS.rawConfig(),
      ),
      this.transport.request<RawFrontendConfig>(
        'GET',
        ENDPOINTS.frontendConfig(),
      ),
    ])

    const rawCfg =
      raw.status === 'fulfilled'
        ? raw.value
        : null

    const apiCfg =
      api.status === 'fulfilled'
        ? (api.value as unknown as Record<string, unknown>)
        : null

    if (!rawCfg && !apiCfg) {
      throw raw.status === 'rejected'
        ? raw.reason
        : new Error('Configuration unavailable')
    }

    const { values, supported } = extractValues(rawCfg, apiCfg)

    return {
      raw: rawCfg ?? rawFromApiConfig(apiCfg!),
      defaults: values,
      supported,
      source:
        rawCfg && apiCfg
          ? 'merged'
          : rawCfg
            ? '/config/default'
            : '/api/config',
    }
  }

  buildRequest(
    values: ConfigValues,
    bundle: ConfigBundle,
  ): RawSimulationRequest {
    const override = buildOverride(
      values,
      bundle.defaults,
      bundle.supported,
    )

    const request: RawSimulationRequest = {
      config: Object.keys(override).length
        ? override
        : null,
    }

    if (values.monteCarloRuns !== undefined) {
      const requestedRuns = Math.trunc(
        Number(values.monteCarloRuns),
      )

      request.runs = Math.max(
        MIN_MONTE_CARLO_RUNS,
        Math.min(
          MAX_MONTE_CARLO_RUNS,
          Number.isFinite(requestedRuns)
            ? requestedRuns
            : MIN_MONTE_CARLO_RUNS,
        ),
      )
    }

    if (values.interceptorMaxSpeedMps !== undefined) {
      request.interceptor_speed_m_s = Number(
        values.interceptorMaxSpeedMps,
      )
    }

    if (
      values.randomSeed !== undefined &&
      values.randomSeed !== ''
    ) {
      request.seed = Number(values.randomSeed)
    }

    return request
  }

  async validateConfig(
    request: RawSimulationRequest,
  ): Promise<RawConfig> {
    const response =
      await this.transport.request<RawConfigValidation>(
        'POST',
        ENDPOINTS.validateConfig(),
        {
          body: request.config ?? {},
        },
      )

    return response.config
  }

  async startSimulation(
    request: RawSimulationRequest,
  ): Promise<string> {
    const response =
      await this.transport.request<RawJobCreated>(
        'POST',
        ENDPOINTS.createSimulation(),
        {
          body: request,
        },
      )

    if (!response.job_id) {
      throw new Error(
        'The backend did not return a simulation job ID.',
      )
    }

    return response.job_id
  }

  async getSimulation(
    id: string,
    ctx: AdapterContext,
    signal?: AbortSignal,
  ): Promise<{
    raw: RawJob
    snapshot: SimulationSnapshot
  }> {
    const raw = await this.transport.request<RawJob>(
      'GET',
      ENDPOINTS.simulation(id),
      { signal },
    )

    return {
      raw,
      snapshot: adaptJob(raw, ctx),
    }
  }

  /**
   * Returns false when the backend does not expose a stop route.
   */
  async stopSimulation(id: string): Promise<boolean> {
    try {
      await this.transport.request(
        'POST',
        ENDPOINTS.stopSimulation(id),
      )

      return true
    } catch (error) {
      if (
        error instanceof BackendError &&
        (error.status === 404 || error.status === 405)
      ) {
        return false
      }

      throw error
    }
  }

  /**
   * Fetches the requested trajectory from the backend endpoint first.
   *
   * If that fails or returns no states, it falls back to the trajectory
   * included in the completed Monte Carlo result.
   */
  async getTrajectory(
    id: string,
    run: number,
    rawJob: RawJob | null,
  ): Promise<Trajectory | null> {
    try {
      const response = await this.transport.request<unknown>(
        'GET',
        ENDPOINTS.trajectory(id),
        { retries: 0 },
      )

      const states = pickStates(response, run)

      if (states && states.length > 0) {
        return {
          simulationId: id,
          run,
          states: adaptTrajectory(states),
          outcome: null,
          source: 'endpoint',
        }
      }
    } catch {
      // Fall back to the trajectory embedded in the job result.
    }

    const result = rawJob?.result

    if (!result) {
      return null
    }

    const matchingRun = result.results?.find(
      (item) =>
        item.run_index === run ||
        item.run === run,
    )

    const embeddedStates =
      matchingRun?.trajectory?.length
        ? matchingRun.trajectory
        : result.primary_result?.trajectory?.length
          ? result.primary_result.trajectory
          : result.trajectory

    if (!embeddedStates?.length) {
      return null
    }

    return {
      simulationId: id,
      run,
      states: adaptTrajectory(embeddedStates),
      outcome: null,
      source: 'embedded-result',
    }
  }

  async getEnvironment(
    layer: string,
    x: number,
    y: number,
    signal?: AbortSignal,
  ): Promise<CellEnvironment> {
    const raw =
      await this.transport.request<RawCellEnvironment>(
        'GET',
        ENDPOINTS.environment(),
        {
          query: {
            layer,
            x: Math.floor(x),
            y: Math.floor(y),
          },
          signal,
          retries: 0,
        },
      )

    return adaptEnvironment(raw)
  }
}

/**
 * Supports the trajectory response formats used by the backend:
 *
 * 1. A direct array of trajectory states.
 * 2. An array of trajectory arrays, indexed by run.
 * 3. An object containing a run-indexed array.
 * 4. An object containing a `states` array.
 */
function pickStates(
  response: unknown,
  run: number,
): RawTrajectoryState[] | null {
  if (Array.isArray(response)) {
    if (response.length === 0) {
      return null
    }

    if (Array.isArray(response[0])) {
      return (
        (response[run] as RawTrajectoryState[] | undefined) ??
        null
      )
    }

    return response as RawTrajectoryState[]
  }

  if (
    response &&
    typeof response === 'object'
  ) {
    const object = response as Record<string, unknown>

    const runStates = object[String(run)]

    if (Array.isArray(runStates)) {
      return runStates as RawTrajectoryState[]
    }

    if (Array.isArray(object.states)) {
      return object.states as RawTrajectoryState[]
    }

    if (Array.isArray(object.trajectory)) {
      return object.trajectory as RawTrajectoryState[]
    }
  }

  return null
}
