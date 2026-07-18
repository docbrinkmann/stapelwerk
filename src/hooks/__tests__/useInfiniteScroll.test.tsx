import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import {
  useInfiniteServiceScroll,
  useInfiniteSearchScroll,
  useInfiniteServiceBrowserScroll,
  useVirtualInfiniteScroll,
  useInfiniteScrollUI,
} from '../useInfiniteScroll'
import { useServiceBrowserStore } from '@/store/service-browser'
import * as useServiceData from '../useServiceData'
import * as useIntersectionObserver from '../useIntersectionObserver'
import type { Service } from '@/types/service-browser'

// Mock dependencies
vi.mock('../useServiceData')
vi.mock('../useIntersectionObserver')
vi.mock('@/store/service-browser')

const mockUseServiceData = useServiceData as vi.MockedFunction<typeof useServiceData>
const mockUseIntersectionObserver = useIntersectionObserver as vi.MockedFunction<typeof useIntersectionObserver>
const mockUseServiceBrowserStore = useServiceBrowserStore as MockedFunctionFunction<typeof useServiceBrowserStore>

// Mock service data
const mockService: Service = {
  id: 'service-1',
  name: 'Test Service',
  description: 'A test service',
  category: 'development',
  subcategory: 'backend',
  tags: ['test'],
  pricing: { type: 'free' },
  features: [],
  integrations: [],
  documentation: {
    quickStart: 'https://docs.example.com',
    apiReference: 'https://docs.example.com/api',
    examples: [],
  },
  company: {
    name: 'Test Company',
    founded: 2020,
    headquarters: 'San Francisco',
    website: 'https://testcompany.com',
  },
  metrics: {
    popularity: 4.0,
    reliability: 99.0,
    performance: 4.0,
    documentation: 4.0,
    support: 4.0,
  },
  status: 'active',
  lastUpdated: '2024-01-01T00:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
}

// Test wrapper
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

