import { QueryClient } from '@tanstack/react-query'

/**
 * Configuration for TanStack Query client
 * Optimized for service browser functionality with appropriate caching and retry strategies
 */

export const queryClientConfig = {
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes to align with Service Catalog API cache duration
      staleTime: 5 * 60 * 1000, // 5 minutes
      
      // Exponential backoff retry for transient failures (up to 3 attempts)
      retry: 3,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000),
      
      // Avoid surprise refetch on focus during browsing
      refetchOnWindowFocus: false,
      
      // Refetch when connection is restored to recover gracefully
      refetchOnReconnect: true,
      
      // Enable background refetching for stale data
      refetchIntervalInBackground: false,
      
      // Set network mode to handle offline scenarios
      networkMode: 'online' as const,
      
      // Enable garbage collection for unused queries
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      // Don't retry mutations by default to avoid duplicate operations
      retry: false,
      
      // Set network mode for mutations
      networkMode: 'online' as const,
    },
  },
}

/**
 * Create a new QueryClient instance with service browser specific configuration
 */
export const createServiceBrowserQueryClient = () => {
  return new QueryClient(queryClientConfig)
}

/**
 * Default query client instance for service browser
 * Use this for consistent configuration across the application
 */
export const serviceBrowserQueryClient = createServiceBrowserQueryClient()

/**
 * Query keys for service browser related queries
 * Centralized location for all query keys to ensure consistency
 */
export const serviceBrowserKeys = {
  all: ['serviceBrowser'] as const,
  
  services: () => [...serviceBrowserKeys.all, 'services'] as const,
  servicesList: (filters: Record<string, any>) => 
    [...serviceBrowserKeys.services(), 'list', filters] as const,
  servicesInfinite: (filters: Record<string, any>) => 
    [...serviceBrowserKeys.services(), 'infinite', filters] as const,
  service: (id: string) => [...serviceBrowserKeys.services(), id] as const,
  
  categories: () => [...serviceBrowserKeys.all, 'categories'] as const,
  categoriesList: (filters: Record<string, any>) => 
    [...serviceBrowserKeys.categories(), 'list', filters] as const,
  category: (id: string) => [...serviceBrowserKeys.categories(), id] as const,
  
  search: () => [...serviceBrowserKeys.all, 'search'] as const,
  searchResults: (query: string, filters: Record<string, any>) => 
    [...serviceBrowserKeys.search(), query, filters] as const,
} as const

/**
 * Type definitions for query keys
 */
export type ServiceBrowserQueryKey = typeof serviceBrowserKeys[keyof typeof serviceBrowserKeys]