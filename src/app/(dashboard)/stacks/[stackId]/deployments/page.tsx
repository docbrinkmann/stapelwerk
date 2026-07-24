'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { trpc } from '@/trpc/react-client'
import { useJobStatus } from '@/hooks/useJobStatus'
import { LogViewer, type LogEntry, type LogLevel } from '@/components/logs/log-viewer'
import { VerifiedDeployPanel } from '@/components/deployments/VerifiedDeployPanel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Play,
  Square,
  Server,
  Cloud,
  Plus,
  KeyRound,
  Rocket,
  Copy,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useT } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/messages'

const LOCAL_TARGET = 'local' as const

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'succeeded':
      return <CheckCircle2 className="h-5 w-5 text-success" />
    case 'failed':
      return <XCircle className="h-5 w-5 text-destructive" />
    case 'running':
      return <Loader2 className="h-5 w-5 text-info animate-spin" />
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />
  }
}

function StatusBadge({ status }: { status: string }) {
  const t = useT()
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; labelKey: MessageKey }> = {
    succeeded: { variant: 'default', labelKey: 'ops.jobStatusSucceeded' },
    failed: { variant: 'destructive', labelKey: 'ops.jobStatusFailed' },
    running: { variant: 'secondary', labelKey: 'ops.jobStatusRunning' },
    queued: { variant: 'outline', labelKey: 'ops.jobStatusQueued' },
  }
  const entry = config[status]
  return (
    <Badge variant={entry?.variant ?? 'outline'} className="capitalize">
      {entry ? t(entry.labelKey) : status}
    </Badge>
  )
}

/** Classify a raw compose log line into a level for the viewer. */
function levelForLine(msg: string): LogLevel {
  if (/(✗|\berror\b|\bfailed\b|\bfatal\b)/i.test(msg)) return 'error'
  if (/(\bwarn(ing)?\b)/i.test(msg)) return 'warn'
  return 'info'
}

/**
 * Register a remote Docker host as a deploy target. Key-based auth ONLY — there
 * is deliberately NO password field. The operator adds this deploy server's
 * PUBLIC key to the target host's ~/.ssh/authorized_keys; the private key stays
 * a server-side secret (DEPLOY_SSH_KEY_FILE), never entered or stored here.
 */
function AddRemoteTargetDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (targetId: string) => void
}) {
  const t = useT()
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [sshUser, setSshUser] = useState('')
  const [sshPort, setSshPort] = useState('22')
  const [riskAck, setRiskAck] = useState(false)

  const create = trpc.deployments.createTarget.useMutation({
    onSuccess: (target) => {
      onCreated(target.id)
      setName('')
      setHost('')
      setSshUser('')
      setSshPort('22')
      setRiskAck(false)
      onOpenChange(false)
    },
  })

  // Deploy server's public key — shown so the operator can authorize it on the
  // target host; generate it on demand when none is configured yet.
  const pubKey = trpc.deployments.getDeployPublicKey.useQuery(undefined, {
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })
  const genKey = trpc.deployments.generateDeployKey.useMutation({
    onSuccess: () => pubKey.refetch(),
  })

  const submit = () => {
    create.mutate({
      name: name.trim(),
      type: 'docker',
      provider: 'ssh',
      location: 'remote',
      host: host.trim(),
      sshUser: sshUser.trim(),
      sshPort: Number(sshPort) || 22,
      riskAcknowledged: riskAck,
    })
  }

  const canSubmit = name.trim() && host.trim() && sshUser.trim() && riskAck && !create.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('ops.addRemoteTarget')}</DialogTitle>
          <DialogDescription>
            {t('ops.addRemoteTargetDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rt-name">{t('common.name')}</Label>
            <Input id="rt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="HomeLab" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="rt-host">{t('ops.hostLabel')}</Label>
              <Input id="rt-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder={t('ops.hostPlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rt-port">{t('ops.sshPort')}</Label>
              <Input id="rt-port" value={sshPort} onChange={(e) => setSshPort(e.target.value)} className="w-24" inputMode="numeric" placeholder="22" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rt-user">{t('ops.sshUser')}</Label>
            <Input id="rt-user" value={sshUser} onChange={(e) => setSshUser(e.target.value)} placeholder="serveradmin" />
          </div>

          <div className="flex gap-2 rounded-lg border border-info/30 bg-info/10 p-3 text-sm text-muted-foreground">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <div>
              <p className="font-medium text-foreground">{t('ops.keyAuthOnly')}</p>
              <p>
                {t('ops.keyAuthAdd1')} <span className="font-medium">{t('ops.keyAuthPublicKey')}</span> {t('ops.keyAuthAdd2')}{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">~/.ssh/authorized_keys</code>{' '}
                {t('ops.keyAuthAdd3')}
              </p>
              {pubKey.data?.publicKey ? (
                <div className="mt-2 space-y-2">
                  <code className="block break-all rounded bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
                    {pubKey.data.publicKey}
                  </code>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard?.writeText(pubKey.data.publicKey ?? '').catch(() => undefined)}
                    >
                      <Copy className="mr-1.5 h-3 w-3" />
                      {t('ops.copyKey')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigator.clipboard
                          ?.writeText(`echo '${pubKey.data.publicKey}' >> ~/.ssh/authorized_keys`)
                          .catch(() => undefined)
                      }
                    >
                      {t('ops.copyInstallCommand')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="text-xs">
                    {t('ops.noDeployKeyYet')}
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => genKey.mutate({})} disabled={genKey.isPending}>
                    <KeyRound className="mr-1.5 h-3 w-3" />
                    {genKey.isPending ? t('ops.generating') : t('ops.generateDeployKey')}
                  </Button>
                  {genKey.error && <p className="text-xs text-destructive">{genKey.error.message}</p>}
                </div>
              )}
            </div>
          </div>

          <label htmlFor="rt-risk-ack" className="flex cursor-pointer items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
            <Checkbox id="rt-risk-ack" checked={riskAck} onCheckedChange={(c) => setRiskAck(c === true)} className="mt-0.5" />
            <span className="text-muted-foreground">
              I understand Stapelwerk will store an SSH deploy key that can run Docker on this host, and I&apos;m
              authorized to grant that access.{' '}
              <span className="text-foreground">Rather run it yourself?</span> Close this and use{' '}
              <span className="font-medium">Export</span> instead — no key held for you.
            </span>
          </label>

          {create.error && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {create.error.message}
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            {t('ops.addTarget')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function StackDeploymentsPage() {
  const t = useT()
  const params = useParams()
  const stackId = params.stackId as string

  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string>(LOCAL_TARGET)

  // Remember the last-used target per stack across reloads. Restored in an
  // effect (not the initializer) so SSR/hydration render the same default.
  const targetStorageKey = `bms:deploy-target:${stackId}`
  useEffect(() => {
    const saved = window.localStorage.getItem(targetStorageKey)
    if (saved) setTargetId(saved)
  }, [targetStorageKey])
  const selectTarget = (id: string) => {
    setTargetId(id)
    window.localStorage.setItem(targetStorageKey, id)
  }
  const [addOpen, setAddOpen] = useState(false)

  const jobsQuery = trpc.deployments.listJobs.useQuery(
    { stackId },
    { enabled: !!stackId, refetchInterval: 4000, retry: false },
  )

  // Registered deploy targets (direct-deploy only supports docker targets:
  // "this server" via the socket + remote hosts over SSH).
  const targetsQuery = trpc.deployments.listTargets.useQuery(
    { limit: 100 },
    { retry: false },
  )
  const dockerTargets = (targetsQuery.data?.targets ?? []).filter(
    (t) => t.type === 'docker',
  )

  // A restored target may have been deleted since — fall back to local.
  useEffect(() => {
    if (targetId === LOCAL_TARGET || !targetsQuery.data) return
    if (!targetsQuery.data.targets.some((t) => t.id === targetId)) setTargetId(LOCAL_TARGET)
  }, [targetsQuery.data, targetId])

  // Undefined targetId => "this server" (existing local path).
  const selectedTargetId = targetId === LOCAL_TARGET ? undefined : targetId

  const deploy = trpc.deployments.deployStack.useMutation({
    onSuccess: (job) => {
      setActiveJobId(job.id)
      void jobsQuery.refetch()
    },
  })
  const stop = trpc.deployments.stopStack.useMutation({
    onSuccess: (job) => {
      setActiveJobId(job.id)
      void jobsQuery.refetch()
    },
  })

  // Live status + logs for the active job (polls getJobStatus/getJobLogTail).
  const { status, logs, isRunning } = useJobStatus(activeJobId, {
    enabled: !!activeJobId,
    stopOnSuccess: true,
    stopOnFailure: true,
  })

  // Resume following an in-flight deployment after a refresh.
  useEffect(() => {
    if (activeJobId) return
    const running = jobsQuery.data?.jobs.find((j) => j.status === 'running')
    if (running) setActiveJobId(running.id)
  }, [jobsQuery.data, activeJobId])

  // Refresh history the moment the followed job settles.
  useEffect(() => {
    if (status === 'succeeded' || status === 'failed') void jobsQuery.refetch()
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  const logEntries: LogEntry[] = useMemo(
    () =>
      logs.map((e, i) => ({
        id: `${e.t}-${i}`,
        timestamp: new Date(e.t),
        level: levelForLine(e.msg),
        message: e.msg,
      })),
    [logs],
  )

  const jobs = jobsQuery.data?.jobs ?? []
  const busy = deploy.isPending || stop.isPending || isRunning
  const errorMsg = deploy.error?.message ?? stop.error?.message ?? null
  const isRemote = targetId !== LOCAL_TARGET

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{t('common.deploy')}</h2>
          <p className="text-muted-foreground inline-flex items-center gap-1.5">
            {isRemote ? <Cloud className="h-4 w-4 shrink-0" /> : <Server className="h-4 w-4 shrink-0" />}
            {isRemote
              ? t('ops.deployRemoteDesc')
              : t('ops.deployLocalDesc')}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Select
            value={targetId}
            onValueChange={(v) => (v === '__add__' ? setAddOpen(true) : selectTarget(v))}
          >
            <SelectTrigger className="w-[240px]" aria-label={t('ops.deploymentTarget')}>
              <SelectValue placeholder={t('ops.selectTarget')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LOCAL_TARGET}>{t('ops.thisServerLocal')}</SelectItem>
              {dockerTargets
                .filter((t) => t.location === 'remote')
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} — {t.sshUser}@{t.host}
                  </SelectItem>
                ))}
              <SelectItem value="__add__">{t('ops.addRemoteTargetItem')}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => deploy.mutate({ stackId, targetId: selectedTargetId })} disabled={busy}>
            {deploy.isPending || isRunning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="mr-2 h-4 w-4" />
            )}
            {isRunning ? t('ops.deployingEllipsis') : t('ops.deployNow')}
          </Button>
          <Button
            variant="outline"
            onClick={() => stop.mutate({ stackId, targetId: selectedTargetId })}
            disabled={deploy.isPending || stop.isPending}
          >
            <Square className="mr-2 h-4 w-4" />
            {t('ops.stop')}
          </Button>
        </div>
      </div>

      <AddRemoteTargetDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(id) => {
          void targetsQuery.refetch()
          selectTarget(id)
        }}
      />

      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {errorMsg}
        </div>
      )}

      {activeJobId && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Play className="h-5 w-5" />
              {t('ops.liveDeployLogs')}
              <StatusBadge status={status ?? 'queued'} />
            </CardTitle>
            <CardDescription>{t('ops.liveDeployLogsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[360px]">
              <LogViewer logs={logEntries} isStreaming={isRunning} />
            </div>
          </CardContent>
        </Card>
      )}

      <VerifiedDeployPanel stackId={stackId} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            {t('ops.deploymentHistory')}
          </CardTitle>
          <CardDescription>
            {jobs.length > 0
              ? t(jobs.length === 1 ? 'ops.showingLastDeploymentsOne' : 'ops.showingLastDeploymentsMany', { count: jobs.length })
              : t('ops.noDeploymentsYet')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
              <Rocket className="h-8 w-8" />
              <p>{t('ops.deployHistoryEmpty')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setActiveJobId(job.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 aria-[current=true]:border-primary"
                  aria-current={job.id === activeJobId}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <StatusIcon status={job.status} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">
                          {job.mode === 'destroy' ? t('ops.stop') : t('common.deploy')}
                        </span>
                        <StatusBadge status={job.status} />
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {job.id.slice(0, 8)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
