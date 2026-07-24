/**
 * Deploy Safety Audit — the verified-correctness engine, generalised beyond the
 * VPN kill-switch.
 *
 * The kill-switch check (`kill-switch-attestation.ts`) proves the ONE thing the
 * media/*arr stack gets wrong. This module proves the handful of things EVERY
 * self-hoster gets wrong, statically, from the same compose document — so the
 * builder can warn, and the €29 report can attest, "verified-safe deploy" for
 * any stack, not just media. Each property is a pure `compose → verdict`
 * function (same shape as `verifyComposeKillSwitch`), unit-tested without Docker.
 *
 * Properties audited (all BY CONSTRUCTION, from the compose):
 *   - exposed-datastore-port : a database published to a non-loopback host port
 *     (":5432 left open on the host network" — the most common self-hosting breach).
 *   - stateful-no-volume     : a persistent datastore with no volume → data is
 *     lost on `docker compose down`/recreate.
 *   - weak-secret            : a secret env var left empty or at a known default
 *     (change_me, postgres, admin, …). Generated secrets are strong; this catches
 *     user overrides and imported/hand-edited compose.
 *   - unpinned-image         : an image on `:latest` or with no tag (irreproducible).
 *
 * Honest scope (a static check cannot): it does NOT reach into a running
 * container, verify the host firewall, or judge whether an exposed port is
 * intentionally LAN-only — say "exposed on the host network", not "reachable from
 * the internet". The exposed-datastore check keys off well-known datastore
 * CONTAINER ports (robust to unknown images, blind to a datastore on a
 * non-standard internal port); volume/secret detection is pattern-based (an
 * exotic store image, or secrets passed via `env_file:`/`secrets:`, are reported
 * as "not present", never as verified). The summary claims only what it checked.
 */

import { servicesFromCompose } from '@/lib/deploy/kill-switch-attestation';
import { SECRET_PLACEHOLDER } from '@/lib/stack-persistence';

export type AuditVerdict = 'pass' | 'fail' | 'warn' | 'skip';
export type PropertyStatus = 'pass' | 'fail' | 'warn' | 'not-applicable';
export type AuditStatus = 'pass' | 'warn' | 'fail';

export type AuditPropertyId =
  | 'exposed-datastore-port'
  | 'stateful-no-volume'
  | 'weak-secret'
  | 'unpinned-image';

export interface AuditFinding {
  service: string;
  verdict: AuditVerdict;
  detail: string;
}

export interface AuditProperty {
  id: AuditPropertyId;
  title: string;
  status: PropertyStatus;
  findings: AuditFinding[];
}

export interface SafetyAuditVerdict {
  status: AuditStatus;
  properties: AuditProperty[];
  summary: string;
}

/**
 * Well-known datastore CONTAINER ports. The exposed-datastore check keys off
 * these — not the image name — so an unrecognised datastore image (CockroachDB,
 * TimescaleDB, pgvector, ScyllaDB, KeyDB, …) is still caught when it publishes
 * its port, and an admin UI (mongo-express on 8081) is NOT flagged just because
 * its name contains "mongo". A datastore on a non-standard internal port is the
 * only gap; that's the honest boundary.
 */
const DATASTORE_PORTS = new Set([
  5432, 5433, // postgres / timescale / pgvector / cockroach-sql
  3306, 3307, 33060, // mysql / mariadb / mysqlx
  27017, 27018, 27019, // mongo
  6379, 6380, // redis / keydb / dragonfly
  9200, 9300, // elasticsearch / opensearch
  26257, // cockroachdb
  8123, // clickhouse http
  7687, // neo4j bolt
  11211, // memcached
  9042, // cassandra / scylla
  5984, // couchdb
  8086, // influxdb
  28015, // rethinkdb
]);

/** Datastores that persist by nature — a missing volume means data loss.
 * Caches (redis/memcached) are excluded: running them ephemerally is valid.
 * Admin UIs (mongo-express, …) are excluded below even though their name matches. */
