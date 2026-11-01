import type {
  RawCellEnvironment,
  RawEngagementResult,
  RawJob,
  RawMonteCarloResult,
  RawTrajectoryState,
} from './backend-contract'
import type {
  CellEnvironment,
  EngagementOutcome,
  EngagementRecord,
  MonteCarloSummary,
  SimulationSnapshot,
  TrajectoryState,
} from './types'

/** Config values the adapters need to disambiguate backend statuses. */
export interface AdapterContext {
  interceptionRadiusM: number | null
  timeLimitS: number | null
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * Maps an ewsim engagement status to a UI outcome. In 0.1.0 the loop-exhaustion
 * path is labelled `intercepted` even when no intercept occurred; it is detected
 * by a closest approach outside the interception radius and reported as a timeout.
 */
export function mapOutcome(r: RawEngagementResult, ctx: AdapterContext): { outcome: EngagementOutcome | null; note: string | null } {
  switch (r.status) {
    case 'intercepted': {
      const closest = num(r.closest_m)
      if (closest !== null && ctx.interceptionRadiusM !== null && closest > ctx.interceptionRadiusM) {
        return {
          outcome: 'SIMULATION_TIMEOUT',
          note: `Backend reported "intercepted" but closest approach ${closest.toFixed(1)} m exceeds the ${ctx.interceptionRadiusM} m radius (time limit reached).`,
        }
      }
      if (num(r.time_s) === 0) {
        return { outcome: 'INTERCEPTION_SUCCESS', note: 'Intercepted at t=0 s: missile and interceptor share the launch origin in ewsim 0.1.0.' }
      }
      return { outcome: 'INTERCEPTION_SUCCESS', note: null }
    }
    case 'target_hit':
      return { outcome: 'INTERCEPTION_FAILED', note: 'Missile reached its target.' }
    case 'ground_impact':
      return { outcome: 'INTERCEPTION_FAILED', note: 'Ground impact before intercept.' }
    case 'missile_out_of_bounds':
      return { outcome: 'MISSILE_OUT_OF_BOUNDS', note: null }
    case 'infeasible':
    case 'out_of_range':
      return { outcome: 'NO_INTERCEPT_SOLUTION', note: r.reason ?? r.status.replace(/_/g, ' ') }
    default:
      return { outcome: null, note: `Unrecognised backend status "${r.status}".` }
  }
}

export function adaptEngagement(r: RawEngagementResult, ctx: AdapterContext): EngagementRecord {
  const { outcome, note } = mapOutcome(r, ctx)
  return {
    run: r.run,
    backendStatus: r.status,
    outcome,
    timeS: num(r.time_s),
    closestM: num(r.closest_m),
    distanceKm: num(r.distance_km),
    layer: r.layer != null ? String(r.layer) : null,
    targetLayer: r.target_layer != null ? String(r.target_layer) : null,
    reason: r.reason ?? null,
    hasTrajectory: Array.isArray(r.trajectory) && r.trajectory.length > 0,
    note,
  }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export function summarize(result: RawMonteCarloResult, engagements: EngagementRecord[]): MonteCarloSummary {
  const successes = engagements.filter((e) => e.outcome === 'INTERCEPTION_SUCCESS')
  const failures = engagements.filter((e) => e.outcome === 'INTERCEPTION_FAILED')
  const completed = engagements.length
  return {
    totalRuns: result.runs,
    completed,
    successes: successes.length,
    failures: failures.length,
    successRate: completed ? successes.length / completed : null,
    meanInterceptTimeS: mean(successes.map((e) => e.timeS).filter((v): v is number => v !== null)),
    meanClosestApproachM: mean(engagements.map((e) => e.closestM).filter((v): v is number => v !== null)),
    running: Math.max(0, result.runs - completed),
    progress: result.runs ? completed / result.runs : null,
    backendTally: result.summary ?? {},
    backendInterceptRate: num(result.intercept_rate),
  }
}

export function adaptJob(raw: RawJob, ctx: AdapterContext): SimulationSnapshot {
  const result = raw.result ?? null
  const engagements = result?.results?.map((r) => adaptEngagement(r, ctx)) ?? []
  return {
    id: raw.job_id,
    status: raw.status,
    error: raw.error ?? null,
    summary: result ? summarize(result, engagements) : null,
    engagements,
  }
}

export function adaptTrajectory(states: RawTrajectoryState[]): TrajectoryState[] {
  return states
    .map((s) => ({
      timeS: Number(s.timeS),
      separationM: Number(s.separationM),
      missile: { ...s.missile, layer: String(s.missile.layer) },
      interceptor: { ...s.interceptor, layer: String(s.interceptor.layer) },
    }))
    .sort((a, b) => a.timeS - b.timeS)
}

const KNOWN_ENV_KEYS = new Set(['layer', 'x', 'y', 'temperatureK', 'densityKgM3', 'windSpeedMps', 'windDirectionDeg', 'windVector', 'grfIntensity'])

export function adaptEnvironment(raw: RawCellEnvironment): CellEnvironment {
  const derivedFields: string[] = []
  let windVector: CellEnvironment['windVector'] = null
  if (Array.isArray(raw.windVector) && raw.windVector.length >= 2) {
    const [u, v, w = 0] = raw.windVector.map(Number)
    windVector = { u, v, w }
  } else if (raw.windVector && typeof raw.windVector === 'object') {
    const { u, v, w } = raw.windVector as { u: number; v: number; w: number }
    windVector = { u: Number(u), v: Number(v), w: Number(w ?? 0) }
  }

  let windSpeedMps = num(raw.windSpeedMps)
  let windDirectionDeg = num(raw.windDirectionDeg)
  if (windVector && windSpeedMps === null) {
    windSpeedMps = Math.hypot(windVector.u, windVector.v)
    derivedFields.push('windSpeedMps')
  }
  if (windVector && windDirectionDeg === null) {
    // Meteorological convention: direction the wind blows FROM, clockwise from north.
    windDirectionDeg = (Math.atan2(-windVector.u, -windVector.v) * 180) / Math.PI
    windDirectionDeg = (windDirectionDeg + 360) % 360
    derivedFields.push('windDirectionDeg')
  }

  const extra: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) if (!KNOWN_ENV_KEYS.has(k) && v !== null && v !== undefined) extra[k] = v

  return {
    layer: String(raw.layer),
    x: Number(raw.x),
    y: Number(raw.y),
    temperatureK: num(raw.temperatureK),
    densityKgM3: num(raw.densityKgM3),
    windSpeedMps,
    windDirectionDeg,
    windVector,
    grfIntensity: num(raw.grfIntensity),
    derivedFields,
    extra,
  }
}
