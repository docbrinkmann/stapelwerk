/**
 * Plan matrix — the single source of truth for per-user limits.
 *
 * Gating is only active on the hosted instance (`BILLING_ENABLED=true`). A
 * self-hosted AGPL build never sets it, so `isBillingEnabled()` is false and
 * every gate short-circuits to unlimited — the open-core promise.
 *
 * The price axis is `remoteTargets` (hosts you can deploy to), NOT seats/orgs.
 * No other file may hardcode a limit number — import from here.
 */

export type PlanId = 'free' | 'pro' | 'fleet'

export interface PlanLimits {
  /** Saved stacks. null = unlimited. */
  stacks: number | null
  /** Registered REMOTE deployment targets (SSH hosts). Local socket is separate. */
  remoteTargets: number
  /** Direct deploy / stop / redeploy + live logs + terminal. */
  deploy: boolean
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { stacks: 2, remoteTargets: 0, deploy: false },
  pro: { stacks: null, remoteTargets: 2, deploy: true },
  fleet: { stacks: null, remoteTargets: 10, deploy: true },
}

/** Limits for a self-hosted build (billing disabled): everything unlimited. */
export const SELF_HOST_LIMITS: PlanLimits = {
  stacks: null,
  remoteTargets: Infinity,
  deploy: true,
}

// --- Presentation (pricing page + upgrade dialog) ---------------------------
// Prices in EUR/month. Yearly = 2 months free (monthly × 10). Kept next to the
// limits so plan facts live in one file; bullets are DERIVED from the limits so
// the UI can never advertise a capability that doesn't exist.

export interface PlanPresentation {
  id: PlanId
  name: string
  priceMonthly: number
  tagline: string
  featured?: boolean
}

export const PLAN_PRICING: Record<PlanId, PlanPresentation> = {
  free: { id: 'free', name: 'Free', priceMonthly: 0, tagline: 'Compose, check and export — forever free.' },
  pro: { id: 'pro', name: 'Pro', priceMonthly: 9, tagline: 'Deploy your stack with the VPN kill-switch verified — live logs.', featured: true },
  fleet: { id: 'fleet', name: 'Fleet', priceMonthly: 24, tagline: 'For freelancers managing many client hosts.' },
}

/**
 * One-time "verified deploy" outcome — the priced value that isn't a monthly
 * SaaS this audience resists: a provenance-signed report VERIFYING (by
 * construction) that the stack is deploy-safe — the download client is confined
 * to gluetun's kill-switch (no real-IP leak if the tunnel drops), and the deploy
 * safety audit passes (no datastore exposed on the host network, datastores keep
 * their data, no default secrets, images pinned). The buyer keeps + runs the
 * compose; we never boot their stack on our infra. Price in EUR.
 */
export const VERIFIED_DEPLOY_PRICE = 29

/** Yearly price = 2 months free. */
export function yearlyPrice(monthly: number): number {
  return monthly * 10
}

/** Self-host supporter license (sustainability, NOT a feature unlock). */
export const SUPPORTER_PRICE_YEARLY = 99

/** Feature bullets for a plan, derived from its real limits (never fictional). */
export function planFeatureBullets(plan: PlanId): string[] {
  const l = PLAN_LIMITS[plan]
  const bullets: string[] = [
    'Curated catalog & guided builder',
    'Compatibility & resource checks',
    'Export + handoff guides (Coolify/Portainer/Dokploy/Openship)',
    'Community marketplace',
  ]
  bullets.push(l.stacks === null ? 'Unlimited saved stacks' : `${l.stacks} saved stacks`)
  if (l.deploy) {
    // Lead the paid value with the verified correctness (the thesis), not the
    // host count — the deployment-target limit is a fair-use guardrail, not the pitch.
    bullets.push('Deploys with the VPN kill-switch verified (routing + gluetun firewall)', 'Live logs & container terminal')
  }
  if (l.remoteTargets > 0) {
    bullets.push(`Deploy to ${l.remoteTargets} of your own host${l.remoteTargets === 1 ? '' : 's'}`)
  }
  return bullets
}

const VALID_PLANS = new Set<PlanId>(['free', 'pro', 'fleet'])

/** True on the hosted instance where plan gating applies. */
export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === 'true'
}

/**
 * Effective plan for a user at time `now`: an expired `planValidUntil` falls
 * back to `free`, an unknown/missing plan is `free`. Pure — no env, no clock.
 */
export function resolvePlan(
  user: { plan?: string | null; planValidUntil?: Date | string | null } | null | undefined,
  now: Date = new Date(),
): PlanId {
  if (!user) return 'free'
  const plan = (user.plan ?? 'free') as PlanId
  if (!VALID_PLANS.has(plan)) return 'free'
  if (plan === 'free') return 'free'
  // Paid plan: honor it only while still valid.
  const until = user.planValidUntil ? new Date(user.planValidUntil) : null
  if (!until || until.getTime() <= now.getTime()) return 'free'
  return plan
}

/**
 * Effective limits for a user: unlimited when billing is disabled (self-host),
 * else the resolved plan's limits.
 */
export function limitsFor(
  user: { plan?: string | null; planValidUntil?: Date | string | null } | null | undefined,
  now: Date = new Date(),
): PlanLimits {
  if (!isBillingEnabled()) return SELF_HOST_LIMITS
  return PLAN_LIMITS[resolvePlan(user, now)]
}
