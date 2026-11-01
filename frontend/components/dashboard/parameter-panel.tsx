
'use client'

import {
  ChevronDown,
  Dices,
  Loader2,
  Play,
  RotateCcw,
  Square,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import type { SimulationController } from '@/components/simulation/use-simulation'
import { INTERCEPTOR_SPEED_PRESETS } from '@/lib/config'
import { PARAMETER_FIELDS, randomSeed } from '@/lib/config-schema'
import { describeError } from '@/lib/transport'
import type { ParameterField, ParameterGroup } from '@/lib/types'
import { cn } from '@/lib/utils'

const MIN_MONTE_CARLO_RUNS = 1

const GROUPS: { id: ParameterGroup; label: string }[] = [
  { id: 'simulation', label: 'Simulation' },
  { id: 'weather', label: 'Weather / GRF' },
  { id: 'advanced', label: 'Advanced physics' },
]

export function ParameterPanel({ sim }: { sim: SimulationController }) {
  const [open, setOpen] = useState<Record<ParameterGroup, boolean>>({
    simulation: true,
    weather: false,
    advanced: false,
  })

  const supported = new Set(sim.config.data?.supported ?? [])
  const running = sim.status === 'queued' || sim.status === 'running'
  const hasErrors = Object.keys(sim.errors).length > 0

  const monteCarloRuns = Math.max(
    MIN_MONTE_CARLO_RUNS,
    Math.floor(Number(sim.values.monteCarloRuns ?? MIN_MONTE_CARLO_RUNS)) ||
      MIN_MONTE_CARLO_RUNS,
  )

  return (
    <aside
      className="flex min-h-0 flex-col border-r border-border bg-card/40"
      aria-label="Simulation parameters"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Parameters
        </h2>

        <Button
          size="xs"
          variant="ghost"
          onClick={sim.resetValues}
          disabled={!sim.config.data || running}
        >
          <RotateCcw aria-hidden="true" />
          Defaults
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {sim.config.isLoading && (
          <p className="p-4 text-sm text-muted-foreground">
            Loading backend config…
          </p>
        )}

        {sim.config.error && (
          <p className="m-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            Could not load config: {describeError(sim.config.error)}
          </p>
        )}

        {sim.config.data &&
          GROUPS.map((group) => {
            const fields = PARAMETER_FIELDS.filter(
              (field) =>
                field.group === group.id && supported.has(field.id),
            )

            if (!fields.length) return null

            return (
              <section key={group.id} className="border-b border-border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium hover:bg-accent/40"
                  aria-expanded={open[group.id]}
                  onClick={() =>
                    setOpen((current) => ({
                      ...current,
                      [group.id]: !current[group.id],
                    }))
                  }
                >
                  {group.label}

                  <span className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    {fields.length}

                    <ChevronDown
                      className={cn(
                        'size-4 transition-transform',
                        open[group.id] && 'rotate-180',
                      )}
                      aria-hidden="true"
                    />
                  </span>
                </button>

                {open[group.id] && (
                  <div className="flex flex-col gap-4 px-4 pb-4 pt-1">
                    {fields.map((field) => {
                      const fixed = false

                      return (
                        <FieldControl
                          key={field.id}
                          field={field}
                          value={
                            fixed
                              ? 1
                              : field.id === 'monteCarloRuns'
                                ? monteCarloRuns
                                : sim.values[field.id]
                          }
                          defaultValue={
                            fixed
                              ? 1
                              : sim.config.data!.defaults[field.id]
                          }
                          error={sim.errors[field.id]}
                          disabled={running}
                          fixed={false}
                          onChange={(value) => {
                            if (!fixed) sim.setValue(field.id, value)
                          }}
                        />
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-4">
        {sim.startError && (
          <p className="text-xs text-destructive">{sim.startError}</p>
        )}

        {sim.stopNote && (
          <p className="text-xs text-muted-foreground">{sim.stopNote}</p>
        )}

        {running ? (
          <Button
            variant="destructive"
            onClick={sim.stop}
            className="w-full"
          >
            <Square aria-hidden="true" />
            Stop simulation
          </Button>
        ) : (
          <Button
            onClick={sim.start}
            disabled={
              !sim.config.data ||
              hasErrors ||
              sim.starting
            }
            className="w-full"
          >
            {sim.starting ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}

            Run {monteCarloRuns.toLocaleString()} engagements
          </Button>
        )}

        {hasErrors && (
          <p className="text-xs text-destructive">
            Fix {Object.keys(sim.errors).length} invalid parameter(s).
          </p>
        )}

        <p className="text-center font-mono text-[10px] text-muted-foreground">
          Up to 100 hostile attackers · Minimum 1 Monte Carlo run
        </p>
      </div>
    </aside>
  )
}

interface FieldControlProps {
  field: ParameterField
  value: number | string | undefined
  defaultValue: number | string | undefined
  error?: string
  disabled: boolean
  fixed?: boolean
  onChange: (value: number | string) => void
}

function FieldControl({
  field,
  value,
  defaultValue,
  error,
  disabled,
  fixed = false,
  onChange,
}: FieldControlProps) {
  const id = `param-${field.id}`
  const changed = value !== defaultValue
  const numeric = Number(value)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="flex items-center gap-1.5 text-xs text-foreground/90"
        >
          {field.label}

          {changed && (
            <span
              className="size-1.5 rounded-full bg-primary"
              aria-label="modified"
            />
          )}
        </label>

        {fixed ? (
          <span className="rounded border border-primary/40 px-1 font-mono text-[10px] text-primary">
            fixed at 1
          </span>
        ) : field.engine === 'ignored' ? (
          <span
            className="rounded border border-warning/40 px-1 font-mono text-[10px] text-warning"
            title={
              field.note ??
              'Accepted by the backend but not read by the simulation engine.'
            }
          >
            unused
          </span>
        ) : null}
      </div>

      {field.kind === 'seed' ? (
        <div className="flex gap-1.5">
          <Input
            id={id}
            value={String(value ?? '')}
            inputMode="numeric"
            onChange={(event) => onChange(event.target.value.trim())}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            className="h-8 font-mono text-xs"
          />

          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => onChange(randomSeed())}
            disabled={disabled}
            aria-label={`Randomize ${field.label}`}
          >
            <Dices aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {field.slider && (
            <Slider
              value={[
                Number.isFinite(numeric)
                  ? Math.min(field.max, Math.max(field.min, numeric))
                  : field.min,
              ]}
              min={field.min}
              max={sliderMax(field, defaultValue)}
              step={field.step}
              disabled={disabled}
              onValueChange={(next) =>
                onChange(Array.isArray(next) ? next[0] : (next as number))
              }
              aria-label={field.label}
              className="flex-1"
            />
          )}

          <div className={cn('relative', field.slider ? 'w-24' : 'flex-1')}>
            <Input
              id={id}
              type="number"
              value={Number.isFinite(numeric) ? numeric : ''}
              min={
                field.id === 'monteCarloRuns'
                  ? MIN_MONTE_CARLO_RUNS
                  : field.min
              }
              max={field.max}
              step={field.step}
              disabled={disabled}
              aria-invalid={Boolean(error)}
              onChange={(event) =>
                onChange(
                  event.target.value === ''
                    ? NaN
                    : Number(event.target.value),
                )
              }
              className="h-8 pr-9 font-mono text-xs"
            />

            {field.unit && (
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center font-mono text-[10px] text-muted-foreground">
                {field.unit}
              </span>
            )}
          </div>
        </div>
      )}

      {field.id === 'interceptorMaxSpeedMps' && (
        <div className="flex gap-1.5">
          {INTERCEPTOR_SPEED_PRESETS.map((preset) => (
            <Button
              key={preset}
              size="xs"
              variant={numeric === preset ? 'secondary' : 'ghost'}
              onClick={() => onChange(preset)}
              disabled={disabled}
            >
              {preset} m/s
            </Button>
          ))}
        </div>
      )}

      {error && (
        <p className="text-[11px] text-destructive">{error}</p>
      )}
    </div>
  )
}

/** Keeps sliders usable for fields with very large hard limits. */
function sliderMax(
  field: ParameterField,
  defaultValue: number | string | undefined,
) {
  if (field.id === 'monteCarloRuns') return 1000

  const d = Number(defaultValue)

  if (!Number.isFinite(d) || d <= 0) return field.max

  return Math.min(
    field.max,
    Math.max(d * 10, field.min + field.step * 10),
  )
}