describe('useInfiniteScroll hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock implementations
    mockUseIntersectionObserver.useIntersectionObserver.mockReturnValue({
      isIntersecting: false,
    })
    
    mockUseServiceBrowserStore.mockReturnValue({
      searchParams: {},
      isSearchMode: false,
    })
  })

  describe('useInfiniteServiceScroll', () => {
    it('should initialize with correct data', async () => {
      const mockServiceListReturn = {
        services: [mockService],
        totalCount: 1,
        isLoading: false,
        isLoadingMore: false,
        hasNextPage: true,
        loadMore: vi.fn(),
        error: null,
        refetch: vi.fn(),
      }

      mockUseServiceData.useServiceList.mockReturnValue(mockServiceListReturn)

      const { result } = renderHook(
        () => useInfiniteServiceScroll({}),
        { wrapper: createWrapper() }
      )

      expect(result.current.services).toEqual([mockService])
      expect(result.current.totalCount).toBe(1)
      expect(result.current.hasNextPage).toBe(true)
      expect(result.current.isEmpty).toBe(false)
      expect(result.current.hasError).toBe(false)
    })

    it('should handle automatic loading when intersecting', async () => {
      const loadMoreMock = vi.fn().mockResolvedValue(undefined)
      const mockServiceListReturn = {
        services: [mockService],
        totalCount: 2,
        isLoading: false,
        isLoadingMore: false,
        hasNextPage: true,
        loadMore: loadMoreMock,
        error: null,
        refetch: vi.fn(),
      }

      mockUseServiceData.useServiceList.mockReturnValue(mockServiceListReturn)
      mockUseIntersectionObserver.useIntersectionObserver.mockReturnValue({
        isIntersecting: true,
      })

      const { result } = renderHook(
        () => useInfiniteServiceScroll({}),
        { wrapper: createWrapper() }
      )

      // Wait for the auto-load to trigger
      await waitFor(() => {
        expect(loadMoreMock).toHaveBeenCalled()
      })
    })

    it('should not auto-load when disabled', async () => {
      const loadMoreMock = vi.fn()
      const mockServiceListReturn = {
        services: [mockService],
        totalCount: 2,
        isLoading: false,
        isLoadingMore: false,
        hasNextPage: true,
        loadMore: loadMoreMock,
        error: null,
        refetch: vi.fn(),
      }

      mockUseServiceData.useServiceList.mockReturnValue(mockServiceListReturn)
      mockUseIntersectionObserver.useIntersectionObserver.mockReturnValue({
        isIntersecting: true,
      })

      renderHook(
        () => useInfiniteServiceScroll({}, { disabled: true }),
        { wrapper: createWrapper() }
      )

      // Should not call loadMore when disabled
      await new Promise(resolve => setTimeout(resolve, 200))
      expect(loadMoreMock).not.toHaveBeenCalled()
    })

    it('should handle manual load more', async () => {
      const loadMoreMock = vi.fn().mockResolvedValue(undefined)
      const mockServiceListReturn = {
        services: [mockService],
        totalCount: 2,
        isLoading: false,
        isLoadingMore: false,
        hasNextPage: true,
        loadMore: loadMoreMock,
        error: null,
        refetch: vi.fn(),
      }

      mockUseServiceData.useServiceList.mockReturnValue(mockServiceListReturn)

      const { result } = renderHook(
        () => useInfiniteServiceScroll({}),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        await result.current.loadMore()
      })

      expect(loadMoreMock).toHaveBeenCalled()
    })

    it('should not load more when no next page', async () => {
      const loadMoreMock = vi.fn()
      const mockServiceListReturn = {
        services: [mockService],
        totalCount: 1,
        isLoading: false,
        isLoadingMore: false,
        hasNextPage: false,
        loadMore: loadMoreMock,
        error: null,
        refetch: vi.fn(),
      }

      mockUseServiceData.useServiceList.mockReturnValue(mockServiceListReturn)

      const { result } = renderHook(
        () => useInfiniteServiceScroll({}),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        await result.current.loadMore()
      })

      expect(loadMoreMock).not.toHaveBeenCalled()
    })

    it('should handle loading and error states', () => {
      const error = new Error('Loading failed')
      const mockServiceListReturn = {
        services: [],
        totalCount: 0,
        isLoading: true,
        isLoadingMore: false,
        hasNextPage: false,
        loadMore: vi.fn(),
        error,
        refetch: vi.fn(),
      }

      mockUseServiceData.useServiceList.mockReturnValue(mockServiceListReturn)

      const { result } = renderHook(
        () => useInfiniteServiceScroll({}),
        { wrapper: createWrapper() }
      )

      expect(result.current.isLoading).toBe(true)
      expect(result.current.hasError).toBe(true)
      expect(result.current.error).toBe(error)
      expect(result.current.isEmpty).toBe(false) // Not empty when loading
    })
  })

  describe('useInfiniteSearchScroll', () => {
    it('should handle search queries', async () => {
      const mockSearchReturn = {
        services: [mockService],
        isLoading: false,
        isLoadingMore: false,
        hasNextPage: true,
        loadMore: vi.fn(),
        error: null,
        refetch: vi.fn(),
        isEmpty: false,
      }

      mockUseServiceData.useServiceSearch.mockReturnValue(mockSearchReturn)

      const { result } = renderHook(
        () => useInfiniteSearchScroll('test query'),
        { wrapper: createWrapper() }
      )

      expect(result.current.services).toEqual([mockService])
      expect(result.current.isQueryValid).toBe(true)
      expect(result.current.isEmpty).toBe(false)
    })

    it('should not search with short queries', () => {
      const mockSearchReturn = {
        services: [],
        isLoading: false,
        isLoadingMore: false,
        hasNextPage: false,
        loadMore: vi.fn(),
        error: null,
        refetch: vi.fn(),
        isEmpty: true,
      }

      mockUseServiceData.useServiceSearch.mockReturnValue(mockSearchReturn)

      const { result } = renderHook(
        () => useInfiniteSearchScroll('t'),
        { wrapper: createWrapper() }
      )

      expect(result.current.isQueryValid).toBe(false)
    })

    it('should handle empty search results', () => {
      const mockSearchReturn = {
        services: [],
        isLoading: false,
        isLoadingMore: false,
        hasNextPage: false,
        loadMore: vi.fn(),
        error: null,
        refetch: vi.fn(),
        isEmpty: true,
      }

      mockUseServiceData.useServiceSearch.mockReturnValue(mockSearchReturn)

      const { result } = renderHook(
        () => useInfiniteSearchScroll('nonexistent query'),
        { wrapper: createWrapper() }
      )

      expect(result.current.isEmpty).toBe(true)
      expect(result.current.services).toHaveLength(0)
    })
  })

  describe('useInfiniteServiceBrowserScroll', () => {
    it('should use service scroll in browse mode', () => {
      mockUseServiceBrowserStore.mockReturnValue({
        searchParams: { categories: ['development'] },
        isSearchMode: false,
      })

      const mockServiceListReturn = {
        services: [mockService],
        totalCount: 1,
        isLoading: false,
        isLoadingMore: false,
        hasNextPage: false,
        loadMore: vi.fn(),
        error: null,
        refetch: vi.fn(),
      }

      mockUseServiceData.useServiceList.mockReturnValue(mockServiceListReturn)

      const { result } = renderHook(
        () => useInfiniteServiceBrowserScroll(),
        { wrapper: createWrapper() }
      )

      expect(result.current.mode).toBe('browse')
      expect(result.current.services).toEqual([mockService])
    })

    it('should use search scroll in search mode', () => {
      mockUseServiceBrowserStore.mockReturnValue({
        searchParams: { query: 'test' },
        isSearchMode: true,
      })

      const mockSearchReturn = {
        services: [mockService],
        isLoading: false,
        isLoadingMore: false,
        hasNextPage: false,
        loadMore: vi.fn(),
        error: null,
        refetch: vi.fn(),
        isEmpty: false,
      }

      mockUseServiceData.useServiceSearch.mockReturnValue(mockSearchReturn)

      const { result } = renderHook(
        () => useInfiniteServiceBrowserScroll(),
        { wrapper: createWrapper() }
      )

      expect(result.current.mode).toBe('search')
      expect(result.current.services).toEqual([mockService])
    })
  })

  describe('useVirtualInfiniteScroll', () => {
    it('should determine when to load more based on scroll position', () => {
      const loadMoreMock = vi.fn().mockResolvedValue(undefined)
      const items = [mockService]

      const { result } = renderHook(() =>
        useVirtualInfiniteScroll(items, true, loadMoreMock, { threshold: 0.8 })
      )

      // Should load more when scrolled 80% or more
      expect(result.current.shouldLoadMore(800, 1000, 200)).toBe(true)
      expect(result.current.shouldLoadMore(600, 1000, 200)).toBe(false)
    })

    it('should handle virtual scroll load more', async () => {
      const loadMoreMock = vi.fn().mockResolvedValue(undefined)
      const items = [mockService]

      const { result } = renderHook(() =>
        useVirtualInfiniteScroll(items, true, loadMoreMock)
      )

      await act(async () => {
        await result.current.handleVirtualLoadMore(800, 1000, 200)
      })

      expect(loadMoreMock).toHaveBeenCalled()
    })

    it('should not load more when no next page available', async () => {
      const loadMoreMock = vi.fn()
      const items = [mockService]

      const { result } = renderHook(() =>
        useVirtualInfiniteScroll(items, false, loadMoreMock)
      )

      await act(async () => {
        await result.current.handleVirtualLoadMore(800, 1000, 200)
      })

      expect(loadMoreMock).not.toHaveBeenCalled()
    })
  })

  describe('useInfiniteScrollUI', () => {
    it('should show correct UI states for loading', () => {
      const { result } = renderHook(() =>
        useInfiniteScrollUI(true, false, true, null, false)
      )

      expect(result.current.showLoadingSpinner).toBe(true)
      expect(result.current.showLoadingMore).toBe(false)
      expect(result.current.showLoadMoreButton).toBe(false)
      expect(result.current.showError).toBe(false)
      expect(result.current.showEmpty).toBe(false)
      expect(result.current.showEndMessage).toBe(false)
    })

    it('should show correct UI states for loading more', () => {
      const { result } = renderHook(() =>
        useInfiniteScrollUI(false, true, true, null, false)
      )

      expect(result.current.showLoadingSpinner).toBe(false)
      expect(result.current.showLoadingMore).toBe(true)
      expect(result.current.showLoadMoreButton).toBe(false)
    })

    it('should show load more button when has next page', () => {
      const { result } = renderHook(() =>
        useInfiniteScrollUI(false, false, true, null, false)
      )

      expect(result.current.showLoadMoreButton).toBe(true)
      expect(result.current.showEndMessage).toBe(false)
    })

    it('should show error state', () => {
      const error = new Error('Failed')
      const { result } = renderHook(() =>
        useInfiniteScrollUI(false, false, false, error, false)
      )

      expect(result.current.showError).toBe(true)
      expect(result.current.showLoadMoreButton).toBe(false)
    })

    it('should show empty state', () => {
      const { result } = renderHook(() =>
        useInfiniteScrollUI(false, false, false, null, true)
      )

      expect(result.current.showEmpty).toBe(true)
      expect(result.current.showLoadMoreButton).toBe(false)
    })

    it('should show end message when no more pages', () => {
      const { result } = renderHook(() =>
        useInfiniteScrollUI(false, false, false, null, false)
      )

      expect(result.current.showEndMessage).toBe(true)
      expect(result.current.showLoadMoreButton).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should handle load more errors gracefully', async () => {
      const loadMoreMock = vi.fn().mockRejectedValue(new Error('Network error'))
      const mockServiceListReturn = {
        services: [mockService],
        totalCount: 2,
        isLoading: false,
        isLoadingMore: false,
        hasNextPage: true,
        loadMore: loadMoreMock,
        error: null,
        refetch: vi.fn(),
      }

      mockUseServiceData.useServiceList.mockReturnValue(mockServiceListReturn)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation()

      const { result } = renderHook(
        () => useInfiniteServiceScroll({}),
        { wrapper: createWrapper() }
      )

      await act(async () => {
        await result.current.loadMore()
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading more services:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })
})