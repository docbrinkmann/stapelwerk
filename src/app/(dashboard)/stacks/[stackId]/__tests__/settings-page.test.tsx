import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  stack: { id: 's1', name: 'My Stack', description: 'Desc', isPublic: false },
  update: vi.fn(),
  del: vi.fn(),
  refetch: vi.fn(),
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ stackId: 's1' }),
  useRouter: () => ({ push: h.push }),
}))

vi.mock('@/trpc/react-client', () => ({
  trpc: {
    stacks: {
      get: { useQuery: () => ({ data: h.stack, isLoading: false, refetch: h.refetch }) },
      update: { useMutation: () => ({ mutate: h.update, isPending: false }) },
      delete: { useMutation: () => ({ mutate: h.del, isPending: false }) },
    },
  },
}))

vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import StackSettingsPage from '../settings/page'

beforeEach(() => {
  h.update.mockClear()
})

describe('StackSettingsPage', () => {
  it('seeds the form from the loaded stack', () => {
    render(<StackSettingsPage />)
    const nameInput = screen.getByLabelText(/stack name/i) as HTMLInputElement
    expect(nameInput.value).toBe('My Stack')
  })

  it('lets the user clear the name field (no fallback masking)', () => {
    render(<StackSettingsPage />)
    const nameInput = screen.getByLabelText(/stack name/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: '' } })
    expect(nameInput.value).toBe('')
  })

  it('saves edited values via the update mutation', () => {
    render(<StackSettingsPage />)
    const nameInput = screen.getByLabelText(/stack name/i)
    fireEvent.change(nameInput, { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(h.update).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', name: 'Renamed' }))
  })
})
