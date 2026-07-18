import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  addMutate: vi.fn(),
  removeMutate: vi.fn(),
  invalidate: vi.fn(),
  stack: {
    id: 's1',
    stack_services: [
      { id: 'ss1', serviceId: 10, order: 1, services: { id: 10, name: 'nginx', dockerImage: 'nginx:latest', categories: { name: 'Web' } } },
    ],
  },
  catalog: [
    { id: 10, name: 'nginx' },
    { id: 20, name: 'postgres' },
  ],
}))

vi.mock('next/navigation', () => ({ useParams: () => ({ stackId: 's1' }) }))

vi.mock('@/trpc/react-client', () => ({
  trpc: {
    useUtils: () => ({ stacks: { get: { invalidate: h.invalidate } } }),
    stacks: {
      get: { useQuery: () => ({ data: h.stack, isLoading: false }) },
      addService: { useMutation: () => ({ mutate: h.addMutate, isPending: false }) },
      removeService: { useMutation: () => ({ mutate: h.removeMutate, isPending: false }) },
    },
    services: { list: { useQuery: () => ({ data: { services: h.catalog }, isLoading: false }) } },
  },
}))

import StackServicesPage from '../services/page'

beforeEach(() => {
  h.addMutate.mockClear()
  h.removeMutate.mockClear()
})

describe('StackServicesPage', () => {
  it('does not show a fake hardcoded Running/Healthy status', () => {
    render(<StackServicesPage />)
    expect(screen.queryByText('Running')).not.toBeInTheDocument()
    expect(screen.queryByText('Healthy')).not.toBeInTheDocument()
  })

  it('removes a service via the real mutation', () => {
    render(<StackServicesPage />)
    fireEvent.click(screen.getByRole('button', { name: /remove nginx/i }))
    expect(h.removeMutate).toHaveBeenCalledWith(expect.objectContaining({ stackId: 's1', serviceId: 10 }))
  })

  it('adds a service from the catalog picker', () => {
    render(<StackServicesPage />)
    fireEvent.click(screen.getByRole('button', { name: /^add service$/i }))
    // postgres (id 20) isn't in the stack yet, so it's offered in the picker.
    fireEvent.click(screen.getByRole('button', { name: /postgres/i }))
    expect(h.addMutate).toHaveBeenCalledWith(expect.objectContaining({ stackId: 's1', serviceId: 20 }))
  })
})
