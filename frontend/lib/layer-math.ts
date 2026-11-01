import { LAYER_MAX, LAYER_MIN } from './backend-contract'

/**
 * Arbitrary-precision layer arithmetic. Layers are transported as decimal strings
 * and manipulated with BigInt so 10^100 never touches a JS number.
 */

const MIN = BigInt(LAYER_MIN)
const MAX = BigInt(LAYER_MAX)

export type LayerParseResult = { ok: true; layer: string } | { ok: false; error: string }

export function parseLayer(input: string): LayerParseResult {
  const trimmed = input.trim().replace(/[_,\s]/g, '')
  if (!trimmed) return { ok: false, error: 'Enter a layer index' }
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: 'Layer must be a non-negative integer' }
  const value = BigInt(trimmed)
  if (value < MIN || value > MAX) return { ok: false, error: 'Layer outside [0, 10^100]' }
  return { ok: true, layer: value.toString() }
}

export function offsetLayer(layer: string, delta: number): string | null {
  const next = BigInt(layer) + BigInt(Math.trunc(delta))
  if (next < MIN || next > MAX) return null
  return next.toString()
}

export function clampOffsetLayer(layer: string, delta: number): string {
  const next = BigInt(layer) + BigInt(Math.trunc(delta))
  if (next < MIN) return MIN.toString()
  if (next > MAX) return MAX.toString()
  return next.toString()
}

export function layerDiff(a: string, b: string): bigint {
  return BigInt(a) - BigInt(b)
}

export function isMinLayer(layer: string) {
  return BigInt(layer) <= MIN
}

export function isMaxLayer(layer: string) {
  return BigInt(layer) >= MAX
}

/** Compact display: long indices become `123456…7890 (10^99)`. */
export function formatLayer(layer: string, maxLength = 14): string {
  if (layer.length <= maxLength) return layer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${layer.slice(0, 6)}…${layer.slice(-4)} (~10^${layer.length - 1})`
}
