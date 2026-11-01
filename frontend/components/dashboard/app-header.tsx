'use client'

import { Crosshair, Plug } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { describeError } from '@/lib/transport'
import type { SimulationController } from '@/components/simulation/use-simulation'
import { cn } from '@/lib/utils'

export function AppHeader({ sim }: { sim: SimulationController }) {
  const [url, setUrl] = useState(sim.baseUrl)
  const { data, error, isLoading } = sim.health
  const online = Boolean(data?.ok) && !error

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-card/60 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Crosshair className="size-4" aria-hidden="true" />
        </div>
        <div className="leading-tight">
          <h1 className="text-sm font-semibold tracking-tight">EWSim Intercept Console</h1>
          <p className="font-mono text-[11px] text-muted-foreground">Monte Carlo engagement simulator</p>
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-3">
        <div
          className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1 font-mono text-xs"
          title={error ? describeError(error) : undefined}
        >
          <span
            className={cn('size-2 rounded-full', isLoading ? 'bg-warning animate-pulse' : online ? 'bg-success' : 'bg-destructive')}
            aria-hidden="true"
          />
          <span className="text-muted-foreground">
            {isLoading ? 'checking' : online ? `online v${data?.version ?? '?'}` : 'offline'}
          </span>
          {online && data?.latencyMs !== null && <span className="text-muted-foreground/70">{data?.latencyMs}ms</span>}
        </div>

        <div role="radiogroup" aria-label="Backend mode" className="flex rounded-md border border-border p-0.5">
          {(['mock', 'real'] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={sim.mode === m}
              onClick={() => sim.changeConnection(m, url)}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium capitalize transition-colors',
                sim.mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            sim.changeConnection(sim.mode, url)
          }}
        >
          <label htmlFor="api-url" className="sr-only">
            Backend API URL
          </label>
          <Input
            id="api-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={sim.mode === 'mock'}
            className="h-8 w-56 font-mono text-xs"
            placeholder="http://localhost:8000"
          />
          <Button type="submit" size="sm" variant="outline" disabled={sim.mode === 'mock'}>
            <Plug aria-hidden="true" />
            Connect
          </Button>
        </form>
      </div>
    </header>
  )
}
