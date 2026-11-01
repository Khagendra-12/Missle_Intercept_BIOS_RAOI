'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlaybackSpeed } from '@/lib/config'
import type { TrajectoryState } from '@/lib/types'

export function usePlayback(states: TrajectoryState[] | null) {
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(5)
  const [prevStates, setPrevStates] = useState(states)
  const duration = states?.length ? states[states.length - 1].timeS : 0
  const startTime = states?.length ? states[0].timeS : 0

  if (prevStates !== states) {
    setPrevStates(states)
    setTime(startTime)
    setPlaying(Boolean(states?.length))
  }

  const timeRef = useRef(time)
  timeRef.current = time

  useEffect(() => {
    if (!playing || !states?.length) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const next = Math.min(duration, timeRef.current + ((now - last) / 1000) * speed)
      last = now
      setTime(next)
      if (next >= duration) {
        setPlaying(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, duration, states])

  const index = useMemo(() => {
    if (!states?.length) return -1
    let lo = 0
    let hi = states.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (states[mid].timeS <= time) lo = mid
      else hi = mid - 1
    }
    return lo
  }, [states, time])

  return {
    time,
    setTime,
    playing,
    toggle: () => {
      if (!playing && time >= duration) setTime(startTime)
      setPlaying((p) => !p)
    },
    reset: () => {
      setTime(startTime)
      setPlaying(false)
    },
    step: (delta: number) => {
      if (!states?.length) return
      const i = Math.max(0, Math.min(states.length - 1, index + delta))
      setPlaying(false)
      setTime(states[i].timeS)
    },
    speed,
    setSpeed,
    duration,
    startTime,
    index,
    current: index >= 0 && states ? states[index] : null,
  }
}

export type Playback = ReturnType<typeof usePlayback>
