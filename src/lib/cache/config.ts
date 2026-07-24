import { createClient } from 'redis'

export interface CacheConfig {
  defaultTTL: number
  keyPrefix: string
  enabled: boolean
  redisUrl?: string
}

export const cacheConfig: CacheConfig = {
  defaultTTL: 300, // 5 minutes in seconds
  keyPrefix: 'service-catalog:',
  enabled: process.env.NODE_ENV === 'production' || 
           process.env.ENABLE_CACHE === 'true' ||
           process.env.NODE_ENV === 'test',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
}

// Redis client singleton
let redisClient: ReturnType<typeof createClient> | null = null

// Track if Redis connection was already attempted and failed
let redisConnectionFailed = false
let redisConnectionPromise: Promise<ReturnType<typeof createClient> | null> | null = null

export async function getRedisClient() {
  if (!cacheConfig.enabled) {
    return null
  }

  // If connection already failed, don't retry for this session
  if (redisConnectionFailed) {
    return null
  }

  if (!redisClient && !redisConnectionPromise) {
    redisConnectionPromise = createRedisClient()
  }

  return redisConnectionPromise
}

async function createRedisClient() {
  try {
    const client = createClient({
      url: cacheConfig.redisUrl,
      socket: {
        connectTimeout: 1000, // Reduced to 1 second for faster fallback
      }
    })

    client.on('error', (err) => {
      console.warn('Redis client error:', err)
      redisConnectionFailed = true
      redisClient = null
    })

    client.on('connect', () => {
      console.log('Redis client connected')
    })

    // Add a timeout for the connection attempt
    const connectPromise = client.connect()
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Redis connection timeout')), 1000)
    })

    await Promise.race([connectPromise, timeoutPromise])
    redisClient = client
    return client
  } catch (error) {
    console.warn('Failed to connect to Redis:', error)
    redisConnectionFailed = true
    redisClient = null
    redisConnectionPromise = null
    return null
  }
}

// Graceful shutdown
export async function closeRedisConnection() {
  if (redisClient) {
    try {
      await redisClient.quit()
    } catch (error) {
      console.warn('Error closing Redis connection:', error)
    }
  }
  // Reset connection state
  redisClient = null
  redisConnectionPromise = null
  redisConnectionFailed = false
}

// Reset connection state (for testing)
export function resetRedisConnectionState() {
  redisClient = null
  redisConnectionPromise = null
  redisConnectionFailed = false
}

// Cache key utilities
export function generateCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${cacheConfig.keyPrefix}${prefix}:${parts.join(':')}`
}

export function generateListCacheKey(
  resource: string,
  filters: Record<string, any> = {},
  pagination: { limit?: number; cursor?: string | number } = {}
): string {
  // Create a consistent hash of filters and pagination for cache key
  const filterHash = Object.keys(filters)
    .sort()
    .map(key => `${key}=${filters[key]}`)
    .join('&')
  
  const paginationStr = pagination.cursor 
    ? `limit=${pagination.limit || 20}&cursor=${pagination.cursor}`
    : `limit=${pagination.limit || 20}`
  
  const queryString = [filterHash, paginationStr].filter(Boolean).join('&')
  
  return generateCacheKey(resource, 'list', queryString)
}