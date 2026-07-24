import type { StackService } from '@/types/stack'
import { areIncompatible } from '@/lib/recommendations/compatibility-matrix'
import type { SafetyAuditVerdict, AuditPropertyId } from '@/lib/deploy/safety-audit'
import { makeT, type MessageKey, type Translate } from '@/lib/i18n/messages'

/**
 * Live builder checks
 *
 * Runs the real, stack-wide validation against the current builder store as the
 * user composes — the guidance Coolify/Dokploy don't surface until deploy time.
 * It reuses the server-side `StackServiceConfigValidator` (a pure static class,
 * safe to call client-side) for host-port and volume-mount conflict detection,
 * and layers on missing-dependency-target and soft compatibility advisories.
 */

export type BuilderCheckSeverity = 'error' | 'warning'
export type BuilderCheckKind = 'port' | 'volume' | 'dependency' | 'compatibility' | 'vpn' | 'secret' | 'image'

/**
 * Download clients whose traffic must route through a VPN or they leak the
 * user's real IP. This is the signature check of the media-authority thesis:
 * we don't just compose the stack, we prove the kill-switch holds.
 */
const DOWNLOAD_CLIENT_SLUGS = new Set([
  'qbittorrent', 'transmission', 'deluge', 'rtorrent', 'sabnzbd', 'nzbget',
])
/** VPN gateway containers others route through (`network_mode: service:<slug>`). */
const VPN_SLUGS = new Set(['gluetun', 'wireguard'])

/** Which config-panel section a check's fix lives in. */
export type PanelSection = 'environment' | 'ports' | 'volumes' | 'dependencies' | 'image'

/**
 * Where clicking a check/update should take the user to fix it. `service`
 * jumps to a stack service's config panel at a section; `stack-name` opens the
 * stack-name field (Save Stack modal). `stackServiceId` is the store's
 * StackService instance id (what setSelectedService expects).
 */
export type ResolveTarget =
  | { kind: 'service'; stackServiceId: string; section: PanelSection; suggestedTag?: string }
  | { kind: 'stack-name' }

export interface BuilderCheck {
  id: string
  kind: BuilderCheckKind
  severity: BuilderCheckSeverity
  title: string
  message: string
  /** Where to jump to fix this. Absent = no navigation target. */
  target?: ResolveTarget
}

/** Guarded read of a service's array-shaped port mappings (configs can be thin). */
function portsOf(s: StackService) {
  return Array.isArray(s.configuration?.portMappings) ? s.configuration.portMappings : []
}
/** Guarded read of a service's array-shaped volume mounts. */
function volumesOf(s: StackService) {
  return Array.isArray(s.configuration?.volumeMounts) ? s.configuration.volumeMounts : []
}
/** Group services by a key, deduping the same service instance within a group. */
function groupServices<K>(
  services: StackService[],
  keysOf: (s: StackService) => K[],
): Map<K, StackService[]> {
  const map = new Map<K, StackService[]>()
  for (const s of services) {
    for (const key of keysOf(s)) {
      const arr = map.get(key) ?? []
      if (!arr.some(x => x.id === s.id)) arr.push(s)
      map.set(key, arr)
    }
  }
  return map
}

/**
 * Known stack-level config errors produced by the builder store's
 * validateStack (EN by design — persisted/filtered on the raw string).
 * UI code translates them for DISPLAY only via translateConfigError.
 */
const CONFIG_ERROR_KEYS: Record<string, MessageKey> = {
  'Stack name is required': 'builder.configErrorNameRequired',
  'At least one service is required': 'builder.configErrorServiceRequired',
  'Port conflicts detected': 'builder.configErrorPortConflicts',
}

/** Translate a store config-error message for display; unknown strings pass through raw. */
export function translateConfigError(message: string, t: Translate): string {
  const key = CONFIG_ERROR_KEYS[message]
  return key ? t(key) : message
}

/**
 * Analyze the whole stack and return the problems worth surfacing in the
 * builder. Pure and synchronous so it can run on every store change.
 * Defaults to English so existing callers/tests keep their output; UI passes
 * the active locale's `t`. Validator-produced messages (err.message) pass
 * through untranslated by design.
 */
