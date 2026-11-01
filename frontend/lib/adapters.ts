
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

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : null

/**
 * Maps a backend engagement status to the frontend's outcome vocabulary.
 */
export function mapOutcome(
  result: RawEngagementResult,
  ctx: AdapterContext,
): {
  outcome: EngagementOutcome | null
  note: string | null
} {
  switch (result.status) {
    case 'intercepted': {
      const closest = num(result.closest_m)

      if (
        closest !== null &&
        ctx.interceptionRadiusM !== null &&
        closest > ctx.interceptionRadiusM
      ) {
        return {
          outcome: 'SIMULATION_TIMEOUT',
          note: `Backend reported "intercepted", but closest approach (${closest.toFixed(1)} m) exceeds the interception radius (${ctx.interceptionRadiusM} m).`,
        }
      }

      return {
        outcome: 'INTERCEPTION_SUCCESS',
        note: null,
      }
    }

    case 'target_hit':
      return {
        outcome: 'INTERCEPTION_FAILED',
        note: 'The missile reached its target.',
      }

    case 'ground_impact':
      return {
        outcome: 'INTERCEPTION_FAILED',
        note: 'The missile impacted the ground before interception.',
      }

    case 'missile_out_of_bounds':
      return {
        outcome: 'MISSILE_OUT_OF_BOUNDS',
        note: null,
      }

    case 'infeasible':
    case 'out_of_range':
      return {
        outcome: 'NO_INTERCEPT_SOLUTION',
        note:
          result.reason ??
          result.status.replace(/_/g, ' '),
      }

    default:
      return {
        outcome: null,
        note: `Unrecognised backend status "${result.status}".`,
      }
  }
}

export function adaptEngagement(
  result: RawEngagementResult,
  ctx: AdapterContext,
  fallbackRun = 0,
): EngagementRecord {
  const { outcome, note } = mapOutcome(result, ctx)

  return {
    run: result.run_index ?? result.run ?? fallbackRun,
    backendStatus: result.status,
    outcome,
    timeS: num(result.time_s),
    closestM: num(result.closest_m),
    distanceKm: num(result.distance_km),
    layer:
      result.layer != null
        ? String(result.layer)
        : null,
    targetLayer:
      result.target_layer != null
        ? String(result.target_layer)
        : null,
    reason: result.reason ?? null,
    hasTrajectory:
      Array.isArray(result.trajectory) &&
      result.trajectory.length > 0,
    note,
  }
}

const mean = (values: number[]): number | null =>
  values.length
    ? values.reduce((total, value) => total + value, 0) /
      values.length
    : null

export function summarize(
  result: RawMonteCarloResult,
  engagements: EngagementRecord[],
): MonteCarloSummary {
  const successes = engagements.filter(
    (engagement) =>
      engagement.outcome === 'INTERCEPTION_SUCCESS',
  )

  const failures = engagements.filter(
    (engagement) =>
      engagement.outcome === 'INTERCEPTION_FAILED',
  )

  const completed = engagements.length

  return {
    totalRuns: result.runs,
    completed,
    successes: successes.length,
    failures: failures.length,
    successRate: completed
      ? successes.length / completed
      : null,
    meanInterceptTimeS: mean(
      successes
        .map((engagement) => engagement.timeS)
        .filter((value): value is number => value !== null),
    ),
    meanClosestApproachM: mean(
      engagements
        .map((engagement) => engagement.closestM)
        .filter((value): value is number => value !== null),
    ),
    running: Math.max(0, result.runs - completed),
    progress: result.runs
      ? Math.min(1, completed / result.runs)
      : null,
    backendTally: result.summary ?? {},
    backendInterceptRate: num(result.intercept_rate),
  }
}

export function adaptJob(
  raw: RawJob,
  ctx: AdapterContext,
): SimulationSnapshot {
  const result = raw.result ?? null

  const rawEngagements =
    result?.results?.length
      ? result.results
      : result?.primary_result
        ? [result.primary_result]
        : []

  const engagements = rawEngagements.map(
    (engagement, index) =>
      adaptEngagement(engagement, ctx, index),
  )

  return {
    id: raw.job_id,
    status: raw.status,
    error: raw.error ?? null,
    summary: result
      ? summarize(result, engagements)
      : null,
    engagements,
  }
}

export function adaptTrajectory(
  states: RawTrajectoryState[],
): TrajectoryState[] {
  return states
    .map((state) => ({
      timeS: Number(state.timeS),
      separationM: Number(state.separationM),

      // Spread preserves additional wire fields such as zKm.
      missile: {
        ...state.missile,
        layer: String(state.missile.layer),
      },

      interceptor: {
        ...state.interceptor,
        layer: String(state.interceptor.layer),
      },
    }))
    .filter(
      (state) =>
        Number.isFinite(state.timeS) &&
        Number.isFinite(state.separationM),
    )
    .sort((a, b) => a.timeS - b.timeS)
}

const KNOWN_ENV_KEYS = new Set([
  'layer',
  'x',
  'y',
  'temperatureK',
  'densityKgM3',
  'windSpeedMps',
  'windDirectionDeg',
  'windVector',
  'grfIntensity',
])

export function adaptEnvironment(
  raw: RawCellEnvironment,
): CellEnvironment {
  const derivedFields: string[] = []

  let windVector: CellEnvironment['windVector'] = null

  if (
    Array.isArray(raw.windVector) &&
    raw.windVector.length >= 2
  ) {
    const [u, v, w = 0] = raw.windVector.map(Number)

    windVector = { u, v, w }
  } else if (
    raw.windVector &&
    typeof raw.windVector === 'object'
  ) {
    const vector = raw.windVector as {
      u: number
      v: number
      w?: number
    }

    windVector = {
      u: Number(vector.u),
      v: Number(vector.v),
      w: Number(vector.w ?? 0),
    }
  }

  let windSpeedMps = num(raw.windSpeedMps)
  let windDirectionDeg = num(raw.windDirectionDeg)

  if (windVector && windSpeedMps === null) {
    windSpeedMps = Math.hypot(
      windVector.u,
      windVector.v,
    )
    derivedFields.push('windSpeedMps')
  }

  if (windVector && windDirectionDeg === null) {
    // Meteorological convention: direction the wind blows FROM,
    // clockwise from north.
    windDirectionDeg =
      (Math.atan2(-windVector.u, -windVector.v) * 180) /
      Math.PI

    windDirectionDeg =
      (windDirectionDeg + 360) % 360

    derivedFields.push('windDirectionDeg')
  }

  const extra: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(raw)) {
    if (
      !KNOWN_ENV_KEYS.has(key) &&
      value !== null &&
      value !== undefined
    ) {
      extra[key] = value
    }
  }

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
