import {
  ENDPOINTS,
  type RawCellEnvironment,
  type RawConfig,
  type RawEngagementResult,
  type RawJob,
  type RawJobCreated,
  type RawMonteCarloResult,
  type RawSimulationRequest,
  type RawTrajectoryState,
} from './backend-contract'
import { BackendError, type HttpMethod, type RequestOptions, type Transport, TransportError } from './transport'

/**
 * In-browser stand-in for the ewsim FastAPI server. It answers the same routes
 * with the same response shapes and status codes (including 404 for the
 * missing stop route and 501 from the trajectory route), so the real adapter
 * path is exercised in mock mode. Values are deterministic demo data only.
 */

export const MOCK_RAW_CONFIG: RawConfig = {
  simulation: { monte_carlo_runs: 100, seed: 20260101, max_time_s: 200, paired_layer_every: 10, attacker_count: 1, max_concurrent_attacks: 1 },
  world: { na: 100, max_missile_range_km: 20, max_layer_separation: 3, hostility_tolerance: 0.05, target_distance_min_km: 10, target_distance_max_km: 20 },
  physics: {
    dt_s: 0.1, missile_max_speed_m_s: 100, interceptor_max_speed_m_s: 75, missile_accel_m_s2: 12, missile_hold_s: 60,
    interceptor_accel_m_s2: 18, interceptor_hold_s: 60, detection_range_km: 12, interception_radius_m: 3,
    drag_coefficient: 0.3, area_m2: 0.05, mass_kg: 50,
  },
  weather: {
    seed: 7, features: 64, length_scale_km: 15, layer_length_scale: 4, spatial_correlation: 15, layer_correlation: 0.8,
    intensity: 1, temperature_base_c: 15, temperature_sigma_c: 6, density_base_kg_m3: 1.225, density_sigma: 0.08, wind_sigma_m_s: 4,
  },
  guidance: { navigation_constant: 4, autopilot_lag_s: 0.2 },
}

function hash(...parts: (string | number)[]) {
  let h = 2166136261
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

function merge(base: RawConfig, override?: Partial<RawConfig> | null): RawConfig {
  const out = clone(base)
  if (!override) return out
  for (const [section, values] of Object.entries(override)) {
    if (values && typeof values === 'object') out[section] = { ...(out[section] ?? {}), ...values }
  }
  return out
}

const n = (cfg: RawConfig, s: string, k: string) => Number(cfg[s]?.[k])

function grf(x: number, y: number, layer: string, cfg: RawConfig) {
  const seed = n(cfg, 'weather', 'seed') || 7
  const ls = n(cfg, 'weather', 'length_scale_km') || 15
  const z = Number(BigInt(layer) % BigInt(1_000_003)) / (n(cfg, 'weather', 'layer_length_scale') || 4)
  let g = 0
  const r = rng(seed)
  for (let i = 0; i < 12; i++) {
    const fx = (r() * 2 - 1) / ls, fy = (r() * 2 - 1) / ls, fz = (r() * 2 - 1) * 0.3
    g += Math.cos(fx * x * 6 + fy * y * 6 + fz * z + r() * 6.283) * (r() * 2 - 1)
  }
  return (g * Math.SQRT2) / Math.sqrt(12)
}

function environment(layer: string, x: number, y: number, cfg: RawConfig): RawCellEnvironment {
  const g = grf(x, y, layer, cfg)
  const density = Math.max(0.05, n(cfg, 'weather', 'density_base_kg_m3') * (1 + n(cfg, 'weather', 'density_sigma') * g))
  const r = rng(hash('wind', x, y, layer))
  const sigma = n(cfg, 'weather', 'wind_sigma_m_s')
  const gauss = () => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r())
  // Same nullability as ewsim 0.1.0's get_cell_environment().
  return {
    layer, x, y,
    temperatureK: null,
    densityKgM3: density,
    windSpeedMps: null,
    windDirectionDeg: null,
    windVector: [gauss() * sigma, gauss() * sigma, gauss() * sigma * 0.2],
    grfIntensity: g,
  }
}

const deg = (vx: number, vy: number) => (Math.atan2(vy, vx) * 180) / Math.PI

