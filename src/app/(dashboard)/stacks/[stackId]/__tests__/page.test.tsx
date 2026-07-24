import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted so the vi.mock factory (also hoisted) can close over them.
const h = vi.hoisted(() => ({
  deployMutate: vi.fn(),
  stopMutate: vi.fn(),
  refetch: vi.fn(),
  stack: {
    id: 's1',
    name: 'My Stack',
    description: 'A test stack',
    status: 'active',
    createdAt: new Date('2026-07-01').toISOString(),
    updatedAt: new Date('2026-07-02').toISOString(),
    stack_services: [
      { id: 'ss1', services: { name: 'nginx', dockerImage: 'nginx:latest' } },
    ],
  },
  jobs: [] as Array<Record<string, unknown>>,
}))

vi.mock('next/navigation', () => ({ useParams: () => ({ stackId: 's1' }) }))

vi.mock('@/trpc/react-client', () => ({
  trpc: {
    stacks: {
      get: { useQuery: () => ({ data: h.stack, isLoading: false, error: null }) },
    },
    deployments: {
      listJobs: {
        useQuery: () => ({ data: { jobs: h.jobs }, isLoading: false, error: null, refetch: h.refetch }),
      },
      deployStack: {
        useMutation: () => ({ mutate: h.deployMutate, isPending: false, error: null }),
      },
      stopStack: {
        useMutation: () => ({ mutate: h.stopMutate, isPending: false, error: null }),
      },
    },
  },
}))

import StackOverviewPage from '../page'

beforeEach(() => {
  h.deployMutate.mockClear()
  h.stopMutate.mockClear()
  h.jobs = []
})

describe('StackOverviewPage', () => {
  it('deploys via the real mutation when Deploy is clicked', () => {
    render(<StackOverviewPage />)
    fireEvent.click(screen.getByRole('button', { name: /^deploy$/i }))
    expect(h.deployMutate).toHaveBeenCalledWith(expect.objectContaining({ stackId: 's1' }))
  })

  it('stops via the real mutation when Stop is clicked', () => {
    render(<StackOverviewPage />)
    fireEvent.click(screen.getByRole('button', { name: /^stop$/i }))
    expect(h.stopMutate).toHaveBeenCalledWith(expect.objectContaining({ stackId: 's1' }))
  })

  it('shows real deployment status, not a hardcoded "Healthy"', () => {
    h.jobs = [
      { id: 'j1', mode: 'destroy', status: 'succeeded', createdAt: new Date('2026-07-02').toISOString(), updatedAt: new Date('2026-07-02').toISOString() },
    ]
    render(<StackOverviewPage />)
    expect(screen.getAllByText(/stopped/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/^healthy$/i)).not.toBeInTheDocument()
  })

  it('shows "Running" when the latest job is a successful deploy', () => {
    h.jobs = [
      { id: 'j2', mode: 'apply', status: 'succeeded', createdAt: new Date('2026-07-02').toISOString(), updatedAt: new Date('2026-07-02').toISOString() },
    ]
    render(<StackOverviewPage />)
    // Health card reflects a running deployment
    expect(screen.getAllByText(/running/i).length).toBeGreaterThan(0)
  })

  it('shows "Not deployed" when there are no jobs', () => {
    h.jobs = []
    render(<StackOverviewPage />)
    expect(screen.getAllByText(/not deployed/i).length).toBeGreaterThan(0)
  })
})
