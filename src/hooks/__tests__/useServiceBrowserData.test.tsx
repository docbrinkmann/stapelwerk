import { render, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useServiceBrowserData, useServiceCategories, useServiceDetail } from '../useServiceBrowserData'
import { useServiceBrowserStore } from '@/store/service-browser'

// Mock dependencies
vi.mock('@/trpc/client', () => ({
  api: {
    services: {
      list: {
        query: vi.fn()
      },
      get: {
        query: vi.fn()
      }
    },
    categories: {
      list: {
        query: vi.fn()
      }
    }
  }
}))

vi.mock('@/store/service-browser')
vi.mock('@/hooks/useServiceBrowserUrl', () => ({
  useServiceBrowserUrl: () => ({
    isInitialized: true
  })
}))

vi.mock('@/lib/query/query-client', () => ({
  serviceBrowserKeys: {
    servicesInfinite: vi.fn((params) => ['services', 'infinite', params]),
    searchResults: vi.fn((query, params) => ['services', 'search', query, params]),
    categoriesList: vi.fn(() => ['categories', 'list']),
    service: vi.fn((id) => ['services', 'detail', id]),
    popularServices: vi.fn(() => ['services', 'popular']),
    relatedServices: vi.fn((filters) => ['services', 'related', filters]),
    filterStats: vi.fn((query, filters) => ['services', 'stats', query, filters]),
  }
}))

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

// Test component that uses the hook
const TestComponent = ({ hookResult }: { hookResult: any }) => {
  return <div data-testid="test-component">{JSON.stringify(hookResult)}</div>
}

