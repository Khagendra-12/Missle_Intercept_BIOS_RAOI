import type { ConfigValues, ParameterField, RawConfigLike } from './types'

/**
 * UI metadata for backend config keys. ewsim 0.1.0 exposes defaults but no
 * constraints or units, so those live here. A field is shown as editable only
 * when its key exists in the backend config; `engine: 'ignored'` flags keys the
 * backend accepts but the 0.1.0 engine never reads (verified against the source).
 */
export const PARAMETER_FIELDS: ParameterField[] = [
  // ── Simulation ───────────────────────────────────────────────
  { id: 'monteCarloRuns', label: 'Monte Carlo simulations', group: 'simulation', rawPath: ['simulation', 'monte_carlo_runs'], apiKey: 'monteCarloRuns', unit: 'runs', kind: 'int', min: 1, max: 100000, step: 1, slider: true, engine: 'used' },
  { id: 'attackerCount', label: 'Hostile attackers', group: 'simulation', rawPath: ['simulation', 'attacker_count'], apiKey: 'attackerCount', unit: 'units', kind: 'int', min: 1, max: 500, step: 1, slider: true, engine: 'ignored' },
  { id: 'maxConcurrentAttacks', label: 'Simultaneous launches', group: 'simulation', rawPath: ['simulation', 'max_concurrent_attacks'], apiKey: 'maxConcurrentAttacks', unit: 'units', kind: 'int', min: 1, max: 500, step: 1, slider: true, engine: 'ignored' },
  { id: 'gridSize', label: 'Grid dimension N_a', group: 'simulation', rawPath: ['world', 'na'], apiKey: 'gridSize', unit: 'cells', kind: 'int', min: 10, max: 1000, step: 1, slider: true, engine: 'used' },
  { id: 'targetDistanceMinKm', label: 'Target distance min', group: 'simulation', rawPath: ['world', 'target_distance_min_km'], apiKey: 'targetDistanceMinKm', unit: 'km', kind: 'float', min: 0, max: 100, step: 0.5, slider: false, engine: 'ignored' },
  { id: 'targetDistanceMaxKm', label: 'Target distance max', group: 'simulation', rawPath: ['world', 'target_distance_max_km'], apiKey: 'targetDistanceMaxKm', unit: 'km', kind: 'float', min: 0, max: 100, step: 0.5, slider: false, engine: 'ignored' },
  { id: 'missileMaxSpeedMps', label: 'Missile max speed', group: 'simulation', rawPath: ['physics', 'missile_max_speed_m_s'], apiKey: 'missileMaxSpeedMps', unit: 'm/s', kind: 'float', min: 1, max: 1000, step: 1, slider: true, engine: 'used' },
  { id: 'interceptorMaxSpeedMps', label: 'Interceptor max speed', group: 'simulation', rawPath: ['physics', 'interceptor_max_speed_m_s'], apiKey: 'interceptorMaxSpeedMps', unit: 'm/s', kind: 'float', min: 1, max: 1000, step: 1, slider: true, engine: 'used', note: 'Also sent as request field interceptor_speed_m_s.' },
  { id: 'missileMaxRangeKm', label: 'Missile max range', group: 'simulation', rawPath: ['world', 'max_missile_range_km'], apiKey: 'missileMaxRangeKm', unit: 'km', kind: 'float', min: 1, max: 200, step: 0.5, slider: true, engine: 'used' },
  { id: 'detectionRangeKm', label: 'Detection range', group: 'simulation', rawPath: ['physics', 'detection_range_km'], apiKey: 'detectionRangeKm', unit: 'km', kind: 'float', min: 0.5, max: 100, step: 0.5, slider: true, engine: 'used' },
  { id: 'interceptionRadiusM', label: 'Interception radius', group: 'simulation', rawPath: ['physics', 'interception_radius_m'], apiKey: 'interceptionRadiusM', unit: 'm', kind: 'float', min: 0.1, max: 100, step: 0.1, slider: true, engine: 'used' },
  { id: 'simulationTimeLimitS', label: 'Time limit', group: 'simulation', rawPath: ['simulation', 'max_time_s'], apiKey: 'simulationTimeLimitS', unit: 's', kind: 'float', min: 1, max: 3600, step: 1, slider: true, engine: 'used' },
  { id: 'randomSeed', label: 'Random seed', group: 'simulation', rawPath: ['simulation', 'seed'], apiKey: 'randomSeed', unit: '', kind: 'seed', min: 0, max: Number.MAX_SAFE_INTEGER, step: 1, slider: false, engine: 'used', note: 'Also sent as request field seed.' },

  // ── Weather / GRF ────────────────────────────────────────────
  { id: 'weatherLengthScaleKm', label: 'GRF spatial length scale', group: 'weather', rawPath: ['weather', 'length_scale_km'], unit: 'km', kind: 'float', min: 0.1, max: 500, step: 0.1, slider: true, engine: 'used' },
  { id: 'weatherLayerLengthScale', label: 'GRF layer length scale', group: 'weather', rawPath: ['weather', 'layer_length_scale'], unit: 'layers', kind: 'float', min: 0.01, max: 1000, step: 0.01, slider: true, engine: 'used' },
  { id: 'weatherSpatialCorrelation', label: 'GRF spatial correlation', group: 'weather', rawPath: ['weather', 'spatial_correlation'], apiKey: 'weather.spatialCorrelation', unit: '', kind: 'float', min: 0, max: 100, step: 0.1, slider: true, engine: 'ignored', note: 'Engine uses length_scale_km instead.' },
  { id: 'weatherLayerCorrelation', label: 'GRF layer correlation', group: 'weather', rawPath: ['weather', 'layer_correlation'], apiKey: 'weather.layerCorrelation', unit: '', kind: 'float', min: 0, max: 100, step: 0.01, slider: true, engine: 'ignored', note: 'Engine uses layer_length_scale instead.' },
  { id: 'weatherIntensity', label: 'GRF intensity', group: 'weather', rawPath: ['weather', 'intensity'], apiKey: 'weather.intensity', unit: '', kind: 'float', min: 0, max: 10, step: 0.01, slider: true, engine: 'ignored' },
  { id: 'weatherTemperatureSigma', label: 'Temperature σ', group: 'weather', rawPath: ['weather', 'temperature_sigma_c'], unit: '°C', kind: 'float', min: 0, max: 50, step: 0.1, slider: true, engine: 'used' },
  { id: 'weatherDensitySigma', label: 'Density σ (drag influence)', group: 'weather', rawPath: ['weather', 'density_sigma'], unit: 'rel', kind: 'float', min: 0, max: 1, step: 0.01, slider: true, engine: 'used' },
  { id: 'weatherWindSigma', label: 'Wind σ (dynamics influence)', group: 'weather', rawPath: ['weather', 'wind_sigma_m_s'], unit: 'm/s', kind: 'float', min: 0, max: 50, step: 0.1, slider: true, engine: 'used' },
  { id: 'weatherFeatures', label: 'Fourier features', group: 'weather', rawPath: ['weather', 'features'], unit: '', kind: 'int', min: 1, max: 4096, step: 1, slider: true, engine: 'used' },
  { id: 'weatherSeed', label: 'Weather seed', group: 'weather', rawPath: ['weather', 'seed'], unit: '', kind: 'seed', min: 0, max: Number.MAX_SAFE_INTEGER, step: 1, slider: false, engine: 'used' },

  // ── Advanced ─────────────────────────────────────────────────
  { id: 'navigationConstant', label: 'PN constant N', group: 'advanced', rawPath: ['guidance', 'navigation_constant'], apiKey: 'guidance.navigationConstant', unit: '', kind: 'float', min: 1, max: 10, step: 0.1, slider: true, engine: 'ignored', note: 'apn_acceleration() is called with its default N=4.0.' },
  { id: 'autopilotLagS', label: 'Autopilot lag', group: 'advanced', rawPath: ['guidance', 'autopilot_lag_s'], apiKey: 'guidance.autopilotLagS', unit: 's', kind: 'float', min: 0, max: 5, step: 0.01, slider: true, engine: 'ignored' },
  { id: 'dragCoefficient', label: 'Drag coefficient C_d', group: 'advanced', rawPath: ['physics', 'drag_coefficient'], apiKey: 'guidance.dragCoefficient', unit: '', kind: 'float', min: 0, max: 2, step: 0.01, slider: true, engine: 'used' },
  { id: 'integrationStepS', label: 'Integration step dt', group: 'advanced', rawPath: ['physics', 'dt_s'], apiKey: 'guidance.integrationStepS', unit: 's', kind: 'float', min: 0.001, max: 1, step: 0.001, slider: true, engine: 'used' },
  { id: 'missileAccel', label: 'Missile acceleration', group: 'advanced', rawPath: ['physics', 'missile_accel_m_s2'], unit: 'm/s²', kind: 'float', min: 0.1, max: 500, step: 0.1, slider: true, engine: 'used' },
  { id: 'missileHold', label: 'Missile hold (cruise)', group: 'advanced', rawPath: ['physics', 'missile_hold_s'], unit: 's', kind: 'float', min: 0, max: 600, step: 1, slider: true, engine: 'used' },
  { id: 'interceptorAccel', label: 'Interceptor acceleration', group: 'advanced', rawPath: ['physics', 'interceptor_accel_m_s2'], unit: 'm/s²', kind: 'float', min: 0.1, max: 500, step: 0.1, slider: true, engine: 'used' },
  { id: 'interceptorHold', label: 'Interceptor hold (cruise)', group: 'advanced', rawPath: ['physics', 'interceptor_hold_s'], unit: 's', kind: 'float', min: 0, max: 600, step: 1, slider: true, engine: 'used' },
  { id: 'massKg', label: 'Projectile mass', group: 'advanced', rawPath: ['physics', 'mass_kg'], unit: 'kg', kind: 'float', min: 0.1, max: 10000, step: 0.1, slider: false, engine: 'used' },
  { id: 'areaM2', label: 'Reference area', group: 'advanced', rawPath: ['physics', 'area_m2'], unit: 'm²', kind: 'float', min: 0.0001, max: 10, step: 0.0001, slider: false, engine: 'used' },
  { id: 'maxLayerSeparation', label: 'Max layer separation', group: 'advanced', rawPath: ['world', 'max_layer_separation'], unit: 'layers', kind: 'int', min: 0, max: 1000, step: 1, slider: true, engine: 'used' },
  { id: 'pairedLayerEvery', label: 'Paired-layer replay every', group: 'advanced', rawPath: ['simulation', 'paired_layer_every'], unit: 'runs', kind: 'int', min: 0, max: 1000, step: 1, slider: true, engine: 'used' },
  { id: 'hostilityTolerance', label: 'Hostility match tolerance', group: 'advanced', rawPath: ['world', 'hostility_tolerance'], unit: 'rel', kind: 'float', min: 0, max: 1, step: 0.001, slider: true, engine: 'ignored', note: 'Read by ProceduralWorld but hostility_match() is never called.' },
  { id: 'taylorOrder', label: 'Taylor order K', group: 'advanced', rawPath: ['guidance', 'taylor_order'], unit: '', kind: 'int', min: 1, max: 12, step: 1, slider: true, engine: 'used' },
]

