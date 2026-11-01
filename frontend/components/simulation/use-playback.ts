
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PlaybackSpeed } from '@/lib/config'
import type { TrajectoryState } from '@/lib/types'

export function usePlayback(states: TrajectoryState[] | null) {
  const [time, setTimeState] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(5)

  const timeRef = useRef(time)
  timeRef.current = time

  const startTime = states?.length ? states[0].timeS : 0
  const duration = states?.length
    ? states[states.length - 1].timeS
    : 0

  // Reset playback whenever a new trajectory is loaded.
  useEffect(() => {
    if (states?.length) {
      setTimeState(states[0].timeS)
      setPlaying(true)
    } else {
      setTimeState(0)
      setPlaying(false)
    }
  }, [states])

  const setTime = useCallback(
    (nextTime: number) => {
      const clamped = Math.max(
        startTime,
        Math.min(duration, Number.isFinite(nextTime) ? nextTime : startTime),
      )

      setTimeState(clamped)
    },
    [startTime, duration],
  )

  // Advance the simulation clock using animation frames.
  useEffect(() => {
    if (!playing || !states?.length || duration <= startTime) {
      if (playing && duration <= startTime) setPlaying(false)
      return
    }

    let animationFrame = 0
    let lastFrameTime = performance.now()

    const tick = (now: number) => {
      const elapsedSeconds = (now - lastFrameTime) / 1000
      lastFrameTime = now

      const nextTime = Math.min(
        duration,
        timeRef.current + elapsedSeconds * speed,
      )

      timeRef.current = nextTime
      setTimeState(nextTime)

      if (nextTime >= duration) {
        setPlaying(false)
        return
      }

      animationFrame = requestAnimationFrame(tick)
    }

    animationFrame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(animationFrame)
  }, [playing, speed, duration, startTime, states])

  // Find the latest trajectory sample at or before the current time.
  const index = useMemo(() => {
    if (!states?.length) return -1

    let low = 0
    let high = states.length - 1

    while (low < high) {
      const middle = Math.ceil((low + high) / 2)

      if (states[middle].timeS <= time) {
        low = middle
      } else {
        high = middle - 1
      }
    }

    return low
  }, [states, time])

  const toggle = useCallback(() => {
    if (!states?.length) return

    if (!playing && time >= duration) {
      setTime(startTime)
      setPlaying(true)
      return
    }

    setPlaying((current) => !current)
  }, [states, playing, time, duration, startTime, setTime])

  const reset = useCallback(() => {
    setTime(startTime)
    setPlaying(false)
  }, [setTime, startTime])

  const step = useCallback(
    (delta: number) => {
      if (!states?.length || index < 0) return

      const nextIndex = Math.max(
        0,
        Math.min(states.length - 1, index + delta),
      )

      setPlaying(false)
      setTime(states[nextIndex].timeS)
    },
    [states, index, setTime],
  )

  return {
    time,
    setTime,
    playing,
    toggle,
    reset,
    step,
    speed,
    setSpeed,
    duration,
    startTime,
    index,
    current: index >= 0 && states ? states[index] : null,
  }
}

export type Playback = ReturnType<typeof usePlayback>
