/**
 * KPI and Application Metrics Tracking System
 * 
 * Comprehensive tracking of business and technical KPIs including
 * user engagement, recommendation effectiveness, system performance,
 * and business metrics with automated reporting and trend analysis.
 */

import * as Sentry from '@sentry/nextjs'
import { captureException, captureMessage } from '../monitoring'

// KPI Categories
export type KPICategory = 
  | 'user_engagement' 
  | 'recommendations' 
  | 'performance'
  | 'business'
  | 'system'
  | 'security'

// Metric Types
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'rate'

export interface KPIMetric {
  id: string
  name: string
  category: KPICategory
  type: MetricType
  value: number
  timestamp: Date
  dimensions?: Record<string, string>
  unit?: string
  description?: string
}

export interface KPITarget {
  metricId: string
  target: number
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  period: 'daily' | 'weekly' | 'monthly'
  alertThreshold?: number
}

export interface KPIReport {
  period: {
    start: Date
    end: Date
    type: 'daily' | 'weekly' | 'monthly'
  }
  metrics: Array<{
    id: string
    name: string
    category: KPICategory
    current: number
    previous: number
    change: number
    changePercent: number
    target?: number
    targetAchieved?: boolean
    trend: 'up' | 'down' | 'stable'
  }>
  summary: {
    totalMetrics: number
    targetsAchieved: number
    criticalIssues: number
    overallHealth: 'good' | 'warning' | 'critical'
  }
}

class KPITracker {
  private static instance: KPITracker | null = null
  private metrics: Map<string, KPIMetric[]> = new Map() // key: metricId, value: array of historical values
  private targets: Map<string, KPITarget> = new Map()
  private aggregates: Map<string, number> = new Map() // Running aggregates for counters

  static getInstance(): KPITracker {
    if (!KPITracker.instance) {
      KPITracker.instance = new KPITracker()
    }
    return KPITracker.instance
  }

  /**
   * Initialize KPI tracker with default metrics and targets
   */
  initialize(): void {
    this.setupDefaultMetrics()
    this.setupDefaultTargets()
    console.log('📊 KPI Tracker initialized')
  }

  /**
   * Record a metric value
   */
  recordMetric(metric: Omit<KPIMetric, 'timestamp'>): void {
    const fullMetric: KPIMetric = {
      ...metric,
      timestamp: new Date(),
    }

    // Store metric
    const existing = this.metrics.get(metric.id) || []
    existing.push(fullMetric)
    
    // Keep only last 1000 data points per metric
    if (existing.length > 1000) {
      existing.splice(0, existing.length - 500) // Keep last 500
    }
    
    this.metrics.set(metric.id, existing)

    // Update aggregates for counters
    if (metric.type === 'counter') {
      const current = this.aggregates.get(metric.id) || 0
      this.aggregates.set(metric.id, current + metric.value)
    } else {
      this.aggregates.set(metric.id, metric.value)
    }

    // Check targets and alert if necessary
    this.checkTargets(metric.id)
  }

  /**
   * Increment a counter metric
   */
  increment(metricId: string, value: number = 1, dimensions?: Record<string, string>): void {
    const existing = this.getMetricConfig(metricId)
    if (existing) {
      this.recordMetric({
        ...existing,
        value,
        dimensions,
      })
    }
  }

  /**
   * Set a gauge metric value
   */
  setGauge(metricId: string, value: number, dimensions?: Record<string, string>): void {
    const existing = this.getMetricConfig(metricId)
    if (existing) {
      this.recordMetric({
        ...existing,
        value,
        dimensions,
      })
    }
  }

  /**
   * Record a timing/histogram metric
   */
  recordTiming(metricId: string, value: number, dimensions?: Record<string, string>): void {
    const existing = this.getMetricConfig(metricId)
    if (existing) {
      this.recordMetric({
        ...existing,
        value,
        dimensions,
      })
    }
  }

