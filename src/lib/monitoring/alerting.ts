/**
 * Comprehensive Alerting System
 * 
 * Multi-channel alerting system with customizable thresholds, escalation paths,
 * and integration with monitoring services. Supports email, Slack, webhooks,
 * and custom alert handlers.
 */

import * as Sentry from '@sentry/nextjs'
import { captureException, captureMessage } from '../monitoring'

// Alert severity levels
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical'

// Alert categories for better organization
export type AlertCategory = 
  | 'performance' 
  | 'error' 
  | 'security' 
  | 'availability' 
  | 'business'
  | 'infrastructure'

// Alert channel types
export type AlertChannel = 'email' | 'slack' | 'webhook' | 'sentry' | 'console'

export interface Alert {
  id: string
  title: string
  description: string
  severity: AlertSeverity
  category: AlertCategory
  timestamp: Date
  source: string
  metadata?: Record<string, any>
  resolved?: boolean
  resolvedAt?: Date
  escalationLevel: number
}

export interface AlertRule {
  id: string
  name: string
  category: AlertCategory
  enabled: boolean
  conditions: AlertCondition[]
  actions: AlertAction[]
  cooldown: number // minutes
  escalation?: EscalationRule[]
  tags?: string[]
}

export interface AlertCondition {
  metric: string
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains'
  threshold: number | string
  window: number // minutes
  count?: number // occurrences
}

export interface AlertAction {
  channel: AlertChannel
  config: AlertChannelConfig
  severity: AlertSeverity[]
}

export interface EscalationRule {
  after: number // minutes
  actions: AlertAction[]
}

export interface AlertChannelConfig {
  // Email configuration
  email?: {
    to: string[]
    subject?: string
    template?: string
  }
  
  // Slack configuration
  slack?: {
    webhook: string
    channel?: string
    username?: string
    iconEmoji?: string
  }
  
  // Webhook configuration
  webhook?: {
    url: string
    method?: 'POST' | 'PUT'
    headers?: Record<string, string>
    payload?: Record<string, any>
  }
  
  // Custom handler
  custom?: {
    handler: string
    config?: Record<string, any>
  }
}

export interface AlertingMetrics {
  totalAlerts: number
  alertsByCategory: Record<AlertCategory, number>
  alertsBySeverity: Record<AlertSeverity, number>
  resolvedAlerts: number
  avgResolutionTime: number
  escalatedAlerts: number
}

class AlertingService {
  private static instance: AlertingService | null = null
  private alerts: Map<string, Alert> = new Map()
  private rules: Map<string, AlertRule> = new Map()
  private cooldowns: Map<string, Date> = new Map()
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map()

  static getInstance(): AlertingService {
    if (!AlertingService.instance) {
      AlertingService.instance = new AlertingService()
    }
    return AlertingService.instance
  }

  /**
   * Initialize alerting service with default rules
   */
  initialize(): void {
    this.setupDefaultRules()
    console.log('🚨 Alerting Service initialized')
  }

