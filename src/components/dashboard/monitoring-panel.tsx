'use client'

import { trpc } from '@/trpc/react-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, Layers, Server, Bell, HeartPulse } from 'lucide-react'
import { useT } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/messages'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  healthy: 'default',
  degraded: 'secondary',
  unhealthy: 'destructive',
}

const STATUS_LABEL_KEY: Record<string, MessageKey> = {
  healthy: 'shell.statusHealthy',
  degraded: 'shell.statusDegraded',
  unhealthy: 'shell.statusUnhealthy',
}

/** Real system-health summary for the dashboard Monitoring tab. */
export function MonitoringPanel() {
  const t = useT()
  const health = trpc.monitoring.getSystemHealth.useQuery(undefined, { retry: false })

  if (health.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
    )
  }

  if (health.error || !health.data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Activity className="mx-auto mb-2 h-8 w-8" />
          {t('shell.monitoringUnavailable')}
        </CardContent>
      </Card>
    )
  }

  const { healthScore, status, metrics } = health.data
  const statusLabelKey = STATUS_LABEL_KEY[status]
  const cards = [
    { label: t('shell.totalStacks'), value: metrics.totalStacks, icon: Layers },
    { label: t('shell.activeStacks'), value: metrics.activeStacks, icon: Activity },
    { label: t('shell.servicesLabel'), value: metrics.totalServices, icon: Server },
    { label: t('shell.activeAlerts'), value: metrics.activeAlerts, icon: Bell },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <HeartPulse className="h-4 w-4 text-muted-foreground" />
            {t('shell.systemHealth')}
          </CardTitle>
          <Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>
            {statusLabelKey ? t(statusLabelKey) : status}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{healthScore}<span className="text-lg text-muted-foreground">/100</span></div>
          <p className="text-xs text-muted-foreground">{t('shell.healthScoreDesc')}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
