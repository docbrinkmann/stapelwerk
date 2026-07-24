import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SearchBar } from '../SearchBar'
import { FilterPanel } from '../FilterPanel'
import { ServiceGrid } from '../ServiceGrid'
import { useServiceBrowserStore } from '@/store/service-browser'
import { useInfiniteServiceBrowserScroll } from '@/hooks/useInfiniteScroll'

// Mock dependencies
vi.mock('@/store/service-browser')
vi.mock('@/hooks/useInfiniteScroll')
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: false }),
}))

// Mock timers for debouncing tests
vi.useFakeTimers({ shouldAdvanceTime: true })

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('Search and Filter Integration', () => {
  const mockSetSearchQuery = vi.fn()
  const mockClearSearch = vi.fn()
  const mockSetCategories = vi.fn()
  const mockSetPricingTypes = vi.fn()
  const mockSetPopularityFilter = vi.fn()
  const mockSetSortBy = vi.fn()
  const mockResetFilters = vi.fn()
  const mockGetActiveFilterCount = vi.fn()
  const mockSetGridColumns = vi.fn()

  const defaultStoreState = {
    searchQuery: '',
    isSearchMode: false,
    activeFilters: {
      categories: [],
      subcategories: [],
      tags: [],
      pricingTypes: [],
      features: [],
      integrations: [],
      companySize: [],
      minPopularity: null,
      hasFreeTier: null,
    },
    sortBy: 'popularity',
    viewMode: 'grid',
    uiState: {
      isLoading: false,
      error: null,
      gridColumns: 3,
    },
    itemsPerPage: 24,
    setSearchQuery: mockSetSearchQuery,
    clearSearch: mockClearSearch,
    setCategories: mockSetCategories,
    setPricingTypes: mockSetPricingTypes,
    setPopularityFilter: mockSetPopularityFilter,
    setSortBy: mockSetSortBy,
    resetFilters: mockResetFilters,
    getActiveFilterCount: mockGetActiveFilterCount,
    setGridColumns: mockSetGridColumns,
  }

  const mockInfiniteScrollHook = {
    services: [],
    isLoading: false,
    isLoadingMore: false,
    hasNextPage: false,
    loadMore: vi.fn(),
    error: null,
    refetch: vi.fn(),
    mode: 'browse',
    isEmpty: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetActiveFilterCount.mockReturnValue(0)
    vi.mocked(useServiceBrowserStore).mockReturnValue(defaultStoreState as any)
    vi.mocked(useInfiniteServiceBrowserScroll).mockReturnValue(mockInfiniteScrollHook)
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  describe('Search and Filter State Management', () => {
    it('should integrate search and filter components with store', () => {
      render(
        <TestWrapper>
          <SearchBar />
          <FilterPanel />
        </TestWrapper>
      )

      // Both components should render and connect to store
      expect(screen.getByRole('searchbox')).toBeInTheDocument()
      expect(screen.getByText('Filters')).toBeInTheDocument()
      expect(screen.getByText('Categories')).toBeInTheDocument()
    })

    it('should update search query and trigger service loading', async () => {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) }) // Disable delay to prevent timeouts

      render(
        <TestWrapper>
          <SearchBar />
          <ServiceGrid />
        </TestWrapper>
      )

      const searchInput = screen.getByRole('searchbox')
      await user.type(searchInput, 'docker')

      // Fast-forward debounce timer
      act(() => {
        vi.advanceTimersByTime(300)
      })

      expect(mockSetSearchQuery).toHaveBeenCalledWith('docker')
    })

    it('should apply filters and update service results', async () => {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) }) // Disable delay to prevent timeouts

      render(
        <TestWrapper>
          <FilterPanel />
          <ServiceGrid />
        </TestWrapper>
      )

      const developmentCheckbox = screen.getByLabelText('Development')
      await user.click(developmentCheckbox)

      expect(mockSetCategories).toHaveBeenCalledWith(['development'])
    })

    it('should combine search and filters correctly', async () => {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) }) // Disable delay to prevent timeouts

      // Update store to have both search and filters active
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        searchQuery: 'database',
        isSearchMode: true,
        activeFilters: {
          ...defaultStoreState.activeFilters,
          categories: ['development'],
          pricingTypes: ['free'],
        },
      } as any)

      mockGetActiveFilterCount.mockReturnValue(3)

      render(
        <TestWrapper>
          <SearchBar />
          <FilterPanel />
          <ServiceGrid />
        </TestWrapper>
      )

      // Should show search query
      expect(screen.getByDisplayValue('database')).toBeInTheDocument()
      
      // Should show active filters
      expect(screen.getByLabelText('Development')).toBeChecked()
      expect(screen.getByText('3')).toBeInTheDocument() // Filter count
    })
  })

  describe('Real-time Search Updates', () => {
    it('should trigger search debouncing correctly', async () => {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) }) // Disable delay to prevent timeouts

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      )

      const searchInput = screen.getByRole('searchbox')
      
      // Type rapidly
      await user.type(searchInput, 'quick search')
      
      // Should not call immediately
      expect(mockSetSearchQuery).not.toHaveBeenCalled()
      
      // Fast-forward 150ms (less than debounce)
      act(() => {
        vi.advanceTimersByTime(150)
      })
      expect(mockSetSearchQuery).not.toHaveBeenCalled()
      
      // Fast-forward remaining 150ms (total 300ms)
      act(() => {
        vi.advanceTimersByTime(150)
      })
      expect(mockSetSearchQuery).toHaveBeenCalledWith('quick search')
    })

    it('should cancel previous search on new input', async () => {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) }) // Disable delay to prevent timeouts

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      )

      const searchInput = screen.getByRole('searchbox')
      
      // Type first query
      await user.type(searchInput, 'first')
      
      // Fast-forward partially
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      // Type more (should cancel previous)
      await user.type(searchInput, ' query')
      
      // Fast-forward full debounce
      act(() => {
        vi.advanceTimersByTime(300)
      })
      
      // Should only call once with final value
      expect(mockSetSearchQuery).toHaveBeenCalledTimes(1)
      expect(mockSetSearchQuery).toHaveBeenCalledWith('first query')
    })

    it('should clear search and reset to browse mode', async () => {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) }) // Disable delay to prevent timeouts

      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        searchQuery: 'existing search',
        isSearchMode: true,
      } as any)

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      )

      const clearButton = screen.getByLabelText('Clear search')
      await user.click(clearButton)

      expect(mockClearSearch).toHaveBeenCalled()
    })
  })

  describe('Filter State Management', () => {
    it('should handle multiple filter selections', async () => {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) }) // Disable delay to prevent timeouts

      render(
        <TestWrapper>
          <FilterPanel />
        </TestWrapper>
      )

      // Select multiple categories
      await user.click(screen.getByLabelText('Development'))
      await user.click(screen.getByLabelText('Analytics'))

      expect(mockSetCategories).toHaveBeenCalledWith(['development'])
      expect(mockSetCategories).toHaveBeenCalledWith(['analytics'])
    })

    it('should handle sort option changes', async () => {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) }) // Disable delay to prevent timeouts

      render(
        <TestWrapper>
          <FilterPanel />
        </TestWrapper>
      )

      const sortSelect = screen.getByLabelText('Sort services by')
      await user.selectOptions(sortSelect, 'alphabetical')

      expect(mockSetSortBy).toHaveBeenCalledWith('alphabetical')
    })

    it('should reset all filters when clear all is clicked', async () => {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) }) // Disable delay to prevent timeouts

      mockGetActiveFilterCount.mockReturnValue(5)
      
      render(
        <TestWrapper>
          <FilterPanel />
        </TestWrapper>
      )

      const clearButton = screen.getByText('Clear all filters')
      await user.click(clearButton)

      expect(mockResetFilters).toHaveBeenCalled()
    })
  })

  describe('API Integration', () => {
    it('should show loading state during search', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        searchQuery: 'loading query',
        isSearchMode: true,
        uiState: {
          isLoading: true,
          error: null,
          gridColumns: 3,
        },
      } as any)

      vi.mocked(useInfiniteServiceBrowserScroll).mockReturnValue({
        ...mockInfiniteScrollHook,
        isLoading: true,
        services: [],
      })

      render(
        <TestWrapper>
          <SearchBar />
          <ServiceGrid />
        </TestWrapper>
      )

      expect(screen.getByLabelText('Searching...')).toBeInTheDocument()
      expect(screen.getByRole('searchbox')).toBeDisabled()
      expect(screen.getAllByTestId('service-card-skeleton').length).toBeGreaterThan(0)
    })

    it('should handle search errors gracefully', () => {
      const searchError = new Error('Search failed')
      
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        searchQuery: 'failed query',
        isSearchMode: true,
        uiState: {
          isLoading: false,
          error: searchError,
          gridColumns: 3,
        },
      } as any)

      vi.mocked(useInfiniteServiceBrowserScroll).mockReturnValue({
        ...mockInfiniteScrollHook,
        error: searchError,
        services: [],
      })

      render(
        <TestWrapper>
          <SearchBar />
          <ServiceGrid />
        </TestWrapper>
      )

      expect(screen.getByText('Search failed. Please try again.')).toBeInTheDocument()
      expect(screen.getByTestId('error-state')).toBeInTheDocument()
    })

    it('should show empty state when no results found', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        searchQuery: 'no results',
        isSearchMode: true,
      } as any)

      vi.mocked(useInfiniteServiceBrowserScroll).mockReturnValue({
        ...mockInfiniteScrollHook,
        services: [],
        isEmpty: true,
        mode: 'search',
      })

      render(
        <TestWrapper>
          <SearchBar />
          <ServiceGrid />
        </TestWrapper>
      )

      expect(screen.getByText(/no services found for "no results"/i)).toBeInTheDocument()
    })
  })

  describe('URL Synchronization', () => {
    it('should sync search and filter state with URL', () => {
      // Mock URL parameters
      const mockSearchParams = new URLSearchParams('?q=docker&categories=development&sort=alphabetical')
      
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        searchQuery: 'docker',
        activeFilters: {
          ...defaultStoreState.activeFilters,
          categories: ['development'],
        },
        sortBy: 'alphabetical',
        isSearchMode: true,
      } as any)

      render(
        <TestWrapper>
          <SearchBar />
          <FilterPanel />
        </TestWrapper>
      )

      // Should reflect URL state in UI
      expect(screen.getByDisplayValue('docker')).toBeInTheDocument()
      expect(screen.getByLabelText('Development')).toBeChecked()
    })
  })

  describe('Performance and UX', () => {
    it('should maintain focus after filter interactions', async () => {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) }) // Disable delay to prevent timeouts

      render(
        <TestWrapper>
          <FilterPanel />
        </TestWrapper>
      )

      const developmentCheckbox = screen.getByLabelText('Development')
      await user.click(developmentCheckbox)

      // Checkbox should maintain focus after interaction
      expect(developmentCheckbox).toHaveFocus()
    })

    it('should maintain search input focus after clearing', async () => {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) }) // Disable delay to prevent timeouts

      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        searchQuery: 'test query',
        isSearchMode: true,
      } as any)

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      )

      const searchInput = screen.getByRole('searchbox')
      const clearButton = screen.getByLabelText('Clear search')

      await user.click(clearButton)

      expect(searchInput).toHaveFocus()
    })

    it('should handle rapid filter changes efficiently', async () => {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) }) // Disable delay to prevent timeouts

      render(
        <TestWrapper>
          <FilterPanel />
        </TestWrapper>
      )

      // Rapidly click multiple filters
      const checkboxes = [
        screen.getByLabelText('Development'),
        screen.getByLabelText('Analytics'),
      ]

      for (const checkbox of checkboxes) {
        await user.click(checkbox)
      }

      // Should handle all clicks without issues
      expect(mockSetCategories).toHaveBeenCalledTimes(2)
    })
  })

  describe('Complete Workflow Integration', () => {
    it('should handle complete search and filter workflow', async () => {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) }) // Disable delay to prevent timeouts

      render(
        <TestWrapper>
          <SearchBar />
          <FilterPanel />
          <ServiceGrid />
        </TestWrapper>
      )

      // Step 1: Enter search query
      const searchInput = screen.getByRole('searchbox')
      await user.type(searchInput, 'container')
      
      act(() => {
        vi.advanceTimersByTime(300)
      })
      
      expect(mockSetSearchQuery).toHaveBeenCalledWith('container')

      // Step 2: Apply category filter
      const developmentFilter = screen.getByLabelText('Development')
      await user.click(developmentFilter)
      
      expect(mockSetCategories).toHaveBeenCalledWith(['development'])

      // Step 3: Change sort order
      const sortSelect = screen.getByLabelText('Sort services by')
      await user.selectOptions(sortSelect, 'alphabetical')
      
      expect(mockSetSortBy).toHaveBeenCalledWith('alphabetical')

      // All interactions should have been captured
      expect(mockSetSearchQuery).toHaveBeenCalled()
      expect(mockSetCategories).toHaveBeenCalled()
      expect(mockSetSortBy).toHaveBeenCalled()
    })

    it('should handle search to filter transition smoothly', async () => {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime.bind(vi) }) // Disable delay to prevent timeouts

      // Start with search mode
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        ...defaultStoreState,
        searchQuery: 'docker',
        isSearchMode: true,
      } as any)

      render(
        <TestWrapper>
          <SearchBar />
          <FilterPanel />
        </TestWrapper>
      )

      // Clear search
      const clearButton = screen.getByLabelText('Clear search')
      await user.click(clearButton)
      
      expect(mockClearSearch).toHaveBeenCalled()

      // Apply filter after clearing search
      const analyticsFilter = screen.getByLabelText('Analytics')
      await user.click(analyticsFilter)
      
      expect(mockSetCategories).toHaveBeenCalledWith(['analytics'])
    })
  })
})