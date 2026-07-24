import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PricingPage from '../page'

describe('PricingPage', () => {
  it('renders Free/Pro/Fleet + supporter with real prices', () => {
    render(<PricingPage />)
    expect(screen.getByTestId('plan-card-free')).toBeInTheDocument()
    expect(screen.getByTestId('plan-card-pro')).toBeInTheDocument()
    expect(screen.getByTestId('plan-card-fleet')).toBeInTheDocument()
    // Pro monthly = €9
    expect(screen.getByTestId('plan-card-pro')).toHaveTextContent('€9')
    // Supporter is framed as sustainability, not a feature unlock
    expect(screen.getByText(/every feature, no gates/i)).toBeInTheDocument()
    expect(screen.getByText(/€99/)).toBeInTheDocument()
  })

  it('yearly toggle switches Pro to 2-months-free pricing (€90/year)', () => {
    render(<PricingPage />)
    fireEvent.click(screen.getByRole('button', { name: /Yearly/i }))
    expect(screen.getByTestId('plan-card-pro')).toHaveTextContent('€90')
  })
})
