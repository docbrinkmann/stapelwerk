import React, { useMemo } from 'react'
import { useJobStatus } from '@/hooks/useJobStatus'
import { useT } from '@/lib/i18n/client'
import './JobStatusPanel.css'

export interface JobStatusPanelProps {
  jobId: string
  title?: string
  autoStart?: boolean
  pollIntervalMs?: number
  stopOnSuccess?: boolean
  stopOnFailure?: boolean
  className?: string
  onViewCi?: () => void
}

export const JobStatusPanel: React.FC<JobStatusPanelProps> = ({
  jobId,
  title,
  autoStart = true,
  pollIntervalMs = 1500,
  stopOnSuccess = false,
  stopOnFailure = false,
  className = '',
  onViewCi,
}) => {
  const t = useT()
  const {
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
  } = useJobStatus(jobId, {
    intervalMs: pollIntervalMs,
    enabled: autoStart,
    stopOnSuccess,
    stopOnFailure,
  })

  const statusLabel = useMemo(() => status ?? 'unknown', [status])
  const badgeClass = useMemo(() => {
    if (isSucceeded) return 'job-status-badge job-status-badge--succeeded'
    if (isFailed) return 'job-status-badge job-status-badge--failed'
    if (isRunning) return 'job-status-badge job-status-badge--running'
    if (isQueued) return 'job-status-badge job-status-badge--queued'
    return 'job-status-badge'
  }, [isQueued, isRunning, isSucceeded, isFailed])

  const lastUpdated = updatedAt ? new Date(updatedAt).toLocaleTimeString() : '—'

  return (
    <div className={`job-status-panel ${className}`} data-testid="job-status-panel">
      <div className="job-status-panel__header">
        <h3 className="job-status-panel__title">{title ?? t('ops.deploymentJob')}</h3>
        <div className="job-status-panel__meta">
          <span className={badgeClass} data-testid="job-status-badge">{statusLabel}</span>
          {mode && <span className="job-status-mode" aria-label="job-mode">{mode}</span>}
          <span className="job-status-updated" aria-label="last-updated">{t('ops.updatedAt', { time: lastUpdated })}</span>
        </div>
      </div>

      <div className="job-status-panel__controls">
        <button type="button" className="job-status-btn" onClick={start} disabled={isRunning}>
          {t('ops.start')}
        </button>
        <button type="button" className="job-status-btn" onClick={stop}>
          {t('ops.stop')}
        </button>
        <button type="button" className="job-status-btn" onClick={refreshNow}>
          {t('ops.refresh')}
        </button>
        {onViewCi && isSucceeded && (
          <button type="button" className="job-status-btn" onClick={onViewCi} data-testid="job-view-ci-btn">
            {t('ops.viewCiSnippet')}
          </button>
        )}
      </div>

      <div className="job-status-panel__progress" aria-hidden={!isRunning}>
        {isRunning && <div className="job-progress-bar" />}
      </div>

      <div className="job-status-panel__logs" role="log" aria-live="polite" data-testid="job-log">
        {logs.length === 0 && <div className="job-log-empty">{t('ops.noLogsYet')}</div>}
        {logs.map((entry, idx) => (
          <div key={`${entry.t}-${idx}`} className="job-log-entry">
            <span className="job-log-time">{new Date(entry.t).toLocaleTimeString()}:</span>
            <span className="job-log-msg">{entry.msg}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
