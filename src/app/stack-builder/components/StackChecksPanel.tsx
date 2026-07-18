'use client';

import { useMemo, type ComponentType, type ReactNode } from 'react';
import {
  AlertTriangle,
  XCircle,
  CheckCircle2,
  ShieldAlert,
  Link2Off,
  Cpu,
  MemoryStick,
  Gauge,
  ArrowUpCircle,
  PackageCheck,
} from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { ImageUpdateResult } from '@/lib/updates/image-updates';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStackBuilderStore } from '@/stores/stack-builder';
import { analyzeStack, type BuilderCheck, type BuilderCheckKind } from '@/lib/validation/stack-builder-checks';
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
export function StackChecksPanel() {
  const services = useStackBuilderStore(state => state.services);
  const name = useStackBuilderStore(state => state.name);
  const targetProfileId = useStackBuilderStore(state => state.targetProfileId);
  const setTargetProfile = useStackBuilderStore(state => state.setTargetProfile);
  const getStackValidationErrors = useStackBuilderStore(state => state.getStackValidationErrors);

  const checks = useMemo(() => analyzeStack(services), [services]);
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

  // Distinct pinned images, for the advisory "update available" check.
  const dockerImages = useMemo(
    () => [...new Set(services.map(s => s.service.dockerImage).filter((img): img is string => !!img))],
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
          <p className="text-sm">Add services to check for conflicts and see if the stack fits your hardware.</p>
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
            Resource budget
          </div>
          <Select value={targetProfileId} onValueChange={setTargetProfile}>
            <SelectTrigger className="h-8 w-[220px] max-w-full text-xs" aria-label="Target hardware profile">
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
            label="RAM"
            dimension={budget.memory}
            format={formatGb}
            unit=""
          />
          <BudgetBar
            icon={<Cpu className="h-3.5 w-3.5" />}
            label="CPU"
            dimension={budget.cpu}
            format={(v) => v.toFixed(1)}
            unit=" cores"
          />

          {budget.exceeds ? (
            <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                This stack may not fit on a {profile.name.replace(/\s*\(.*\)$/, '')} (needs ~
                {formatGb(usage.memoryMb)} RAM, {usage.cpuCores.toFixed(1)} cores).
              </span>
            </p>
          ) : budget.bounded ? (
            <p className="flex items-center gap-2 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Fits within {profile.name.replace(/\s*\(.*\)$/, '')}.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              No hardware limit set — showing totals only.
            </p>
          )}
        </div>
      </section>

      {/* Conflict + compatibility checks */}
      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ShieldAlert className="h-4 w-4" />
            Checks
          </div>
          <span className="text-xs text-muted-foreground">
            {problemCount === 0 ? 'All clear' : `${problemCount} to review`}
          </span>
        </div>

        <div className="p-4">
          {problemCount === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              No problems detected in this stack.
            </p>
          ) : (
            <ul className="space-y-2">
              {configErrors.map(message => (
                <li
                  key={message}
                  className="flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2"
                >
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div className="min-w-0 text-xs">
                    <span className="font-medium text-destructive">Stack configuration</span>
                    <span className="text-muted-foreground"> — {message}</span>
                  </div>
                </li>
              ))}
              {checks.map(check => (
                <CheckRow key={check.id} check={check} />
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
}: {
  isLoading: boolean;
  isError: boolean;
  results: ImageUpdateResult[];
}) {
  const updates = results.filter(r => r.updateAvailable);
  const pinNotes = results.filter(r => !r.updateAvailable && /latest/i.test(r.note));

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ArrowUpCircle className="h-4 w-4" />
          Image updates
        </div>
        <span className="text-xs text-muted-foreground">
          {isLoading
            ? 'Checking…'
            : isError
              ? 'Unavailable'
              : updates.length === 0
                ? 'Up to date'
                : `${updates.length} available`}
        </span>
      </div>

      <div className="p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Checking Docker Hub for newer image tags…</p>
        ) : isError || results.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Update status unavailable — this is advisory only and does not affect your stack.
          </p>
        ) : updates.length === 0 ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm text-success">
              <PackageCheck className="h-4 w-4" />
              All images are on the newest comparable tag.
            </p>
            {pinNotes.map(r => (
              <p key={r.image} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{r.repo}</span> — {r.note}
              </p>
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {updates.map(r => (
              <li
                key={r.image}
                className="flex items-start gap-2.5 rounded-md border border-info/40 bg-info/10 px-3 py-2"
              >
                <ArrowUpCircle className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                <div className="min-w-0 text-xs">
                  <span className="font-medium text-foreground">{r.repo}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    — update available:{' '}
                  </span>
                  <span className="font-mono text-foreground">{r.current}</span>
                  <span className="text-muted-foreground"> → </span>
                  <span className="font-mono text-info">{r.latestStable}</span>
                </div>
              </li>
            ))}
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
          {!bounded && <span className="text-muted-foreground"> / no limit</span>}
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
};

function CheckRow({ check }: { check: BuilderCheck }) {
  const Icon = KIND_ICON[check.kind];
  const isError = check.severity === 'error';
  const tone = isError ? 'text-destructive' : 'text-warning';
  const surface = isError
    ? 'border-destructive/40 bg-destructive/10'
    : 'border-warning/40 bg-warning/10';

  return (
    <li className={`flex items-start gap-2.5 rounded-md border px-3 py-2 ${surface}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
      <div className="min-w-0 text-xs">
        <span className={`font-medium ${tone}`}>{check.title}</span>
        <span className="text-muted-foreground"> — {check.message}</span>
      </div>
    </li>
  );
}

export default StackChecksPanel;
