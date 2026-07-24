/**
 * Runtime kill-switch attestation — the "verified deploy" step.
 *
 * The static builder check proves the *configuration* is leak-proof. This proves
 * it at RUNTIME: after a stack boots, we probe each download client from inside
 * its container and attest that its traffic cannot escape except through the VPN.
 * That is the one thing a compose generator or an LLM answer never does.
 *
 * The invariant we attest:
 *   - a download client routed through a VPN either reaches the internet with a
 *     DIFFERENT exit IP than the host (the tunnel), or reaches nothing at all
 *     (the VPN's firewall drops egress while the tunnel is down) — both = safe;
 *   - a download client that reaches the internet with the HOST's IP, or one
 *     that isn't routed through a VPN at all, is a LEAK.
 *
 * Pure decision logic (`evaluateKillSwitch`) is separated from the docker IO
 * (`attestKillSwitch`) so the rules are unit-tested without a running daemon.
 */

/**
 * Image/name substrings that identify a torrent/usenet download client. This is
 * a KNOWN-clients list, not an exhaustive one — a client not on it is not
 * recognised, so the report states which clients it checked (see
 * `verifyComposeKillSwitch`) rather than implying "no download client = safe".
 */
export const DOWNLOAD_CLIENT_PATTERNS = [
  'qbittorrent', 'transmission', 'deluge', 'rtorrent', 'sabnzbd', 'nzbget',
  'slskd', 'aria2', 'jdownloader', 'pyload', 'porla', 'hadouken', 'nzbhydra',
]

export function isDownloadClientImage(imageOrName: string): boolean {
  const s = imageOrName.toLowerCase()
  return DOWNLOAD_CLIENT_PATTERNS.some((p) => s.includes(p))
}

export interface KillSwitchProbe {
  /** Compose service name, e.g. "qbittorrent". */
  service: string
  /** Is this a download client (the thing that must not leak)? */
  isDownloadClient: boolean
  /** Does its compose config route it through a VPN (network_mode: service:x)? */
  routedThroughVpn: boolean
  /** Did the in-container probe reach the internet? */
  reachedInternet: boolean
  /** The exit IP the container observed, if it reached the internet. */
  observedIp: string | null
}

export type KillSwitchStatus = 'verified' | 'leak' | 'inconclusive'
export type FindingVerdict = 'ok' | 'leak' | 'skip' | 'warn'

export interface KillSwitchFinding {
  service: string
  verdict: FindingVerdict
  detail: string
}

export interface KillSwitchAttestation {
  status: KillSwitchStatus
  /** The host's public IP (the exit a leaking container would reveal). */
  hostIp: string | null
  findings: KillSwitchFinding[]
  summary: string
}

/**
 * Decide the attestation from the probe results. Pure — no IO, no clock.
 */
