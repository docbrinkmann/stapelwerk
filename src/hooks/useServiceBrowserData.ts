import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useEffect } from 'react'
import { api } from '@/trpc/client'
import { serviceBrowserKeys } from '@/lib/query/query-client'
import { useServiceBrowserStore } from '@/store/service-browser'
import { useServiceBrowserUrl } from '@/hooks/useServiceBrowserURL'
import type { 
  ServiceFilterState
} from '@/types/service-browser'

/**
 * Enhanced service browser data hooks with comprehensive filter integration
 * Connects UI state to tRPC endpoints with full search and filter support
 */

interface ServiceQueryParams {
  search?: string
  categories?: string[]
  pricingTypes?: string[]
  companySize?: string[]
  minPopularity?: number | null
  hasFreeTier?: boolean | null
  sortBy?: string
  limit?: number
  cursor?: string
}

/**
 * Transforms store filters to tRPC query parameters
 */
function transformFiltersToQueryParams(
  searchQuery: string | null | undefined,
  filters: ServiceFilterState | null | undefined,
  sortBy: string | null | undefined,
  limit: number = 24
): ServiceQueryParams & Record<string, any> {
  const safeSearch = (searchQuery ?? '').trim()
  const f = (filters ?? {
    categories: [],
    pricingTypes: [],
    companySize: [],
    minPopularity: null,
    hasFreeTier: null,
  }) as Partial<ServiceFilterState> & { features?: string[]; integrations?: string[] }

  const params: any = {
    search: safeSearch || undefined,
    categories: (f.categories && f.categories.length > 0) ? f.categories : undefined,
    pricingTypes: (f.pricingTypes && f.pricingTypes.length > 0) ? f.pricingTypes : undefined,
    companySize: (f.companySize && f.companySize.length > 0) ? f.companySize : undefined,
    features: (f.features && f.features.length > 0) ? f.features : undefined,
    integrations: (f.integrations && f.integrations.length > 0) ? f.integrations : undefined,
    minPopularity: typeof f.minPopularity === 'number' ? f.minPopularity : undefined,
    hasFreeTier: typeof f.hasFreeTier === 'boolean' ? f.hasFreeTier : undefined,
    sortBy: (sortBy && sortBy !== 'popularity') ? sortBy : undefined,
    limit,
  }

  // Remove null/undefined keys
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
}

/**
 * Hook for comprehensive service browser data with store integration
 */
export const useServiceBrowserData = () => {
  const {
    searchQuery,
    activeFilters,
    sortBy,
    itemsPerPage,
    isSearchMode,
    setError,
    setLoading,
  } = useServiceBrowserStore()

  // Initialize URL synchronization
  const { isInitialized } = useServiceBrowserUrl()

  // Transform store state to query parameters
  const queryParams = useMemo(() => {
    return transformFiltersToQueryParams(
      searchQuery,
      activeFilters,
      sortBy,
      itemsPerPage
    )
  }, [searchQuery, activeFilters, sortBy, itemsPerPage])

  // Generate query key based on all filter parameters
  const queryKey = useMemo(() => {
    const safeQuery = (searchQuery ?? '').trim()
    if (isSearchMode && safeQuery) {
      return serviceBrowserKeys.searchResults(safeQuery, queryParams)
    }
    return serviceBrowserKeys.servicesInfinite(queryParams)
  }, [isSearchMode, searchQuery, queryParams])

  // Main infinite query for services
  const {
    data,
    error,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isFetching,
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      try {
        const params = {
          ...queryParams,
          cursor: pageParam || undefined,
        }
        // Clean params (drop null/undefined)
        const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
        
        setLoading?.(true)
        
        // Call tRPC service list endpoint with comprehensive filters
        const response = await api.services.list.query(cleaned)
        
        // Map response to expected structure
        return {
          services: response.services || [],
          pagination: {
            totalCount: response.total || 0,
            hasNextPage: response.hasMore || false,
            cursor: response.nextCursor || undefined,
          },
          appliedFilters: queryParams,
          resultMode: isSearchMode ? 'search' : 'browse',
        }
      } catch (err) {
        setError?.(err as any)
        throw err
      } finally {
        setLoading?.(false)
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasNextPage ? lastPage.pagination.cursor : undefined
    },
    enabled: isInitialized, // Only fetch after URL sync is initialized
    staleTime: isSearchMode ? 2 * 60 * 1000 : 5 * 60 * 1000, // 2min for search, 5min for browse
    refetchOnWindowFocus: false,
    retry: (failureCount, error: any) => {
      // Don't retry on validation errors
      if (error?.data?.code === 'BAD_REQUEST') return false
      return failureCount < 2
    },
  })

  // Flatten paginated results
  const services = useMemo(() => {
    return data?.pages.flatMap(page => page.services) || []
  }, [data])

  // Get metadata from first page
  const totalCount = data?.pages[0]?.pagination.totalCount || 0
  const resultMode = data?.pages[0]?.resultMode || 'browse'
  const isEmpty = !isLoading && !isFetching && services.length === 0

  // Reflect total results in store for a11y announcements
  useEffect(() => {
    try {
      // setTotalResults if available on store
      const { setTotalResults } = useServiceBrowserStore.getState() as any
      if (typeof setTotalResults === 'function') setTotalResults(totalCount)
    } catch {}
  }, [totalCount])

  // Update store error state
  useEffect(() => {
    if (error) {
      setError?.(error instanceof Error ? error.message : 'Unknown error')
    } else if (!isLoading && !isFetching) {
      setError?.(null)
    }
  }, [error, isLoading, isFetching, setError])

  return {
    services,
    totalCount,
    error,
    isLoading,
    isFetching,
    isLoadingMore: isFetchingNextPage,
    hasNextPage: !!hasNextPage,
    isEmpty,
    resultMode,
    loadMore: fetchNextPage,
    refetch,
    queryKey,
    appliedFilters: queryParams,
  }
}

