import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../trpc'
import { isBillingEnabled, resolvePlan } from '@/lib/plans'
import { customerPortalUrl } from '@/lib/billing'

// ponytail: profile = display name only; add fields when they exist in the schema
export const usersRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.users.findUnique({
      where: { id: ctx.userId! },
      select: { id: true, email: true, name: true, plan: true, planValidUntil: true },
    })
    if (!user) return null

    // Billing off (self-host): no plan surface at all.
    if (!isBillingEnabled()) {
      const { plan: _p, planValidUntil: _v, ...rest } = user
      return { ...rest, billingEnabled: false as const }
    }

    // Polar portals open via a short-lived customer session; only worth the
    // API call once the user has any billing history with us.
    let manageUrl: string | null = null
    const lastEvent = await ctx.prisma.billing_events.findFirst({
      where: { userId: ctx.userId! },
      select: { id: true },
    })
    if (lastEvent) manageUrl = await customerPortalUrl(ctx.userId!)

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      billingEnabled: true as const,
      plan: resolvePlan(user),
      planValidUntil: user.planValidUntil,
      manageUrl,
    }
  }),

  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.users.update({
        where: { id: ctx.userId! },
        data: { name: input.name, updatedAt: new Date() },
        select: { id: true, email: true, name: true },
      })
      return user
    }),
})
