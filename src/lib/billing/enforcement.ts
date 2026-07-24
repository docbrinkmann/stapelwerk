/**
 * Server-side plan enforcement — the single place limits are checked, shared by
 * tRPC routers AND the WebSocket handlers (WS is not tRPC, so gating can't live
 * in a tRPC procedure; a shared helper is the only DRY way to mirror the gates
 * in both). All limit numbers come from `plans.ts` — this file owns none.
 *
 * When billing is disabled (self-host), `effectivePlan` returns unlimited
 * without reading any billing state — the open-core promise.
 */
import { TRPCError } from '@trpc/server'
import {
  PLAN_LIMITS,
  SELF_HOST_LIMITS,
  resolvePlan,
  isBillingEnabled,
  type PlanId,
  type PlanLimits,
} from '@/lib/plans'

export interface EffectivePlan {
  /** Resolved plan id, or null on a self-host (billing-disabled) build. */
  plan: PlanId | null
  limits: PlanLimits
}

// Structural minimum we need — matches the real PrismaClient and the in-memory
// test harness without dragging the full generated type in.
interface UserPlanReader {
  users: { findUnique: (args: { where: { id: string }; select?: Record<string, boolean> }) => Promise<{ plan?: string | null; planValidUntil?: Date | null } | null> }
}

/** Effective plan+limits for a user. Billing off ⇒ unlimited, no plan read. */
export async function effectivePlan(prisma: UserPlanReader, userId: string): Promise<EffectivePlan> {
  if (!isBillingEnabled()) return { plan: null, limits: SELF_HOST_LIMITS }
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { plan: true, planValidUntil: true },
  })
  const plan = resolvePlan(user)
  return { plan, limits: PLAN_LIMITS[plan] }
}

/** A machine-readable PLAN_LIMIT error the client maps to the upgrade dialog. */
export interface PlanLimitCause {
  code: 'PLAN_LIMIT'
  limit: number
  plan: PlanId | null
}

export function planLimitError(opts: { plan: PlanId | null; limit: number; message: string }): TRPCError {
  const cause: PlanLimitCause = { code: 'PLAN_LIMIT', limit: opts.limit, plan: opts.plan }
  return new TRPCError({ code: 'FORBIDDEN', message: opts.message, cause })
}

/** True when an unknown error is a PLAN_LIMIT gate (for tests + the client). */
export function isPlanLimitError(err: unknown): err is TRPCError & { cause: PlanLimitCause } {
  const cause = (err as { cause?: unknown })?.cause
  return !!cause && typeof cause === 'object' && (cause as PlanLimitCause).code === 'PLAN_LIMIT'
}

/** Throw if the user is at/over their saved-stack limit. */
export function assertStackLimit(ep: EffectivePlan, currentCount: number): void {
  const max = ep.limits.stacks
  if (max !== null && currentCount >= max) {
    throw planLimitError({
      plan: ep.plan,
      limit: max,
      message: `You've reached your plan's limit of ${max} stacks. Upgrade to save more.`,
    })
  }
}

/** Throw if the user is at/over their remote-target limit. */
export function assertRemoteTargetLimit(ep: EffectivePlan, currentCount: number): void {
  const max = ep.limits.remoteTargets
  if (Number.isFinite(max) && currentCount >= max) {
    throw planLimitError({
      plan: ep.plan,
      limit: max,
      message:
        max === 0
          ? 'Direct deploy to remote hosts is a Pro feature. Upgrade to add a target.'
          : `You've reached your plan's limit of ${max} remote targets. Upgrade for more.`,
    })
  }
}

/** Throw if the plan can't deploy / stream logs / open a terminal. */
export function assertDeployCapability(ep: EffectivePlan): void {
  if (!ep.limits.deploy) {
    throw planLimitError({
      plan: ep.plan,
      limit: 0,
      message: 'Deploying, live logs and the terminal are Pro features. Upgrade to use them.',
    })
  }
}
