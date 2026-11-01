
'use client'

import { useMemo, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import type { SimulationController } from '@/components/simulation/use-simulation'
import type { EngagementOutcome } from '@/lib/types'
import { cn } from '@/lib/utils'

export const OUTCOME_META: Record<
  EngagementOutcome,
  { label: string; className: string; bar: string }
> = {
  INTERCEPTION_SUCCESS: {
    label: 'Intercepted',
    className: 'text-success',
    bar: 'bg-success',
  },
  INTERCEPTION_FAILED: {
    label: 'Failed',
    className: 'text-missile',
    bar: 'bg-missile',
  },
  SIMULATION_TIMEOUT: {
    label: 'Timeout',
    className: 'text-warning',
    bar: 'bg-warning',
  },
  NO_INTERCEPT_SOLUTION: {
    label: 'No solution',
    className: 'text-chart-4',
    bar: 'bg-chart-4',
  },
  MISSILE_OUT_OF_BOUNDS: {
    label: 'Out of bounds',
    className: 'text-muted-foreground',
    bar: 'bg-chart-5',
  },
}

const MAX_ROWS = 300

function fmt(
  value: number | null | undefined,
  digits = 1,
  unit = '',
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }

  return `${value.toFixed(digits)}${unit}`
}

export function ResultsPanel({
  sim,
}: {
  sim: SimulationController
}) {
  const [filter, setFilter] = useState<EngagementOutcome | 'ALL'>('ALL')

  const snapshot = sim.snapshot
  const summary = snapshot?.summary ?? null
  const engagements = snapshot?.engagements ?? []

  const counts = useMemo(() => {
    const result: Partial<Record<EngagementOutcome, number>> = {}

    for (const engagement of engagements) {
      if (!engagement.outcome) continue

      result[engagement.outcome] =
        (result[engagement.outcome] ?? 0) + 1
    }

    return result
  }, [engagements])

  const rows = useMemo(
    () =>
      (
        filter === 'ALL'
          ? engagements
          : engagements.filter((engagement) => engagement.outcome === filter)
      ).slice(0, MAX_ROWS),
    [engagements, filter],
  )

  const running =
    sim.status === 'queued' || sim.status === 'running'

  const hasResults = engagements.length > 0
  const knownOutcomes = Object.keys(OUTCOME_META) as EngagementOutcome[]

  const progress =
    summary?.progress !== null &&
    summary?.progress !== undefined &&
    Number.isFinite(summary.progress)
      ? Math.min(100, Math.max(0, summary.progress * 100))
      : null

  const successRate =
    summary?.successRate !== null &&
    summary?.successRate !== undefined &&
    Number.isFinite(summary.successRate)
      ? summary.successRate
      : null

  return (
    <aside
      className="flex min-h-0 flex-col border-l border-border bg-card/40"
      aria-label="Results"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Results
        </h2>

        {sim.status && <StatusPill status={sim.status} />}
      </div>

      <div className="flex flex-col gap-4 p-4">
        {!sim.jobId && (
          <p className="text-sm text-muted-foreground">
            Configure parameters and run a simulation to see the engagement results.
          </p>
        )}

        {running && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Simulation running on backend…
              </p>

              {progress !== null && (
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {progress.toFixed(0)}%
                </span>
              )}
            </div>

            <Progress value={progress} />

            <p className="break-all font-mono text-[11px] text-muted-foreground">
              Job {sim.jobId}
            </p>
          </div>
        )}

        {sim.jobError && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {sim.jobError}
          </p>
        )}

        {snapshot?.error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {snapshot.error}
          </p>
        )}

        {summary && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                Interception success rate
              </span>

              <span
                className={cn(
                  'font-mono text-4xl font-semibold tracking-tight',
                  successRate === null
                    ? 'text-muted-foreground'
                    : 'text-success',
                )}
              >
                {successRate === null
                  ? '—'
                  : `${(successRate * 100).toFixed(1)}%`}
              </span>

              {summary.backendInterceptRate !== null && (
                <span className="font-mono text-[11px] text-muted-foreground">
                  Backend intercept rate:{' '}
                  {(summary.backendInterceptRate * 100).toFixed(1)}%
                </span>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-2">
              <Stat
                label="Total runs"
                value={summary.totalRuns.toLocaleString()}
              />

              <Stat
                label="Completed"
                value={summary.completed.toLocaleString()}
              />

              <Stat
                label="Intercepts"
                value={summary.successes.toLocaleString()}
              />

              <Stat
                label="Failures"
                value={summary.failures.toLocaleString()}
              />

              <Stat
                label="Mean intercept time"
                value={fmt(summary.meanInterceptTimeS, 2, ' s')}
              />

              <Stat
                label="Mean closest approach"
                value={fmt(summary.meanClosestApproachM, 2, ' m')}
              />
            </dl>

            {hasResults && (
              <div className="flex flex-col gap-2">
                <div
                  className="flex h-2 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label="Outcome distribution"
                >
                  {knownOutcomes.map((outcome) => {
                    const count = counts[outcome] ?? 0

                    if (!count) return null

                    return (
                      <div
                        key={outcome}
                        className={OUTCOME_META[outcome].bar}
                        style={{
                          width: `${(count / engagements.length) * 100}%`,
                        }}
                      />
                    )
                  })}
                </div>

                <div className="flex flex-wrap gap-1">
                  <FilterChip
                    active={filter === 'ALL'}
                    onClick={() => setFilter('ALL')}
                    label="All"
                    count={engagements.length}
                  />

                  {knownOutcomes.map((outcome) => {
                    const count = counts[outcome] ?? 0

                    if (!count) return null

                    return (
                      <FilterChip
                        key={outcome}
                        active={filter === outcome}
                        onClick={() => setFilter(outcome)}
                        label={OUTCOME_META[outcome].label}
                        count={count}
                        dot={OUTCOME_META[outcome].bar}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {summary.totalRuns === 1 && (
              <p className="text-[11px] text-muted-foreground">
                Single engagement run. The displayed outcome and trajectory
                correspond to this run.
              </p>
            )}
          </>
        )}
      </div>

      {hasResults && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-border">
          <div className="grid grid-cols-[3rem_minmax(0,1fr)_4rem_4rem] gap-2 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Run</span>
            <span>Outcome</span>
            <span className="text-right">t (s)</span>
            <span className="text-right">min (m)</span>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto pb-2">
            {rows.map((engagement) => {
              const outcome = engagement.outcome
              const meta = outcome ? OUTCOME_META[outcome] : null
              const selected = sim.selectedRun === engagement.run

              return (
                <li key={engagement.run}>
                  <button
                    type="button"
                    onClick={() => sim.setSelectedRun(engagement.run)}
                    title={
                      engagement.note ??
                      engagement.reason ??
                      undefined
                    }
                    aria-pressed={selected}
                    className={cn(
                      'grid w-full grid-cols-[3rem_minmax(0,1fr)_4rem_4rem] items-center gap-2 px-4 py-1.5 text-left font-mono text-xs hover:bg-accent/50',
                      selected && 'bg-primary/10 hover:bg-primary/15',
                    )}
                  >
                    <span className="text-muted-foreground">
                      #{engagement.run}
                    </span>

                    <span
                      className={cn(
                        'flex min-w-0 items-center gap-1.5 truncate',
                        meta?.className,
                      )}
                    >
                      <span className="truncate">
                        {meta?.label ?? engagement.backendStatus ?? 'Unknown'}
                      </span>

                      {engagement.hasTrajectory && (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-interceptor"
                          title="Trajectory available"
                          aria-label="Trajectory available"
                        />
                      )}
                    </span>

                    <span className="text-right">
                      {fmt(engagement.timeS)}
                    </span>

                    <span className="text-right">
                      {fmt(engagement.closestM)}
                    </span>
                  </button>
                </li>
              )
            })}

            {rows.length === 0 && (
              <li className="px-4 py-4 text-xs text-muted-foreground">
                No engagements match this outcome filter.
              </li>
            )}

            {engagements.length > MAX_ROWS && filter === 'ALL' && (
              <li className="px-4 py-2 text-[11px] text-muted-foreground">
                Showing the first {MAX_ROWS} of{' '}
                {engagements.length.toLocaleString()} runs.
              </li>
            )}
          </ul>
        </div>
      )}
    </aside>
  )
}

function Stat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>

      <dd className="font-mono text-sm tabular-nums">
        {value}
      </dd>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  dot?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] transition-colors',
        active
          ? 'border-primary/50 bg-primary/10 text-foreground'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {dot && (
        <span
          className={cn('size-1.5 rounded-full', dot)}
          aria-hidden="true"
        />
      )}

      {label}

      <span className="font-mono">{count}</span>
    </button>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'completed'
      ? 'text-success border-success/40'
      : status === 'failed'
        ? 'text-destructive border-destructive/40'
        : status === 'stopped'
          ? 'text-muted-foreground border-border'
          : 'text-warning border-warning/40'

  return (
    <span
      className={cn(
        'rounded border px-2 py-0.5 font-mono text-[11px] uppercase',
        tone,
      )}
    >
      {status}
    </span>
  )
}
