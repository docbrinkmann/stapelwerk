import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  useServiceBrowserStore,
  serviceBrowserSelectors,
  useServiceBrowserSelector
} from '@/stores/service-browser'
import type { Service } from '@/types/service-browser'

/**
 * Comprehensive tests for service browser state management
 * Tests Zustand store functionality, actions and selectors.
 *
 * NOTE: the store API changed during the service-browser refactor:
 * - service list state (loadedServices/hasNextPage/isLoadingMore) moved to
 *   React Query hooks and no longer lives in the store
 * - filters are managed through dedicated actions (setCategories, setTags, …)
 * - modal state lives under `modalState` (openServiceModal/closeServiceModal)
 * - URL sync is controlled via enableUrlSync/disableUrlSync + syncTo/FromUrl
 */

// Mock service data for testing (shape follows @/types/service-browser)
const mockService = {
  id: 'service-1',
  name: 'PostgreSQL',
  description: 'Powerful open-source database',
  category: 'database',
  subcategory: 'relational',
  tags: ['database', 'sql'],
  pricing: { type: 'free' },
  features: ['ACID compliance'],
  integrations: ['Grafana'],
  documentation: {
    quickStart: 'https://docs.example.com',
    apiReference: 'https://docs.example.com/api',
    examples: [],
  },
  company: {
    name: 'PostgreSQL Global Development Group',
    founded: 1996,
    headquarters: 'Worldwide',
    website: 'https://postgresql.org',
  },
  metrics: {
    popularity: 4.8,
    reliability: 99.9,
    performance: 4.5,
    documentation: 4.7,
    support: 4.2,
  },
  status: 'active',
  lastUpdated: '2025-01-01T00:00:00Z',
  createdAt: '2025-01-01T00:00:00Z',
} as unknown as Service

const defaultActiveFilters = {
  categories: [],
  tags: [],
  pricing: [],
  pricingTypes: [],
  popularity: null,
  minPopularity: null,
  resources: {},
  companySize: [],
  hasFreeTier: null,
}