function engagement(cfg: RawConfig, run: number, recordTrajectory: boolean): RawEngagementResult {
  const seed = n(cfg, 'simulation', 'seed')
  const r = rng(hash(seed, 'engagement', run))
  const na = n(cfg, 'world', 'na')
  const layer = String(Math.floor(r() * 1e6))
  const dMin = n(cfg, 'world', 'target_distance_min_km') || 10
  const dMax = n(cfg, 'world', 'target_distance_max_km') || 20

  let ox = 0, oy = 0, tx = 0, ty = 0, dist = 0
  for (let i = 0; i < 30; i++) {
    ox = Math.floor(r() * na) + 0.5
    oy = Math.floor(r() * na) + 0.5
    const a = r() * Math.PI * 2
    dist = dMin + r() * (dMax - dMin)
    tx = ox + Math.cos(a) * dist
    ty = oy + Math.sin(a) * dist
    if (tx > 0 && ty > 0 && tx < na && ty < na) break
  }
  if (dist > n(cfg, 'world', 'max_missile_range_km')) {
    return { run, status: 'out_of_range', distance_km: dist, layer, target_layer: layer }
  }
  if (r() < 0.04) return { run, status: 'infeasible', reason: 'layer separation', layer, target_layer: String(Number(layer) + 9) }

  const siteAngle = Math.atan2(oy - ty, ox - tx) + (r() - 0.5) * 0.8
  const sx = tx + Math.cos(siteAngle) * (1 + r() * 2)
  const sy = ty + Math.sin(siteAngle) * (1 + r() * 2)

  const dt = n(cfg, 'physics', 'dt_s') || 0.1
  const maxT = n(cfg, 'simulation', 'max_time_s') || 200
  const vMaxM = n(cfg, 'physics', 'missile_max_speed_m_s') || 100
  const vMaxI = n(cfg, 'physics', 'interceptor_max_speed_m_s') || 75
  const aM = n(cfg, 'physics', 'missile_accel_m_s2') || 12
  const aI = n(cfg, 'physics', 'interceptor_accel_m_s2') || 18
  const detect = n(cfg, 'physics', 'detection_range_km') || 12
  const radius = n(cfg, 'physics', 'interception_radius_m') || 3
  const windSigma = n(cfg, 'weather', 'wind_sigma_m_s') || 0
  const recordEvery = Math.max(1, Math.round(0.5 / dt))

  let mx = ox * 1000, my = oy * 1000, mv = 0
  let ix = sx * 1000, iy = sy * 1000, iv = 0, ivx = 0, ivy = 0
  let launched = false
  let closest = Infinity
  const states: RawTrajectoryState[] = []
  const windU = (r() - 0.5) * windSigma * 0.5
  const windV = (r() - 0.5) * windSigma * 0.5

  const record = (t: number, sep: number, mStatus: string, iStatus: string, mvx: number, mvy: number) => {
    if (!recordTrajectory) return
    states.push({
      timeS: Number(t.toFixed(3)),
      separationM: sep,
      missile: { xKm: mx / 1000, yKm: my / 1000, layer, velocityMps: mv, headingDeg: deg(mvx, mvy), accelerationMps2: mv < vMaxM ? aM : 0, status: mStatus },
      interceptor: { xKm: ix / 1000, yKm: iy / 1000, layer, velocityMps: iv, headingDeg: deg(ivx, ivy), accelerationMps2: launched && iv < vMaxI ? aI : 0, status: iStatus },
    })
  }

  const steps = Math.ceil(maxT / dt)
  for (let k = 0; k <= steps; k++) {
    const t = k * dt
    const dxT = tx * 1000 - mx, dyT = ty * 1000 - my
    const dT = Math.hypot(dxT, dyT)
    mv = Math.min(vMaxM, mv + aM * dt)
    const mvx = (dxT / (dT || 1)) * mv + windU
    const mvy = (dyT / (dT || 1)) * mv + windV

    if (!launched && Math.hypot(mx - ix, my - iy) <= detect * 1000) launched = true
    if (launched) {
      iv = Math.min(vMaxI, iv + aI * dt)
      const rx = mx - ix, ry = my - iy
      const range = Math.hypot(rx, ry)
      const tgo = range / Math.max(1, iv + mv)
      const ax = mx + mvx * tgo - ix, ay = my + mvy * tgo - iy
      const la = Math.hypot(ax, ay) || 1
      ivx = (ax / la) * iv
      ivy = (ay / la) * iv
    }

    // Closest approach within this step (linear relative motion).
    const rx0 = mx - ix, ry0 = my - iy
    const rvx = mvx - ivx, rvy = mvy - ivy
    const rv2 = rvx * rvx + rvy * rvy
    const tau = rv2 > 0 ? Math.min(dt, Math.max(0, -(rx0 * rvx + ry0 * rvy) / rv2)) : 0
    const sepMin = Math.hypot(rx0 + rvx * tau, ry0 + rvy * tau)
    const sep = Math.hypot(rx0, ry0)
    closest = Math.min(closest, sepMin)

    if (launched && sepMin <= radius) {
      mx += mvx * tau; my += mvy * tau; ix += ivx * tau; iy += ivy * tau
      record(t + tau, sepMin, 'destroyed', 'intercepted', mvx, mvy)
      return { run, status: 'intercepted', time_s: Number((t + tau).toFixed(2)), closest_m: sepMin, distance_km: dist, layer, target_layer: layer, ...(recordTrajectory ? { trajectory: states } : {}) }
    }
    if (dT <= mv * dt) {
      record(t, sep, 'impact', launched ? 'missed' : 'idle', mvx, mvy)
      return { run, status: 'target_hit', time_s: Number(t.toFixed(2)), closest_m: closest, distance_km: dist, layer, target_layer: layer, ...(recordTrajectory ? { trajectory: states } : {}) }
    }
    if (mx < 0 || my < 0 || mx > na * 1000 || my > na * 1000) {
      record(t, sep, 'out_of_bounds', launched ? 'tracking' : 'idle', mvx, mvy)
      return { run, status: 'missile_out_of_bounds', time_s: Number(t.toFixed(2)), closest_m: closest, distance_km: dist, layer, target_layer: layer, ...(recordTrajectory ? { trajectory: states } : {}) }
    }
    if (k % recordEvery === 0) record(t, sep, 'flying', launched ? 'tracking' : 'idle', mvx, mvy)

    mx += mvx * dt; my += mvy * dt
    ix += ivx * dt; iy += ivy * dt
  }
  return { run, status: 'intercepted', time_s: maxT, closest_m: closest, distance_km: dist, layer, target_layer: layer, ...(recordTrajectory ? { trajectory: states } : {}) }
}

