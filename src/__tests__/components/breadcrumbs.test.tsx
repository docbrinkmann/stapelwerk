import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
  useParams: vi.fn(),
}))

import { usePathname, useParams } from 'next/navigation'
import { Breadcrumbs } from '@/components/navigation/breadcrumbs'

describe('Breadcrumbs Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useParams as ReturnType<typeof vi.fn>).mockReturnValue({})
  })

  it('renders home breadcrumb on root path', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/')
    
    render(<Breadcrumbs />)
    
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
  })

  it('renders breadcrumb trail for nested paths', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/stacks')
    
    render(<Breadcrumbs />)
    
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
    expect(screen.getByText(/stacks/i)).toBeInTheDocument()
  })

  it('renders breadcrumb for stack detail page', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/stacks/stack-123')
    ;(useParams as ReturnType<typeof vi.fn>).mockReturnValue({ stackId: 'stack-123' })
    
    render(<Breadcrumbs />)
    
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
    expect(screen.getByText(/stacks/i)).toBeInTheDocument()
  })

  it('renders breadcrumb for stack services tab', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/stacks/stack-123/services')
    ;(useParams as ReturnType<typeof vi.fn>).mockReturnValue({ stackId: 'stack-123' })
    
    render(<Breadcrumbs />)
    
    expect(screen.getByText(/services/i)).toBeInTheDocument()
  })

  it('renders breadcrumb for stack logs tab', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/stacks/stack-123/logs')
    ;(useParams as ReturnType<typeof vi.fn>).mockReturnValue({ stackId: 'stack-123' })
    
    render(<Breadcrumbs />)
    
    expect(screen.getByText(/logs/i)).toBeInTheDocument()
  })

  it('renders breadcrumb for stack terminal tab', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/stacks/stack-123/terminal')
    ;(useParams as ReturnType<typeof vi.fn>).mockReturnValue({ stackId: 'stack-123' })
    
    render(<Breadcrumbs />)
    
    expect(screen.getByText(/terminal/i)).toBeInTheDocument()
  })

  it('renders breadcrumb for settings page', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/settings')
    
    render(<Breadcrumbs />)
    
    expect(screen.getByText(/settings/i)).toBeInTheDocument()
  })

  it('last breadcrumb item is not a link', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/stacks')
    
    render(<Breadcrumbs />)
    
    const stacksText = screen.getByText(/stacks/i)
    // Last item should not be wrapped in a link
    expect(stacksText.closest('a')).toBeNull()
  })

  it('intermediate breadcrumb items are links', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/stacks/stack-123')
    ;(useParams as ReturnType<typeof vi.fn>).mockReturnValue({ stackId: 'stack-123' })
    
    render(<Breadcrumbs />)
    
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
    expect(dashboardLink).toBeInTheDocument()
    expect(dashboardLink).toHaveAttribute('href', '/dashboard')
  })

  it('has correct aria-label for accessibility', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/stacks')
    
    render(<Breadcrumbs />)
    
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(nav).toBeInTheDocument()
  })

  it('renders separator between breadcrumb items', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/stacks/stack-123')
    ;(useParams as ReturnType<typeof vi.fn>).mockReturnValue({ stackId: 'stack-123' })
    
    const { container } = render(<Breadcrumbs />)
    
    // Should have separators (typically / or >)
    const separators = container.querySelectorAll('[aria-hidden="true"]')
    expect(separators.length).toBeGreaterThan(0)
  })

  it('applies custom className', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/')
    
    const { container } = render(<Breadcrumbs className="custom-breadcrumbs" />)
    
    expect(container.firstChild).toHaveClass('custom-breadcrumbs')
  })

  it('capitalizes path segments', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/stack-builder')
    
    render(<Breadcrumbs />)
    
    // Should display "Stack Builder" not "stack-builder"
    expect(screen.getByText(/stack builder/i)).toBeInTheDocument()
  })

  it('handles deep nesting correctly', () => {
    ;(usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/stacks/stack-123/services/service-456')
    ;(useParams as ReturnType<typeof vi.fn>).mockReturnValue({ 
      stackId: 'stack-123',
      serviceId: 'service-456'
    })
    
    render(<Breadcrumbs />)
    
    // All path segments should be present
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
    expect(screen.getByText(/stacks/i)).toBeInTheDocument()
    expect(screen.getByText(/services/i)).toBeInTheDocument()
  })
})
