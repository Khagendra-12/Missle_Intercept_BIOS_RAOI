import type { RawErrorBody } from './backend-contract'
import { GET_RETRIES, REQUEST_TIMEOUT_MS } from './config'

export type HttpMethod = 'GET' | 'POST'

export interface RequestOptions {
  query?: Record<string, string | number>
  body?: unknown
  signal?: AbortSignal
  /** Overrides the default retry count. Only applied to GET. */
  retries?: number
}

/** The request never produced a usable HTTP response (network, CORS, timeout, abort, bad JSON). */
export class TransportError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'timeout' | 'aborted' | 'parse',
  ) {
    super(message)
    this.name = 'TransportError'
  }
}

/** The backend answered with a non-2xx status (FastAPI `detail` is extracted). */
export class BackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail: string,
  ) {
    super(message)
    this.name = 'BackendError'
  }
}

/** The backend accepted the job but the simulation itself failed or is unusable. */
export class SimulationError extends Error {
  constructor(
    message: string,
    readonly simulationId: string,
  ) {
    super(message)
    this.name = 'SimulationError'
  }
}

export function isAbort(err: unknown) {
  return err instanceof TransportError && err.kind === 'aborted'
}

export function describeError(err: unknown): string {
  if (err instanceof BackendError) return `HTTP ${err.status}: ${err.detail}`
  if (err instanceof TransportError) return err.message
  if (err instanceof SimulationError) return err.message
  if (err instanceof Error) return err.message
  return String(err)
}

export interface Transport {
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T>
}

function detailOf(body: RawErrorBody | null, fallback: string): string {
  if (!body?.detail) return fallback
  if (typeof body.detail === 'string') return body.detail
  return body.detail.map((d) => `${(d.loc ?? []).join('.')}: ${d.msg ?? d.type ?? 'invalid'}`).join('; ')
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new TransportError('Request aborted', 'aborted'))
    }, { once: true })
  })

export class HttpTransport implements Transport {
  constructor(readonly baseUrl: string) {}

  private url(path: string, query?: RequestOptions['query']) {
    const qs = query ? '?' + new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString() : ''
    return `${this.baseUrl}${path}${qs}`
  }

  async request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
    const retries = method === 'GET' ? (options.retries ?? GET_RETRIES) : 0
    let attempt = 0
    for (;;) {
      try {
        return await this.once<T>(method, path, options)
      } catch (err) {
        const retryable =
          (err instanceof TransportError && (err.kind === 'network' || err.kind === 'timeout')) ||
          (err instanceof BackendError && (err.status === 502 || err.status === 503 || err.status === 504))
        if (!retryable || attempt >= retries) throw err
        attempt += 1
        await sleep(250 * 2 ** attempt, options.signal)
      }
    }
  }

  private async once<T>(method: HttpMethod, path: string, options: RequestOptions): Promise<T> {
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    options.signal?.addEventListener('abort', onAbort, { once: true })
    if (options.signal?.aborted) controller.abort()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, REQUEST_TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(this.url(path, options.query), {
        method,
        headers: options.body !== undefined ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
        cache: 'no-store',
      })
    } catch {
      if (timedOut) throw new TransportError(`Request to ${path} timed out`, 'timeout')
      if (options.signal?.aborted) throw new TransportError('Request aborted', 'aborted')
      throw new TransportError(`Cannot reach backend at ${this.baseUrl} (network/CORS)`, 'network')
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
    }

    const text = await res.text()
    let body: unknown = null
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        if (res.ok) throw new TransportError(`Invalid JSON from ${path}`, 'parse')
      }
    }
    if (!res.ok) {
      throw new BackendError(`${method} ${path} failed`, res.status, detailOf(body as RawErrorBody, res.statusText || 'Error'))
    }
    return body as T
  }
}