const PERSISTENT_STORE_PATTERNS = [
  'postgres', 'mysql', 'mariadb', 'mongo', 'elasticsearch', 'opensearch',
  'clickhouse', 'neo4j', 'cassandra', 'scylla', 'couchdb', 'influxdb',
  'cockroach', 'timescale', 'questdb', 'rethinkdb', 'mssql', 'db2',
];

/** Stateless admin/GUI companions whose name contains a datastore substring but
 * which are NOT datastores — they must not be flagged as data-losing stores. */
const ADMIN_UI_PATTERNS = [
  'mongo-express', 'redis-commander', 'redisinsight', 'adminer', 'pgadmin',
  'phpmyadmin', 'cloudbeaver', 'dbgate', 'mongoku', '-express', '-commander',
];

/** Env keys that name a secret. `[_-]key` catches ENCRYPTION_KEY / AUTH_KEY /
 * API_KEY without matching MONKEY/KEYBOARD; salt/passphrase added. */
const SECRET_KEY_RE = /(pass(word|phrase)?|secret|token|[_-]key\b|api[_-]?key|salt|priv|credential)/i;

/** Values a real password must never be. Compared case-insensitively. */
const KNOWN_WEAK = new Set([
  '', 'change_me', 'changeme', 'changeme123', 'password', 'passw0rd', 'pass',
  'postgres', 'mysql', 'root', 'admin', 'administrator', 'secret', 'example',
  'test', '123456', '12345678', 'qwerty', 'letmein', 'default',
]);

function matchesAny(haystack: string, patterns: string[]): boolean {
  const s = haystack.toLowerCase();
  return patterns.some((p) => s.includes(p));
}

function rawServices(parsedCompose: unknown): Record<string, unknown> {
  return (parsedCompose as { services?: Record<string, unknown> } | null)?.services ?? {};
}

function isLoopback(ip: string | null): boolean {
  return ip === '127.0.0.1' || ip === 'localhost' || ip === '::1';
}

/**
 * Parse a single compose `ports:` entry into whether it publishes to a
 * non-loopback host interface and its CONTAINER-side port. Handles
 * "HOST:CONTAINER", "IP:HOST:CONTAINER", bracketed IPv6 "[::1]:H:C", a bare
 * "CONTAINER", a "…/proto" suffix, ranges, and the long object form
 * `{published, target, host_ip}`.
 */
export function parsePortEntry(entry: unknown): { exposed: boolean; containerPort: number | null } {
  const toPort = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  };
  if (entry && typeof entry === 'object') {
    const o = entry as { published?: unknown; host_ip?: unknown; target?: unknown };
    const published = o.published !== undefined && o.published !== null && o.published !== '';
    const hostIp = typeof o.host_ip === 'string' ? o.host_ip : null;
    return { exposed: published && !isLoopback(hostIp), containerPort: toPort(o.target) };
  }
  const s = String(entry).split('/')[0]; // strip /proto
  // Bracketed IPv6 host: "[::1]:6379:6379".
  const v6 = s.match(/^\[([^\]]+)\]:(.+)$/);
  if (v6) {
    const rest = v6[2].split(':');
    return { exposed: !isLoopback(v6[1]), containerPort: toPort(rest[rest.length - 1]) };
  }
  const parts = s.split(':');
  const containerPort = toPort(parts[parts.length - 1]); // last segment; "8000-8005" → 8000
  // IP:HOST:CONTAINER — exposed unless the IP is loopback.
  if (parts.length >= 3) return { exposed: !isLoopback(parts[0]), containerPort };
  // "HOST:CONTAINER" or a bare "CONTAINER" — both publish on all interfaces.
  return { exposed: true, containerPort };
}

/** True when a `ports:` entry publishes to a non-loopback host interface. */
export function portIsExposed(entry: unknown): boolean {
  return parsePortEntry(entry).exposed;
}

