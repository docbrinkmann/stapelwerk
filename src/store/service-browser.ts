import { create } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { 
  ServiceSearchParams,
  Service, 
  ServiceSortBy,
  ServiceFilterState,
  ServiceBrowserUIState,
  ServiceBrowserModalState,
  ViewMode
} from '@/types/service-browser'

/**
 * Service Browser Store State Interface
 * Comprehensive state management for the service browser UI
 */
interface ServiceBrowserState {
  // Search & Filter State
  searchParams: ServiceSearchParams
  isSearchMode: boolean
  searchQuery: string
  activeFilters: ServiceFilterState
  sortBy: ServiceSortBy
  viewMode: ViewMode
  
  // UI State
  uiState: ServiceBrowserUIState
  modalState: ServiceBrowserModalState
  
  // Pagination & Performance
  currentPage: number
  itemsPerPage: number
  totalResults: number
  
  // URL Synchronization
  urlSyncEnabled: boolean
  lastSyncedUrl: string | null
  
  // Preferences (persisted)
  userPreferences: {
    defaultViewMode: ViewMode
    defaultSortBy: ServiceSortBy
    itemsPerPage: number
    rememberFilters: boolean
  }
}

/**
 * Service Browser Store Actions Interface
 * All actions for managing service browser state
 */
interface ServiceBrowserActions {
  // Search Actions
  setSearchQuery: (query: string) => void
  setTotalResults: (count: number) => void
  clearSearch: () => void
  setSearchMode: (isSearchMode: boolean) => void
  
  // Filter Actions
  setCategory: (category: string | null) => void
  setCategories: (categories: string[]) => void
  addCategory: (category: string) => void
  removeCategory: (category: string) => void
  setTags: (tags: string[]) => void
  addTag: (tag: string) => void
  removeTag: (tag: string) => void
  setPricingFilters: (pricing: string[]) => void
  setPricingTypes: (pricing: string[]) => void
  setPopularityFilter: (minRating: number | null) => void
  setResourceFilters: (resources: { minCpu?: number; minMemory?: number }) => void
  setCompanySizeFilters: (sizes: string[]) => void
  setHasFreeTier: (hasFreeTier: boolean | null) => void
  clearAllFilters: () => void
  resetFilters: () => void
  
  // Sort & View Actions
  setSortBy: (sortBy: ServiceSortBy) => void
  setViewMode: (mode: ViewMode) => void
  setItemsPerPage: (count: number) => void
  
  // Modal Actions
  openServiceModal: (service: Service) => void
  closeServiceModal: () => void
  setModalLoading: (isLoading: boolean) => void
  setModalError: (error: string | null) => void
  
  // Modal retry action
  retryServiceLoad: () => void
  
  // UI State Actions
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  setGridColumns: (columns: number) => void
  
  // URL Synchronization Actions
  syncFromUrl: () => void
  syncToUrl: () => void
  enableUrlSync: () => void
  disableUrlSync: () => void
  
  // Preferences Actions
  updatePreferences: (preferences: Partial<ServiceBrowserState['userPreferences']>) => void
  resetPreferences: () => void
  
  // Utility Actions
  getActiveFilterCount: () => number
  getSearchParamsForQuery: () => ServiceSearchParams
  resetState: () => void
}

/**
 * Combined Service Browser Store Type
 */
export type ServiceBrowserStore = ServiceBrowserState & ServiceBrowserActions

/**
 * Default state values
 */
const defaultState: ServiceBrowserState = {
  // Search & Filter State
  searchParams: {},
  isSearchMode: false,
  searchQuery: '',
  activeFilters: {
    categories: [],
    tags: [],
    pricing: [],
    pricingTypes: [],
    popularity: null,
    minPopularity: null,
    resources: {},
    companySize: [],
    hasFreeTier: null,
  },
  sortBy: 'popularity',
  viewMode: 'grid',
  
  // UI State
  uiState: {
    isLoading: false,
    error: null,
    gridColumns: 3,
    showSkeleton: true,
  },
  modalState: {
    isOpen: false,
    service: null,
    isLoading: false,
    error: null,
  },
  
  // Pagination
  currentPage: 1,
  itemsPerPage: 24,
  totalResults: 0,
  
  // URL Synchronization
  urlSyncEnabled: true,
  lastSyncedUrl: null,
  
  // Preferences
  userPreferences: {
    defaultViewMode: 'grid',
    defaultSortBy: 'popularity',
    itemsPerPage: 24,
    rememberFilters: false,
  },
}

/**
 * Service Browser Store Implementation
 * Using Zustand with TypeScript, Immer, DevTools, and Persistence
 */
