/**
 * Deploy-time guard against dangerous host bind mounts.
 *
 * "Deploy to this server" runs a stack's generated compose against the host
 * Docker socket. A service's `volumeMounts.hostPath` is user-controlled, so
 * without this guard an authenticated user could bind-mount `/` or the Docker
 * socket into their container and take over the (on the hosted instance,
 * shared) host. The save-time validator only warns and does not run on the
 * deploy path — this is the enforcing check.
 *
 * We block a bind mount whose host path is, or lives under, a sensitive host
 * location. Named/relative volumes (no leading `/`) are never host paths and
 * are allowed.
 */

/** Host locations a stack must never bind-mount. Matched by path segment. */
const BLOCKED_PREFIXES = [
  '/', // the whole host filesystem
  '/etc',
  '/root',
  '/home',
  '/boot',
  '/dev',
  '/proc',
  '/sys',
  '/run',
  '/var/run', // docker.sock lives here
  '/var/lib/docker',
  '/var/lib/kubelet',
]

/** Normalize a host path: strip trailing slashes, collapse `//`, resolve nothing else. */
function normalizeHostPath(p: string): string {
  const trimmed = p.trim()
  if (trimmed === '/') return '/'
  return trimmed.replace(/\/+/g, '/').replace(/\/+$/, '')
}

/** True when `path` equals `prefix` or is a child directory of it. */
function isUnder(path: string, prefix: string): boolean {
  // `/` blocks only the whole-root mount itself — a normal `/opt/data` bind is
  // fine and must not be caught by "everything is under root".
  if (prefix === '/') return path === '/'
  return path === prefix || path.startsWith(`${prefix}/`)
}

export interface BindMountLike {
  hostPath?: unknown
  containerPath?: unknown
}

/**
 * Return the first dangerous host bind-mount path found, or null if all mounts
 * are safe. Only absolute host paths are checked; named/relative volumes pass.
 */
export function findDangerousBindMount(
  mounts: readonly BindMountLike[] | undefined,
): string | null {
  if (!mounts) return null
  for (const m of mounts) {
    const raw = typeof m?.hostPath === 'string' ? m.hostPath : ''
    if (!raw.startsWith('/')) continue // not an absolute host path
    const host = normalizeHostPath(raw)
    if (BLOCKED_PREFIXES.some((prefix) => isUnder(host, prefix))) {
      return raw
    }
  }
  return null
}

/**
 * Throw if any service in the persisted stack bind-mounts a sensitive host path.
 * Call on the local-socket deploy path before handing compose to Docker.
 */
export function assertSafeBindMounts(
  services: ReadonlyArray<{ configuration?: { volumeMounts?: readonly BindMountLike[] } }>,
): void {
  for (const svc of services) {
    const bad = findDangerousBindMount(svc.configuration?.volumeMounts)
    if (bad) {
      throw new Error(
        `Refusing to deploy: bind mount of a sensitive host path is not allowed (${bad}). ` +
          `Use a named volume instead.`,
      )
    }
  }
}
