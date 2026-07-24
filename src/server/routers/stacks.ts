import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc';
import { 
  StackCreateSchema, 
  StackUpdateSchema,
  StackEnvVarSchema,
  StackPortMappingSchema,
  StackVolumeMountSchema,
  StackDependenciesSchema,
  StackStatus 
} from '@/lib/validation/stack-schemas';
import { StackUtils } from '@/lib/database/stack-utils';
import { deriveDifficulty, deriveTags, templateCategoryFilter } from '@/lib/shared-stack';
import { asArray } from '@/lib/service-detail';
import { buildNetworkOverview } from '@/lib/network-overview';
import { StackSlugGenerator } from '@/lib/utils/stack-slug-generator';
import { StackServiceConfigValidator } from '@/lib/validation/stack-config-validator';
import { effectivePlan, assertStackLimit } from '@/lib/billing/enforcement';
import crypto from 'crypto';

// Define StackServiceConfigurationSchema locally
const StackServiceConfigurationSchema = z.object({
  environmentVariables: StackEnvVarSchema.optional(),
  portMappings: StackPortMappingSchema.optional(),
  volumeMounts: StackVolumeMountSchema.optional(),
  dependsOn: StackDependenciesSchema.optional(),
  // Optional docker network_mode, e.g. "service:gluetun" (VPN kill-switch).
  networkMode: z.string().max(128).optional()
});

// Input schemas for stack endpoints
const StackListInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(50).default(10),
  status: z.nativeEnum(StackStatus).optional(),
  userId: z.string().optional(), // For admin queries
});

const StackGetInputSchema = z.object({
  id: z.string().min(1)
});

const StackUpdateInputSchema = StackUpdateSchema.extend({
  id: z.string().min(1)
});

const StackDeleteInputSchema = z.object({
  id: z.string().min(1)
});

const StackAddServiceInputSchema = z.object({
  stackId: z.string().min(1),
  serviceId: z.number().int().positive(),
  configuration: StackServiceConfigurationSchema.optional(),
  order: z.number().int().positive().optional()
});

const StackRemoveServiceInputSchema = z.object({
  stackId: z.string().min(1),
  serviceId: z.number().int().positive()
});

const StackUpdateServiceConfigInputSchema = z.object({
  stackId: z.string().min(1),
  serviceId: z.number().int().positive(),
  configuration: StackServiceConfigurationSchema
});

const StackSubmitForApprovalInputSchema = z.object({
  id: z.string().min(1),
  // The submit modal collects a template description — persist it on the
  // stack so the marketplace card has something to show.
  description: z.string().max(2000).optional()
});

const PublicTemplatesInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(20).default(10),
  category: z.string().optional()
});

// Response schemas
const StackListResponseSchema = z.object({
  stacks: z.array(z.any()),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  total: z.number()
});

const StackResponseSchema = z.any();
const DeleteResponseSchema = z.object({
  success: z.boolean()
});

// Helper function to validate stack ownership
const validateStackOwnership = async (stackId: string, userId: string, prisma: any) => {
  const stack = await prisma.stacks.findUnique({
    where: { id: stackId },
    select: { userId: true, isPublic: true, status: true }
  });

  if (!stack) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Stack not found'
    });
  }

  // Allow access if user owns the stack or if it's a public stack
  if (stack.userId !== userId && !(stack.isPublic && stack.status === 'public')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Access denied'
    });
  }

  return stack;
};

type StackEnvVar = { key: string; value: string; isSecret: boolean };

// Env vars can be secrets, so require ownership even for public stacks.
const requireStackOwnerStrict = async (stackId: string, userId: string, prisma: any) => {
  const stack = await prisma.stacks.findUnique({
    where: { id: stackId },
    select: { userId: true, envVars: true },
  });
  if (!stack) throw new TRPCError({ code: 'NOT_FOUND', message: 'Stack not found' });
  if (stack.userId !== userId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
  return stack as { userId: string; envVars: string | null };
};

const parseEnvVars = (raw: string | null | undefined): StackEnvVar[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v: any) => v && typeof v.key === 'string' && v.key.trim())
      .map((v: any) => ({ key: String(v.key), value: String(v.value ?? ''), isSecret: Boolean(v.isSecret) }));
  } catch {
    return [];
  }
};

