/**
 * Minimal in-memory login throttle for the credentials provider.
 *
 * ponytail: process-local Map, resets on restart and is per-instance — it
 * raises the bar for online brute force / credential stuffing on a single
 * self-host node, which is the AGPL audience. For a multi-instance hosted
 * deployment, move this to a shared store (Redis) keyed the same way.
 *
 * Sliding lockout: after MAX_FAILURES within WINDOW_MS, further attempts for
 * that key are refused until the window since the last failure elapses.
 */

const MAX_FAILURES = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

interface Attempt {
  failures: number
  firstAt: number
  lastAt: number
}

const attempts = new Map<string, Attempt>()

/** Normalize the throttle key (email) so casing/whitespace can't split buckets. */
function keyOf(email: string): string {
  return email.toLowerCase().trim()
}

/** True when the key is currently locked out (too many recent failures). */
export function isLockedOut(email: string, now: number = Date.now()): boolean {
  const a = attempts.get(keyOf(email))
  if (!a) return false
  if (now - a.lastAt > WINDOW_MS) {
    attempts.delete(keyOf(email))
    return false
  }
  return a.failures >= MAX_FAILURES
}

/** Record a failed login; call after a rejected password. */
export function recordFailure(email: string, now: number = Date.now()): void {
  const k = keyOf(email)
  const a = attempts.get(k)
  if (!a || now - a.lastAt > WINDOW_MS) {
    attempts.set(k, { failures: 1, firstAt: now, lastAt: now })
    return
  }
  a.failures += 1
  a.lastAt = now
}

/** Clear the counter on a successful login. */
export function recordSuccess(email: string): void {
  attempts.delete(keyOf(email))
}

/** Test helper: wipe all state. */
export function _resetThrottle(): void {
  attempts.clear()
}