export const FIELD_BY_ID = Object.fromEntries(PARAMETER_FIELDS.map((f) => [f.id, f])) as Record<string, ParameterField>

function readPath(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj
  for (const key of path) {
    if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return cur
}

function coerce(field: ParameterField, value: unknown): number | string | undefined {
  if (value === undefined || value === null) return undefined
  if (field.kind === 'seed') return String(value)
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : undefined
}

export function extractValues(raw: RawConfigLike | null, apiConfig: Record<string, unknown> | null) {
  const values: ConfigValues = {}
  const supported: string[] = []
  for (const field of PARAMETER_FIELDS) {
    let value = raw ? coerce(field, readPath(raw, field.rawPath)) : undefined
    if (value === undefined && apiConfig && field.apiKey) {
      value = coerce(field, readPath(apiConfig, field.apiKey.split('.')))
    }
    if (value !== undefined) {
      values[field.id] = value
      supported.push(field.id)
    }
  }
  return { values, supported }
}

/** Rebuilds a raw nested config from the camelCase `/api/config` response (fallback only). */
export function rawFromApiConfig(apiConfig: Record<string, unknown>): RawConfigLike {
  const raw: RawConfigLike = {}
  for (const field of PARAMETER_FIELDS) {
    if (!field.apiKey) continue
    const value = coerce(field, readPath(apiConfig, field.apiKey.split('.')))
    if (value === undefined) continue
    const [section, key] = field.rawPath
    raw[section] ??= {}
    raw[section][key] = field.kind === 'seed' ? Number(value) : value
  }
  return raw
}

/** Nested snake_case override containing only fields that differ from the backend defaults. */
export function buildOverride(values: ConfigValues, defaults: ConfigValues, supported: string[]): RawConfigLike {
  const override: RawConfigLike = {}
  for (const id of supported) {
    const field = FIELD_BY_ID[id]
    if (!field || values[id] === undefined || values[id] === defaults[id]) continue
    const [section, key] = field.rawPath
    override[section] ??= {}
    override[section][key] = field.kind === 'seed' ? Number(values[id]) : values[id]
  }
  return override
}

export function validateValue(field: ParameterField, value: number | string): string | null {
  if (field.kind === 'seed') {
    const s = String(value)
    if (!/^\d+$/.test(s)) return 'Seed must be a non-negative integer'
    if (!Number.isSafeInteger(Number(s))) return 'Seed must be ≤ 2^53 − 1 (JSON-safe)'
    return null
  }
  const n = Number(value)
  if (!Number.isFinite(n)) return 'Enter a number'
  if (field.kind === 'int' && !Number.isInteger(n)) return 'Must be an integer'
  if (n < field.min) return `Minimum ${field.min}`
  if (n > field.max) return `Maximum ${field.max}`
  return null
}

export function validateAll(values: ConfigValues, supported: string[]): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const id of supported) {
    const field = FIELD_BY_ID[id]
    if (!field || values[id] === undefined) continue
    const err = validateValue(field, values[id])
    if (err) errors[id] = err
  }
  const min = Number(values.targetDistanceMinKm)
  const max = Number(values.targetDistanceMaxKm)
  if (supported.includes('targetDistanceMinKm') && supported.includes('targetDistanceMaxKm') && min > max) {
    errors.targetDistanceMaxKm = 'Max must be ≥ min'
  }
  return errors
}

export function randomSeed(): string {
  const buf = new Uint32Array(2)
  crypto.getRandomValues(buf)
  return String((buf[0] % 2 ** 21) * 2 ** 32 + buf[1])
}
