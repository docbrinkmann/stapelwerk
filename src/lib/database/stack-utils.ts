import { PrismaClient } from '@prisma/client'
import type { stacks as Stack, stack_services as StackService, stack_service_configurations as StackServiceConfiguration } from '@prisma/client'
import {
  StackValidationHelpers,
  type StackEnvVar,
  type StackPortMapping,
  type StackVolumeMount,
  type StackDependencies
} from '../validation/stack-schemas'

/**
 * Database utility functions for Stack Builder operations
 * Provides common database operations with proper error handling and type safety
 */

// Stack status enum values (matching validation schemas)
export const StackStatus = {
  DRAFT: 'draft',
  PRIVATE: 'private',
  PUBLIC: 'public',
  PENDING_APPROVAL: 'pending_approval'
} as const

export type StackStatusType = typeof StackStatus[keyof typeof StackStatus]

/**
 * Extended types with parsed JSON fields and relationships
 */
export interface StackWithDetails extends Stack {
  stackServices?: StackServiceWithDetails[]
  _count?: {
    stackServices: number
  }
}

export interface StackServiceWithDetails extends StackService {
  configurations?: StackServiceConfigurationParsed[]
  service?: {
    id: number
    name: string
    slug: string
    description: string
    dockerImage: string
    version: string
    category?: {
      id: number
      name: string
      slug: string
    }
  }
}

export interface StackServiceConfigurationParsed extends Omit<StackServiceConfiguration, 'environmentVariables' | 'portMappings' | 'volumeMounts' | 'dependsOn'> {
  environmentVariables: StackEnvVar
  portMappings: StackPortMapping
  volumeMounts: StackVolumeMount
  dependsOn: StackDependencies
}

/**
 * Stack utility functions
 */
export class StackUtils {
  constructor(private prisma: PrismaClient) {}

  /**
   * Parse configuration JSON fields from a StackServiceConfiguration record
   */
  private parseConfigurationFields(config: StackServiceConfiguration): StackServiceConfigurationParsed {
    return {
      ...config,
      environmentVariables: StackValidationHelpers.parseJsonConfig(config.environmentVariables, {}),
      portMappings: StackValidationHelpers.parseJsonConfig(config.portMappings, {}),
      volumeMounts: StackValidationHelpers.parseJsonConfig(config.volumeMounts, {}),
      dependsOn: StackValidationHelpers.parseJsonConfig(config.dependsOn, [])
    }
  }

  /**
   * Generate unique stack slug with collision handling
   */
  async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = StackValidationHelpers.generateStackSlug(name)
    let slug = baseSlug
    let counter = 1

    while (await this.prisma.stacks.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    return slug
  }

  /**
   * Get stack by ID with full details
   */
  async getStackById(id: string, userId?: string): Promise<StackWithDetails | null> {
    const whereClause: any = { id }
    
    // If userId is provided, only return stacks that are public or owned by the user
    if (userId !== undefined) {
      whereClause.OR = [
        { isPublic: true },
        { userId: userId }
      ]
    }

    const stack = await this.prisma.stacks.findUnique({
      where: whereClause,
      include: {
        stack_services: {
          orderBy: { order: 'asc' },
          include: {
            stack_service_configurations: true,
            services: {
              include: {
                categories: true
              }
            }
          }
        },
        _count: {
          select: { stack_services: true }
        }
      }
    })

    if (!stack) return null

    // Parse configuration JSON fields
    return {
      ...(stack as any),
      stackServices: (stack as any).stack_services.map((stackService: any) => ({
        ...stackService,
        service: stackService.services ? {
          id: stackService.services.id,
          name: stackService.services.name,
          slug: stackService.services.slug,
          description: stackService.services.description,
          dockerImage: stackService.services.dockerImage,
          version: stackService.services.version,
          category: stackService.services.categories ? {
            id: stackService.services.categories.id,
            name: stackService.services.categories.name,
            slug: stackService.services.categories.slug,
          } : undefined,
        } : undefined,
        configurations: (stackService.stack_service_configurations || []).map((config: any) => 
          this.parseConfigurationFields(config)
        )
      })),
      _count: { stackServices: (stack as any)._count?.stack_services ?? 0 },
    }
  }