export function evaluateKillSwitch(
  probes: KillSwitchProbe[],
  hostIp: string | null,
): KillSwitchAttestation {
  const findings: KillSwitchFinding[] = []

  for (const p of probes) {
    if (!p.isDownloadClient) {
      findings.push({ service: p.service, verdict: 'skip', detail: 'not a download client' })
      continue
    }

    if (!p.routedThroughVpn) {
      // Not behind a VPN at all. If it can reach the internet, it leaks the real IP.
      if (p.reachedInternet) {
        findings.push({
          service: p.service,
          verdict: 'leak',
          detail: `not routed through a VPN and reached the internet (exit ${p.observedIp ?? 'unknown'}) — traffic uses your real IP`,
        })
      } else {
        findings.push({ service: p.service, verdict: 'skip', detail: 'no VPN and no internet reached' })
      }
      continue
    }

    // Routed through a VPN.
    if (!p.reachedInternet) {
      findings.push({
        service: p.service,
        verdict: 'ok',
        detail: 'kill-switch holds: egress is blocked while the tunnel is not established',
      })
    } else if (hostIp && p.observedIp && p.observedIp === hostIp) {
      findings.push({
        service: p.service,
        verdict: 'leak',
        detail: `routed through the VPN but the exit IP equals the host (${hostIp}) — the kill-switch failed`,
      })
    } else if (p.observedIp) {
      findings.push({
        service: p.service,
        verdict: 'ok',
        detail: `routed through the tunnel: exit IP ${p.observedIp} differs from the host`,
      })
    } else {
      findings.push({ service: p.service, verdict: 'skip', detail: 'reached the internet but the exit IP could not be read' })
    }
  }

  const hasLeak = findings.some((f) => f.verdict === 'leak')
  const hasOk = findings.some((f) => f.verdict === 'ok')
  const status: KillSwitchStatus = hasLeak ? 'leak' : hasOk ? 'verified' : 'inconclusive'

  const summary =
    status === 'leak'
      ? `LEAK: ${findings.filter((f) => f.verdict === 'leak').map((f) => f.service).join(', ')} can leak your real IP.`
      : status === 'verified'
        ? 'Verified: every download client is confined to the VPN — no traffic escapes if the tunnel drops.'
        : 'Inconclusive: no download client could be probed.'

  return { status, hostIp, findings, summary }
}

/** Runs a docker CLI invocation; returns stdout + exit code. */
export type DockerExec = (args: string[]) => Promise<{ stdout: string; exitCode: number }>

export interface AttestKillSwitchOptions {
  /** The compose project (bms-<stackId>). */
  project: string
  /** Services in the deployed stack: name, image, and whether routed through a VPN. */
  services: Array<{ service: string; image: string; routedThroughVpn: boolean }>
  /** Docker CLI runner (spawns `docker …`). */
  exec: DockerExec
  /** Resolve the host's public IP (defaults to fetching probeUrl from this process). */
  fetchHostIp?: () => Promise<string | null>
  /** IP-echo endpoint probed from inside each container. */
  probeUrl?: string
}

const DEFAULT_PROBE_URL = 'https://api.ipify.org'
const BLOCKED = '__BLOCKED__'

/** Parse `wget`/`echo BLOCKED` output into a probe result. */
export function parseProbeOutput(stdout: string): { reachedInternet: boolean; observedIp: string | null } {
  const out = stdout.trim()
  if (!out || out === BLOCKED) return { reachedInternet: false, observedIp: null }
  const ip = out.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/)
  return ip ? { reachedInternet: true, observedIp: ip[0] } : { reachedInternet: false, observedIp: null }
}

/**
 * Attest the kill-switch of a RUNNING compose project: probe each download
 * client from inside its container and evaluate the leak invariant.
 */
export async function attestKillSwitch(opts: AttestKillSwitchOptions): Promise<KillSwitchAttestation> {
  const probeUrl = opts.probeUrl ?? DEFAULT_PROBE_URL
  const hostIp = opts.fetchHostIp ? await opts.fetchHostIp() : await defaultFetchHostIp(probeUrl)

  const probes: KillSwitchProbe[] = []
  for (const svc of opts.services) {
    const isDl = isDownloadClientImage(`${svc.service} ${svc.image}`)
    if (!isDl) {
      probes.push({ service: svc.service, isDownloadClient: false, routedThroughVpn: svc.routedThroughVpn, reachedInternet: false, observedIp: null })
      continue
    }
    // `<project>-<service>-1` is compose's default container name.
    const container = `${opts.project}-${svc.service}-1`
    const { stdout, exitCode } = await opts.exec([
      'exec', container, 'sh', '-c',
      // BusyBox wget is present in most LSIO/alpine images; 5s timeout; never fail the exec.
      `wget -qO- -T 5 ${probeUrl} 2>/dev/null || echo ${BLOCKED}`,
    ])
    // A running container's `sh -c '… || echo BLOCKED'` always exits 0 (a real
    // block still echoes BLOCKED). A non-zero exit means we couldn't probe at all
    // (no socket, container gone) — never mistake that for a held kill-switch.
    if (exitCode !== 0) {
      throw new Error(`could not probe ${svc.service} (docker exec exit ${exitCode}) — attestation requires the deploy host's Docker socket`)
    }
    const { reachedInternet, observedIp } = parseProbeOutput(stdout)
    probes.push({ service: svc.service, isDownloadClient: true, routedThroughVpn: svc.routedThroughVpn, reachedInternet, observedIp })
  }

  return evaluateKillSwitch(probes, hostIp)
}

