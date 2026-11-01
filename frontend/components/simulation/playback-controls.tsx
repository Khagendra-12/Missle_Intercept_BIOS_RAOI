'use client'

import { Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { PLAYBACK_SPEEDS } from '@/lib/config'
import { cn } from '@/lib/utils'
import type { Playback } from './use-playback'

export function PlaybackControls({ playback, disabled }: { playback: Playback; disabled: boolean }) {
  const { current } = playback
  return (
    <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="ghost" onClick={playback.reset} disabled={disabled} aria-label="Reset playback">
          <RotateCcw aria-hidden="true" />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => playback.step(-1)} disabled={disabled} aria-label="Step back">
          <StepBack aria-hidden="true" />
        </Button>
        <Button size="icon-sm" onClick={playback.toggle} disabled={disabled} aria-label={playback.playing ? 'Pause' : 'Play'}>
          {playback.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => playback.step(1)} disabled={disabled} aria-label="Step forward">
          <StepForward aria-hidden="true" />
        </Button>
        <span className="ml-1 font-mono text-xs tabular-nums">
          t = {playback.time.toFixed(1)}
          <span className="text-muted-foreground"> / {playback.duration.toFixed(1)} s</span>
        </span>

        <div role="radiogroup" aria-label="Playback speed" className="ml-auto flex flex-wrap rounded-md border border-border p-0.5">
          {PLAYBACK_SPEEDS.map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={playback.speed === s}
              onClick={() => playback.setSpeed(s)}
              disabled={disabled}
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors disabled:opacity-50',
                playback.speed === s ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <Slider
        value={[playback.time]}
        min={playback.startTime}
        max={Math.max(playback.duration, playback.startTime + 0.001)}
        step={0.01}
        disabled={disabled}
        onValueChange={(v) => playback.setTime(Array.isArray(v) ? v[0] : (v as number))}
        aria-label="Playback time"
      />

      {current && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] sm:grid-cols-4">
          <Telemetry label="Missile v" value={`${current.missile.velocityMps.toFixed(1)} m/s`} tone="text-missile" />
          <Telemetry label="Interceptor v" value={`${current.interceptor.velocityMps.toFixed(1)} m/s`} tone="text-interceptor" />
          <Telemetry label="Separation" value={`${current.separationM.toFixed(1)} m`} />
          <Telemetry label="Status" value={`${current.missile.status} / ${current.interceptor.status}`} />
        </dl>
      )}
    </div>
  )
}

function Telemetry({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('truncate', tone)}>{value}</dd>
    </div>
  )
}
