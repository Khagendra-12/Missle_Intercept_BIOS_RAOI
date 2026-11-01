/**
 * Wire-level contract for the `ewsim` FastAPI backend (version 0.1.0).
 *
 * Every type in this file mirrors exactly what `ewsim/api.py` serialises.
 * Nothing here is used directly by visual components: `lib/adapters.ts`
 * converts these shapes into the frontend domain types in `lib/types.ts`.
 * When the backend changes, update this file and the adapters only.
 */

/** Mirrors `ewsim.world.MAX_LAYER = 10**100`. Kept as a string; never a JS number. */
export const LAYER_MIN = '0'
export const LAYER_MAX = '1' + '0'.repeat(100)

export const ENDPOINTS = {
  health: () => '/health',
  /** Raw nested snake_case config loaded from `config/default.json`. */
  rawConfig: () => '/config/default',
  /** camelCase projection of the raw config (`frontend_config`). */
  frontendConfig: () => '/api/config',
  /** Deep-merges the posted dict onto the defaults and echoes it back. */
  validateConfig: () => '/api/config',
  createSimulation: () => '/simulations',
  simulation: (id: string) => `/simulations/${encodeURIComponent(id)}`,
  /** Not implemented in ewsim 0.1.0 — the client treats 404/405 as "unsupported". */
  stopSimulation: (id: string) => `/api/simulations/${encodeURIComponent(id)}/stop`,
  trajectory: (id: string) => `/api/simulations/${encodeURIComponent(id)}/trajectory`,
  /** Not scoped to a simulation id in ewsim 0.1.0; always uses default config weather. */
  environment: () => '/api/simulations/environment',
} as const

export type RawConfigSection = Record<string, unknown>
/** `{ simulation, world, physics, weather, guidance, ... }` */
export type RawConfig = Record<string, RawConfigSection>

export interface RawHealth {
  status: string
  version: string
}

/** `GET /api/config` */
export interface RawFrontendConfig {
  monteCarloRuns: number
  attackerCount: number
  maxConcurrentAttacks: number
  gridSize: number
  targetDistanceMinKm: number
  targetDistanceMaxKm: number
  missileMaxSpeedMps: number
  interceptorMaxSpeedMps: number
  missileMaxRangeKm: number
  detectionRangeKm: number
  interceptionRadiusM: number
  simulationTimeLimitS: number
  randomSeed: string
  weather: {
    spatialCorrelation: number
    layerCorrelation: number
    intensity: number
  }
  guidance: {
    navigationConstant: number
    autopilotLagS: number
    dragCoefficient: number
    integrationStepS: number
  }
}

/** `POST /api/config` response */
export interface RawConfigValidation {
  status: 'validated'
  config: RawConfig
}

/** `ewsim.schemas.SimulationRequest` */
export interface RawSimulationRequest {
  config?: Partial<RawConfig> | null
  /** 1 … 100000 */
  runs?: number | null
  /** 1 … 1000 */
  interceptor_speed_m_s?: number | null
  seed?: number | null
}

/** `POST /simulations` response */
export interface RawJobCreated {
  job_id: string
  status: 'queued'
}

export type RawJobStatus = 'queued' | 'running' | 'completed' | 'failed'

/** `GET /simulations/{job_id}` response */
export interface RawJob {
  job_id: string
  status: RawJobStatus
  result?: RawMonteCarloResult | null
  error?: string
}

/** `ewsim.monte_carlo.run_monte_carlo` return value */
export interface RawMonteCarloResult {
  runs: number
  summary: Record<string, number>
  intercept_rate: number
  results: RawEngagementResult[]
}

export type RawEngagementStatus =
  | 'intercepted'
  | 'infeasible'
  | 'out_of_range'
  | 'missile_out_of_bounds'
  | 'ground_impact'
  | 'target_hit'

/** `ewsim.engagement.simulate_engagement` return value (fields vary per status). */
export interface RawEngagementResult {
  run: number
  status: RawEngagementStatus | string
  reason?: string
  time_s?: number
  closest_m?: number
  distance_km?: number
  layer?: string
  target_layer?: string
  /** Only present on the loop-exhaustion path in 0.1.0. */
  trajectory?: RawTrajectoryState[]
}

export interface RawProjectileState {
  xKm: number
  yKm: number
  layer: string
  velocityMps: number
  headingDeg: number
  accelerationMps2: number
  status: string
}

/** One recorded integrator step (every `physics.dt_s`). */
export interface RawTrajectoryState {
  timeS: number
  missile: RawProjectileState
  interceptor: RawProjectileState
  separationM: number
}

/** `GET /api/simulations/environment` response */
export interface RawCellEnvironment {
  layer: string
  x: number
  y: number
  /** Always null in 0.1.0 (weather emits `temperature_c`). */
  temperatureK: number | null
  densityKgM3: number | null
  /** Always null in 0.1.0. */
  windSpeedMps: number | null
  /** Always null in 0.1.0. */
  windDirectionDeg: number | null
  /** `[u, v, w]` array in 0.1.0; an object is also accepted. */
  windVector: [number, number, number] | { u: number; v: number; w: number } | null
  grfIntensity: number | null
  [extra: string]: unknown
}

/** FastAPI error envelope */
export interface RawErrorBody {
  detail?: string | Array<{ loc?: unknown[]; msg?: string; type?: string }>
}
