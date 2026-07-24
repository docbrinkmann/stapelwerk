/**
 * Edge-compatible sliding-window rate limiter.
 *
 * Plain in-memory implementation. The previous version emulated a Redis
 * subset for @upstash/ratelimit, but guessed the Lua script's argument
 * order wrong — in production every first request was rejected with
 * remaining=0 (development skips rate limiting entirely, so it was never
 * exercised until the first real deployment).
 *
 * ponytail: per-instance memory store — swap for Redis when the app runs
 * on more than one instance.
 */

interface WindowConfig {
  limit: number;
  windowMs: number;
}

const WINDOWS: Record<'api' | 'public' | 'strict' | 'auth', WindowConfig> = {
  api: { limit: 1000, windowMs: 15 * 60_000 },
  public: { limit: 10_000, windowMs: 60 * 60_000 },
  strict: { limit: 100, windowMs: 60_000 },
  auth: { limit: 200, windowMs: 15 * 60_000 },
};

// key -> sorted request timestamps within the current window
const hits = new Map<string, number[]>();

export async function checkRateLimit(
  limiterType: keyof typeof WINDOWS,
  identifier: string
): Promise<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
}> {
  const { limit, windowMs } = WINDOWS[limiterType];
  const key = `${limiterType}:${identifier}`;
  const now = Date.now();
  const cutoff = now - windowMs;

  const stamps = (hits.get(key) ?? []).filter((t) => t > cutoff);
  const allowed = stamps.length < limit;
  if (allowed) stamps.push(now);
  hits.set(key, stamps);

  // Opportunistic cleanup so the map doesn't grow unbounded
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (v.length === 0 || v[v.length - 1] <= cutoff) hits.delete(k);
    }
  }

  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - stamps.length),
    resetTime: new Date((stamps[0] ?? now) + windowMs),
  };
}

/**
 * Get client identifier from request
 * Prioritizes: x-forwarded-for > x-real-ip > remoteAddress
 */
export function getClientIdentifier(req: {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}): string {
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];

  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }

  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return req.socket?.remoteAddress || '127.0.0.1';
}
