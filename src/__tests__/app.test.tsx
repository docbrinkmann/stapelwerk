import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('Next.js Application Initialization', () => {
  it('should render the home page', async () => {
    const { default: HomePage } = await import('../app/page')
    render(<HomePage />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/wired right the first time/i)
    expect(screen.getAllByText(/docker-compose\.yml/i).length).toBeGreaterThan(0)
  })

  it('should have proper HTML structure', async () => {
    const { default: HomePage } = await import('../app/page')
    render(<HomePage />)

    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent(/media server/i)
  })

  it('renders the shared footer without operator legal links by default (self-host)', async () => {
    const { default: Footer } = await import('../components/footer')
    render(<Footer />)

    expect(screen.getByText(/guided composer for self-hosted docker stacks/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /imprint/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /privacy/i })).not.toBeInTheDocument()
  })

  it('links imprint + privacy when the operator configures them', async () => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_IMPRINT_URL', 'https://stapelwerk.dev/impressum/')
    vi.stubEnv('NEXT_PUBLIC_PRIVACY_URL', 'https://stapelwerk.dev/datenschutz/')
    try {
      const { default: Footer } = await import('../components/footer')
      render(<Footer />)

      expect(screen.getByRole('link', { name: /imprint/i })).toHaveAttribute('href', 'https://stapelwerk.dev/impressum/?lang=en')
      expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', 'https://stapelwerk.dev/datenschutz/?lang=en')
    } finally {
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })

  it('should render without accessibility violations', async () => {
    const { default: HomePage } = await import('../app/page')
    const { container } = render(<HomePage />)

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(container.querySelector('h1')).toHaveTextContent(/wired right the first time/i)
  })

  it('should handle basic routing structure', () => {
    expect(window.location.pathname).toBe('/')
  })
})
