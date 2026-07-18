import { useServiceBrowserStore, type ServiceBrowserStore } from '@/store/service-browser'
export { useServiceBrowserStore } from '@/store/service-browser'
export type { ServiceBrowserStore } from '@/store/service-browser'

/**
 * Selectors for common state combinations
 * Helps with performance by preventing unnecessary re-renders
 */
export const serviceBrowserSelectors = {
  // Get current search and filter state
  searchAndFilters: () => {
    const { searchQuery, activeFilters } = useServiceBrowserStore.getState()
    return { searchQuery, activeFilters }
  },

  // Get loading states (compat layer for tests that expect these keys)
  loadingState: () => {
    const state: any = useServiceBrowserStore.getState()
    return {
      isLoading: state.uiState?.isLoading ?? false,
      isLoadingMore: state.isLoadingMore ?? false,
      hasNextPage: state.hasNextPage ?? false,
    }
  },

  // Get modal state
  modalState: () => {
    const state: any = useServiceBrowserStore.getState()
    return { selectedService: state.modalState?.service ?? null, isModalOpen: state.modalState?.isOpen ?? false }
  },

  // Get view preferences
  viewPreferences: () => {
    const state: any = useServiceBrowserStore.getState()
    return { viewMode: state.viewMode, servicesPerPage: state.itemsPerPage }
  },

  // Check if any filters are active
  hasActiveFilters: () => {
    const { searchQuery, activeFilters } = useServiceBrowserStore.getState()
    return (
      searchQuery.length > 0 ||
      Object.values(activeFilters).some((v: any) => {
        if (Array.isArray(v)) return v.length > 0
        // Plain objects (e.g. `resources: {}`) only count when non-empty
        if (v !== null && typeof v === 'object') return Object.keys(v).length > 0
        return v != null
      })
    )
  },
}

/**
 * Hook for subscribing to specific parts of the store
 * Prevents unnecessary re-renders by only subscribing to needed state
 */
export const useServiceBrowserSelector = <T>(
  selector: (state: ServiceBrowserStore) => T
) => useServiceBrowserStore(selector)
