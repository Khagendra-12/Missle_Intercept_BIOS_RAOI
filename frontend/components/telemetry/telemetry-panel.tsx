
'use client'

import {
  Gauge,
  Pause,
  Play,
  RotateCcw,
  StepBack,
  StepForward,
} from 'lucide-react'
import { useMemo } from 'react'
import type { Playback } from '@/components/simulation/use-playback'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '@/lib/config'
import { formatLayer } from '@/lib/layer-math'
import {
  deriveTelemetryEvents,
  formatClock,
  type EventTone,
} from '@/lib/telemetry-events'
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

function displayNumber(value: number | null | undefined, decimals = 1) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(decimals)
    : '—'
}

export function TelemetryPanel({
  playback,
  states,
  interceptionRadiusM,
}: TelemetryPanelProps) {
  const { current, startTime, duration } = playback

  const disabled = !states?.length
  const events = useMemo(() => deriveTelemetryEvents(states), [states])

  const span = Math.max(duration - startTime, 1e-9)
  const sliderMax = Math.max(duration, startTime + 0.001)

  const pct = (timeS: number) =>
    Math.min(100, Math.max(0, ((timeS - startTime) / span) * 100))

  const dash = '—'

  const sameLayer = current
    ? current.missile.layer === current.interceptor.layer
    : true

  const sliderValue = Math.min(
    Math.max(Number.isFinite(playback.time) ? playback.time : startTime, startTime),
    sliderMax,
  )

  return (
    <section
      aria-label="Engagement telemetry"
      className="flex flex-col gap-3 border-t border-border px-4 py-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Gauge
            className="size-3.5 text-primary"
            aria-hidden="true"
          />
          Engagement telemetry
        </h3>

        <span className="font-mono text-xs tabular-nums">
          T+{displayNumber(playback.time)}s
          <span className="text-muted-foreground">
            {' '} / {displayNumber(duration)}s
          </span>
        </span>
      </div>

      {/* Timeline with event markers and playback scrubber. */}
      <div>
        <div
          className="relative h-8"
          aria-hidden={events.length === 0}
        >
          {events.map((event, i) => {
            const position = pct(event.timeS)
            const row = i % 2
            const shift =
              position < 10 ? '0%' : position > 90 ? '-100%' : '-50%'

            return (
              <div
                key={event.id}
                className="absolute inset-y-0"
                style={{ left: `${position}%` }}
              >
                <span
                  className={cn(
                    'absolute whitespace-nowrap font-mono text-[10px] uppercase leading-3 tracking-wide',
                    TONE_TEXT[event.tone],
                  )}
                  style={{
                    top: row * 12,
                    transform: `translateX(${shift})`,
                  }}
                >
                  {event.label}
                </span>

                <span
                  className={cn('absolute bottom-0 w-px', TONE_BG[event.tone])}
                  style={{ top: row * 12 + 13 }}
                />
              </div>
            )
          })}
        </div>

        <Slider
          value={[sliderValue]}
          min={startTime}
          max={sliderMax}
          step={0.01}
          disabled={disabled}
          onValueChange={(value) => {
            const next = Array.isArray(value) ? value[0] : value
            if (typeof next === 'number') playback.setTime(next)
          }}
          aria-label="Playback time"
        />

        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
            <span key={fraction}>
              {formatClock(startTime + fraction * span)}
            </span>
          ))}
        </div>
      </div>

      {/* Live projectile measurements. */}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Missile speed"
          value={current ? displayNumber(current.missile.velocityMps) : dash}
          unit="m/s"
          sub={
            current
              ? `${current.missile.status} · accel ${displayNumber(current.missile.accelerationMps2)} m/s²`
              : undefined
          }
          tone="text-missile"
        />

        <Stat
          label="Interceptor speed"
          value={current ? displayNumber(current.interceptor.velocityMps) : dash}
          unit="m/s"
          sub={
            current
              ? `${current.interceptor.status} · accel ${displayNumber(current.interceptor.accelerationMps2)} m/s²`
              : undefined
          }
          tone="text-interceptor"
        />

        <Stat
          label="Separation"
          value={current ? displayNumber(current.separationM) : dash}
          unit="m"
          sub={`intercept radius ${displayNumber(interceptionRadiusM)} m`}
          tone="text-warning"
        />

        <Stat
          label="Layer coordinates"
          value={current ? formatLayer(current.missile.layer) : dash}
          sub={
            current
              ? sameLayer
                ? 'Missile and interceptor'
                : `Interceptor: ${formatLayer(current.interceptor.layer)}`
              : undefined
          }
        />
      </dl>

      {/* Explicit layer comparison when the projectiles occupy different layers. */}
      {current && !sameLayer && (
        <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-card/40 px-3 py-2">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Missile layer
            </p>
            <p className="truncate font-mono text-sm text-missile">
              {formatLayer(current.missile.layer)}
            </p>
          </div>

          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Interceptor layer
            </p>
            <p className="truncate font-mono text-sm text-interceptor">
              {formatLayer(current.interceptor.layer)}
            </p>
          </div>
        </div>
      )}

      {/* Playback controls. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={playback.reset}
          disabled={disabled}
        >
          <RotateCcw aria-hidden="true" />
          Restart
        </Button>

        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => playback.step(-1)}
          disabled={disabled}
          aria-label="Step back"
        >
          <StepBack aria-hidden="true" />
        </Button>

        <Button
          size="sm"
          onClick={playback.toggle}
          disabled={disabled}
        >
          {playback.playing ? (
            <Pause aria-hidden="true" />
          ) : (
            <Play aria-hidden="true" />
          )}
          {playback.playing ? 'Pause' : 'Play'}
        </Button>

        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => playback.step(1)}
          disabled={disabled}
          aria-label="Step forward"
        >
          <StepForward aria-hidden="true" />
        </Button>

        <label className="ml-auto flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          Speed

          <select
            value={playback.speed}
            onChange={(event) =>
              playback.setSpeed(Number(event.target.value) as PlaybackSpeed)
            }
            disabled={disabled}
            className="h-7 rounded-md border border-input bg-transparent px-2 font-mono text-[11px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            {PLAYBACK_SPEEDS.map((speed) => (
              <option
                key={speed}
                value={speed}
                className="bg-popover"
              >
                {speed}×
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string
  value: string
  unit?: string
  sub?: string
  tone?: string
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-card/60 px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>

      <dd
        className={cn(
          'mt-0.5 truncate font-mono text-lg font-semibold tabular-nums leading-tight',
          tone,
        )}
      >
        {value}

        {unit && (
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </dd>

      {sub && (
        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
          {sub}
        </p>
      )}
    </div>
  )
}
