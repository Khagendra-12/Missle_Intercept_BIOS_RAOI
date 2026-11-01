'use client'

import { Gauge, Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-react'
import { useMemo } from 'react'
import type { Playback } from '@/components/simulation/use-playback'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '@/lib/config'
import { formatLayer } from '@/lib/layer-math'
import { deriveTelemetryEvents, formatClock, type EventTone } from '@/lib/telemetry-events'
import type { TrajectoryState } from '@/lib/types'
import { cn } from '@/lib/utils'

const TONE_TEXT: Record<EventTone, string> = {
  neutral: 'text-muted-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
}
const TONE_BG: Record<EventTone, string> = {
  neutral: 'bg-muted-foreground/60',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
}

interface TelemetryPanelProps {
  playback: Playback
  states: TrajectoryState[] | null
  interceptionRadiusM: number
}

export function TelemetryPanel({ playback, states, interceptionRadiusM }: TelemetryPanelProps) {
  const { current, startTime, duration } = playback
  const disabled = !states?.length
  const events = useMemo(() => deriveTelemetryEvents(states), [states])
  const span = Math.max(duration - startTime, 1e-9)
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - startTime) / span) * 100))
  const dash = '—'

  const sameLayer = current ? current.missile.layer === current.interceptor.layer : true

  return (
    <section aria-label="Engagement telemetry" className="flex flex-col gap-3 border-t border-border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Gauge className="size-3.5 text-primary" aria-hidden="true" />
          Engagement telemetry
        </h3>
        <span className="font-mono text-xs tabular-nums">
          T+{playback.time.toFixed(1)}s<span className="text-muted-foreground"> / {duration.toFixed(1)}s</span>
        </span>
      </div>

      {/* Timeline: derived event markers above a scrubber. */}
      <div>
        <div className="relative h-8" aria-hidden={events.length === 0}>
          {events.map((ev, i) => {
            const p = pct(ev.timeS)
            const row = i % 2
            const shift = p < 10 ? '0%' : p > 90 ? '-100%' : '-50%'
            return (
              <div key={ev.id} className="absolute inset-y-0" style={{ left: `${p}%` }}>
                <span
                  className={cn('absolute whitespace-nowrap font-mono text-[10px] uppercase leading-3 tracking-wide', TONE_TEXT[ev.tone])}
                  style={{ top: row * 12, transform: `translateX(${shift})` }}
                >
                  {ev.label}
                </span>
                <span className={cn('absolute bottom-0 w-px', TONE_BG[ev.tone])} style={{ top: row * 12 + 13 }} />
              </div>
            )
          })}
        </div>
        <Slider
          value={[Math.min(Math.max(playback.time, startTime), Math.max(duration, startTime + 0.001))]}
          min={startTime}
          max={Math.max(duration, startTime + 0.001)}
          step={0.01}
          disabled={disabled}
          onValueChange={(v) => playback.setTime(Array.isArray(v) ? v[0] : (v as number))}
          aria-label="Playback time"
        />
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <span key={f}>{formatClock(startTime + f * span)}</span>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Missile speed"
          value={current ? current.missile.velocityMps.toFixed(1) : dash}
          unit="m/s"
          sub={current ? `${current.missile.status} · accel ${current.missile.accelerationMps2.toFixed(1)} m/s²` : undefined}
          tone="text-missile"
        />
        <Stat
          label="Interceptor speed"
          value={current ? current.interceptor.velocityMps.toFixed(1) : dash}
          unit="m/s"
          sub={current ? `${current.interceptor.status} · accel ${current.interceptor.accelerationMps2.toFixed(1)} m/s²` : undefined}
          tone="text-interceptor"
        />
        <Stat
          label="Separation"
          value={current ? current.separationM.toFixed(1) : dash}
          unit="m"
          sub={`intercept radius ${interceptionRadiusM} m`}
          tone="text-warning"
        />
        <Stat
          label="Layer coordinate"
          value={current ? formatLayer(current.missile.layer) : dash}
          sub={current ? (sameLayer ? 'missile · interceptor' : `interceptor ${formatLayer(current.interceptor.layer)}`) : undefined}
        />
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={playback.reset} disabled={disabled}>
          <RotateCcw aria-hidden="true" />
          Restart
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => playback.step(-1)} disabled={disabled} aria-label="Step back">
          <StepBack aria-hidden="true" />
        </Button>
        <Button size="sm" onClick={playback.toggle} disabled={disabled}>
          {playback.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {playback.playing ? 'Pause' : 'Play'}
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => playback.step(1)} disabled={disabled} aria-label="Step forward">
          <StepForward aria-hidden="true" />
        </Button>
        <label className="ml-auto flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          Speed
          <select
            value={playback.speed}
            onChange={(e) => playback.setSpeed(Number(e.target.value) as PlaybackSpeed)}
            disabled={disabled}
            className="h-7 rounded-md border border-input bg-transparent px-2 font-mono text-[11px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            {PLAYBACK_SPEEDS.map((s) => (
              <option key={s} value={s} className="bg-popover">
                {s}×
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}

function Stat({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub?: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-card/60 px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 truncate font-mono text-lg font-semibold tabular-nums leading-tight', tone)}>
        {value}
        {unit && <span className="ml-1 text-[10px] font-normal text-muted-foreground">{unit}</span>}
      </dd>
      {sub && <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}
