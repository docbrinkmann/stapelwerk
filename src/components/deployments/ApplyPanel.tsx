import React, { useState } from 'react'
import { api } from '@/trpc/client'
import { JobStatusPanel } from './JobStatusPanel'
import { useT } from '@/lib/i18n/client'
import './ApplyPanel.css'

interface ApplyPanelProps {
  stackId?: string
  targetId?: string
  artifactId?: string
  title?: string
  className?: string
  onViewCi?: () => void
}

export const ApplyPanel: React.FC<ApplyPanelProps> = ({
  stackId,
  targetId,
  artifactId,
  title,
  className = '',
  onViewCi,
}) => {
  const t = useT()
  const [jobId, setJobId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createAndStart = async () => {
    try {
      setCreating(true)
      setError(null)
      // Create apply job
      const job = await (api as any).deployments.createJob.mutate({
        mode: 'apply',
        stackId,
        targetId,
        artifactId,
      })
      setJobId(job.id)
      // Start apply (orchestrated async; logs will show up in panel)
      await (api as any).deployments.startApply.mutate({ id: job.id })
    } catch (e: any) {
      setError(e?.message || t('ops.applyJobFailed'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={`apply-panel ${className}`} data-testid="apply-panel">
      <div className="apply-panel__header">
        <h3 className="apply-panel__title">{title ?? t('ops.directApply')}</h3>
        <div className="apply-panel__actions">
          <button
            type="button"
            className="apply-btn"
            onClick={createAndStart}
            disabled={creating}
          >
            {creating ? t('ops.starting') : t('ops.createStartApply')}
          </button>
        </div>
      </div>
      {error && <div className="apply-panel__error">{error}</div>}
      {jobId && (
        <div className="apply-panel__status">
          <JobStatusPanel jobId={jobId} title={t('ops.applyJob')} autoStart stopOnSuccess onViewCi={onViewCi} />
        </div>
      )}
    </div>
  )
}
