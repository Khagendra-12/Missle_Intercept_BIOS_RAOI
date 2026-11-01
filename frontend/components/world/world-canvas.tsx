
'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { formatLayer } from '@/lib/layer-math'
import {
  computeStackLayout,
  hitTestStack,
  projectToRhombus,
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
    const element = wrapRef.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect

      setDims({
        w: Math.max(0, Math.floor(width)),
        h: Math.max(0, Math.floor(height)),
      })
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  const layout = useMemo<Rhombus[]>(
    () => computeStackLayout(dims.w, dims.h, layers.length),
    [dims.w, dims.h, layers.length],
  )

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas || !dims.w || !dims.h || !layout.length) return

    const dpr = window.devicePixelRatio || 1

    canvas.width = Math.round(dims.w * dpr)
    canvas.height = Math.round(dims.h * dpr)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, dims.w, dims.h)

    const n = Math.max(1, gridSize)

    // Use exact layer matches for trajectory rendering. Never silently
    // move a projectile onto a different layer.
    const layerIndex = (layer: string) => layers.indexOf(layer)

    const project = (layer: string, xKm: number, yKm: number) => {
      const li = layerIndex(layer)

      if (li < 0 || !layout[li]) return null

      return projectToRhombus(layout[li], n, xKm, yKm)
    }

    // Draw the stack from bottom to top so the highest layer is in front.
    for (let li = layers.length - 1; li >= 0; li--) {
      const rhombus = layout[li]
      const active = layers[li] === activeLayer

      const projectOnLayer = (x: number, y: number) =>
        projectToRhombus(rhombus, n, x, y)

      const tl = projectOnLayer(0, n)
      const tr = projectOnLayer(n, n)
      const br = projectOnLayer(n, 0)
      const bl = projectOnLayer(0, 0)

      ctx.beginPath()
      ctx.moveTo(tl.x, tl.y)
      ctx.lineTo(tr.x, tr.y)
      ctx.lineTo(br.x, br.y)
      ctx.lineTo(bl.x, bl.y)
      ctx.closePath()

      ctx.fillStyle = active ? COLORS.fillActive : COLORS.fillIdle
      ctx.fill()

      // Thin the grid according to the available pixel dimensions.
      const stepU = Math.max(
        1,
        Math.ceil(n / Math.max(2, Math.floor(rhombus.width / 18))),
      )

      const stepV = Math.max(
        1,
        Math.ceil(n / Math.max(2, Math.floor(rhombus.height / 8))),
      )

      ctx.beginPath()

      for (let c = stepU; c < n; c += stepU) {
        const a = projectOnLayer(c, n)
        const b = projectOnLayer(c, 0)

        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
      }

      for (let r = stepV; r < n; r += stepV) {
        const a = projectOnLayer(0, n - r)
        const b = projectOnLayer(n, n - r)

        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
      }

      ctx.lineWidth = 1
      ctx.strokeStyle = active ? COLORS.gridActive : COLORS.gridIdle
      ctx.stroke()

      // Layer outline.
      ctx.beginPath()
      ctx.moveTo(tl.x, tl.y)
      ctx.lineTo(tr.x, tr.y)
      ctx.lineTo(br.x, br.y)
      ctx.lineTo(bl.x, bl.y)
      ctx.closePath()

      ctx.lineWidth = active ? 1.5 : 1
      ctx.strokeStyle = active ? COLORS.strokeActive : COLORS.strokeIdle
      ctx.stroke()

      // Layer label.
      ctx.font = MONO
      ctx.fillStyle = active ? COLORS.labelActive : COLORS.labelIdle
      ctx.textAlign = 'left'
      ctx.fillText(
        `L ${formatLayer(layers[li], 24)}${active ? '  · ACTIVE' : ''}`,
        bl.x,
        bl.y + 16,
      )
    }

    // Hovered cell.
    if (hoverCell) {
      const li = layerIndex(hoverCell.layer)

      if (li >= 0 && layout[li]) {
        const { x, y } = hoverCell

        const corners = [
          projectToRhombus(layout[li], n, x, y + 1),
          projectToRhombus(layout[li], n, x + 1, y + 1),
          projectToRhombus(layout[li], n, x + 1, y),
          projectToRhombus(layout[li], n, x, y),
        ]

        ctx.beginPath()
        ctx.moveTo(corners[0].x, corners[0].y)

        for (let k = 1; k < corners.length; k++) {
          ctx.lineTo(corners[k].x, corners[k].y)
        }

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
    ctx.fillText(
      `ACTIVE LAYER // ${formatLayer(activeLayer, 24)}`,
      16,
      24,
    )
    ctx.fillText(
      `GRID ${n} × ${n} km // ${layers.length} LAYERS SHOWN`,
      16,
      38,
    )

    if (!states?.length) return

    const first = states[0]
    const last = states[states.length - 1]
    const currentIndex = Math.max(0, Math.min(index, states.length - 1))
    const current = states[currentIndex]

    // Detection range is drawn only when its layer is visible.
    const detectionLayer = layerIndex(first.interceptor.layer)

    if (detectionLayer >= 0 && Number.isFinite(detectionRangeKm)) {
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = COLORS.detect
      ctx.lineWidth = 1
      ctx.beginPath()

      for (let k = 0; k <= 72; k++) {
        const angle = (k / 72) * Math.PI * 2

        const point = project(
          first.interceptor.layer,
          first.interceptor.xKm + Math.cos(angle) * detectionRangeKm,
          first.interceptor.yKm + Math.sin(angle) * detectionRangeKm,
        )

        if (!point) continue

        if (k === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      }

      ctx.stroke()
      ctx.setLineDash([])
    }

    // Draw trajectory segments only on layers that are actually displayed.
    // A hidden layer breaks the line instead of being projected onto another.
    const drawTrail = (
      key: 'missile' | 'interceptor',
      upto: number,
      color: string,
      alpha: number,
      width: number,
    ) => {
      ctx.globalAlpha = alpha
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.beginPath()

      let penDown = false

      for (let i = 0; i <= upto; i++) {
        const projectile = states[i][key]
        const point = project(
          projectile.layer,
          projectile.xKm,
          projectile.yKm,
        )

        if (!point) {
          penDown = false
          continue
        }

        if (!penDown) {
          ctx.moveTo(point.x, point.y)
          penDown = true
        } else {
          ctx.lineTo(point.x, point.y)
        }
      }

      ctx.stroke()
      ctx.globalAlpha = 1
    }

    drawTrail('missile', states.length - 1, COLORS.missile, 0.25, 1)
    drawTrail('interceptor', states.length - 1, COLORS.interceptor, 0.25, 1)

    drawTrail('missile', currentIndex, COLORS.missile, 1, 2)
    drawTrail('interceptor', currentIndex, COLORS.interceptor, 1, 2)

    // Launch points.
    ctx.strokeStyle = COLORS.labelIdle
    ctx.lineWidth = 1

    for (const projectile of [first.missile, first.interceptor]) {
      const point = project(
        projectile.layer,
        projectile.xKm,
        projectile.yKm,
      )

      if (point) {
        ctx.strokeRect(point.x - 3, point.y - 3, 6, 6)
      }
    }

    const missilePoint = project(
      current.missile.layer,
      current.missile.xKm,
      current.missile.yKm,
    )

    const interceptorPoint = project(
      current.interceptor.layer,
      current.interceptor.xKm,
      current.interceptor.yKm,
    )

    // Show the vertical/layer separation when both layers are visible.
    if (
      missilePoint &&
      interceptorPoint &&
      current.missile.layer !== current.interceptor.layer
    ) {
      ctx.setLineDash([2, 4])
      ctx.strokeStyle = COLORS.connector
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(missilePoint.x, missilePoint.y)
      ctx.lineTo(interceptorPoint.x, interceptorPoint.y)
      ctx.stroke()
      ctx.setLineDash([])
    }

    const drawProjectile = (
      point: { x: number; y: number } | null,
      color: string,
      label: string,
      labelOffsetY: number,
    ) => {
      if (!point) return

      ctx.shadowBlur = 18
      ctx.shadowColor = color
      ctx.fillStyle = color

      ctx.beginPath()
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2)
      ctx.fill()

      ctx.shadowBlur = 0
      ctx.font = MONO
      ctx.textAlign = 'left'
      ctx.fillText(label, point.x + 12, point.y + labelOffsetY)
    }

    drawProjectile(
      missilePoint,
      COLORS.missile,
      'HOSTILE MISSILE',
      -9,
    )

    drawProjectile(
      interceptorPoint,
      COLORS.interceptor,
      'DEFENSIVE INTERCEPTOR',
      16,
    )

    // Mark a destroyed missile at the end of the trajectory.
    if (
      currentIndex >= states.length - 1 &&
      last.missile.status === 'destroyed'
    ) {
      const point = project(
        last.missile.layer,
        last.missile.xKm,
        last.missile.yKm,
      )

      if (point) {
        ctx.strokeStyle = ACTIVE
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(point.x, point.y, 11, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }, [
    dims,
    layout,
    layers,
    activeLayer,
    gridSize,
    states,
    index,
    detectionRangeKm,
    hoverCell,
  ])

  const hitAt = (event: Pick<ReactPointerEvent<HTMLCanvasElement>, 'currentTarget' | 'clientX' | 'clientY'>) => {
    const rect = event.currentTarget.getBoundingClientRect()

    return hitTestStack(
      layout,
      gridSize,
      event.clientX - rect.left,
      event.clientY - rect.top,
    )
  }

  const handleMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const hit = hitAt(event)

    setOverLayer(hit !== null)

    if (!hit) {
      if (hoverCell) onHoverCell(null)
      return
    }

    const layer = layers[hit.index]

    if (
      hoverCell?.x !== hit.x ||
      hoverCell?.y !== hit.y ||
      hoverCell?.layer !== layer
    ) {
      onHoverCell({
        x: hit.x,
        y: hit.y,
        layer,
      })
    }
  }

  return (
    <div className="min-h-0 flex-1 p-4">
      <div
        ref={wrapRef}
        className="relative h-full min-h-48 w-full overflow-hidden rounded-md border border-border bg-background/60"
      >
        <canvas
          ref={canvasRef}
          style={{
            width: dims.w,
            height: dims.h,
            cursor: overLayer ? 'crosshair' : 'default',
          }}
          className="absolute inset-0 block"
          onPointerMove={handleMove}
          onPointerLeave={() => {
            setOverLayer(false)
            onHoverCell(null)
          }}
          onClick={(event) => {
            const hit = hitAt(event)

            if (hit) {
              onSelectLayer(layers[hit.index])
            }
          }}
          role="img"
          aria-label={`Stack of ${layers.length} layers, each a ${gridSize} by ${gridSize} km grid${
            states?.length
              ? ', with missile and interceptor trajectories'
              : ''
          }. Click a layer to make it active.`}
        />

        <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <ArrowUp className="size-3" aria-hidden="true" />
          <span>Z-axis</span>
          <span className="text-foreground/70 [writing-mode:vertical-rl]">
            Procedural layers
          </span>
          <ArrowDown className="size-3" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
