import { renderHook, act } from '@testing-library/react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useServiceBrowserURL, useURLParams, useActiveURLFilters } from '../useServiceBrowserURL'
import { useServiceBrowserStore } from '@/store/service-browser'

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
  usePathname: vi.fn(),
}))

// Mock the service browser store
vi.mock('@/store/service-browser', () => ({
  useServiceBrowserStore: vi.fn(),
}))

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
}

const mockSearchParams = new Map([
  ['q', 'test query'],
  ['categories', 'development,devops'],
  ['tags', 'api,rest'],
  ['sortBy', 'alphabetical'],
  ['view', 'list'],
  ['minRating', '4'],
])

const mockSearchParamsEmpty = new Map()

// Helper function to create URLSearchParams-like object
const createMockSearchParams = (params: Map<string, string>) => ({
  get: (key: string) => params.get(key),
  has: (key: string) => params.has(key),
  toString: () => {
    const entries = Array.from(params.entries())
    return entries.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')
  },
  forEach: (callback: (value: string, key: string) => void) => {
    params.forEach(callback)
  },
})

const mockUseRouter = useRouter as MockedFunctionFunction<typeof useRouter>
const mockUseSearchParams = useSearchParams as MockedFunctionFunction<typeof useSearchParams>
const mockUsePathname = usePathname as MockedFunctionFunction<typeof usePathname>
const mockUseServiceBrowserStore = useServiceBrowserStore as MockedFunctionFunction<typeof useServiceBrowserStore>

describe('useServiceBrowserURL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockUseRouter.mockReturnValue(mockRouter)
    mockUsePathname.mockReturnValue('/services')
    mockUseSearchParams.mockReturnValue(createMockSearchParams(mockSearchParamsEmpty) as any)
    
    mockUseServiceBrowserStore.mockReturnValue({
      searchQuery: '',
      activeFilters: {
        categories: [],
        tags: [],
        pricing: [],
        popularity: null,
        resources: {},
      },
      sortBy: 'popularity',
      viewMode: 'grid',
      urlSyncEnabled: true,
      syncFromUrl: vi.fn(),
      syncToUrl: vi.fn(),
    } as any)
  })

  it('should initialize correctly with empty URL', () => {
    const { result } = renderHook(() => useServiceBrowserURL())

    expect(result.current.isURLSyncEnabled).toBe(true)
    expect(typeof result.current.syncFromURL).toBe('function')
    expect(typeof result.current.syncToURL).toBe('function')
    expect(typeof result.current.getShareableURL).toBe('function')
  })

  it('should sync from URL when searchParams change', () => {
    const mockSyncFromUrl = vi.fn()
    
    mockUseServiceBrowserStore.mockReturnValue({
      searchQuery: '',
      activeFilters: { categories: [], tags: [], pricing: [], popularity: null, resources: {} },
      sortBy: 'popularity',
      viewMode: 'grid',
      urlSyncEnabled: true,
      syncFromUrl: mockSyncFromUrl,
      syncToUrl: vi.fn(),
    } as any)

    mockUseSearchParams.mockReturnValue(createMockSearchParams(mockSearchParams) as any)

    renderHook(() => useServiceBrowserURL())

    expect(mockSyncFromUrl).toHaveBeenCalled()
  })

  it('should generate shareable URL correctly', () => {
    mockUseServiceBrowserStore.mockReturnValue({
      searchQuery: 'test query',
      activeFilters: {
        categories: ['development', 'devops'],
        tags: ['api'],
        pricing: ['free'],
        popularity: 4.0,
        resources: {},
      },
      sortBy: 'alphabetical',
      viewMode: 'list',
      urlSyncEnabled: true,
      syncFromUrl: vi.fn(),
      syncToUrl: vi.fn(),
    } as any)

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:3000',
      },
      writable: true,
    })

    const { result } = renderHook(() => useServiceBrowserURL())

    const shareableUrl = result.current.getShareableURL()
    
    expect(shareableUrl).toContain('q=test%20query')
    expect(shareableUrl).toContain('categories=development,devops')
    expect(shareableUrl).toContain('tags=api')
    expect(shareableUrl).toContain('pricing=free')
    expect(shareableUrl).toContain('sortBy=alphabetical')
    expect(shareableUrl).toContain('view=list')
    expect(shareableUrl).toContain('minRating=4')
    expect(shareableUrl).toStartWith('http://localhost:3000/services?')
  })

  it('should generate simple URL when no filters are active', () => {
    mockUseServiceBrowserStore.mockReturnValue({
      searchQuery: '',
      activeFilters: { categories: [], tags: [], pricing: [], popularity: null, resources: {} },
      sortBy: 'popularity',
      viewMode: 'grid',
      urlSyncEnabled: true,
      syncFromUrl: vi.fn(),
      syncToUrl: vi.fn(),
    } as any)

    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:3000',
      },
      writable: true,
    })

    const { result } = renderHook(() => useServiceBrowserURL())

    const shareableUrl = result.current.getShareableURL()
    
    expect(shareableUrl).toBe('http://localhost:3000/services')
  })

  it('should not sync to URL when disabled', () => {
    const mockSyncToUrl = vi.fn()
    
    mockUseServiceBrowserStore.mockReturnValue({
      searchQuery: 'test',
      activeFilters: { categories: [], tags: [], pricing: [], popularity: null, resources: {} },
      sortBy: 'popularity',
      viewMode: 'grid',
      urlSyncEnabled: false,
      syncFromUrl: vi.fn(),
      syncToUrl: mockSyncToUrl,
    } as any)

    const { result } = renderHook(() => useServiceBrowserURL())

    act(() => {
      result.current.syncToURL()
    })

    expect(mockSyncToUrl).not.toHaveBeenCalled()
  })

  it('should sync to URL when enabled', () => {
    const mockSyncToUrl = vi.fn()
    
    mockUseServiceBrowserStore.mockReturnValue({
      searchQuery: 'test',
      activeFilters: { categories: [], tags: [], pricing: [], popularity: null, resources: {} },
      sortBy: 'popularity',
      viewMode: 'grid',
      urlSyncEnabled: true,
      syncFromUrl: vi.fn(),
      syncToUrl: mockSyncToUrl,
    } as any)

    const { result } = renderHook(() => useServiceBrowserURL())

    act(() => {
      result.current.syncToURL()
    })

    expect(mockSyncToUrl).toHaveBeenCalled()
  })
})

