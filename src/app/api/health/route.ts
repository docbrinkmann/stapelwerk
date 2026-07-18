import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db-utils'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { alertingService } from '@/lib/monitoring/alerting'
import { captureException } from '@/lib/monitoring'

// Health check status types
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

interface ComponentHealth {
  status: HealthStatus
  responseTime?: number
  message?: string
  details?: Record<string, any>
  lastCheck: string
}

// Cache health check results for 30 seconds
let lastHealthCheck: { timestamp: number; result: any } | null = null
const CACHE_DURATION = 30 * 1000 // 30 seconds

async function performComprehensiveHealthCheck() {
  const startTime = performance.now()
  const timestamp = new Date().toISOString()

  // Fast path for E2E tests
  if (process.env.TEST_E2E_SIMPLE_HEALTH === '1') {
    return {
      status: 'healthy',
      timestamp,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor(process.uptime()),
      components: {},
      metrics: { memory: { used: 0, total: 0, percentage: 0 } },
      alerts: { active: 0, resolved: 0, critical: 0 },
    }
  }
  
  // Check if we have a cached result
  if (lastHealthCheck && (Date.now() - lastHealthCheck.timestamp) < CACHE_DURATION) {
    return lastHealthCheck.result
  }

  const components = {
    database: await checkDatabase(),
    performance: checkPerformanceMonitor(),
    alerting: checkAlertingService(),
    recommendations: await checkRecommendationsService(),
  }

  // Determine overall health status
  const componentStatuses = Object.values(components).map(c => c.status)
  let overallStatus: HealthStatus = 'healthy'
  
  if (componentStatuses.some(s => s === 'unhealthy')) {
    overallStatus = 'unhealthy'
  } else if (componentStatuses.some(s => s === 'degraded')) {
    overallStatus = 'degraded'
  }

  // Get system metrics
  const memoryUsage = process.memoryUsage()
  const performanceStats = performanceMonitor.getStats()
  const alertingMetrics = alertingService.getMetrics()

  const result = {
    status: overallStatus,
    timestamp,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    components,
    metrics: {
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
      cpu: {
        loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
      },
      requests: {
        total: performanceStats.totalRequests,
        errorRate: performanceStats.errorRate,
        avgResponseTime: performanceStats.averageResponseTime,
      },
    },
    alerts: {
      active: alertingMetrics.totalAlerts - alertingMetrics.resolvedAlerts,
      resolved: alertingMetrics.resolvedAlerts,
      critical: alertingMetrics.alertsBySeverity.critical || 0,
    },
  }

  // Cache the result
  lastHealthCheck = {
    timestamp: Date.now(),
    result,
  }

  // Record health check performance
  const totalTime = performance.now() - startTime
  performanceMonitor.recordMetric({
    endpoint: '/api/health',
    method: 'GET',
    responseTime: totalTime,
    timestamp: new Date(),
    statusCode: overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 207 : 503,
  })

  return result
}

async function checkDatabase(): Promise<ComponentHealth> {
  const startTime = performance.now()
  
  try {
    // Test database connection with a simple query
    await prisma.$queryRaw`SELECT 1 as test`
    
    const responseTime = performance.now() - startTime
    
    // Get basic database info (PostgreSQL compatible)
    const versionResult = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version() as version`
    
    return {
      status: responseTime > 1000 ? 'degraded' : 'healthy',
      responseTime: Math.round(responseTime),
      message: responseTime > 1000 ? 'Database responding slowly' : 'Database connection healthy',
      lastCheck: new Date().toISOString(),
      details: {
        connected: true,
        version: versionResult[0]?.version || 'unknown',
        engine: 'postgresql',
      },
    }
  } catch (error) {
    captureException(error as Error, { component: 'database_health_check' })
    
    return {
      status: 'unhealthy',
      responseTime: performance.now() - startTime,
      message: `Database connection failed: ${(error as Error).message}`,
      lastCheck: new Date().toISOString(),
      details: {
        connected: false,
        error: (error as Error).message,
      },
    }
  }
}

function checkPerformanceMonitor(): ComponentHealth {
  try {
    const stats = performanceMonitor.getStats()
    const thresholds = performanceMonitor.getThresholds()
    
    let status: HealthStatus = 'healthy'
    let message = 'Performance monitoring active'
    
    if (stats.p95ResponseTime > thresholds.critical) {
      status = 'unhealthy'
      message = `Critical: P95 response time ${stats.p95ResponseTime}ms exceeds threshold`
    } else if (stats.p95ResponseTime > thresholds.warning || stats.errorRate > 10) {
      status = 'degraded'
      message = `Warning: Performance metrics above warning thresholds`
    }
    
    return {
      status,
      message,
      lastCheck: new Date().toISOString(),
      details: {
        totalRequests: stats.totalRequests,
        avgResponseTime: stats.averageResponseTime,
        p95ResponseTime: stats.p95ResponseTime,
        errorRate: stats.errorRate,
      },
    }
  } catch (error) {
    return {
      status: 'degraded',
      message: 'Performance monitor unavailable',
      lastCheck: new Date().toISOString(),
    }
  }
}

function checkAlertingService(): ComponentHealth {
  try {
    const metrics = alertingService.getMetrics()
    
    let status: HealthStatus = 'healthy'
    let message = 'Alerting system operational'
    
    const activeAlerts = metrics.totalAlerts - metrics.resolvedAlerts
    const criticalAlerts = metrics.alertsBySeverity.critical || 0
    
    if (criticalAlerts > 5) {
      status = 'unhealthy'
      message = `Critical: ${criticalAlerts} critical alerts active`
    } else if (activeAlerts > 20 || criticalAlerts > 0) {
      status = 'degraded'
      message = `Warning: ${activeAlerts} active alerts (${criticalAlerts} critical)`
    }
    
    return {
      status,
      message,
      lastCheck: new Date().toISOString(),
      details: {
        totalAlerts: metrics.totalAlerts,
        activeAlerts,
        criticalAlerts,
        avgResolutionTime: metrics.avgResolutionTime,
      },
    }
  } catch (error) {
    return {
      status: 'degraded',
      message: 'Alerting service unavailable',
      lastCheck: new Date().toISOString(),
    }
  }
}

async function checkRecommendationsService(): Promise<ComponentHealth> {
  const startTime = performance.now()
  
  try {
    // Check if recommendations database tables are accessible
    const serviceCount = await prisma.services.count()
    const responseTime = performance.now() - startTime
    
    return {
      status: responseTime > 2000 ? 'degraded' : 'healthy',
      responseTime: Math.round(responseTime),
      message: `Recommendations service operational (${serviceCount} services available)`,
      lastCheck: new Date().toISOString(),
      details: {
        serviceCount,
      },
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: performance.now() - startTime,
      message: `Recommendations service unavailable: ${(error as Error).message}`,
      lastCheck: new Date().toISOString(),
    }
  }
}

export async function GET(_request: NextRequest) {
  try {
    const healthResult = await performComprehensiveHealthCheck()
    
    // Determine HTTP status code based on health
    const statusCode = healthResult.status === 'healthy' ? 200 :
                      healthResult.status === 'degraded' ? 207 : 503
    
    return NextResponse.json(healthResult, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    captureException(error as Error, { endpoint: '/api/health' })
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: (error as Error).message,
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    })
  }
}

// Also handle HEAD requests for basic health checks
export async function HEAD(_request: NextRequest) {
  try {
    // Basic connectivity test
    await prisma.$queryRaw`SELECT 1 as test`
    return new NextResponse(null, { status: 200 })
  } catch {
    return new NextResponse(null, { status: 503 })
  }
}