  /**
   * Trigger an alert
   */
  async triggerAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'escalationLevel'>): Promise<string> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const fullAlert: Alert = {
      ...alert,
      id: alertId,
      timestamp: new Date(),
      escalationLevel: 0,
    }

    this.alerts.set(alertId, fullAlert)

    // Find matching rules and execute actions
    const matchingRules = Array.from(this.rules.values()).filter(rule => 
      rule.enabled && rule.category === alert.category
    )

    for (const rule of matchingRules) {
      if (this.isInCooldown(rule.id)) {
        continue
      }

      await this.executeAlertActions(fullAlert, rule.actions)
      this.setCooldown(rule.id, rule.cooldown)
      
      // Setup escalation if configured
      if (rule.escalation && rule.escalation.length > 0) {
        this.setupEscalation(fullAlert, rule.escalation)
      }
    }

    // Send to Sentry for error/critical alerts
    if (alert.severity === 'error' || alert.severity === 'critical') {
      Sentry.withScope(scope => {
        scope.setTag('alert_category', alert.category)
        scope.setTag('alert_severity', alert.severity)
        scope.setTag('alert_source', alert.source)
        scope.setContext('alert_metadata', alert.metadata || {})
        
        if (alert.severity === 'critical') {
          captureException(new Error(`Critical Alert: ${alert.title}`))
        } else {
          captureMessage(`Alert: ${alert.title}`, 'error')
        }
      })
    }

    console.log(`🚨 Alert triggered: [${alert.severity.toUpperCase()}] ${alert.title}`)
    
    return alertId
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, reason?: string): Promise<boolean> {
    const alert = this.alerts.get(alertId)
    if (!alert || alert.resolved) {
      return false
    }

    alert.resolved = true
    alert.resolvedAt = new Date()
    
    // Clear escalation timers
    const timer = this.escalationTimers.get(alertId)
    if (timer) {
      clearTimeout(timer)
      this.escalationTimers.delete(alertId)
    }

    console.log(`✅ Alert resolved: ${alert.title}${reason ? ` (${reason})` : ''}`)
    
    return true
  }

  /**
   * Execute alert actions
   */
  private async executeAlertActions(alert: Alert, actions: AlertAction[]): Promise<void> {
    for (const action of actions) {
      if (!action.severity.includes(alert.severity)) {
        continue
      }

      try {
        await this.sendAlert(alert, action)
      } catch (error) {
        console.error(`Failed to send alert via ${action.channel}:`, error)
        captureException(error as Error, {
          alert_id: alert.id,
          channel: action.channel,
          action_config: action.config,
        })
      }
    }
  }

  /**
   * Send alert through specific channel
   */
  private async sendAlert(alert: Alert, action: AlertAction): Promise<void> {
    switch (action.channel) {
      case 'email':
        await this.sendEmailAlert(alert, action.config.email!)
        break
      case 'slack':
        await this.sendSlackAlert(alert, action.config.slack!)
        break
      case 'webhook':
        await this.sendWebhookAlert(alert, action.config.webhook!)
        break
      case 'sentry':
        this.sendSentryAlert(alert)
        break
      case 'console':
        this.sendConsoleAlert(alert)
        break
      default:
        console.warn(`Unknown alert channel: ${action.channel}`)
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: Alert, config: NonNullable<AlertChannelConfig['email']>): Promise<void> {
    // In production, this would integrate with an email service like SendGrid, SES, etc.
    console.log(`📧 Email Alert would be sent to: ${config.to.join(', ')}`)
    console.log(`Subject: ${config.subject || `[${alert.severity.toUpperCase()}] ${alert.title}`}`)
    console.log(`Body: ${alert.description}`)
    
    // For now, just log the email content
    if (process.env.NODE_ENV === 'development') {
      console.log(`📧 [EMAIL ALERT] ${alert.title}`, {
        to: config.to,
        severity: alert.severity,
        category: alert.category,
        description: alert.description,
        metadata: alert.metadata,
      })
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: Alert, config: NonNullable<AlertChannelConfig['slack']>): Promise<void> {
    const severityEmojis = {
      info: '🔵',
      warning: '🟡',
      error: '🔴',
      critical: '🚨',
    }

    const payload = {
      text: `${severityEmojis[alert.severity]} Alert: ${alert.title}`,
      username: config.username || 'BuildMyStack Monitor',
      icon_emoji: config.iconEmoji || ':warning:',
      channel: config.channel,
      attachments: [
        {
          color: alert.severity === 'critical' ? 'danger' : 
                 alert.severity === 'error' ? 'warning' : 'good',
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Category',
              value: alert.category,
              short: true,
            },
            {
              title: 'Source',
              value: alert.source,
              short: true,
            },
            {
              title: 'Time',
              value: alert.timestamp.toISOString(),
              short: true,
            },
            {
              title: 'Description',
              value: alert.description,
              short: false,
            },
          ],
        },
      ],
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`📱 [SLACK ALERT] ${alert.title}`, payload)
      return
    }

    try {
      const response = await fetch(config.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to send Slack alert:', error)
      throw error
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: Alert, config: NonNullable<AlertChannelConfig['webhook']>): Promise<void> {
    const payload = {
      ...config.payload,
      alert: {
        id: alert.id,
        title: alert.title,
        description: alert.description,
        severity: alert.severity,
        category: alert.category,
        timestamp: alert.timestamp.toISOString(),
        source: alert.source,
        metadata: alert.metadata,
      },
    }

    try {
      const response = await fetch(config.url, {
        method: config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to send webhook alert:', error)
      throw error
    }
  }

  /**
   * Send Sentry alert
   */
  private sendSentryAlert(alert: Alert): void {
    Sentry.withScope(scope => {
      scope.setTag('alert_id', alert.id)
      scope.setTag('alert_category', alert.category)
      scope.setTag('alert_source', alert.source)
      scope.setLevel(alert.severity === 'critical' ? 'fatal' : alert.severity as any)
      scope.setContext('alert', {
        title: alert.title,
        description: alert.description,
        timestamp: alert.timestamp,
        metadata: alert.metadata,
      })

      captureMessage(`Alert: ${alert.title}`, alert.severity as any)
    })
  }

  /**
   * Send console alert
   */
  private sendConsoleAlert(alert: Alert): void {
    const severityEmojis = {
      info: '🔵',
      warning: '🟡',
      error: '🔴',
      critical: '🚨',
    }

    console.log(`${severityEmojis[alert.severity]} [ALERT] ${alert.title}`, {
      severity: alert.severity,
      category: alert.category,
      source: alert.source,
      description: alert.description,
      timestamp: alert.timestamp,
      metadata: alert.metadata,
    })
  }

  /**
   * Setup escalation for an alert
   */
  private setupEscalation(alert: Alert, escalationRules: EscalationRule[]): void {
    escalationRules.forEach((rule, index) => {
      const timer = setTimeout(async () => {
        if (this.alerts.get(alert.id)?.resolved) {
          return
        }

        alert.escalationLevel = index + 1
        await this.executeAlertActions(alert, rule.actions)
        
        console.log(`⬆️ Alert escalated to level ${alert.escalationLevel}: ${alert.title}`)
      }, rule.after * 60 * 1000) // Convert minutes to milliseconds

      this.escalationTimers.set(`${alert.id}_${index}`, timer)
    })
  }

  /**
   * Check if rule is in cooldown
   */
  private isInCooldown(ruleId: string): boolean {
    const cooldownEnd = this.cooldowns.get(ruleId)
    if (!cooldownEnd) return false
    
    return new Date() < cooldownEnd
  }

  /**
   * Set cooldown for rule
   */
  private setCooldown(ruleId: string, minutes: number): void {
    const cooldownEnd = new Date()
    cooldownEnd.setMinutes(cooldownEnd.getMinutes() + minutes)
    this.cooldowns.set(ruleId, cooldownEnd)
  }

  /**
   * Setup default alerting rules
   */
  private setupDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'performance_critical',
        name: 'Critical Performance Alert',
        category: 'performance',
        enabled: true,
        conditions: [
          {
            metric: 'response_time',
            operator: 'gt',
            threshold: 5000, // 5 seconds
            window: 5,
          },
        ],
        actions: [
          {
            channel: 'console',
            config: {},
            severity: ['critical', 'error'],
          },
        ],
        cooldown: 10,
        escalation: [
          {
            after: 15,
            actions: [
              {
                channel: 'sentry',
                config: {},
                severity: ['critical'],
              },
            ],
          },
        ],
      },
      {
        id: 'error_rate_high',
        name: 'High Error Rate Alert',
        category: 'error',
        enabled: true,
        conditions: [
          {
            metric: 'error_rate',
            operator: 'gt',
            threshold: 10, // 10%
            window: 10,
            count: 5,
          },
        ],
        actions: [
          {
            channel: 'console',
            config: {},
            severity: ['warning', 'error', 'critical'],
          },
          {
            channel: 'sentry',
            config: {},
            severity: ['error', 'critical'],
          },
        ],
        cooldown: 20,
      },
    ]

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule)
    })

    console.log(`📋 Loaded ${defaultRules.length} default alert rules`)
  }

  /**
   * Add custom alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule)
    console.log(`➕ Added alert rule: ${rule.name}`)
  }

  /**
   * Remove alert rule
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId)
    if (removed) {
      console.log(`➖ Removed alert rule: ${ruleId}`)
    }
    return removed
  }

  /**
   * Get alerting metrics
   */
  getMetrics(): AlertingMetrics {
    const allAlerts = Array.from(this.alerts.values())
    const resolvedAlerts = allAlerts.filter(a => a.resolved)
    
    const alertsByCategory = allAlerts.reduce((acc, alert) => {
      acc[alert.category] = (acc[alert.category] || 0) + 1
      return acc
    }, {} as Record<AlertCategory, number>)

    const alertsBySeverity = allAlerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1
      return acc
    }, {} as Record<AlertSeverity, number>)

    const avgResolutionTime = resolvedAlerts.length > 0 
      ? resolvedAlerts.reduce((sum, alert) => {
          if (alert.resolvedAt) {
            return sum + (alert.resolvedAt.getTime() - alert.timestamp.getTime())
          }
          return sum
        }, 0) / resolvedAlerts.length / 1000 / 60 // Convert to minutes
      : 0

    return {
      totalAlerts: allAlerts.length,
      alertsByCategory,
      alertsBySeverity,
      resolvedAlerts: resolvedAlerts.length,
      avgResolutionTime: Math.round(avgResolutionTime),
      escalatedAlerts: allAlerts.filter(a => a.escalationLevel > 0).length,
    }
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit = 50): Alert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Clear old resolved alerts (cleanup)
   */
  cleanup(maxAge = 7): void { // 7 days by default
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - maxAge)
    
    let cleaned = 0
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < cutoff) {
        this.alerts.delete(id)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old resolved alerts`)
    }
  }
}

// Export singleton instance
export const alertingService = AlertingService.getInstance()

// Helper functions for common alerts
export const createPerformanceAlert = (
  responseTime: number,
  endpoint: string,
  metadata?: Record<string, any>
) => {
  const severity: AlertSeverity = responseTime > 5000 ? 'critical' : 
                                  responseTime > 2000 ? 'error' : 'warning'
  
  return alertingService.triggerAlert({
    title: `Slow Response Time: ${endpoint}`,
    description: `Endpoint ${endpoint} responded in ${responseTime}ms, which exceeds acceptable thresholds`,
    severity,
    category: 'performance',
    source: 'performance-monitor',
    metadata: {
      responseTime,
      endpoint,
      ...metadata,
    },
  })
}

export const createErrorAlert = (
  error: Error,
  source: string,
  metadata?: Record<string, any>
) => {
  return alertingService.triggerAlert({
    title: `Application Error: ${error.message}`,
    description: `An error occurred in ${source}: ${error.message}\n\nStack trace: ${error.stack}`,
    severity: 'error',
    category: 'error',
    source,
    metadata: {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      ...metadata,
    },
  })
}

export const createSecurityAlert = (
  threat: string,
  details: string,
  source: string,
  metadata?: Record<string, any>
) => {
  return alertingService.triggerAlert({
    title: `Security Alert: ${threat}`,
    description: details,
    severity: 'critical',
    category: 'security',
    source,
    metadata,
  })
}

// Export types and service
export { AlertingService }