/** Runs with an index below this keep their trajectory in mock mode. */
const MOCK_TRAJECTORY_RUNS = 60
const MOCK_RUNS_PER_SECOND = 400

interface MockJob {
  cfg: RawConfig
  runs: number
  startedAt: number
  results: RawEngagementResult[]
}

export class MockTransport implements Transport {
  private jobs = new Map<string, MockJob>()

  async request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
    await new Promise((res) => setTimeout(res, 60 + Math.random() * 80))
    if (options.signal?.aborted) throw new TransportError('Request aborted', 'aborted')
    return this.route(method, path, options) as T
  }

  private route(method: HttpMethod, path: string, options: RequestOptions): unknown {
    if (method === 'GET' && path === ENDPOINTS.health()) return { status: 'ok', version: '0.1.0-mock' }
    if (method === 'GET' && path === ENDPOINTS.rawConfig()) return clone(MOCK_RAW_CONFIG)
    if (method === 'POST' && path === ENDPOINTS.validateConfig()) {
      return { status: 'validated', config: merge(MOCK_RAW_CONFIG, options.body as Partial<RawConfig>) }
    }
    if (method === 'POST' && path === ENDPOINTS.createSimulation()) return this.create(options.body as RawSimulationRequest)
    if (method === 'GET' && path === ENDPOINTS.environment()) {
      const q = options.query ?? {}
      if (q.layer === undefined || q.x === undefined || q.y === undefined) throw new BackendError('GET environment failed', 422, 'layer, x and y are required')
      return environment(String(q.layer), Number(q.x), Number(q.y), MOCK_RAW_CONFIG)
    }
    const traj = path.match(/^\/api\/simulations\/([^/]+)\/trajectory$/)
    if (method === 'GET' && traj) {
      const job = this.jobs.get(decodeURIComponent(traj[1]))
      if (!job) throw new BackendError('GET trajectory failed', 404, 'Unknown simulation ID')
      if (job.results.length < job.runs) throw new BackendError('GET trajectory failed', 409, 'Simulation is still running')
      throw new BackendError('GET trajectory failed', 501, 'Trajectory recording is not yet supported')
    }
    if (path.match(/^\/api\/simulations\/[^/]+\/stop$/)) throw new BackendError('Stop failed', 404, 'Not Found')
    const sim = path.match(/^\/simulations\/([^/]+)$/)
    if (method === 'GET' && sim) return this.poll(decodeURIComponent(sim[1]))
    throw new BackendError(`${method} ${path} failed`, 404, 'Not Found')
  }

  private create(req: RawSimulationRequest | undefined): RawJobCreated {
    const cfg = merge(MOCK_RAW_CONFIG, req?.config ?? null)
    if (req?.runs) cfg.simulation.monte_carlo_runs = req.runs
    if (req?.seed !== undefined && req?.seed !== null) cfg.simulation.seed = req.seed
    if (req?.interceptor_speed_m_s) cfg.physics.interceptor_max_speed_m_s = req.interceptor_speed_m_s
    const id = `mock-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
    this.jobs.set(id, { cfg, runs: Number(cfg.simulation.monte_carlo_runs), startedAt: Date.now(), results: [] })
    return { job_id: id, status: 'queued' }
  }

  private poll(id: string): RawJob {
    const job = this.jobs.get(id)
    if (!job) throw new BackendError('GET simulation failed', 404, 'Unknown job_id')
    const elapsed = (Date.now() - job.startedAt) / 1000
    if (elapsed < 0.3) return { job_id: id, status: 'queued', result: null }
    const target = Math.min(job.runs, Math.ceil((elapsed - 0.3) * MOCK_RUNS_PER_SECOND))
    while (job.results.length < target) {
      const run = job.results.length
      job.results.push(engagement(job.cfg, run, run < MOCK_TRAJECTORY_RUNS))
    }
    if (job.results.length < job.runs) return { job_id: id, status: 'running', result: null }
    const summary: Record<string, number> = {}
    for (const r of job.results) summary[r.status] = (summary[r.status] ?? 0) + 1
    const result: RawMonteCarloResult = {
      runs: job.runs,
      summary,
      intercept_rate: (summary.intercepted ?? 0) / job.runs,
      results: job.results,
    }
    return { job_id: id, status: 'completed', result }
  }
}
