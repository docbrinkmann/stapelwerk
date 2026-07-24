import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { JobStatusPanel } from '../JobStatusPanel'
import * as useJobStatusModule from '@/hooks/useJobStatus'

vi.mock('@/hooks/useJobStatus')

describe('JobStatusPanel', () => {
  it('renders status and logs', () => {
    vi.spyOn(useJobStatusModule, 'useJobStatus').mockReturnValue({
      status: 'running', mode: 'apply', updatedAt: new Date(), logs: [
        { t: Date.now() - 1000, msg: 'Starting apply' },
        { t: Date.now(), msg: 'Validating manifests' },
      ],
      isRunning: true, isQueued: false, isSucceeded: false, isFailed: false,
      start: vi.fn(), stop: vi.fn(), refreshNow: vi.fn(), lastTimestamp: Date.now()
    } as any)

    render(<JobStatusPanel jobId="job-123" title="Test Job" />)
    expect(screen.getByText('Test Job')).toBeInTheDocument()
    expect(screen.getByTestId('job-status-badge')).toHaveTextContent('running')
    expect(screen.getByTestId('job-log')).toBeInTheDocument()
  })

  it('shows "View CI snippet" when succeeded and onViewCi is provided', () => {
    vi.spyOn(useJobStatusModule, 'useJobStatus').mockReturnValue({
      status: 'succeeded', mode: 'apply', updatedAt: new Date(), logs: [
        { t: Date.now(), msg: 'Apply succeeded' },
      ],
      isRunning: false, isQueued: false, isSucceeded: true, isFailed: false,
      start: vi.fn(), stop: vi.fn(), refreshNow: vi.fn(), lastTimestamp: Date.now()
    } as any)

    const onViewCi = vi.fn()
    render(<JobStatusPanel jobId="job-xyz" onViewCi={onViewCi} />)
    const btn = screen.getByTestId('job-view-ci-btn')
    expect(btn).toBeInTheDocument()
    btn.click()
    expect(onViewCi).toHaveBeenCalled()
  })
})
