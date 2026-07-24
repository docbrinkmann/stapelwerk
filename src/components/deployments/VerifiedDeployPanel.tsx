'use client'

import { useState } from 'react'
import { trpc } from '@/trpc/react-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, ShieldAlert, Loader2, Download, BadgeCheck } from 'lucide-react'
import { useT } from '@/lib/i18n/client'
import type { Translate } from '@/lib/i18n/messages'
import type { VerifiedDeployReport } from '@/lib/deploy/verified-deploy-report'

// UI chrome is translated; the report CONTENT (summary, findings, property
// titles) renders verbatim — it is the signed EN artifact and must not be
// re-worded by the display locale.
function statusBadge(status: string, t: Translate) {
  if (status === 'leak-proof') return <Badge className="bg-success/10 text-success">{t('ops.vdBadgeKillSwitchVerified')}</Badge>
  if (status === 'routed-no-killswitch') return <Badge className="bg-warning/10 text-warning">{t('ops.vdBadgeRouted')}</Badge>
  if (status === 'leak') return <Badge className="bg-destructive/10 text-destructive">{t('ops.vdBadgeLeak')}</Badge>
  if (status === 'no-download-client') return <Badge className="bg-muted text-muted-foreground">{t('ops.vdBadgeNoClient')}</Badge>
  return <Badge variant="outline">{status}</Badge>
}

function auditStatusBadge(status: string, t: Translate) {
  if (status === 'pass') return <Badge className="bg-success/10 text-success">{t('ops.vdAuditSafe')}</Badge>
  if (status === 'warn') return <Badge className="bg-warning/10 text-warning">{t('ops.vdAuditAdvisories')}</Badge>
  if (status === 'fail') return <Badge className="bg-destructive/10 text-destructive">{t('ops.vdAuditNotSafe')}</Badge>
  return <Badge variant="outline">{status}</Badge>
}

/** Per-property colour for the audit list. */
function propertyClass(status: string): string {
  if (status === 'fail') return 'text-destructive'
  if (status === 'warn') return 'text-warning'
  if (status === 'pass') return 'text-success'
  return 'text-muted-foreground'
}

function AuditSection({ audit, t }: { audit: NonNullable<VerifiedDeployReport['audit']>; t: Translate }) {
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground">{t('ops.vdAuditHeading')}</span>
        {auditStatusBadge(audit.status, t)}
      </div>
      <ul className="mt-2 space-y-1.5 text-xs">
        {audit.properties.map((p) => (
          <li key={p.id}>
            <span className={propertyClass(p.status)}>
              {p.status === 'pass' ? '✓' : p.status === 'not-applicable' ? '–' : '✗'} {p.title}
            </span>
            {(p.status === 'fail' || p.status === 'warn') && (
              <ul className="ml-4 mt-0.5 space-y-0.5 text-muted-foreground">
                {p.findings
                  .filter((f) => f.verdict === 'fail' || f.verdict === 'warn')
                  .map((f, i) => (
                    <li key={i}>
                      • {f.service}: {f.detail}
                    </li>
                  ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function downloadReport(report: VerifiedDeployReport, signature: string | null) {
  const blob = new Blob([JSON.stringify({ report, signature }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `verified-deploy-${report.reportId}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * The one-time verified-deploy report affordance for a stack: generate the
 * provenance-signed proof (VPN kill-switch + the deploy safety audit) — free on
 * self-host, a redeemed credit on the hosted plan; €29 checkout when no credit.
 * We never boot the stack or hold a key to produce it — the proof is structural + signed.
 */
export function VerifiedDeployPanel({ stackId }: { stackId: string }) {
  const t = useT()
  const checkout = trpc.verifiedDeploy.checkout.useQuery()
  const entitlement = trpc.verifiedDeploy.entitlement.useQuery()
  const list = trpc.verifiedDeploy.listForStack.useQuery({ stackId })
  const utils = trpc.useUtils()
  const [fresh, setFresh] = useState<{ report: VerifiedDeployReport; signature: string | null } | null>(null)

  const generate = trpc.verifiedDeploy.generate.useMutation({
    onSuccess: (res) => {
      setFresh({ report: res.report, signature: res.signature })
      void utils.verifiedDeploy.listForStack.invalidate({ stackId })
      void utils.verifiedDeploy.entitlement.invalidate()
    },
  })

  const billingEnabled = checkout.data?.billingEnabled ?? false
  const credits = entitlement.data?.credits ?? null
  const canGenerateFree = !billingEnabled // self-host: free
  const hasCredit = billingEnabled && (credits ?? 0) > 0
  const needsPurchase = billingEnabled && (credits ?? 0) === 0
  const price = checkout.data?.price ?? 29

  return (
    <div className="rounded-xl border border-border bg-card p-5" data-testid="verified-deploy-panel">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-foreground">{t('ops.vdTitle')}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t('ops.vdIntro')}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {(canGenerateFree || hasCredit) && (
          <Button onClick={() => generate.mutate({ stackId })} disabled={generate.isPending}>
            {generate.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <BadgeCheck className="mr-2 h-4 w-4" />
            )}
            {canGenerateFree ? t('ops.vdGenerateFree') : t('ops.vdGenerateCredit')}
          </Button>
        )}
        {needsPurchase &&
          (checkout.data?.url ? (
            <Button asChild>
              <a href={checkout.data.url} target="_blank" rel="noreferrer">
                {t('ops.vdBuy', { price })}
              </a>
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">{t('ops.vdCheckoutUnconfigured')}</span>
          ))}
        {billingEnabled && credits != null && (
          <span className="text-xs text-muted-foreground">{t('ops.vdCreditsAvailable', { count: credits })}</span>
        )}
      </div>

      {generate.error && <p className="mt-3 text-sm text-destructive">{generate.error.message}</p>}

      {fresh && (
        <div className="mt-4 rounded-lg border border-border bg-background p-4" data-testid="verified-deploy-result">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {fresh.report.status === 'leak' ? (
                <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
              )}
              {statusBadge(fresh.report.status, t)}
              {fresh.signature ? (
                <Badge className="bg-success/10 text-success">{t('ops.vdBadgeSigned')}</Badge>
              ) : (
                <Badge variant="outline">{t('ops.vdBadgeUnsigned')}</Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadReport(fresh.report, fresh.signature)}>
              <Download className="mr-1.5 h-3 w-3" /> {t('ops.vdDownload')}
            </Button>
          </div>
          <p className="mt-2 text-sm text-foreground">{fresh.report.summary}</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {fresh.report.findings.map((f, i) => (
              <li key={i}>
                • {f.service}: {f.detail}
              </li>
            ))}
          </ul>
          {fresh.report.audit && <AuditSection audit={fresh.report.audit} t={t} />}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Report {fresh.report.reportId} · compose {fresh.report.composeSha256.slice(0, 12)}… · {fresh.report.issuedAt}
          </p>
        </div>
      )}

      {(list.data?.length ?? 0) > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-foreground">{t('ops.vdPastReports')}</h4>
          <ul className="mt-1 space-y-1">
            {list.data!.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                {statusBadge(r.status, t)}
                {r.signed && <BadgeCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />}
                <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
