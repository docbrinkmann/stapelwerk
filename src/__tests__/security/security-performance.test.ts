import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { appRouter } from '@/server/root'
import { createTRPCContext } from '@/server/trpc'
import { prisma } from '@/lib/database/prisma'
import { rateLimit, csrfProtection, securityHeaders } from '@/lib/security'
import { NextRequest } from 'next/server'
import { TestDataFactory } from '@/__tests__/helpers/test-data-factory'

/**
 * Security Performance Tests
 * 
 * Test suite ensuring that security processing (input sanitization, validation,
 * rate limiting, CSRF protection) doesn't degrade performance beyond the 500ms
 * requirement from technical specifications.
 */

describe('Security Performance Tests', () => {
  let caller: ReturnType<typeof appRouter.createCaller>

  beforeAll(async () => {
    // Clean test database
    await prisma.service_imports.deleteMany()
    await prisma.services.deleteMany()
    await prisma.categories.deleteMany()
  })

  afterAll(async () => {
    await prisma.service_imports.deleteMany()
    await prisma.services.deleteMany()
    await prisma.categories.deleteMany()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean test database before each test for proper isolation
    await prisma.service_imports.deleteMany()
    await prisma.services.deleteMany()
    await prisma.categories.deleteMany()

    // Create fresh caller with clean context
    const mockReq = {
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Test Client',
        'host': 'localhost:3000',
        'origin': 'http://localhost:3000'
      },
      method: 'POST',
      url: 'http://localhost:3000/api/trpc'
    } as any

    const ctx = await createTRPCContext({
      req: mockReq
    })

    caller = appRouter.createCaller(ctx)
  })

  describe('Input Sanitization Performance', () => {
    it('should sanitize small payloads quickly', async () => {
      const startTime = Date.now()

      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test<script>alert("xss")</script>Category' }))

      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(100) // Should be very fast for small payloads
      expect(category.name).not.toContain('<script>')
      expect(category.description).not.toContain('<img')
    })

    it('should sanitize medium payloads within performance limits', async () => {
      const maliciousScript = '<script>alert("xss")</script>'
      const maliciousImg = '<img src=x onerror=alert("xss")>'
      
      const startTime = Date.now()

      const category = await caller.categories.create({
        name: `Medium${maliciousScript}Test${maliciousImg}Category`,
        slug: TestDataFactory.generateSlug(`Medium${maliciousScript}Test${maliciousImg}Category`),
        description: `This is a medium-length description ${maliciousScript} with multiple ${maliciousImg} malicious patterns embedded throughout the text content`.repeat(5),
        sortOrder: 1
      })

      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(200) // Should handle medium payloads quickly
      expect(category.name).not.toContain('<script>')
      expect(category.description).not.toContain('<img')
    })

    it('should sanitize large payloads within 500ms limit', async () => {
      const maliciousPatterns = [
        '<script>alert("xss1")</script>',
        '<img src=x onerror=alert("xss2")>',
        'onclick=alert("xss3")',
        'javascript:alert("xss4")',
        '<iframe src="javascript:alert(\'xss5\')"></iframe>'
      ]

      const largeName = 'Large' + maliciousPatterns.join('') + 'Name'.repeat(10)
      const largeDescription = maliciousPatterns.map(pattern => 
        `This is a large description with ${pattern} malicious content `.repeat(20)
      ).join(' ')

      const startTime = Date.now()

      const category = await caller.categories.create(TestDataFactory.createCategory(largeName.substring(0, 100)))

      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(500) // Must meet 500ms requirement
      expect(category.name).not.toContain('<script>')
      expect(category.description).not.toContain('<iframe')
    })

    it('should handle complex nested objects without performance degradation', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Performance Test Category' }))

      const maliciousEnvVars = Array.from({ length: 20 }, (_, i) => ({
        name: `VAR_${i}`,
        defaultValue: `<script>alert("env${i}")</script>value${i}<img src=x onerror=alert("env${i}")>`,
        required: false,
        type: 'string' as const,
        description: `Environment variable ${i} with <script>alert("desc${i}")</script> malicious content`
      }))

      const startTime = Date.now()

      const service = await caller.services.create({
        name: 'Complex<script>alert("service")</script>Service',
        description: 'Service with <img src=x onerror=alert("service")>complex nested malicious content',
        dockerImage: 'nginx:latest',
        version: 'latest',
        categoryId: category.id,
        environmentVariables: maliciousEnvVars
      })

      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(500) // Must meet 500ms requirement
      expect(service.name).not.toContain('<script>')
      expect(service.description).not.toContain('<img')
      
      // Verify all nested content was sanitized
      service.environmentVariables.forEach((envVar: any, index: number) => {
        expect(envVar.defaultValue).not.toContain('<script>')
        expect(envVar.defaultValue).not.toContain('<img')
        expect(envVar.description).not.toContain('<script>')
      })
    })
  })

  describe('Rate Limiting Performance', () => {
    it('should process rate limiting quickly for normal requests', async () => {
      const rateLimiter = rateLimit({
        maxRequests: 100,
        windowMs: 60000,
        keyGenerator: () => 'perf-test-1'
      })

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.1'
        }
      })

      const startTime = Date.now()
      const result = await rateLimiter(request)
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(10) // Should be very fast
      expect(result).toBeNull() // Should pass
    })

    it('should handle high-frequency rate limit checks efficiently', async () => {
      const rateLimiter = rateLimit({
        maxRequests: 50,
        windowMs: 60000,
        keyGenerator: (req) => req.headers.get('x-test-ip') || 'unknown'
      })

      const startTime = Date.now()

      // Simulate 100 concurrent rate limit checks
      const promises = Array.from({ length: 100 }, (_, i) => {
        const request = new NextRequest('http://localhost:3000/api/test', {
          method: 'POST',
          headers: {
            'x-test-ip': `192.168.1.${100 + i}`
          }
        })
        return rateLimiter(request)
      })

      const results = await Promise.all(promises)
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(500) // Must handle bulk checks efficiently
      expect(results.every(result => result === null)).toBe(true) // All should pass
    })

    it('should clean up expired entries without blocking requests', async () => {
      const rateLimiter = rateLimit({
        maxRequests: 2,
        windowMs: 50, // Very short window
        keyGenerator: () => 'cleanup-test'
      })

      const request = new NextRequest('http://localhost:3000/api/test')

      // Fill up the rate limit
      await rateLimiter(request)
      await rateLimiter(request)

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 100))

      const startTime = Date.now()
      const result = await rateLimiter(request)
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(50) // Cleanup shouldn't significantly delay requests
      expect(result).toBeNull() // Should pass after cleanup
    })
  })

  describe('CSRF Protection Performance', () => {
    it('should validate CSRF tokens quickly', () => {
      const startTime = Date.now()

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'host': 'localhost:3000',
          'origin': 'http://localhost:3000'
        }
      })

      const result = csrfProtection(request)
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(5) // Should be extremely fast
      expect(result).toBeNull() // Should pass
    })

    it('should handle invalid origins without significant delay', () => {
      const startTime = Date.now()

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'host': 'localhost:3000',
          'origin': 'http://malicious.com'
        }
      })

      const result = csrfProtection(request)
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(10) // Should reject quickly
      expect(result).not.toBeNull() // Should block
    })

    it('should process multiple CSRF checks concurrently', async () => {
      const startTime = Date.now()

      const checks = Array.from({ length: 50 }, (_, i) => {
        const request = new NextRequest('http://localhost:3000/api/test', {
          method: 'POST',
          headers: {
            'host': 'localhost:3000',
            'origin': i % 2 === 0 ? 'http://localhost:3000' : 'http://malicious.com'
          }
        })
        return csrfProtection(request)
      })

      const results = checks
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(100) // Should handle concurrent checks quickly
      expect(results.filter(r => r === null)).toHaveLength(25) // Half should pass
      expect(results.filter(r => r !== null)).toHaveLength(25) // Half should be blocked
    })
  })

  describe('Security Headers Performance', () => {
    it('should generate security headers quickly', () => {
      const startTime = Date.now()
      
      const headers = securityHeaders()
      
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(5) // Should be extremely fast
      expect(Object.keys(headers)).toHaveLength(7) // Should have all required headers
    })

    it('should handle repeated header generation efficiently', () => {
      const startTime = Date.now()

      // Generate headers 1000 times
      for (let i = 0; i < 1000; i++) {
        securityHeaders()
      }

      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(100) // Should handle repetition efficiently
    })
  })

  describe('Combined Security Processing Performance', () => {
    it('should handle full security pipeline within 500ms limit', async () => {
      // This test simulates a complete request with all security measures
      const startTime = Date.now()

      // 1. Generate security headers
      const headers = securityHeaders()

      // 2. Check CSRF protection
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'host': 'localhost:3000',
          'origin': 'http://localhost:3000'
        }
      })
      const csrfResult = csrfProtection(request)

      // 3. Apply rate limiting
      const rateLimiter = rateLimit({
        maxRequests: 100,
        windowMs: 60000,
        keyGenerator: () => 'pipeline-test'
      })
      const rateLimitResult = await rateLimiter(request)

      // 4. Process complex input with sanitization
      const category = await caller.categories.create(TestDataFactory.createCategory('Pipeline<script>alert("test")</script>Test'))

      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(500) // Critical requirement
      expect(headers).toBeDefined()
      expect(csrfResult).toBeNull()
      expect(rateLimitResult).toBeNull()
      expect(category.name).not.toContain('<script>')
    })

    it('should maintain performance under concurrent load', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Load Test Category' }))

      const startTime = Date.now()

      // Simulate 20 concurrent requests with security processing
      const promises = Array.from({ length: 20 }, async (_, i) => {
        return caller.services.create({
          name: `Load Test${i}<script>alert("concurrent${i}")</script>`,
          description: `Service ${i} with <img src=x onerror=alert("${i}")>malicious content`,
          dockerImage: 'nginx:latest',
          version: 'latest',
          categoryId: category.id,
          environmentVariables: Array.from({ length: 5 }, (_, j) => ({
            name: `LOAD_VAR_${i}_${j}`,
            defaultValue: `<script>alert("load${i}${j}")</script>value`,
            required: false,
            type: 'string' as const,
            description: `Load test variable ${i}-${j}`
          }))
        })
      })

      const services = await Promise.all(promises)
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(500) // Must handle concurrent load
      expect(services).toHaveLength(20)
      
      // Verify all services were sanitized
      services.forEach((service: any, i: number) => {
        expect(service.name).not.toContain('<script>')
        expect(service.description).not.toContain('<img')
        expect(service.environmentVariables).toHaveLength(5)
        service.environmentVariables.forEach((envVar: any) => {
          expect(envVar.defaultValue).not.toContain('<script>')
        })
      })
    })

    it('should not degrade normal operation performance', async () => {
      // Baseline test with clean data
      const cleanStartTime = Date.now()
      
      const cleanCategory = await caller.categories.create(TestDataFactory.createCategory({ name: 'Clean Category' }))

      const cleanService = await caller.services.create({
        name: 'Clean Service',
        description: 'A legitimate service description',
        dockerImage: 'nginx:latest',
        version: 'latest',
        categoryId: cleanCategory.id
      })

      const cleanDuration = Date.now() - cleanStartTime

      // Test with malicious data (same complexity)
      const maliciousStartTime = Date.now()

      const maliciousCategory = await caller.categories.create(TestDataFactory.createCategory('Malicious<script>alert("xss")</script>Category'))

      const maliciousService = await caller.services.create({
        name: 'Malicious<script>alert("service")</script>Service',
        description: 'A service with <img src=x onerror=alert("service")>malicious content',
        dockerImage: 'nginx:latest',
        version: 'latest',
        categoryId: maliciousCategory.id
      })

      const maliciousDuration = Date.now() - maliciousStartTime

      // Security processing shouldn't add significant overhead
      const overhead = maliciousDuration - cleanDuration
      expect(overhead).toBeLessThan(100) // Minimal overhead allowed
      expect(maliciousDuration).toBeLessThan(500) // Still within limits
      
      // Verify sanitization worked
      expect(maliciousCategory.name).not.toContain('<script>')
      expect(maliciousService.description).not.toContain('<img')
    })
  })

  describe('Memory and Resource Usage', () => {
    it('should not create memory leaks during security processing', async () => {
      // Create many objects with malicious content to test for leaks
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Memory Test Category' }))

      const initialMemory = process.memoryUsage()

      // Create 50 services with complex malicious content
      for (let i = 0; i < 50; i++) {
        await caller.services.create({
          name: `Memory${i}<script>alert("mem${i}")</script>Test`,
          description: `Service ${i} with <img src=x onerror=alert("${i}")>complex malicious content`.repeat(10),
          dockerImage: 'nginx:latest',
          version: 'latest',
          categoryId: category.id,
          environmentVariables: Array.from({ length: 3 }, (_, j) => ({
            name: `MEM_VAR_${i}_${j}`,
            defaultValue: `<script>alert("memvar${i}${j}")</script>`.repeat(5),
            required: false,
            type: 'string' as const,
            description: `Memory test var ${i}-${j} with onclick=alert("${i}${j}") content`
          }))
        })
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })

    it('should handle edge cases efficiently', async () => {
      const edgeCases = [
        { name: '', slug: TestDataFactory.generateSlug(''), description: 'Empty name test', sortOrder: 1 },
        { name: 'A'.repeat(101), slug: TestDataFactory.generateSlug('A'.repeat(101)), description: 'Too long name test', sortOrder: 2 },
        { name: null as any, slug: TestDataFactory.generateSlug('null'), description: 'Null name test', sortOrder: 3 },
        { name: undefined as any, slug: TestDataFactory.generateSlug('undefined'), description: 'Undefined name test', sortOrder: 4 },
        { name: 123 as any, slug: TestDataFactory.generateSlug('123'), description: 'Number name test', sortOrder: 5 }
      ]

      const startTime = Date.now()

      for (const testCase of edgeCases) {
        try {
          await caller.categories.create(testCase)
        } catch (error) {
          // Expected to fail, but should fail quickly
          expect(error).toBeDefined()
        }
      }

      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(200) // Should handle edge cases quickly
    })
  })
})