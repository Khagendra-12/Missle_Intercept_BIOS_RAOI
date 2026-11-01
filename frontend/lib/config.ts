import type { SimulationMode } from './types'

export const DEFAULT_API_URL = 'http://localhost:8000'

export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 5, 10, 25, 50, 100] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

export const POLL_INTERVAL_MS = 1000
export const HEALTH_INTERVAL_MS = 10_000
export const HOVER_DEBOUNCE_MS = 140
export const REQUEST_TIMEOUT_MS = 20_000
export const GET_RETRIES = 2

export const INTERCEPTOR_SPEED_PRESETS = [75, 95] as const

export function parseMode(value: string | undefined | null): SimulationMode {
  return value?.toLowerCase() === 'real' ? 'real' : 'mock'
}

/** Strips trailing slashes; relative values (e.g. `/api/backend`) use the built-in proxy. */
export function normalizeBaseUrl(value: string | undefined | null): string {
  const url = (value && value.trim()) || DEFAULT_API_URL
  return url.replace(/\/+$/, '')
}