/** The image tag, or null when the reference has no tag. Ignores a `@sha256:` digest. */
export function imageTag(image: string): string | null {
  const noDigest = image.split('@')[0];
  const lastSeg = noDigest.split('/').pop() ?? noDigest;
  const colon = lastSeg.lastIndexOf(':');
  return colon === -1 ? null : lastSeg.slice(colon + 1);
}

function rollUp(properties: AuditProperty[]): AuditStatus {
  if (properties.some((p) => p.status === 'fail')) return 'fail';
  if (properties.some((p) => p.status === 'warn')) return 'warn';
  return 'pass';
}

function propertyStatus(findings: AuditFinding[]): PropertyStatus {
  const applicable = findings.filter((f) => f.verdict !== 'skip');
  if (applicable.length === 0) return 'not-applicable';
  if (applicable.some((f) => f.verdict === 'fail')) return 'fail';
  if (applicable.some((f) => f.verdict === 'warn')) return 'warn';
  return 'pass';
}

function auditExposedDatastorePort(parsed: unknown): AuditProperty {
  const raw = rawServices(parsed);
  const findings: AuditFinding[] = [];
  // Keyed off the CONTAINER port, not the image name: a published port whose
  // container side is a well-known datastore port is an exposed datastore —
  // regardless of image (catches unrecognised stores; skips admin UIs).
  for (const s of servicesFromCompose(parsed)) {
    const ports = (raw[s.service] as { ports?: unknown } | undefined)?.ports;
    const list = Array.isArray(ports) ? ports : [];
    const exposedDbPorts = list
      .map(parsePortEntry)
      .filter((p) => p.exposed && p.containerPort !== null && DATASTORE_PORTS.has(p.containerPort))
      .map((p) => p.containerPort);
    if (exposedDbPorts.length > 0) {
      findings.push({
        service: s.service,
        verdict: 'fail',
        detail: `publishes datastore port ${exposedDbPorts.join(', ')} to a non-loopback host interface — reachable on the host's network interfaces; bind it to 127.0.0.1 or drop the published port so only other containers can reach it`,
      });
    }
  }
  // This property is answerable for ANY stack ("is any published port a datastore
  // port?"), so it is pass/fail — never not-applicable. `pass` means "checked the
  // published ports; none expose a datastore", an honest positive claim.
  const status: PropertyStatus = findings.length > 0 ? 'fail' : 'pass';
  return { id: 'exposed-datastore-port', title: 'No datastore exposed on the host network', status, findings };
}

function auditStatefulNoVolume(parsed: unknown): AuditProperty {
  const raw = rawServices(parsed);
  const findings: AuditFinding[] = [];
  for (const s of servicesFromCompose(parsed)) {
    const id = `${s.service} ${s.image}`;
    if (!matchesAny(id, PERSISTENT_STORE_PATTERNS)) continue;
    if (matchesAny(id, ADMIN_UI_PATTERNS)) continue; // stateless GUI, not a store
    const vols = (raw[s.service] as { volumes?: unknown } | undefined)?.volumes;
    const hasVolume = Array.isArray(vols) && vols.length > 0;
    if (hasVolume) {
      findings.push({ service: s.service, verdict: 'pass', detail: 'has a persistent volume' });
    } else {
      findings.push({
        service: s.service,
        verdict: 'fail',
        detail: 'a persistent datastore with no volume — its data is written inside the container and is lost on recreate/`docker compose down`; mount a named volume for its data directory',
      });
    }
  }
  return { id: 'stateful-no-volume', title: 'Datastores keep their data (persistent volumes)', status: propertyStatus(findings), findings };
}

