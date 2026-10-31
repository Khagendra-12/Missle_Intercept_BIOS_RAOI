export type SimulationMode = 'mock' | 'real'

export interface TrajectoryState {
  timeS: number
  missile: { xKm: number; yKm: number; layer: string; velocityMps: number; headingDeg: number; accelerationMps2: number; status: string }
  interceptor: { xKm: number; yKm: number; layer: string; velocityMps: number; headingDeg: number; accelerationMps2: number; status: string }
  separationM: number
}

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
  weather: { spatialCorrelation: number; layerCorrelation: number; intensity: number }
  guidance: { navigationConstant: number; autopilotLagS: number; dragCoefficient: number; integrationStepS: number }
}

export interface CellEnvironment { layer: string; x: number; y: number; temperatureK: number; densityKgM3: number; windSpeedMps: number; windDirectionDeg: number; windVector: { u: number; v: number; w: number }; grfIntensity: number }
export interface SimulationSummary { id: string; status: 'ready' | 'running' | 'complete' | 'stopped'; outcome: string; total: number; completed: number; successful: number; failed: number; meanInterceptionTimeS: number; meanClosestApproachM: number }
