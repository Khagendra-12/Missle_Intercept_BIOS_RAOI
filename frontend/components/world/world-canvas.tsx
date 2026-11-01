'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatLayer } from '@/lib/layer-math'
import {
  computeStackLayout,
  hitTestStack,
  projectToRhombus,
  stackIndexOf,
  type Rhombus,
} from '@/lib/layer-stack'
import type { TrajectoryState } from '@/lib/types'

export interface HoverCell {
  x: number
  y: number
  layer: string
}

interface WorldCanvasProps {
  gridSize: number
  states: TrajectoryState[] | null
  index: number
  detectionRangeKm: number
  /** Layers to draw, highest index first. */
  layers: string[]
  activeLayer: string
  hoverCell: HoverCell | null
  onHoverCell: (cell: HoverCell | null) => void
  onSelectLayer: (layer: string) => void
}

const ACTIVE = 'oklch(0.76 0.16 155)'
const COLORS = {
  fillActive: 'oklch(0.76 0.16 155 / 0.12)',
  fillIdle: 'oklch(1 0 0 / 0.03)',
  strokeActive: 'oklch(0.76 0.16 155 / 0.85)',
  strokeIdle: 'oklch(1 0 0 / 0.22)',
  gridActive: 'oklch(0.76 0.16 155 / 0.2)',
  gridIdle: 'oklch(1 0 0 / 0.07)',
  labelActive: 'oklch(0.9 0.06 155)',
  labelIdle: 'rgba(200,210,225,0.5)',
  hud: 'oklch(0.76 0.16 155 / 0.75)',
  missile: 'oklch(0.7 0.19 35)',
  interceptor: 'oklch(0.8 0.13 205)',
  hover: 'oklch(0.8 0.13 205 / 0.4)',
  detect: 'rgba(120,200,230,0.4)',
  connector: 'rgba(200,210,225,0.45)',
}
const MONO = '10px var(--font-geist-mono), ui-monospace, monospace'

