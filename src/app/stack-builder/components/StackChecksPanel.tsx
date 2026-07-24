'use client';

import { useMemo, type ComponentType, type ReactNode } from 'react';
import {
  AlertTriangle,
  XCircle,
  CheckCircle2,
  ShieldAlert,
  ShieldOff,
  Link2Off,
  Cpu,
  MemoryStick,
  Gauge,
  ArrowUpCircle,
  PackageCheck,
  KeyRound,
  ChevronRight,
} from 'lucide-react';
import { parse as parseYaml } from 'yaml';
import { trpc } from '@/utils/trpc';
import type { ImageUpdateResult } from '@/lib/updates/image-updates';
import { generateComposeWithSecrets } from '@/lib/stack-persistence';
import { auditCompose } from '@/lib/deploy/safety-audit';
import { effectiveImageRef } from '@/lib/updates/effective-image';
import type { StackService } from '@/types/stack';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStackBuilderStore } from '@/stores/stack-builder';
import { useT } from '@/lib/i18n/client';
import { analyzeStack, translateConfigError, auditToBuilderChecks, type BuilderCheck, type BuilderCheckKind, type ResolveTarget } from '@/lib/validation/stack-builder-checks';
import {
  TARGET_PROFILES,
  getProfile,
  sumStackResources,
  evaluateBudget,
  formatGb,
  type BudgetDimension,
} from '@/lib/resource-profiles';

/**
 * Requirements / Checks panel for the stack builder.
 *
 * Answers the two questions Coolify/Dokploy leave to deploy-time: "will this
 * actually build?" (live conflict + compatibility warnings) and "does it fit on
 * my hardware?" (resource budget vs a target profile). Fully derived from the
 * builder store, so it updates live as services are added/removed/configured.
 */
