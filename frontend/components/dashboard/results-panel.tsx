'use client'

import { useState } from 'react'
import { Progress } from '@/components/ui/progress'
import type { SimulationController } from '@/components/simulation/use-simulation'
import type { EngagementOutcome } from '@/lib/types'
import { cn } from '@/lib/utils'

export const OUTCOME_META: Record<EngagementOutcome, { label: string; className: string; bar: string }> = {
  INTERCEPTION_SUCCESS: { label: 'Intercepted', className: 'text-success', bar: 'bg-success' },
  INTERCEPTION_FAILED: { label: 'Failed', className: 'text-missile', bar: 'bg-missile' },
  SIMULATION_TIMEOUT: { label: 'Timeout', className: 'text-warning', bar: 'bg-warning' },
  NO_INTERCEPT_SOLUTION: { label: 'No solution', className: 'text-chart-4', bar: 'bg-chart-4' },
  MISSILE_OUT_OF_BOUNDS: { label: 'Out of bounds', className: 'text-muted-foreground', bar: 'bg-chart-5' },
}

const MAX_ROWS = 300
const fmt = (v: number | null | undefined, digits = 1, unit = '') => (v === null || v === undefined ? '—' : `${v.toFixed(digits)}${unit}`)

export function ResultsPanel({ sim }: { sim: SimulationController }) {
  const [filter, setFilter] = useState<EngagementOutcome | 'ALL'>('ALL')
  const snap = sim.snapshot
  const summary = snap?.summary ?? null
  const engagements = snap?.engagements ?? []
  const counts = engagements.reduce<Record<string, number>>((acc, e) => {
    const k = e.outcome ?? 'UNKNOWN'
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
  const rows = (filter === 'ALL' ? engagements : engagements.filter((e) => e.outcome === filter)).slice(0, MAX_ROWS)
  const running = sim.status === 'queued' || sim.status === 'running'

  return (
    <aside className="flex min-h-0 flex-col border-l border-border bg-card/40" aria-label="Results">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Results</h2>
        {sim.status && <StatusPill status={sim.status} />}
      </div>

      <div className="flex flex-col gap-4 p-4">
        {!sim.jobId && <p className="text-sm text-muted-foreground">Configure parameters and run a simulation to see Monte Carlo results.</p>}
        {running && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">Running on backend… results arrive when the job completes.</p>
            <Progress value={summary?.progress !== null && summary?.progress !== undefined ? summary.progress * 100 : null} />
            <p className="font-mono text-[11px] text-muted-foreground">job {sim.jobId}</p>
          </div>
        )}
        {sim.jobError && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{sim.jobError}</p>}
        {snap?.error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{snap.error}</p>}

        {summary && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Interception success rate</span>
              <span className="font-mono text-4xl font-semibold tracking-tight text-success">{fmt(summary.successRate !== null ? summary.successRate * 100 : null, 1, '%')}</span>
              {summary.backendInterceptRate !== null && (
                <span className="font-mono text-[11px] text-muted-foreground">backend intercept_rate {(summary.backendInterceptRate * 100).toFixed(1)}%</span>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-2">
              <Stat label="Runs" value={summary.totalRuns.toLocaleString()} />
              <Stat label="Intercepts" value={summary.successes.toLocaleString()} />
              <Stat label="Mean t intercept" value={fmt(summary.meanInterceptTimeS, 1, ' s')} />
              <Stat label="Mean closest" value={fmt(summary.meanClosestApproachM, 1, ' m')} />
            </dl>

            <div className="flex flex-col gap-2">
              <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label="Outcome distribution">
                {(Object.keys(OUTCOME_META) as EngagementOutcome[]).map((o) =>
                  counts[o] ? <div key={o} className={OUTCOME_META[o].bar} style={{ width: `${(counts[o] / engagements.length) * 100}%` }} /> : null,
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                <FilterChip active={filter === 'ALL'} onClick={() => setFilter('ALL')} label="All" count={engagements.length} />
                {(Object.keys(OUTCOME_META) as EngagementOutcome[]).map((o) =>
                  counts[o] ? (
                    <FilterChip key={o} active={filter === o} onClick={() => setFilter(o)} label={OUTCOME_META[o].label} count={counts[o]} dot={OUTCOME_META[o].bar} />
                  ) : null,
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {engagements.length > 0 && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-border">
          <div className="grid grid-cols-[3rem_1fr_4rem_4rem] gap-2 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Run</span>
            <span>Outcome</span>
            <span className="text-right">t (s)</span>
            <span className="text-right">min (m)</span>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto pb-2">
            {rows.map((e) => {
              const meta = e.outcome ? OUTCOME_META[e.outcome] : null
              const selected = sim.selectedRun === e.run
              return (
                <li key={e.run}>
                  <button
                    onClick={() => sim.setSelectedRun(e.run)}
                    title={e.note ?? e.reason ?? undefined}
                    aria-pressed={selected}
                    className={cn(
                      'grid w-full grid-cols-[3rem_1fr_4rem_4rem] items-center gap-2 px-4 py-1.5 text-left font-mono text-xs hover:bg-accent/50',
                      selected && 'bg-primary/10 hover:bg-primary/15',
                    )}
                  >
                    <span className="text-muted-foreground">#{e.run}</span>
                    <span className={cn('flex items-center gap-1.5 truncate', meta?.className)}>
                      {meta?.label ?? e.backendStatus}
                      {e.hasTrajectory && <span className="size-1.5 shrink-0 rounded-full bg-interceptor" aria-label="has trajectory" />}
                    </span>
                    <span className="text-right">{fmt(e.timeS)}</span>
                    <span className="text-right">{fmt(e.closestM)}</span>
                  </button>
                </li>
              )
            })}
            {engagements.length > MAX_ROWS && filter === 'ALL' && (
              <li className="px-4 py-2 text-[11px] text-muted-foreground">Showing first {MAX_ROWS} of {engagements.length.toLocaleString()} runs.</li>
            )}
          </ul>
        </div>
      )}
    </aside>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm">{value}</dd>
    </div>
  )
}

function FilterChip({ active, onClick, label, count, dot }: { active: boolean; onClick: () => void; label: string; count: number; dot?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] transition-colors',
        active ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', dot)} aria-hidden="true" />}
      {label}
      <span className="font-mono">{count}</span>
    </button>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'completed' ? 'text-success border-success/40' : status === 'failed' ? 'text-destructive border-destructive/40' : status === 'stopped' ? 'text-muted-foreground border-border' : 'text-warning border-warning/40'
  return <span className={cn('rounded border px-2 py-0.5 font-mono text-[11px] uppercase', tone)}>{status}</span>
}
