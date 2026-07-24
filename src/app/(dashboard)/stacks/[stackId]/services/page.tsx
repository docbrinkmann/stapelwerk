'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { trpc } from '@/trpc/react-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Server, Plus, Trash2, Loader2, Search } from 'lucide-react'
import { useT } from '@/lib/i18n/client'

function AddServiceDialog({
  open,
  onOpenChange,
  stackId,
  existingServiceIds,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  stackId: string
  existingServiceIds: number[]
  onAdded: () => void
}) {
  const t = useT()
  const [search, setSearch] = useState('')
  const catalog = trpc.services.list.useQuery(
    { search: search || undefined, limit: 50 },
    { enabled: open },
  )
  const add = trpc.stacks.addService.useMutation({
    onSuccess: () => {
      onAdded()
      onOpenChange(false)
    },
  })

  const available = (catalog.data?.services ?? []).filter(
    (s: any) => !existingServiceIds.includes(s.id),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('ops.addAService')}</DialogTitle>
          <DialogDescription>{t('ops.addServiceDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('ops.searchServicesPlaceholder')}
              className="pl-9"
              aria-label={t('ops.searchServicesAria')}
            />
          </div>
          {add.error && (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {add.error.message}
            </div>
          )}
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {catalog.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : available.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('ops.noMatchingServices')}</p>
            ) : (
              available.map((s: any) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => add.mutate({ stackId, serviceId: s.id })}
                  disabled={add.isPending}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                    <Server className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="font-medium">{s.name}</span>
                  {add.isPending && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function StackServicesPage() {
  const t = useT()
  const params = useParams()
  const stackId = params.stackId as string
  const [addOpen, setAddOpen] = useState(false)

  const utils = trpc.useUtils()
  const { data: stack, isLoading } = trpc.stacks.get.useQuery(
    { id: stackId },
    { enabled: !!stackId }
  )

  const remove = trpc.stacks.removeService.useMutation({
    onSuccess: () => { void utils.stacks.get.invalidate({ id: stackId }) },
  })
  const refetchStack = () => { void utils.stacks.get.invalidate({ id: stackId }) }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  const services = stack?.stack_services || []
  const existingServiceIds = services.map((s: any) => s.serviceId).filter((id: unknown): id is number => typeof id === 'number')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t('ops.tabServices')}</h2>
          <p className="text-muted-foreground">
            {t('ops.servicesSubtitle')}
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('ops.addService')}
        </Button>
      </div>

      {services.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">{t('ops.noServicesYet')}</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-2">
              {t('ops.noServicesHint')}
            </p>
            <Button className="mt-4" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('ops.addFirstService')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {services.map((stackService: any) => (
            <Card key={stackService.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Server className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {stackService.services?.name}
                      </CardTitle>
                      <CardDescription>
                        {stackService.services?.dockerImage || t('ops.noImage')}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => remove.mutate({ stackId, serviceId: stackService.serviceId })}
                    disabled={remove.isPending}
                    aria-label={t('ops.removeService', { name: stackService.services?.name ?? t('ops.serviceFallback') })}
                  >
                    {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t('ops.categoryLabel')}</p>
                    <p className="font-medium">
                      {stackService.services?.categories?.name || t('ops.uncategorized')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('ops.orderLabel')}</p>
                    <p className="font-medium">{stackService.order}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddServiceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        stackId={stackId}
        existingServiceIds={existingServiceIds}
        onAdded={refetchStack}
      />
    </div>
  )
}
