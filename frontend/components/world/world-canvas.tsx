'use client'

import { useEffect, useRef, useState } from 'react'
import type { TrajectoryState } from '@/lib/types'

interface WorldCanvasProps {
  gridSize: number
  states: TrajectoryState[] | null
  index: number
  detectionRangeKm: number
  hoverCell: { x: number; y: number } | null
  onHoverCell: (cell: { x: number; y: number } | null) => void
}

const COLORS = {
  grid: 'rgba(255,255,255,0.05)',
  gridMajor: 'rgba(255,255,255,0.1)',
  missile: 'oklch(0.7 0.19 35)',
  interceptor: 'oklch(0.8 0.13 205)',
  hover: 'rgba(120,200,230,0.25)',
  label: 'rgba(200,210,225,0.55)',
}

export function WorldCanvas({ gridSize, states, index, detectionRangeKm, hoverCell, onHoverCell }: WorldCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize(Math.max(0, Math.floor(Math.min(width, height))))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)

    const n = Math.max(1, gridSize)
    const s = size / n
    const px = (km: number) => km * s
    const py = (km: number) => size - km * s

    const minorEvery = n > 200 ? 10 : n > 60 ? 5 : 1
    const majorEvery = minorEvery * (n > 60 ? 2 : 10)
    for (let i = 0; i <= n; i += minorEvery) {
      ctx.strokeStyle = i % majorEvery === 0 ? COLORS.gridMajor : COLORS.grid
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(Math.round(i * s) + 0.5, 0)
      ctx.lineTo(Math.round(i * s) + 0.5, size)
      ctx.moveTo(0, Math.round(size - i * s) + 0.5)
      ctx.lineTo(size, Math.round(size - i * s) + 0.5)
      ctx.stroke()
    }

    if (hoverCell) {
      ctx.fillStyle = COLORS.hover
      ctx.fillRect(hoverCell.x * s, size - (hoverCell.y + 1) * s, Math.max(s, 2), Math.max(s, 2))
    }

    if (!states?.length) return
    const first = states[0]
    const last = states[states.length - 1]
    const cur = states[Math.max(0, Math.min(index, states.length - 1))]

    ctx.setLineDash([4, 4])
    ctx.strokeStyle = 'rgba(120,200,230,0.35)'
    ctx.beginPath()
    ctx.arc(px(first.interceptor.xKm), py(first.interceptor.yKm), detectionRangeKm * s, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    const path = (key: 'missile' | 'interceptor', upto: number, color: string, alpha: number, width: number) => {
      ctx.globalAlpha = alpha
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.beginPath()
      for (let i = 0; i <= upto; i++) {
        const p = states[i][key]
        if (i === 0) ctx.moveTo(px(p.xKm), py(p.yKm))
        else ctx.lineTo(px(p.xKm), py(p.yKm))
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    path('missile', states.length - 1, COLORS.missile, 0.2, 1)
    path('interceptor', states.length - 1, COLORS.interceptor, 0.2, 1)
    path('missile', index, COLORS.missile, 1, 2)
    path('interceptor', index, COLORS.interceptor, 1, 2)

    const marker = (xKm: number, yKm: number, color: string, label: string, square = false) => {
      ctx.fillStyle = color
      ctx.beginPath()
      if (square) ctx.rect(px(xKm) - 4, py(yKm) - 4, 8, 8)
      else ctx.arc(px(xKm), py(yKm), 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = COLORS.label
      ctx.font = '10px var(--font-geist-mono), monospace'
      ctx.fillText(label, px(xKm) + 7, py(yKm) - 7)
    }
    ctx.strokeStyle = COLORS.label
    ctx.strokeRect(px(first.missile.xKm) - 3, py(first.missile.yKm) - 3, 6, 6)
    ctx.strokeRect(px(first.interceptor.xKm) - 3, py(first.interceptor.yKm) - 3, 6, 6)
    marker(cur.missile.xKm, cur.missile.yKm, COLORS.missile, 'M')
    marker(cur.interceptor.xKm, cur.interceptor.yKm, COLORS.interceptor, 'I')

    if (index >= states.length - 1 && last.missile.status === 'destroyed') {
      ctx.strokeStyle = 'oklch(0.76 0.16 155)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(px(last.missile.xKm), py(last.missile.yKm), 10, 0, Math.PI * 2)
      ctx.stroke()
    }
  }, [size, gridSize, states, index, detectionRangeKm, hoverCell])

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const n = Math.max(1, gridSize)
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * n)
    const y = Math.floor(((rect.bottom - e.clientY) / rect.height) * n)
    if (x < 0 || y < 0 || x >= n || y >= n) return onHoverCell(null)
    if (hoverCell?.x !== x || hoverCell?.y !== y) onHoverCell({ x, y })
  }

  return (
    <div ref={wrapRef} className="flex min-h-0 flex-1 items-center justify-center p-4">
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="rounded-md border border-border bg-background/60"
        onPointerMove={handleMove}
        onPointerLeave={() => onHoverCell(null)}
        role="img"
        aria-label={`World grid ${gridSize} by ${gridSize} km${states?.length ? ' with missile and interceptor trajectories' : ''}`}
      />
    </div>
  )
}
