import { getRedisClient, cacheConfig, generateCacheKey, generateListCacheKey } from './config'

// In-memory cache fallback for testing
class InMemoryCache {
  private cache = new Map<string, { value: any; expires: number }>()
  private timers = new Map<string, NodeJS.Timeout>()

  set(key: string, value: any, ttlSeconds: number): void {
    // Clear existing timer if any
    const existingTimer = this.timers.get(key)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const expires = Date.now() + (ttlSeconds * 1000)
    this.cache.set(key, { value, expires })

    // Set expiration timer
    const timer = setTimeout(() => {
      this.cache.delete(key)
      this.timers.delete(key)
    }, ttlSeconds * 1000)
    
    this.timers.set(key, timer)
  }

  get(key: string): any | null {
    const item = this.cache.get(key)
    if (!item) return null
    
    if (Date.now() > item.expires) {
      this.cache.delete(key)
      const timer = this.timers.get(key)
      if (timer) {
        clearTimeout(timer)
        this.timers.delete(key)
      }
      return null
    }
    
    return item.value
  }

  delete(key: string): void {
    this.cache.delete(key)
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }
  }

  deleteByPattern(pattern: string): void {
    // Convert glob pattern to regex
    const regexPattern = pattern.replace(/\*/g, '.*')
    const regex = new RegExp(regexPattern)
    
    for (const key of Array.from(this.cache.keys())) {
      if (regex.test(key)) {
        this.delete(key)
      }
    }
  }

  clear(): void {
    for (const timer of Array.from(this.timers.values())) {
      clearTimeout(timer)
    }
    this.cache.clear()
    this.timers.clear()
  }
}

const inMemoryCache = new InMemoryCache()

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  prefix?: string
}

export class CacheService {
  private static instance: CacheService | null = null
  private pendingOperations = new Map<string, Promise<any>>()

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }
    return CacheService.instance
  }

  /**
   * Get cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    if (!cacheConfig.enabled) {
      return null
    }

    try {
      const client = await getRedisClient()
      if (!client) {
        // Fallback to in-memory cache
        return inMemoryCache.get(key) as T | null
      }

      const cached = await client.get(key)
      if (!cached) {
        return null
      }

      return JSON.parse(cached) as T
    } catch (error) {
      console.warn('Cache get error, using in-memory fallback:', error)
      return inMemoryCache.get(key) as T | null
    }
  }

  /**
   * Set cached value with optional TTL
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    if (!cacheConfig.enabled) {
      return
    }

    try {
      const client = await getRedisClient()
      const ttl = options.ttl || cacheConfig.defaultTTL
      
      if (!client) {
        // Fallback to in-memory cache
        inMemoryCache.set(key, value, ttl)
        return
      }

      const serialized = JSON.stringify(value)
      await client.setEx(key, ttl, serialized)
    } catch (error) {
      console.warn('Cache set error, using in-memory fallback:', error)
      const ttl = options.ttl || cacheConfig.defaultTTL
      inMemoryCache.set(key, value, ttl)
    }
  }

  /**
   * Delete cached value by key
   */
  async delete(key: string): Promise<void> {
    if (!cacheConfig.enabled) {
      return
    }

    try {
      const client = await getRedisClient()
      if (!client) {
        // Fallback to in-memory cache
        inMemoryCache.delete(key)
        return
      }

      await client.del(key)
    } catch (error) {
      console.warn('Cache delete error, using in-memory fallback:', error)
      inMemoryCache.delete(key)
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deleteByPattern(pattern: string): Promise<void> {
    if (!cacheConfig.enabled) {
      return
    }

    try {
      const client = await getRedisClient()
      if (!client) {
        // Fallback to in-memory cache
        inMemoryCache.deleteByPattern(pattern)
        return
      }

      const keys = await client.keys(pattern)
      if (keys.length > 0) {
        await client.del(keys)
      }
    } catch (error) {
      console.warn('Cache deleteByPattern error, using in-memory fallback:', error)
      inMemoryCache.deleteByPattern(pattern)
    }
  }

  /**
   * Wrap a function with caching
   */
  async withCache<T>(
    key: string,
    fn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Check if this operation is already in progress
    const existingOperation = this.pendingOperations.get(key)
    if (existingOperation) {
      return existingOperation as Promise<T>
    }

    // Execute function and cache result
    const operationPromise = this.executeAndCache(key, fn, options)
    this.pendingOperations.set(key, operationPromise)
    
    try {
      const result = await operationPromise
      return result
    } finally {
      // Clean up pending operation
      this.pendingOperations.delete(key)
    }
  }

  private async executeAndCache<T>(
    key: string,
    fn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Check cache once more in case it was set by another process
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const result = await fn()
    await this.set(key, result, options)
    
    return result
  }

  /**
   * Generate cache key for service-related operations
   */
  generateServiceKey(id: number): string {
    return generateCacheKey('service', id)
  }

  /**
   * Generate cache key for category-related operations
   */
  generateCategoryKey(id: number): string {
    return generateCacheKey('category', id)
  }

  /**
   * Generate cache key for service lists
   */
  generateServiceListKey(
    filters: Record<string, any> = {},
    pagination: { limit?: number; cursor?: string | number } = {}
  ): string {
    return generateListCacheKey('services', filters, pagination)
  }

  /**
   * Generate cache key for category lists
   */
  generateCategoryListKey(
    filters: Record<string, any> = {},
    pagination: { limit?: number; cursor?: string | number } = {}
  ): string {
    return generateListCacheKey('categories', filters, pagination)
  }

  /**
   * Invalidate all service-related caches
   */
  async invalidateServiceCaches(): Promise<void> {
    await Promise.all([
      this.deleteByPattern(`${cacheConfig.keyPrefix}service:*`),
      this.deleteByPattern(`${cacheConfig.keyPrefix}services:*`)
    ])
  }

  /**
   * Invalidate all category-related caches
   */
  async invalidateCategoryCaches(): Promise<void> {
    await Promise.all([
      this.deleteByPattern(`${cacheConfig.keyPrefix}category:*`),
      this.deleteByPattern(`${cacheConfig.keyPrefix}categories:*`)
    ])
  }

  /**
   * Invalidate specific service cache
   */
  async invalidateService(id: number): Promise<void> {
    await Promise.all([
      this.delete(this.generateServiceKey(id)),
      this.deleteByPattern(`${cacheConfig.keyPrefix}services:*`) // Invalidate lists containing this service
    ])
  }

  /**
   * Invalidate specific category cache
   */
  async invalidateCategory(id: number): Promise<void> {
    await Promise.all([
      this.delete(this.generateCategoryKey(id)),
      this.deleteByPattern(`${cacheConfig.keyPrefix}categories:*`) // Invalidate lists containing this category
    ])
  }

  /**
   * Clear in-memory cache (for testing)
   */
  clearInMemoryCache(): void {
    inMemoryCache.clear()
    this.pendingOperations.clear()
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance()
