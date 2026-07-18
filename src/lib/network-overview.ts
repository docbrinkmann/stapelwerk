/**
 * Network overview across all of a user's stacks.
 *
 * The compose generator puts every stack on one bridge network (`appnet`) where
 * services reach each other by container name (= slug), and publishes host ports
 * from each service's port mappings. This module turns the stored per-service
 * config into that view — the published host ports per service, the internal
 * hostname, and (the useful bit for a single-host setup) host-port collisions
 * ACROSS stacks, which can't run at the same time.
 */

/** The single bridge network every generated stack uses (see stack-persistence). */
export const STACK_NETWORK = 'appnet';

export interface PublishedPort {
  hostPort: number;
  containerPort: number;
  protocol: string;
}

/** A port the service listens on inside the stack (reachable as `<slug>:<port>`). */
export interface InternalPort {
  containerPort: number;
  protocol: string;
  description?: string;
  /** True when this container port is also published to a host port. */
  published: boolean;
}

/** A volume the service mounts (named docker volume or bind path). */
export interface VolumeInfo {
  containerPath: string;
  /** True = named docker volume (persistent); false = bind/host path. */
  named: boolean;
  description?: string;
}

export interface ServiceNetwork {
  serviceId: number;
  name: string;
  slug: string;
  /** Address other services in the stack use: `<slug>` on the appnet network. */
  internalHost: string;
  publishedPorts: PublishedPort[];
  /** Ports the service listens on inside the stack (from the catalog metadata). */
  internalPorts: InternalPort[];
  /** Names of other services in the same stack this one depends on (startup order). */
  dependsOn: string[];
  /** Volumes the service mounts (from the catalog metadata). */
  volumes: VolumeInfo[];
}

export interface StackNetwork {
  stackId: string;
  stackName: string;
  network: string;
  services: ServiceNetwork[];
  /** Total number of host ports this stack publishes. */
  publishedCount: number;
}

export interface PortConflict {
  hostPort: number;
  users: Array<{ stackId: string; stackName: string; serviceName: string }>;
}

export interface NetworkOverview {
  stacks: StackNetwork[];
  /** Host ports bound by more than one service (within or across stacks). */
  conflicts: PortConflict[];
  totalPublished: number;
}

/** A service as it arrives from the DB (config still JSON-ish/loose). */
export interface RawServiceInput {
  serviceId: number;
  name: string;
  slug: string;
  /** portMappings as stored: a JSON string, an array, or an object. */
  portMappings: unknown;
  /** Catalog `ports` metadata: the container ports the service listens on. */
  ports?: unknown;
  /** Config `dependsOn` as stored: a JSON array of serviceIds. */
  dependsOn?: unknown;
  /** Catalog `volumes` metadata: `[{ containerPath, named, description }]`. */
  volumes?: unknown;
}

export interface RawStackInput {
  stackId: string;
  stackName: string;
  services: RawServiceInput[];
}

/**
 * Normalize port mappings from any stored shape into `{hostPort, containerPort,
 * protocol}[]`. Tolerates:
 *  - a JSON string of either shape below,
 *  - the generator's array shape `[{ containerPort, hostPort, protocol }]`,
 *  - the validator/legacy object shape `{ "<containerPort>": "<hostPort>" }`.
 * Entries without a finite host port are dropped.
 */
export function normalizePorts(raw: unknown): PublishedPort[] {
  let val: unknown = raw;
  if (typeof val === 'string') {
    if (!val.trim()) return [];
    try {
      val = JSON.parse(val);
    } catch {
      return [];
    }
  }

  const out: PublishedPort[] = [];

  if (Array.isArray(val)) {
    for (const entry of val) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const hostPort = Number(e.hostPort);
      if (!Number.isFinite(hostPort)) continue;
      const containerPort = Number(e.containerPort);
      out.push({
        hostPort,
        containerPort: Number.isFinite(containerPort) ? containerPort : hostPort,
        protocol: typeof e.protocol === 'string' && e.protocol ? e.protocol : 'tcp',
      });
    }
  } else if (val && typeof val === 'object') {
    // Object shape: { containerPort: hostPort }
    for (const [container, host] of Object.entries(val as Record<string, unknown>)) {
      const hostPort = Number(host);
      if (!Number.isFinite(hostPort)) continue;
      const containerPort = Number(container);
      out.push({
        hostPort,
        containerPort: Number.isFinite(containerPort) ? containerPort : hostPort,
        protocol: 'tcp',
      });
    }
  }

  return out;
}

/**
 * Parse the catalog `ports` metadata (`[{ containerPort, protocol, description }]`,
 * possibly a JSON string) into the container ports a service listens on. These
 * are reachable inside the stack as `<slug>:<containerPort>` even when not
 * published to a host port.
 */
