import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const communityRouter = createTRPCRouter({
  // Get featured stacks
  getFeaturedStacks: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(6) }))
    .query(async ({ input, ctx }) => {
      try {
        const { limit } = input;

        // Get public template stacks ordered by most recent
        const featuredStacks = await ctx.prisma.stacks.findMany({
          where: {
            status: 'public',
            isTemplate: true,
            isPublic: true
          },
          include: {
            stack_services: {
              include: {
                services: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    dockerImage: true,
                    categories: {
                      select: {
                        name: true,
                        slug: true
                      }
                    }
                  }
                }
              },
              orderBy: { order: 'asc' }
            },
            _count: {
              select: {
                stack_services: true
              }
            }
          },
          orderBy: [
            { createdAt: 'desc' } // Most recent first
          ],
          take: limit
        });

        return featuredStacks;
      } catch (error) {
        console.error('Error fetching featured stacks:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch featured stacks'
        });
      }
    }),

  // Get popular stacks
  getPopularStacks: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(12) }))
    .query(async ({ input, ctx }) => {
      try {
        const { limit } = input;

        // Get public stacks with service counts for popularity
        const popularStacks = await ctx.prisma.stacks.findMany({
          where: {
            status: 'public',
            isPublic: true
          },
          include: {
            stack_services: {
              include: {
                services: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    dockerImage: true,
                    categories: {
                      select: {
                        name: true,
                        slug: true
                      }
                    }
                  }
                }
              },
              orderBy: { order: 'asc' }
            },
            _count: {
              select: {
                stack_services: true
              }
            }
          },
          orderBy: [
            { createdAt: 'desc' } // Order by most recent as proxy for popularity
          ],
          take: limit
        });

        // Sort by service count (stacks with more services are more "popular")
        return popularStacks.sort((a, b) => {
          const countA = a._count?.stack_services || 0;
          const countB = b._count?.stack_services || 0;
          return countB - countA;
        });
      } catch (error) {
        console.error('Error fetching popular stacks:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch popular stacks'
        });
      }
    }),

  // Get categories
  getCategories: publicProcedure
    .query(async ({ ctx }) => {
      const categories = await ctx.prisma.categories.findMany({
        select: {
          id: true,
          name: true,
          slug: true
        },
        orderBy: { sortOrder: 'asc' }
      });
      return categories.map(c => c.name);
    }),

  // Get marketplace stats
  getMarketplaceStats: publicProcedure
    .query(async ({ ctx }) => {
      try {
        // Get total public stacks
        const totalStacks = await ctx.prisma.stacks.count({
          where: {
            status: 'public',
            isPublic: true
          }
        });

        // Get featured stacks count
        const featuredStacks = await ctx.prisma.stacks.count({
          where: {
            status: 'public',
            isPublic: true,
            isTemplate: true
          }
        });

        // Get unique contributors (users who created public stacks)
        const contributors = await ctx.prisma.stacks.findMany({
          where: {
            status: 'public',
            isPublic: true,
            userId: { not: null }
          },
          select: {
            userId: true
          },
          distinct: ['userId']
        });

        const activeContributors = contributors.length;

        // Real total downloads: the sum of every public stack's importCount.
        const importRows = await ctx.prisma.stacks.findMany({
          where: { status: 'public', isPublic: true },
          select: { importCount: true }
        });
        const totalDownloads = importRows.reduce(
          (sum: number, r: { importCount: number | null }) => sum + (r.importCount ?? 0),
          0
        );

        return {
          totalStacks,
          totalDownloads,
          activeContributors,
          featuredStacks
        };
      } catch (error) {
        console.error('Error fetching marketplace stats:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch marketplace statistics'
        });
      }
    }),

  // Search stacks
  searchStacks: publicProcedure
    .input(z.object({
      query: z.string(),
      category: z.string().optional(),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      sortBy: z.enum(['popular', 'recent', 'rating']).default('popular'),
      limit: z.number().min(1).max(50).default(24)
    }))
    .query(async ({ input, ctx }) => {
      try {
        const { query, category, sortBy, limit } = input;

        // Build where clause for search
        const whereClause: any = {
          status: 'public',
          isPublic: true,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        };

        // If category filter is provided, join with services
        let stacks;
        if (category && category !== 'all') {
          stacks = await ctx.prisma.stacks.findMany({
            where: {
              ...whereClause,
              stack_services: {
                some: {
                  services: {
                    categories: {
                      slug: category
                    }
                  }
                }
              }
            },
            include: {
              stack_services: {
                include: {
                  services: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      dockerImage: true,
                      categories: {
                        select: {
                          name: true,
                          slug: true
                        }
                      }
                    }
                  }
                },
                orderBy: { order: 'asc' }
              },
              _count: {
                select: {
                  stack_services: true
                }
              }
            },
            orderBy: sortBy === 'recent'
              ? { createdAt: 'desc' }
              : { updatedAt: 'desc' },
            take: limit
          });
        } else {
          stacks = await ctx.prisma.stacks.findMany({
            where: whereClause,
            include: {
              stack_services: {
                include: {
                  services: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      dockerImage: true,
                      categories: {
                        select: {
                          name: true,
                          slug: true
                        }
                      }
                    }
                  }
                },
                orderBy: { order: 'asc' }
              },
              _count: {
                select: {
                  stack_services: true
                }
              }
            },
            orderBy: sortBy === 'recent'
              ? { createdAt: 'desc' }
              : { updatedAt: 'desc' },
            take: limit
          });
        }

        // If sorting by popular, sort by service count
        if (sortBy === 'popular') {
          stacks.sort((a, b) => {
            const countA = a._count?.stack_services || 0;
            const countB = b._count?.stack_services || 0;
            return countB - countA;
          });
        }

        return { stacks };
      } catch (error) {
        console.error('Error searching stacks:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to search stacks'
        });
      }
    }),

  // Track import
  trackImport: publicProcedure
    .input(z.object({ stackId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { stackId } = input;

        // Verify stack exists
        const stack = await ctx.prisma.stacks.findUnique({
          where: { id: stackId },
          select: { id: true, status: true, importCount: true }
        });

        if (!stack) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Stack not found'
          });
        }

        // Record the import as a real, countable event.
        // ponytail: read-then-write increment — a lost update under heavy
        // concurrency is fine for a marketplace counter; switch to an atomic
        // { increment: 1 } if contention ever matters.
        await ctx.prisma.stacks.update({
          where: { id: stackId },
          data: { importCount: (stack.importCount ?? 0) + 1, updatedAt: new Date() }
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error('Error tracking import:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to track import'
        });
      }
    })
});
