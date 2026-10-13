import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PricingPage from '../page'

describe('PricingPage', () => {
  it('offers free + one-time verified deploy + supporter, no monthly deploy plans (Gate G)', () => {
    render(<PricingPage />)
    expect(screen.getByTestId('plan-card-free')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create a free account/i })).toHaveAttribute('href', '/auth/signup')
    expect(screen.queryByTestId('plan-card-pro')).toBeNull()
    expect(screen.queryByTestId('plan-card-fleet')).toBeNull()
    expect(screen.queryByRole('button', { name: /yearly/i })).toBeNull()
    expect(screen.getByTestId('verified-deploy-card')).toHaveTextContent('€29')
    // Supporter is framed as sustainability, not a feature unlock
    expect(screen.getByText(/every feature, no gates/i)).toBeInTheDocument()
    expect(screen.getByText(/€99/)).toBeInTheDocument()
  })
})
