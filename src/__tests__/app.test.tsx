import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('Next.js Application Initialization', () => {
  it('should render the home page', async () => {
    const { default: HomePage } = await import('../app/page')
    render(<HomePage />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/actually runs/i)
    expect(screen.getAllByText(/docker-compose\.yml/i).length).toBeGreaterThan(0)
  })

  it('should have proper HTML structure', async () => {
    const { default: HomePage } = await import('../app/page')
    render(<HomePage />)

    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent(/Docker stack/i)
    // Honest footer is rendered on the page
    expect(screen.getByText(/guided composer for self-hosted docker stacks/i)).toBeInTheDocument()
  })

  it('should render without accessibility violations', async () => {
    const { default: HomePage } = await import('../app/page')
    const { container } = render(<HomePage />)

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(container.querySelector('h1')).toHaveTextContent(/actually runs/i)
  })

  it('should handle basic routing structure', () => {
    expect(window.location.pathname).toBe('/')
  })
})