function auditWeakSecret(parsed: unknown): AuditProperty {
  const raw = rawServices(parsed);
  const findings: AuditFinding[] = [];
  for (const s of servicesFromCompose(parsed)) {
    const env = (raw[s.service] as { environment?: unknown } | undefined)?.environment;
    const entries: Array<[string, string]> = [];
    if (Array.isArray(env)) {
      for (const e of env) {
        if (typeof e === 'string' && e.includes('=')) {
          const i = e.indexOf('=');
          entries.push([e.slice(0, i), e.slice(i + 1)]);
        }
      }
    } else if (env && typeof env === 'object') {
      for (const [k, v] of Object.entries(env as Record<string, unknown>)) {
        entries.push([k, v == null ? '' : String(v)]);
      }
    }
    for (const [key, value] of entries) {
      if (!SECRET_KEY_RE.test(key)) continue;
      if (value === SECRET_PLACEHOLDER) continue; // masked view — can't judge
      if (KNOWN_WEAK.has(value.toLowerCase())) {
        findings.push({
          service: s.service,
          verdict: 'fail',
          detail: `${key} is empty or a well-known default — set a strong, unique value`,
        });
      } else if (value.length < 12) {
        findings.push({
          service: s.service,
          verdict: 'warn',
          detail: `${key} is short (< 12 chars) — consider a stronger value`,
        });
      } else {
        findings.push({ service: s.service, verdict: 'pass', detail: `${key} is set to a non-default value` });
      }
    }
  }
  return { id: 'weak-secret', title: 'No default or empty secrets', status: propertyStatus(findings), findings };
}

function auditUnpinnedImage(parsed: unknown): AuditProperty {
  const findings: AuditFinding[] = [];
  for (const s of servicesFromCompose(parsed)) {
    if (!s.image) continue;
    const tag = imageTag(s.image);
    if (tag === null || tag.toLowerCase() === 'latest') {
      findings.push({
        service: s.service,
        verdict: 'warn',
        detail: `image "${s.image}" is unpinned (${tag === null ? 'no tag' : ':latest'}) — pin a version tag so the deploy is reproducible`,
      });
    } else {
      findings.push({ service: s.service, verdict: 'pass', detail: `image pinned to :${tag}` });
    }
  }
  return { id: 'unpinned-image', title: 'Images are pinned to a version', status: propertyStatus(findings), findings };
}

/**
 * Run the full deploy safety audit over a parsed compose document. Pure and
 * deterministic — no Docker, no clock, no network. Returns a per-property verdict
 * plus an overall roll-up (`fail` if any property fails, else `warn`, else `pass`).
 */
export function auditCompose(parsedCompose: unknown): SafetyAuditVerdict {
  const properties: AuditProperty[] = [
    auditExposedDatastorePort(parsedCompose),
    auditStatefulNoVolume(parsedCompose),
    auditWeakSecret(parsedCompose),
    auditUnpinnedImage(parsedCompose),
  ];
  const status = rollUp(properties);
  const titles = (s: PropertyStatus) => properties.filter((p) => p.status === s).map((p) => p.title);
  const failed = titles('fail');
  const warned = titles('warn');
  const verified = titles('pass'); // only what was actually checked and clean
  const notPresent = titles('not-applicable'); // no such component in this stack
  // Honest: never assert a property that was not-applicable (e.g. "datastores
  // persist" when the stack has no datastore, or "no default secrets" when no
  // secrets were declared inline). Claim only what was verified.
  const verifiedClause = verified.length ? ` Verified: ${verified.join('; ')}.` : '';
  const naClause = notPresent.length ? ` Not present (not checked): ${notPresent.join('; ')}.` : '';
  const summary =
    status === 'fail'
      ? `Not deploy-safe: ${failed.join('; ')}.${verifiedClause}`
      : status === 'warn'
        ? `Deploy-safe with advisories: ${warned.join('; ')}.${verifiedClause}`
        : verified.length
          ? `Deploy-safe by construction.${verifiedClause}${naClause}`
          : 'No applicable safety checks for this stack.';
  return { status, properties, summary };
}
