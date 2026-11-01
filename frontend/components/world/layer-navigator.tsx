'use client'

import { ChevronFirst, ChevronLast, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { clampOffsetLayer, formatLayer, isMaxLayer, isMinLayer, parseLayer } from '@/lib/layer-math'
import { LAYER_MAX, LAYER_MIN } from '@/lib/backend-contract'

interface LayerNavigatorProps {
  layer: string
  onChange: (layer: string) => void
  engagementLayer: string | null
}

export function LayerNavigator({ layer, onChange, engagementLayer }: LayerNavigatorProps) {
  const [draft, setDraft] = useState(layer)
  const [prevLayer, setPrevLayer] = useState(layer)
  const [error, setError] = useState<string | null>(null)
  if (prevLayer !== layer) {
    setPrevLayer(layer)
    setDraft(layer)
    setError(null)
  }

  const commit = () => {
    const res = parseLayer(draft)
    if (res.ok) onChange(res.layer)
    else setError(res.error)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Layer</span>
      <Button size="icon-xs" variant="ghost" onClick={() => onChange(LAYER_MIN)} disabled={isMinLayer(layer)} aria-label="First layer">
        <ChevronFirst aria-hidden="true" />
      </Button>
      <Button size="xs" variant="ghost" onClick={() => onChange(clampOffsetLayer(layer, -10))} disabled={isMinLayer(layer)} aria-label="Back 10 layers">
        -10
      </Button>
      <Button size="icon-xs" variant="ghost" onClick={() => onChange(clampOffsetLayer(layer, -1))} disabled={isMinLayer(layer)} aria-label="Previous layer">
        <Minus aria-hidden="true" />
      </Button>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          commit()
        }}
      >
        <label htmlFor="layer-input" className="sr-only">
          Layer index
        </label>
        <Input
          id="layer-input"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setError(null)
          }}
          onBlur={commit}
          aria-invalid={Boolean(error)}
          title={error ?? formatLayer(layer)}
          className="h-7 w-40 font-mono text-xs"
        />
      </form>
      <Button size="icon-xs" variant="ghost" onClick={() => onChange(clampOffsetLayer(layer, 1))} disabled={isMaxLayer(layer)} aria-label="Next layer">
        <Plus aria-hidden="true" />
      </Button>
      <Button size="xs" variant="ghost" onClick={() => onChange(clampOffsetLayer(layer, 10))} disabled={isMaxLayer(layer)} aria-label="Forward 10 layers">
        +10
      </Button>
      <Button size="icon-xs" variant="ghost" onClick={() => onChange(LAYER_MAX)} disabled={isMaxLayer(layer)} aria-label="Last layer (10^100)">
        <ChevronLast aria-hidden="true" />
      </Button>
      {engagementLayer && engagementLayer !== layer && (
        <Button size="xs" variant="outline" onClick={() => onChange(engagementLayer)}>
          Go to run layer
        </Button>
      )}
      {error && <span className="text-[11px] text-destructive">{error}</span>}
    </div>
  )
}
