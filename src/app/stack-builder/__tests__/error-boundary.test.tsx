import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import StackBuilderError from '@/app/stack-builder/error'

describe('Stack Builder route error boundary', () => {
  it('renders heading and retries via reset', () => {
    const reset = vi.fn()
    render(<StackBuilderError error={new Error('boom')} reset={reset} />)
expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(screen.getByText(/Unable to load Stack Builder/i)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Try again/i))
    expect(reset).toHaveBeenCalled()
  })
})