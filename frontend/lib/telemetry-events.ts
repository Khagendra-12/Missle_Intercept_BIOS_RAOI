import type { TrajectoryState } from './types'

export type EventTone = 'neutral' | 'success' | 'warning' | 'danger'

export interface TelemetryEvent {
  id: string
  label: string
  timeS: number
  tone: EventTone
}

/**
 * Timeline markers computed from the trajectory the backend actually returned.
 * Only events the data supports are produced: the backend does not report a separate
 * "detection" time, so there is no detection marker.
 */
export function deriveTelemetryEvents(states: TrajectoryState[] | null): TelemetryEvent[] {
  if (!states?.length) return []
  const first = states[0]
  const last = states[states.length - 1]
  const span = Math.max(last.timeS - first.timeS, 1e-9)
  const events: TelemetryEvent[] = [{ id: 'launch', label: 'Launch', timeS: first.timeS, tone: 'neutral' }]

  if (first.interceptor.status === 'idle') {
    const launched = states.find((s) => s.interceptor.status !== 'idle')
    if (launched) events.push({ id: 'interceptor-launch', label: 'Interceptor launch', timeS: launched.timeS, tone: 'neutral' })
  }

  let closest = states[0]
  for (const s of states) if (s.separationM < closest.separationM) closest = s

  const m = last.missile.status
  const end: TelemetryEvent =
    m === 'destroyed'
      ? { id: 'end', label: 'Interception', timeS: last.timeS, tone: 'success' }
      : m === 'impact'
        ? { id: 'end', label: 'Target hit', timeS: last.timeS, tone: 'danger' }
        : m === 'out_of_bounds'
          ? { id: 'end', label: 'Out of bounds', timeS: last.timeS, tone: 'warning' }
          : { id: 'end', label: 'End of run', timeS: last.timeS, tone: 'warning' }

  // Closest approach and the end of the run usually coincide on an interception: keep one label.
  if (Math.abs(closest.timeS - last.timeS) / span > 0.02 && closest.timeS > first.timeS) {
    events.push({ id: 'closest', label: 'Closest approach', timeS: closest.timeS, tone: 'warning' })
  }
  if (last.timeS > first.timeS) events.push(end)

  return events.sort((a, b) => a.timeS - b.timeS)
}

export function formatClock(timeS: number): string {
  const t = Math.max(0, timeS)
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