// Helper function to parse cursor for pagination
const parseCursor = (cursor?: string): { id: string } | undefined => {
  if (!cursor) return undefined;
  
  try {
    // For stacks, we use the stack ID as cursor
    return { id: cursor };
  } catch {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid cursor'
    });
  }
};

export const stacksRouter = createTRPCRouter({
  // List user's stacks with pagination and filtering
  list: protectedProcedure
    .input(StackListInputSchema)
    .output(StackListResponseSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { cursor, limit, status, userId: targetUserId } = input;
        const requestingUserId = ctx.userId!;

        // If requesting specific user's stacks, validate permission
        const queryUserId = targetUserId || requestingUserId;
        if (targetUserId && targetUserId !== requestingUserId) {
          // Only admins can query other users' stacks
          // For now, we'll restrict to own stacks only
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Cannot access other users stacks'
          });
        }

        // Build filter conditions
        const filters: any = {
          userId: queryUserId
        };

        if (status) {
          filters.status = status;
        }

        // Handle cursor pagination
        let cursorCondition = {};
        if (cursor) {
          // Since we order by createdAt desc, we need to find the createdAt of the cursor stack
          // and then filter for stacks created before it
          const cursorStack = await ctx.prisma.stacks.findUnique({
            where: { id: cursor },
            select: { createdAt: true }
          });
          
          if (cursorStack) {
            cursorCondition = {
              createdAt: { lt: cursorStack.createdAt }
            };
          }
        }

        // Fetch stacks with pagination
        const stacks = await ctx.prisma.stacks.findMany({
          where: {
            ...filters,
            ...cursorCondition
          },
          include: {
            stack_services: {
              include: {
                services: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    dockerImage: true
                  }
                }
              },
              orderBy: {
                order: 'asc'
              }
            },
            _count: {
              select: {
                stack_services: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: limit + 1 // Fetch one extra to check if there are more
        });

        // Determine pagination info
        const hasMore = stacks.length > limit;
        const nextCursor = hasMore ? stacks[limit - 1].id : null;
        const paginatedStacks = stacks.slice(0, limit);

        // Get total count for this query
        const total = await ctx.prisma.stacks.count({
          where: filters
        });

        return {
          stacks: paginatedStacks,
          nextCursor,
          hasMore,
          total
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        console.error('Error listing stacks:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch stacks'
        });
      }
    }),

  // Network overview across ALL of the user's stacks: published host ports per
  // service, the internal appnet hostname, and cross-stack host-port conflicts
  // (two stacks binding the same host port can't run on one host at once).
  networkOverview: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId;
    if (!userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const stacks = await ctx.prisma.stacks.findMany({
      where: { userId },
      include: {
        stack_services: {
          include: {
            services: { select: { id: true, name: true, slug: true, ports: true, volumes: true } },
            stack_service_configurations: true,
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return buildNetworkOverview(
      stacks.map((stack) => ({
        stackId: stack.id,
        stackName: stack.name,
        services: stack.stack_services.map((ss) => ({
          serviceId: ss.services.id,
          name: ss.services.name,
          slug: ss.services.slug,
          portMappings: ss.stack_service_configurations?.portMappings ?? null,
          ports: ss.services.ports ?? null,
          dependsOn: ss.stack_service_configurations?.dependsOn ?? null,
          volumes: ss.services.volumes ?? null,
        })),
      })),
    );
  }),

  // Get single stack with full configuration
  get: protectedProcedure
    .input(StackGetInputSchema)
    .output(StackResponseSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { id } = input;
        const userId = ctx.userId!;

        const ownership = await validateStackOwnership(id, userId, ctx.prisma);
        const isOwner = ownership.userId === userId;

        const stack = await ctx.prisma.stacks.findUnique({
          where: { id },
          include: {
            stack_services: {
              include: {
                services: {
                  include: {
                    categories: true
                  }
                },
                stack_service_configurations: true
              },
              orderBy: {
                order: 'asc'
              }
            }
          }
        });

        if (!stack) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Stack not found'
          });
        }

        // Env vars can hold secrets. A non-owner reaching this via the public
        // path must not see their values (was a cleartext secret leak for any
        // published stack). Owner-only fields like envVars are unaffected.
        if (!isOwner) {
          for (const ss of stack.stack_services ?? []) {
            if (ss.stack_service_configurations) {
              ss.stack_service_configurations.environmentVariables = '{}';
            }
          }
        }

        return stack;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        console.error('Error getting stack:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch stack'
        });
      }
    }),

  // Create new stack with services and configurations
  create: protectedProcedure
    .input(StackCreateSchema)
    .output(StackResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId!;
        const { name, description, services = [], isPublic = false, status = StackStatus.DRAFT, isTemplate = false } = input;

        // Plan gate: enforce the saved-stack limit (self-host ⇒ unlimited).
        const ep = await effectivePlan(ctx.prisma, userId);
        if (ep.limits.stacks !== null) {
          const stackCount = await ctx.prisma.stacks.count({ where: { userId } });
          assertStackLimit(ep, stackCount);
        }

        // Generate unique slug
        const slugGenerator = new StackSlugGenerator(ctx.prisma);
        const slug = await slugGenerator.generateUniqueSlug(name);

        // Validate service configurations if provided
        if (services.length > 0) {
          for (const service of services) {
            if (service.configuration) {
              const validation = StackServiceConfigValidator.validateServiceConfiguration(
                service.configuration
              );
              
              if (validation.errors.length > 0) {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: `Validation error: ${validation.errors[0].message}`
                });
              }
            }
          }
        }

        // Create stack with services in a transaction
        const stack = await ctx.prisma.$transaction(async (tx) => {
          // Create the stack
          const createdStack = await tx.stacks.create({
            data: {
              id: crypto.randomUUID(),
              name,
              description,
              slug,
              userId,
              isPublic,
              isTemplate,
              status,
              updatedAt: new Date()
            }
          });

          // Create stack services if provided
          if (services.length > 0) {
            for (const [index, service] of services.entries()) {
              // Verify service exists
              const serviceExists = await tx.services.findUnique({
                where: { id: service.serviceId },
                select: { id: true }
              });

              if (!serviceExists) {
                throw new TRPCError({
                  code: 'NOT_FOUND',
                  message: `Service not found: ${service.serviceId}`
                });
              }

              // Create stack service
              const stackService = await tx.stack_services.create({
                data: {
                  id: crypto.randomUUID(),
                  stackId: createdStack.id,
                  serviceId: service.serviceId,
                  order: service.order || index + 1
                }
              });

              // Create configuration if provided
              if (service.configuration) {
                await tx.stack_service_configurations.create({
                  data: {
                    id: crypto.randomUUID(),
                    stackServiceId: stackService.id,
                    environmentVariables: JSON.stringify(service.configuration.environmentVariables || {}),
                    portMappings: JSON.stringify(service.configuration.portMappings || {}),
                    volumeMounts: JSON.stringify(service.configuration.volumeMounts || {}),
                    dependsOn: JSON.stringify(service.configuration.dependsOn || []),
                    networkMode: service.configuration.networkMode ?? null,
                    updatedAt: new Date()
                  }
                });
              } else {
                // Create default empty configuration
                await tx.stack_service_configurations.create({
                  data: {
                    id: crypto.randomUUID(),
                    stackServiceId: stackService.id,
                    environmentVariables: JSON.stringify({}),
                    portMappings: JSON.stringify({}),
                    volumeMounts: JSON.stringify({}),
                    dependsOn: JSON.stringify([]),
                    updatedAt: new Date()
                  }
                });
              }
            }
          }

          // Return the complete stack with relationships
          return await tx.stacks.findUnique({
            where: { id: createdStack.id },
            include: {
              stack_services: {
                include: {
                  services: {
                    include: {
                      categories: true
                    }
                  },
                  stack_service_configurations: true
                },
                orderBy: {
                  order: 'asc'
                }
              }
            }
          });
        });

        return stack;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        console.error('Error creating stack:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create stack'
        });
      }
    }),

  // Update existing stack
  update: protectedProcedure
    .input(StackUpdateInputSchema)
    .output(StackResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId!;
        const { id, name, description, services, isPublic, status } = input;

        await validateStackOwnership(id, userId, ctx.prisma);

        // Update stack in a transaction
        const updatedStack = await ctx.prisma.$transaction(async (tx) => {
          // Update basic stack information
          const updateData: any = {};
          if (name !== undefined) updateData.name = name;
          if (description !== undefined) updateData.description = description;
          if (isPublic !== undefined) updateData.isPublic = isPublic;
          if (status !== undefined) updateData.status = status;

          await tx.stacks.update({
            where: { id },
            data: { ...updateData, updatedAt: new Date() }
          });

          // Update services if provided
          if (services !== undefined) {
            // Remove existing services and configurations
            await tx.stack_service_configurations.deleteMany({
              where: {
                stack_services: {
                  stackId: id
                }
              }
            });
            await tx.stack_services.deleteMany({
              where: { stackId: id }
            });

            // Add new services
            for (const [index, service] of services.entries()) {
              // Verify service exists
              const serviceExists = await tx.services.findUnique({
                where: { id: service.serviceId },
                select: { id: true }
              });

              if (!serviceExists) {
                throw new TRPCError({
                  code: 'NOT_FOUND',
                  message: `Service not found: ${service.serviceId}`
                });
              }

              const stackService = await tx.stack_services.create({
                data: {
                  id: crypto.randomUUID(),
                  stackId: id,
                  serviceId: service.serviceId,
                  order: service.order || index + 1
                }
              });

              // Create configuration
              const config = service.configuration || {};
              await tx.stack_service_configurations.create({
                data: {
                  id: crypto.randomUUID(),
                  stackServiceId: stackService.id,
                  environmentVariables: JSON.stringify(config.environmentVariables || {}),
                  portMappings: JSON.stringify(config.portMappings || {}),
                  volumeMounts: JSON.stringify(config.volumeMounts || {}),
                  dependsOn: JSON.stringify(config.dependsOn || []),
                  networkMode: (config as { networkMode?: string }).networkMode ?? null,
                  updatedAt: new Date()
                }
              });
            }
          }

          // Return updated stack
          return await tx.stacks.findUnique({
            where: { id },
            include: {
              stack_services: {
                include: {
                  services: {
                    include: {
                      categories: true
                    }
                  },
                  stack_service_configurations: true
                },
                orderBy: {
                  order: 'asc'
                }
              }
            }
          });
        });

        return updatedStack;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        console.error('Error updating stack:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update stack'
        });
      }
    }),

  // Delete stack
  delete: protectedProcedure
    .input(StackDeleteInputSchema)
    .output(DeleteResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId!;
        const { id } = input;

        await validateStackOwnership(id, userId, ctx.prisma);

        // Delete stack (cascade will handle related records)
        await ctx.prisma.stacks.delete({
          where: { id }
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        console.error('Error deleting stack:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete stack'
        });
      }
    }),

  // Add service to existing stack
  addService: protectedProcedure
    .input(StackAddServiceInputSchema)
    .output(StackResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId!;
        const { stackId, serviceId, configuration, order } = input;

        await validateStackOwnership(stackId, userId, ctx.prisma);

        // Verify service exists
        const serviceExists = await ctx.prisma.services.findUnique({
          where: { id: serviceId },
          select: { id: true }
        });

        if (!serviceExists) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Service not found'
          });
        }

        // Check if service already exists in stack
        const existingStackService = await ctx.prisma.stack_services.findFirst({
          where: {
            stackId,
            serviceId
          }
        });

        if (existingStackService) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Service already exists in stack'
          });
        }

        // Add service to stack in transaction
        const updatedStack = await ctx.prisma.$transaction(async (tx) => {
          // Determine order
          let serviceOrder = order;
          if (!serviceOrder) {
            const maxOrder = await tx.stack_services.aggregate({
              where: { stackId },
              _max: { order: true }
            });
            serviceOrder = (maxOrder._max.order || 0) + 1;
          }

          // Create stack service
          const stackService = await tx.stack_services.create({
            data: {
              id: crypto.randomUUID(),
              stackId,
              serviceId,
              order: serviceOrder
            }
          });

          // Create configuration
          await tx.stack_service_configurations.create({
            data: {
              id: crypto.randomUUID(),
              stackServiceId: stackService.id,
              environmentVariables: JSON.stringify(configuration?.environmentVariables || {}),
              portMappings: JSON.stringify(configuration?.portMappings || {}),
              volumeMounts: JSON.stringify(configuration?.volumeMounts || {}),
              dependsOn: JSON.stringify(configuration?.dependsOn || []),
              networkMode: configuration?.networkMode ?? null,
              updatedAt: new Date()
            }
          });

          // Return updated stack
          return await tx.stacks.findUnique({
            where: { id: stackId },
            include: {
              stack_services: {
                include: {
                  services: {
                    include: {
                      categories: true
                    }
                  },
                  stack_service_configurations: true
                },
                orderBy: {
                  order: 'asc'
                }
              }
            }
          });
        });

        return updatedStack;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        console.error('Error adding service to stack:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add service to stack'
        });
      }
    }),

  // Remove service from stack
  removeService: protectedProcedure
    .input(StackRemoveServiceInputSchema)
    .output(DeleteResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId!;
        const { stackId, serviceId } = input;

        await validateStackOwnership(stackId, userId, ctx.prisma);

        // Find stack service
        const stackService = await ctx.prisma.stack_services.findFirst({
          where: {
            stackId,
            serviceId
          }
        });

        if (!stackService) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Service not found in stack'
          });
        }

        // Remove service from stack (cascade will handle configuration)
        await ctx.prisma.stack_services.delete({
          where: { id: stackService.id }
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        console.error('Error removing service from stack:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to remove service from stack'
        });
      }
    }),

  // Update service configuration in stack
  updateServiceConfig: protectedProcedure
    .input(StackUpdateServiceConfigInputSchema)
    .output(z.any()) // Returns the updated configuration
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId!;
        const { stackId, serviceId, configuration } = input;

        await validateStackOwnership(stackId, userId, ctx.prisma);

        // Find stack service
        const stackService = await ctx.prisma.stack_services.findFirst({
          where: {
            stackId,
            serviceId
          },
          include: {
            stack_service_configurations: true
          }
        });

        if (!stackService) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Service not found in stack'
          });
        }

        // Validate configuration
        const validation = StackServiceConfigValidator.validateServiceConfiguration(
          configuration
        );
        
        if (validation.errors.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Validation error: ${validation.errors[0].message}`
          });
        }

        // Update or create configuration
        const configData = {
          environmentVariables: JSON.stringify(configuration.environmentVariables || {}),
          portMappings: JSON.stringify(configuration.portMappings || {}),
          volumeMounts: JSON.stringify(configuration.volumeMounts || {}),
          dependsOn: JSON.stringify(configuration.dependsOn || []),
          networkMode: (configuration as { networkMode?: string }).networkMode ?? null
        };

        let updatedConfig;
        if (stackService.stack_service_configurations) {
          // Update existing configuration
          updatedConfig = await ctx.prisma.stack_service_configurations.update({
            where: { id: stackService.stack_service_configurations.id },
            data: { ...configData, updatedAt: new Date() }
          });
        } else {
          // Create new configuration
          updatedConfig = await ctx.prisma.stack_service_configurations.create({
            data: {
              id: crypto.randomUUID(),
              stackServiceId: stackService.id,
              ...configData,
              updatedAt: new Date()
            }
          });
        }

        return {
          configurations: [updatedConfig]
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        console.error('Error updating service configuration:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update service configuration'
        });
      }
    }),

  // Get public template stacks
  getPublicTemplates: publicProcedure
    .input(PublicTemplatesInputSchema)
    .output(StackListResponseSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { cursor, limit, category } = input;

        // Build filter conditions for public templates. Category is matched
        // through the stack's services -> categories relation.
        const filters: any = {
          status: 'public',
          isTemplate: true,
          ...templateCategoryFilter(category)
        };

        // Handle cursor pagination
        let cursorCondition = {};
        if (cursor) {
          // Since we order by createdAt desc, we need to find the createdAt of the cursor stack
          // and then filter for stacks created before it
          const cursorStack = await ctx.prisma.stacks.findUnique({
            where: { id: cursor },
            select: { createdAt: true }
          });
          
          if (cursorStack) {
            cursorCondition = {
              createdAt: { lt: cursorStack.createdAt }
            };
          }
        }

        // Fetch public template stacks
        const stacks = await ctx.prisma.stacks.findMany({
          where: {
            ...filters,
            ...cursorCondition
          },
          include: {
            stack_services: {
              include: {
                services: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    dockerImage: true
                  }
                }
              },
              orderBy: {
                order: 'asc'
              }
            },
            _count: {
              select: {
                stack_services: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: limit + 1
        });

        // Determine pagination info
        const hasMore = stacks.length > limit;
        const nextCursor = hasMore ? stacks[limit - 1].id : null;
        const paginatedStacks = stacks.slice(0, limit);

        // Get total count
        const total = await ctx.prisma.stacks.count({
          where: filters
        });

        return {
          stacks: paginatedStacks,
          nextCursor,
          hasMore,
          total
        };
      } catch (error) {
        console.error('Error getting public templates:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch public templates'
        });
      }
    }),

  // Submit stack for approval as public template
  submitForApproval: protectedProcedure
    .input(StackSubmitForApprovalInputSchema)
    .output(StackResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId!;
        const { id, description } = input;

        await validateStackOwnership(id, userId, ctx.prisma);

        // Check current stack status
        const currentStack = await ctx.prisma.stacks.findUnique({
          where: { id },
          select: { status: true, isTemplate: true }
        });

        if (!currentStack) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Stack not found'
          });
        }

        if (currentStack.status === 'public' || currentStack.status === 'pending_approval') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Stack is already public or pending approval'
          });
        }

        // Update stack to pending approval
        const updatedStack = await ctx.prisma.stacks.update({
          where: { id },
          data: {
            status: 'pending_approval',
            isTemplate: true,
            ...(description?.trim() ? { description: description.trim() } : {}),
            updatedAt: new Date()
          },
          include: {
            stack_services: {
              include: {
                services: {
                  include: {
                    categories: true
                  }
                },
                stack_service_configurations: true
              },
              orderBy: {
                order: 'asc'
              }
            }
          }
        });

        return updatedStack;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        console.error('Error submitting stack for approval:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to submit stack for approval'
        });
      }
    }),

  // Get shared stack by shareId
  getSharedStack: publicProcedure
    .input(z.object({ shareId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      try {
        // ShareId is the stack's public ID
        // In a more advanced implementation, we could use a separate shareId field
        // or a share_links table for tracking and analytics
        const stack = await ctx.prisma.stacks.findUnique({
          where: { id: input.shareId },
          include: {
            stack_services: {
              include: {
                services: {
                  include: {
                    categories: true
                  }
                },
                stack_service_configurations: true
              },
              orderBy: { order: 'asc' }
            }
          }
        });

        if (!stack) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Stack not found'
          });
        }

        // Check if stack is public or shared
        if (!stack.isPublic && stack.status !== 'public') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'This stack is not publicly accessible'
          });
        }

        // Fetch author information from user table if available
        let authorInfo = {
          id: stack.userId || 'anonymous',
          name: 'Anonymous User',
          avatar: undefined as string | undefined
        };

        if (stack.userId) {
          const user = await ctx.prisma.users.findUnique({
            where: { id: stack.userId },
            select: {
              id: true,
              name: true
            }
          });

          if (user) {
            authorInfo = {
              id: user.id,
              name: user.name || 'User',
              avatar: undefined
            };
          }
        }

        // Determine category from the stack's services
        const serviceList = stack.stack_services.map(ss => ss.services);
        const primaryCategory = serviceList[0]?.categories?.name || 'general';

        // Real, deployable compose for the public view — but with every secret
        // MASKED so a shared stack never leaks passwords. Importing the stack (or
        // deploying it) regenerates real secrets. Lazy import mirrors the deploy
        // path: stack-persistence pulls in client-flavoured code we don't want in
        // every request bundle.
        let dockerCompose: string | undefined;
        try {
          if (stack.stack_services.length > 0) {
            const { generateComposeWithSecrets } = await import('@/lib/stack-persistence');
            const { dbStackServicesToPersisted } = await import('@/lib/deploy/persisted-stack');
            const { yaml } = generateComposeWithSecrets(
              {
                id: stack.id,
                name: stack.name,
                description: stack.description ?? '',
                isPublic: stack.isPublic,
                services: dbStackServicesToPersisted(stack.stack_services),
              },
              { maskSecrets: true },
            );
            dockerCompose =
              '# Shared view — secret values are masked ("<secret>").\n' +
              '# Import this stack to generate real secrets, or set your own before deploying.\n' +
              yaml;
          }
        } catch (composeError) {
          // A compose failure must not take down the whole shared page.
          console.error('Failed to generate shared compose:', composeError);
        }

        return {
          id: stack.id,
          name: stack.name,
          description: stack.description || '',
          // Shape services for the public viewer: on the raw row `ports` is a JSON
          // string (the viewer does `ports.join(...)` → 500'd), and the viewer reads
          // a `category` string, not the `categories` relation.
          services: serviceList.map((svc) => ({
            ...svc,
            ports: asArray(svc.ports),
            category: svc.categories?.name ?? undefined,
          })),
          author: authorInfo,
          category: primaryCategory,
          // Real difficulty from size + real tags from the services' categories.
          difficulty: deriveDifficulty(stack.stack_services.length),
          tags: deriveTags(serviceList),
          isPublic: stack.isPublic,
          allowCloning: true,
          allowComments: true,
          stats: {
            // clones is the real import counter; views/likes/comments aren't
            // tracked yet, so they're honestly zero rather than fabricated.
            views: 0,
            likes: 0,
            clones: stack.importCount ?? 0,
            comments: 0
          },
          createdAt: stack.createdAt,
          updatedAt: stack.updatedAt,
          dockerCompose,
          documentation: undefined,
          examples: undefined
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch shared stack'
        });
      }
    }),

  // Get related stacks
  getRelatedStacks: publicProcedure
    .input(z.object({
      stackId: z.string().min(1),
      limit: z.number().min(1).max(20).default(6)
    }))
    .query(async ({ input, ctx }) => {
      try {
        const { stackId, limit } = input;

        // Get the current stack to find related stacks
        const currentStack = await ctx.prisma.stacks.findUnique({
          where: { id: stackId },
          include: {
            stack_services: {
              include: {
                services: {
                  select: {
                    id: true,
                    categories: {
                      select: {
                        id: true,
                        slug: true
                      }
                    }
                  }
                }
              }
            }
          }
        });

        if (!currentStack) {
          return [];
        }

        // Get service IDs and category IDs from current stack
        const serviceIds = currentStack.stack_services.map(ss => ss.services.id);
        const categoryIds = [...new Set(
          currentStack.stack_services.map(ss => ss.services.categories.id)
        )];

        // Find related stacks that:
        // 1. Are public
        // 2. Share services or categories with the current stack
        // 3. Are not the current stack
        // 4. Order by number of matching services
        const relatedStacks = await ctx.prisma.stacks.findMany({
          where: {
            id: { not: stackId },
            status: 'public',
            isPublic: true,
            OR: [
              // Stacks with same services
              {
                stack_services: {
                  some: {
                    serviceId: { in: serviceIds }
                  }
                }
              },
              // Stacks from same author
              ...(currentStack.userId ? [{
                userId: currentStack.userId
              }] : []),
              // Stacks with services from same categories
              {
                stack_services: {
                  some: {
                    services: {
                      categoryId: { in: categoryIds }
                    }
                  }
                }
              }
            ]
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
                        id: true,
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
          take: limit * 2 // Fetch more to filter and rank
        });

        // Calculate relevance score for each related stack
        const rankedStacks = relatedStacks.map(stack => {
          let score = 0;

          // Count matching services
          const matchingServices = stack.stack_services.filter(ss =>
            serviceIds.includes(ss.services.id)
          ).length;
          score += matchingServices * 10;

          // Bonus for same author
          if (stack.userId === currentStack.userId) {
            score += 5;
          }

          // Bonus for same category
          const stackCategoryIds = stack.stack_services.map(
            ss => ss.services.categories.id
          );
          const matchingCategories = stackCategoryIds.filter(
            id => categoryIds.includes(id)
          ).length;
          score += matchingCategories * 3;

          return { stack, score };
        });

        // Sort by relevance, then shape each to what the shared viewer reads
        // (`services` + `difficulty`) — the raw row only has `stack_services`,
        // so `stack.services.length` in the viewer used to crash the page.
        return rankedStacks
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map(r => ({
            id: r.stack.id,
            name: r.stack.name,
            description: r.stack.description ?? '',
            services: r.stack.stack_services.map(ss => ss.services),
            difficulty: deriveDifficulty(r.stack.stack_services.length),
          }));
      } catch (error) {
        console.error('Error fetching related stacks:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch related stacks'
        });
      }
    }),

  // Stack-level environment variables (a portable .env for the whole stack).
  getEnvVars: protectedProcedure
    .input(z.object({ stackId: z.string() }))
    .query(async ({ ctx, input }) => {
      const stack = await requireStackOwnerStrict(input.stackId, ctx.userId!, ctx.prisma);
      return parseEnvVars(stack.envVars);
    }),

  setEnvVars: protectedProcedure
    .input(z.object({
      stackId: z.string(),
      envVars: z.array(z.object({
        key: z.string().min(1).max(200),
        value: z.string().max(10000),
        isSecret: z.boolean(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireStackOwnerStrict(input.stackId, ctx.userId!, ctx.prisma);
      // Dedupe by key (last wins), drop blank keys.
      const byKey = new Map<string, StackEnvVar>();
      for (const v of input.envVars) {
        const key = v.key.trim();
        if (key) byKey.set(key, { key, value: v.value, isSecret: v.isSecret });
      }
      const cleaned = [...byKey.values()];
      await ctx.prisma.stacks.update({
        where: { id: input.stackId },
        data: { envVars: JSON.stringify(cleaned), updatedAt: new Date() },
      });
      return cleaned;
    }),
});
