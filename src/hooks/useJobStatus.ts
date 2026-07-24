import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { api } from '@/trpc/client'

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export interface JobLogEntry {
  t: number
  msg: string
}

export interface UseJobStatusOptions {
  intervalMs?: number
  enabled?: boolean
  stopOnSuccess?: boolean
  stopOnFailure?: boolean
}

export interface UseJobStatusResult {
  status: JobStatus | null
  mode: string | null
  updatedAt: Date | null
  logs: JobLogEntry[]
  isRunning: boolean
  isQueued: boolean
  isSucceeded: boolean
  isFailed: boolean
  start: () => void
  stop: () => void
  refreshNow: () => Promise<void>
  lastTimestamp: number
}

/**
 * useJobStatus
 * Polls job status and tails logs using deployments.getJobStatus + getJobLogTail.
 * Intended for lightweight UI polling of apply/provision/destroy jobs.
 */
export function useJobStatus(jobId: string | null | undefined, opts: UseJobStatusOptions = {}): UseJobStatusResult {
  const intervalMs = opts.intervalMs ?? 1500
  const [enabled, setEnabled] = useState(Boolean(opts.enabled ?? Boolean(jobId)))

  const [status, setStatus] = useState<JobStatus | null>(null)
  const [mode, setMode] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [logs, setLogs] = useState<JobLogEntry[]>([])
  const lastTsRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const busyRef = useRef<boolean>(false)

  const isQueued = status === 'queued'
  const isRunning = status === 'running'
  const isSucceeded = status === 'succeeded'
  const isFailed = status === 'failed'

  const fetchOnce = useCallback(async () => {
    if (!jobId || busyRef.current) return
    busyRef.current = true
    try {
      // 1) Status
      const s = await api.deployments.getJobStatus.query({ id: jobId })
      setStatus(s.status as JobStatus)
      setMode(s.mode)
      setUpdatedAt(new Date(s.updatedAt as any))

      // 2) Log tail since lastTs
      const tail = await api.deployments.getJobLogTail.query({ id: jobId, since: lastTsRef.current })
      if (tail?.entries?.length) {
        setLogs(prev => [...prev, ...tail.entries])
        lastTsRef.current = tail.lastTimestamp || lastTsRef.current
      }

      // Auto-stop policies
      if (opts.stopOnSuccess && s.status === 'succeeded') {
        stop()
      } else if (opts.stopOnFailure && s.status === 'failed') {
        stop()
      }
    } catch (err) {
      // Non-fatal: keep polling; optionally could expose error state
    } finally {
      busyRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, opts.stopOnFailure, opts.stopOnSuccess])

  const start = useCallback(() => {
    if (timerRef.current) return
    setEnabled(true)
    timerRef.current = setInterval(fetchOnce, intervalMs)
  }, [fetchOnce, intervalMs])

  const stop = useCallback(() => {
    setEnabled(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const refreshNow = useCallback(async () => {
    await fetchOnce()
  }, [fetchOnce])

  // Manage lifecycle
  useEffect(() => {
    if (!jobId) return
    if (enabled) {
      // Kick an immediate fetch
      fetchOnce()
      // And ensure timer is running
      if (!timerRef.current) {
        timerRef.current = setInterval(fetchOnce, intervalMs)
      }
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }
    }
  }, [jobId, enabled, fetchOnce, intervalMs])

  // Auto-start if jobId exists and enabled was true/unspecified
  useEffect(() => {
    if (jobId && (opts.enabled ?? true)) {
      start()
    }
    return () => stop()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  return useMemo(() => ({
    status,
    mode,
    updatedAt,
    logs,
    isRunning,
    isQueued,
    isSucceeded,
    isFailed,
    start,
    stop,
    refreshNow,
    lastTimestamp: lastTsRef.current,
  }), [status, mode, updatedAt, logs, isRunning, isQueued, isSucceeded, isFailed, start, stop, refreshNow])
}
