import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import ServicesError from '@/app/services/error'

describe('Services route error boundary', () => {
  it('renders heading and retries via reset', () => {
    const reset = vi.fn()
    render(<ServicesError error={new Error('boom')} reset={reset} />)
expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(screen.getByText(/Unable to load Services/i)).toBeInTheDocument()
fireEvent.click(screen.getAllByText(/Try again/i)[0])
    expect(reset).toHaveBeenCalled()
  })
})