export function WorldCanvas({
  gridSize,
  states,
  index,
  detectionRangeKm,
  layers,
  activeLayer,
  hoverCell,
  onHoverCell,
  onSelectLayer,
}: WorldCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [overLayer, setOverLayer] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setDims({ w: Math.max(0, Math.floor(width)), h: Math.max(0, Math.floor(height)) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const layout = useMemo<Rhombus[]>(() => computeStackLayout(dims.w, dims.h, layers.length), [dims, layers.length])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !dims.w || !dims.h || !layout.length) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = dims.w * dpr
    canvas.height = dims.h * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, dims.w, dims.h)

    const n = Math.max(1, gridSize)
    const idxOf = (layer: string) => stackIndexOf(layers, layer)
    const proj = (li: number, xKm: number, yKm: number) => projectToRhombus(layout[li], n, xKm, yKm)

    // Stack, drawn bottom-up so the top layer sits in front.
    for (let li = layers.length - 1; li >= 0; li--) {
      const r = layout[li]
      const active = layers[li] === activeLayer
      const tl = proj(li, 0, n)
      const tr = proj(li, n, n)
      const br = proj(li, n, 0)
      const bl = proj(li, 0, 0)

      ctx.beginPath()
      ctx.moveTo(tl.x, tl.y)
      ctx.lineTo(tr.x, tr.y)
      ctx.lineTo(br.x, br.y)
      ctx.lineTo(bl.x, bl.y)
      ctx.closePath()
      ctx.fillStyle = active ? COLORS.fillActive : COLORS.fillIdle
      ctx.fill()

      // Cell grid: tied to the real grid size, thinned so lines stay ~18 px / 8 px apart.
      const stepU = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(r.width / 18))))
      const stepV = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(r.height / 8))))
      ctx.beginPath()
      for (let c = stepU; c < n; c += stepU) {
        const a = proj(li, c, n)
        const b = proj(li, c, 0)
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
      }
      for (let rr = stepV; rr < n; rr += stepV) {
        const a = proj(li, 0, n - rr)
        const b = proj(li, n, n - rr)
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
      }
      ctx.lineWidth = 1
      ctx.strokeStyle = active ? COLORS.gridActive : COLORS.gridIdle
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(tl.x, tl.y)
      ctx.lineTo(tr.x, tr.y)
      ctx.lineTo(br.x, br.y)
      ctx.lineTo(bl.x, bl.y)
      ctx.closePath()
      ctx.lineWidth = active ? 1.5 : 1
      ctx.strokeStyle = active ? COLORS.strokeActive : COLORS.strokeIdle
      ctx.stroke()

      ctx.font = MONO
      ctx.fillStyle = active ? COLORS.labelActive : COLORS.labelIdle
      ctx.textAlign = 'left'
      ctx.fillText(`L ${formatLayer(layers[li], 24)}${active ? '  · ACTIVE' : ''}`, bl.x, bl.y + 16)
    }

    // Hovered cell.
    if (hoverCell) {
      const li = layers.indexOf(hoverCell.layer)
      if (li >= 0) {
        const { x, y } = hoverCell
        const p = [proj(li, x, y + 1), proj(li, x + 1, y + 1), proj(li, x + 1, y), proj(li, x, y)]
        ctx.beginPath()
        ctx.moveTo(p[0].x, p[0].y)
        for (let k = 1; k < 4; k++) ctx.lineTo(p[k].x, p[k].y)
        ctx.closePath()
        ctx.fillStyle = COLORS.hover
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = COLORS.interceptor
        ctx.stroke()
      }
    }

    // HUD.
    ctx.font = MONO
    ctx.fillStyle = COLORS.hud
    ctx.textAlign = 'left'
    ctx.fillText(`ACTIVE LAYER // ${formatLayer(activeLayer, 24)}`, 16, 24)
    ctx.fillText(`GRID ${n} × ${n} km // ${layers.length} LAYERS SHOWN`, 16, 38)

    if (!states?.length) return
    const first = states[0]
    const last = states[states.length - 1]
    const cur = states[Math.max(0, Math.min(index, states.length - 1))]

    // Detection range around the interceptor site (a circle in km becomes an ellipse here).
    {
      const li = idxOf(first.interceptor.layer)
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = COLORS.detect
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let k = 0; k <= 72; k++) {
        const a = (k / 72) * Math.PI * 2
        const p = proj(li, first.interceptor.xKm + Math.cos(a) * detectionRangeKm, first.interceptor.yKm + Math.sin(a) * detectionRangeKm)
        if (k === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    const trail = (key: 'missile' | 'interceptor', upto: number, color: string, alpha: number, width: number) => {
      ctx.globalAlpha = alpha
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.beginPath()
      for (let i = 0; i <= upto; i++) {
        const s = states[i][key]
        const p = proj(idxOf(s.layer), s.xKm, s.yKm)
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    trail('missile', states.length - 1, COLORS.missile, 0.25, 1)
    trail('interceptor', states.length - 1, COLORS.interceptor, 0.25, 1)
    trail('missile', index, COLORS.missile, 1, 2)
    trail('interceptor', index, COLORS.interceptor, 1, 2)

    // Launch points.
    ctx.strokeStyle = COLORS.labelIdle
    ctx.lineWidth = 1
    for (const s of [first.missile, first.interceptor]) {
      const p = proj(idxOf(s.layer), s.xKm, s.yKm)
      ctx.strokeRect(p.x - 3, p.y - 3, 6, 6)
    }

    const mP = proj(idxOf(cur.missile.layer), cur.missile.xKm, cur.missile.yKm)
    const iP = proj(idxOf(cur.interceptor.layer), cur.interceptor.xKm, cur.interceptor.yKm)

    // Missile and interceptor on different layers: show the vertical gap between them.
    if (idxOf(cur.missile.layer) !== idxOf(cur.interceptor.layer)) {
      ctx.setLineDash([2, 4])
      ctx.strokeStyle = COLORS.connector
      ctx.beginPath()
      ctx.moveTo(mP.x, mP.y)
      ctx.lineTo(iP.x, iP.y)
      ctx.stroke()
      ctx.setLineDash([])
    }

    const dot = (p: { x: number; y: number }, color: string, label: string, dy: number) => {
      ctx.shadowBlur = 18
      ctx.shadowColor = color
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.font = MONO
      ctx.textAlign = 'left'
      ctx.fillText(label, p.x + 12, p.y + dy)
    }
    dot(mP, COLORS.missile, 'HOSTILE MISSILE', -9)
    dot(iP, COLORS.interceptor, 'DEFENSIVE INTERCEPTOR', 16)

    if (index >= states.length - 1 && last.missile.status === 'destroyed') {
      const p = proj(idxOf(last.missile.layer), last.missile.xKm, last.missile.yKm)
      ctx.strokeStyle = ACTIVE
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(p.x, p.y, 11, 0, Math.PI * 2)
      ctx.stroke()
    }
  }, [dims, layout, layers, activeLayer, gridSize, states, index, detectionRangeKm, hoverCell])

  const hitAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return hitTestStack(layout, gridSize, e.clientX - rect.left, e.clientY - rect.top)
  }

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const hit = hitAt(e)
    setOverLayer(hit !== null)
    if (!hit) return hoverCell ? onHoverCell(null) : undefined
    const layer = layers[hit.index]
    if (hoverCell?.x !== hit.x || hoverCell?.y !== hit.y || hoverCell?.layer !== layer) onHoverCell({ x: hit.x, y: hit.y, layer })
  }

  return (
    <div className="min-h-0 flex-1 p-4">
      <div ref={wrapRef} className="relative h-full min-h-48 w-full overflow-hidden rounded-md border border-border bg-background/60">
        <canvas
          ref={canvasRef}
          style={{ width: dims.w, height: dims.h, cursor: overLayer ? 'crosshair' : 'default' }}
          className="absolute inset-0 block"
          onPointerMove={handleMove}
          onPointerLeave={() => {
            setOverLayer(false)
            onHoverCell(null)
          }}
          onClick={(e) => {
            const hit = hitAt(e)
            if (hit) onSelectLayer(layers[hit.index])
          }}
          role="img"
          aria-label={`Stack of ${layers.length} layers, each a ${gridSize} by ${gridSize} km grid${states?.length ? ', with missile and interceptor trajectories' : ''}. Click a layer to make it active.`}
        />
        <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <ArrowUp className="size-3" aria-hidden="true" />
          <span>Z-axis</span>
          <span className="text-foreground/70 [writing-mode:vertical-rl]">Procedural layers</span>
          <ArrowDown className="size-3" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
