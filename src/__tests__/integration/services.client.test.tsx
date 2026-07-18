import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ServiceBrowserClient } from '@/app/services/components/ServiceBrowserClient'

// Mock react-query client
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<any>('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() })
  }
})

// Minimal store & component mocks. The component also calls the zustand
// static `useServiceBrowserStore.getState()` (URL sync), so the mock hook
// needs that method too.
vi.mock('@/store/service-browser', () => {
  const state = {
    searchQuery: '',
    activeFilters: { categories: [], tags: [], pricingTypes: [] },
    syncFromUrl: () => {},
    getActiveFilterCount: () => 0,
    uiState: { isLoading: false, error: null },
  }
  const useServiceBrowserStore = () => state
  useServiceBrowserStore.getState = () => state
  return { useServiceBrowserStore }
})
vi.mock('@/stores/stack-builder', () => ({
  useStackServices: () => ({ services: [] }),
}))

// Stub heavy/ancillary components to avoid data hooks
vi.mock('@/components/ServicePreviewModal', () => ({ ServicePreviewModal: () => <div /> }))
vi.mock('@/components/stack-configuration/StackCanvas', () => ({ StackCanvas: () => <div /> }))
vi.mock('@/components/SaveStackModal', () => ({ SaveStackModal: () => <div /> }))
vi.mock('@/components/SearchBar', () => ({ SearchBar: () => <div>Search services</div> }))
vi.mock('@/components/FilterPanel', () => ({ FilterPanel: () => <div role="region" aria-label="Service filters" /> }))
vi.mock('@/components/ServiceGrid', () => ({ ServiceGrid: () => <div /> }))

describe('ServiceBrowserClient', () => {
  it('renders search and filter areas', async () => {
    const { QueryClient, QueryClientProvider } = await vi.importActual<any>('@tanstack/react-query')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <ServiceBrowserClient />
      </QueryClientProvider>
    )
    expect(screen.getAllByText(/Search services/i)[0]).toBeInTheDocument()
    expect(screen.getAllByRole('region', { name: /Service filters/i })[0]).toBeInTheDocument()
  })
})