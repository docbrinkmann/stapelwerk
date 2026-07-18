import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import os from 'os';
import { countUpStacks } from '@/lib/analytics-metrics';

/**
 * Enterprise Monitoring Router
 * Provides endpoints for system monitoring and alerting
 */
export const monitoringRouter = createTRPCRouter({
  // Get dashboard metrics and alerts
  getDashboardData: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const userId = ctx.userId!;

        // Get recent alerts (last 24 hours)
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);

        const [activeAlerts, recentAlerts, userStacks] = await Promise.all([
          // Active alerts (unresolved)
          ctx.prisma.monitoring_alerts.findMany({
            where: {
              resolved: false
            },
            orderBy: { timestamp: 'desc' },
            take: 10
          }),

          // Recent alerts (last 24h)
          ctx.prisma.monitoring_alerts.findMany({
            where: {
              timestamp: { gte: oneDayAgo }
            },
            orderBy: { timestamp: 'desc' },
            take: 50
          }),

          // User's stacks for metrics
          ctx.prisma.stacks.findMany({
            where: { userId },
            include: {
              stack_services: {
                include: {
                  services: true
                }
              }
            }
          })
        ]);

        // Calculate metrics
        const totalServices = userStacks.reduce(
          (sum, stack) => sum + stack.stack_services.length,
          0
        );

        // Group alerts by severity
        const alertsBySeverity = {
          critical: recentAlerts.filter(a => a.severity === 'critical').length,
          warning: recentAlerts.filter(a => a.severity === 'warning').length,
          info: recentAlerts.filter(a => a.severity === 'info').length
        };

        // Calculate uptime (simplified: 100% if no critical alerts)
        const criticalAlerts = recentAlerts.filter(a => a.severity === 'critical').length;
        const uptimePercentage = criticalAlerts > 0
          ? Math.max(95, 100 - (criticalAlerts * 2))
          : 100;

        // Format alerts for frontend
        const formattedAlerts = activeAlerts.map(alert => ({
          id: alert.id,
          severity: alert.severity as 'critical' | 'warning' | 'info',
          service: alert.service,
          message: alert.message,
          details: JSON.parse(alert.details || '{}'),
          timestamp: alert.timestamp,
          resolved: alert.resolved
        }));

        // Recent incidents (resolved alerts from last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentIncidents = await ctx.prisma.monitoring_alerts.findMany({
          where: {
            resolved: true,
            timestamp: { gte: sevenDaysAgo }
          },
          orderBy: { resolvedAt: 'desc' },
          take: 5
        });

        const formattedIncidents = recentIncidents.map(incident => {
          const resolveTime = incident.resolvedAt && incident.timestamp
            ? Math.round((incident.resolvedAt.getTime() - incident.timestamp.getTime()) / 1000 / 60)
            : 0;

          return {
            id: incident.id,
            title: incident.message,
            severity: incident.severity,
            status: 'resolved',
            timestamp: incident.timestamp,
            resolvedAt: incident.resolvedAt,
            resolveTime: `${resolveTime}m`,
            resolvedBy: incident.resolvedBy || 'system'
          };
        });

        // Real system metrics using Node.js os module
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const loadAvg = os.loadavg();

        // Calculate CPU usage from load average (1-minute average)
        // Load average represents number of processes in run queue
        // Divide by CPU count to get percentage-like metric
        const cpuUsagePercent = Math.min(100, Math.round((loadAvg[0] / cpus.length) * 100));

        // Calculate memory usage percentage
        const memoryUsagePercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

        // Calculate average response time from recent alerts if available
        // Default to 0 if no data (will show "No data" in UI)
        const avgResponseTime = recentAlerts.length > 0
          ? Math.round(recentAlerts.reduce((acc, alert) => {
              // Use resolution time as proxy for response time
              const resolveTime = alert.resolvedAt && alert.timestamp
                ? (alert.resolvedAt.getTime() - alert.timestamp.getTime()) / 1000 / 60 // minutes
                : 0;
              return acc + resolveTime;
            }, 0) / recentAlerts.length * 1000) // convert to ms
          : 0;

        return {
          metrics: {
            activeServices: userStacks.filter(s => s.status === 'public').length,
            totalAlerts: activeAlerts.length,
            uptime: uptimePercentage,
            responseTime: avgResponseTime, // Real avg response time from alert resolution
            cpu: cpuUsagePercent, // Real CPU usage from system load average
            memory: memoryUsagePercent, // Real memory usage from os module
            network: 0 // Network metrics require additional monitoring (future: integrate with network interface stats)
          },
          alerts: formattedAlerts,
          alertsBySeverity,
          recentIncidents: formattedIncidents,
          summary: {
            totalStacks: userStacks.length,
            totalServices,
            activeAlerts: activeAlerts.length,
            resolvedToday: recentAlerts.filter(a => a.resolved).length
          }
        };
      } catch (error) {
        console.error('Error fetching monitoring dashboard data:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch monitoring data'
        });
      }
    }),

  // Get alerts with filtering
  getAlerts: protectedProcedure
    .input(z.object({
      severity: z.enum(['critical', 'warning', 'info', 'all']).default('all'),
      resolved: z.boolean().optional(),
      limit: z.number().min(1).max(100).default(20)
    }))
    .query(async ({ input, ctx }) => {
      try {
        const whereClause: any = {};

        if (input.severity !== 'all') {
          whereClause.severity = input.severity;
        }

        if (input.resolved !== undefined) {
          whereClause.resolved = input.resolved;
        }

        const alerts = await ctx.prisma.monitoring_alerts.findMany({
          where: whereClause,
          orderBy: { timestamp: 'desc' },
          take: input.limit
        });

        return alerts.map(alert => ({
          id: alert.id,
          severity: alert.severity,
          service: alert.service,
          message: alert.message,
          details: JSON.parse(alert.details || '{}'),
          timestamp: alert.timestamp,
          resolved: alert.resolved,
          resolvedBy: alert.resolvedBy,
          resolvedAt: alert.resolvedAt
        }));
      } catch (error) {
        console.error('Error fetching alerts:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch alerts'
        });
      }
    }),

  // Create a new alert
  createAlert: protectedProcedure
    .input(z.object({
      severity: z.enum(['critical', 'warning', 'info']),
      service: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.any()).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const alert = await ctx.prisma.monitoring_alerts.create({
          data: {
            id: String(globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)),
            severity: input.severity,
            service: input.service,
            message: input.message,
            details: JSON.stringify(input.details || {}),
            resolved: false,
            timestamp: new Date()
          }
        });

        return { success: true, alert };
      } catch (error) {
        console.error('Error creating alert:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create alert'
        });
      }
    }),

  // Resolve an alert
  resolveAlert: protectedProcedure
    .input(z.object({
      id: z.string(),
      notes: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId!;

        const alert = await ctx.prisma.monitoring_alerts.update({
          where: { id: input.id },
          data: {
            resolved: true,
            resolvedBy: userId,
            resolvedAt: new Date()
          }
        });

        return { success: true, alert };
      } catch (error) {
        console.error('Error resolving alert:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to resolve alert'
        });
      }
    }),

  // Get system health metrics
  getSystemHealth: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const userId = ctx.userId!;

        // Get stack and service counts. "Active" = currently up (latest
        // lifecycle job is a succeeded apply) — same rule as the dashboard's
        // Running Stacks card; it used to count status='public', which is a
        // visibility state, not activity.
        const [totalStacks, lifecycleJobs, totalServices, alerts] = await Promise.all([
          ctx.prisma.stacks.count({ where: { userId } }),
          ctx.prisma.deployment_jobs.findMany({
            where: {
              stacks: { userId },
              mode: { in: ['apply', 'destroy'] }
            },
            select: { stackId: true, mode: true, status: true, createdAt: true }
          }),
          ctx.prisma.stack_services.count({
            where: {
              stacks: { userId }
            }
          }),
          ctx.prisma.monitoring_alerts.count({
            where: { resolved: false }
          })
        ]);
        const activeStacks = countUpStacks(lifecycleJobs);

        // Calculate health score (0-100)
        const maxAlerts = 10;
        const alertPenalty = Math.min(alerts / maxAlerts, 1) * 30;
        const healthScore = Math.round(100 - alertPenalty);

        return {
          healthScore,
          status: healthScore > 80 ? 'healthy' : healthScore > 50 ? 'degraded' : 'unhealthy',
          metrics: {
            totalStacks,
            activeStacks,
            totalServices,
            activeAlerts: alerts
          }
        };
      } catch (error) {
        console.error('Error fetching system health:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch system health'
        });
      }
    })
});