export const useServiceBrowserStore = create<ServiceBrowserStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...defaultState,
        
        // Search Actions
        setTotalResults: (count: number) => {
          set((state) => {
            state.totalResults = count
          })
        },

        setSearchQuery: (query: string) => {
          set((state) => {
            state.searchQuery = query.trim()
            state.isSearchMode = query.trim().length > 0
            state.searchParams.query = query.trim() || undefined
            
            // Reset pagination when search changes
            state.currentPage = 1
            
            // Sync to URL if enabled
            if (state.urlSyncEnabled) {
              // URL sync will be handled by effect
              state.lastSyncedUrl = null
            }
          })
        },

        clearSearch: () => {
          set((state) => {
            state.searchQuery = ''
            state.isSearchMode = false
            state.searchParams.query = undefined
            state.currentPage = 1
          })
        },

        setSearchMode: (isSearchMode: boolean) => {
          set((state) => {
            state.isSearchMode = isSearchMode
            if (!isSearchMode) {
              state.searchQuery = ''
              state.searchParams.query = undefined
            }
          })
        },

        // Filter Actions
        setCategory: (category: string | null) => {
          set((state) => {
            state.activeFilters.categories = category ? [category] : []
            state.searchParams.categories = state.activeFilters.categories.length > 0 
              ? state.activeFilters.categories 
              : undefined
            state.currentPage = 1
          })
        },

        setCategories: (categories: string[]) => {
          set((state) => {
            state.activeFilters.categories = categories
            state.searchParams.categories = categories.length > 0 ? categories : undefined
            state.currentPage = 1
          })
        },

        addCategory: (category: string) => {
          set((state) => {
            if (!state.activeFilters.categories.includes(category)) {
              state.activeFilters.categories.push(category)
              state.searchParams.categories = state.activeFilters.categories
              state.currentPage = 1
            }
          })
        },

        removeCategory: (category: string) => {
          set((state) => {
            state.activeFilters.categories = state.activeFilters.categories.filter(c => c !== category)
            state.searchParams.categories = state.activeFilters.categories.length > 0 
              ? state.activeFilters.categories 
              : undefined
            state.currentPage = 1
          })
        },

        setTags: (tags: string[]) => {
          set((state) => {
            state.activeFilters.tags = tags
            state.searchParams.tags = tags.length > 0 ? tags : undefined
            state.currentPage = 1
          })
        },

        addTag: (tag: string) => {
          set((state) => {
            if (!state.activeFilters.tags.includes(tag)) {
              state.activeFilters.tags.push(tag)
              state.searchParams.tags = state.activeFilters.tags
              state.currentPage = 1
            }
          })
        },

        removeTag: (tag: string) => {
          set((state) => {
            state.activeFilters.tags = state.activeFilters.tags.filter(t => t !== tag)
            state.searchParams.tags = state.activeFilters.tags.length > 0 
              ? state.activeFilters.tags 
              : undefined
            state.currentPage = 1
          })
        },

        setPricingFilters: (pricing: string[]) => {
          set((state) => {
            state.activeFilters.pricing = pricing
            state.searchParams.pricing = pricing.length > 0 ? pricing : undefined
            state.currentPage = 1
          })
        },

        setPricingTypes: (pricing: string[]) => {
          set((state) => {
            state.activeFilters.pricingTypes = pricing
            state.searchParams.pricing = pricing.length > 0 ? pricing : undefined
            state.currentPage = 1
          })
        },

        setCompanySizeFilters: (sizes: string[]) => {
          set((state) => {
            state.activeFilters.companySize = sizes
            state.currentPage = 1
          })
        },

        setHasFreeTier: (hasFreeTier: boolean | null) => {
          set((state) => {
            state.activeFilters.hasFreeTier = hasFreeTier
            state.currentPage = 1
          })
        },

        setPopularityFilter: (minRating: number | null) => {
          set((state) => {
            state.activeFilters.popularity = minRating
            state.searchParams.minPopularity = minRating || undefined
            state.currentPage = 1
          })
        },

        setResourceFilters: (resources: { minCpu?: number; minMemory?: number }) => {
          set((state) => {
            state.activeFilters.resources = resources
            state.searchParams.minCpu = resources.minCpu
            state.searchParams.minMemory = resources.minMemory
            state.currentPage = 1
          })
        },

        clearAllFilters: () => {
          set((state) => {
            state.activeFilters = {
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
            state.searchParams = {
              query: state.searchParams.query, // Keep search query
              sortBy: state.searchParams.sortBy, // Keep sort
              limit: state.searchParams.limit, // Keep pagination settings
            }
            state.currentPage = 1
          })
        },

        resetFilters: () => {
          set((state) => {
            state.activeFilters = {
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
            state.searchParams = {}
            state.searchQuery = ''
            state.isSearchMode = false
            state.currentPage = 1
            state.sortBy = state.userPreferences.defaultSortBy
          })
        },

        // Sort & View Actions
        setSortBy: (sortBy: ServiceSortBy) => {
          set((state) => {
            state.sortBy = sortBy
            state.searchParams.sortBy = sortBy
            state.currentPage = 1
          })
        },

        setViewMode: (mode: ViewMode) => {
          set((state) => {
            state.viewMode = mode
          })
        },

        setItemsPerPage: (count: number) => {
          set((state) => {
            state.itemsPerPage = count
            state.searchParams.limit = count
            state.currentPage = 1
          })
        },

        // Modal Actions
        openServiceModal: (service: Service) => {
          set((state) => {
            state.modalState = {
              isOpen: true,
              service,
              isLoading: false,
              error: null,
            }
            if (process.env.NODE_ENV === 'development') {
              // Debugging aid for modal open events
              // eslint-disable-next-line no-console
              console.debug('[service-browser] openServiceModal', service?.id)
            }
          })
        },

        closeServiceModal: () => {
          set((state) => {
            state.modalState = {
              isOpen: false,
              service: null,
              isLoading: false,
              error: null,
            }
            if (process.env.NODE_ENV === 'development') {
              // Debugging aid for modal close events
              // eslint-disable-next-line no-console
              console.debug('[service-browser] closeServiceModal')
            }
          })
        },

        setModalLoading: (isLoading: boolean) => {
          set((state) => {
            state.modalState.isLoading = isLoading
          })
        },

        setModalError: (error: string | null) => {
          set((state) => {
            state.modalState.error = error
          })
        },

        // UI State Actions
        setLoading: (isLoading: boolean) => {
          set((state) => {
            state.uiState.isLoading = isLoading
          })
        },

        setError: (error: string | null) => {
          set((state) => {
            state.uiState.error = error
          })
        },

        setGridColumns: (columns: number) => {
          set((state) => {
            state.uiState.gridColumns = Math.max(1, Math.min(6, columns)) // Clamp between 1-6
          })
        },

        // URL Synchronization Actions
        syncFromUrl: () => {
          if (typeof window === 'undefined') return
          
          set((state) => {
            const urlParams = new URLSearchParams(window.location.search)
            
            // Extract search parameters from URL
            const query = urlParams.get('q') || ''
            const categories = urlParams.get('categories')?.split(',').filter(Boolean) || []
            const tags = urlParams.get('tags')?.split(',').filter(Boolean) || []
            const pricing = urlParams.get('pricing')?.split(',').filter(Boolean) || []
            const sortBy = (urlParams.get('sortBy') as ServiceSortBy) || 'popularity'
            const viewMode = (urlParams.get('view') as ViewMode) || 'grid'
            const minPopularity = urlParams.get('minRating') ? Number(urlParams.get('minRating')) : null
            
            // Update state from URL
            state.searchQuery = query
            state.isSearchMode = query.length > 0
            state.activeFilters = {
              categories,
              tags,
              pricing,
              pricingTypes: pricing, // Use same data for both
              popularity: minPopularity,
              minPopularity,
              resources: {},
              companySize: [],
              hasFreeTier: null,
            }
            state.sortBy = sortBy
            state.viewMode = viewMode
            
            // Update search params
            state.searchParams = {
              query: query || undefined,
              categories: categories.length > 0 ? categories : undefined,
              tags: tags.length > 0 ? tags : undefined,
              pricing: pricing.length > 0 ? pricing : undefined,
              sortBy,
              minPopularity: minPopularity || undefined,
              limit: state.itemsPerPage,
            }
            
            state.lastSyncedUrl = window.location.search
          })
        },

        syncToUrl: () => {
          if (typeof window === 'undefined' || !get().urlSyncEnabled) return
          
          const state = get()
          const urlParams = new URLSearchParams()
          
          // Add non-empty parameters to URL
          if (state.searchQuery) {
            urlParams.set('q', state.searchQuery)
          }
          if (state.activeFilters.categories.length > 0) {
            urlParams.set('categories', state.activeFilters.categories.join(','))
          }
          if (state.activeFilters.tags.length > 0) {
            urlParams.set('tags', state.activeFilters.tags.join(','))
          }
          if (state.activeFilters.pricing.length > 0) {
            urlParams.set('pricing', state.activeFilters.pricing.join(','))
          }
          if (state.sortBy !== 'popularity') {
            urlParams.set('sortBy', state.sortBy)
          }
          if (state.viewMode !== 'grid') {
            urlParams.set('view', state.viewMode)
          }
          if (state.activeFilters.popularity) {
            urlParams.set('minRating', state.activeFilters.popularity.toString())
          }
          
          const newUrl = urlParams.toString()
          const currentUrl = window.location.pathname + (newUrl ? `?${newUrl}` : '')
          
          // Only update URL if it's different
          if (state.lastSyncedUrl !== newUrl) {
            window.history.replaceState({}, '', currentUrl)
            set((state) => {
              state.lastSyncedUrl = newUrl
            })
          }
        },

        enableUrlSync: () => {
          set((state) => {
            state.urlSyncEnabled = true
          })
        },

        disableUrlSync: () => {
          set((state) => {
            state.urlSyncEnabled = false
          })
        },

        // Preferences Actions
        updatePreferences: (preferences: Partial<ServiceBrowserState['userPreferences']>) => {
          set((state) => {
            state.userPreferences = { ...state.userPreferences, ...preferences }
          })
        },

        resetPreferences: () => {
          set((state) => {
            state.userPreferences = defaultState.userPreferences
          })
        },

        retryServiceLoad: () => {
          set((state) => {
            state.modalState.error = null
            state.modalState.isLoading = true
          })
          // This would typically retry the service fetch
        },

        // Utility Actions
        getActiveFilterCount: () => {
          const state = get()
          return (
            state.activeFilters.categories.length +
            state.activeFilters.tags.length +
            state.activeFilters.pricingTypes.length +
            state.activeFilters.companySize.length +
            (state.activeFilters.popularity ? 1 : 0) +
            (state.activeFilters.hasFreeTier !== null ? 1 : 0) +
            (Object.keys(state.activeFilters.resources).length > 0 ? 1 : 0)
          )
        },

        getSearchParamsForQuery: () => {
          const state = get()
          return {
            ...state.searchParams,
            limit: state.itemsPerPage,
          }
        },

        resetState: () => {
          set(() => ({
            ...defaultState,
            userPreferences: get().userPreferences, // Keep user preferences
          }))
        },
      })),
      {
        name: 'service-browser-store', // localStorage key
        storage: typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
          ? createJSONStorage(() => localStorage)
          : createJSONStorage(() => ({
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }) as any),
        partialize: (state) => ({
          // Only persist user preferences and view settings
          userPreferences: state.userPreferences,
          viewMode: state.viewMode,
          itemsPerPage: state.itemsPerPage,
          urlSyncEnabled: state.urlSyncEnabled,
        }),
      }
    ),
    {
      name: 'ServiceBrowserStore', // DevTools name
      enabled: process.env.NODE_ENV === 'development',
    }
  )
)