export function normalizeContainerPorts(
  raw: unknown,
): Array<{ containerPort: number; protocol: string; description?: string }> {
  let val: unknown = raw;
  if (typeof val === 'string') {
    if (!val.trim()) return [];
    try {
      val = JSON.parse(val);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(val)) return [];
  const out: Array<{ containerPort: number; protocol: string; description?: string }> = [];
  for (const entry of val) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const containerPort = Number(e.containerPort);
    if (!Number.isFinite(containerPort)) continue;
    out.push({
      containerPort,
      protocol: typeof e.protocol === 'string' && e.protocol ? e.protocol : 'tcp',
      description: typeof e.description === 'string' && e.description ? e.description : undefined,
    });
  }
  return out;
}

/** Parse the config `dependsOn` (JSON array of serviceIds) into numbers. */
export function normalizeDependsOn(raw: unknown): number[] {
  let val: unknown = raw;
  if (typeof val === 'string') {
    if (!val.trim()) return [];
    try {
      val = JSON.parse(val);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(val)) return [];
  const out: number[] = [];
  for (const entry of val) {
    const id = Number(entry);
    if (Number.isFinite(id)) out.push(id);
  }
  return out;
}

/** Parse the catalog `volumes` metadata into `{ containerPath, named, description }[]`. */
export function normalizeVolumes(raw: unknown): VolumeInfo[] {
  let val: unknown = raw;
  if (typeof val === 'string') {
    if (!val.trim()) return [];
    try {
      val = JSON.parse(val);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(val)) return [];
  const out: VolumeInfo[] = [];
  for (const entry of val) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.containerPath !== 'string' || !e.containerPath) continue;
    out.push({
      containerPath: e.containerPath,
      named: e.named !== false, // default to named (persistent) unless explicitly false
      description: typeof e.description === 'string' && e.description ? e.description : undefined,
    });
  }
  return out;
}

/**
 * Build the cross-stack network overview: per-stack published ports + internal
 * hostnames, plus every host port bound by more than one service.
 */
export function buildNetworkOverview(stacks: RawStackInput[]): NetworkOverview {
  const hostPortUsers = new Map<number, PortConflict['users']>();
  let totalPublished = 0;

  const stackViews: StackNetwork[] = stacks.map((stack) => {
    // Resolve dependsOn serviceIds → display names within this stack.
    const idToName = new Map<number, string>();
    for (const s of stack.services) idToName.set(s.serviceId, s.name);

    const services: ServiceNetwork[] = stack.services.map((svc) => {
      const publishedPorts = normalizePorts(svc.portMappings);
      const publishedContainerPorts = new Set(publishedPorts.map((p) => p.containerPort));
      for (const p of publishedPorts) {
        totalPublished += 1;
        if (!hostPortUsers.has(p.hostPort)) hostPortUsers.set(p.hostPort, []);
        hostPortUsers.get(p.hostPort)!.push({
          stackId: stack.stackId,
          stackName: stack.stackName,
          serviceName: svc.name,
        });
      }

      // Internal listening ports from the catalog, plus any published container
      // port that the catalog didn't list — deduped, so the internal endpoints
      // (`<slug>:<port>`) are complete even for "internal only" services.
      const internalMap = new Map<number, InternalPort>();
      for (const cp of normalizeContainerPorts(svc.ports)) {
        internalMap.set(cp.containerPort, {
          ...cp,
          published: publishedContainerPorts.has(cp.containerPort),
        });
      }
      for (const p of publishedPorts) {
        if (!internalMap.has(p.containerPort)) {
          internalMap.set(p.containerPort, {
            containerPort: p.containerPort,
            protocol: p.protocol,
            published: true,
          });
        }
      }
      const internalPorts = [...internalMap.values()].sort(
        (a, b) => a.containerPort - b.containerPort,
      );

      const dependsOn = normalizeDependsOn(svc.dependsOn)
        .map((id) => idToName.get(id))
        .filter((n): n is string => !!n && n !== svc.name);
      const volumes = normalizeVolumes(svc.volumes);

      return {
        serviceId: svc.serviceId,
        name: svc.name,
        slug: svc.slug,
        internalHost: svc.slug,
        publishedPorts,
        internalPorts,
        dependsOn,
        volumes,
      };
    });

    return {
      stackId: stack.stackId,
      stackName: stack.stackName,
      network: STACK_NETWORK,
      services,
      publishedCount: services.reduce((n, s) => n + s.publishedPorts.length, 0),
    };
  });

  const conflicts: PortConflict[] = [];
  for (const [hostPort, users] of hostPortUsers) {
    if (users.length > 1) conflicts.push({ hostPort, users });
  }
  conflicts.sort((a, b) => a.hostPort - b.hostPort);

  return { stacks: stackViews, conflicts, totalPublished };
}
