/**
 * Map prisma `stack_services` rows into the `PersistedStack.services` shape the
 * compose generator consumes. This is the single source of truth for the
 * DB → compose contract, shared by the deploy path (`deployments` router) and
 * the public shared-stack view (`stacks.getSharedStack`) so they can never drift.
 */
import type { PersistedStack } from '@/lib/stack-persistence';
import { normalizePorts } from '@/lib/network-overview';

function safeParseJSON<T>(val: string | null | undefined, fallback: T): T {
  try {
    return val ? (JSON.parse(val) as T) : fallback;
  } catch {
    return fallback;
  }
}

function parseArray<T = unknown>(val: string | null | undefined): T[] {
  const parsed = safeParseJSON<unknown>(val, []);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

/**
 * Config collections are persisted in the RECORD shape the API schema enforces
 * (`portMappings`/`volumeMounts` = `{ "<container>": "<host>" }`,
 * `dependsOn` = `["<serviceId>"]`), but the compose generator reads the ARRAY
 * shape the in-memory builder uses. These normalizers bridge both stored shapes
 * (record from the UI save, array from older/raw rows) into the generator's
 * shape — without them the deploy/handoff/shared compose silently drops every
 * published port and volume and emits an unresolvable `depends_on`.
 */
function normalizeVolumeMounts(
  val: string | null | undefined,
): Array<{ hostPath: string; containerPath: string; readOnly: boolean }> {
  const parsed = safeParseJSON<unknown>(val, []);
  const out: Array<{ hostPath: string; containerPath: string; readOnly: boolean }> = [];
  if (Array.isArray(parsed)) {
    for (const m of parsed) {
      if (!m || typeof m !== 'object') continue;
      const e = m as Record<string, unknown>;
      if (typeof e.hostPath === 'string' && typeof e.containerPath === 'string') {
        out.push({ hostPath: e.hostPath, containerPath: e.containerPath, readOnly: e.readOnly === true });
      }
    }
  } else if (parsed && typeof parsed === 'object') {
    // Record shape: { "<containerPath>": "<hostPath>" }.
    for (const [containerPath, hostPath] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof hostPath === 'string' && hostPath) out.push({ hostPath, containerPath, readOnly: false });
    }
  }
  return out;
}

function normalizeDependsOn(
  val: string | null | undefined,
): Array<{ serviceId: number } | { slug: string }> {
  const parsed = safeParseJSON<unknown>(val, []);
  if (!Array.isArray(parsed)) return [];
  const out: Array<{ serviceId: number } | { slug: string }> = [];
  for (const dep of parsed) {
    if (dep && typeof dep === 'object') {
      const d = dep as Record<string, unknown>;
      if (typeof d.serviceId === 'number') out.push({ serviceId: d.serviceId });
      else if (typeof d.slug === 'string') out.push({ slug: d.slug });
      continue;
    }
    // Bare serviceId as number or numeric string (the UI stores strings).
    const id = Number(dep);
    if (Number.isFinite(id)) out.push({ serviceId: id });
    else if (typeof dep === 'string' && dep) out.push({ slug: dep });
  }
  return out;
}

/** Minimal structural shape we read off a prisma `stack_services` row. */
export interface DbStackServiceRow {
  id: string;
  serviceId: number;
  order: number;
  services: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    dockerImage: string;
    version: string | null;
    environmentVariables: string | null;
    volumes: string | null;
  };
  stack_service_configurations?: {
    environmentVariables: string | null;
    portMappings: string | null;
    volumeMounts: string | null;
    dependsOn: string | null;
    networkMode?: string | null;
  } | null;
}

/** Build `PersistedStack.services` from prisma rows (env parsed to the array shape). */
export function dbStackServicesToPersisted(
  rows: DbStackServiceRow[],
): PersistedStack['services'] {
  return rows.map((ss) => {
    const svc = ss.services;
    const cfg = ss.stack_service_configurations;
    return {
      id: ss.id,
      serviceId: ss.serviceId,
      order: ss.order,
      service: {
        id: svc.id,
        name: svc.name,
        slug: svc.slug,
        description: svc.description,
        dockerImage: svc.dockerImage,
        version: svc.version,
        // Catalog env descriptors are a JSON string; the generator reads
        // `service.env` as an array. Volumes it tolerates as a raw string.
        env: parseArray(svc.environmentVariables),
        volumes: svc.volumes,
      },
      configuration: {
        environmentVariables: safeParseJSON<Record<string, string>>(
          cfg?.environmentVariables,
          {},
        ),
        // Tolerant of both stored shapes (record from the UI save schema,
        // array from raw/older rows) — see the normalizers above.
        portMappings: normalizePorts(cfg?.portMappings),
        volumeMounts: normalizeVolumeMounts(cfg?.volumeMounts),
        dependsOn: normalizeDependsOn(cfg?.dependsOn),
        networkMode: cfg?.networkMode ?? undefined,
      },
    };
    // The prisma row types are richer than the compose contract needs; the
    // structural narrowing above is deliberate.
  }) as unknown as PersistedStack['services'];
}
