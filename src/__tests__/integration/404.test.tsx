import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, it, expect } from 'vitest'
import NotFound from '@/app/not-found'

describe('404 page', () => {
  it('renders not found message', () => {
    render(<NotFound />)
    expect(screen.getByText(/Page not found/i)).toBeInTheDocument()
  })
})