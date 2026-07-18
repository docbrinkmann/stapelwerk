/**
 * Performance Monitoring Service
 * 
 * Tracks API response times, validates performance requirements,
 * and provides monitoring capabilities for the service catalog API.
 */

export interface PerformanceMetrics {
  endpoint: string
  method: string
  responseTime: number
  timestamp: Date
  statusCode: number
  userId?: string
  userAgent?: string
  ip?: string
}

export interface PerformanceThresholds {
  warning: number // Warning threshold in milliseconds
  critical: number // Critical threshold in milliseconds
  maximum: number // Maximum allowed response time
}

export interface PerformanceStats {
  totalRequests: number
  averageResponseTime: number
  medianResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  slowRequestsCount: number
  errorRate: number
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null
  private metrics: PerformanceMetrics[] = []
  private thresholds: PerformanceThresholds = {
    warning: 200, // 200ms warning
    critical: 400, // 400ms critical
    maximum: 500 // 500ms maximum (from spec)
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  /**
   * Record a performance metric for an API request
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric)
    
    // Keep only last 10,000 metrics in memory for performance
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000) // Keep last 5000
    }

    // Log slow requests
    if (metric.responseTime > this.thresholds.critical) {
      console.warn(`🐌 Slow API Response: ${metric.endpoint} took ${metric.responseTime}ms`, {
        endpoint: metric.endpoint,
        method: metric.method,
        responseTime: metric.responseTime,
        statusCode: metric.statusCode,
        timestamp: metric.timestamp
      })
    }

    // Alert on maximum threshold breach
    if (metric.responseTime > this.thresholds.maximum) {
      console.error(`🚨 Performance Alert: ${metric.endpoint} exceeded maximum threshold (${metric.responseTime}ms > ${this.thresholds.maximum}ms)`, {
        endpoint: metric.endpoint,
        method: metric.method,
        responseTime: metric.responseTime,
        statusCode: metric.statusCode,
        timestamp: metric.timestamp
      })
    }
  }

  /**
   * Get performance statistics for a specific endpoint or all endpoints
   */
  getStats(endpoint?: string): PerformanceStats {
    const relevantMetrics = endpoint 
      ? this.metrics.filter(m => m.endpoint === endpoint)
      : this.metrics

    if (relevantMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        medianResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        slowRequestsCount: 0,
        errorRate: 0
      }
    }

    const responseTimes = relevantMetrics.map(m => m.responseTime).sort((a, b) => a - b)
    const totalRequests = relevantMetrics.length
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / totalRequests
    const medianResponseTime = this.calculatePercentile(responseTimes, 50)
    const p95ResponseTime = this.calculatePercentile(responseTimes, 95)
    const p99ResponseTime = this.calculatePercentile(responseTimes, 99)
    const slowRequestsCount = relevantMetrics.filter(m => m.responseTime > this.thresholds.warning).length
    const errorRequests = relevantMetrics.filter(m => m.statusCode >= 400).length
    const errorRate = (errorRequests / totalRequests) * 100

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      medianResponseTime: Math.round(medianResponseTime),
      p95ResponseTime: Math.round(p95ResponseTime),
      p99ResponseTime: Math.round(p99ResponseTime),
      slowRequestsCount,
      errorRate: Math.round(errorRate * 100) / 100
    }
  }

  /**
   * Get recent slow requests (above warning threshold)
   */
  getSlowRequests(limit = 50): PerformanceMetrics[] {
    return this.metrics
      .filter(m => m.responseTime > this.thresholds.warning)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Validate if response time meets performance requirements
   */
  validateResponseTime(responseTime: number): {
    isValid: boolean
    level: 'good' | 'warning' | 'critical' | 'exceeded'
    message: string
  } {
    if (responseTime > this.thresholds.maximum) {
      return {
        isValid: false,
        level: 'exceeded',
        message: `Response time ${responseTime}ms exceeds maximum allowed ${this.thresholds.maximum}ms`
      }
    } else if (responseTime > this.thresholds.critical) {
      return {
        isValid: true,
        level: 'critical',
        message: `Response time ${responseTime}ms is critically slow (>${this.thresholds.critical}ms)`
      }
    } else if (responseTime > this.thresholds.warning) {
      return {
        isValid: true,
        level: 'warning',
        message: `Response time ${responseTime}ms is above warning threshold (>${this.thresholds.warning}ms)`
      }
    } else {
      return {
        isValid: true,
        level: 'good',
        message: `Response time ${responseTime}ms is within acceptable limits`
      }
    }
  }

  /**
   * Clear all stored metrics (useful for testing)
   */
  clearMetrics(): void {
    this.metrics = []
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds }
  }

  /**
   * Get current thresholds
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds }
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0
    
    const index = (percentile / 100) * (sortedValues.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index % 1
    
    if (upper >= sortedValues.length) return sortedValues[sortedValues.length - 1]
    
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
  }

  /**
   * Get performance summary for admin dashboard
   */
  getPerformanceSummary(): {
    overall: PerformanceStats
    byEndpoint: Record<string, PerformanceStats>
    recentSlowRequests: PerformanceMetrics[]
    healthStatus: 'healthy' | 'warning' | 'critical'
  } {
    const overall = this.getStats()
    
    // Get stats by endpoint
    const endpoints = Array.from(new Set(this.metrics.map(m => m.endpoint)))
    const byEndpoint: Record<string, PerformanceStats> = {}
    
    endpoints.forEach(endpoint => {
      byEndpoint[endpoint] = this.getStats(endpoint)
    })

    // Determine health status
    let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy'
    
    if (overall.p95ResponseTime > this.thresholds.critical) {
      healthStatus = 'critical'
    } else if (overall.p95ResponseTime > this.thresholds.warning || overall.errorRate > 5) {
      healthStatus = 'warning'
    }

    return {
      overall,
      byEndpoint,
      recentSlowRequests: this.getSlowRequests(10),
      healthStatus
    }
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance()

// Export types and classes
export { PerformanceMonitor }