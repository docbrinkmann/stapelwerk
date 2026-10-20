import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PricingPage from '../page'
import { I18nProvider } from '@/lib/i18n/client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

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

  it('speaks German when the app language is German', () => {
    render(
      <I18nProvider initialLocale="de">
        <PricingPage />
      </I18nProvider>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Einfache, ehrliche Preise')
    expect(screen.getByRole('link', { name: /kostenloses konto anlegen/i })).toHaveAttribute('href', '/auth/signup')
    expect(screen.getByText('Kuratierter Katalog & geführter Builder')).toBeInTheDocument()
    expect(screen.getByText(/jedes Feature, ohne Gates/)).toBeInTheDocument()
  })
})
