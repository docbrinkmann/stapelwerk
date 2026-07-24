import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }))

import HeroSection from '../hero-section'

beforeEach(() => h.push.mockClear())

describe('HeroSection', () => {
  it('shows real product value and a real compose preview', () => {
    render(<HeroSection />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/actually runs/i)
    expect(screen.getAllByText(/docker-compose\.yml/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/jellyfin/i).length).toBeGreaterThan(0)
  })

  it('has no fake social proof or fabricated stats (the AI tells)', () => {
    render(<HeroSection />)
    expect(screen.queryByText(/trusted by/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/99\.9%/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^AWS$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Azure$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^GCP$/)).not.toBeInTheDocument()
  })

  it('wires the CTAs to the builder and the catalog', () => {
    render(<HeroSection />)
    fireEvent.click(screen.getByRole('button', { name: /start building/i }))
    expect(h.push).toHaveBeenCalledWith('/stack-builder')
    fireEvent.click(screen.getByRole('button', { name: /browse the catalog/i }))
    expect(h.push).toHaveBeenCalledWith('/services')
  })
})
