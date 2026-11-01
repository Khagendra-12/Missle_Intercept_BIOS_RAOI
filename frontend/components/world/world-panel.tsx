'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { usePlayback } from '@/components/simulation/use-playback'
import type { SimulationController } from '@/components/simulation/use-simulation'
import { TelemetryPanel } from '@/components/telemetry/telemetry-panel'
import { HOVER_DEBOUNCE_MS } from '@/lib/config'
import { formatLayer } from '@/lib/layer-math'
import { buildLayerStack } from '@/lib/layer-stack'
import { describeError } from '@/lib/transport'
import { CellInspector } from './cell-inspector'
import { LayerNavigator } from './layer-navigator'
import { WorldCanvas, type HoverCell } from './world-canvas'

export function WorldPanel({ sim }: { sim: SimulationController }) {
  const states = sim.trajectory?.states ?? null
  const playback = usePlayback(states)
  const engagement = sim.snapshot?.engagements.find((e) => e.run === sim.selectedRun) ?? null
  const engagementLayer = states?.[0]?.missile.layer ?? engagement?.layer ?? null

  const [layer, setLayer] = useState('0')
  const [prevEngLayer, setPrevEngLayer] = useState(engagementLayer)
  if (prevEngLayer !== engagementLayer) {
    setPrevEngLayer(engagementLayer)
    if (engagementLayer) setLayer(engagementLayer)
  }

  const layers = useMemo(
    () => buildLayerStack({ active: layer, states, index: playback.index }),
    [layer, states, playback.index],
  )

  const [hoverCell, setHoverCell] = useState<HoverCell | null>(null)
  const [queryCell, setQueryCell] = useState<HoverCell | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setQueryCell(hoverCell), HOVER_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [hoverCell])

  const env = useSWR(
    queryCell ? ['env', sim.api, queryCell.layer, queryCell.x, queryCell.y] : null,
    () => sim.api.getEnvironment(queryCell!.layer, queryCell!.x, queryCell!.y),
    { revalidateOnFocus: false, keepPreviousData: true, shouldRetryOnError: false },
  )

  let overlay: string | null = null
  if (!sim.jobId) overlay = 'Run a simulation to visualise an engagement.'
  else if (sim.status === 'queued' || sim.status === 'running') overlay = 'Simulation running…'
  else if (sim.trajectoryLoading) overlay = 'Loading trajectory…'
  else if (sim.trajectoryError) overlay = sim.trajectoryError
  else if (sim.status === 'completed' && !states) overlay = sim.selectedRun !== null ? `Run #${sim.selectedRun}: the backend did not record a trajectory for this engagement.` : 'No engagement with a recorded trajectory.'

  return (
    <section className="flex min-h-0 min-w-0 flex-col" aria-label="World view">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">World</h2>
          <span className="font-mono text-[11px] text-muted-foreground">
            {sim.gridSize}×{sim.gridSize} km
            {sim.selectedRun !== null && ` · run #${sim.selectedRun}`}
            {engagementLayer && ` · L ${formatLayer(engagementLayer)}`}
          </span>
          <span className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-missile" aria-hidden="true" />Missile</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-interceptor" aria-hidden="true" />Interceptor</span>
          </span>
        </div>
        <LayerNavigator layer={layer} onChange={setLayer} engagementLayer={engagementLayer} />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <WorldCanvas
          gridSize={sim.gridSize}
          states={states}
          index={playback.index}
          detectionRangeKm={sim.detectionRangeKm}
          layers={layers}
          activeLayer={layer}
          hoverCell={hoverCell}
          onHoverCell={setHoverCell}
          onSelectLayer={setLayer}
        />
        {overlay && (
          <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center px-6">
            <p className="max-w-md rounded-md border border-border bg-card/90 px-3 py-2 text-center text-xs text-muted-foreground backdrop-blur">{overlay}</p>
          </div>
        )}
      </div>

      <CellInspector cell={queryCell} layer={queryCell?.layer ?? layer} env={env.data} loading={env.isLoading || env.isValidating} error={env.error ? describeError(env.error) : null} />
      <TelemetryPanel playback={playback} states={states} interceptionRadiusM={sim.interceptionRadiusM} />
    </section>
  )
}
