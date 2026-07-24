'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { trpc } from '@/trpc/react-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, Layers, Plus, Server } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useT } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/messages'

const statusConfig: Record<string, { labelKey: MessageKey; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { labelKey: 'common.draft', variant: 'secondary' },
  active: { labelKey: 'ops.statusActive', variant: 'default' },
  public: { labelKey: 'ops.statusPublic', variant: 'default' },
  pending_approval: { labelKey: 'ops.statusPendingApproval', variant: 'outline' },
  rejected: { labelKey: 'ops.statusRejected', variant: 'destructive' },
}

function StacksSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-40" />
      ))}
    </div>
  )
}

export default function StacksPage() {
  const t = useT()
  const { data, isLoading, error } = trpc.stacks.list.useQuery({ limit: 50 })
  const stacks = data?.stacks ?? []

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('ops.stacksTitle')}</h1>
          <p className="text-muted-foreground">
            {t('ops.stacksSubtitle')}
          </p>
        </div>
        <Button asChild>
          <Link href={'/stack-builder' as Route}>
            <Plus className="mr-2 h-4 w-4" />
            {t('ops.newStack')}
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <StacksSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
          <h2 className="text-lg font-semibold">{t('ops.stacksLoadFailed')}</h2>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      ) : stacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Layers className="mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('ops.noStacksYet')}</h2>
          <p className="mb-4 max-w-sm text-muted-foreground">
            {t('ops.noStacksHint')}
          </p>
          <Button asChild>
            <Link href={'/stack-builder' as Route}>
              <Plus className="mr-2 h-4 w-4" />
              {t('ops.createFirstStack')}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stacks.map((stack: any) => {
            const config = statusConfig[stack.status]
            const status = config
              ? { label: t(config.labelKey), variant: config.variant }
              : { label: stack.status, variant: 'secondary' as const }
            const serviceCount = stack.stack_services?.length ?? stack._count?.stack_services ?? 0
            return (
              <Link key={stack.id} href={`/stacks/${stack.id}` as Route} className="group">
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="truncate text-base font-semibold">
                        {stack.name}
                      </CardTitle>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    {stack.description && (
                      <CardDescription className="line-clamp-2">
                        {stack.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Server className="h-4 w-4" />
                      {t(serviceCount === 1 ? 'ops.serviceCountOne' : 'ops.serviceCountMany', { count: serviceCount })}
                    </span>
                    {stack.updatedAt && (
                      <span>
                        {t('ops.updatedAgo', { time: formatDistanceToNow(new Date(stack.updatedAt), { addSuffix: true }) })}
                      </span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
