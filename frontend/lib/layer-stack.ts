import { offsetLayer } from './layer-math'
import type { TrajectoryState } from './types'

/**
 * Stacked, layer-by-layer rhombus view: which layers to show and where to draw them.
 * Layers are decimal strings (up to 10^100), so every comparison goes through BigInt.
 * Everything here is pure so it can be tested without a canvas.
 */

export const DEFAULT_STACK_SIZE = 4

const isLayer = (v: unknown): v is string => typeof v === 'string' && /^\d+$/.test(v)
const cmpDesc = (a: string, b: string) => {
  const d = BigInt(b) - BigInt(a)
  return d > BigInt(0) ? 1 : d < BigInt(0) ? -1 : 0
}
const absDiff = (a: string, b: string) => {
  const d = BigInt(a) - BigInt(b)
  return d < BigInt(0) ? -d : d
}

/**
 * Layers to draw, highest index first (top of the stack).
 * Always contains the active layer and the layers the missile / interceptor occupy in the
 * current frame. Remaining slots are filled with other layers the trajectory visits (nearest
 * to the active layer first), then with adjacent layers (below first, then above).
 */
export function buildLayerStack(opts: {
  active: string
  states: TrajectoryState[] | null
  index: number
  size?: number
}): string[] {
  const { states, index } = opts
  const active = isLayer(opts.active) ? opts.active : '0'
  const picked = new Set<string>([active])

  const cur = states?.length && index >= 0 ? states[Math.min(index, states.length - 1)] : null
  if (cur) {
    if (isLayer(cur.missile.layer)) picked.add(cur.missile.layer)
    if (isLayer(cur.interceptor.layer)) picked.add(cur.interceptor.layer)
  }

  const target = Math.max(opts.size ?? DEFAULT_STACK_SIZE, picked.size)

  if (states?.length && picked.size < target) {
    const visited = new Set<string>()
    for (const s of states) {
      if (isLayer(s.missile.layer)) visited.add(s.missile.layer)
      if (isLayer(s.interceptor.layer)) visited.add(s.interceptor.layer)
    }
    const nearest = [...visited]
      .filter((l) => !picked.has(l))
      .sort((a, b) => {
        const d = absDiff(a, active) - absDiff(b, active)
        return d > BigInt(0) ? 1 : d < BigInt(0) ? -1 : 0
      })
    for (const l of nearest) {
      if (picked.size >= target) break
      picked.add(l)
    }
  }

  let ordered = [...picked].sort(cmpDesc)
  while (ordered.length < target) {
    const below = offsetLayer(ordered[ordered.length - 1], -1)
    const above = below === null ? offsetLayer(ordered[0], 1) : null
    if (below !== null) ordered = [...ordered, below]
    else if (above !== null) ordered = [above, ...ordered]
    else break
  }
  return ordered
}

/** Index in `stack` (sorted high → low) of `layer`, or of the nearest layer if it is not shown. */
export function stackIndexOf(stack: string[], layer: string): number {
  if (!stack.length) return -1
  const exact = stack.indexOf(layer)
  if (exact >= 0 || !isLayer(layer)) return Math.max(0, exact)
  let best = 0
  let bestD = absDiff(stack[0], layer)
  for (let i = 1; i < stack.length; i++) {
    const d = absDiff(stack[i], layer)
    if (d < bestD) {
      best = i
      bestD = d
    }
  }
  return best
}

/** One skewed rhombus (parallelogram): flat top edge, bottom edge shifted left by `shear`. */
export interface Rhombus {
  cx: number
  top: number
  width: number
  height: number
  shear: number
}

export const STACK_PAD_TOP = 44
export const STACK_PAD_BOTTOM = 30

export function computeStackLayout(w: number, h: number, count: number): Rhombus[] {
  if (count <= 0 || w <= 0 || h <= 0) return []
  const avail = Math.max(1, h - STACK_PAD_TOP - STACK_PAD_BOTTOM)
  const slot = avail / count
  const baseWidth = Math.min(w * 0.74, 760)
  return Array.from({ length: count }, (_, i) => {
    const scale = Math.pow(0.9, i)
    const width = baseWidth * scale
    const shear = Math.min(80, width * 0.11)
    const height = Math.max(24, Math.min(slot - 26, 110 * scale))
    // Lower layers drift right (OG staircase look); keep the whole shape on screen.
    const cx = Math.min(w * 0.5 + shear / 2 + i * 16, w - 12 - width / 2)
    return { cx, top: STACK_PAD_TOP + i * slot, width, height, shear }
  })
}

/** km coordinates on a layer → canvas pixels. y grows upward in km, downward on screen. */
export function projectToRhombus(r: Rhombus, gridSize: number, xKm: number, yKm: number) {
  const n = Math.max(1, gridSize)
  const u = xKm / n
  const t = 1 - yKm / n
  return { x: r.cx - r.width / 2 + u * r.width - r.shear * t, y: r.top + t * r.height }
}

export interface RhombusHit {
  /** Index into the layout / stack. */
  index: number
  x: number
  y: number
}

/** Canvas pixel → layer index and integer grid cell, or null when outside every rhombus. */
export function hitTestStack(layout: Rhombus[], gridSize: number, px: number, py: number): RhombusHit | null {
  const n = Math.max(1, gridSize)
  for (let i = 0; i < layout.length; i++) {
    const r = layout[i]
    const t = (py - r.top) / r.height
    if (t < 0 || t > 1) continue
    const u = (px - r.cx + r.width / 2 + r.shear * t) / r.width
    if (u < 0 || u > 1) continue
    return {
      index: i,
      x: Math.min(n - 1, Math.floor(u * n)),
      y: Math.min(n - 1, Math.max(0, Math.floor((1 - t) * n))),
    }
  }
  return null
}
