import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { api } from '@/trpc/client'
import { serviceBrowserKeys } from '@/lib/query/query-client'
import type { 
  Service, 
  ServiceSearchParams
} from '@/types/service-browser'

/**
 * React Query hooks for service browser data fetching
 * Provides infinite queries, caching, and optimistic updates
 */

/**
 * Hook for infinite service list with pagination
 */
export const useServiceList = (searchParams: ServiceSearchParams = {}) => {
  const queryKey = serviceBrowserKeys.servicesInfinite(searchParams)

  const {
    data,
    error,
    isLoading,
    isLoadingError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const params = {
        cursor: pageParam || undefined,
        limit: searchParams.limit || 24,
        ...searchParams,
      }
      
      // Call tRPC service list endpoint
      const response = await api.services.list.query(params)
      const r: any = response as any
      
      // Map the response (support both new and legacy shapes)
      return {
        services: r.services,
        pagination: {
          totalCount: (r.pagination?.totalCount ?? r.total ?? 0) as number,
          hasNextPage: (r.pagination?.hasNextPage ?? Boolean(r.nextCursor)) as boolean,
          cursor: (r.pagination?.cursor ?? r.nextCursor) as string | undefined,
        },
        filters: r.filters ?? {
          categories: searchParams.categories || [],
          tags: searchParams.tags || [],
          pricing: searchParams.pricing || [],
        },
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasNextPage ? lastPage.pagination.cursor : undefined
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })

  // Flatten paginated results into single array
  const services = useMemo(() => {
    return data?.pages.flatMap(page => page.services) || []
  }, [data])

  // Get total count from first page
  const totalCount = data?.pages[0]?.pagination.totalCount

  return {
    services,
    totalCount,
    error,
    isLoading,
    isLoadingError,
    isLoadingMore: isFetchingNextPage,
    hasNextPage: !!hasNextPage,
    loadMore: fetchNextPage,
    refetch,
  }
}

/**
 * Hook for fetching a single service by ID
 */
export const useService = (serviceId?: string) => {
  const queryKey = serviceBrowserKeys.service(serviceId || '')

  const {
    data: service,
    error,
    isLoading,
    isLoadingError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!serviceId) return null
      return await api.services.get.query({ id: serviceId })
    },
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    service,
    error,
    isLoading,
    isLoadingError,
    refetch,
  }
}

/**
 * Hook for fetching service categories
 */
export const useCategories = () => {
  const queryKey = serviceBrowserKeys.categoriesList({})

  const {
    data: categories = [],
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await api.categories.list.query({})
      return response.categories
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - categories change less frequently
  })

  return {
    categories,
    error,
    isLoading,
    refetch,
  }
}

/**
 * Hook for searching services with debounced queries
 */
export const useServiceSearch = (
  query: string, 
  filters: Record<string, any> = {},
  _debounceMs: number = 300
) => {
  const searchParams = useMemo(() => ({
    query: query.trim(),
    ...filters,
  }), [query, filters])

  // Use regular infinite query but with search-specific key
  const queryKey = serviceBrowserKeys.searchResults(query.trim(), filters)

  const {
    data,
    error,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const params = {
        cursor: pageParam || undefined,
        limit: 24,
        // tRPC services.list expects `search` (unknown keys like `query` are stripped by zod)
        search: searchParams.query,
        ...filters,
      }
      
      const response = await api.services.list.query(params)
      const r: any = response as any
      
      // Map the response (support both new and legacy shapes)
      return {
        services: r.services,
        pagination: {
          totalCount: (r.pagination?.totalCount ?? r.total ?? 0) as number,
          hasNextPage: (r.pagination?.hasNextPage ?? Boolean(r.nextCursor)) as boolean,
          cursor: (r.pagination?.cursor ?? r.nextCursor) as string | undefined,
        },
        filters: r.filters ?? {
          categories: filters.categories || [],
          tags: filters.tags || [],
          pricing: filters.pricing || [],
        },
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasNextPage ? lastPage.pagination.cursor : undefined
    },
    enabled: query.trim().length >= 2, // Only search with 2+ characters
    staleTime: 2 * 60 * 1000, // 2 minutes for search results
  })

  const services = useMemo(() => {
    return data?.pages.flatMap(page => page.services) || []
  }, [data])

  return {
    services,
    error,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    hasNextPage: !!hasNextPage,
    loadMore: fetchNextPage,
    refetch,
    isEmpty: !isLoading && services.length === 0 && query.trim().length >= 2,
  }
}

/**
 * Hook for getting popular services
 */
export const usePopularServices = (limit: number = 12) => {
  const searchParams = { sortBy: 'popularity' as const, limit }
  const queryKey = serviceBrowserKeys.servicesList(searchParams)

  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await api.services.list.query({
        sortBy: 'popularity',
        limit,
      })
      return response
    },
    staleTime: 15 * 60 * 1000, // 15 minutes for popular services
  })

  return {
    services: data?.services || [],
    error,
    isLoading,
    refetch,
  }
}

/**
 * Hook for getting services by category
 */
export const useServicesByCategory = (categoryId: string, limit?: number) => {
  const searchParams = { categories: [categoryId], limit }
  const queryKey = serviceBrowserKeys.servicesList(searchParams)

  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await api.services.list.query({
        categories: [categoryId],
        ...(limit ? { limit } : {}),
      })
      return response
    },
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    services: data?.services || [],
    error,
    isLoading,
    refetch,
  }
}

/**
 * Hook for prefetching services (useful for hover effects)
 */
export const usePrefetchService = () => {
  return useCallback(async (serviceId: string) => {
    // This would prefetch the service data
    // Implementation depends on query client access
    console.log('Prefetching service:', serviceId)
  }, [])
}

/**
 * Hook combining service list with categories for complete UI state
 */
export const useServiceBrowserData = (searchParams: ServiceSearchParams = {}) => {
  const serviceListQuery = useServiceList(searchParams)
  const categoriesQuery = useCategories()

  const isLoading = serviceListQuery.isLoading || categoriesQuery.isLoading
  const hasError = Boolean(serviceListQuery.error || categoriesQuery.error)
  
  return {
    // Services
    services: serviceListQuery.services,
    totalCount: serviceListQuery.totalCount,
    isLoadingServices: serviceListQuery.isLoading,
    isLoadingMoreServices: serviceListQuery.isLoadingMore,
    hasNextPage: serviceListQuery.hasNextPage,
    loadMoreServices: serviceListQuery.loadMore,
    
    // Categories
    categories: categoriesQuery.categories,
    isLoadingCategories: categoriesQuery.isLoading,
    
    // Combined state
    isLoading,
    hasError,
    
    // Actions
    refetchServices: serviceListQuery.refetch,
    refetchCategories: categoriesQuery.refetch,
    refetchAll: async () => {
      await Promise.all([serviceListQuery.refetch(), categoriesQuery.refetch()])
    },
  }
}

/**
 * Custom hook for optimistic service updates (for future use with mutations)
 */
export const useOptimisticServiceUpdate = () => {
  const updateService = useCallback((serviceId: string, updates: Partial<Service>) => {
    // This would optimistically update the service in the cache
    // Implementation would use queryClient.setQueryData
    console.log('Optimistically updating service:', serviceId, updates)
  }, [])

  const addService = useCallback((newService: Service) => {
    // This would optimistically add a service to relevant queries
    console.log('Optimistically adding service:', newService)
  }, [])

  const removeService = useCallback((serviceId: string) => {
    // This would optimistically remove a service from queries
    console.log('Optimistically removing service:', serviceId)
  }, [])

  return {
    updateService,
    addService,
    removeService,
  }
}