'use client'

import { Loader2 } from 'lucide-react'
import { formatLayer } from '@/lib/layer-math'
import type { CellEnvironment } from '@/lib/types'

interface CellInspectorProps {
  cell: { x: number; y: number } | null
  layer: string
  env: CellEnvironment | undefined
  loading: boolean
  error: string | null
}

const f = (v: number | null | undefined, d = 2, unit = '') => (v === null || v === undefined ? 'n/a' : `${v.toFixed(d)}${unit}`)

export function CellInspector({ cell, layer, env, loading, error }: CellInspectorProps) {
  const derived = new Set(env?.derivedFields ?? [])
  const extras = Object.entries(env?.extra ?? {}).filter(([, v]) => typeof v === 'number' || typeof v === 'string')

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-4 py-2 font-mono text-[11px]" aria-live="polite">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {loading && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
        {cell ? `cell (${cell.x}, ${cell.y}) · L ${formatLayer(layer)}` : 'Hover the grid to inspect a cell'}
      </span>
      {error && cell && <span className="text-destructive">{error}</span>}
      {env && cell && !error && (
        <>
          <Item label="T" value={env.temperatureK !== null ? f(env.temperatureK, 1, ' K') : 'n/a'} />
          <Item label="ρ" value={f(env.densityKgM3, 3, ' kg/m³')} />
          <Item label="wind" value={f(env.windSpeedMps, 2, ' m/s')} derived={derived.has('windSpeedMps')} />
          <Item label="dir" value={f(env.windDirectionDeg, 0, '°')} derived={derived.has('windDirectionDeg')} />
          {env.windVector && <Item label="uvw" value={`${env.windVector.u.toFixed(1)}, ${env.windVector.v.toFixed(1)}, ${env.windVector.w.toFixed(1)}`} />}
          <Item label="GRF" value={f(env.grfIntensity, 3)} />
          {extras.map(([k, v]) => (
            <Item key={k} label={k} value={typeof v === 'number' ? v.toFixed(3) : String(v)} />
          ))}
        </>
      )}
    </div>
  )
}

function Item({ label, value, derived }: { label: string; value: string; derived?: boolean }) {
  return (
    <span title={derived ? 'Computed client-side from the wind vector' : undefined}>
      <span className="text-muted-foreground">{label} </span>
      <span className="text-foreground">{value}</span>
      {derived && <span className="text-muted-foreground">*</span>}
    </span>
  )
}