describe('useURLParams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should parse URL parameters correctly', () => {
    mockUseSearchParams.mockReturnValue(createMockSearchParams(mockSearchParams) as any)

    const { result } = renderHook(() => useURLParams())

    expect(result.current.query).toBe('test query')
    expect(result.current.categories).toEqual(['development', 'devops'])
    expect(result.current.tags).toEqual(['api', 'rest'])
    expect(result.current.sortBy).toBe('alphabetical')
    expect(result.current.minPopularity).toBe(4)
  })

  it('should handle empty URL parameters', () => {
    mockUseSearchParams.mockReturnValue(createMockSearchParams(mockSearchParamsEmpty) as any)

    const { result } = renderHook(() => useURLParams())

    expect(result.current.query).toBeUndefined()
    expect(result.current.categories).toBeUndefined()
    expect(result.current.tags).toBeUndefined()
    expect(result.current.sortBy).toBeUndefined()
    expect(result.current.minPopularity).toBeUndefined()
  })

  it('should handle single value parameters', () => {
    const singleParams = new Map([
      ['q', 'single query'],
      ['categories', 'development'],
    ])
    
    mockUseSearchParams.mockReturnValue(createMockSearchParams(singleParams) as any)

    const { result } = renderHook(() => useURLParams())

    expect(result.current.query).toBe('single query')
    expect(result.current.categories).toEqual(['development'])
  })
})

describe('useActiveURLFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSearchParams.mockReturnValue(createMockSearchParams(mockSearchParams) as any)
  })

  it('should check if filter exists', () => {
    const { result } = renderHook(() => useActiveURLFilters())

    expect(result.current.hasFilter('q')).toBe(true)
    expect(result.current.hasFilter('categories')).toBe(true)
    expect(result.current.hasFilter('nonexistent')).toBe(false)
  })

  it('should check if specific filter value exists', () => {
    const { result } = renderHook(() => useActiveURLFilters())

    expect(result.current.hasFilter('categories', 'development')).toBe(true)
    expect(result.current.hasFilter('categories', 'database')).toBe(false)
    expect(result.current.hasFilter('q', 'test query')).toBe(true)
    expect(result.current.hasFilter('q', 'different query')).toBe(false)
  })

  it('should get filter values', () => {
    const { result } = renderHook(() => useActiveURLFilters())

    expect(result.current.getFilter('q')).toBe('test query')
    expect(result.current.getFilter('categories')).toEqual(['development', 'devops'])
    expect(result.current.getFilter('tags')).toEqual(['api', 'rest'])
    expect(result.current.getFilter('nonexistent')).toBe(null)
  })

  it('should get all filters', () => {
    const { result } = renderHook(() => useActiveURLFilters())

    const allFilters = result.current.getAllFilters()

    expect(allFilters).toEqual({
      categories: ['development', 'devops'],
      tags: ['api', 'rest'],
      pricing: [],
      popularity: 4,
      resources: {},
    })
  })

  it('should get search query', () => {
    const { result } = renderHook(() => useActiveURLFilters())

    expect(result.current.searchQuery).toBe('test query')
  })

  it('should handle empty search query', () => {
    mockUseSearchParams.mockReturnValue(createMockSearchParams(mockSearchParamsEmpty) as any)

    const { result } = renderHook(() => useActiveURLFilters())

    expect(result.current.searchQuery).toBe('')
  })

  it('should handle filters without comma separation', () => {
    const singleValueParams = new Map([
      ['categories', 'development'],
      ['minRating', '3'],
    ])
    
    mockUseSearchParams.mockReturnValue(createMockSearchParams(singleValueParams) as any)

    const { result } = renderHook(() => useActiveURLFilters())

    expect(result.current.getFilter('categories')).toBe('development')
    expect(result.current.getAllFilters()).toEqual({
      categories: ['development'],
      tags: [],
      pricing: [],
      popularity: 3,
      resources: {},
    })
  })
})