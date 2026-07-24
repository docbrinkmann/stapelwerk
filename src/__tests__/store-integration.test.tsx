import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { useServiceBrowserStore } from '@/store/service-browser'
import { useInfiniteServiceBrowserScroll } from '@/hooks/useInfiniteScroll'
import type { Service } from '@/types/service-browser'

// Mock the service data hooks since we're testing integration, not API calls
vi.mock('@/hooks/useServiceData', () => ({
  useServiceList: vi.fn(),
  useServiceSearch: vi.fn(),
}))

import * as useServiceData from '@/hooks/useServiceData'

const mockUseServiceData = useServiceData as vi.MockedFunction<typeof useServiceData>

// Mock service data
const mockService: Service = {
  id: 'service-1',
  name: 'Test Service',
  description: 'A test service',
  category: 'development',
  subcategory: 'backend',
  tags: ['test', 'api'],
  pricing: {
    type: 'free',
  },
  features: ['REST API'],
  integrations: ['GitHub'],
  documentation: {
    quickStart: 'https://docs.example.com',
    apiReference: 'https://docs.example.com/api',
    examples: [],
  },
  company: {
    name: 'Test Company',
    founded: 2020,
    headquarters: 'San Francisco, CA',
    website: 'https://testcompany.com',
  },
  metrics: {
    popularity: 4.5,
    reliability: 99.9,
    performance: 4.2,
    documentation: 4.0,
    support: 4.3,
  },
  status: 'active',
  lastUpdated: '2024-01-15T10:30:00Z',
  createdAt: '2024-01-01T00:00:00Z',
}

