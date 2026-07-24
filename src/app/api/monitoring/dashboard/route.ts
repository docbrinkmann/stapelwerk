/**
 * Monitoring Dashboard API
 * 
 * Provides comprehensive monitoring data for dashboard display including
 * performance metrics, alert status, system health, and trend analysis.
 */

import { NextRequest, NextResponse } from 'next/server'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { alertingService } from '@/lib/monitoring/alerting'
import { captureException } from '@/lib/monitoring'

interface DashboardData {
  summary: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    uptime: number
    totalRequests: number
    activeAlerts: number
    lastUpdated: string
  }
  performance: {
    current: {
      avgResponseTime: number
      p95ResponseTime: number
      errorRate: number
      requestsPerMinute: number
    }
    trends: {
      responseTime: Array<{ timestamp: string; value: number }>
      errorRate: Array<{ timestamp: string; value: number }>
      requestVolume: Array<{ timestamp: string; value: number }>
    }
  }
  alerts: {
    summary: {
      active: number
      resolved: number
      critical: number
      escalated: number
    }
    recent: Array<{
      id: string
      title: string
      severity: string
      category: string
      timestamp: string
      resolved?: boolean
    }>
  }
  system: {
    memory: {
      used: number
      total: number
      percentage: number
    }
    cpu: {
      usage: number
      loadAverage: number[]
    }
    endpoints: Array<{
      path: string
      requests: number
      avgResponseTime: number
      errorRate: number
    }>
  }
}

// Cache dashboard data for 10 seconds to improve performance
let dashboardCache: { timestamp: number; data: DashboardData } | null = null
const CACHE_DURATION = 10 * 1000 // 10 seconds

async function generateDashboardData(): Promise<DashboardData> {
  // Check cache first
  if (dashboardCache && (Date.now() - dashboardCache.timestamp) < CACHE_DURATION) {
    return dashboardCache.data
  }

  try {
    const performanceStats = performanceMonitor.getStats()
    const performanceSummary = performanceMonitor.getPerformanceSummary()
    const alertingMetrics = alertingService.getMetrics()
    const recentAlerts = alertingService.getRecentAlerts(10)
    
    // System metrics
    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    // Generate trend data from real performance_metrics table
    const now = new Date()
    const trendData = await generateTrendData(now)
    
    // Determine overall system status
    let systemStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    const criticalAlerts = alertingMetrics.alertsBySeverity.critical || 0
    
    if (criticalAlerts > 0 || performanceStats.p95ResponseTime > 5000) {
      systemStatus = 'unhealthy'
    } else if (performanceStats.p95ResponseTime > 1000 || performanceStats.errorRate > 5) {
      systemStatus = 'degraded'
    }
    
    // Calculate requests per minute (estimate)
    const requestsPerMinute = Math.round(performanceStats.totalRequests / (process.uptime() / 60))
    
    const dashboardData: DashboardData = {
      summary: {
        status: systemStatus,
        uptime: Math.floor(process.uptime()),
        totalRequests: performanceStats.totalRequests,
        activeAlerts: alertingMetrics.totalAlerts - alertingMetrics.resolvedAlerts,
        lastUpdated: new Date().toISOString(),
      },
      performance: {
        current: {
          avgResponseTime: performanceStats.averageResponseTime,
          p95ResponseTime: performanceStats.p95ResponseTime,
          errorRate: performanceStats.errorRate,
          requestsPerMinute,
        },
        trends: trendData,
      },
      alerts: {
        summary: {
          active: alertingMetrics.totalAlerts - alertingMetrics.resolvedAlerts,
          resolved: alertingMetrics.resolvedAlerts,
          critical: alertingMetrics.alertsBySeverity.critical || 0,
          escalated: alertingMetrics.escalatedAlerts,
        },
        recent: recentAlerts.slice(0, 10).map(alert => ({
          id: alert.id,
          title: alert.title,
          severity: alert.severity,
          category: alert.category,
          timestamp: alert.timestamp.toISOString(),
          resolved: alert.resolved,
        })),
      },
      system: {
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
        },
        cpu: {
          usage: Math.round((cpuUsage.user + cpuUsage.system) / 1000 / 10), // Simplified CPU usage
          loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
        },
        endpoints: Object.entries(performanceSummary.byEndpoint).map(([path, stats]) => ({
          path,
          requests: stats.totalRequests,
          avgResponseTime: stats.averageResponseTime,
          errorRate: stats.errorRate,
        })),
      },
    }
    
    // Cache the result
    dashboardCache = {
      timestamp: Date.now(),
      data: dashboardData,
    }
    
    return dashboardData
  } catch (error) {
    captureException(error as Error, { endpoint: '/api/monitoring/dashboard' })
    throw error
  }
}

