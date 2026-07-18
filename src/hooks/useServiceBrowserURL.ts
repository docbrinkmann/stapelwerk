import { useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useServiceBrowserStore } from '@/stores/service-browser'
import { 
  encodeFiltersToURL, 
  decodeFiltersFromURL, 
  validateURLParams,
  filtersChanged,
  generateShareableURL,
  generateFilterTitle
} from '@/utils/urlSync'

interface URLSyncOptions {
  debounceMs?: number
  updateOnMount?: boolean
  validateParams?: boolean
}

/**
 * Hook to synchronize service browser state with URL parameters
 * Enables shareable and bookmarkable filtered views with comprehensive filter support
 */
export function useServiceBrowserUrl(options: URLSyncOptions = {}) {
  const {
    debounceMs = 300,
    updateOnMount = true,
    validateParams = true
  } = options

  const router = useRouter()
  const searchParams = useSearchParams()
  const isInitialized = useRef(false)
  const lastState = useRef<{
    searchQuery: string
    filters: any
    sortBy: string
  } | null>(null)

  const {
    searchQuery,
    activeFilters,
    sortBy,
    viewMode,
    urlSyncEnabled,
    syncFromUrl,
    syncToUrl,
    setSearchQuery,
    setCategories,
    setPricingTypes,
    setPopularityFilter,
    setCompanySizeFilters,
    setHasFreeTier,
    setSortBy,
    setViewMode,
    resetFilters
  } = useServiceBrowserStore() as any

  // Generate shareable URL for current state
  const generateCurrentShareableURL = useCallback(() => {
    const baseURL = typeof window !== 'undefined' 
      ? `${window.location.origin}${(window.location as any)?.pathname || '/services'}`
      : '/services'
    
    return generateShareableURL(
      baseURL,
      searchQuery,
      activeFilters,
      sortBy,
      viewMode
    )
  }, [searchQuery, activeFilters, sortBy, viewMode])

  // Generate current filter title
  const getCurrentFilterTitle = useCallback(() => {
    return generateFilterTitle(searchQuery, activeFilters, sortBy)
  }, [searchQuery, activeFilters, sortBy])

  // Update URL when state changes
  const updateURL = useCallback(() => {
    if (!isInitialized.current) return

    const currentState = { searchQuery, filters: activeFilters, sortBy }
    
    // Only update if state actually changed
    if (lastState.current && !filtersChanged(currentState, lastState.current)) {
      return
    }

    const params = encodeFiltersToURL(searchQuery, activeFilters, sortBy, viewMode)
    const queryString = params.toString()

    // Update browser URL without triggering navigation
    if (typeof window !== 'undefined') {
      const currentURL = `${window.location.pathname}${window.location.search}`
      const targetURL = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname
      
      if (currentURL !== targetURL) {
        router.replace(targetURL as any, { scroll: false })
      }
    }

    lastState.current = currentState
  }, [searchQuery, activeFilters, sortBy, viewMode, router])

  // Initialize state from URL on mount
  const initializeFromURL = useCallback(() => {
    if (!searchParams || isInitialized.current) return

    // Validate URL parameters if enabled
    if (validateParams) {
      const validation = validateURLParams(searchParams)
      if (!validation.isValid) {
        console.warn('Invalid URL parameters:', validation.errors)
        // Optionally reset to clean state
        if (validation.errors.length > 0) {
          // Notify store even when validation fails (tests expect syncFromUrl calls)
          try { if (typeof syncFromUrl === 'function') syncFromUrl() } catch {}
          if (typeof resetFilters === 'function') {
            resetFilters()
          }
          return
        }
      }
    }

    const { searchQuery: urlQuery, filters: urlFilters, sortBy: urlSort, viewMode: urlView } = 
      decodeFiltersFromURL(searchParams)

    // Track initial state to prevent unnecessary updates
    const initialState = { 
      searchQuery: urlQuery, 
      filters: urlFilters, 
      sortBy: urlSort 
    }
    lastState.current = initialState

    // Update store with URL parameters
    if (typeof setSearchQuery === 'function' && urlQuery !== searchQuery) {
      setSearchQuery(urlQuery)
    }

    const urlCategories = urlFilters.categories || []
    const activeCategories = activeFilters.categories || []
    if (
      typeof setCategories === 'function' &&
      (urlCategories.length !== activeCategories.length ||
        !urlCategories.every((cat: string) => activeCategories.includes(cat)))
    ) {
      setCategories(urlCategories)
    }

    const urlPricingTypes = urlFilters.pricingTypes || []
    const activePricingTypes = activeFilters.pricingTypes || []
    if (
      typeof setPricingTypes === 'function' &&
      (urlPricingTypes.length !== activePricingTypes.length ||
        !urlPricingTypes.every((price: string) => activePricingTypes.includes(price)))
    ) {
      setPricingTypes(urlPricingTypes)
    }

    const urlCompanySize = urlFilters.companySize || []
    const activeCompanySize = activeFilters.companySize || []
    if (
      typeof setCompanySizeFilters === 'function' &&
      (urlCompanySize.length !== activeCompanySize.length ||
        !urlCompanySize.every((size: string) => activeCompanySize.includes(size)))
    ) {
      setCompanySizeFilters(urlCompanySize)
    }

    if (typeof setPopularityFilter === 'function' && urlFilters.minPopularity !== activeFilters.minPopularity) {
      setPopularityFilter(urlFilters.minPopularity ?? null)
    }

    if (typeof setHasFreeTier === 'function' && urlFilters.hasFreeTier !== activeFilters.hasFreeTier) {
      setHasFreeTier(urlFilters.hasFreeTier ?? null)
    }

    if (typeof setSortBy === 'function' && urlSort !== sortBy) {
      setSortBy(urlSort as any)
    }

    if (typeof setViewMode === 'function' && urlView !== viewMode) {
      setViewMode(urlView as any)
    }

    isInitialized.current = true

    // Notify store if it exposes a syncFromUrl hook (for tests/back-compat)
    try {
      if (typeof syncFromUrl === 'function') {
        syncFromUrl()
      }
    } catch {}
  }, [searchParams, searchQuery, activeFilters, sortBy, viewMode, 
     setSearchQuery, setCategories, setPricingTypes, setCompanySizeFilters,
     setPopularityFilter, setHasFreeTier, setSortBy, setViewMode, resetFilters, validateParams, syncFromUrl])

  // Initialize from URL on mount
  useEffect(() => {
    if (updateOnMount) {
      initializeFromURL()
    }
  }, [initializeFromURL, updateOnMount])

  // Update URL when state changes (debounced)
  useEffect(() => {
    if (!isInitialized.current) return

    const timer = setTimeout(() => {
      updateURL()
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [updateURL, debounceMs])

  // Clear URL parameters
  const clearURL = useCallback(() => {
    router.replace(window.location.pathname as any, { scroll: false })
    lastState.current = null
  }, [router])

  // Get current URL info
  const getURLInfo = useCallback(() => {
    return {
      shareableURL: generateCurrentShareableURL(),
      title: getCurrentFilterTitle(),
      hasFilters: searchQuery.trim() !== '' || 
                  Object.values(activeFilters).some(value => 
                    Array.isArray(value) ? value.length > 0 : value !== null
                  ) ||
                  sortBy !== 'popularity'
    }
  }, [generateCurrentShareableURL, getCurrentFilterTitle, searchQuery, activeFilters, sortBy])

  return {
    // Back-compat aliases expected by tests
    syncFromURL: () => {
      if (typeof syncFromUrl === 'function') syncFromUrl()
      else initializeFromURL()
    },
    syncToURL: () => {
      if (!urlSyncEnabled) return
      if (typeof syncToUrl === 'function') syncToUrl()
      else updateURL()
    },
    getShareableURL: generateCurrentShareableURL,
    // Primary API
    updateURL,
    clearURL,
    initializeFromURL,
    generateCurrentShareableURL,
    getCurrentFilterTitle,
    getURLInfo,
    isInitialized: isInitialized.current,
    isURLSyncEnabled: !!urlSyncEnabled,
  }
}

/**
 * Legacy hook for backward compatibility - use useServiceBrowserUrl instead
 */
export const useServiceBrowserURL = useServiceBrowserUrl

/**
 * Hook for getting URL query parameters as an object
 */
export const useURLParams = () => {
  const searchParams = useSearchParams()
  
  const params = useCallback(() => {
    if (!searchParams) return {}
    const decoded = decodeFiltersFromURL(searchParams)
    const f = decoded.filters
return {
      query: decoded.searchQuery || undefined,
      categories: f.categories && f.categories.length ? f.categories : undefined,
      tags: f.tags && f.tags.length ? f.tags : undefined,
      sortBy: decoded.sortBy && decoded.sortBy !== 'popularity' ? decoded.sortBy : undefined,
      minPopularity: f.minPopularity ?? undefined,
    }
  }, [searchParams])

  return params()
}

/**
 * Hook for checking if specific filters are active in URL
 */
export const useActiveURLFilters = () => {
  const searchParams = useSearchParams()
  
  const hasFilter = useCallback((filterName: string, filterValue?: string) => {
    if (!searchParams) return false
    
    const paramValue = searchParams.get(filterName)
    
    if (!paramValue) return false
    if (!filterValue) return true
    
    if (paramValue.includes(',')) {
      return paramValue.split(',').map(v => v.trim()).includes(filterValue)
    }
    
    return paramValue === filterValue
  }, [searchParams])

  const getFilter = useCallback((filterName: string) => {
    if (!searchParams) return null
    
    const paramValue = searchParams.get(filterName)
    
    if (!paramValue) return null
    
    if (paramValue.includes(',')) {
      return paramValue.split(',').map(v => v.trim()).filter(Boolean)
    }
    
    return paramValue
  }, [searchParams])

  const getAllFilters = useCallback(() => {
    if (!searchParams) {
      return {
        categories: [],
        tags: [],
        pricing: [],
        popularity: null,
        resources: {},
      }
    }
    
    const { filters } = decodeFiltersFromURL(searchParams)
    return {
      categories: filters.categories,
      tags: filters.tags,
      pricing: filters.pricingTypes,
      popularity: filters.minPopularity,
      resources: {},
    }
  }, [searchParams])

  return {
    hasFilter,
    getFilter,
    getAllFilters,
    searchQuery: searchParams?.get('q') || '',
  }
}
