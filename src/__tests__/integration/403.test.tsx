import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, it, expect } from 'vitest'
import ForbiddenPage from '@/app/403/page'

describe('403 page', () => {
  it('renders access denied message', () => {
    render(<ForbiddenPage />)
    expect(screen.getByText(/Access denied/i)).toBeInTheDocument()
    expect(screen.getByText(/Get help/i)).toBeInTheDocument()
  })
})