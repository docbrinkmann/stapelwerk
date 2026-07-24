import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SearchBar } from '../SearchBar'
import { useServiceBrowserStore } from '@/store/service-browser'

// Mock the store
vi.mock('@/store/service-browser')

// Mock timers for debouncing tests will be set per-test to avoid cross-test leakage

describe('SearchBar', () => {
  const mockSetSearchQuery = vi.fn()
  const mockClearSearch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useServiceBrowserStore).mockReturnValue({
      searchQuery: '',
      isSearchMode: false,
      uiState: {
        isLoading: false,
        error: null,
      },
      setSearchQuery: mockSetSearchQuery,
      clearSearch: mockClearSearch,
    } as any)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Basic Rendering', () => {
    it('should render search input with placeholder', () => {
      render(<SearchBar />)

      const searchInput = screen.getByRole('searchbox')
      expect(searchInput).toBeInTheDocument()
      expect(searchInput).toHaveAttribute('placeholder', 'Search services...')
    })

    it('should render with search icon', () => {
      render(<SearchBar />)

      expect(screen.getByLabelText('Search')).toBeInTheDocument()
    })

    it('should not show clear button initially', () => {
      render(<SearchBar />)

      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
    })

    it('should display current search value', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        searchQuery: 'docker',
        isSearchMode: true,
        uiState: { isLoading: false, error: null },
        setSearchQuery: mockSetSearchQuery,
        clearSearch: mockClearSearch,
      } as any)

      render(<SearchBar />)

      const searchInput = screen.getByRole('searchbox')
      expect(searchInput).toHaveValue('docker')
    })
  })

  describe('Search Input Functionality', () => {
it('should update input value on typing', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<SearchBar />)

      const searchInput = screen.getByRole('searchbox')
      await user.type(searchInput, 'test query')

      expect(searchInput).toHaveValue('test query')
    })

    it('should debounce search queries with 300ms delay', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<SearchBar />)

      const searchInput = screen.getByRole('searchbox')
      
      // Type multiple characters quickly
      await user.type(searchInput, 'quick')
      
      // Should not call setSearchQuery immediately
      expect(mockSetSearchQuery).not.toHaveBeenCalled()
      
      // Fast-forward 300ms
      act(() => {
        vi.advanceTimersByTime(300)
      })
      
      // Should call setSearchQuery after debounce delay
      expect(mockSetSearchQuery).toHaveBeenCalledWith('quick')
    })

    it('should cancel previous debounced calls on new input', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<SearchBar />)

      const searchInput = screen.getByRole('searchbox')
      
      // Type first query
      await user.type(searchInput, 'first')
      
      // Fast-forward 100ms (less than debounce delay)
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      // Type more characters
      await user.type(searchInput, ' second')
      
      // Fast-forward full debounce delay
      act(() => {
        vi.advanceTimersByTime(300)
      })
      
      // Should only call setSearchQuery once with final value
      expect(mockSetSearchQuery).toHaveBeenCalledTimes(1)
      expect(mockSetSearchQuery).toHaveBeenCalledWith('first second')
    })

    it('should handle empty search queries', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        searchQuery: 'existing query',
        isSearchMode: true,
        uiState: { isLoading: false, error: null },
        setSearchQuery: mockSetSearchQuery,
        clearSearch: mockClearSearch,
      } as any)

      render(<SearchBar />)

      const searchInput = screen.getByRole('searchbox')
      await user.clear(searchInput)

      act(() => {
        vi.advanceTimersByTime(300)
      })

      expect(mockSetSearchQuery).toHaveBeenCalledWith('')
    })
  })

  describe('Clear Button Functionality', () => {
    it('should show clear button when there is search text', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        searchQuery: 'some query',
        isSearchMode: true,
        uiState: { isLoading: false, error: null },
        setSearchQuery: mockSetSearchQuery,
        clearSearch: mockClearSearch,
      } as any)

      render(<SearchBar />)

      expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
    })

    it('should clear search when clear button is clicked', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        searchQuery: 'some query',
        isSearchMode: true,
        uiState: { isLoading: false, error: null },
        setSearchQuery: mockSetSearchQuery,
        clearSearch: mockClearSearch,
      } as any)

      render(<SearchBar />)

      const clearButton = screen.getByLabelText('Clear search')
      await user.click(clearButton)

      expect(mockClearSearch).toHaveBeenCalled()
    })

    it('should focus search input after clearing', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        searchQuery: 'some query',
        isSearchMode: true,
        uiState: { isLoading: false, error: null },
        setSearchQuery: mockSetSearchQuery,
        clearSearch: mockClearSearch,
      } as any)

      render(<SearchBar />)

      const searchInput = screen.getByRole('searchbox')
      const clearButton = screen.getByLabelText('Clear search')
      
      // Click somewhere else first to lose focus
      await user.click(document.body)
      expect(searchInput).not.toHaveFocus()
      
      // Clear search
      await user.click(clearButton)
      
      expect(searchInput).toHaveFocus()
    })
  })

  describe('Loading States', () => {
    it('should show loading indicator when searching', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        searchQuery: 'loading query',
        isSearchMode: true,
        uiState: { isLoading: true, error: null },
        setSearchQuery: mockSetSearchQuery,
        clearSearch: mockClearSearch,
      } as any)

      render(<SearchBar />)

      expect(screen.getByLabelText('Searching...')).toBeInTheDocument()
    })

    it('should disable input during loading', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        searchQuery: 'loading query',
        isSearchMode: true,
        uiState: { isLoading: true, error: null },
        setSearchQuery: mockSetSearchQuery,
        clearSearch: mockClearSearch,
      } as any)

      render(<SearchBar />)

      const searchInput = screen.getByRole('searchbox')
      expect(searchInput).toBeDisabled()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should handle Escape key to clear search', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        searchQuery: 'some query',
        isSearchMode: true,
        uiState: { isLoading: false, error: null },
        setSearchQuery: mockSetSearchQuery,
        clearSearch: mockClearSearch,
      } as any)

      render(<SearchBar />)

      const searchInput = screen.getByRole('searchbox')
      searchInput.focus()
      await user.keyboard('{Escape}')

      expect(mockClearSearch).toHaveBeenCalled()
    })

    it('should handle Enter key to trigger immediate search', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<SearchBar />)

      const searchInput = screen.getByRole('searchbox')
      await user.type(searchInput, 'enter query')
      await user.keyboard('{Enter}')

      // Should call immediately, not wait for debounce
      expect(mockSetSearchQuery).toHaveBeenCalledWith('enter query')
    })

    it('should handle Tab navigation correctly', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        searchQuery: 'some query',
        isSearchMode: true,
        uiState: { isLoading: false, error: null },
        setSearchQuery: mockSetSearchQuery,
        clearSearch: mockClearSearch,
      } as any)

      render(
        <div>
          <button>Previous element</button>
          <SearchBar />
          <button>Next element</button>
        </div>
      )

      const prevButton = screen.getByText('Previous element')
      const searchInput = screen.getByRole('searchbox')
      const clearButton = screen.getByLabelText('Clear search')
      const nextButton = screen.getByText('Next element')

      // Tab through elements
      prevButton.focus()
      await user.keyboard('{Tab}')
      expect(searchInput).toHaveFocus()

      await user.keyboard('{Tab}')
      expect(clearButton).toHaveFocus()

      await user.keyboard('{Tab}')
      expect(nextButton).toHaveFocus()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<SearchBar />)

      const searchInput = screen.getByRole('searchbox')
      expect(searchInput).toHaveAttribute('aria-label', 'Search services')
      expect(searchInput).toHaveAttribute('aria-describedby', 'search-description')
    })

    it('should have descriptive text for screen readers', () => {
      render(<SearchBar />)

      expect(screen.getByText('Search for container services by name, description, or category')).toBeInTheDocument()
    })

    it('should announce search results count to screen readers', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        searchQuery: 'docker',
        isSearchMode: true,
        uiState: { isLoading: false, error: null },
        setSearchQuery: mockSetSearchQuery,
        clearSearch: mockClearSearch,
        searchResultsCount: 42,
      } as any)

      render(<SearchBar />)

      expect(screen.getByText('42 services found')).toBeInTheDocument()
      expect(screen.getByLabelText('Search results')).toBeInTheDocument()
    })

    it('should have proper focus management', async () => {
      const user = userEvent.setup({ delay: null }) // Disable delay to prevent timeouts
      render(<SearchBar />)

      const searchInput = screen.getByRole('searchbox')
      
      await user.click(searchInput)
      expect(searchInput).toHaveFocus()
      expect(searchInput).toHaveClass('search-bar__input--focused')
    })
  })

  describe('Error Handling', () => {
    it('should display error state when search fails', () => {
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        searchQuery: 'failed query',
        isSearchMode: true,
        uiState: { 
          isLoading: false, 
          error: new Error('Search failed') 
        },
        setSearchQuery: mockSetSearchQuery,
        clearSearch: mockClearSearch,
      } as any)

      render(<SearchBar />)

      expect(screen.getByLabelText('Search error')).toBeInTheDocument()
      expect(screen.getByText('Search failed. Please try again.')).toBeInTheDocument()
    })

    it('should allow retrying search after error', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      vi.mocked(useServiceBrowserStore).mockReturnValue({
        searchQuery: 'failed query',
        isSearchMode: true,
        uiState: { 
          isLoading: false, 
          error: new Error('Search failed') 
        },
        setSearchQuery: mockSetSearchQuery,
        clearSearch: mockClearSearch,
      } as any)

      render(<SearchBar />)

      const searchInput = screen.getByRole('searchbox')
      await user.type(searchInput, ' retry')
      
      act(() => {
        vi.advanceTimersByTime(300)
      })

      expect(mockSetSearchQuery).toHaveBeenCalledWith('failed query retry')
    })
  })

  describe('Edge Cases', () => {
    it('should handle extremely long search queries', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<SearchBar />)

      const longQuery = 'a'.repeat(1000)
      const searchInput = screen.getByRole('searchbox')
      
      await user.type(searchInput, longQuery)
      
      act(() => {
        vi.advanceTimersByTime(300)
      })

      // Should truncate or handle long queries appropriately
      expect(mockSetSearchQuery).toHaveBeenCalledWith(longQuery.slice(0, 100)) // Assuming 100 char limit
    })

    it('should handle special characters in search', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<SearchBar />)

      const specialQuery = 'test@#$%^&*()_+{}|:"<>?'
      const searchInput = screen.getByRole('searchbox')
      
      // Change event to input literal special characters without keyboard descriptor parsing
      fireEvent.change(searchInput, { target: { value: specialQuery } })
      
      act(() => {
        vi.advanceTimersByTime(300)
      })

      expect(mockSetSearchQuery).toHaveBeenCalledWith(specialQuery)
    })

    it('should handle rapid typing and clearing', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<SearchBar />)

      const searchInput = screen.getByRole('searchbox')
      
      // Type, clear, type again rapidly
      await user.type(searchInput, 'first')
      await user.clear(searchInput)
      await user.type(searchInput, 'second')
      
      act(() => {
        vi.advanceTimersByTime(300)
      })

      expect(mockSetSearchQuery).toHaveBeenCalledWith('second')
    })
  })

  describe('Props and Customization', () => {
    it('should accept custom placeholder text', () => {
      render(<SearchBar placeholder="Find your service..." />)

      const searchInput = screen.getByRole('searchbox')
      expect(searchInput).toHaveAttribute('placeholder', 'Find your service...')
    })

    it('should accept custom className', () => {
      render(<SearchBar className="custom-search-bar" />)

      const searchBar = screen.getByTestId('search-bar')
      expect(searchBar).toHaveClass('custom-search-bar')
    })

    it('should support disabled state', () => {
      render(<SearchBar disabled />)

      const searchInput = screen.getByRole('searchbox')
      expect(searchInput).toBeDisabled()
    })

    it('should support custom debounce delay', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<SearchBar debounceMs={500} />)

      const searchInput = screen.getByRole('searchbox')
      await user.type(searchInput, 'test')
      
      // Should not call after 300ms
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(mockSetSearchQuery).not.toHaveBeenCalled()
      
      // Should call after 500ms
      act(() => {
        vi.advanceTimersByTime(200)
      })
      expect(mockSetSearchQuery).toHaveBeenCalledWith('test')
    })
  })
})