  /**
   * Get stack by slug with full details
   */
  async getStackBySlug(slug: string, userId?: string): Promise<StackWithDetails | null> {
    const whereClause: any = { slug }
    
    // If userId is provided, only return stacks that are public or owned by the user
    if (userId !== undefined) {
      whereClause.OR = [
        { isPublic: true },
        { userId: userId }
      ]
    }

    const stack = await this.prisma.stacks.findUnique({
      where: whereClause,
      include: {
        stack_services: {
          orderBy: { order: 'asc' },
          include: {
            stack_service_configurations: true,
            services: {
              include: {
                categories: true
              }
            }
          }
        },
        _count: {
          select: { stack_services: true }
        }
      }
    })

    if (!stack) return null

    // Parse configuration JSON fields
    return {
      ...(stack as any),
      stackServices: (stack as any).stack_services.map((stackService: any) => ({
        ...stackService,
        service: stackService.services ? {
          id: stackService.services.id,
          name: stackService.services.name,
          slug: stackService.services.slug,
          description: stackService.services.description,
          dockerImage: stackService.services.dockerImage,
          version: stackService.services.version,
          category: stackService.services.categories ? {
            id: stackService.services.categories.id,
            name: stackService.services.categories.name,
            slug: stackService.services.categories.slug,
          } : undefined,
        } : undefined,
        configurations: (stackService.stack_service_configurations || []).map((config: any) => 
          this.parseConfigurationFields(config)
        )
      })),
      _count: { stackServices: (stack as any)._count?.stack_services ?? 0 },
    }
  }

