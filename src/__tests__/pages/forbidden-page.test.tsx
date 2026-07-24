import { render, screen } from '@testing-library/react'
import ForbiddenPage from '@/app/403/page'

describe('ForbiddenPage', () => {
  it('renders access denied messaging', () => {
    render(<ForbiddenPage />)
    expect(screen.getByText(/Access denied/i)).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })
})