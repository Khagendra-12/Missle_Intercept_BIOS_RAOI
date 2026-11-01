/** Frontend domain types. Components depend on these, never on the wire contract. */

export type SimulationMode = 'mock' | 'real'

/** Typed, camelCase view of the backend configuration (spec §8). */
export interface SimulationConfig {
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

export interface ProjectileState {
  xKm: number
  yKm: number
  layer: string
  velocityMps: number
  headingDeg: number
  accelerationMps2: number
  status: string
}

export interface TrajectoryState {
  timeS: number
  missile: ProjectileState
  interceptor: ProjectileState
  separationM: number
}

export interface CellEnvironment {
  layer: string
  x: number
  y: number
  temperatureK: number | null
  densityKgM3: number | null
  windSpeedMps: number | null
  windDirectionDeg: number | null
  windVector: { u: number; v: number; w: number } | null
  grfIntensity: number | null
  /** Fields computed client-side from backend values (e.g. wind speed from the vector). */
  derivedFields: string[]
  /** Any additional fields the backend returned. */
  extra: Record<string, unknown>
}

export type EngagementOutcome =
  | 'INTERCEPTION_SUCCESS'
  | 'INTERCEPTION_FAILED'
  | 'MISSILE_OUT_OF_BOUNDS'
  | 'SIMULATION_TIMEOUT'
  | 'NO_INTERCEPT_SOLUTION'

export interface EngagementRecord {
  run: number
  backendStatus: string
  outcome: EngagementOutcome | null
  timeS: number | null
  closestM: number | null
  distanceKm: number | null
  layer: string | null
  targetLayer: string | null
  reason: string | null
  hasTrajectory: boolean
  note: string | null
}

export interface MonteCarloSummary {
  totalRuns: number
  completed: number
  successes: number
  failures: number
  successRate: number | null
  meanInterceptTimeS: number | null
  meanClosestApproachM: number | null
  running: number
  progress: number | null
  backendTally: Record<string, number>
  backendInterceptRate: number | null
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'stopped'

export interface SimulationSnapshot {
  id: string
  status: JobStatus
  error: string | null
  summary: MonteCarloSummary | null
  engagements: EngagementRecord[]
}

export interface Trajectory {
  simulationId: string
  run: number
  states: TrajectoryState[]
  outcome: EngagementOutcome | null
  source: 'endpoint' | 'embedded-result'
}

export type ParameterGroup = 'simulation' | 'weather' | 'advanced'

/** How the ewsim 0.1.0 engine treats a config key. */
export type EngineUsage = 'used' | 'ignored'

export interface ParameterField {
  id: string
  label: string
  group: ParameterGroup
  /** Location in the raw nested config, e.g. ['physics', 'dt_s']. */
  rawPath: [string, string]
  /** Location in `GET /api/config`, e.g. 'guidance.integrationStepS'. */
  apiKey?: string
  unit: string
  kind: 'int' | 'float' | 'seed'
  min: number
  max: number
  step: number
  slider: boolean
  engine: EngineUsage
  note?: string
}

export type ConfigValues = Record<string, number | string>

export interface ConfigBundle {
  /** Raw config from the backend (authoritative defaults). */
  raw: RawConfigLike
  defaults: ConfigValues
  /** Field ids present in the backend config. */
  supported: string[]
  source: '/config/default' | '/api/config' | 'merged'
}

export type RawConfigLike = Record<string, Record<string, unknown>>

export interface HealthStatus {
  ok: boolean
  version: string | null
  latencyMs: number | null
}
