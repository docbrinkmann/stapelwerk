import { describe, it, expect, beforeEach } from 'vitest'
import { performanceMonitor } from '../lib/monitoring/performance-monitor'

describe('Performance Monitoring Integration', () => {
  beforeEach(() => {
    performanceMonitor.clearMetrics()
  })

  it('should record and retrieve performance metrics', () => {
    // Add some test metrics
    performanceMonitor.recordMetric({
      endpoint: 'services.list',
      method: 'query',
      responseTime: 150,
      timestamp: new Date(),
      statusCode: 200,
      userId: 'test-user',
      userAgent: 'test-agent',
      ip: '127.0.0.1'
    })

    performanceMonitor.recordMetric({
      endpoint: 'services.get',
      method: 'query',
      responseTime: 75,
      timestamp: new Date(),
      statusCode: 200,
      userId: 'test-user',
      userAgent: 'test-agent',
      ip: '127.0.0.1'
    })

    // Test getStats
    const stats = performanceMonitor.getStats()
    expect(stats.totalRequests).toBe(2)
    expect(stats.averageResponseTime).toBe(113) // (150 + 75) / 2 = 112.5, rounded to 113

    // Test specific endpoint stats
    const serviceListStats = performanceMonitor.getStats('services.list')
    expect(serviceListStats.totalRequests).toBe(1)
    expect(serviceListStats.averageResponseTime).toBe(150)

    // Test getPerformanceSummary
    const summary = performanceMonitor.getPerformanceSummary()
    expect(summary.overall.totalRequests).toBe(2)
    expect(summary.byEndpoint['services.list'].totalRequests).toBe(1)
    expect(summary.byEndpoint['services.get'].totalRequests).toBe(1)
    expect(summary.healthStatus).toBe('healthy')
  })

  it('should handle slow requests correctly', () => {
    // Add a slow request
    performanceMonitor.recordMetric({
      endpoint: 'services.list',
      method: 'query',
      responseTime: 800, // Above critical threshold
      timestamp: new Date(),
      statusCode: 200,
      userId: 'test-user',
      userAgent: 'test-agent',
      ip: '127.0.0.1'
    })

    const slowRequests = performanceMonitor.getSlowRequests()
    expect(slowRequests.length).toBe(1)
    expect(slowRequests[0].responseTime).toBe(800)

    const summary = performanceMonitor.getPerformanceSummary()
    expect(summary.healthStatus).toBe('critical')
  })

  it('should update and get thresholds correctly', () => {
    const originalThresholds = performanceMonitor.getThresholds()
    expect(originalThresholds.warning).toBe(200)
    expect(originalThresholds.critical).toBe(400)
    expect(originalThresholds.maximum).toBe(500)

    performanceMonitor.updateThresholds({
      warning: 300,
      critical: 600,
      maximum: 1000
    })

    const updatedThresholds = performanceMonitor.getThresholds()
    expect(updatedThresholds.warning).toBe(300)
    expect(updatedThresholds.critical).toBe(600)
    expect(updatedThresholds.maximum).toBe(1000)
  })

  it('should validate response times correctly', () => {
    // Reset thresholds to defaults first
    performanceMonitor.updateThresholds({
      warning: 200,
      critical: 400,
      maximum: 500
    })

    const goodResponse = performanceMonitor.validateResponseTime(100)
    expect(goodResponse.isValid).toBe(true)
    expect(goodResponse.level).toBe('good')

    const warningResponse = performanceMonitor.validateResponseTime(250)
    expect(warningResponse.isValid).toBe(true)
    expect(warningResponse.level).toBe('warning')

    const criticalResponse = performanceMonitor.validateResponseTime(450)
    expect(criticalResponse.isValid).toBe(true)
    expect(criticalResponse.level).toBe('critical')

    const exceededResponse = performanceMonitor.validateResponseTime(600)
    expect(exceededResponse.isValid).toBe(false)
    expect(exceededResponse.level).toBe('exceeded')
  })

  it('should clear metrics correctly', () => {
    // Add some metrics
    performanceMonitor.recordMetric({
      endpoint: 'test.endpoint',
      method: 'query',
      responseTime: 100,
      timestamp: new Date(),
      statusCode: 200
    })

    const statsBeforeClear = performanceMonitor.getStats()
    expect(statsBeforeClear.totalRequests).toBe(1)

    performanceMonitor.clearMetrics()

    const statsAfterClear = performanceMonitor.getStats()
    expect(statsAfterClear.totalRequests).toBe(0)
  })
})