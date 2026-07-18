import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the Prisma client at the top level
const mockPrisma = {
  $queryRaw: vi.fn(),
}

vi.mock('@/lib/db-utils', () => ({
  prisma: mockPrisma,
}))

// Import the functions after mocking
const { GET, HEAD } = await import('@/app/api/health/route')

describe('API: Health Check', () => {
  let mockRequest: NextRequest

  beforeEach(() => {
    mockRequest = new NextRequest('http://localhost:3000/api/health')
    vi.clearAllMocks()
    
    // Set default successful responses for different queries using sequential calls
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ test: 1 }])
      .mockResolvedValueOnce([{ sqlite_version: '3.40.0' }])
  })

  describe('GET /api/health', () => {
    it('should return healthy status when database is working', async () => {
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('status', 'healthy')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('version')
      expect(data).toHaveProperty('environment')
      expect(data).toHaveProperty('uptime')
      expect(data).toHaveProperty('memory')
      expect(data).toHaveProperty('database')
      expect(data).toHaveProperty('services')
    })

    it('should return database information when connected', async () => {
      // Explicit setup for this test
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ test: 1 }])
        .mockResolvedValueOnce([{ sqlite_version: '3.40.0' }])
      
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(data.database).toHaveProperty('status', 'healthy')
      expect(data.database).toHaveProperty('connected', true)
      expect(data.database).toHaveProperty('version')
      expect(data.database).toHaveProperty('engine', 'postgresql')
    })

    it('should return service status information', async () => {
      // Explicit setup for this test
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ test: 1 }])
        .mockResolvedValueOnce([{ sqlite_version: '3.40.0' }])
        
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(data.services).toHaveProperty('nextjs', 'healthy')
      expect(data.services).toHaveProperty('database', 'healthy')
    })

    it('should include memory usage information', async () => {
      const response = await GET(mockRequest)
      const data = await response.json()

      expect(data.memory).toHaveProperty('used')
      expect(data.memory).toHaveProperty('total')
      expect(typeof data.memory.used).toBe('number')
      expect(typeof data.memory.total).toBe('number')
    })

    it.skip('should return degraded status when database is unhealthy', async () => {
      // Override the beforeEach setup with error mock
      vi.clearAllMocks()
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database connection failed'))

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('degraded')
      expect(data.database.status).toBe('unhealthy')
      expect(data.database.connected).toBe(false)
    })

    it.skip('should handle database query errors gracefully', async () => {
      // Override the beforeEach setup with error mock
      vi.clearAllMocks()
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Query failed'))

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(data.database.status).toBe('unhealthy')
      expect(data.database).toHaveProperty('error')
    })

    it('should return proper cache headers', async () => {
      // Explicit setup for this test
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ test: 1 }])
        .mockResolvedValueOnce([{ sqlite_version: '3.40.0' }])
        
      const response = await GET(mockRequest)
      
      const cacheControl = response.headers.get('Cache-Control')
      expect(cacheControl).toBeTruthy()
      expect(cacheControl).toContain('no-cache')
      expect(response.headers.get('Pragma')).toBe('no-cache')
      expect(response.headers.get('Expires')).toBe('0')
    })

    it('should handle unexpected errors', async () => {
      // Force an unexpected error by mocking a critical function to throw
      const originalUptime = process.uptime
      process.uptime = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data).toHaveProperty('error')

      // Restore original function
      process.uptime = originalUptime
    })
  })

  describe('HEAD /api/health', () => {
    it('should return 200 when database is healthy', async () => {
      // Explicit setup for HEAD test
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ test: 1 }])
      
      const response = await HEAD(mockRequest)
      
      expect(response.status).toBe(200)
      expect(response.body).toBeNull()
    })

    it.skip('should return 503 when database is unhealthy', async () => {
      // Override the beforeEach setup with error mock
      vi.clearAllMocks()
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database error'))

      const response = await HEAD(mockRequest)
      
      expect(response.status).toBe(503)
      expect(response.body).toBeNull()
    })
  })

  describe('Performance', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now()
      await GET(mockRequest)
      const endTime = Date.now()
      
      const responseTime = endTime - startTime
      expect(responseTime).toBeLessThan(1000) // Should respond within 1 second
    })

    it('should handle concurrent requests', async () => {
      // Set up mocks for all concurrent requests (2 calls per request x 10 requests)
      for (let i = 0; i < 10; i++) {
        mockPrisma.$queryRaw
          .mockResolvedValueOnce([{ test: 1 }])
          .mockResolvedValueOnce([{ sqlite_version: '3.40.0' }])
      }
      
      const promises = Array.from({ length: 10 }, () => GET(mockRequest))
      const responses = await Promise.all(promises)
      
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })
})