import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../trpc'

// ponytail: profile = display name only; add fields when they exist in the schema
export const usersRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.users.findUnique({
      where: { id: ctx.userId! },
      select: { id: true, email: true, name: true },
    })
    return user
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
