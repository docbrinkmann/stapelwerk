'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { trpc } from '@/trpc/react-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, AlertTriangle, ExternalLink, HardDrive, Link2, Network, Plus, Server } from 'lucide-react'

function portLabel(p: { hostPort: number; containerPort: number; protocol: string }): string {
  const proto = p.protocol && p.protocol !== 'tcp' ? `/${p.protocol}` : ''
  return `${p.hostPort}:${p.containerPort}${proto}`
}

export default function NetworkPage() {
  const { data, isLoading, error } = trpc.stacks.networkOverview.useQuery()
  const stacks = data?.stacks ?? []
  const conflicts = data?.conflicts ?? []
  const conflictPorts = new Set(conflicts.map((c) => c.hostPort))

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Network</h1>
        <p className="text-muted-foreground">
          Published host ports and internal networking across all your stacks. Each stack runs on its
          own{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm text-foreground">appnet</code>{' '}
          bridge network — services reach each other by name.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
          <h2 className="text-lg font-semibold">Failed to load network info</h2>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      ) : stacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Network className="mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No stacks yet</h2>
          <p className="mb-4 max-w-sm text-muted-foreground">
            Compose a stack and map some ports — they&apos;ll show up here with conflict checks.
          </p>
          <Button asChild>
            <Link href={'/stack-builder' as Route}>
              <Plus className="mr-2 h-4 w-4" />
              Create a stack
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {conflicts.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {conflicts.length} host-port {conflicts.length === 1 ? 'conflict' : 'conflicts'}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                These host ports are bound by more than one service — those stacks can&apos;t run at
                the same time on one host.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {conflicts.map((c) => (
                  <li key={c.hostPort} className="flex flex-wrap items-center gap-2">
                    <Badge variant="destructive" className="font-mono">:{c.hostPort}</Badge>
                    <span className="text-muted-foreground">
                      {c.users.map((u) => `${u.stackName} / ${u.serviceName}`).join('  ·  ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            {stacks.length} {stacks.length === 1 ? 'stack' : 'stacks'} ·{' '}
            {data?.totalPublished ?? 0} published{' '}
            {(data?.totalPublished ?? 0) === 1 ? 'port' : 'ports'}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {stacks.map((stack) => (
              <Card key={stack.stackId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="truncate text-base">
                      <Link href={`/stacks/${stack.stackId}` as Route} className="hover:underline">
                        {stack.stackName}
                      </Link>
                    </CardTitle>
                    <Badge variant="outline" className="shrink-0 gap-1">
                      <Network className="h-3 w-3" />
                      {stack.network}
                    </Badge>
                  </div>
                  <CardDescription>
                    {stack.publishedCount} published {stack.publishedCount === 1 ? 'port' : 'ports'} ·{' '}
                    {stack.services.length} {stack.services.length === 1 ? 'service' : 'services'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stack.services.map((svc, idx) => (
                    <div
                      key={`${svc.serviceId}-${idx}`}
                      className="space-y-1.5 rounded-md border border-border/60 p-2.5"
                    >
                      <div className="flex items-center gap-1.5 text-sm">
                        <Server className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{svc.name}</span>
                        <code className="ml-auto rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                          {svc.internalHost}
                        </code>
                      </div>

                      {/* Internal endpoints — how other services in the stack reach it. */}
                      {svc.internalPorts.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="mr-0.5 text-xs text-muted-foreground">reachable at</span>
                          {svc.internalPorts.map((p, i) => (
                            <Badge
                              key={i}
                              variant={p.published ? 'secondary' : 'outline'}
                              className="font-mono text-xs"
                              title={[
                                p.description,
                                p.published ? 'also published to a host port' : 'stack-internal only',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            >
                              {svc.internalHost}:{p.containerPort}
                              {p.protocol && p.protocol !== 'tcp' ? `/${p.protocol}` : ''}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">no exposed ports</div>
                      )}

                      {/* Published host ports — reachable from the host, clickable. */}
                      {svc.publishedPorts.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="mr-0.5 text-xs text-muted-foreground">published</span>
                          {svc.publishedPorts.map((p, i) => (
                            <a
                              key={i}
                              href={`http://localhost:${p.hostPort}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Open http://localhost:${p.hostPort} (on the host running this stack)`}
                            >
                              <Badge
                                variant={conflictPorts.has(p.hostPort) ? 'destructive' : 'default'}
                                className="cursor-pointer gap-1 font-mono text-xs hover:opacity-80"
                              >
                                {portLabel(p)}
                                <ExternalLink className="h-3 w-3" />
                              </Badge>
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Depends on — which other services must start first. */}
                      {svc.dependsOn.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <Link2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="mr-0.5">depends on</span>
                          {svc.dependsOn.map((d, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {d}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Volumes — persistent data mounts. */}
                      {svc.volumes.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <HardDrive className="h-3.5 w-3.5 shrink-0" />
                          <span className="mr-0.5">volumes</span>
                          {svc.volumes.map((v, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="font-mono text-xs"
                              title={[
                                v.description,
                                v.named ? 'named volume (persistent)' : 'bind mount',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            >
                              {v.containerPath}
                              {v.named ? '' : ' (bind)'}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