/**
 * Extract the attestation's service list from a compose document: each service's
 * name, image, and whether it's routed through a VPN (`network_mode: service:x`).
 */
export function servicesFromCompose(
  parsedCompose: unknown,
): Array<{ service: string; image: string; routedThroughVpn: boolean }> {
  const out: Array<{ service: string; image: string; routedThroughVpn: boolean }> = []
  const services = (parsedCompose as { services?: unknown })?.services
  if (!services || typeof services !== 'object') return out
  for (const [name, def] of Object.entries(services as Record<string, unknown>)) {
    const d = (def ?? {}) as { image?: unknown; network_mode?: unknown }
    const nm = typeof d.network_mode === 'string' ? d.network_mode : ''
    out.push({
      service: name,
      image: typeof d.image === 'string' ? d.image : '',
      routedThroughVpn: nm.startsWith('service:'),
    })
  }
  return out
}

/** True when a compose project contains a download client worth attesting. */
export function composeHasDownloadClient(parsedCompose: unknown): boolean {
  return servicesFromCompose(parsedCompose).some((s) => isDownloadClientImage(`${s.service} ${s.image}`))
}

/** Image/name substrings that identify a VPN gateway container. */
export const VPN_IMAGE_PATTERNS = ['gluetun', 'wireguard', 'openvpn']

export function isVpnImage(imageOrName: string): boolean {
  const s = imageOrName.toLowerCase()
  return VPN_IMAGE_PATTERNS.some((p) => s.includes(p))
}

/** gluetun specifically ships a built-in kill-switch firewall (on by default). */
export function isGluetunImage(imageOrName: string): boolean {
  return imageOrName.toLowerCase().includes('gluetun')
}

/** Read an env var from a compose service's `environment` (map or list form). */
function composeEnv(serviceDef: unknown, key: string): string | undefined {
  const env = (serviceDef as { environment?: unknown } | undefined)?.environment
  if (Array.isArray(env)) {
    for (const e of env) {
      if (typeof e === 'string' && e.startsWith(`${key}=`)) return e.slice(key.length + 1)
    }
    return undefined
  }
  if (env && typeof env === 'object') {
    const v = (env as Record<string, unknown>)[key]
    return v == null ? undefined : String(v)
  }
  return undefined
}

export type StructuralStatus = 'leak-proof' | 'routed-no-killswitch' | 'leak' | 'no-download-client'

export interface StructuralVerdict {
  status: StructuralStatus
  findings: KillSwitchFinding[]
  summary: string
}

/**
 * Verify a compose's VPN routing BY CONSTRUCTION — deterministic, no Docker, no
 * running stack. For each RECOGNISED download client (DOWNLOAD_CLIENT_PATTERNS),
 * check both that it is confined to a VPN gateway's network namespace
 * (`network_mode: service:<vpn>`) AND that the gateway actually provides a
 * kill-switch:
 *   - gluetun ships a built-in firewall (on by default) that drops egress when the
 *     tunnel is down → 'ok' (unless FIREWALL is explicitly off);
 *   - a bare wireguard/openvpn gateway has NO built-in kill-switch, so routing is
 *     safe only WHILE the tunnel is up → 'warn' (routed, drop-protection
 *     unverified) — callers/copy must not claim "leak-proof" for these;
 *   - not routed, or routed into a non-VPN service → 'leak'.
 * The pre-deploy gate blocks 'leak'; the signed report reads this whole verdict.
 * Scope (honest boundary): it checks the KNOWN clients + the routing/firewall
 * config only. It does NOT — and cannot, statically — rule out IPv6 or DNS leaks,
 * a disabled provider config, or a mid-run edit. The report states this scope.
 */