  /**
   * Get current metric value
   */
  getCurrentValue(metricId: string): number {
    return this.aggregates.get(metricId) || 0
  }

  /**
   * Get metric history
   */
  getMetricHistory(metricId: string, limit: number = 100): KPIMetric[] {
    const metrics = this.metrics.get(metricId) || []
    return metrics.slice(-limit)
  }

  /**
   * Generate KPI report for a period
   */
  generateReport(
    period: { start: Date; end: Date; type: 'daily' | 'weekly' | 'monthly' }
  ): KPIReport {
    const reportMetrics: KPIReport['metrics'] = []
    let targetsAchieved = 0
    let criticalIssues = 0

    // Calculate previous period for comparison
    const periodLength = period.end.getTime() - period.start.getTime()
    const previousPeriod = {
      start: new Date(period.start.getTime() - periodLength),
      end: period.start,
    }

    for (const [metricId, history] of this.metrics.entries()) {
      const metricConfig = this.getMetricConfig(metricId)
      if (!metricConfig) continue

      // Get metrics for current period
      const currentPeriodMetrics = history.filter(m => 
        m.timestamp >= period.start && m.timestamp <= period.end
      )

      // Get metrics for previous period
      const previousPeriodMetrics = history.filter(m => 
        m.timestamp >= previousPeriod.start && m.timestamp <= previousPeriod.end
      )

      if (currentPeriodMetrics.length === 0) continue

      let current: number
      let previous: number

      // Calculate values based on metric type
      switch (metricConfig.type) {
        case 'counter':
          current = currentPeriodMetrics.reduce((sum, m) => sum + m.value, 0)
          previous = previousPeriodMetrics.reduce((sum, m) => sum + m.value, 0)
          break
        case 'gauge':
          current = currentPeriodMetrics[currentPeriodMetrics.length - 1]?.value || 0
          previous = previousPeriodMetrics[previousPeriodMetrics.length - 1]?.value || 0
          break
        case 'histogram':
          current = currentPeriodMetrics.reduce((sum, m) => sum + m.value, 0) / currentPeriodMetrics.length
          previous = previousPeriodMetrics.length > 0 
            ? previousPeriodMetrics.reduce((sum, m) => sum + m.value, 0) / previousPeriodMetrics.length
            : 0
          break
        case 'rate':
          const currentRate = currentPeriodMetrics.length > 0 
            ? currentPeriodMetrics.reduce((sum, m) => sum + m.value, 0) / (periodLength / 1000)
            : 0
          const previousRate = previousPeriodMetrics.length > 0 
            ? previousPeriodMetrics.reduce((sum, m) => sum + m.value, 0) / (periodLength / 1000)
            : 0
          current = currentRate
          previous = previousRate
          break
      }

      const change = current - previous
      const changePercent = previous > 0 ? (change / previous) * 100 : 0

      // Determine trend
      let trend: 'up' | 'down' | 'stable' = 'stable'
      if (Math.abs(changePercent) > 5) {
        trend = change > 0 ? 'up' : 'down'
      }

      // Check target achievement
      const target = this.targets.get(metricId)
      let targetAchieved: boolean | undefined
      if (target) {
        switch (target.operator) {
          case 'gt':
            targetAchieved = current > target.target
            break
          case 'gte':
            targetAchieved = current >= target.target
            break
          case 'lt':
            targetAchieved = current < target.target
            break
          case 'lte':
            targetAchieved = current <= target.target
            break
          case 'eq':
            targetAchieved = Math.abs(current - target.target) < 0.01
            break
        }

        if (targetAchieved) {
          targetsAchieved++
        }

        // Check for critical issues
        if (target.alertThreshold) {
          const thresholdBreached = Math.abs(current - target.target) > target.alertThreshold
          if (thresholdBreached && !targetAchieved) {
            criticalIssues++
          }
        }
      }

      reportMetrics.push({
        id: metricId,
        name: metricConfig.name,
        category: metricConfig.category,
        current: Math.round(current * 100) / 100,
        previous: Math.round(previous * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        target: target?.target,
        targetAchieved,
        trend,
      })
    }

    // Determine overall health
    let overallHealth: 'good' | 'warning' | 'critical' = 'good'
    const achievementRate = reportMetrics.length > 0 ? targetsAchieved / reportMetrics.length : 1

    if (criticalIssues > 0 || achievementRate < 0.5) {
      overallHealth = 'critical'
    } else if (achievementRate < 0.8) {
      overallHealth = 'warning'
    }

    return {
      period,
      metrics: reportMetrics,
      summary: {
        totalMetrics: reportMetrics.length,
        targetsAchieved,
        criticalIssues,
        overallHealth,
      },
    }
  }

  /**
   * Add or update a KPI target
   */
  setTarget(target: KPITarget): void {
    this.targets.set(target.metricId, target)
  }

  /**
   * Remove a KPI target
   */
  removeTarget(metricId: string): boolean {
    return this.targets.delete(metricId)
  }

  /**
   * Get all metrics summary
   */
  getAllMetrics(): Array<{
    id: string
    name: string
    category: KPICategory
    type: MetricType
    currentValue: number
    lastUpdated?: Date
    hasTarget: boolean
  }> {
    const result: Array<{
      id: string
      name: string
      category: KPICategory
      type: MetricType
      currentValue: number
      lastUpdated?: Date
      hasTarget: boolean
    }> = []

    for (const [metricId, history] of this.metrics.entries()) {
      const config = this.getMetricConfig(metricId)
      if (!config) continue

      const lastMetric = history[history.length - 1]
      
      result.push({
        id: metricId,
        name: config.name,
        category: config.category,
        type: config.type,
        currentValue: this.getCurrentValue(metricId),
        lastUpdated: lastMetric?.timestamp,
        hasTarget: this.targets.has(metricId),
      })
    }

    return result.sort((a, b) => a.category.localeCompare(b.category))
  }

  /**
   * Setup default metrics
   */
  private setupDefaultMetrics(): void {
    const defaultMetrics = [
      // User Engagement KPIs
      {
        id: 'user_sessions',
        name: 'User Sessions',
        category: 'user_engagement' as KPICategory,
        type: 'counter' as MetricType,
        unit: 'sessions',
        description: 'Total number of user sessions',
      },
      {
        id: 'page_views',
        name: 'Page Views',
        category: 'user_engagement' as KPICategory,
        type: 'counter' as MetricType,
        unit: 'views',
        description: 'Total number of page views',
      },
      {
        id: 'stack_creations',
        name: 'Stack Creations',
        category: 'user_engagement' as KPICategory,
        type: 'counter' as MetricType,
        unit: 'stacks',
        description: 'Number of stacks created by users',
      },
      {
        id: 'stack_deployments',
        name: 'Stack Deployments',
        category: 'user_engagement' as KPICategory,
        type: 'counter' as MetricType,
        unit: 'deployments',
        description: 'Number of successful stack deployments',
      },

      // Recommendation KPIs
      {
        id: 'recommendation_views',
        name: 'Recommendation Views',
        category: 'recommendations' as KPICategory,
        type: 'counter' as MetricType,
        unit: 'views',
        description: 'Number of recommendations shown to users',
      },
      {
        id: 'recommendation_clicks',
        name: 'Recommendation Clicks',
        category: 'recommendations' as KPICategory,
        type: 'counter' as MetricType,
        unit: 'clicks',
        description: 'Number of recommendations clicked by users',
      },
      {
        id: 'recommendation_adoptions',
        name: 'Recommendation Adoptions',
        category: 'recommendations' as KPICategory,
        type: 'counter' as MetricType,
        unit: 'adoptions',
        description: 'Number of recommendations actually used in stacks',
      },
      {
        id: 'recommendation_ctr',
        name: 'Recommendation CTR',
        category: 'recommendations' as KPICategory,
        type: 'rate' as MetricType,
        unit: 'percentage',
        description: 'Click-through rate for recommendations',
      },

      // Performance KPIs
      {
        id: 'api_response_time',
        name: 'API Response Time',
        category: 'performance' as KPICategory,
        type: 'histogram' as MetricType,
        unit: 'ms',
        description: 'Average API response time',
      },
      {
        id: 'system_uptime',
        name: 'System Uptime',
        category: 'performance' as KPICategory,
        type: 'gauge' as MetricType,
        unit: 'percentage',
        description: 'System uptime percentage',
      },
      {
        id: 'error_rate',
        name: 'Error Rate',
        category: 'performance' as KPICategory,
        type: 'rate' as MetricType,
        unit: 'percentage',
        description: 'Application error rate',
      },

      // Business KPIs
      {
        id: 'template_usage',
        name: 'Template Usage',
        category: 'business' as KPICategory,
        type: 'counter' as MetricType,
        unit: 'uses',
        description: 'Number of template uses',
      },
      {
        id: 'user_retention',
        name: 'User Retention',
        category: 'business' as KPICategory,
        type: 'rate' as MetricType,
        unit: 'percentage',
        description: 'User retention rate',
      },
    ]

    // Initialize metrics with zero values
    defaultMetrics.forEach(metric => {
      this.recordMetric({
        ...metric,
        value: 0,
      })
    })
  }

  /**
   * Setup default targets
   */
  private setupDefaultTargets(): void {
    const defaultTargets: KPITarget[] = [
      {
        metricId: 'recommendation_ctr',
        target: 15, // 15% CTR target
        operator: 'gte',
        period: 'weekly',
        alertThreshold: 5,
      },
      {
        metricId: 'api_response_time',
        target: 200, // 200ms target
        operator: 'lte',
        period: 'daily',
        alertThreshold: 100,
      },
      {
        metricId: 'system_uptime',
        target: 99.5, // 99.5% uptime target
        operator: 'gte',
        period: 'monthly',
        alertThreshold: 1,
      },
      {
        metricId: 'error_rate',
        target: 1, // 1% error rate target
        operator: 'lte',
        period: 'daily',
        alertThreshold: 3,
      },
    ]

    defaultTargets.forEach(target => this.setTarget(target))
  }

  /**
   * Get metric configuration
   */
  private getMetricConfig(metricId: string): Omit<KPIMetric, 'value' | 'timestamp'> | null {
    const history = this.metrics.get(metricId)
    if (!history || history.length === 0) return null

    const latest = history[0]
    return {
      id: latest.id,
      name: latest.name,
      category: latest.category,
      type: latest.type,
      dimensions: latest.dimensions,
      unit: latest.unit,
      description: latest.description,
    }
  }

  /**
   * Check targets and trigger alerts if necessary
   */
  private checkTargets(metricId: string): void {
    const target = this.targets.get(metricId)
    if (!target || !target.alertThreshold) return

    const currentValue = this.getCurrentValue(metricId)
    const config = this.getMetricConfig(metricId)
    if (!config) return

    let isBreached = false
    let message = ''

    switch (target.operator) {
      case 'gt':
        isBreached = currentValue <= target.target - target.alertThreshold
        message = `${config.name} is below target: ${currentValue} <= ${target.target}`
        break
      case 'gte':
        isBreached = currentValue < target.target - target.alertThreshold
        message = `${config.name} is below target: ${currentValue} < ${target.target}`
        break
      case 'lt':
        isBreached = currentValue >= target.target + target.alertThreshold
        message = `${config.name} is above target: ${currentValue} >= ${target.target}`
        break
      case 'lte':
        isBreached = currentValue > target.target + target.alertThreshold
        message = `${config.name} is above target: ${currentValue} > ${target.target}`
        break
      case 'eq':
        isBreached = Math.abs(currentValue - target.target) > target.alertThreshold
        message = `${config.name} deviates from target: ${currentValue} vs ${target.target}`
        break
    }

    if (isBreached) {
      // Send to monitoring
      Sentry.withScope(scope => {
        scope.setTag('kpi_metric', metricId)
        scope.setTag('kpi_category', config.category)
        scope.setContext('kpi_target', {
          metricId,
          currentValue,
          target: target.target,
          threshold: target.alertThreshold,
          operator: target.operator,
        })
        captureMessage(`KPI Target Breach: ${message}`, 'warning')
      })

      console.warn(`📊 KPI Alert: ${message}`)
    }
  }

  /**
   * Export metrics data (for backup/analysis)
   */
  exportMetrics(): string {
    const data = {
      metrics: Array.from(this.metrics.entries()),
      targets: Array.from(this.targets.entries()),
      aggregates: Array.from(this.aggregates.entries()),
      exportedAt: new Date().toISOString(),
    }

    return JSON.stringify(data, null, 2)
  }

  /**
   * Clear old metrics (cleanup)
   */
  cleanup(maxAge: number = 30): void { // 30 days default
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - maxAge)
    
    let totalCleaned = 0
    
    for (const [metricId, history] of this.metrics.entries()) {
      const originalLength = history.length
      const filtered = history.filter(metric => metric.timestamp >= cutoff)
      
      if (filtered.length !== originalLength) {
        this.metrics.set(metricId, filtered)
        totalCleaned += originalLength - filtered.length
      }
    }
    
    if (totalCleaned > 0) {
      console.log(`🧹 KPI Cleanup: Removed ${totalCleaned} old metric entries`)
    }
  }
}

