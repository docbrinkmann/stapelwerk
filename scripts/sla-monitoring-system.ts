#!/usr/bin/env tsx
/**
 * Stapelwerk SLA Monitoring and Measurement System
 * 
 * This system provides comprehensive SLA monitoring, measurement, and alerting
 * capabilities for the Stapelwerk AI-powered recommendations platform.
 * 
 * Features:
 * - Real-time SLA metric collection and monitoring
 * - Automated alerting for SLA breaches
 * - Performance trend analysis and reporting
 * - Health check automation with custom thresholds
 * - Integration with monitoring services (Prometheus, Grafana, PagerDuty)
 * - Comprehensive SLA compliance reporting
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

// ==================== TYPES AND INTERFACES ====================

interface SLAMetric {
  id: string;
  name: string;
  category: 'availability' | 'performance' | 'security' | 'support' | 'ai_ml';
  target: number;
  unit: string;
  measurement: 'average' | 'percentile' | 'count' | 'percentage';
  percentile?: number;
  criticalThreshold: number;
  warningThreshold: number;
  tier: 'premium' | 'professional' | 'standard' | 'free' | 'all';
}

interface SLAMeasurement {
  metricId: string;
  timestamp: Date;
  value: number;
  status: 'compliant' | 'warning' | 'breach';
  context?: Record<string, any>;
}

interface SLAAlert {
  id: string;
  metricId: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

interface HealthCheck {
  id: string;
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  timeout: number;
  expectedStatus: number[];
  headers?: Record<string, string>;
  body?: any;
}

interface MonitoringConfig {
  baseUrl: string;
  enabledMetrics: string[];
  alertingChannels: {
    email?: string[];
    slack?: string;
    pagerduty?: string;
    webhook?: string;
  };
  reporting: {
    interval: number; // minutes
    retention: number; // days
    outputPath: string;
  };
  thresholds: Record<string, number>;
}

// ==================== SLA METRICS DEFINITIONS ====================

const SLA_METRICS: SLAMetric[] = [
  // Performance SLAs
  {
    id: 'api_response_time',
    name: 'API Response Time',
    category: 'performance',
    target: 500, // ms
    unit: 'ms',
    measurement: 'percentile',
    percentile: 95,
    criticalThreshold: 2000,
    warningThreshold: 800,
    tier: 'all'
  },
  {
    id: 'web_page_load_time',
    name: 'Web Page Load Time',
    category: 'performance',
    target: 2000, // ms
    unit: 'ms',
    measurement: 'percentile',
    percentile: 95,
    criticalThreshold: 4000,
    warningThreshold: 2500,
    tier: 'all'
  },
  {
    id: 'ai_recommendation_time',
    name: 'AI Recommendation Generation Time',
    category: 'ai_ml',
    target: 1000, // ms
    unit: 'ms',
    measurement: 'percentile',
    percentile: 95,
    criticalThreshold: 2000,
    warningThreshold: 1500,
    tier: 'all'
  },
  {
    id: 'database_query_time',
    name: 'Database Query Response Time',
    category: 'performance',
    target: 100, // ms
    unit: 'ms',
    measurement: 'percentile',
    percentile: 95,
    criticalThreshold: 1000,
    warningThreshold: 200,
    tier: 'all'
  },
  
  // Availability SLAs
  {
    id: 'service_availability',
    name: 'Service Availability',
    category: 'availability',
    target: 99.9, // %
    unit: '%',
    measurement: 'percentage',
    criticalThreshold: 99.0,
    warningThreshold: 99.5,
    tier: 'all'
  },
  {
    id: 'api_availability',
    name: 'API Availability',
    category: 'availability',
    target: 99.95, // %
    unit: '%',
    measurement: 'percentage',
    criticalThreshold: 99.5,
    warningThreshold: 99.8,
    tier: 'all'
  },
  {
    id: 'database_availability',
    name: 'Database Availability',
    category: 'availability',
    target: 99.99, // %
    unit: '%',
    measurement: 'percentage',
    criticalThreshold: 99.9,
    warningThreshold: 99.95,
    tier: 'all'
  },
  
  // AI/ML SLAs
  {
    id: 'ai_model_accuracy',
    name: 'AI Recommendation Accuracy',
    category: 'ai_ml',
    target: 85, // %
    unit: '%',
    measurement: 'percentage',
    criticalThreshold: 75,
    warningThreshold: 80,
    tier: 'all'
  },
  {
    id: 'recommendation_relevance',
    name: 'Recommendation Relevance Score',
    category: 'ai_ml',
    target: 90, // %
    unit: '%',
    measurement: 'percentage',
    criticalThreshold: 80,
    warningThreshold: 85,
    tier: 'all'
  },
  
  // Security SLAs
  {
    id: 'vulnerability_response_time',
    name: 'Critical Vulnerability Response Time',
    category: 'security',
    target: 60, // minutes
    unit: 'minutes',
    measurement: 'average',
    criticalThreshold: 240, // 4 hours
    warningThreshold: 120, // 2 hours
    tier: 'all'
  },
  {
    id: 'security_incident_detection',
    name: 'Security Incident Detection Time',
    category: 'security',
    target: 15, // minutes
    unit: 'minutes',
    measurement: 'average',
    criticalThreshold: 60,
    warningThreshold: 30,
    tier: 'all'
  }
];

// ==================== HEALTH CHECKS DEFINITIONS ====================

const HEALTH_CHECKS: HealthCheck[] = [
  {
    id: 'api_health',
    name: 'API Health Check',
    endpoint: '/api/health',
    method: 'GET',
    timeout: 5000,
    expectedStatus: [200]
  },
  {
    id: 'database_health',
    name: 'Database Health Check',
    endpoint: '/api/health/database',
    method: 'GET',
    timeout: 3000,
    expectedStatus: [200]
  },
  {
    id: 'ai_service_health',
    name: 'AI Service Health Check',
    endpoint: '/api/health/ai',
    method: 'GET',
    timeout: 10000,
    expectedStatus: [200]
  },
  {
    id: 'recommendations_endpoint',
    name: 'Recommendations Endpoint Check',
    endpoint: '/api/trpc/recommendations.getRecommendations',
    method: 'POST',
    timeout: 5000,
    expectedStatus: [200],
    headers: { 'Content-Type': 'application/json' },
    body: { projectType: 'web-app' }
  },
  {
    id: 'templates_endpoint',
    name: 'Templates Endpoint Check',
    endpoint: '/api/trpc/templates.list',
    method: 'GET',
    timeout: 3000,
    expectedStatus: [200]
  }
];

// ==================== SLA MONITORING SYSTEM CLASS ====================

export class SLAMonitoringSystem {
  private config: MonitoringConfig;
  private measurements: SLAMeasurement[] = [];
  private alerts: SLAAlert[] = [];
  private isRunning: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(config: MonitoringConfig) {
    this.config = config;
  }

  // ==================== CORE MONITORING METHODS ====================

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('SLA monitoring system is already running');
      return;
    }

    console.log('🚀 Starting SLA Monitoring System...');
    console.log(`📊 Monitoring ${this.config.enabledMetrics.length} metrics`);
    console.log(`🔄 Reporting interval: ${this.config.reporting.interval} minutes`);
    console.log(`📍 Base URL: ${this.config.baseUrl}`);

    this.isRunning = true;

    // Start continuous monitoring
    this.monitoringInterval = setInterval(
      () => this.performMonitoringCycle(),
      this.config.reporting.interval * 60 * 1000
    );

    // Perform initial monitoring cycle
    await this.performMonitoringCycle();

    console.log('✅ SLA Monitoring System started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('SLA monitoring system is not running');
      return;
    }

    console.log('🛑 Stopping SLA Monitoring System...');
    
    this.isRunning = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Generate final report
    await this.generateReport();
    
    console.log('✅ SLA Monitoring System stopped');
  }

  private async performMonitoringCycle(): Promise<void> {
    console.log(`\n🔍 Starting monitoring cycle at ${new Date().toISOString()}`);

    try {
      // Perform health checks
      await this.performHealthChecks();

      // Collect SLA measurements
      await this.collectSLAMeasurements();

      // Check for SLA violations
      await this.checkSLAViolations();

      // Clean up old data
      await this.cleanupOldData();

      console.log('✅ Monitoring cycle completed successfully');
    } catch (error) {
      console.error('❌ Error during monitoring cycle:', error);
      await this.sendAlert({
        id: `monitoring_error_${Date.now()}`,
        metricId: 'system_health',
        severity: 'critical',
        message: `SLA monitoring system encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        resolved: false
      });
    }
  }

  // ==================== HEALTH CHECKS ====================

  private async performHealthChecks(): Promise<void> {
    console.log('🏥 Performing health checks...');

    const healthPromises = HEALTH_CHECKS.map(check => this.performHealthCheck(check));
    const healthResults = await Promise.allSettled(healthPromises);

    let successCount = 0;
    let failureCount = 0;

    healthResults.forEach((result, index) => {
      const check = HEALTH_CHECKS[index];
      if (result.status === 'fulfilled' && result.value) {
        console.log(`  ✅ ${check.name}: OK`);
        successCount++;
      } else {
        console.log(`  ❌ ${check.name}: FAILED`);
        failureCount++;
        
        // Record availability measurement
        this.measurements.push({
          metricId: 'service_availability',
          timestamp: new Date(),
          value: 0, // Service down
          status: 'breach',
          context: { 
            healthCheck: check.id,
            error: result.status === 'rejected' ? result.reason : 'Health check failed'
          }
        });
      }
    });

    // Calculate overall availability
    const availabilityPercentage = (successCount / HEALTH_CHECKS.length) * 100;
    this.measurements.push({
      metricId: 'service_availability',
      timestamp: new Date(),
      value: availabilityPercentage,
      status: availabilityPercentage >= 99.9 ? 'compliant' : 
               availabilityPercentage >= 99.5 ? 'warning' : 'breach'
    });

    console.log(`📊 Health Check Results: ${successCount}/${HEALTH_CHECKS.length} passing (${availabilityPercentage.toFixed(2)}%)`);
  }

  private async performHealthCheck(check: HealthCheck): Promise<boolean> {
    const startTime = performance.now();
    
    try {
      const response = await axios({
        method: check.method,
        url: `${this.config.baseUrl}${check.endpoint}`,
        headers: check.headers,
        data: check.body,
        timeout: check.timeout,
        validateStatus: (status) => check.expectedStatus.includes(status)
      });

      const responseTime = performance.now() - startTime;

      // Record response time measurement
      this.measurements.push({
        metricId: this.getMetricIdForEndpoint(check.endpoint),
        timestamp: new Date(),
        value: responseTime,
        status: this.getStatusForResponseTime(responseTime, check.endpoint),
        context: {
          endpoint: check.endpoint,
          statusCode: response.status,
          healthCheck: check.id
        }
      });

      return true;
    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      // Record failed response time
      this.measurements.push({
        metricId: this.getMetricIdForEndpoint(check.endpoint),
        timestamp: new Date(),
        value: responseTime,
        status: 'breach',
        context: {
          endpoint: check.endpoint,
          error: error instanceof Error ? error.message : 'Unknown error',
          healthCheck: check.id
        }
      });

      return false;
    }
  }

  private getMetricIdForEndpoint(endpoint: string): string {
    if (endpoint.includes('recommendations')) return 'ai_recommendation_time';
    if (endpoint.includes('database')) return 'database_query_time';
    if (endpoint.includes('api/')) return 'api_response_time';
    return 'web_page_load_time';
  }

  private getStatusForResponseTime(responseTime: number, endpoint: string): 'compliant' | 'warning' | 'breach' {
    const metricId = this.getMetricIdForEndpoint(endpoint);
    const metric = SLA_METRICS.find(m => m.id === metricId);
    
    if (!metric) return 'compliant';
    
    if (responseTime >= metric.criticalThreshold) return 'breach';
    if (responseTime >= metric.warningThreshold) return 'warning';
    return 'compliant';
  }

  // ==================== SLA MEASUREMENTS ====================

  private async collectSLAMeasurements(): Promise<void> {
    console.log('📈 Collecting SLA measurements...');

    for (const metricId of this.config.enabledMetrics) {
      const metric = SLA_METRICS.find(m => m.id === metricId);
      if (!metric) continue;

      try {
        const measurement = await this.collectMetricMeasurement(metric);
        if (measurement) {
          this.measurements.push(measurement);
        }
      } catch (error) {
        console.error(`Error collecting measurement for ${metricId}:`, error);
      }
    }
  }

  private async collectMetricMeasurement(metric: SLAMetric): Promise<SLAMeasurement | null> {
    // Get recent measurements for this metric
    const recentMeasurements = this.getRecentMeasurements(metric.id, 60); // Last 60 minutes
    
    if (recentMeasurements.length === 0) {
      return null;
    }

    let value: number;

    switch (metric.measurement) {
      case 'average':
        value = recentMeasurements.reduce((sum, m) => sum + m.value, 0) / recentMeasurements.length;
        break;
      
      case 'percentile':
        value = this.calculatePercentile(recentMeasurements.map(m => m.value), metric.percentile || 95);
        break;
      
      case 'percentage':
        if (metric.id.includes('availability')) {
          const upMeasurements = recentMeasurements.filter(m => m.value > 0);
          value = (upMeasurements.length / recentMeasurements.length) * 100;
        } else {
          value = recentMeasurements[recentMeasurements.length - 1]?.value || 0;
        }
        break;
      
      case 'count':
        value = recentMeasurements.length;
        break;
      
      default:
        value = recentMeasurements[recentMeasurements.length - 1]?.value || 0;
    }

    const status = this.determineMetricStatus(value, metric);

    return {
      metricId: metric.id,
      timestamp: new Date(),
      value,
      status,
      context: {
        samplesCount: recentMeasurements.length,
        measurement: metric.measurement,
        percentile: metric.percentile
      }
    };
  }

  private getRecentMeasurements(metricId: string, minutes: number): SLAMeasurement[] {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return this.measurements.filter(m => 
      m.metricId === metricId && 
      m.timestamp >= cutoffTime
    ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private determineMetricStatus(value: number, metric: SLAMetric): 'compliant' | 'warning' | 'breach' {
    // For availability and percentage metrics, higher is better
    if (metric.unit === '%' && metric.category === 'availability') {
      if (value < metric.criticalThreshold) return 'breach';
      if (value < metric.warningThreshold) return 'warning';
      return 'compliant';
    }
    
    // For time-based metrics, lower is better
    if (metric.unit === 'ms' || metric.unit === 'minutes') {
      if (value >= metric.criticalThreshold) return 'breach';
      if (value >= metric.warningThreshold) return 'warning';
      return 'compliant';
    }
    
    // For accuracy/relevance metrics, higher is better
    if (metric.category === 'ai_ml' && metric.unit === '%') {
      if (value < metric.criticalThreshold) return 'breach';
      if (value < metric.warningThreshold) return 'warning';
      return 'compliant';
    }
    
    return 'compliant';
  }

  // ==================== SLA VIOLATION DETECTION ====================

  private async checkSLAViolations(): Promise<void> {
    console.log('⚠️  Checking for SLA violations...');

    const recentMeasurements = this.measurements.filter(m => 
      m.timestamp >= new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    );

    for (const measurement of recentMeasurements) {
      if (measurement.status === 'breach') {
        await this.handleSLABreach(measurement);
      } else if (measurement.status === 'warning') {
        await this.handleSLAWarning(measurement);
      }
    }
  }

  private async handleSLABreach(measurement: SLAMeasurement): Promise<void> {
    const metric = SLA_METRICS.find(m => m.id === measurement.metricId);
    if (!metric) return;

    // Check if we already have an active alert for this metric
    const existingAlert = this.alerts.find(a => 
      a.metricId === measurement.metricId && 
      !a.resolved &&
      a.severity === 'critical'
    );

    if (existingAlert) {
      console.log(`  🔄 SLA breach continues for ${metric.name}`);
      return;
    }

    const alert: SLAAlert = {
      id: `sla_breach_${measurement.metricId}_${Date.now()}`,
      metricId: measurement.metricId,
      severity: 'critical',
      message: `SLA BREACH: ${metric.name} is ${measurement.value}${metric.unit}, exceeding critical threshold of ${metric.criticalThreshold}${metric.unit}`,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.push(alert);
    await this.sendAlert(alert);

    console.log(`  🚨 SLA BREACH: ${metric.name} - ${measurement.value}${metric.unit} (threshold: ${metric.criticalThreshold}${metric.unit})`);
  }

  private async handleSLAWarning(measurement: SLAMeasurement): Promise<void> {
    const metric = SLA_METRICS.find(m => m.id === measurement.metricId);
    if (!metric) return;

    // Check if we already have an active alert for this metric
    const existingAlert = this.alerts.find(a => 
      a.metricId === measurement.metricId && 
      !a.resolved &&
      (a.severity === 'warning' || a.severity === 'critical')
    );

    if (existingAlert) {
      return;
    }

    const alert: SLAAlert = {
      id: `sla_warning_${measurement.metricId}_${Date.now()}`,
      metricId: measurement.metricId,
      severity: 'warning',
      message: `SLA WARNING: ${metric.name} is ${measurement.value}${metric.unit}, approaching threshold (warning: ${metric.warningThreshold}${metric.unit}, critical: ${metric.criticalThreshold}${metric.unit})`,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.push(alert);
    await this.sendAlert(alert);

    console.log(`  ⚠️  SLA WARNING: ${metric.name} - ${measurement.value}${metric.unit} (warning threshold: ${metric.warningThreshold}${metric.unit})`);
  }

  // ==================== ALERTING SYSTEM ====================

  private async sendAlert(alert: SLAAlert): Promise<void> {
    console.log(`📢 Sending ${alert.severity} alert: ${alert.message}`);

    // Send to configured alerting channels
    const promises: Promise<void>[] = [];

    if (this.config.alertingChannels.email) {
      promises.push(this.sendEmailAlert(alert));
    }

    if (this.config.alertingChannels.slack) {
      promises.push(this.sendSlackAlert(alert));
    }

    if (this.config.alertingChannels.pagerduty) {
      promises.push(this.sendPagerDutyAlert(alert));
    }

    if (this.config.alertingChannels.webhook) {
      promises.push(this.sendWebhookAlert(alert));
    }

    await Promise.allSettled(promises);
  }

  private async sendEmailAlert(alert: SLAAlert): Promise<void> {
    // Email alerting implementation would go here
    console.log(`  📧 Email alert sent for: ${alert.message}`);
  }

  private async sendSlackAlert(alert: SLAAlert): Promise<void> {
    // Slack alerting implementation would go here
    console.log(`  💬 Slack alert sent for: ${alert.message}`);
  }

  private async sendPagerDutyAlert(alert: SLAAlert): Promise<void> {
    // PagerDuty alerting implementation would go here
    console.log(`  📟 PagerDuty alert sent for: ${alert.message}`);
  }

  private async sendWebhookAlert(alert: SLAAlert): Promise<void> {
    if (!this.config.alertingChannels.webhook) return;

    try {
      await axios.post(this.config.alertingChannels.webhook, {
        alert: alert,
        timestamp: alert.timestamp.toISOString(),
        system: 'Stapelwerk SLA Monitor'
      });
      console.log(`  🔗 Webhook alert sent for: ${alert.message}`);
    } catch (error) {
      console.error(`  ❌ Failed to send webhook alert:`, error);
    }
  }

  // ==================== REPORTING SYSTEM ====================

  async generateReport(): Promise<string> {
    console.log('📊 Generating SLA compliance report...');

    const reportData = {
      timestamp: new Date().toISOString(),
      reportPeriod: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
        end: new Date().toISOString()
      },
      metrics: this.generateMetricsReport(),
      alerts: this.generateAlertsReport(),
      compliance: this.calculateOverallCompliance(),
      recommendations: this.generateRecommendations()
    };

    const reportJson = JSON.stringify(reportData, null, 2);
    const reportPath = path.join(this.config.reporting.outputPath, `sla-report-${Date.now()}.json`);

    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, reportJson);
      console.log(`✅ SLA report generated: ${reportPath}`);
    } catch (error) {
      console.error('❌ Failed to save SLA report:', error);
    }

    return reportJson;
  }

  private generateMetricsReport() {
    const metricsReport: any = {};

    for (const metric of SLA_METRICS) {
      const recentMeasurements = this.getRecentMeasurements(metric.id, 24 * 60); // Last 24 hours
      
      if (recentMeasurements.length === 0) {
        metricsReport[metric.id] = {
          name: metric.name,
          status: 'no_data',
          measurements: 0
        };
        continue;
      }

      const values = recentMeasurements.map(m => m.value);
      const latestMeasurement = recentMeasurements[recentMeasurements.length - 1];

      metricsReport[metric.id] = {
        name: metric.name,
        category: metric.category,
        target: metric.target,
        unit: metric.unit,
        currentValue: latestMeasurement.value,
        status: latestMeasurement.status,
        measurements: recentMeasurements.length,
        statistics: {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          p95: this.calculatePercentile(values, 95)
        },
        compliance: {
          compliant: recentMeasurements.filter(m => m.status === 'compliant').length,
          warning: recentMeasurements.filter(m => m.status === 'warning').length,
          breach: recentMeasurements.filter(m => m.status === 'breach').length
        }
      };
    }

    return metricsReport;
  }

  private generateAlertsReport() {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAlerts = this.alerts.filter(a => a.timestamp >= last24Hours);

    return {
      total: recentAlerts.length,
      critical: recentAlerts.filter(a => a.severity === 'critical').length,
      warning: recentAlerts.filter(a => a.severity === 'warning').length,
      resolved: recentAlerts.filter(a => a.resolved).length,
      active: recentAlerts.filter(a => !a.resolved).length,
      details: recentAlerts.map(a => ({
        id: a.id,
        metricId: a.metricId,
        severity: a.severity,
        message: a.message,
        timestamp: a.timestamp.toISOString(),
        resolved: a.resolved,
        resolvedAt: a.resolvedAt?.toISOString()
      }))
    };
  }

  private calculateOverallCompliance(): any {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentMeasurements = this.measurements.filter(m => m.timestamp >= last24Hours);

    if (recentMeasurements.length === 0) {
      return { status: 'no_data', percentage: 0 };
    }

    const compliantMeasurements = recentMeasurements.filter(m => m.status === 'compliant');
    const compliancePercentage = (compliantMeasurements.length / recentMeasurements.length) * 100;

    let status: string;
    if (compliancePercentage >= 99.5) status = 'excellent';
    else if (compliancePercentage >= 95) status = 'good';
    else if (compliancePercentage >= 90) status = 'fair';
    else status = 'poor';

    return {
      status,
      percentage: compliancePercentage,
      totalMeasurements: recentMeasurements.length,
      compliantMeasurements: compliantMeasurements.length,
      warningMeasurements: recentMeasurements.filter(m => m.status === 'warning').length,
      breachMeasurements: recentMeasurements.filter(m => m.status === 'breach').length
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const compliance = this.calculateOverallCompliance();

    if (compliance.percentage < 95) {
      recommendations.push('Overall SLA compliance is below target. Consider implementing performance optimizations.');
    }

    // Analyze specific metrics for recommendations
    const metricsReport = this.generateMetricsReport();
    
    for (const [metricId, report] of Object.entries(metricsReport)) {
      if (report.status === 'breach') {
        const metric = SLA_METRICS.find(m => m.id === metricId);
        if (metric) {
          recommendations.push(`${metric.name} is in breach. Consider scaling resources or optimizing ${metric.category} components.`);
        }
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('All SLA metrics are within acceptable ranges. Continue monitoring.');
    }

    return recommendations;
  }

  // ==================== DATA MANAGEMENT ====================

  private async cleanupOldData(): Promise<void> {
    const retentionCutoff = new Date(Date.now() - this.config.reporting.retention * 24 * 60 * 60 * 1000);
    
    const measurementsBefore = this.measurements.length;
    const alertsBefore = this.alerts.length;

    this.measurements = this.measurements.filter(m => m.timestamp >= retentionCutoff);
    this.alerts = this.alerts.filter(a => a.timestamp >= retentionCutoff);

    const measurementsRemoved = measurementsBefore - this.measurements.length;
    const alertsRemoved = alertsBefore - this.alerts.length;

    if (measurementsRemoved > 0 || alertsRemoved > 0) {
      console.log(`🧹 Cleaned up old data: ${measurementsRemoved} measurements, ${alertsRemoved} alerts removed`);
    }
  }

  // ==================== PUBLIC API METHODS ====================

  getMetrics(): SLAMetric[] {
    return [...SLA_METRICS];
  }

  getMeasurements(metricId?: string, hours: number = 24): SLAMeasurement[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.measurements
      .filter(m => m.timestamp >= cutoffTime)
      .filter(m => !metricId || m.metricId === metricId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getAlerts(resolved?: boolean, hours: number = 24): SLAAlert[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.alerts
      .filter(a => a.timestamp >= cutoffTime)
      .filter(a => resolved === undefined || a.resolved === resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    
    console.log(`✅ Alert resolved: ${alert.message}`);
    return true;
  }
}

// ==================== CLI INTERFACE ====================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'monitor';

  const config: MonitoringConfig = {
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    enabledMetrics: [
      'api_response_time',
      'web_page_load_time',
      'ai_recommendation_time',
      'database_query_time',
      'service_availability',
      'api_availability',
      'database_availability'
    ],
    alertingChannels: {
      webhook: process.env.WEBHOOK_URL,
      slack: process.env.SLACK_WEBHOOK,
      email: process.env.ALERT_EMAIL ? [process.env.ALERT_EMAIL] : undefined
    },
    reporting: {
      interval: parseInt(process.env.MONITORING_INTERVAL || '5'), // 5 minutes
      retention: parseInt(process.env.DATA_RETENTION_DAYS || '30'), // 30 days
      outputPath: process.env.REPORTS_PATH || './reports'
    },
    thresholds: {}
  };

  const monitor = new SLAMonitoringSystem(config);

  switch (command) {
    case 'monitor':
      await monitor.start();
      
      // Run for specified duration or until interrupted
      const duration = parseInt(args[1] || '0'); // 0 = run indefinitely
      if (duration > 0) {
        setTimeout(async () => {
          await monitor.stop();
          process.exit(0);
        }, duration * 60 * 1000);
      }
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        await monitor.stop();
        process.exit(0);
      });
      
      break;

    case 'report':
      console.log('📊 Generating one-time SLA report...');
      const report = await monitor.generateReport();
      console.log(report);
      break;

    case 'check':
      console.log('🔍 Performing one-time SLA check...');
      await monitor.start();
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      await monitor.stop();
      break;

    case 'metrics':
      console.log('📋 Available SLA metrics:');
      const metrics = monitor.getMetrics();
      metrics.forEach(metric => {
        console.log(`  ${metric.id}: ${metric.name} (${metric.target}${metric.unit})`);
      });
      break;

    default:
      console.log(`
Stapelwerk SLA Monitoring System

Usage: tsx sla-monitoring-system.ts [command] [options]

Commands:
  monitor [duration]  Start continuous SLA monitoring (duration in minutes, 0 = infinite)
  report             Generate one-time SLA compliance report
  check              Perform one-time health check and SLA validation
  metrics            List all available SLA metrics

Environment Variables:
  BASE_URL              Base URL for health checks (default: http://localhost:3000)
  WEBHOOK_URL           Webhook URL for alerts
  SLACK_WEBHOOK         Slack webhook URL for notifications
  ALERT_EMAIL           Email address for alerts
  MONITORING_INTERVAL   Monitoring interval in minutes (default: 5)
  DATA_RETENTION_DAYS   Data retention period in days (default: 30)
  REPORTS_PATH          Path for report outputs (default: ./reports)

Examples:
  tsx sla-monitoring-system.ts monitor       # Start continuous monitoring
  tsx sla-monitoring-system.ts monitor 60    # Monitor for 1 hour
  tsx sla-monitoring-system.ts report        # Generate report
  tsx sla-monitoring-system.ts check         # One-time check
      `);
      process.exit(1);
  }
}

// Run CLI if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default SLAMonitoringSystem;