
/**
 * Wire-level contract for the ewsim FastAPI backend.
 *
 * These types mirror the JSON exchanged with the backend.
 * Visual components should use the domain types in lib/types.ts;
 * lib/adapters.ts converts these wire-level shapes into domain types.
 */

/** Layer bounds are strings because JavaScript numbers cannot represent 10^100 exactly. */
export const LAYER_MIN = '0'
export const LAYER_MAX = '1' + '0'.repeat(100)

export const ENDPOINTS = {
  health: () => '/health',
  rawConfig: () => '/config/default',
  frontendConfig: () => '/api/config',
  validateConfig: () => '/api/config',
  createSimulation: () => '/simulations',
  simulation: (id: string) => `/simulations/${encodeURIComponent(id)}`,
  stopSimulation: (id: string) =>
    `/api/simulations/${encodeURIComponent(id)}/stop`,
  trajectory: (id: string) =>
    `/api/simulations/${encodeURIComponent(id)}/trajectory`,
  environment: () => '/api/simulations/environment',
} as const

export type RawConfigSection = Record<string, unknown>
export type RawConfig = Record<string, RawConfigSection>

export interface RawHealth {
  status: string
  version: string
}

/** GET /api/config */
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

/** POST /api/config response */
export interface RawConfigValidation {
  status: 'validated'
  config: RawConfig
}

/** ewsim.schemas.SimulationRequest */
export interface RawSimulationRequest {
  config?: Partial<RawConfig> | null
  /** Minimum 1 run. */
  runs?: number | null
  /** Interceptor maximum speed in metres per second. */
  interceptor_speed_m_s?: number | null
  seed?: number | null
}

/** POST /simulations response */
export interface RawJobCreated {
  job_id: string
  status: 'queued' | 'running'
}

export type RawJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'

/** GET /simulations/{job_id} response */
export interface RawJob {
  job_id: string
  status: RawJobStatus
  result?: RawMonteCarloResult | null
  error?: string
}

export interface RawConfidenceInterval {
  lower: number
  upper: number
}

/** ewsim.monte_carlo.run_monte_carlo return value */
export interface RawMonteCarloResult {
  runs: number
  summary: Record<string, number>
  intercept_rate: number
  target_hit_rate?: number
  confidence_interval_95?: RawConfidenceInterval
  status?: string
  /** Trajectory for the primary simulation run. */
  trajectory?: RawTrajectoryState[]
  primary_result?: RawEngagementResult
  /** Compact results for the individual Monte Carlo runs. */
  results: RawEngagementResult[]
}

export type RawEngagementStatus =
  | 'intercepted'
  | 'infeasible'
  | 'out_of_range'
  | 'missile_out_of_bounds'
  | 'ground_impact'
  | 'target_hit'
  | 'unknown'

/** Result from one individual engagement simulation. */
export interface RawEngagementResult {
  run_index?: number
  /** Retained for compatibility with older backend responses. */
  run?: number
  status: RawEngagementStatus | string
  reason?: string
  time_s?: number
  closest_m?: number
  distance_km?: number
  layer?: string
  target_layer?: string
  trajectory?: RawTrajectoryState[]
}

export interface RawProjectileState {
  xKm: number
  yKm: number
  /** Vertical coordinate in kilometres. */
  zKm?: number
  layer: string
  velocityMps: number
  headingDeg: number
  accelerationMps2: number
  status: string
}

/** A recorded missile/interceptor state. */
export interface RawTrajectoryState {
  /** Simulation time in seconds. */
  timeS: number
  missile: RawProjectileState
  interceptor: RawProjectileState
  separationM: number
}

/** GET /api/simulations/environment response */
export interface RawCellEnvironment {
  layer: string
  x: number
  y: number
  temperatureK: number | null
  densityKgM3: number | null
  windSpeedMps: number | null
  windDirectionDeg: number | null
  windVector:
    | [number, number, number]
    | { u: number; v: number; w: number }
    | null
  grfIntensity: number | null
  [extra: string]: unknown
}

/** FastAPI error envelope */
export interface RawErrorBody {
  detail?: string | Array<{
    loc?: unknown[]
    msg?: string
    type?: string
  }>
}
