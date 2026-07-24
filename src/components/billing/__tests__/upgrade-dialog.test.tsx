import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { UpgradeDialog, planLimitFromError } from '../upgrade-dialog'

describe('planLimitFromError', () => {
  it('extracts the PLAN_LIMIT payload the errorFormatter attaches', () => {
    expect(planLimitFromError({ data: { planLimit: { limit: 2, plan: 'free' } } })).toEqual({ limit: 2, plan: 'free' })
  })
  it('returns null for a plain error', () => {
    expect(planLimitFromError(new Error('boom'))).toBeNull()
    expect(planLimitFromError({ data: { planLimit: null } })).toBeNull()
    expect(planLimitFromError(undefined)).toBeNull()
  })
})

describe('UpgradeDialog', () => {
  it('shows the limit context and a checkout CTA when open', () => {
    render(<UpgradeDialog open onOpenChange={() => {}} info={{ limit: 2, plan: 'free' }} suggest="pro" />)
    expect(screen.getByText(/Upgrade to Pro/i)).toBeInTheDocument()
    expect(screen.getByText(/reached your plan's limit of 2/i)).toBeInTheDocument()
    // Only real capabilities are listed (derived from PLAN_LIMITS); the paid
    // value now leads with verified correctness, not the host count.
    expect(screen.getByText(/kill-switch verified \(routing \+ gluetun firewall\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Deploy to 2 of your own hosts/i)).toBeInTheDocument()
    const cta = screen.getByTestId('upgrade-cta')
    expect(cta).toHaveAttribute('href', '/pricing')
  })

  it('renders nothing when closed', () => {
    render(<UpgradeDialog open={false} onOpenChange={() => {}} info={null} />)
    expect(screen.queryByText(/Upgrade to/i)).not.toBeInTheDocument()
  })
})