export function analyzeStack(services: StackService[], t: Translate = makeT('en')): BuilderCheck[] {
  const checks: BuilderCheck[] = []

  if (services.length === 0) return checks

  // 1: host-port conflicts (same host port on 2+ services) — error, jump to Ports.
  // Messages stay English by design (the untranslated validator island).
  for (const [hostPort, group] of groupServices(
    services,
    s => portsOf(s).map(p => p.hostPort).filter((n): n is number => typeof n === 'number'),
  )) {
    if (group.length > 1) {
      checks.push({
        id: `port-${hostPort}`,
        kind: 'port',
        severity: 'error',
        title: t('builder.checkPortConflict'),
        message: `Host port ${hostPort} is used by multiple services: ${group.map(s => s.service.name).join(', ')}`,
        target: { kind: 'service', stackServiceId: group[0].id, section: 'ports' },
      })
    }
  }

  // 2: shared host path across services — warning, jump to Volumes.
  for (const [hostPath, group] of groupServices(
    services,
    s => volumesOf(s).map(v => v.hostPath).filter((p): p is string => typeof p === 'string' && p !== ''),
  )) {
    if (group.length > 1) {
      checks.push({
        id: `volume-${hostPath}`,
        kind: 'volume',
        severity: 'warning',
        title: t('builder.checkSharedVolume'),
        message: `Host path ${hostPath} is shared by multiple services: ${group.map(s => s.service.name).join(', ')}`,
        target: { kind: 'service', stackServiceId: group[0].id, section: 'volumes' },
      })
    }
  }

  // 3: dependency targets that aren't in the stack — jump to that service's Dependencies.
  const serviceIds = new Set(services.map(s => s.serviceId))
  for (const s of services) {
    // Imported/legacy drafts can carry a thin config without dependsOn.
    for (const dep of s.configuration?.dependsOn ?? []) {
      if (!serviceIds.has(dep.serviceId)) {
        checks.push({
          id: `dependency-${s.serviceId}-${dep.serviceId}`,
          kind: 'dependency',
          severity: 'warning',
          title: t('builder.checkMissingDependency'),
          message: t('builder.checkMissingDependencyMessage', { service: s.service.name }),
          target: { kind: 'service', stackServiceId: s.id, section: 'dependencies' },
        })
      }
    }
  }

  // 4: soft compatibility advisories (e.g. two reverse proxies both wanting :80).
  for (let i = 0; i < services.length; i++) {
    for (let j = i + 1; j < services.length; j++) {
      const a = services[i].service
      const b = services[j].service
      if (areIncompatible(a.slug, b.slug)) {
        checks.push({
          id: `compatibility-${a.slug}-${b.slug}`,
          kind: 'compatibility',
          severity: 'warning',
          title: t('builder.checkMayConflict'),
          message: t('builder.checkMayConflictMessage', { a: a.name, b: b.name }),
          target: { kind: 'service', stackServiceId: services[i].id, section: 'ports' },
        })
      }
    }
  }

  // 5: VPN kill-switch — the signature check. A download client that isn't
  // routed through a VPN leaks the user's real IP. We PROVE the kill-switch
  // holds: with a VPN present, the client must have `networkMode:
  // service:<vpn>`; without one, warn that traffic uses the real IP.
  const vpnServices = services.filter((s) => VPN_SLUGS.has(s.service.slug))
  const hasVpn = vpnServices.length > 0
  for (const s of services) {
    if (!DOWNLOAD_CLIENT_SLUGS.has(s.service.slug)) continue
    const nm = s.configuration?.networkMode
    const routedThroughVpn =
      typeof nm === 'string' && vpnServices.some((v) => nm === `service:${v.service.slug}`)
    if (hasVpn && !routedThroughVpn) {
      const vpn = vpnServices[0].service.slug
      checks.push({
        id: `vpn-leak-${s.serviceId}`,
        kind: 'vpn',
        severity: 'error',
        title: 'VPN leak',
        message: `${s.service.name} is not routed through your VPN — its traffic would leak your real IP. Set its network mode to "service:${vpn}" so it can only reach the internet through the tunnel.`,
      })
    } else if (!hasVpn) {
      checks.push({
        id: `vpn-missing-${s.serviceId}`,
        kind: 'vpn',
        severity: 'warning',
        title: 'No VPN',
        message: `${s.service.name} will download over your real IP. Add a VPN (e.g. Gluetun) and route ${s.service.name} through it with a kill-switch so nothing leaks if the tunnel drops.`,
      })
    }
  }

  return checks
}

/** Which builder-check kind renders each safety-audit property. */
const AUDIT_KIND: Record<AuditPropertyId, BuilderCheckKind> = {
  'exposed-datastore-port': 'port',
  'stateful-no-volume': 'volume',
  'weak-secret': 'secret',
  'unpinned-image': 'image',
}

/**
 * Map the deploy safety audit into builder checks. Only `fail` findings surface
 * here (as errors) — the real, fixable problems (a datastore exposed to the
 * internet, a datastore that loses its data, a default/empty secret). Advisory
 * `warn`s (a short secret, an unpinned `:latest`) stay in the signed report and
 * off the builder, so the live warnings remain high-signal. Because it runs the
 * SAME `auditCompose` the €29 report uses, the builder shows exactly what the
 * report will attest — no drift between the two.
 */
export function auditToBuilderChecks(audit: SafetyAuditVerdict): BuilderCheck[] {
  const checks: BuilderCheck[] = []
  for (const p of audit.properties) {
    for (const f of p.findings) {
      if (f.verdict !== 'fail') continue
      checks.push({
        id: `audit-${p.id}-${f.service}`,
        kind: AUDIT_KIND[p.id],
        severity: 'error',
        title: p.title,
        message: `${f.service} — ${f.detail}`,
      })
    }
  }
  return checks
}
