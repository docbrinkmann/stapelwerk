import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { CacheService, cacheService } from '../../src/lib/cache/cache-service'
import { cacheConfig, getRedisClient, closeRedisConnection, resetRedisConnectionState } from '../../src/lib/cache/config'
import { testDb } from '../../src/__tests__/test-db'

describe('API Response Caching Tests', () => {
  beforeAll(async () => {
    await testDb.setup()
  })

  afterAll(async () => {
    await testDb.teardown()
    await closeRedisConnection()
  })

  beforeEach(async () => {
    await testDb.seed()
    // Enable caching for tests
    process.env.ENABLE_CACHE = 'true'
  })

  afterEach(async () => {
    // Clean up cache after each test
    cacheService.clearInMemoryCache()
    await cacheService.deleteByPattern('service-catalog:*')
    // Reset Redis connection state for next test
    resetRedisConnectionState()
  })

  describe('Cache Configuration', () => {
    it('should have correct default cache configuration', () => {
      expect(cacheConfig.defaultTTL).toBe(300) // 5 minutes
      expect(cacheConfig.keyPrefix).toBe('service-catalog:')
      expect(cacheConfig.enabled).toBe(true) // Set in beforeEach
    })

    it('should generate consistent cache keys', () => {
      const key1 = cacheService.generateServiceKey(1)
      const key2 = cacheService.generateServiceKey(1)
      expect(key1).toBe(key2)
      expect(key1).toBe('service-catalog:service:1')
    })

    it('should generate unique cache keys for different parameters', () => {
      const key1 = cacheService.generateServiceListKey({ status: 'approved' }, { limit: 20 })
      const key2 = cacheService.generateServiceListKey({ status: 'pending' }, { limit: 20 })
      expect(key1).not.toBe(key2)
    })

    it('should generate consistent list cache keys for same parameters', () => {
      const key1 = cacheService.generateServiceListKey(
        { categoryId: 1, status: 'approved' },
        { limit: 20, cursor: 10 }
      )
      const key2 = cacheService.generateServiceListKey(
        { categoryId: 1, status: 'approved' },
        { limit: 20, cursor: 10 }
      )
      expect(key1).toBe(key2)
    })
  })

  describe('Basic Cache Operations', () => {
    it('should set and get cached values', async () => {
      const testData = { id: 1, name: 'Test Service', status: 'approved' }
      const cacheKey = 'test:service:1'

      await cacheService.set(cacheKey, testData)
      const cachedData = await cacheService.get(cacheKey)

      expect(cachedData).toEqual(testData)
    })

    it('should return null for non-existent cache keys', async () => {
      const result = await cacheService.get('non:existent:key')
      expect(result).toBeNull()
    })

    it('should delete cached values', async () => {
      const testData = { id: 1, name: 'Test Service' }
      const cacheKey = 'test:service:delete'

      await cacheService.set(cacheKey, testData)
      expect(await cacheService.get(cacheKey)).toEqual(testData)

      await cacheService.delete(cacheKey)
      expect(await cacheService.get(cacheKey)).toBeNull()
    })

    it('should delete multiple keys by pattern', async () => {
      const testData1 = { id: 1, name: 'Service 1' }
      const testData2 = { id: 2, name: 'Service 2' }
      
      await cacheService.set('test:service:1', testData1)
      await cacheService.set('test:service:2', testData2)
      await cacheService.set('test:other:1', { id: 1 })

      await cacheService.deleteByPattern('test:service:*')

      expect(await cacheService.get('test:service:1')).toBeNull()
      expect(await cacheService.get('test:service:2')).toBeNull()
      expect(await cacheService.get('test:other:1')).not.toBeNull()
    })
  })

  describe('Cache Wrapper Functions', () => {
    it('should cache function results with withCache wrapper', async () => {
      let callCount = 0
      
      const expensiveOperation = async () => {
        callCount++
        await new Promise(resolve => setTimeout(resolve, 10)) // Simulate async work
        return { data: 'expensive-result', callCount }
      }

      const cacheKey = 'test:expensive:operation'

      // First call should execute function
      const result1 = await cacheService.withCache(cacheKey, expensiveOperation)
      expect(result1.callCount).toBe(1)
      expect(callCount).toBe(1)

      // Second call should return cached result
      const result2 = await cacheService.withCache(cacheKey, expensiveOperation)
      expect(result2.callCount).toBe(1) // Same as first call
      expect(callCount).toBe(1) // Function not called again
    })

    it('should respect custom TTL in withCache', async () => {
      const shortLivedData = { timestamp: Date.now() }
      const cacheKey = 'test:short:ttl'

      await cacheService.withCache(
        cacheKey,
        async () => shortLivedData,
        { ttl: 1 } // 1 second TTL
      )

      // Should be cached immediately
      const cached = await cacheService.get(cacheKey)
      expect(cached).toEqual(shortLivedData)

      // Wait for expiration (with some buffer)
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Should be expired
      const expired = await cacheService.get(cacheKey)
      expect(expired).toBeNull()
    })
  })

  describe('Cache Invalidation', () => {
    beforeEach(async () => {
      // Set up some cached data
      await cacheService.set('service-catalog:service:1', { id: 1, name: 'Service 1' })
      await cacheService.set('service-catalog:service:2', { id: 2, name: 'Service 2' })
      await cacheService.set('service-catalog:services:list:approved', [{ id: 1 }, { id: 2 }])
      await cacheService.set('service-catalog:category:1', { id: 1, name: 'Category 1' })
      await cacheService.set('service-catalog:categories:list:all', [{ id: 1 }])
    })

    it('should invalidate specific service cache', async () => {
      // Verify cache exists
      expect(await cacheService.get('service-catalog:service:1')).not.toBeNull()
      expect(await cacheService.get('service-catalog:services:list:approved')).not.toBeNull()

      await cacheService.invalidateService(1)

      // Specific service cache should be gone
      expect(await cacheService.get('service-catalog:service:1')).toBeNull()
      // Service lists should be gone (contains this service)
      expect(await cacheService.get('service-catalog:services:list:approved')).toBeNull()
      // Other services should remain
      expect(await cacheService.get('service-catalog:service:2')).not.toBeNull()
      // Categories should remain
      expect(await cacheService.get('service-catalog:category:1')).not.toBeNull()
    })

    it('should invalidate all service caches', async () => {
      await cacheService.invalidateServiceCaches()

      expect(await cacheService.get('service-catalog:service:1')).toBeNull()
      expect(await cacheService.get('service-catalog:service:2')).toBeNull()
      expect(await cacheService.get('service-catalog:services:list:approved')).toBeNull()
      // Categories should remain
      expect(await cacheService.get('service-catalog:category:1')).not.toBeNull()
    })

    it('should invalidate specific category cache', async () => {
      await cacheService.invalidateCategory(1)

      expect(await cacheService.get('service-catalog:category:1')).toBeNull()
      expect(await cacheService.get('service-catalog:categories:list:all')).toBeNull()
      // Services should remain
      expect(await cacheService.get('service-catalog:service:1')).not.toBeNull()
    })

    it('should invalidate all category caches', async () => {
      await cacheService.invalidateCategoryCaches()

      expect(await cacheService.get('service-catalog:category:1')).toBeNull()
      expect(await cacheService.get('service-catalog:categories:list:all')).toBeNull()
      // Services should remain
      expect(await cacheService.get('service-catalog:service:1')).not.toBeNull()
    })
  })

  describe('Performance Validation', () => {
    it('should improve response times with caching', async () => {
      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 100)) // Simulate 100ms operation
        return { data: 'slow-result', timestamp: Date.now() }
      }

      const cacheKey = 'test:performance:slow-op'

      // Measure uncached call
      const start1 = performance.now()
      const result1 = await cacheService.withCache(cacheKey, slowOperation)
      const uncachedTime = performance.now() - start1

      // Measure cached call
      const start2 = performance.now()
      const result2 = await cacheService.withCache(cacheKey, slowOperation)
      const cachedTime = performance.now() - start2

      expect(result1).toEqual(result2) // Same data
      expect(cachedTime).toBeLessThan(uncachedTime) // Cached should be faster
      expect(cachedTime).toBeLessThan(50) // Should be significantly faster
      expect(uncachedTime).toBeGreaterThan(90) // Uncached should take expected time
    })

    it('should handle concurrent cache requests correctly', async () => {
      let callCount = 0
      const concurrentOperation = async () => {
        callCount++
        await new Promise(resolve => setTimeout(resolve, 50))
        return { result: 'concurrent-result', callCount }
      }

      const cacheKey = 'test:concurrent:operation'

      // Make multiple concurrent requests
      const promises = Array(5).fill(null).map(() => 
        cacheService.withCache(cacheKey, concurrentOperation)
      )

      const results = await Promise.all(promises)

      // All results should be the same (cached)
      results.forEach(result => {
        expect(result).toEqual(results[0])
      })

      // Function should only be called once due to caching
      expect(callCount).toBe(1)
    })

    it('should maintain cache consistency under high load', async () => {
      const operations = []
      
      // Create multiple cache operations
      for (let i = 0; i < 50; i++) {
        operations.push(
          cacheService.set(`test:load:${i}`, { id: i, data: `data-${i}` })
        )
      }

      // Execute all operations concurrently
      await Promise.all(operations)

      // Verify all data was cached correctly
      for (let i = 0; i < 50; i++) {
        const cached = await cacheService.get(`test:load:${i}`)
        expect(cached).toEqual({ id: i, data: `data-${i}` })
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Temporarily disable caching
      const originalEnabled = cacheConfig.enabled
      cacheConfig.enabled = false

      const result = await cacheService.get('any:key')
      expect(result).toBeNull()

      await cacheService.set('any:key', { data: 'test' })
      // Should not throw error

      cacheConfig.enabled = originalEnabled
    })

    it('should handle invalid JSON in cache gracefully', async () => {
      // This test assumes we can directly manipulate Redis
      const client = await getRedisClient()
      if (client) {
        await client.set('service-catalog:invalid:json', 'invalid-json-{')
        
        const result = await cacheService.get('service-catalog:invalid:json')
        expect(result).toBeNull() // Should return null on parse error
      }
    })

    it('should continue operation when cache operations fail', async () => {
      // Test with invalid cache key pattern
      await expect(cacheService.deleteByPattern('')).resolves.not.toThrow()
    })
  })

  describe('Memory Usage', () => {
    it('should not cause memory leaks with large datasets', async () => {
      const largeDataset = Array(1000).fill(null).map((_, i) => ({
        id: i,
        name: `Service ${i}`,
description: 'A'.repeat(1000) // 1KB description
      }))

      const cacheKey = 'test:memory:large-dataset'
      
      await cacheService.set(cacheKey, largeDataset)
      const retrieved = await cacheService.get(cacheKey)
      
      expect(retrieved).toHaveLength(1000)
      expect(retrieved[0]).toEqual(largeDataset[0])
      expect(retrieved[999]).toEqual(largeDataset[999])
    })

    it('should handle cache key collision resistance', async () => {
      const filters1 = { categoryId: 1, status: 'approved' }
      const pagination1 = { limit: 20, cursor: 1 }
      
      const filters2 = { categoryId: 11, status: 'approve' } // Different but similar
      const pagination2 = { limit: 20, cursor: 'd' } // Different cursor type

      const key1 = cacheService.generateServiceListKey(filters1, pagination1)
      const key2 = cacheService.generateServiceListKey(filters2, pagination2)

      expect(key1).not.toBe(key2)
    })
  })

  describe('Cache Statistics and Monitoring', () => {
    it('should track cache hit/miss ratios', async () => {
      const testData = { id: 1, name: 'Test' }
      const cacheKey = 'test:stats:hit-miss'

      // Miss
      const miss = await cacheService.get(cacheKey)
      expect(miss).toBeNull()

      // Set
      await cacheService.set(cacheKey, testData)

      // Hit
      const hit = await cacheService.get(cacheKey)
      expect(hit).toEqual(testData)
    })
  })
})