export function StackChecksPanel({ onResolve }: { onResolve?: (target: ResolveTarget) => void }) {
  const t = useT();
  const services = useStackBuilderStore(state => state.services);
  const name = useStackBuilderStore(state => state.name);
  const targetProfileId = useStackBuilderStore(state => state.targetProfileId);
  const setTargetProfile = useStackBuilderStore(state => state.setTargetProfile);
  const getStackValidationErrors = useStackBuilderStore(state => state.getStackValidationErrors);

  // Live builder checks: store-derived conflict/compatibility/VPN checks, PLUS
  // the deploy safety-audit FAILURES (exposed datastore port, data-loss volume,
  // default secret). The audit runs the SAME auditCompose the €29 report uses,
  // on a client-assembled compose, so the builder shows exactly what the report
  // will attest. Guarded: a compose-assembly hiccup must never blank the panel.
  const checks = useMemo(() => {
    const base = analyzeStack(services, t);
    try {
      const { yaml } = generateComposeWithSecrets({ name, description: '', isPublic: false, services });
      return [...base, ...auditToBuilderChecks(auditCompose(parseYaml(yaml)))];
    } catch {
      return base;
    }
  }, [services, name, t]);
  // Stack-level config errors (e.g. "Stack name is required") come from the
  // store's validateStack — the same source as the toolbar's error badge. Port
  // conflicts are dropped here because analyzeStack() already reports them in
  // detail below, so they'd otherwise show twice.
  const configErrors = useMemo(
    () => getStackValidationErrors().filter(e => e !== 'Port conflicts detected'),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when the stack changes
    [getStackValidationErrors, name, services],
  );
  const problemCount = configErrors.length + checks.length;
  const usage = useMemo(() => sumStackResources(services), [services]);
  const profile = getProfile(targetProfileId);
  const budget = useMemo(() => evaluateBudget(usage, profile), [usage, profile]);

  // Distinct EFFECTIVE images (catalog tag with any override applied), so once
  // you apply an update the check compares the new tag and the hint clears.
  const dockerImages = useMemo(
    () => [...new Set(services.map(effectiveImageRef).filter((img): img is string => !!img))],
    [services],
  );
  // Advisory only: never retry-storm, never surface errors to the user.
  const updatesQuery = trpc.services.checkImageUpdates.useQuery(
    { dockerImages },
    { enabled: dockerImages.length > 0, retry: false, staleTime: 5 * 60 * 1000 },
  );

  if (services.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
        <div>
          <Gauge className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <p className="text-sm">{t('builder.checksEmpty')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="stack-checks-panel">
      {/* Resource budget */}
      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Gauge className="h-4 w-4" />
            {t('builder.resourceBudget')}
          </div>
          <Select value={targetProfileId} onValueChange={setTargetProfile}>
            <SelectTrigger className="h-8 w-[220px] max-w-full text-xs" aria-label={t('builder.targetProfileAria')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGET_PROFILES.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4 p-4">
          <BudgetBar
            icon={<MemoryStick className="h-3.5 w-3.5" />}
            label={t('builder.ram')}
            dimension={budget.memory}
            format={formatGb}
            unit=""
          />
          <BudgetBar
            icon={<Cpu className="h-3.5 w-3.5" />}
            label={t('builder.cpu')}
            dimension={budget.cpu}
            format={(v) => v.toFixed(1)}
            unit={t('builder.unitCores')}
          />

          {budget.exceeds ? (
            <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {t('builder.budgetExceeds', {
                  profile: profile.name.replace(/\s*\(.*\)$/, ''),
                  ram: formatGb(usage.memoryMb),
                  cpu: usage.cpuCores.toFixed(1),
                })}
              </span>
            </p>
          ) : budget.bounded ? (
            <p className="flex items-center gap-2 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('builder.budgetFits', { profile: profile.name.replace(/\s*\(.*\)$/, '') })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t('builder.noHardwareLimit')}
            </p>
          )}
        </div>
      </section>

      {/* Conflict + compatibility checks */}
      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ShieldAlert className="h-4 w-4" />
            {t('builder.checks')}
          </div>
          <span className="text-xs text-muted-foreground">
            {problemCount === 0 ? t('builder.allClear') : t('builder.toReview', { count: problemCount })}
          </span>
        </div>

        <div className="p-4">
          {problemCount === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              {t('builder.noProblems')}
            </p>
          ) : (
            <ul className="space-y-2">
              {configErrors.map(message => {
                // Only "Stack name is required" has a jump target (the name field).
                const target: ResolveTarget | undefined =
                  message === 'Stack name is required' ? { kind: 'stack-name' } : undefined;
                const clickable = !!target && !!onResolve;
                return (
                  <li key={message}>
                    <RowShell
                      surface="border-destructive/40 bg-destructive/10"
                      onClick={clickable ? () => onResolve!(target!) : undefined}
                      jumpLabel={t('builder.jumpToFixAria')}
                    >
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      <div className="min-w-0 flex-1 text-xs">
                        <span className="font-medium text-destructive">{t('builder.stackConfiguration')}</span>
                        <span className="text-muted-foreground"> — {translateConfigError(message, t)}</span>
                      </div>
                    </RowShell>
                  </li>
                );
              })}
              {checks.map(check => (
                <CheckRow key={check.id} check={check} onResolve={onResolve} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Image update awareness */}
      <UpdatesSection
        isLoading={updatesQuery.isLoading}
        isError={updatesQuery.isError}
        results={updatesQuery.data?.results ?? []}
        services={services}
        onResolve={onResolve}
      />
    </div>
  );
}

/**
 * Advisory "update available" panel. Purely informational: a newer Docker Hub
 * tag for a pinned image is surfaced as a hint, an unreachable registry as a
 * quiet "unknown". Never blocks the builder.
 */
function UpdatesSection({
  isLoading,
  isError,
  results,
  services,
  onResolve,
}: {
  isLoading: boolean;
  isError: boolean;
  results: ImageUpdateResult[];
  services: StackService[];
  onResolve?: (target: ResolveTarget) => void;
}) {
  const t = useT();
  const updates = results.filter(r => r.updateAvailable);
  const pinNotes = results.filter(r => !r.updateAvailable && /latest/i.test(r.note));

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ArrowUpCircle className="h-4 w-4" />
          {t('builder.imageUpdates')}
        </div>
        <span className="text-xs text-muted-foreground">
          {isLoading
            ? t('builder.updatesChecking')
            : isError
              ? t('builder.updatesUnavailable')
              : updates.length === 0
                ? t('builder.updatesUpToDate')
                : t('builder.updatesAvailableCount', { count: updates.length })}
        </span>
      </div>

      <div className="p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('builder.updatesCheckingBody')}</p>
        ) : isError || results.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('builder.updatesUnavailableBody')}
          </p>
        ) : updates.length === 0 ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm text-success">
              <PackageCheck className="h-4 w-4" />
              {t('builder.updatesAllNewest')}
            </p>
            {pinNotes.map(r => (
              <p key={r.image} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{r.repo}</span> — {r.note}
              </p>
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {updates.map(r => {
              // Map the image back to the stack service so the click can jump to
              // its Image section with the newer tag pre-offered as a one-click.
              const svc = services.find(s => effectiveImageRef(s) === r.image);
              const target: ResolveTarget | undefined =
                svc && r.latestStable
                  ? { kind: 'service', stackServiceId: svc.id, section: 'image', suggestedTag: r.latestStable }
                  : undefined;
              const clickable = !!target && !!onResolve;
              return (
                <li key={r.image}>
                  <RowShell
                    surface="border-info/40 bg-info/10"
                    onClick={clickable ? () => onResolve!(target!) : undefined}
                    jumpLabel={t('builder.jumpToFixAria')}
                  >
                    <ArrowUpCircle className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                    <div className="min-w-0 flex-1 text-xs">
                      <span className="font-medium text-foreground">{r.repo}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        — {t('builder.updateAvailable')}{' '}
                      </span>
                      <span className="font-mono text-foreground">{r.current}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span className="font-mono text-info">{r.latestStable}</span>
                    </div>
                  </RowShell>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function BudgetBar({
  icon,
  label,
  dimension,
  format,
  unit,
}: {
  icon: ReactNode;
  label: string;
  dimension: BudgetDimension;
  format: (value: number) => string;
  unit: string;
}) {
  const t = useT();
  const bounded = dimension.limit > 0;
  const pct = bounded ? Math.min(dimension.ratio, 1) * 100 : 0;

  const barColor = dimension.exceeds
    ? 'bg-destructive'
    : dimension.ratio >= 0.8
      ? 'bg-warning'
      : 'bg-success';

  const valueColor = dimension.exceeds
    ? 'text-destructive'
    : dimension.ratio >= 0.8
      ? 'text-warning'
      : 'text-foreground';

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className={`font-mono ${valueColor}`}>
          {format(dimension.used)}
          {unit}
          {bounded && (
            <span className="text-muted-foreground">
              {' / '}
              {format(dimension.limit)}
              {unit}
            </span>
          )}
          {!bounded && <span className="text-muted-foreground"> / {t('builder.noLimit')}</span>}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        {bounded && (
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}

const KIND_ICON: Record<BuilderCheckKind, ComponentType<{ className?: string }>> = {
  port: XCircle,
  volume: AlertTriangle,
  dependency: Link2Off,
  compatibility: ShieldAlert,
  vpn: ShieldOff,
  secret: KeyRound,
  image: PackageCheck,
};

/**
 * Row container shared by every check/update row. When `onClick` is set the row
 * becomes a full-width button with a hover state and a chevron affordance — one
 * click jumps to where the user fixes the issue.
 */
function RowShell({
  surface,
  onClick,
  jumpLabel,
  children,
}: {
  surface: string;
  onClick?: () => void;
  jumpLabel: string;
  children: ReactNode;
}) {
  const cls = `flex items-start gap-2.5 rounded-md border px-3 py-2 ${surface}`;
  if (!onClick) {
    return <div className={cls}>{children}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={jumpLabel}
      title={jumpLabel}
      className={`${cls} w-full cursor-pointer text-left transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-ring`}
    >
      {children}
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 self-center text-muted-foreground" />
    </button>
  );
}

function CheckRow({ check, onResolve }: { check: BuilderCheck; onResolve?: (target: ResolveTarget) => void }) {
  const t = useT();
  const Icon = KIND_ICON[check.kind];
  const isError = check.severity === 'error';
  const tone = isError ? 'text-destructive' : 'text-warning';
  const surface = isError
    ? 'border-destructive/40 bg-destructive/10'
    : 'border-warning/40 bg-warning/10';
  const clickable = !!check.target && !!onResolve;

  return (
    <li>
      <RowShell
        surface={surface}
        onClick={clickable ? () => onResolve!(check.target!) : undefined}
        jumpLabel={t('builder.jumpToFixAria')}
      >
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
        <div className="min-w-0 flex-1 text-xs">
          <span className={`font-medium ${tone}`}>{check.title}</span>
          <span className="text-muted-foreground"> — {check.message}</span>
        </div>
      </RowShell>
    </li>
  );
}

export default StackChecksPanel;
