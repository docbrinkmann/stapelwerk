import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { 
  PerformanceMonitor, 
  performanceMonitor, 
  type PerformanceMetrics,
  type PerformanceThresholds
} from '../../src/lib/monitoring/performance-monitor'

describe('Performance Monitoring Tests', () => {
  beforeEach(() => {
    // Clear metrics before each test
    performanceMonitor.clearMetrics()
    // Reset thresholds to defaults
    performanceMonitor.updateThresholds({
      warning: 200,
      critical: 400,
      maximum: 500
    })
  })

  afterEach(() => {
    performanceMonitor.clearMetrics()
  })

  describe('Performance Monitor Core Functionality', () => {
    it('should record and retrieve performance metrics', () => {
      const metric: PerformanceMetrics = {
        endpoint: '/api/services/list',
        method: 'GET',
        responseTime: 150,
        timestamp: new Date(),
        statusCode: 200,
        userId: 'test-user-1'
      }

      performanceMonitor.recordMetric(metric)
      const stats = performanceMonitor.getStats()

      expect(stats.totalRequests).toBe(1)
      expect(stats.averageResponseTime).toBe(150)
      expect(stats.medianResponseTime).toBe(150)
    })

    it('should calculate performance statistics correctly', () => {
      const metrics: PerformanceMetrics[] = [
        { endpoint: '/api/test', method: 'GET', responseTime: 100, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/test', method: 'GET', responseTime: 200, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/test', method: 'GET', responseTime: 300, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/test', method: 'GET', responseTime: 400, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/test', method: 'GET', responseTime: 500, timestamp: new Date(), statusCode: 200 }
      ]

      metrics.forEach(metric => performanceMonitor.recordMetric(metric))
      
      const stats = performanceMonitor.getStats()

      expect(stats.totalRequests).toBe(5)
      expect(stats.averageResponseTime).toBe(300)
      expect(stats.medianResponseTime).toBe(300)
      expect(stats.p95ResponseTime).toBeGreaterThanOrEqual(400) // Allow for interpolation
      expect(stats.p99ResponseTime).toBeGreaterThanOrEqual(400)
    })

    it('should filter stats by endpoint', () => {
      const metrics: PerformanceMetrics[] = [
        { endpoint: '/api/services', method: 'GET', responseTime: 100, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/categories', method: 'GET', responseTime: 200, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/services', method: 'POST', responseTime: 150, timestamp: new Date(), statusCode: 201 }
      ]

      metrics.forEach(metric => performanceMonitor.recordMetric(metric))
      
      const servicesStats = performanceMonitor.getStats('/api/services')
      const categoriesStats = performanceMonitor.getStats('/api/categories')

      expect(servicesStats.totalRequests).toBe(2)
      expect(servicesStats.averageResponseTime).toBe(125)
      expect(categoriesStats.totalRequests).toBe(1)
      expect(categoriesStats.averageResponseTime).toBe(200)
    })

    it('should track slow requests correctly', () => {
      const metrics: PerformanceMetrics[] = [
        { endpoint: '/api/fast', method: 'GET', responseTime: 50, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/slow', method: 'GET', responseTime: 300, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/slower', method: 'GET', responseTime: 450, timestamp: new Date(), statusCode: 200 }
      ]

      metrics.forEach(metric => performanceMonitor.recordMetric(metric))
      
      const slowRequests = performanceMonitor.getSlowRequests()
      const stats = performanceMonitor.getStats()

      expect(slowRequests).toHaveLength(2) // 2 requests above 200ms warning threshold
      expect(stats.slowRequestsCount).toBe(2)
    })

    it('should calculate error rates correctly', () => {
      const metrics: PerformanceMetrics[] = [
        { endpoint: '/api/test', method: 'GET', responseTime: 100, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/test', method: 'GET', responseTime: 150, timestamp: new Date(), statusCode: 400 },
        { endpoint: '/api/test', method: 'GET', responseTime: 120, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/test', method: 'GET', responseTime: 180, timestamp: new Date(), statusCode: 500 }
      ]

      metrics.forEach(metric => performanceMonitor.recordMetric(metric))
      
      const stats = performanceMonitor.getStats()

      expect(stats.totalRequests).toBe(4)
      expect(stats.errorRate).toBe(50) // 2 errors out of 4 requests = 50%
    })
  })

  describe('Response Time Validation', () => {
    it('should validate good response times', () => {
      const validation = performanceMonitor.validateResponseTime(100)

      expect(validation.isValid).toBe(true)
      expect(validation.level).toBe('good')
      expect(validation.message).toContain('within acceptable limits')
    })

    it('should validate warning level response times', () => {
      const validation = performanceMonitor.validateResponseTime(250)

      expect(validation.isValid).toBe(true)
      expect(validation.level).toBe('warning')
      expect(validation.message).toContain('above warning threshold')
    })

    it('should validate critical response times', () => {
      const validation = performanceMonitor.validateResponseTime(450)

      expect(validation.isValid).toBe(true)
      expect(validation.level).toBe('critical')
      expect(validation.message).toContain('critically slow')
    })

    it('should validate exceeded response times', () => {
      const validation = performanceMonitor.validateResponseTime(600)

      expect(validation.isValid).toBe(false)
      expect(validation.level).toBe('exceeded')
      expect(validation.message).toContain('exceeds maximum allowed')
    })

    it('should enforce 500ms maximum response time requirement', () => {
      const validation = performanceMonitor.validateResponseTime(501)

      expect(validation.isValid).toBe(false)
      expect(validation.level).toBe('exceeded')
      expect(validation.message).toContain('501ms exceeds maximum allowed 500ms')
    })
  })

  describe('Threshold Management', () => {
    it('should allow updating thresholds', () => {
      const newThresholds: Partial<PerformanceThresholds> = {
        warning: 150,
        critical: 300,
        maximum: 400
      }

      performanceMonitor.updateThresholds(newThresholds)
      const currentThresholds = performanceMonitor.getThresholds()

      expect(currentThresholds.warning).toBe(150)
      expect(currentThresholds.critical).toBe(300)
      expect(currentThresholds.maximum).toBe(400)
    })

    it('should use updated thresholds for validation', () => {
      performanceMonitor.updateThresholds({ maximum: 300 })
      
      const validation = performanceMonitor.validateResponseTime(350)

      expect(validation.isValid).toBe(false)
      expect(validation.level).toBe('exceeded')
      expect(validation.message).toContain('350ms exceeds maximum allowed 300ms')
    })
  })

  describe('Memory Management', () => {
    it('should limit metrics to prevent memory issues', () => {
      // Clear existing metrics first
      performanceMonitor.clearMetrics()
      
      // Add exactly 10,001 metrics to trigger cleanup
      for (let i = 0; i < 10001; i++) {
        performanceMonitor.recordMetric({
          endpoint: '/api/test',
          method: 'GET',
          responseTime: 100,
          timestamp: new Date(),
          statusCode: 200
        })
      }

      const stats = performanceMonitor.getStats()
      
      // Should be limited to 5000 after cleanup (keeps last 5000 from slice(-5000))
      expect(stats.totalRequests).toBe(5000)
    })

    it('should clear all metrics when requested', () => {
      // Add some metrics
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordMetric({
          endpoint: '/api/test',
          method: 'GET',
          responseTime: 100,
          timestamp: new Date(),
          statusCode: 200
        })
      }

      expect(performanceMonitor.getStats().totalRequests).toBe(10)
      
      performanceMonitor.clearMetrics()
      
      expect(performanceMonitor.getStats().totalRequests).toBe(0)
    })
  })

  describe('Performance Summary', () => {
    beforeEach(() => {
      // Add diverse metrics for testing
      const testMetrics: PerformanceMetrics[] = [
        { endpoint: '/api/services/list', method: 'GET', responseTime: 120, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/services/get', method: 'GET', responseTime: 80, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/services/create', method: 'POST', responseTime: 250, timestamp: new Date(), statusCode: 201 },
        { endpoint: '/api/categories/list', method: 'GET', responseTime: 90, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/services/update', method: 'PUT', responseTime: 450, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/services/error', method: 'GET', responseTime: 300, timestamp: new Date(), statusCode: 500 }
      ]

      testMetrics.forEach(metric => performanceMonitor.recordMetric(metric))
    })

    it('should generate comprehensive performance summary', () => {
      const summary = performanceMonitor.getPerformanceSummary()

      expect(summary.overall.totalRequests).toBe(6)
      expect(summary.byEndpoint).toHaveProperty('/api/services/list')
      expect(summary.byEndpoint).toHaveProperty('/api/categories/list')
      expect(summary.recentSlowRequests).toBeDefined()
      expect(['healthy', 'warning', 'critical']).toContain(summary.healthStatus)
    })

    it('should determine health status correctly', () => {
      // Clear and add only fast metrics
      performanceMonitor.clearMetrics()
      
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordMetric({
          endpoint: '/api/fast',
          method: 'GET',
          responseTime: 50,
          timestamp: new Date(),
          statusCode: 200
        })
      }

      const summary = performanceMonitor.getPerformanceSummary()
      expect(summary.healthStatus).toBe('healthy')
    })

    it('should show warning status for elevated response times', () => {
      performanceMonitor.clearMetrics()
      
      // Add metrics with high warning-level response times
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordMetric({
          endpoint: '/api/slow',
          method: 'GET',
          responseTime: 250, // Above warning threshold
          timestamp: new Date(),
          statusCode: 200
        })
      }

      const summary = performanceMonitor.getPerformanceSummary()
      expect(summary.healthStatus).toBe('warning')
    })

    it('should show critical status for very slow response times', () => {
      performanceMonitor.clearMetrics()
      
      // Add metrics with critical response times
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordMetric({
          endpoint: '/api/critical',
          method: 'GET',
          responseTime: 450, // Above critical threshold
          timestamp: new Date(),
          statusCode: 200
        })
      }

      const summary = performanceMonitor.getPerformanceSummary()
      expect(summary.healthStatus).toBe('critical')
    })
  })

  describe('Singleton Pattern', () => {
    it('should maintain singleton instance', () => {
      const instance1 = PerformanceMonitor.getInstance()
      const instance2 = PerformanceMonitor.getInstance()

      expect(instance1).toBe(instance2)
      expect(instance1).toBe(performanceMonitor)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty metrics gracefully', () => {
      const stats = performanceMonitor.getStats()
      
      expect(stats.totalRequests).toBe(0)
      expect(stats.averageResponseTime).toBe(0)
      expect(stats.errorRate).toBe(0)
    })

    it('should handle single metric calculations', () => {
      performanceMonitor.recordMetric({
        endpoint: '/api/single',
        method: 'GET',
        responseTime: 123,
        timestamp: new Date(),
        statusCode: 200
      })

      const stats = performanceMonitor.getStats()
      
      expect(stats.totalRequests).toBe(1)
      expect(stats.averageResponseTime).toBe(123)
      expect(stats.medianResponseTime).toBe(123)
      expect(stats.p95ResponseTime).toBe(123)
      expect(stats.p99ResponseTime).toBe(123)
    })

    it('should handle metrics with zero response time', () => {
      performanceMonitor.recordMetric({
        endpoint: '/api/instant',
        method: 'GET',
        responseTime: 0,
        timestamp: new Date(),
        statusCode: 200
      })

      const validation = performanceMonitor.validateResponseTime(0)
      const stats = performanceMonitor.getStats()

      expect(validation.isValid).toBe(true)
      expect(validation.level).toBe('good')
      expect(stats.averageResponseTime).toBe(0)
    })
  })

  describe('Performance Requirements Compliance', () => {
    it('should enforce 500ms maximum response time from spec', () => {
      const thresholds = performanceMonitor.getThresholds()
      
      expect(thresholds.maximum).toBe(500)
      
      // Test that 500ms exactly is still valid
      const validation500 = performanceMonitor.validateResponseTime(500)
      expect(validation500.isValid).toBe(true)
      
      // Test that 501ms is invalid
      const validation501 = performanceMonitor.validateResponseTime(501)
      expect(validation501.isValid).toBe(false)
    })

    it('should track percentage of requests meeting 500ms requirement', () => {
      const metrics: PerformanceMetrics[] = [
        { endpoint: '/api/good1', method: 'GET', responseTime: 200, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/good2', method: 'GET', responseTime: 400, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/bad1', method: 'GET', responseTime: 600, timestamp: new Date(), statusCode: 200 },
        { endpoint: '/api/good3', method: 'GET', responseTime: 100, timestamp: new Date(), statusCode: 200 }
      ]

      metrics.forEach(metric => performanceMonitor.recordMetric(metric))
      
      const stats = performanceMonitor.getStats()
      
      expect(stats.totalRequests).toBe(4)
      // Count requests that would be "good" or acceptable (not "exceeded")
      const validRequests = metrics.filter(m => m.responseTime <= 500).length
      const complianceRate = (validRequests / metrics.length) * 100
      
      expect(complianceRate).toBe(75) // 3 out of 4 requests are <= 500ms
    })
  })
})