describe('Service Browser State Management', () => {
  beforeEach(() => {
    // Reset the singleton store before each test
    act(() => {
      useServiceBrowserStore.getState().resetState()
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      expect(result.current.searchQuery).toBe('')
      expect(result.current.isSearchMode).toBe(false)
      expect(result.current.activeFilters).toEqual(defaultActiveFilters)
      expect(result.current.uiState.isLoading).toBe(false)
      expect(result.current.modalState.isOpen).toBe(false)
      expect(result.current.modalState.service).toBeNull()
      expect(result.current.viewMode).toBe('grid')
      expect(result.current.itemsPerPage).toBe(24)
      expect(result.current.urlSyncEnabled).toBe(true)
    })
  })

  describe('Search Actions', () => {
    it('should update search query', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setSearchQuery('postgres')
      })

      expect(result.current.searchQuery).toBe('postgres')
      expect(result.current.isSearchMode).toBe(true)
      expect(result.current.searchParams.query).toBe('postgres')
    })

    it('should clear search query', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      // Set initial search query
      act(() => {
        result.current.setSearchQuery('postgres')
      })

      expect(result.current.searchQuery).toBe('postgres')

      // Clear search
      act(() => {
        result.current.clearSearch()
      })

      expect(result.current.searchQuery).toBe('')
      expect(result.current.isSearchMode).toBe(false)
      expect(result.current.searchParams.query).toBeUndefined()
    })
  })

  describe('Filter Actions', () => {
    it('should set category filters', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setCategories(['database', 'web-server'])
      })

      expect(result.current.activeFilters.categories).toEqual(['database', 'web-server'])
      expect(result.current.searchParams.categories).toEqual(['database', 'web-server'])
    })

    it('should update individual filter types', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setTags(['sql'])
        result.current.setPopularityFilter(4)
      })

      expect(result.current.activeFilters.tags).toEqual(['sql'])
      expect(result.current.activeFilters.popularity).toBe(4)
    })

    it('should reset all filters', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      // Set some filters and search
      act(() => {
        result.current.setCategories(['database'])
        result.current.setSearchQuery('postgres')
      })

      expect(result.current.activeFilters.categories).toEqual(['database'])
      expect(result.current.searchQuery).toBe('postgres')

      // Reset filters
      act(() => {
        result.current.resetFilters()
      })

      expect(result.current.activeFilters).toEqual(defaultActiveFilters)
      expect(result.current.searchQuery).toBe('')
      expect(result.current.searchParams).toEqual({})
    })
  })

  describe('Loading State Actions', () => {
    it('should manage loading state', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setLoading(true)
      })
      expect(result.current.uiState.isLoading).toBe(true)

      act(() => {
        result.current.setLoading(false)
      })
      expect(result.current.uiState.isLoading).toBe(false)
    })

    it('should manage error state', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setError('Something went wrong')
      })
      expect(result.current.uiState.error).toBe('Something went wrong')

      act(() => {
        result.current.setError(null)
      })
      expect(result.current.uiState.error).toBeNull()
    })
  })

  describe('Modal Actions', () => {
    it('should open modal with service', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.openServiceModal(mockService)
      })

      expect(result.current.modalState.service).toEqual(mockService)
      expect(result.current.modalState.isOpen).toBe(true)
    })

    it('should close modal and clear selected service', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      // Open modal first
      act(() => {
        result.current.openServiceModal(mockService)
      })

      expect(result.current.modalState.isOpen).toBe(true)
      expect(result.current.modalState.service).toEqual(mockService)

      // Close modal
      act(() => {
        result.current.closeServiceModal()
      })

      expect(result.current.modalState.isOpen).toBe(false)
      expect(result.current.modalState.service).toBeNull()
    })

    it('should manage modal loading and error state', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setModalLoading(true)
      })
      expect(result.current.modalState.isLoading).toBe(true)

      act(() => {
        result.current.setModalError('Failed to load service')
      })
      expect(result.current.modalState.error).toBe('Failed to load service')
    })
  })

  describe('View Actions', () => {
    it('should set view mode', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      expect(result.current.viewMode).toBe('grid')

      act(() => {
        result.current.setViewMode('list')
      })

      expect(result.current.viewMode).toBe('list')
    })

    it('should set items per page', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      expect(result.current.itemsPerPage).toBe(24)

      act(() => {
        result.current.setItemsPerPage(48)
      })

      expect(result.current.itemsPerPage).toBe(48)
      expect(result.current.searchParams.limit).toBe(48)
    })
  })

  describe('URL Synchronization', () => {
    it('should manage URL sync state', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      expect(result.current.urlSyncEnabled).toBe(true)

      act(() => {
        result.current.disableUrlSync()
      })
      expect(result.current.urlSyncEnabled).toBe(false)

      act(() => {
        result.current.enableUrlSync()
      })
      expect(result.current.urlSyncEnabled).toBe(true)
    })
  })

  describe('Utility Actions', () => {
    it('should reset store to initial state', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      // Change some state
      act(() => {
        result.current.setSearchQuery('test')
        result.current.setCategories(['database'])
        result.current.openServiceModal(mockService)
        result.current.setViewMode('list')
      })

      // Verify state changed
      expect(result.current.searchQuery).toBe('test')
      expect(result.current.activeFilters.categories).toEqual(['database'])
      expect(result.current.modalState.isOpen).toBe(true)
      expect(result.current.viewMode).toBe('list')

      // Reset store
      act(() => {
        result.current.resetState()
      })

      // Verify back to initial state
      expect(result.current.searchQuery).toBe('')
      expect(result.current.activeFilters).toEqual(defaultActiveFilters)
      expect(result.current.modalState.isOpen).toBe(false)
      expect(result.current.modalState.service).toBeNull()
      expect(result.current.viewMode).toBe('grid')
    })

    it('should count active filters', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      expect(result.current.getActiveFilterCount()).toBe(0)

      act(() => {
        result.current.setCategories(['database'])
        result.current.setTags(['sql'])
        result.current.setPopularityFilter(4)
      })

      expect(result.current.getActiveFilterCount()).toBe(3)
    })
  })

  describe('Selectors', () => {
    it('should return search and filters state', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setSearchQuery('postgres')
        result.current.setCategories(['database'])
      })

      const searchAndFilters = serviceBrowserSelectors.searchAndFilters()
      expect(searchAndFilters.searchQuery).toBe('postgres')
      expect(searchAndFilters.activeFilters.categories).toEqual(['database'])
    })

    it('should return loading state', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setLoading(true)
      })

      const loadingState = serviceBrowserSelectors.loadingState()
      expect(loadingState.isLoading).toBe(true)
      expect(loadingState.isLoadingMore).toBe(false)
      expect(loadingState.hasNextPage).toBe(false)
    })

    it('should return modal state', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.openServiceModal(mockService)
      })

      const modalState = serviceBrowserSelectors.modalState()
      expect(modalState.selectedService).toEqual(mockService)
      expect(modalState.isModalOpen).toBe(true)
    })

    it('should return view preferences', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setViewMode('list')
        result.current.setItemsPerPage(48)
      })

      const viewPreferences = serviceBrowserSelectors.viewPreferences()
      expect(viewPreferences.viewMode).toBe('list')
      expect(viewPreferences.servicesPerPage).toBe(48)
    })

    it('should detect active filters', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      // No filters initially
      expect(serviceBrowserSelectors.hasActiveFilters()).toBe(false)

      // Add search query
      act(() => {
        result.current.setSearchQuery('postgres')
      })
      expect(serviceBrowserSelectors.hasActiveFilters()).toBe(true)

      // Clear search, add filter
      act(() => {
        result.current.setSearchQuery('')
        result.current.setCategories(['database'])
      })
      expect(serviceBrowserSelectors.hasActiveFilters()).toBe(true)

      // Clear all
      act(() => {
        result.current.resetFilters()
      })
      expect(serviceBrowserSelectors.hasActiveFilters()).toBe(false)
    })
  })

  describe('Selector Hook', () => {
    it('should provide selector function', () => {
      // Test that selector function exists and works with direct store access
      const searchQuery = useServiceBrowserStore.getState().searchQuery
      const isLoading = useServiceBrowserStore.getState().uiState.isLoading

      expect(searchQuery).toBe('')
      expect(isLoading).toBe(false)

      // Test selector function exists and subscribes correctly
      expect(typeof useServiceBrowserSelector).toBe('function')
      const { result } = renderHook(() =>
        useServiceBrowserSelector((state) => state.viewMode)
      )
      expect(result.current).toBe('grid')
    })
  })
})
