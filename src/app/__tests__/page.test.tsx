import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import HomePage from '../page'

describe('HomePage', () => {
  it('renders the hero with a real value proposition', () => {
    render(<HomePage params={{}} searchParams={{}} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/actually runs/i)
    expect(screen.getByRole('button', { name: /start building/i })).toBeInTheDocument()
  })

  it('has an honest footer without framework name-dropping', () => {
    render(<HomePage params={{}} searchParams={{}} />)
    expect(screen.getByText(/guided composer for self-hosted docker stacks/i)).toBeInTheDocument()
    expect(screen.queryByText(/Built with Next\.js/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Docs$/i })).toBeInTheDocument()
  })
})
