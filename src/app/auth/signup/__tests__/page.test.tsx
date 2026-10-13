import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ mutate: vi.fn(), signupEnabled: true }))
vi.mock('@/trpc/react-client', () => ({
  trpc: {
    auth: {
      config: { useQuery: () => ({ data: { signupEnabled: h.signupEnabled } }) },
      register: { useMutation: () => ({ mutate: h.mutate, isPending: false }) },
    },
  },
}))

import SignUpPage from '../page'

describe('SignUpPage', () => {
  beforeEach(() => {
    h.mutate.mockReset()
    h.signupEnabled = true
  })

  it('asks only for the address — the password is chosen via the mailed link', () => {
    h.mutate.mockImplementation((_input: unknown, opts: { onSuccess: () => void }) => opts.onSuccess())
    render(<SignUpPage />)
    expect(screen.queryByLabelText(/password/i)).toBeNull()

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'me@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send confirmation link/i }))

    expect(h.mutate).toHaveBeenCalledWith({ email: 'me@example.com', name: undefined, locale: 'en' }, expect.anything())
    expect(screen.getByText(/check your inbox/i)).toBeInTheDocument()
  })

  it('rejects an invalid address before calling the server', () => {
    render(<SignUpPage />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'not-an-address' } })
    fireEvent.click(screen.getByRole('button', { name: /send confirmation link/i }))
    expect(h.mutate).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i)
  })

  it('says so when the instance cannot send mail (sign-up off)', () => {
    h.signupEnabled = false
    render(<SignUpPage />)
    expect(screen.getByText(/not enabled on this instance/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /send confirmation link/i })).toBeNull()
  })
})