  /**
   * Get stacks with filtering and pagination
   */
  async getStacks(options: {
    userId?: string
    status?: StackStatusType
    isPublic?: boolean
    isTemplate?: boolean
    search?: string
    cursor?: string
    limit?: number
    includeOwned?: boolean // If true and userId provided, includes user's stacks regardless of public status
  }): Promise<{ stacks: StackWithDetails[], hasMore: boolean, nextCursor?: string }> {
    const {
      userId,
      status,
      isPublic,
      isTemplate,
      search,
      cursor,
      limit = 10,
      includeOwned = false
    } = options

    const where: any = {}

    // Status filter
    if (status) where.status = status
    
    // Template filter
    if (isTemplate !== undefined) where.isTemplate = isTemplate

    // Public/private filtering with user ownership
    if (userId && includeOwned) {
      // Include public stacks OR stacks owned by the user
      where.OR = [
        { isPublic: true },
        { userId: userId }
      ]
      // Apply additional isPublic filter if specified
      if (isPublic !== undefined && isPublic) {
        where.isPublic = true
        delete where.OR // Override OR clause if explicitly requesting public only
      }
    } else if (isPublic !== undefined) {
      where.isPublic = isPublic
    }

    // User filter (exact match)
    if (userId && !includeOwned) {
      where.userId = userId
    }

    // Search filter
    if (search) {
      where.OR = where.OR ? [
        ...where.OR,
        { name: { contains: search } },
        { description: { contains: search } }
      ] : [
        { name: { contains: search } },
        { description: { contains: search } }
      ]
    }

    // Cursor pagination
    if (cursor) {
      where.id = { lt: cursor } // Use 'less than' for descending order
    }

    const stacks = await this.prisma.stacks.findMany({
      where,
      include: {
        stack_services: {
          orderBy: { order: 'asc' },
          include: {
            stack_service_configurations: true,
            services: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                dockerImage: true,
                version: true,
                categories: {
                  select: {
                    id: true,
                    name: true,
                    slug: true
                  }
                }
              }
            }
          }
        },
        _count: {
          select: { stack_services: true }
        }
      },
      orderBy: { createdAt: 'desc' }, // Most recent first
      take: limit + 1 // Take one extra to check if there are more
    })

    const hasMore = stacks.length > limit
    const returnStacks = hasMore ? stacks.slice(0, -1) : stacks
    const nextCursor = hasMore ? returnStacks[returnStacks.length - 1]?.id : undefined

    return {
      stacks: returnStacks.map((stack: any) => ({
        ...stack,
        stackServices: (stack.stack_services || []).map((stackService: any) => ({
          ...stackService,
          service: stackService.services ? {
            id: stackService.services.id,
            name: stackService.services.name,
            slug: stackService.services.slug,
            description: stackService.services.description,
            dockerImage: stackService.services.dockerImage,
            version: stackService.services.version,
            category: stackService.services.categories ? {
              id: stackService.services.categories.id,
              name: stackService.services.categories.name,
              slug: stackService.services.categories.slug,
            } : undefined,
          } : undefined,
          configurations: (stackService.stack_service_configurations || []).map((config: any) => 
            this.parseConfigurationFields(config)
          )
        })),
        _count: { stackServices: stack._count?.stack_services ?? 0 },
      })),
      hasMore,
      nextCursor: hasMore ? (returnStacks[returnStacks.length - 1].id as string) : undefined
    }
  }

  /**
   * Create a new stack
   */
  async createStack(data: {
    name: string
    description?: string
    userId?: string
    isPublic?: boolean
    isTemplate?: boolean
    status?: StackStatusType
  }): Promise<StackWithDetails> {
    const slug = await this.generateUniqueSlug(data.name)

    const stack = await this.prisma.stacks.create({
      data: {
        id: (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string,
        name: data.name,
        description: data.description,
        slug,
        userId: data.userId,
        isPublic: data.isPublic || false,
        isTemplate: data.isTemplate || false,
        status: data.status || StackStatus.DRAFT,
        updatedAt: new Date(),
      },
      include: {
        stack_services: {
          orderBy: { order: 'asc' },
          include: {
            stack_service_configurations: true,
            services: {
              include: {
                categories: true
              }
            }
          }
        },
        _count: {
          select: { stack_services: true }
        }
      }
    })

    return {
      ...(stack as any),
      stackServices: (stack as any).stack_services.map((stackService: any) => ({
        ...stackService,
        service: stackService.services ? {
          id: stackService.services.id,
          name: stackService.services.name,
          slug: stackService.services.slug,
          description: stackService.services.description,
          dockerImage: stackService.services.dockerImage,
          version: stackService.services.version,
          category: stackService.services.categories ? {
            id: stackService.services.categories.id,
            name: stackService.services.categories.name,
            slug: stackService.services.categories.slug,
          } : undefined,
        } : undefined,
        configurations: (stackService.stack_service_configurations || []).map((config: any) => 
          this.parseConfigurationFields(config)
        )
      })),
      _count: { stackServices: (stack as any)._count?.stack_services ?? 0 },
    }
  }

  /**
   * Update an existing stack
   */
  async updateStack(id: string, data: {
    name?: string
    description?: string
    isPublic?: boolean
    isTemplate?: boolean
    status?: StackStatusType
  }, userId?: string): Promise<StackWithDetails> {
    // Check ownership if userId is provided
    if (userId) {
      const existingStack = await this.prisma.stacks.findUnique({
        where: { id },
        select: { userId: true }
      })

      if (!existingStack || existingStack.userId !== userId) {
        throw new Error('Stack not found or access denied')
      }
    }

    const updateData: any = {}
    
    if (data.name !== undefined) {
      updateData.name = data.name
      // Generate new slug if name is changing
      updateData.slug = await this.generateUniqueSlug(data.name)
    }
    
    if (data.description !== undefined) updateData.description = data.description
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic
    if (data.isTemplate !== undefined) updateData.isTemplate = data.isTemplate
    if (data.status !== undefined) updateData.status = data.status

    const stack = await this.prisma.stacks.update({
      where: { id },
      data: { ...updateData, updatedAt: new Date() },
      include: {
        stack_services: {
          orderBy: { order: 'asc' },
          include: {
            stack_service_configurations: true,
            services: {
              include: {
                categories: true
              }
            }
          }
        },
        _count: {
          select: { stack_services: true }
        }
      }
    })

    return {
      ...(stack as any),
      stackServices: (stack as any).stack_services.map((stackService: any) => ({
        ...stackService,
        service: stackService.services ? {
          id: stackService.services.id,
          name: stackService.services.name,
          slug: stackService.services.slug,
          description: stackService.services.description,
          dockerImage: stackService.services.dockerImage,
          version: stackService.services.version,
          category: stackService.services.categories ? {
            id: stackService.services.categories.id,
            name: stackService.services.categories.name,
            slug: stackService.services.categories.slug,
          } : undefined,
        } : undefined,
        configurations: (stackService.stack_service_configurations || []).map((config: any) => 
          this.parseConfigurationFields(config)
        )
      })),
      _count: { stackServices: (stack as any)._count?.stack_services ?? 0 },
    }
  }

  /**
   * Delete a stack and all related data
   */
  async deleteStack(id: string, userId?: string): Promise<void> {
    // Check ownership if userId is provided
    if (userId) {
      const existingStack = await this.prisma.stacks.findUnique({
        where: { id },
        select: { userId: true }
      })

      if (!existingStack || existingStack.userId !== userId) {
        throw new Error('Stack not found or access denied')
      }
    }

    // Delete stack (cascade will handle stackServices and configurations)
    await this.prisma.stacks.delete({
      where: { id }
    })
  }

  /**
   * Add a service to a stack
   */
  async addServiceToStack(data: {
    stackId: string
    serviceId: number
    order?: number
    configuration?: {
      environmentVariables?: StackEnvVar
      portMappings?: StackPortMapping
      volumeMounts?: StackVolumeMount
      dependsOn?: StackDependencies
    }
  }, userId?: string): Promise<StackServiceWithDetails> {
    // Check stack ownership if userId is provided
    if (userId) {
      const stack = await this.prisma.stacks.findUnique({
        where: { id: data.stackId },
        select: { userId: true }
      })

      if (!stack || stack.userId !== userId) {
        throw new Error('Stack not found or access denied')
      }
    }

    // Check if service is already in the stack
    const existingStackService = await this.prisma.stack_services.findUnique({
      where: {
        stackId_serviceId: {
          stackId: data.stackId,
          serviceId: data.serviceId
        }
      }
    })

    if (existingStackService) {
      throw new Error('Service is already in this stack')
    }

    // Determine order if not provided
    let order = data.order
    if (!order) {
      const lastService = await this.prisma.stack_services.findFirst({
        where: { stackId: data.stackId },
        orderBy: { order: 'desc' },
        select: { order: true }
      })
      order = (lastService?.order || 0) + 1
    }

    // Create the stack service
    const stackService = await this.prisma.stack_services.create({
      data: {
        id: (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string,
        stackId: data.stackId,
        serviceId: data.serviceId,
        order
      },
      include: {
        stack_service_configurations: true,
        services: {
          include: {
            categories: true
          }
        }
      }
    })

    // Create configuration if provided
    if (data.configuration) {
      await this.prisma.stack_service_configurations.create({
        data: {
          id: (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string,
          stackServiceId: stackService.id,
          environmentVariables: StackValidationHelpers.stringifyConfig(data.configuration.environmentVariables),
          portMappings: StackValidationHelpers.stringifyConfig(data.configuration.portMappings),
          volumeMounts: StackValidationHelpers.stringifyConfig(data.configuration.volumeMounts),
          dependsOn: StackValidationHelpers.stringifyConfig(data.configuration.dependsOn),
          updatedAt: new Date(),
        }
      })

      // Refetch with configuration
      const stackServiceWithConfig = await this.prisma.stack_services.findUnique({
        where: { id: stackService.id },
        include: {
          stack_service_configurations: true,
          services: {
            include: {
              categories: true
            }
          }
        }
      })

      return {
        ...(stackServiceWithConfig as any)!,
        configurations: (stackServiceWithConfig as any)?.stack_service_configurations?.map((config: any) => 
          this.parseConfigurationFields(config)
        ) || []
      }
    }

    return {
      ...(stackService as any),
      configurations: (stackService as any).stack_service_configurations.map((config: any) => 
        this.parseConfigurationFields(config)
      )
    }
  }

  /**
   * Remove a service from a stack
   */
  async removeServiceFromStack(stackId: string, serviceId: number, userId?: string): Promise<void> {
    // Check stack ownership if userId is provided
    if (userId) {
      const stack = await this.prisma.stacks.findUnique({
        where: { id: stackId },
        select: { userId: true }
      })

      if (!stack || stack.userId !== userId) {
        throw new Error('Stack not found or access denied')
      }
    }

    // Delete the stack service (cascade will handle configurations)
    await this.prisma.stack_services.deleteMany({
      where: {
        stackId,
        serviceId
      }
    })
  }

  /**
   * Update service configuration within a stack
   */
  async updateServiceConfiguration(data: {
    stackId: string
    serviceId: number
    configuration: {
      environmentVariables?: StackEnvVar
      portMappings?: StackPortMapping
      volumeMounts?: StackVolumeMount
      dependsOn?: StackDependencies
    }
  }, userId?: string): Promise<StackServiceConfigurationParsed> {
    // Check stack ownership if userId is provided
    if (userId) {
      const stack = await this.prisma.stacks.findUnique({
        where: { id: data.stackId },
        select: { userId: true }
      })

      if (!stack || stack.userId !== userId) {
        throw new Error('Stack not found or access denied')
      }
    }

    // Find the stack service
    const stackService = await this.prisma.stack_services.findUnique({
      where: {
        stackId_serviceId: {
          stackId: data.stackId,
          serviceId: data.serviceId
        }
      }
    })

    if (!stackService) {
      throw new Error('Service not found in stack')
    }

    // Upsert the configuration
    const config = await this.prisma.stack_service_configurations.upsert({
      where: { stackServiceId: stackService.id },
      update: {
        environmentVariables: data.configuration.environmentVariables !== undefined
          ? StackValidationHelpers.stringifyConfig(data.configuration.environmentVariables)
          : undefined,
        portMappings: data.configuration.portMappings !== undefined
          ? StackValidationHelpers.stringifyConfig(data.configuration.portMappings)
          : undefined,
        volumeMounts: data.configuration.volumeMounts !== undefined
          ? StackValidationHelpers.stringifyConfig(data.configuration.volumeMounts)
          : undefined,
        dependsOn: data.configuration.dependsOn !== undefined
          ? StackValidationHelpers.stringifyConfig(data.configuration.dependsOn)
          : undefined,
        updatedAt: new Date()
      },
      create: {
        id: (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string,
        stackServiceId: stackService.id,
        environmentVariables: StackValidationHelpers.stringifyConfig(data.configuration.environmentVariables),
        portMappings: StackValidationHelpers.stringifyConfig(data.configuration.portMappings),
        volumeMounts: StackValidationHelpers.stringifyConfig(data.configuration.volumeMounts),
        dependsOn: StackValidationHelpers.stringifyConfig(data.configuration.dependsOn),
        updatedAt: new Date(),
      }
    })

    return this.parseConfigurationFields(config)
  }

  /**
   * Get public stack templates for community sharing
   */
  async getPublicTemplates(options: {
    category?: string
    cursor?: string
    limit?: number
  }): Promise<{ stacks: StackWithDetails[], hasMore: boolean, nextCursor?: string }> {
    const { category, cursor, limit = 10 } = options

    const where: any = {
      isPublic: true,
      isTemplate: true,
      status: StackStatus.PUBLIC
    }

    // Category filter (if services in stack match category)
    if (category) {
      where.stack_services = {
        some: {
          services: {
            categories: {
              slug: category
            }
          }
        }
      }
    }

    // Cursor pagination
    if (cursor) {
      where.id = { lt: cursor }
    }

    const stacks = await this.prisma.stacks.findMany({
      where,
      include: {
        stack_services: {
          orderBy: { order: 'asc' },
          include: {
            stack_service_configurations: true,
            services: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                dockerImage: true,
                version: true,
                categories: {
                  select: {
                    id: true,
                    name: true,
                    slug: true
                  }
                }
              }
            }
          }
        },
        _count: {
          select: { stack_services: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1
    })

    const hasMore = stacks.length > limit
    const returnStacks = hasMore ? stacks.slice(0, -1) : stacks
    const nextCursor = hasMore ? returnStacks[returnStacks.length - 1]?.id : undefined

    return {
      stacks: returnStacks.map((stack: any) => ({
        ...stack,
        stackServices: (stack.stack_services || []).map((stackService: any) => ({
          ...stackService,
          configurations: (stackService.stack_service_configurations || []).map((config: any) => 
            this.parseConfigurationFields(config)
          )
        })),
        _count: { stackServices: stack._count?.stack_services ?? 0 },
      })),
      hasMore,
      nextCursor
    }
  }

  /**
   * Submit stack for public template approval
   */
  async submitForApproval(stackId: string, userId?: string): Promise<StackWithDetails> {
    // Check ownership if userId is provided
    if (userId) {
      const existingStack = await this.prisma.stacks.findUnique({
        where: { id: stackId },
        select: { userId: true, status: true, isPublic: true }
      })

      if (!existingStack || existingStack.userId !== userId) {
        throw new Error('Stack not found or access denied')
      }

      if (existingStack.status === StackStatus.PUBLIC || existingStack.status === StackStatus.PENDING_APPROVAL) {
        throw new Error('Stack is already public or pending approval')
      }
    }

    return this.updateStack(stackId, {
      status: StackStatus.PENDING_APPROVAL,
      isTemplate: true
    }, userId)
  }
}

/**
 * Main stack database utilities class
 */
export class StackBuilderDb {
  public stacks: StackUtils

  constructor(private prisma: PrismaClient) {
    this.stacks = new StackUtils(prisma)
  }

  /**
   * Get database health status including stack counts
   */
  async health(): Promise<{ status: 'healthy' | 'unhealthy', details: any }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      const stacksCount = await this.prisma.stacks.count()
      const stackServicesCount = await this.prisma.stack_services.count()
      const stackConfigsCount = await this.prisma.stack_service_configurations.count()

      return {
        status: 'healthy',
        details: {
          stacks: stacksCount,
          stackServices: stackServicesCount,
          stackConfigurations: stackConfigsCount,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      }
    }
  }

  /**
   * Clean up test stack data (useful for testing)
   */
  async cleanupTestStackData(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanupTestStackData can only be used in test environment')
    }

    await this.prisma.stack_service_configurations.deleteMany()
    await this.prisma.stack_services.deleteMany()
    await this.prisma.stacks.deleteMany()
  }
}

/**
 * Create a new instance of StackBuilderDb
 */
export function createStackBuilderDb(prisma: PrismaClient): StackBuilderDb {
  return new StackBuilderDb(prisma)
}