/**
 * Selector hooks for optimized component subscriptions
 */

// Search & Filter Selectors
export const useSearchQuery = () => useServiceBrowserStore((state) => state.searchQuery)
export const useIsSearchMode = () => useServiceBrowserStore((state) => state.isSearchMode)
export const useActiveFilters = () => useServiceBrowserStore((state) => state.activeFilters)
export const useSearchParams = () => useServiceBrowserStore((state) => state.searchParams)

// UI State Selectors
export const useViewMode = () => useServiceBrowserStore((state) => state.viewMode)
export const useSortBy = () => useServiceBrowserStore((state) => state.sortBy)
export const useUIState = () => useServiceBrowserStore((state) => state.uiState)
export const useModalState = () => useServiceBrowserStore((state) => state.modalState)

// Action Selectors
export const useServiceBrowserActions = () => useServiceBrowserStore((state) => ({
  // Search actions
  setSearchQuery: state.setSearchQuery,
  clearSearch: state.clearSearch,
  setSearchMode: state.setSearchMode,
  
  // Filter actions
  setCategory: state.setCategory,
  setCategories: state.setCategories,
  addCategory: state.addCategory,
  removeCategory: state.removeCategory,
  setTags: state.setTags,
  addTag: state.addTag,
  removeTag: state.removeTag,
  setPricingFilters: state.setPricingFilters,
  setPopularityFilter: state.setPopularityFilter,
  clearAllFilters: state.clearAllFilters,
  resetFilters: state.resetFilters,
  
  // View actions
  setSortBy: state.setSortBy,
  setViewMode: state.setViewMode,
  setItemsPerPage: state.setItemsPerPage,
  setGridColumns: state.setGridColumns,
  
  // Modal actions
  openServiceModal: state.openServiceModal,
  closeServiceModal: state.closeServiceModal,
  
  // URL sync actions
  syncFromUrl: state.syncFromUrl,
  syncToUrl: state.syncToUrl,
  
  // Utility actions
  getActiveFilterCount: state.getActiveFilterCount,
  resetState: state.resetState,
}))

export default useServiceBrowserStore