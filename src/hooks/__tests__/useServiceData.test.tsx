import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { api } from '@/trpc/client'
import {
  useServiceList,
  useService,
  useCategories,
  useServiceSearch,
  usePopularServices,
  useServicesByCategory,
  useServiceBrowserData,
} from '../useServiceData'
import type { Service, ServiceCategory, ServiceListResponse } from '@/types/service-browser'

// Mock the tRPC client
vi.mock('@/trpc/client', () => ({
  api: {
    services: {
      list: {
        query: vi.fn(),
      },
      get: {
        query: vi.fn(),
      },
    },
    categories: {
      list: {
        query: vi.fn(),
      },
    },
  },
}))

const mockApi = api as vi.MockedFunction<typeof api>

// Test data
const mockService: Service = {
  id: 'service-1',
  name: 'Test Service',
  description: 'A test service',
  category: 'development',
  subcategory: 'backend',
  tags: ['test', 'api'],
  pricing: {
    type: 'freemium',
    freeQuota: '1000 requests/month',
    paidPlans: [
      {
        name: 'Pro',
        price: '$29/month',
        features: ['Unlimited requests', 'Premium support'],
      },
    ],
  },
  features: ['REST API', 'WebSocket support', 'Authentication'],
  integrations: ['GitHub', 'Slack'],
  documentation: {
    quickStart: 'https://docs.example.com/quickstart',
    apiReference: 'https://docs.example.com/api',
    examples: ['https://docs.example.com/examples'],
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

const mockCategory: ServiceCategory = {
  id: 'development',
  name: 'Development',
  description: 'Development tools and services',
  icon: 'code',
  color: '#3b82f6',
  subcategories: [
    {
      id: 'backend',
      name: 'Backend',
      description: 'Backend development services',
      serviceCount: 42,
    },
  ],
  serviceCount: 100,
}

const mockServiceListResponse: ServiceListResponse = {
  services: [mockService],
  pagination: {
    totalCount: 1,
    hasNextPage: false,
    cursor: undefined,
  },
  filters: {
    categories: ['development'],
    tags: [],
    pricing: [],
  },
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

describe('useServiceData hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useServiceList', () => {
    it('should fetch services with infinite query', async () => {
      mockApi.services.list.query.mockResolvedValue(mockServiceListResponse)

      const { result } = renderHook(
        () => useServiceList({ limit: 24 }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.services).toHaveLength(1)
      })

      expect(mockApi.services.list.query).toHaveBeenCalledWith({
        cursor: undefined,
        limit: 24,
      })
      expect(result.current.services[0]).toEqual(mockService)
      expect(result.current.totalCount).toBe(1)
      expect(result.current.hasNextPage).toBe(false)
    })

    it('should handle pagination correctly', async () => {
      const firstPageResponse = {
        ...mockServiceListResponse,
        pagination: {
          totalCount: 2,
          hasNextPage: true,
          cursor: 'cursor-1',
        },
      }

      const secondPageResponse = {
        services: [{ ...mockService, id: 'service-2' }],
        pagination: {
          totalCount: 2,
          hasNextPage: false,
          cursor: undefined,
        },
        filters: mockServiceListResponse.filters,
      }

      mockApi.services.list.query
        .mockResolvedValueOnce(firstPageResponse)
        .mockResolvedValueOnce(secondPageResponse)

      const { result } = renderHook(
        () => useServiceList(),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.services).toHaveLength(1)
      })

      // Load next page
      await result.current.loadMore()

      await waitFor(() => {
        expect(result.current.services).toHaveLength(2)
      })

      expect(result.current.hasNextPage).toBe(false)
    })

    it('should handle search parameters', async () => {
      mockApi.services.list.query.mockResolvedValue(mockServiceListResponse)

      const searchParams = {
        query: 'test',
        categories: ['development'],
        tags: ['api'],
      }

      renderHook(
        () => useServiceList(searchParams),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(mockApi.services.list.query).toHaveBeenCalledWith({
          ...searchParams,
          cursor: undefined,
          limit: 24,
        })
      })
    })
  })

  describe('useService', () => {
    it('should fetch a single service by ID', async () => {
      mockApi.services.get.query.mockResolvedValue(mockService)

      const { result } = renderHook(
        () => useService('service-1'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.service).toEqual(mockService)
      })

      expect(mockApi.services.get.query).toHaveBeenCalledWith({ id: 'service-1' })
    })

    it('should not fetch when serviceId is undefined', () => {
      const { result } = renderHook(
        () => useService(undefined),
        { wrapper: createWrapper() }
      )

      expect(result.current.service).toBeUndefined()
      expect(mockApi.services.get.query).not.toHaveBeenCalled()
    })
  })

  describe('useCategories', () => {
    it('should fetch categories', async () => {
      const categoriesResponse = { categories: [mockCategory] }
      mockApi.categories.list.query.mockResolvedValue(categoriesResponse)

      const { result } = renderHook(
        () => useCategories(),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.categories).toHaveLength(1)
      })

      expect(result.current.categories[0]).toEqual(mockCategory)
      expect(mockApi.categories.list.query).toHaveBeenCalledWith({})
    })
  })

  describe('useServiceSearch', () => {
    it('should search services with query', async () => {
      mockApi.services.list.query.mockResolvedValue(mockServiceListResponse)

      const { result } = renderHook(
        () => useServiceSearch('test query'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.services).toHaveLength(1)
      })

      expect(mockApi.services.list.query).toHaveBeenCalledWith({
        search: 'test query',
        cursor: undefined,
        limit: 24,
      })
    })

    it('should not search with queries less than 2 characters', () => {
      const { result } = renderHook(
        () => useServiceSearch('t'),
        { wrapper: createWrapper() }
      )

      expect(result.current.services).toHaveLength(0)
      expect(mockApi.services.list.query).not.toHaveBeenCalled()
    })

    it('should show isEmpty when no results found', async () => {
      const emptyResponse = {
        ...mockServiceListResponse,
        services: [],
      }
      mockApi.services.list.query.mockResolvedValue(emptyResponse)

      const { result } = renderHook(
        () => useServiceSearch('nonexistent'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isEmpty).toBe(true)
      })

      expect(result.current.services).toHaveLength(0)
    })
  })

  describe('usePopularServices', () => {
    it('should fetch popular services', async () => {
      mockApi.services.list.query.mockResolvedValue(mockServiceListResponse)

      const { result } = renderHook(
        () => usePopularServices(12),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.services).toHaveLength(1)
      })

      expect(mockApi.services.list.query).toHaveBeenCalledWith({
        sortBy: 'popularity',
        limit: 12,
      })
    })
  })

  describe('useServicesByCategory', () => {
    it('should fetch services by category', async () => {
      mockApi.services.list.query.mockResolvedValue(mockServiceListResponse)

      const { result } = renderHook(
        () => useServicesByCategory('development'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.services).toHaveLength(1)
      })

      expect(mockApi.services.list.query).toHaveBeenCalledWith({
        categories: ['development'],
      })
    })

    it('should not fetch when categoryId is empty', () => {
      const { result } = renderHook(
        () => useServicesByCategory(''),
        { wrapper: createWrapper() }
      )

      expect(result.current.services).toHaveLength(0)
      expect(mockApi.services.list.query).not.toHaveBeenCalled()
    })
  })

  describe('useServiceBrowserData', () => {
    it('should combine services and categories data', async () => {
      mockApi.services.list.query.mockResolvedValue(mockServiceListResponse)
      mockApi.categories.list.query.mockResolvedValue({ categories: [mockCategory] })

      const { result } = renderHook(
        () => useServiceBrowserData({}),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.services).toHaveLength(1)
        expect(result.current.categories).toHaveLength(1)
      })

      expect(result.current.services[0]).toEqual(mockService)
      expect(result.current.categories[0]).toEqual(mockCategory)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.hasError).toBe(false)
    })

    it('should handle loading states correctly', async () => {
      // Create a promise that we can resolve later
      let resolveServices: (value: any) => void
      let resolveCategories: (value: any) => void
      
      const servicesPromise = new Promise(resolve => {
        resolveServices = resolve
      })
      const categoriesPromise = new Promise(resolve => {
        resolveCategories = resolve
      })

      mockApi.services.list.query.mockReturnValue(servicesPromise)
      mockApi.categories.list.query.mockReturnValue(categoriesPromise)

      const { result } = renderHook(
        () => useServiceBrowserData({}),
        { wrapper: createWrapper() }
      )

      // Initially loading
      expect(result.current.isLoading).toBe(true)
      expect(result.current.isLoadingServices).toBe(true)
      expect(result.current.isLoadingCategories).toBe(true)

      // Resolve services first
      resolveServices(mockServiceListResponse)
      
      await waitFor(() => {
        expect(result.current.isLoadingServices).toBe(false)
      })

      expect(result.current.isLoading).toBe(true) // Still loading categories
      expect(result.current.isLoadingCategories).toBe(true)

      // Resolve categories
      resolveCategories({ categories: [mockCategory] })
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isLoadingCategories).toBe(false)
    })

    it('should provide refetch functions', async () => {
      mockApi.services.list.query.mockResolvedValue(mockServiceListResponse)
      mockApi.categories.list.query.mockResolvedValue({ categories: [mockCategory] })

      const { result } = renderHook(
        () => useServiceBrowserData({}),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.services).toHaveLength(1)
      })

      // Test refetch functions exist
      expect(typeof result.current.refetchServices).toBe('function')
      expect(typeof result.current.refetchCategories).toBe('function')
      expect(typeof result.current.refetchAll).toBe('function')
    })
  })

  describe('error handling', () => {
    it('should handle service list errors', async () => {
      const error = new Error('Failed to fetch services')
      mockApi.services.list.query.mockRejectedValue(error)

      const { result } = renderHook(
        () => useServiceList(),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      expect(result.current.services).toHaveLength(0)
      expect(result.current.isLoadingError).toBe(true)
    })

    it('should handle categories errors', async () => {
      const error = new Error('Failed to fetch categories')
      mockApi.categories.list.query.mockRejectedValue(error)

      const { result } = renderHook(
        () => useCategories(),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      expect(result.current.categories).toHaveLength(0)
    })
  })
})