async function generateTrendData(now: Date) {
  /**
   * Real Implementation: Query performance_metrics table for historical data
   *
   * This queries the last 20 minutes of performance metrics from the database.
   * If no historical data exists, returns current values or empty arrays.
   *
   * Production-ready: Uses real time-series data from performance_metrics table
   */

  const points = 20 // Last 20 data points (representing last 20 minutes)
  const trends = {
    responseTime: [] as Array<{ timestamp: string; value: number }>,
    errorRate: [] as Array<{ timestamp: string; value: number }>,
    requestVolume: [] as Array<{ timestamp: string; value: number }>,
  }

  try {
    // Import prisma dynamically to avoid circular dependencies
    const { prisma } = await import('@/lib/database/prisma')

    const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000)

    // Query performance metrics for the last 20 minutes
    // Group by 1-minute intervals and aggregate
    const metrics = await prisma.performance_metrics.findMany({
      where: {
        timestamp: {
          gte: twentyMinutesAgo,
          lte: now
        },
        metricType: {
          in: ['response_time', 'error_rate', 'request_volume']
        }
      },
      orderBy: { timestamp: 'asc' },
      select: {
        metricType: true,
        metricName: true,
        value: true,
        timestamp: true
      }
    })

    // Group metrics by type and time buckets (1-minute intervals)
    const bucketMap = new Map<string, Map<string, number[]>>()

    for (const metric of metrics) {
      const bucketKey = new Date(Math.floor(metric.timestamp.getTime() / (60 * 1000)) * 60 * 1000).toISOString()

      if (!bucketMap.has(metric.metricType)) {
        bucketMap.set(metric.metricType, new Map())
      }

      const typeBuckets = bucketMap.get(metric.metricType)!
      if (!typeBuckets.has(bucketKey)) {
        typeBuckets.set(bucketKey, [])
      }

      typeBuckets.get(bucketKey)!.push(Number(metric.value))
    }

    // Fill in data points with real data or current values
    const performanceStats = performanceMonitor.getStats()

    for (let i = points - 1; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 1000)
      const bucketKey = new Date(Math.floor(timestamp.getTime() / (60 * 1000)) * 60 * 1000).toISOString()

      // Response time
      const responseTimeBucket = bucketMap.get('response_time')?.get(bucketKey)
      const responseTimeValue = responseTimeBucket && responseTimeBucket.length > 0
        ? Math.round(responseTimeBucket.reduce((a, b) => a + b, 0) / responseTimeBucket.length)
        : performanceStats.averageResponseTime || 0

      trends.responseTime.push({
        timestamp: timestamp.toISOString(),
        value: responseTimeValue
      })

      // Error rate
      const errorRateBucket = bucketMap.get('error_rate')?.get(bucketKey)
      const errorRateValue = errorRateBucket && errorRateBucket.length > 0
        ? Math.round((errorRateBucket.reduce((a, b) => a + b, 0) / errorRateBucket.length) * 10) / 10
        : performanceStats.errorRate || 0

      trends.errorRate.push({
        timestamp: timestamp.toISOString(),
        value: errorRateValue
      })

      // Request volume
      const requestVolumeBucket = bucketMap.get('request_volume')?.get(bucketKey)
      const requestVolumeValue = requestVolumeBucket && requestVolumeBucket.length > 0
        ? Math.round(requestVolumeBucket.reduce((a, b) => a + b, 0))
        : 0

      trends.requestVolume.push({
        timestamp: timestamp.toISOString(),
        value: requestVolumeValue
      })
    }

    return trends
  } catch (error) {
    // Fallback to current values if database query fails
    console.error('Error querying trend data:', error)
    const performanceStats = performanceMonitor.getStats()

    for (let i = points - 1; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 1000)

      trends.responseTime.push({
        timestamp: timestamp.toISOString(),
        value: performanceStats.averageResponseTime || 0
      })

      trends.errorRate.push({
        timestamp: timestamp.toISOString(),
        value: performanceStats.errorRate || 0
      })

      trends.requestVolume.push({
        timestamp: timestamp.toISOString(),
        value: 0
      })
    }

    return trends
  }
}

export async function GET(request: NextRequest) {
  try {
    const dashboardData = await generateDashboardData()
    
    return NextResponse.json(dashboardData, {
      headers: {
        'Cache-Control': 'private, max-age=10', // Cache for 10 seconds
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    captureException(error as Error, { endpoint: '/api/monitoring/dashboard' })
    
    return NextResponse.json({
      error: 'Failed to generate dashboard data',
      message: (error as Error).message,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

// POST endpoint for triggering manual refresh
export async function POST(request: NextRequest) {
  try {
    // Clear cache to force refresh
    dashboardCache = null
    
    const dashboardData = await generateDashboardData()
    
    return NextResponse.json({
      message: 'Dashboard data refreshed',
      data: dashboardData,
    })
  } catch (error) {
    captureException(error as Error, { endpoint: '/api/monitoring/dashboard', method: 'POST' })
    
    return NextResponse.json({
      error: 'Failed to refresh dashboard data',
      message: (error as Error).message,
    }, { status: 500 })
  }
}