// Export singleton instance
export const kpiTracker = KPITracker.getInstance()

// Helper functions for common KPI tracking
export const trackUserSession = (userId?: string) => {
  kpiTracker.increment('user_sessions', 1, userId ? { userId } : {})
}

export const trackPageView = (page: string, userId?: string) => {
  kpiTracker.increment('page_views', 1, { page, ...(userId && { userId }) })
}

export const trackStackCreation = (templateId?: string, userId?: string) => {
  kpiTracker.increment('stack_creations', 1, { ...(templateId && { templateId }), ...(userId && { userId }) })
}

export const trackStackDeployment = (success: boolean, userId?: string) => {
  kpiTracker.increment('stack_deployments', 1, { success: success.toString(), ...(userId && { userId }) })
}

export const trackRecommendationView = (recommendationType: string, userId?: string) => {
  kpiTracker.increment('recommendation_views', 1, { type: recommendationType, ...(userId && { userId }) })
}

export const trackRecommendationClick = (recommendationType: string, serviceId: string, userId?: string) => {
  kpiTracker.increment('recommendation_clicks', 1, { type: recommendationType, serviceId, ...(userId && { userId }) })
}

export const trackRecommendationAdoption = (recommendationType: string, serviceId: string, userId?: string) => {
  kpiTracker.increment('recommendation_adoptions', 1, { type: recommendationType, serviceId, ...(userId && { userId }) })
}

export const updateRecommendationCTR = () => {
  const views = kpiTracker.getCurrentValue('recommendation_views')
  const clicks = kpiTracker.getCurrentValue('recommendation_clicks')
  const ctr = views > 0 ? (clicks / views) * 100 : 0
  kpiTracker.setGauge('recommendation_ctr', ctr)
}

export const trackAPIResponseTime = (endpoint: string, responseTime: number) => {
  kpiTracker.recordTiming('api_response_time', responseTime, { endpoint })
}

export const updateSystemUptime = (uptime: number) => {
  kpiTracker.setGauge('system_uptime', uptime)
}

export const trackError = (errorType: string) => {
  // This would be calculated as a rate based on total requests
  // For now, we'll just increment error count
  const currentErrors = kpiTracker.getCurrentValue('error_rate')
  kpiTracker.setGauge('error_rate', currentErrors + 1)
}

// Export types and classes
export { KPITracker }