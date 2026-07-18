/**
 * Utility functions for service browser functionality
 * Includes debouncing, formatting, and helper functions
 */

/**
 * Debounce function to limit API calls during rapid user input
 * @param fn Function to debounce
 * @param delay Delay in milliseconds (default: 300ms)
 * @returns Debounced function
 */
export const debounce = <T extends (...args: any[]) => void>(
  fn: T,
  delay: number = 300
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}

/**
 * Format resource requirements for display
 * @param cpu CPU requirement string
 * @param memory Memory requirement string
 * @param disk Disk requirement string
 * @returns Formatted resource string
 */
export const formatResourceRequirements = (
  cpu?: string,
  memory?: string,
  disk?: string
): string => {
  const parts: string[] = []
  
  if (cpu) parts.push(`CPU: ${cpu}`)
  if (memory) parts.push(`RAM: ${memory}`)
  if (disk) parts.push(`Disk: ${disk}`)
  
  return parts.length > 0 ? parts.join(' • ') : 'Not specified'
}

/**
 * Estimate resource usage level based on requirements
 * @param cpu CPU requirement
 * @param memory Memory requirement
 * @returns Estimated usage level
 */
export const estimateResourceUsage = (
  cpu?: string,
  memory?: string
): 'light' | 'medium' | 'heavy' => {
  // Parse memory requirement (assume it's in MB or has unit)
  const memoryNum = memory ? parseFloat(memory.replace(/[^\d.]/g, '')) : 0
  const memoryUnit = memory?.toLowerCase().includes('gb') ? 'gb' : 'mb'
  const memoryInMB = memoryUnit === 'gb' ? memoryNum * 1024 : memoryNum

  // Parse CPU requirement (assume it's in cores)
  const cpuNum = cpu ? parseFloat(cpu.replace(/[^\d.]/g, '')) : 0

  // Determine usage level based on thresholds
  if (memoryInMB <= 512 && cpuNum <= 0.5) return 'light'
  if (memoryInMB <= 2048 && cpuNum <= 2) return 'medium'
  return 'heavy'
}

/**
 * Determine if a service is popular based on its popularity score
 * @param popularity Popularity score (0-100)
 * @returns Whether the service is considered popular
 */
export const isServicePopular = (popularity: number): boolean => {
  return popularity >= 75 // Top 25% are considered popular
}

/**
 * Generate a search-friendly slug from service name
 * @param name Service name
 * @returns URL-safe slug
 */
export const generateServiceSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

/**
 * Truncate text to specified length with ellipsis
 * @param text Text to truncate
 * @param maxLength Maximum length
 * @returns Truncated text
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength).trim() + '...'
}

/**
 * Format port information for display
 * @param ports Array of service ports
 * @returns Formatted port string
 */
export const formatPorts = (ports: Array<{
  containerPort: number
  protocol: string
  description?: string
}>): string => {
  if (ports.length === 0) return 'No ports exposed'
  
  return ports
    .map(port => `${port.containerPort}/${port.protocol.toLowerCase()}`)
    .join(', ')
}

/**
 * Build URL search parameters from service filters
 * @param filters Active service filters
 * @param searchQuery Current search query
 * @returns URLSearchParams object
 */
export const buildSearchParams = (
  filters: Record<string, any>,
  searchQuery?: string
): URLSearchParams => {
  const params = new URLSearchParams()
  
  if (searchQuery?.trim()) {
    params.set('q', searchQuery.trim())
  }
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value) && value.length > 0) {
        params.set(key, value.join(','))
      } else if (!Array.isArray(value)) {
        params.set(key, String(value))
      }
    }
  })
  
  return params
}

/**
 * Parse URL search parameters into service filters
 * @param searchParams URLSearchParams object
 * @returns Parsed filters object
 */
export const parseSearchParams = (
  searchParams: URLSearchParams
): { searchQuery: string; filters: Record<string, any> } => {
  const searchQuery = searchParams.get('q') || ''
  const filters: Record<string, any> = {}
  
  searchParams.forEach((value, key) => {
    if (key !== 'q') {
      // Handle comma-separated arrays
      if (value.includes(',')) {
        filters[key] = value.split(',').map(v => v.trim()).filter(Boolean)
      } else {
        filters[key] = value
      }
    }
  })
  
  return { searchQuery, filters }
}

/**
 * Calculate estimated loading time based on service count
 * @param serviceCount Number of services to load
 * @returns Estimated loading time in milliseconds
 */
export const estimateLoadingTime = (serviceCount: number): number => {
  // Base time + time per service (rough estimate)
  const baseTime = 200 // 200ms base time
  const timePerService = 10 // 10ms per service
  return baseTime + (serviceCount * timePerService)
}

/**
 * Check if viewport is mobile based on width
 * @param width Viewport width
 * @returns Whether viewport is mobile
 */
export const isMobileViewport = (width: number): boolean => {
  return width < 768
}

/**
 * Check if viewport is tablet based on width
 * @param width Viewport width
 * @returns Whether viewport is tablet
 */
export const isTabletViewport = (width: number): boolean => {
  return width >= 768 && width < 1024
}

/**
 * Get responsive grid column count based on viewport width
 * @param width Viewport width
 * @returns Number of columns
 */
export const getGridColumns = (width: number): number => {
  if (width < 768) return 1 // Mobile: 1 column
  if (width < 1024) return 2 // Tablet: 2 columns
  if (width < 1440) return 3 // Desktop: 3 columns
  return 4 // Large desktop: 4 columns
}

/**
 * Calculate optimal services per page based on viewport
 * @param width Viewport width
 * @returns Optimal services per page
 */
export const getOptimalServicesPerPage = (width: number): number => {
  const columns = getGridColumns(width)
  const rows = isMobileViewport(width) ? 8 : 6 // More rows on mobile for scrolling
  return columns * rows
}