export function verifyComposeKillSwitch(parsedCompose: unknown): StructuralVerdict {
  const services = servicesFromCompose(parsedCompose)
  const imageByName = new Map(services.map((s) => [s.service, s.image]))
  const rawServices =
    (parsedCompose as { services?: Record<string, unknown> } | null)?.services ?? {}

  const findings: KillSwitchFinding[] = []
  for (const s of services) {
    if (!isDownloadClientImage(`${s.service} ${s.image}`)) continue
    const nmRaw = (rawServices[s.service] as { network_mode?: unknown } | undefined)?.network_mode
    const nm = typeof nmRaw === 'string' ? nmRaw : ''
    const target = nm.startsWith('service:') ? nm.slice('service:'.length) : ''
    const targetImage = target ? imageByName.get(target) ?? '' : ''

    if (target && isGluetunImage(`${target} ${targetImage}`)) {
      const firewall = composeEnv(rawServices[target], 'FIREWALL')
      if (firewall && firewall.toLowerCase() === 'off') {
        findings.push({
          service: s.service,
          verdict: 'warn',
          detail: `routed into gluetun "${target}" but its kill-switch is disabled (FIREWALL=off) — traffic can leak if the tunnel drops`,
        })
      } else {
        findings.push({
          service: s.service,
          verdict: 'ok',
          detail: `confined to gluetun "${target}" (network_mode); gluetun's built-in kill-switch drops egress if the tunnel fails`,
        })
      }
    } else if (target && isVpnImage(`${target} ${targetImage}`)) {
      findings.push({
        service: s.service,
        verdict: 'warn',
        detail: `routed into VPN gateway "${target}", but a bare wireguard/openvpn gateway has no built-in kill-switch — safe only while the tunnel is up; use gluetun (firewall on) for drop protection`,
      })
    } else if (target) {
      findings.push({
        service: s.service,
        verdict: 'leak',
        detail: `routed into "${target}", which is not a VPN gateway — traffic is not confined to a tunnel`,
      })
    } else {
      findings.push({
        service: s.service,
        verdict: 'leak',
        detail: 'not routed through a VPN (no network_mode: service:<vpn>) — its traffic would use your real IP',
      })
    }
  }

  if (findings.length === 0) {
    return { status: 'no-download-client', findings, summary: 'No recognised download client present to confine.' }
  }
  const leak = findings.some((f) => f.verdict === 'leak')
  const warn = findings.some((f) => f.verdict === 'warn')
  const status: StructuralStatus = leak ? 'leak' : warn ? 'routed-no-killswitch' : 'leak-proof'
  const summary =
    status === 'leak'
      ? `LEAK by construction: ${findings.filter((f) => f.verdict === 'leak').map((f) => f.service).join(', ')} is not confined to a VPN.`
      : status === 'routed-no-killswitch'
        ? `Routed, but the kill-switch is unverified for: ${findings.filter((f) => f.verdict === 'warn').map((f) => f.service).join(', ')}. Safe while the tunnel is up; use gluetun with its firewall on for drop protection.`
        : 'Leak-proof by construction: every download client is confined to gluetun, whose kill-switch drops egress if the tunnel fails.'
  return { status, findings, summary }
}

async function defaultFetchHostIp(probeUrl: string): Promise<string | null> {
  try {
    const res = await fetch(probeUrl, { signal: AbortSignal.timeout(5000) })
    const text = (await res.text()).trim()
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(text) ? text : null
  } catch {
    return null
  }
}