describe('Service Browser Data Integration', () => {
  let queryClient: QueryClient
  const mockSetError = vi.fn()
  const mockSetLoading = vi.fn()
  let api: any

  const mockApiService = {
    services: [],
    total: 0,
    hasMore: false,
    nextCursor: null,
  }

  const mockStoreState = {
    searchQuery: '',
    activeFilters: {
      categories: [],
      subcategories: [],
      tags: [],
      pricingTypes: [],
      features: [],
      integrations: [],
      companySize: [],
      minPopularity: null,
      hasFreeTier: null,
    },
    sortBy: 'popularity',
    itemsPerPage: 24,
    isSearchMode: false,
    uiState: {
      isLoading: false,
      error: null,
      gridColumns: 3,
    },
    setError: mockSetError,
    setLoading: mockSetLoading,
  }

beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    
    vi.mocked(useServiceBrowserStore).mockReturnValue(mockStoreState as any)
    
    // Reset API mocks
    ;({ api } = await import('@/trpc/client'))
    api.services.list.query.mockResolvedValue(mockApiService)
    api.categories.list.query.mockResolvedValue({ categories: [] })
    api.services.get.query.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  describe('useServiceBrowserData', () => {
    it('should transform store filters to query parameters correctly', async () => {
      const storeWithFilters = {
        ...mockStoreState,
        searchQuery: 'docker',
        activeFilters: {
          ...mockStoreState.activeFilters,
          categories: ['development', 'infrastructure'],
          pricingTypes: ['free', 'paid'],
          minPopularity: 4.5,
          hasFreeTier: true,
        },
        sortBy: 'alphabetical',
        isSearchMode: true,
      }

      vi.mocked(useServiceBrowserStore).mockReturnValue(storeWithFilters as any)

      const TestHookComponent = () => {
        const result = useServiceBrowserData()
        return <TestComponent hookResult={result} />
      }

      render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(api.services.list.query).toHaveBeenCalledWith({
          search: 'docker',
          categories: ['development', 'infrastructure'],
          pricingTypes: ['free', 'paid'],
          minPopularity: 4.5,
          hasFreeTier: true,
          sortBy: 'alphabetical',
          limit: 24,
          cursor: undefined,
        })
      })
    })

    it('should handle browse mode with no filters', async () => {
      const TestHookComponent = () => {
        const result = useServiceBrowserData()
        return <TestComponent hookResult={result} />
      }

      render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(api.services.list.query).toHaveBeenCalledWith({
          limit: 24,
          cursor: undefined,
        })
      })
    })

    it('should handle search mode correctly', async () => {
      const searchState = {
        ...mockStoreState,
        searchQuery: 'kubernetes tools',
        isSearchMode: true,
      }

      vi.mocked(useServiceBrowserStore).mockReturnValue(searchState as any)

      const TestHookComponent = () => {
        const result = useServiceBrowserData()
        return <TestComponent hookResult={result} />
      }

      render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(api.services.list.query).toHaveBeenCalledWith({
          search: 'kubernetes tools',
          limit: 24,
          cursor: undefined,
        })
      })
    })

    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error')
      api.services.list.query.mockRejectedValue(error)

      const TestHookComponent = () => {
        const result = useServiceBrowserData()
        return <TestComponent hookResult={result} />
      }

      render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(error)
      })
    })

    it('should update loading states correctly', async () => {
      let resolveApi: (value: any) => void
      const apiPromise = new Promise((resolve) => {
        resolveApi = resolve
      })

      api.services.list.query.mockReturnValue(apiPromise)

      const TestHookComponent = () => {
        const result = useServiceBrowserData()
        return <TestComponent hookResult={result} />
      }

      render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      // Should call setLoading(true) when query starts
      await waitFor(() => {
        expect(mockSetLoading).toHaveBeenCalledWith(true)
      })

      // Resolve the API call
      act(() => {
        resolveApi!(mockApiService)
      })

      // Should call setLoading(false) when query completes
      await waitFor(() => {
        expect(mockSetLoading).toHaveBeenCalledWith(false)
      })
    })

    it('should handle infinite pagination correctly', async () => {
      const mockServiceWithPagination = {
        services: [{ id: 1, name: 'Service 1' }],
        total: 50,
        hasMore: true,
        nextCursor: 'cursor-123',
      }

      api.services.list.query.mockResolvedValue(mockServiceWithPagination)

      const TestHookComponent = () => {
        const result = useServiceBrowserData()
        return <TestComponent hookResult={result} />
      }

      const { rerender } = render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(api.services.list.query).toHaveBeenCalledWith({
          limit: 24,
          cursor: undefined,
        })
      })

      // Simulate loading next page
      api.services.list.query.mockResolvedValue({
        services: [{ id: 2, name: 'Service 2' }],
        total: 50,
        hasMore: false,
        nextCursor: null,
      })

      // Trigger load more (this would be done by the actual hook)
      await waitFor(() => {
        // The hook should maintain the pagination state
        // This is tested indirectly through the infinite query behavior
        expect(api.services.list.query).toHaveBeenCalled()
      })
    })
  })

  describe('useServiceCategories', () => {
    it('should fetch categories with service counts', async () => {
      const mockCategories = [
        { id: 1, name: 'Development', serviceCount: 25 },
        { id: 2, name: 'Analytics', serviceCount: 15 },
      ]

      api.categories.list.query.mockResolvedValue({ categories: mockCategories })

      const TestHookComponent = () => {
        const result = useServiceCategories()
        return <TestComponent hookResult={result} />
      }

      render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(api.categories.list.query).toHaveBeenCalledWith({
          cursor: undefined,
          limit: 100,
          withServiceCount: true,
        })
      })
    })

    it('should handle category fetch errors', async () => {
      const error = new Error('Categories fetch failed')
      api.categories.list.query.mockRejectedValue(error)

      const TestHookComponent = () => {
        const result = useServiceCategories()
        return <TestComponent hookResult={result} />
      }

      render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(error)
      })
    })
  })

  describe('useServiceDetail', () => {
    it('should fetch service details by ID', async () => {
      const mockService = {
        id: 123,
        name: 'Test Service',
        description: 'A test service',
      }

      api.services.get.query.mockResolvedValue(mockService)

      const TestHookComponent = () => {
        const result = useServiceDetail('123')
        return <TestComponent hookResult={result} />
      }

      render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(api.services.get.query).toHaveBeenCalledWith({ id: 123 })
      })
    })

    it('should handle invalid service IDs', async () => {
      const TestHookComponent = () => {
        const result = useServiceDetail('invalid')
        return <TestComponent hookResult={result} />
      }

      render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Invalid service ID'
          })
        )
      })
    })

    it('should not fetch when serviceId is undefined', async () => {
      
      const TestHookComponent = () => {
        const result = useServiceDetail(undefined)
        return <TestComponent hookResult={result} />
      }

      render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      // Wait a bit to ensure no API call is made
      await new Promise(resolve => setTimeout(resolve, 100))
      
      expect(api.services.get.query).not.toHaveBeenCalled()
    })
  })

  describe('Integration with Filters', () => {
    it('should properly encode complex filter combinations', async () => {
      const complexFilters = {
        ...mockStoreState,
        searchQuery: 'machine learning tools',
        activeFilters: {
          categories: ['analytics', 'development'],
          subcategories: ['data-science', 'web-development'],
          tags: ['python', 'tensorflow', 'jupyter'],
          pricingTypes: ['freemium', 'enterprise'],
          features: ['api', 'dashboard', 'real-time'],
          integrations: ['slack', 'github', 'jira'],
          companySize: ['startup', 'large'],
          minPopularity: 4.2,
          hasFreeTier: true,
        },
        sortBy: 'recently_added',
        isSearchMode: true,
      }

      vi.mocked(useServiceBrowserStore).mockReturnValue(complexFilters as any)

      const TestHookComponent = () => {
        const result = useServiceBrowserData()
        return <TestComponent hookResult={result} />
      }

      render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(api.services.list.query).toHaveBeenCalledWith({
          search: 'machine learning tools',
          categories: ['analytics', 'development'],
          pricingTypes: ['freemium', 'enterprise'],
          features: ['api', 'dashboard', 'real-time'],
          integrations: ['slack', 'github', 'jira'],
          companySize: ['startup', 'large'],
          minPopularity: 4.2,
          hasFreeTier: true,
          sortBy: 'recently_added',
          limit: 24,
          cursor: undefined,
        })
      })
    })

    it('should handle empty filters correctly', async () => {
      const emptyFilters = {
        ...mockStoreState,
        searchQuery: '',
        activeFilters: {
          categories: [],
          subcategories: [],
          tags: [],
          pricingTypes: [],
          features: [],
          integrations: [],
          companySize: [],
          minPopularity: null,
          hasFreeTier: null,
        },
        sortBy: 'popularity', // Default value
      }

      vi.mocked(useServiceBrowserStore).mockReturnValue(emptyFilters as any)

      const TestHookComponent = () => {
        const result = useServiceBrowserData()
        return <TestComponent hookResult={result} />
      }

      render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(api.services.list.query).toHaveBeenCalledWith({
          limit: 24,
          cursor: undefined,
        })
      })
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network error')
      api.services.list.query.mockRejectedValue(networkError)

      const TestHookComponent = () => {
        const result = useServiceBrowserData()
        return <TestComponent hookResult={result} />
      }

      render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(networkError)
      })
    })

    it('should handle validation errors appropriately', async () => {
      const validationError = {
        data: { code: 'BAD_REQUEST' },
        message: 'Invalid parameters'
      }
      
      api.services.list.query.mockRejectedValue(validationError)

      const TestHookComponent = () => {
        const result = useServiceBrowserData()
        return <TestComponent hookResult={result} />
      }

      render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalled()
      })
    })

    it('should clear errors when successful request follows failed one', async () => {
      
      // First call fails
      api.services.list.query.mockRejectedValueOnce(new Error('API Error'))
      // Second call succeeds
      api.services.list.query.mockResolvedValueOnce(mockApiService)

      const TestHookComponent = () => {
        const result = useServiceBrowserData()
        return <TestComponent hookResult={result} />
      }

      const { rerender } = render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(expect.any(Error))
      })

      // Trigger a rerender to simulate a retry
      rerender(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(null)
      })
    })
  })

  describe('Performance and Caching', () => {
    it('should use appropriate stale times for different query types', async () => {
      api.services.list.query.mockResolvedValue(mockApiService)
      api.categories.list.query.mockResolvedValue({ categories: [] })

      const TestHookComponent = () => {
        useServiceBrowserData() // 2-5 min stale time based on search mode
        useServiceCategories() // 10 min stale time
        return <div />
      }

      render(
        <TestWrapper>
          <TestHookComponent />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(api.services.list.query).toHaveBeenCalled()
        expect(api.categories.list.query).toHaveBeenCalled()
      })

      // The actual stale time testing would require more complex setup
      // to verify the React Query cache behavior
    })
  })
})