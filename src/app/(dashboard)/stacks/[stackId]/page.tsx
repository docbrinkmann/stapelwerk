'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/trpc/react-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Play,
  Square,
  RotateCw,
  Server,
  Activity,
  Clock,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useT } from '@/lib/i18n/client'
import type { MessageKey, Translate } from '@/lib/i18n/messages'

function StackOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const t = useT()
  const statusConfig: Record<string, { labelKey: MessageKey; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { labelKey: 'common.draft', variant: 'secondary' },
    active: { labelKey: 'ops.statusActive', variant: 'default' },
    public: { labelKey: 'ops.statusPublic', variant: 'default' },
    pending_approval: { labelKey: 'ops.statusPendingApproval', variant: 'outline' },
    rejected: { labelKey: 'ops.statusRejected', variant: 'destructive' },
  }

  const config = statusConfig[status]

  return (
    <Badge variant={config?.variant ?? 'secondary'}>
      {config ? t(config.labelKey) : status}
    </Badge>
  )
}

type DeployTone = 'running' | 'stopped' | 'failed' | 'pending' | 'none'

/**
 * Derive the real deployment status from the latest job. listJobs returns
 * newest-first with modes 'apply' (deploy) and 'destroy' (stop).
 * ponytail: per-container health isn't tracked yet — services share the
 * stack-level deploy state, which is honest (no more hardcoded green "Running").
 */
function deriveStatus(jobs: Array<{ mode: string; status: string }>, t: Translate): { label: string; tone: DeployTone } {
  const latest = jobs[0]
  if (!latest) return { label: t('ops.notDeployed'), tone: 'none' }
  if (latest.status === 'running' || latest.status === 'queued') {
    return { label: latest.mode === 'destroy' ? t('ops.stoppingEllipsis') : t('ops.deployingEllipsis'), tone: 'pending' }
  }
  if (latest.status === 'failed') return { label: t('ops.failed'), tone: 'failed' }
  if (latest.status === 'succeeded') {
    return latest.mode === 'destroy'
      ? { label: t('common.stopped'), tone: 'stopped' }
      : { label: t('common.running'), tone: 'running' }
  }
  return { label: latest.status, tone: 'pending' }
}

function dotClass(tone: DeployTone): string {
  switch (tone) {
    case 'running': return 'bg-success'
    case 'failed': return 'bg-destructive'
    case 'pending': return 'bg-info animate-pulse'
    default: return 'bg-muted-foreground' // stopped / none
  }
}

export default function StackOverviewPage() {
  const t = useT()
  const params = useParams()
  const stackId = params.stackId as string

  const { data: stack, isLoading, error } = trpc.stacks.get.useQuery(
    { id: stackId },
    { enabled: !!stackId }
  )

  // Real deployment status + live actions (same procedures the Deploy tab uses).
  const jobsQuery = trpc.deployments.listJobs.useQuery(
    { stackId },
    { enabled: !!stackId, refetchInterval: 5000, retry: false }
  )
  const deploy = trpc.deployments.deployStack.useMutation({
    onSuccess: () => void jobsQuery.refetch(),
  })
  const stop = trpc.deployments.stopStack.useMutation({
    onSuccess: () => void jobsQuery.refetch(),
  })

  if (isLoading) {
    return <StackOverviewSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold">{t('ops.stackLoadFailed')}</h2>
        <p className="text-muted-foreground">{error.message}</p>
      </div>
    )
  }

  if (!stack) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">{t('ops.stackNotFound')}</h2>
        <p className="text-muted-foreground">{t('ops.stackNotFoundHint')}</p>
      </div>
    )
  }

  const serviceCount = stack.stack_services?.length || 0
  const jobs = jobsQuery.data?.jobs ?? []
  const deployStatus = deriveStatus(jobs, t)
  const busy = deploy.isPending || stop.isPending || deployStatus.tone === 'pending'
  const actionError = deploy.error?.message ?? stop.error?.message ?? null

  // Restart = stop then redeploy on the local host.
  const runRestart = async () => {
    try {
      await stop.mutateAsync({ stackId })
      await deploy.mutateAsync({ stackId })
    } catch {
      // Errors surface via deploy.error / stop.error below.
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{stack.name}</h1>
            <StatusBadge status={stack.status} />
          </div>
          {stack.description && (
            <p className="text-muted-foreground">{stack.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => deploy.mutate({ stackId })} disabled={busy}>
            {deploy.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            {t('common.deploy')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => stop.mutate({ stackId })} disabled={busy}>
            {stop.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Square className="h-4 w-4 mr-2" />}
            {t('ops.stop')}
          </Button>
          <Button variant="outline" size="sm" onClick={runRestart} disabled={busy}>
            <RotateCw className="h-4 w-4 mr-2" />
            {t('ops.restart')}
          </Button>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ops.tabServices')}</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{serviceCount}</div>
            <p className="text-xs text-muted-foreground">
              {t(serviceCount === 1 ? 'ops.serviceInStack' : 'ops.servicesInStack')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ops.statusCardTitle')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${dotClass(deployStatus.tone)}`} />
              <span className="text-2xl font-bold">{deployStatus.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              <Link href={`/stacks/${stackId}/deployments`} className="hover:underline">
                {t('ops.viewDeploymentLogs')}
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ops.lastUpdated')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDistanceToNow(new Date(stack.updatedAt), { addSuffix: true })}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('ops.createdAgo', { time: formatDistanceToNow(new Date(stack.createdAt), { addSuffix: true }) })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Services List Preview */}
      <Card>
        <CardHeader>
          <CardTitle>{t('ops.tabServices')}</CardTitle>
          <CardDescription>
            {t('ops.servicesCardDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {serviceCount === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t('ops.noServicesInStack')}
            </p>
          ) : (
            <div className="space-y-3">
              {stack.stack_services?.map((stackService: any) => (
                <div
                  key={stackService.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Server className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{stackService.services?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {stackService.services?.dockerImage || t('ops.noImage')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <span className={`h-2 w-2 rounded-full ${dotClass(deployStatus.tone)}`} />
                    {deployStatus.label}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
