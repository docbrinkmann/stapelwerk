/**
 * TypeScript interfaces and types for Service Browser UI components
 * Defines the shape of data and props used throughout the service browser
 */


/**
 * Service port configuration
 */
export interface ServicePort {
  containerPort: number
  protocol: 'TCP' | 'UDP' | 'SCTP'
  description?: string
  name?: string
  hostPort?: number
}

/**
 * Service environment variable configuration
 */
export interface ServiceEnvironmentVariable {
  name: string
  description?: string
  required: boolean
  defaultValue?: string
  type?: 'string' | 'number' | 'boolean' | 'secret'
}

/**
 * Service volume configuration
 */
export interface ServiceVolume {
  containerPath: string
  hostPath?: string
  description?: string
  readOnly?: boolean
  type?: 'bind' | 'volume' | 'tmpfs'
}

/**
 * Resource requirements for a service
 */
export interface ResourceRequirements {
  cpu?: string
  memory?: string
  disk?: string
  // Additional computed fields
  estimatedUsage?: 'light' | 'medium' | 'heavy'
}

/**
 * Category information
 */
export interface ServiceCategory {
  id: string
  name: string
  slug: string
  description?: string
  serviceCount?: number
  icon?: string
}

/**
 * Search and pagination parameters
 */
export interface ServiceSearchParams {
  query?: string
  category?: string
  categories?: string[]
  tags?: string[]
  pricing?: string[]
  sortBy?: ServiceSortBy
  orderBy?: 'asc' | 'desc'
  limit?: number
  cursor?: string
  page?: number
  featured?: boolean
  minPopularity?: number
  minCpu?: number
  minMemory?: number
}


/**
 * Props for service card components
 */
export interface ServiceCardProps {
  service: Service
  onClick?: (service: Service) => void
  onAddToStack?: (service: Service) => void
  className?: string
  variant?: 'grid' | 'list' | 'compact'
  showAddButton?: boolean
  showCategory?: boolean
  showResourceInfo?: boolean
  isSelected?: boolean
}

/**
 * Props for service grid/list containers
 */
export interface ServiceGridProps {
  services: Service[]
  loading?: boolean
  error?: string | null
  onServiceClick?: (service: Service) => void
  onAddToStack?: (service: Service) => void
  onLoadMore?: () => void
  hasMore?: boolean
  className?: string
  variant?: 'grid' | 'list'
  emptyMessage?: string
  loadingMore?: boolean
}

/**
 * Props for search components
 */
export interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  placeholder?: string
  debounceMs?: number
  className?: string
  disabled?: boolean
  autoFocus?: boolean
}

/**
 * Props for filter components
 */
export interface FilterPanelProps {
  activeFilters: ServiceFilterState
  onFiltersChange: (filters: Partial<ServiceFilterState>) => void
  onReset?: () => void
  categories?: ServiceCategory[]
  className?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
}

/**
 * Props for service modal/preview components
 */
export interface ServiceModalProps {
  service: Service | null
  isOpen: boolean
  onClose: () => void
  onAddToStack?: (service: Service) => void
  onViewDetails?: (service: Service) => void
  className?: string
}

/**
 * Props for infinite scroll components
 */