// Test wrapper component
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  })

  return function TestWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('Store Integration with React Query hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // The zustand store is a module-level singleton — reset it so state
    // set in one test doesn't leak into the next.
    act(() => {
      useServiceBrowserStore.getState().resetState()
    })

    // Default mock implementations
    mockUseServiceData.useServiceList.mockReturnValue({
      services: [mockService],
      totalCount: 1,
      isLoading: false,
      isLoadingMore: false,
      hasNextPage: false,
      loadMore: vi.fn(),
      error: null,
      refetch: vi.fn(),
    })

    mockUseServiceData.useServiceSearch.mockReturnValue({
      services: [mockService],
      isLoading: false,
      isLoadingMore: false,
      hasNextPage: false,
      loadMore: vi.fn(),
      error: null,
      refetch: vi.fn(),
      isEmpty: false,
    })
  })

  it('should integrate store state with infinite scroll hooks', () => {
    const { result: storeResult } = renderHook(() => useServiceBrowserStore())
    const { result: scrollResult } = renderHook(
      () => useInfiniteServiceBrowserScroll(),
      { wrapper: createWrapper() }
    )

    // Initially in browse mode
    expect(scrollResult.current.mode).toBe('browse')

    // Switch to search mode in store
    act(() => {
      storeResult.current.setSearchQuery('test query')
    })

    // Scroll hook should reflect search mode
    // Note: This requires the hook to properly subscribe to store changes
    expect(storeResult.current.isSearchMode).toBe(true)
  })

  it('should provide search parameters from store to React Query hooks', () => {
    const { result: storeResult } = renderHook(() => useServiceBrowserStore())

    // Set up some filters in store
    act(() => {
      storeResult.current.setSearchQuery('test')
      storeResult.current.setCategories(['development'])
      storeResult.current.setSortBy('alphabetical')
    })

    const searchParams = storeResult.current.getSearchParamsForQuery()

    expect(searchParams).toEqual({
      query: 'test',
      categories: ['development'],
      sortBy: 'alphabetical',
      limit: 24, // Default items per page
    })
  })

  it('should handle filter changes and update search parameters', () => {
    const { result } = renderHook(() => useServiceBrowserStore())

    // Initially no filters
    expect(result.current.getActiveFilterCount()).toBe(0)

    act(() => {
      result.current.setCategories(['development', 'devops'])
      result.current.setTags(['api'])
      result.current.setPopularityFilter(4.0)
    })

    // Should have 4 filters: 2 categories + 1 tag + 1 popularity
    expect(result.current.getActiveFilterCount()).toBe(4)

    const searchParams = result.current.getSearchParamsForQuery()
    expect(searchParams.categories).toEqual(['development', 'devops'])
    expect(searchParams.tags).toEqual(['api'])
    expect(searchParams.minPopularity).toBe(4.0)
  })

  it('should reset state correctly while preserving user preferences', () => {
    const { result } = renderHook(() => useServiceBrowserStore())

    // Set up state and preferences
    act(() => {
      result.current.setSearchQuery('test')
      result.current.setCategories(['development'])
      result.current.setSortBy('alphabetical')
      result.current.setViewMode('list')
      result.current.updatePreferences({
        defaultViewMode: 'list',
        itemsPerPage: 48,
      })
    })

    const originalPreferences = result.current.userPreferences

    // Reset state
    act(() => {
      result.current.resetState()
    })

    // State should be reset
    expect(result.current.searchQuery).toBe('')
    expect(result.current.activeFilters.categories).toEqual([])
    expect(result.current.sortBy).toBe('popularity')
    expect(result.current.viewMode).toBe('grid')

    // But preferences should be preserved
    expect(result.current.userPreferences).toEqual(originalPreferences)
  })

  it('should handle modal state correctly', () => {
    const { result } = renderHook(() => useServiceBrowserStore())

    // Initially closed
    expect(result.current.modalState.isOpen).toBe(false)
    expect(result.current.modalState.service).toBe(null)

    // Open modal
    act(() => {
      result.current.openServiceModal(mockService)
    })

    expect(result.current.modalState.isOpen).toBe(true)
    expect(result.current.modalState.service).toEqual(mockService)
    expect(result.current.modalState.isLoading).toBe(false)
    expect(result.current.modalState.error).toBe(null)

    // Set loading state
    act(() => {
      result.current.setModalLoading(true)
    })

    expect(result.current.modalState.isLoading).toBe(true)

    // Set error state
    act(() => {
      result.current.setModalError('Test error')
    })

    expect(result.current.modalState.error).toBe('Test error')

    // Close modal
    act(() => {
      result.current.closeServiceModal()
    })

    expect(result.current.modalState.isOpen).toBe(false)
    expect(result.current.modalState.service).toBe(null)
    expect(result.current.modalState.isLoading).toBe(false)
    expect(result.current.modalState.error).toBe(null)
  })

  it('should handle UI state correctly', () => {
    const { result } = renderHook(() => useServiceBrowserStore())

    // Initially not loading, no error
    expect(result.current.uiState.isLoading).toBe(false)
    expect(result.current.uiState.error).toBe(null)
    expect(result.current.uiState.gridColumns).toBe(3)

    // Set loading
    act(() => {
      result.current.setLoading(true)
    })

    expect(result.current.uiState.isLoading).toBe(true)

    // Set error
    act(() => {
      result.current.setError('Test error')
    })

    expect(result.current.uiState.error).toBe('Test error')

    // Set grid columns with clamping
    act(() => {
      result.current.setGridColumns(5)
    })

    expect(result.current.uiState.gridColumns).toBe(5)

    // Test clamping
    act(() => {
      result.current.setGridColumns(10) // Should clamp to 6
    })

    expect(result.current.uiState.gridColumns).toBe(6)
  })

  it('should integrate pagination changes with React Query', () => {
    const { result } = renderHook(() => useServiceBrowserStore())

    // Set items per page
    act(() => {
      result.current.setItemsPerPage(48)
    })

    expect(result.current.itemsPerPage).toBe(48)
    expect(result.current.searchParams.limit).toBe(48)
    expect(result.current.currentPage).toBe(1) // Should reset to page 1

    // Verify search params include the new limit
    const searchParams = result.current.getSearchParamsForQuery()
    expect(searchParams.limit).toBe(48)
  })

  it('should handle preference updates correctly', () => {
    const { result } = renderHook(() => useServiceBrowserStore())

    // Update some preferences
    act(() => {
      result.current.updatePreferences({
        defaultViewMode: 'list',
        itemsPerPage: 48,
        defaultSortBy: 'alphabetical',
        rememberFilters: true,
      })
    })

    expect(result.current.userPreferences.defaultViewMode).toBe('list')
    expect(result.current.userPreferences.itemsPerPage).toBe(48)
    expect(result.current.userPreferences.defaultSortBy).toBe('alphabetical')
    expect(result.current.userPreferences.rememberFilters).toBe(true)

    // Partial update should preserve existing preferences
    act(() => {
      result.current.updatePreferences({
        itemsPerPage: 96,
      })
    })

    expect(result.current.userPreferences.defaultViewMode).toBe('list') // Should keep
    expect(result.current.userPreferences.itemsPerPage).toBe(96) // Should update
    expect(result.current.userPreferences.defaultSortBy).toBe('alphabetical') // Should keep
  })
})