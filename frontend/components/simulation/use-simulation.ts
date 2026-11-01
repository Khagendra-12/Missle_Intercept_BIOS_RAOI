'use client'

import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import { SimulationApi } from '@/lib/api'
import type { RawJob } from '@/lib/backend-contract'
import { HEALTH_INTERVAL_MS, normalizeBaseUrl, parseMode, POLL_INTERVAL_MS } from '@/lib/config'
import { validateAll } from '@/lib/config-schema'
import { describeError } from '@/lib/transport'
import type { ConfigValues, SimulationMode, SimulationSnapshot } from '@/lib/types'

const TERMINAL = new Set(['completed', 'failed'])

export function useSimulation() {
  const [mode, setMode] = useState<SimulationMode>(() => parseMode(process.env.NEXT_PUBLIC_SIMULATION_MODE))
  const [baseUrl, setBaseUrl] = useState(() => normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL))
  const api = useMemo(() => new SimulationApi(mode, baseUrl), [mode, baseUrl])

  const health = useSWR(['health', api], () => api.health(), {
    refreshInterval: HEALTH_INTERVAL_MS,
    shouldRetryOnError: false,
  })
  const config = useSWR(['config', api], () => api.loadConfig(), { revalidateOnFocus: false })

  const [edits, setEdits] = useState<ConfigValues>({})
  const values = useMemo<ConfigValues>(() => ({ ...(config.data?.defaults ?? {}), ...edits }), [config.data, edits])
  const errors = useMemo(() => validateAll(values, config.data?.supported ?? []), [values, config.data])

  const [jobId, setJobId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<ConfigValues | null>(null)
  const [stopped, setStopped] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [stopNote, setStopNote] = useState<string | null>(null)

  const ctx = useMemo(
    () => ({
      interceptionRadiusM: submitted?.interceptionRadiusM !== undefined ? Number(submitted.interceptionRadiusM) : null,
      timeLimitS: submitted?.simulationTimeLimitS !== undefined ? Number(submitted.simulationTimeLimitS) : null,
    }),
    [submitted],
  )

  const job = useSWR<{ raw: RawJob; snapshot: SimulationSnapshot }>(
    jobId && !stopped ? ['job', api, jobId] : null,
    () => api.getSimulation(jobId!, ctx),
    {
      refreshInterval: (latest) => (latest && TERMINAL.has(latest.snapshot.status) ? 0 : POLL_INTERVAL_MS),
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  )

  const [selectedRun, setSelectedRun] = useState<number | null>(null)
  const snapshot = job.data?.snapshot ?? null
  const status = stopped ? 'stopped' : snapshot?.status ?? (jobId ? 'queued' : null)
  const effectiveRun = selectedRun ?? snapshot?.engagements.find((e) => e.hasTrajectory && e.outcome === 'INTERCEPTION_SUCCESS')?.run ?? snapshot?.engagements.find((e) => e.hasTrajectory)?.run ?? null

  const trajectory = useSWR(
    jobId && status === 'completed' && effectiveRun !== null ? ['traj', api, jobId, effectiveRun] : null,
    () => api.getTrajectory(jobId!, effectiveRun!, job.data?.raw ?? null),
    { revalidateOnFocus: false },
  )

  const setValue = useCallback((id: string, value: number | string) => setEdits((e) => ({ ...e, [id]: value })), [])
  const resetValues = useCallback(() => setEdits({}), [])

  const start = useCallback(async () => {
    if (!config.data || Object.keys(errors).length) return
    setStarting(true)
    setStartError(null)
    setStopNote(null)
    try {
      const request = api.buildRequest(values, config.data)
      if (request.config) await api.validateConfig(request)
      const id = await api.startSimulation(request)
      setSubmitted(values)
      setSelectedRun(null)
      setStopped(false)
      setJobId(id)
    } catch (err) {
      setStartError(describeError(err))
    } finally {
      setStarting(false)
    }
  }, [api, config.data, errors, values])

  const stop = useCallback(async () => {
    if (!jobId) return
    setStopped(true)
    try {
      const supported = await api.stopSimulation(jobId)
      setStopNote(supported ? 'Backend stopped the job.' : 'Backend has no stop route; polling halted locally, the job may keep running server-side.')
    } catch (err) {
      setStopNote(describeError(err))
    }
  }, [api, jobId])

  const changeConnection = useCallback((nextMode: SimulationMode, nextUrl: string) => {
    setMode(nextMode)
    setBaseUrl(normalizeBaseUrl(nextUrl))
    setJobId(null)
    setSubmitted(null)
    setEdits({})
    setSelectedRun(null)
  }, [])

  return {
    api,
    mode,
    baseUrl,
    changeConnection,
    health,
    config,
    values,
    errors,
    setValue,
    resetValues,
    start,
    stop,
    starting,
    startError,
    stopNote,
    jobId,
    status,
    snapshot,
    jobError: job.error ? describeError(job.error) : null,
    selectedRun: effectiveRun,
    setSelectedRun,
    trajectory: trajectory.data ?? null,
    trajectoryLoading: trajectory.isLoading,
    trajectoryError: trajectory.error ? describeError(trajectory.error) : null,
    gridSize: Number(submitted?.gridSize ?? values.gridSize ?? 100),
    interceptionRadiusM: Number(submitted?.interceptionRadiusM ?? values.interceptionRadiusM ?? 3),
    detectionRangeKm: Number(submitted?.detectionRangeKm ?? values.detectionRangeKm ?? 12),
  }
}

export type SimulationController = ReturnType<typeof useSimulation>
