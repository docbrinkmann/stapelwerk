import { timingSafeEqual } from 'crypto'

/**
 * Constant-time check for the deploy-bridge bearer token.
 *
 * The bridge (`server/ws-server.ts` `/deploy`) can run `docker compose` against
 * the host Docker socket, so this shared token is its entire security boundary.
 * A plain `header !== \`Bearer ${token}\`` leaks length/prefix timing; compare in
 * constant time and fail closed when no token is configured.
 */
export function bridgeTokenAuthorized(
  authHeader: string | undefined,
  token: string | undefined,
): boolean {
  if (!token) return false // unset token => bridge is disabled, never authorize
  const expected = `Bearer ${token}`
  const got = authHeader ?? ''
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch; the length check itself is not
  // secret (the expected length is fixed), so guard it before comparing.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
