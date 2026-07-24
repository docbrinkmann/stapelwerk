import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  setMutate: vi.fn(),
  invalidate: vi.fn(),
  data: [{ key: 'FOO', value: 'bar', isSecret: false }] as Array<{ key: string; value: string; isSecret: boolean }>,
}))

vi.mock('next/navigation', () => ({ useParams: () => ({ stackId: 's1' }) }))

vi.mock('@/trpc/react-client', () => ({
  trpc: {
    useUtils: () => ({ stacks: { getEnvVars: { invalidate: h.invalidate } } }),
    stacks: {
      getEnvVars: { useQuery: () => ({ data: h.data, isLoading: false }) },
      setEnvVars: { useMutation: () => ({ mutate: h.setMutate, isPending: false }) },
    },
  },
}))

vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import StackEnvPage from '../env/page'

beforeEach(() => {
  h.setMutate.mockClear()
  h.data = [{ key: 'FOO', value: 'bar', isSecret: false }]
})

describe('StackEnvPage', () => {
  it('renders env vars loaded from the backend, not hardcoded examples', () => {
    render(<StackEnvPage />)
    expect(screen.getByText('FOO')).toBeInTheDocument()
    // The old mock seed must be gone.
    expect(screen.queryByText('DATABASE_URL')).not.toBeInTheDocument()
    expect(screen.queryByText('API_KEY')).not.toBeInTheDocument()
  })

  it('persists a deletion via setEnvVars', () => {
    render(<StackEnvPage />)
    fireEvent.click(screen.getByRole('button', { name: /delete variable/i }))
    expect(h.setMutate).toHaveBeenCalledWith(
      expect.objectContaining({ stackId: 's1', envVars: [] }),
    )
  })
})
