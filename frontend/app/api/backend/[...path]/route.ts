import type { NextRequest } from 'next/server'

/**
 * Same-origin proxy to the ewsim FastAPI server, avoiding CORS. Point the UI's
 * API URL at `/api/backend` and set EWSIM_BACKEND_URL (default http://localhost:8000).
 */
const BACKEND = (process.env.EWSIM_BACKEND_URL || 'http://localhost:8000').replace(/\/+$/, '')

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const target = `${BACKEND}/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`
  try {
    const res = await fetch(target, {
      method: req.method,
      headers: { 'Content-Type': req.headers.get('content-type') ?? 'application/json', Accept: 'application/json' },
      body: req.method === 'GET' ? undefined : await req.text(),
      cache: 'no-store',
    })
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch {
    return Response.json({ detail: `Backend unreachable at ${BACKEND}` }, { status: 502 })
  }
}

export const GET = forward
export const POST = forward