/**
 * Hook for service categories with service counts
 */
export const useServiceCategories = () => {
  const { setError } = useServiceBrowserStore()

  const {
    data: categories = [],
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: serviceBrowserKeys.categoriesList({}),
    queryFn: async () => {
      try {
        const response = await api.categories.list.query({
          cursor: undefined,
          limit: 100,
          withServiceCount: true,
        })
        return response.categories || []
      } catch (err) {
        setError?.(err as any)
        throw err
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  })

  // Update store error state
  useEffect(() => {
    if (error) {
      setError?.(error instanceof Error ? error.message : 'Category fetch failed')
    }
  }, [error, setError])

  return {
    categories,
    error,
    isLoading,
    refetch,
  }
}

/**
 * Hook for single service with error handling
 */
export const useServiceDetail = (serviceId?: string) => {
  const { setError } = useServiceBrowserStore()

  const {
    data: service,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: serviceBrowserKeys.service(serviceId || ''),
    queryFn: async () => {
      if (!serviceId) return null
      
      try {
        const id = parseInt(serviceId)
        if (isNaN(id)) throw new Error('Invalid service ID')
        
        return await api.services.get.query({ id })
      } catch (err) {
        setError?.(err as any)
        throw err
      }
    },
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  return {
    service,
    error,
    isLoading,
    refetch,
  }
}

/**
 * Hook for service analytics and recommendations
 */
export const useServiceAnalytics = () => {
  const { activeFilters } = useServiceBrowserStore()

  // Get popular services
  const popularServices = useQuery({
    queryKey: serviceBrowserKeys.servicesList({ sortBy: 'popularity', limit: 12 }),
    queryFn: async () => {
      const response = await api.services.list.query({
        sortBy: 'popularity',
        limit: 12,
      })
      return response.services || []
    },
    staleTime: 15 * 60 * 1000,
  })

  // Get related services based on current filters
  const relatedServices = useQuery({
    queryKey: serviceBrowserKeys.servicesList({ categories: activeFilters.categories }),
    queryFn: async () => {
      if (activeFilters.categories.length === 0) return []
      
      const response = await api.services.list.query({
        categories: activeFilters.categories,
        limit: 6,
      })
      return response.services || []
    },
    enabled: activeFilters.categories.length > 0,
    staleTime: 10 * 60 * 1000,
  })

  return {
    popularServices: popularServices.data || [],
    relatedServices: relatedServices.data || [],
    isLoadingPopular: popularServices.isLoading,
    isLoadingRelated: relatedServices.isLoading,
    refetchPopular: popularServices.refetch,
    refetchRelated: relatedServices.refetch,
  }
}

/**
 * Hook for service prefetching on hover
 */
import { useQueryClient } from '@tanstack/react-query'

export const useServicePrefetch = () => {
  const queryClient = useQueryClient()
  return useCallback((serviceId: string) => {
    if (!serviceId) return
    const idNum = Number(serviceId)
    if (!Number.isFinite(idNum)) return
    queryClient.prefetchQuery({
      queryKey: serviceBrowserKeys.service(serviceId),
      queryFn: async () => {
        return await api.services.get.query({ id: idNum })
      },
      staleTime: 5 * 60 * 1000,
    })
  }, [queryClient])
}

// Removed unused hooks: useFilterStatistics and useComprehensiveServiceData
// These hooks were never imported/used in the codebase and contained mock data
// The service browser filters work correctly without filter statistics
// If filter statistics are needed in the future, they can be implemented as:
//   - Real-time calculation from service queries
//   - Dedicated tRPC endpoint with Prisma aggregations
//   - Client-side computation in useServiceBrowserData hook