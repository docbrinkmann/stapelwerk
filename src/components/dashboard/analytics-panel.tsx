'use client'

import { trpc } from '@/trpc/react-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, CheckCircle2, XCircle, Loader2, Clock, Rocket } from 'lucide-react'
import { useT } from '@/lib/i18n/client'

/** Real deployment analytics for the dashboard Analytics tab. */
export function AnalyticsPanel() {
  const t = useT()
  const stats = trpc.analytics.getDeploymentStats.useQuery(undefined, { retry: false })

  if (stats.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
    )
  }

  if (stats.error || !stats.data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <TrendingUp className="mx-auto mb-2 h-8 w-8" />
          {t('shell.analyticsUnavailable')}
        </CardContent>
      </Card>
    )
  }

  const d = stats.data
  const cards = [
    { label: t('shell.totalDeployments'), value: d.total, icon: Rocket },
    { label: t('shell.statusCompleted'), value: d.completed, icon: CheckCircle2 },
    { label: t('shell.statusFailed'), value: d.failed, icon: XCircle },
    { label: t('common.running'), value: d.running, icon: Loader2 },
    { label: t('shell.statusPending'), value: d.pending, icon: Clock },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
      {d.total === 0 && (
        <p className="text-sm text-muted-foreground">
          {t('shell.noDeployments')}
        </p>
      )}
    </div>
  )
}
