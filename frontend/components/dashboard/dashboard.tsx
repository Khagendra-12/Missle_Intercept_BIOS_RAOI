'use client'

import { useSimulation } from '@/components/simulation/use-simulation'
import { WorldPanel } from '@/components/world/world-panel'
import { AppHeader } from './app-header'
import { ParameterPanel } from './parameter-panel'
import { ResultsPanel } from './results-panel'

export function Dashboard() {
  const sim = useSimulation()
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader key={`${sim.mode}-${sim.baseUrl}`} sim={sim} />
      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:overflow-hidden">
        <ParameterPanel sim={sim} />
        <WorldPanel sim={sim} />
        <ResultsPanel sim={sim} />
      </main>
    </div>
  )
}