export interface InfiniteScrollProps {
  onLoadMore: () => void
  hasMore: boolean
  loading?: boolean
  threshold?: number
  rootMargin?: string
  disabled?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Hook return types for service browser functionality
 */
export interface UseServiceSearchResult {
  services: Service[]
  isLoading: boolean
  isLoadingMore: boolean
  error: Error | null
  hasNextPage: boolean
  loadMore: () => void
  refetch: () => void
  totalCount?: number
}

export interface UseServiceFiltersResult {
  filters: ServiceFilterState
  updateFilter: <K extends keyof ServiceFilterState>(
    key: K,
    value: ServiceFilterState[K]
  ) => void
  resetFilters: () => void
  hasActiveFilters: boolean
  buildSearchParams: () => ServiceSearchParams
}

/**
 * Error types specific to service browser
 */
export interface ServiceBrowserError extends Error {
  code?: string
  statusCode?: number
  context?: {
    searchParams?: ServiceSearchParams
    filters?: ServiceFilterState
    service?: Partial<Service>
  }
}

/**
 * Loading states for different parts of the service browser
 */
export interface ServiceBrowserLoadingStates {
  initialLoad: boolean
  loadingMore: boolean
  searching: boolean
  filtering: boolean
  loadingService: boolean
}

/**
 * Analytics events for service browser tracking
 */
export interface ServiceBrowserAnalyticsEvent {
  type: 'service_view' | 'service_search' | 'filter_change' | 'add_to_stack'
  service?: Service
  searchQuery?: string
  filters?: ServiceFilterState
  timestamp: Date
  metadata?: Record<string, any>
}

/**
 * Configuration for responsive behavior
 */
export interface ResponsiveConfig {
  breakpoints: {
    mobile: number
    tablet: number
    desktop: number
  }
  gridColumns: {
    mobile: number
    tablet: number
    desktop: number
  }
  servicesPerPage: {
    mobile: number
    tablet: number
    desktop: number
  }
}

/**
 * Performance monitoring types
 */
export interface PerformanceMetrics {
  searchTime: number
  renderTime: number
  loadTime: number
  infiniteScrollLatency: number
  apiResponseTime: number
}

/**
 * Service Browser Store State Interfaces
 */
export interface ServiceFilterState {
  categories: string[]
  tags: string[]
  pricing: string[]
  pricingTypes: string[]
  popularity: number | null
  minPopularity?: number | null
  resources: {
    minCpu?: number
    minMemory?: number
  }
  companySize: string[]
  hasFreeTier: boolean | null
}

// Filters shape used by URL sync utilities and tests
export interface ServiceBrowserFilters {
  categories: string[]
  subcategories: string[]
  tags: string[]
  pricingTypes: string[]
  features: string[]
  integrations: string[]
  companySize: string[]
  minPopularity: number | null
  hasFreeTier: boolean | null
}

// Type alias for backwards compatibility and URL sync utilities
export type ServiceFilters = ServiceBrowserFilters

export interface ServiceBrowserUIState {
  isLoading: boolean
  error: string | null
  gridColumns: number
  showSkeleton: boolean
}

export interface ServiceBrowserModalState {
  isOpen: boolean
  service: Service | null
  isLoading: boolean
  error: string | null
}

/**
 * Service data structure with extended fields for service browser
 */
export interface Service {
  id: string
  name: string
  description: string
  category: string
  subcategory?: string
  tags: string[]
  pricing: {
    type: 'free' | 'freemium' | 'paid' | 'enterprise'
    freeQuota?: string
    paidPlans?: Array<{
      name: string
      price: string
      features: string[]
    }>
  }
  features: string[]
  integrations: string[]
  documentation: {
    quickStart: string
    apiReference: string
    examples: string[]
  }
  company: {
    name: string
    founded: number
    headquarters: string
    website: string
  }
  metrics: {
    popularity: number
    reliability: number
    performance: number
    documentation: number
    support: number
  }
  status: 'active' | 'deprecated' | 'beta'
  lastUpdated: string
  createdAt: string
}

/**
 * Updated Service List Response interface
 */
export interface ServiceListResponse {
  services: Service[]
  pagination: {
    totalCount: number
    hasNextPage: boolean
    cursor?: string
  }
  filters: {
    categories: string[]
    tags: string[]
    pricing: string[]
  }
}

/**
 * Utility types
 */
export type ServiceSortBy = 'popularity' | 'name' | 'createdAt' | 'updatedAt'
export type SortDirection = 'asc' | 'desc'
export type ViewMode = 'grid' | 'list' | 'compact'
export type ServiceStatus = 'approved' | 'pending' | 'rejected'
export type PopularityLevel = 'high' | 'medium' | 'low'
export type ResourceLevel = 'light' | 'medium' | 'heavy'
