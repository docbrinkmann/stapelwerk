import { render, screen, fireEvent } from '@testing-library/react'
import { ServiceGrid } from '@/components/ServiceGrid'

vi.mock('@/hooks/useInfiniteScroll', () => ({
  useInfiniteServiceBrowserScroll: () => ({
    services: [],
    isLoading: false,
    isLoadingMore: false,
    hasNextPage: false,
    error: new Error('Network error'),
    isEmpty: false,
    loadMore: vi.fn(),
    refetch: vi.fn(),
  })
}))

vi.mock('@/store/service-browser', async () => {
  const actual = await vi.importActual<typeof import('@/store/service-browser')>('@/store/service-browser')
  return {
    ...actual,
    useServiceBrowserStore: () => ({
      viewMode: 'grid',
      itemsPerPage: 12,
      searchQuery: '',
      resetFilters: vi.fn(),
      getActiveFilterCount: () => 0,
      activeFilters: {},
    })
  }
})

describe('ServiceGrid error state', () => {
  it('renders accessible error region with retry button', () => {
    render(<ServiceGrid />)
    const region = screen.getByRole('region', { name: /service grid error/i })
    expect(region).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})