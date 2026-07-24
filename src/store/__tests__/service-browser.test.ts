import { renderHook, act } from '@testing-library/react'
import { useServiceBrowserStore } from '../service-browser'
import type { Service } from '@/types/service-browser'

// Mock window.history for URL sync tests
const mockReplaceState = vi.fn()
const mockLocation = {
  pathname: '/services',
  search: '',
  href: 'http://localhost:3000/services',
}

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
})

Object.defineProperty(window, 'history', {
  value: {
    replaceState: mockReplaceState,
  },
  writable: true,
})

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
    freeQuota: '1000 requests/month',
  },
  features: ['REST API', 'Authentication'],
  integrations: ['GitHub', 'Slack'],
  documentation: {
    quickStart: 'https://docs.example.com',
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

describe('ServiceBrowserStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocation.search = ''
    mockLocation.href = 'http://localhost:3000/services'

    // The zustand store is a module-level singleton — reset it so state
    // set in one test doesn't leak into the next.
    act(() => {
      useServiceBrowserStore.getState().resetState()
    })
  })

  describe('Initial State', () => {
    it('should have correct default state', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      expect(result.current.searchQuery).toBe('')
      expect(result.current.isSearchMode).toBe(false)
      expect(result.current.activeFilters).toEqual({
        categories: [],
        tags: [],
        pricing: [],
        pricingTypes: [],
        popularity: null,
        minPopularity: null,
        resources: {},
        companySize: [],
        hasFreeTier: null,
      })
      expect(result.current.sortBy).toBe('popularity')
      expect(result.current.viewMode).toBe('grid')
      expect(result.current.currentPage).toBe(1)
      expect(result.current.itemsPerPage).toBe(24)
      expect(result.current.urlSyncEnabled).toBe(true)
      expect(result.current.modalState.isOpen).toBe(false)
      expect(result.current.uiState.isLoading).toBe(false)
    })
  })

  describe('Search Actions', () => {
    it('should set search query correctly', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setSearchQuery('test query')
      })

      expect(result.current.searchQuery).toBe('test query')
      expect(result.current.isSearchMode).toBe(true)
      expect(result.current.searchParams.query).toBe('test query')
      expect(result.current.currentPage).toBe(1) // Should reset pagination
    })

    it('should handle empty search query', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setSearchQuery('  ')
      })

      expect(result.current.searchQuery).toBe('')
      expect(result.current.isSearchMode).toBe(false)
      expect(result.current.searchParams.query).toBeUndefined()
    })

    it('should clear search correctly', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      // Set search first
      act(() => {
        result.current.setSearchQuery('test')
      })

      expect(result.current.searchQuery).toBe('test')
      expect(result.current.isSearchMode).toBe(true)

      // Clear search
      act(() => {
        result.current.clearSearch()
      })

      expect(result.current.searchQuery).toBe('')
      expect(result.current.isSearchMode).toBe(false)
      expect(result.current.searchParams.query).toBeUndefined()
      expect(result.current.currentPage).toBe(1)
    })

    it('should toggle search mode', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setSearchMode(true)
      })

      expect(result.current.isSearchMode).toBe(true)

      act(() => {
        result.current.setSearchMode(false)
      })

      expect(result.current.isSearchMode).toBe(false)
      expect(result.current.searchQuery).toBe('')
      expect(result.current.searchParams.query).toBeUndefined()
    })
  })

  describe('Filter Actions', () => {
    it('should set single category', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setCategory('development')
      })

      expect(result.current.activeFilters.categories).toEqual(['development'])
      expect(result.current.searchParams.categories).toEqual(['development'])
      expect(result.current.currentPage).toBe(1)
    })

    it('should clear category when set to null', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      // Set category first
      act(() => {
        result.current.setCategory('development')
      })

      expect(result.current.activeFilters.categories).toEqual(['development'])

      // Clear category
      act(() => {
        result.current.setCategory(null)
      })

      expect(result.current.activeFilters.categories).toEqual([])
      expect(result.current.searchParams.categories).toBeUndefined()
    })

    it('should set multiple categories', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setCategories(['development', 'devops'])
      })

      expect(result.current.activeFilters.categories).toEqual(['development', 'devops'])
      expect(result.current.searchParams.categories).toEqual(['development', 'devops'])
    })

    it('should add category without duplicates', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.addCategory('development')
      })

      expect(result.current.activeFilters.categories).toEqual(['development'])

      // Try to add same category again
      act(() => {
        result.current.addCategory('development')
      })

      expect(result.current.activeFilters.categories).toEqual(['development']) // Should not duplicate

      // Add different category
      act(() => {
        result.current.addCategory('devops')
      })

      expect(result.current.activeFilters.categories).toEqual(['development', 'devops'])
    })

    it('should remove category correctly', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      // Set initial categories
      act(() => {
        result.current.setCategories(['development', 'devops', 'database'])
      })

      // Remove one category
      act(() => {
        result.current.removeCategory('devops')
      })

      expect(result.current.activeFilters.categories).toEqual(['development', 'database'])
      expect(result.current.searchParams.categories).toEqual(['development', 'database'])
    })

    it('should handle tags correctly', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setTags(['api', 'rest'])
      })

      expect(result.current.activeFilters.tags).toEqual(['api', 'rest'])
      expect(result.current.searchParams.tags).toEqual(['api', 'rest'])

      // Add tag
      act(() => {
        result.current.addTag('graphql')
      })

      expect(result.current.activeFilters.tags).toEqual(['api', 'rest', 'graphql'])

      // Remove tag
      act(() => {
        result.current.removeTag('rest')
      })

      expect(result.current.activeFilters.tags).toEqual(['api', 'graphql'])
    })

    it('should set pricing filters', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setPricingFilters(['free', 'freemium'])
      })

      expect(result.current.activeFilters.pricing).toEqual(['free', 'freemium'])
      expect(result.current.searchParams.pricing).toEqual(['free', 'freemium'])
    })

    it('should set popularity filter', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setPopularityFilter(4.0)
      })

      expect(result.current.activeFilters.popularity).toBe(4.0)
      expect(result.current.searchParams.minPopularity).toBe(4.0)

      // Clear popularity filter
      act(() => {
        result.current.setPopularityFilter(null)
      })

      expect(result.current.activeFilters.popularity).toBe(null)
      expect(result.current.searchParams.minPopularity).toBeUndefined()
    })

    it('should set resource filters', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setResourceFilters({ minCpu: 2, minMemory: 4 })
      })

      expect(result.current.activeFilters.resources).toEqual({ minCpu: 2, minMemory: 4 })
      expect(result.current.searchParams.minCpu).toBe(2)
      expect(result.current.searchParams.minMemory).toBe(4)
    })

    it('should clear all filters but keep search and sort', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      // Set up some filters and search
      act(() => {
        result.current.setSearchQuery('test')
        result.current.setCategories(['development'])
        result.current.setTags(['api'])
        result.current.setPricingFilters(['free'])
        result.current.setPopularityFilter(4.0)
        result.current.setSortBy('alphabetical')
      })

      // Clear all filters
      act(() => {
        result.current.clearAllFilters()
      })

      expect(result.current.activeFilters).toEqual({
        categories: [],
        tags: [],
        pricing: [],
        pricingTypes: [],
        popularity: null,
        minPopularity: null,
        resources: {},
        companySize: [],
        hasFreeTier: null,
      })
      expect(result.current.searchQuery).toBe('test') // Should keep search
      expect(result.current.sortBy).toBe('alphabetical') // Should keep sort
      expect(result.current.currentPage).toBe(1)
    })

    it('should reset all filters including search', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      // Set up some state
      act(() => {
        result.current.setSearchQuery('test')
        result.current.setCategories(['development'])
        result.current.setSortBy('alphabetical')
      })

      // Reset filters
      act(() => {
        result.current.resetFilters()
      })

      expect(result.current.activeFilters).toEqual({
        categories: [],
        tags: [],
        pricing: [],
        pricingTypes: [],
        popularity: null,
        minPopularity: null,
        resources: {},
        companySize: [],
        hasFreeTier: null,
      })
      expect(result.current.searchQuery).toBe('')
      expect(result.current.isSearchMode).toBe(false)
      expect(result.current.sortBy).toBe('popularity') // Reset to default
      expect(result.current.searchParams).toEqual({})
    })
  })

  describe('Sort and View Actions', () => {
    it('should set sort by', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setSortBy('alphabetical')
      })

      expect(result.current.sortBy).toBe('alphabetical')
      expect(result.current.searchParams.sortBy).toBe('alphabetical')
      expect(result.current.currentPage).toBe(1)
    })

    it('should set view mode', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setViewMode('list')
      })

      expect(result.current.viewMode).toBe('list')
    })

    it('should set items per page', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setItemsPerPage(48)
      })

      expect(result.current.itemsPerPage).toBe(48)
      expect(result.current.searchParams.limit).toBe(48)
      expect(result.current.currentPage).toBe(1)
    })
  })

  describe('Modal Actions', () => {
    it('should open service modal', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.openServiceModal(mockService)
      })

      expect(result.current.modalState).toEqual({
        isOpen: true,
        service: mockService,
        isLoading: false,
        error: null,
      })
    })

    it('should close service modal', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      // Open modal first
      act(() => {
        result.current.openServiceModal(mockService)
      })

      expect(result.current.modalState.isOpen).toBe(true)

      // Close modal
      act(() => {
        result.current.closeServiceModal()
      })

      expect(result.current.modalState).toEqual({
        isOpen: false,
        service: null,
        isLoading: false,
        error: null,
      })
    })

    it('should set modal loading state', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setModalLoading(true)
      })

      expect(result.current.modalState.isLoading).toBe(true)

      act(() => {
        result.current.setModalLoading(false)
      })

      expect(result.current.modalState.isLoading).toBe(false)
    })

    it('should set modal error', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setModalError('Test error')
      })

      expect(result.current.modalState.error).toBe('Test error')

      act(() => {
        result.current.setModalError(null)
      })

      expect(result.current.modalState.error).toBe(null)
    })
  })

  describe('UI State Actions', () => {
    it('should set loading state', () => {
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

    it('should set error state', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setError('Test error')
      })

      expect(result.current.uiState.error).toBe('Test error')

      act(() => {
        result.current.setError(null)
      })

      expect(result.current.uiState.error).toBe(null)
    })

    it('should set grid columns with clamping', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      // Test normal value
      act(() => {
        result.current.setGridColumns(4)
      })

      expect(result.current.uiState.gridColumns).toBe(4)

      // Test clamping - too low
      act(() => {
        result.current.setGridColumns(0)
      })

      expect(result.current.uiState.gridColumns).toBe(1)

      // Test clamping - too high
      act(() => {
        result.current.setGridColumns(10)
      })

      expect(result.current.uiState.gridColumns).toBe(6)
    })
  })

  describe('URL Synchronization', () => {
    beforeEach(() => {
      mockReplaceState.mockClear()
    })

    it('should sync from URL correctly', () => {
      // Mock URL with parameters
      mockLocation.search = '?q=test&categories=development,devops&sortBy=alphabetical&view=list'

      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.syncFromUrl()
      })

      expect(result.current.searchQuery).toBe('test')
      expect(result.current.isSearchMode).toBe(true)
      expect(result.current.activeFilters.categories).toEqual(['development', 'devops'])
      expect(result.current.sortBy).toBe('alphabetical')
      expect(result.current.viewMode).toBe('list')
    })

    it('should sync to URL correctly', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      // Set some state
      act(() => {
        result.current.setSearchQuery('test query')
        result.current.setCategories(['development'])
        result.current.setSortBy('alphabetical')
        result.current.setViewMode('list')
        result.current.setPopularityFilter(4.0)
      })

      // Sync to URL
      act(() => {
        result.current.syncToUrl()
      })

      // URLSearchParams.toString() encodes spaces as '+'
      expect(mockReplaceState).toHaveBeenCalledWith(
        {},
        '',
        expect.stringContaining('q=test+query')
      )
      expect(mockReplaceState).toHaveBeenCalledWith(
        {},
        '',
        expect.stringContaining('categories=development')
      )
      expect(mockReplaceState).toHaveBeenCalledWith(
        {},
        '',
        expect.stringContaining('sortBy=alphabetical')
      )
      expect(mockReplaceState).toHaveBeenCalledWith(
        {},
        '',
        expect.stringContaining('view=list')
      )
      expect(mockReplaceState).toHaveBeenCalledWith(
        {},
        '',
        expect.stringContaining('minRating=4')
      )
    })

    it('should not sync to URL when disabled', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      // Disable URL sync
      act(() => {
        result.current.disableUrlSync()
      })

      // Set some state
      act(() => {
        result.current.setSearchQuery('test')
      })

      // Try to sync
      act(() => {
        result.current.syncToUrl()
      })

      expect(mockReplaceState).not.toHaveBeenCalled()
    })

    it('should enable/disable URL sync', () => {
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

  describe('Preferences Actions', () => {
    it('should update preferences', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.updatePreferences({
          defaultViewMode: 'list',
          itemsPerPage: 48,
        })
      })

      expect(result.current.userPreferences.defaultViewMode).toBe('list')
      expect(result.current.userPreferences.itemsPerPage).toBe(48)
      expect(result.current.userPreferences.defaultSortBy).toBe('popularity') // Should keep existing
    })

    it('should reset preferences', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      // Update preferences first
      act(() => {
        result.current.updatePreferences({
          defaultViewMode: 'list',
          itemsPerPage: 48,
        })
      })

      expect(result.current.userPreferences.defaultViewMode).toBe('list')

      // Reset preferences
      act(() => {
        result.current.resetPreferences()
      })

      expect(result.current.userPreferences.defaultViewMode).toBe('grid')
      expect(result.current.userPreferences.itemsPerPage).toBe(24)
    })
  })

  describe('Utility Actions', () => {
    it('should get active filter count', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      expect(result.current.getActiveFilterCount()).toBe(0)

      act(() => {
        result.current.setCategories(['development', 'devops'])
        result.current.setTags(['api'])
        result.current.setPricingFilters(['free'])
        result.current.setPopularityFilter(4.0)
        result.current.setResourceFilters({ minCpu: 2 })
      })

      expect(result.current.getActiveFilterCount()).toBe(5) // 2 categories + 1 tag + 1 pricing + 1 popularity + 1 resource
    })

    it('should get search params for query', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      act(() => {
        result.current.setSearchQuery('test')
        result.current.setCategories(['development'])
        result.current.setSortBy('alphabetical')
        result.current.setItemsPerPage(48)
      })

      const searchParams = result.current.getSearchParamsForQuery()

      expect(searchParams).toEqual({
        query: 'test',
        categories: ['development'],
        sortBy: 'alphabetical',
        limit: 48,
      })
    })

    it('should reset state but keep preferences', () => {
      const { result } = renderHook(() => useServiceBrowserStore())

      // Set some state and preferences
      act(() => {
        result.current.setSearchQuery('test')
        result.current.setCategories(['development'])
        result.current.setSortBy('alphabetical')
        result.current.updatePreferences({ defaultViewMode: 'list' })
      })

      const originalPreferences = result.current.userPreferences

      // Reset state
      act(() => {
        result.current.resetState()
      })

      expect(result.current.searchQuery).toBe('')
      expect(result.current.activeFilters.categories).toEqual([])
      expect(result.current.sortBy).toBe('popularity')
      expect(result.current.userPreferences).toEqual(originalPreferences) // Should keep preferences
    })
  })

  describe('Selector Hooks', () => {
    it('should provide individual selector hooks', () => {
      const { result: searchQuery } = renderHook(() => 
        useServiceBrowserStore(state => state.searchQuery)
      )
      const { result: isSearchMode } = renderHook(() => 
        useServiceBrowserStore(state => state.isSearchMode)
      )
      const { result: activeFilters } = renderHook(() => 
        useServiceBrowserStore(state => state.activeFilters)
      )

      expect(searchQuery.current).toBe('')
      expect(isSearchMode.current).toBe(false)
      expect(activeFilters.current).toEqual({
        categories: [],
        tags: [],
        pricing: [],
        pricingTypes: [],
        popularity: null,
        minPopularity: null,
        resources: {},
        companySize: [],
        hasFreeTier: null,
      })
    })
  })
})