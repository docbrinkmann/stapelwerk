import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { 
  UseCaseTemplate, 
  CreateTemplateInput, 
  UpdateTemplateInput, 
  TemplateFilters, 
  TemplateSearchOptions, 
  ApplyTemplateResult, 
  TemplateStats, 
  TemplateValidationResult, 
  RateTemplateInput,
  TemplateMetadata,
  VersionChanges,
  TemplateCategory,
  TemplateDifficulty
} from '@/types/templates'

export class TemplateEngine {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Get template by ID with full details
   */
  async getTemplateById(id: string): Promise<UseCaseTemplate | null> {
const template = await this.prisma.use_case_templates.findUnique({
      where: { id },
      include: { services: true }
    })

    if (!template) return null

    return this.formatTemplate(template)
  }

  /**
   * Get all templates with optional filtering
   */
  async getAllTemplates(filters: TemplateFilters = {}): Promise<UseCaseTemplate[]> {
    const where: any = {}

    if (filters.category) where.category = filters.category
    if (filters.difficulty) where.difficulty = filters.difficulty
    if (filters.featured !== undefined) where.featured = filters.featured
    if (!filters.includeInactive) where.isActive = true
    if (filters.minUsageCount) where.usageCount = { gte: filters.minUsageCount }
    if (filters.createdBy) where.createdBy = filters.createdBy

    if (filters.dateRange) {
      where.createdAt = {
        gte: filters.dateRange.from,
        lte: filters.dateRange.to
      }
    }

const templates = await this.prisma.use_case_templates.findMany({
      where,
      include: { services: true },
      orderBy: [
        { featured: 'desc' },
        { usageCount: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return templates.map(this.formatTemplate)
  }

  /**
   * Create a new template
   */
  async createTemplate(data: CreateTemplateInput): Promise<UseCaseTemplate> {
    const id = data.id || this.generateTemplateId(data.name)

const template = await this.prisma.use_case_templates.create({
      data: {
        id,
        name: data.name,
        description: data.description,
        category: data.category,
        difficulty: data.difficulty,
        estimatedSetupTime: data.estimatedSetupTime,
        serviceIds: JSON.stringify(data.serviceIds),
        metadata: data.metadata ? JSON.stringify(data.metadata) : '{}',
        version: '1.0.0',
        isActive: true,
        featured: data.featured || false,
        usageCount: 0,
        createdBy: data.createdBy,
        updatedAt: new Date()
      }
    })

    return this.formatTemplate(template)
  }

  /**
   * Update an existing template
   */
  async updateTemplate(id: string, data: UpdateTemplateInput): Promise<UseCaseTemplate> {
const existing = await this.prisma.use_case_templates.findUnique({
      where: { id }
    })

    if (!existing) {
      throw new Error('Template not found')
    }

    // Calculate new version
    const newVersion = this.incrementVersion(existing.version, data.breakingChange)

    // Create version history entry with detailed changes
    await this.createVersionHistory(id, existing.version, newVersion, {
      serviceIds: data.serviceIds || JSON.parse(existing.serviceIds || '[]'),
      changes: this.generateChanges(existing, data)
    })

    const updateData: any = {
      updatedAt: new Date()
    }

    if (data.name) updateData.name = data.name
    if (data.description) updateData.description = data.description
    if (data.category) updateData.category = data.category
    if (data.difficulty) updateData.difficulty = data.difficulty
    if (data.estimatedSetupTime) updateData.estimatedSetupTime = data.estimatedSetupTime
    if (data.serviceIds) updateData.serviceIds = JSON.stringify(data.serviceIds)
    if (data.metadata) updateData.metadata = JSON.stringify(data.metadata)
    if (data.featured !== undefined) updateData.featured = data.featured
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    updateData.version = newVersion

const template = await this.prisma.use_case_templates.update({
      where: { id },
      data: updateData
    })

    return this.formatTemplate(template)
  }

  /**
   * Apply template to a stack
   */
  async applyTemplateToStack(
    templateId: string, 
    stackId: string, 
    userId?: string
  ): Promise<ApplyTemplateResult> {
const template = await this.prisma.use_case_templates.findUnique({
      where: { id: templateId },
      include: { services: true }
    })

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
        servicesAdded: 0
      }
    }

    if (!template.isActive) {
      return {
        success: false,
        error: 'Template is not active',
        servicesAdded: 0
      }
    }

    // Curated per-member config baked into the template metadata (VPN routing,
    // shared /data mount) so an applied template ships CORRECT out of the box.
    type MemberConfig = {
      networkMode?: string
      volumeMounts?: Array<{ hostPath: string; containerPath: string; readOnly?: boolean }>
      portMappings?: Array<{ containerPort: number; hostPort: number }>
      environmentVariables?: Record<string, string>
    }
    let templateServiceConfigs: Record<string, MemberConfig> = {}
    try {
      const meta = template.metadata ? JSON.parse(template.metadata) : {}
      if (meta && typeof meta.serviceConfigs === 'object' && meta.serviceConfigs) {
        templateServiceConfigs = meta.serviceConfigs as Record<string, MemberConfig>
      }
    } catch {
      // Malformed metadata → apply plain defaults (no curated wiring).
    }

    // The target stack must exist and be writable by the caller. Mirrors the
    // ownership rule in stacks.ts (`validateStackOwnership`): owner, or a
    // published public stack.
    const stack = await this.prisma.stacks.findUnique({
      where: { id: stackId },
      select: { id: true, userId: true, isPublic: true, status: true }
    })

    if (!stack) {
      return { success: false, error: 'Stack not found', servicesAdded: 0 }
    }

    if (userId && stack.userId !== userId && !(stack.isPublic && stack.status === 'public')) {
      return { success: false, error: 'Access denied', servicesAdded: 0 }
    }

    const serviceIds = JSON.parse(template.serviceIds) as number[]
const servicesRaw = await this.prisma.services.findMany({
      where: { id: { in: serviceIds } },
      include: { categories: true }
    })

    // Preserve the template's declared service order.
    const orderedRaw = serviceIds
      .map(id => servicesRaw.find((s: any) => s.id === id))
      .filter((s: any): s is any => Boolean(s))

    // Normalize service shape to ServiceWithDetails
    const services = orderedRaw.map((s: any) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      dockerImage: s.dockerImage,
      version: s.version,
      categoryId: s.categoryId,
      ports: s.ports,
      environmentVariables: s.environmentVariables,
      resourceRequirements: s.resourceRequirements,
      compatibilityInfo: s.compatibilityInfo,
      documentationUrl: s.documentationUrl ?? undefined,
      featured: s.featured,
      status: s.status,
      category: s.categories ? { name: s.categories.name, slug: s.categories.slug } : undefined,
    }))

    // Only add services not already in the stack (the stack_services unique
    // constraint is [stackId, serviceId]) so applying a template is idempotent.
    const existing = await this.prisma.stack_services.findMany({
      where: { stackId, serviceId: { in: serviceIds } },
      select: { serviceId: true }
    })
    const existingIds = new Set(existing.map((e: { serviceId: number }) => e.serviceId))
    const toAdd = orderedRaw.filter((s: any) => !existingIds.has(s.id))

    // Populate the stack. This reuses the exact write shape of stacks.ts
    // `addService`: a `stack_services` row plus a default
    // `stack_service_configurations` row, with `order` continuing after the
    // current max — so template-applied services behave identically to
    // manually-added ones.
    const servicesAdded = await this.prisma.$transaction(async (tx: any) => {
      const maxOrder = await tx.stack_services.aggregate({
        where: { stackId },
        _max: { order: true }
      })
      let order = (maxOrder._max.order || 0) + 1

      for (const svc of toAdd) {
        const stackService = await tx.stack_services.create({
          data: {
            id: randomUUID(),
            stackId,
            serviceId: svc.id,
            order: order++
          }
        })

        const cfg = templateServiceConfigs[svc.slug] ?? {}
        // Both persist in the record shape the API/DB use:
        // volumeMounts { containerPath: hostPath }, portMappings { containerPort: hostPort }.
        const volumeMountsRecord = Array.isArray(cfg.volumeMounts)
          ? Object.fromEntries(cfg.volumeMounts.map(v => [v.containerPath, v.hostPath]))
          : {}
        const portMappingsRecord = Array.isArray(cfg.portMappings)
          ? Object.fromEntries(cfg.portMappings.map(p => [String(p.containerPort), String(p.hostPort)]))
          : {}
        await tx.stack_service_configurations.create({
          data: {
            id: randomUUID(),
            stackServiceId: stackService.id,
            environmentVariables: JSON.stringify(cfg.environmentVariables ?? {}),
            portMappings: JSON.stringify(portMappingsRecord),
            volumeMounts: JSON.stringify(volumeMountsRecord),
            dependsOn: '[]',
            networkMode: cfg.networkMode ?? null,
            updatedAt: new Date()
          }
        })
      }

      return toAdd.length
    })

    // Record template usage
await this.prisma.template_usage.create({
      data: {
        id: randomUUID(),
        templateId,
        stackId,
        userId,
        servicesAdded
      }
    })

    // Increment template usage count
await this.prisma.use_case_templates.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } }
    })

    return {
      success: true,
      servicesAdded,
      services,
      templateId,
      stackId
    }
  }

  /**
   * Get template usage statistics
   */
  async getTemplateUsageStats(templateId: string): Promise<TemplateStats> {
    const [usageCount, ratings, recentUsage, successfulDeployments] = await Promise.all([
this.prisma.template_usage.count({
        where: { templateId }
      }),
this.prisma.template_ratings.aggregate({
        where: { templateId },
        _avg: { rating: true },
        _count: { rating: true }
      }),
this.prisma.template_usage.findFirst({
        where: { templateId },
        orderBy: { createdAt: 'desc' }
      }),
this.prisma.template_usage.count({
        where: { 
          templateId,
          successful: true
        }
      })
    ])

    // Calculate popularity trend
    const trend = await this.calculatePopularityTrend(templateId)

    return {
      templateId,
      usageCount,
      averageRating: ratings._avg.rating || 0,
      ratingCount: ratings._count.rating || 0,
      successfulDeployments,
      failedDeployments: usageCount - successfulDeployments,
      lastUsed: recentUsage?.createdAt,
      popularityTrend: trend
    }
  }

  /**
   * Rate a template
   */
  async rateTemplate(data: RateTemplateInput): Promise<any> {
    if (data.rating < 1 || data.rating > 5) {
      throw new Error('Rating must be between 1 and 5')
    }

return await this.prisma.template_ratings.create({
      data: {
        id: randomUUID(),
        ...data,
        updatedAt: new Date()
      }
    })
  }

  /**
   * Search templates by query
   */
  async searchTemplates(
    query: string, 
    options: TemplateSearchOptions = {}
  ): Promise<UseCaseTemplate[]> {
    const where: any = {
      AND: [
        { isActive: true },
        {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        }
      ]
    }

    if (options.category) where.AND.push({ category: options.category })
    if (options.difficulty) where.AND.push({ difficulty: options.difficulty })

    const orderBy: any[] = [
      { featured: 'desc' },
      { usageCount: 'desc' }
    ]

    if (options.sortBy) {
      const sortOrder = options.sortOrder || 'desc'
      switch (options.sortBy) {
        case 'newest':
          orderBy.unshift({ createdAt: sortOrder })
          break
        case 'name':
          orderBy.unshift({ name: sortOrder })
          break
        case 'popularity':
          orderBy.unshift({ usageCount: sortOrder })
          break
        // rating and usage are handled by default ordering
      }
    }

const templates = await this.prisma.use_case_templates.findMany({
      where,
      include: { services: true },
      skip: options.offset || 0,
      take: options.limit || 20,
      orderBy
    })

    return templates.map(this.formatTemplate)
  }

  /**
   * Validate template data
   */
  async validateTemplate(data: Partial<CreateTemplateInput>): Promise<TemplateValidationResult> {
    const errors: string[] = []

    // Required fields validation
    if (!data.name || data.name.trim() === '') {
      errors.push('Template name is required')
    }

    if (!data.description || data.description.trim() === '') {
      errors.push('Template description is required')
    }

    if (!data.serviceIds || data.serviceIds.length === 0) {
      errors.push('Template must include at least one service')
    }

    // Service validation
    if (data.serviceIds && data.serviceIds.length > 0) {
const services = await this.prisma.services.findMany({
        where: { 
          id: { in: data.serviceIds },
          status: 'approved'
        }
      })

      const foundServiceIds = services.map(s => s.id)
      const missingServices = data.serviceIds.filter(id => !foundServiceIds.includes(id))

      for (const missingId of missingServices) {
        errors.push(`Service with ID ${missingId} not found or not approved`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Get all versions of a template
   */
  async getTemplateVersions(templateId: string): Promise<any[]> {
return await this.prisma.template_versions.findMany({
      where: { templateId },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * Get specific template version
   */
  async getTemplateVersion(templateId: string, version: string): Promise<any | null> {
return await this.prisma.template_versions.findFirst({
      where: { templateId, version }
    })
  }

  /**
   * Rollback template to a previous version
   */
  async rollbackTemplate(templateId: string, targetVersion: string, createdBy?: string): Promise<UseCaseTemplate> {
    const targetVersionData = await this.getTemplateVersion(templateId, targetVersion)
    if (!targetVersionData) {
      throw new Error(`Version ${targetVersion} not found for template ${templateId}`)
    }

const currentTemplate = await this.prisma.use_case_templates.findUnique({
      where: { id: templateId }
    })

    if (!currentTemplate) {
      throw new Error('Template not found')
    }

    // Create rollback version entry
    const rollbackVersion = this.incrementVersion(currentTemplate.version, true)
    
    await this.createVersionHistory(templateId, currentTemplate.version, rollbackVersion, {
      serviceIds: JSON.parse(targetVersionData.serviceIds),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      changes: ({
        type: 'major',
        summary: `Rolled back to version ${targetVersion}`,
        rollbackTo: targetVersion,
        rollbackReason: 'Manual rollback operation'
      } as any)
    })

    // Update template with target version data
const updatedTemplate = await this.prisma.use_case_templates.update({
      where: { id: templateId },
      data: {
        version: rollbackVersion,
        serviceIds: targetVersionData.serviceIds,
        metadata: targetVersionData.metadata || currentTemplate.metadata,
        updatedAt: new Date()
      }
    })

    return this.formatTemplate(updatedTemplate)
  }

  /**
   * Compare two template versions
   */
  async compareVersions(templateId: string, version1: string, version2: string): Promise<any> {
    const [v1, v2] = await Promise.all([
      this.getTemplateVersion(templateId, version1),
      this.getTemplateVersion(templateId, version2)
    ])

    if (!v1 || !v2) {
      throw new Error('One or both versions not found')
    }

    const services1 = JSON.parse(v1.serviceIds || '[]')
    const services2 = JSON.parse(v2.serviceIds || '[]')
    
    return {
      version1,
      version2,
      serviceChanges: {
        added: services2.filter((id: number) => !services1.includes(id)),
        removed: services1.filter((id: number) => !services2.includes(id)),
        unchanged: services1.filter((id: number) => services2.includes(id))
      },
      metadataChanged: v1.metadata !== v2.metadata,
      changes1: v1.changes ? JSON.parse(v1.changes) : null,
      changes2: v2.changes ? JSON.parse(v2.changes) : null
    }
  }

  /**
   * Create a template fork/copy with new version lineage
   */
  async forkTemplate(
    sourceTemplateId: string, 
    newName: string, 
    newId?: string, 
    createdBy?: string
  ): Promise<UseCaseTemplate> {
    const sourceTemplate = await this.getTemplateById(sourceTemplateId)
    if (!sourceTemplate) {
      throw new Error('Source template not found')
    }

    const forkId = newId || this.generateTemplateId(newName)
    
    const forkData: CreateTemplateInput = {
      id: forkId,
      name: newName,
      description: `Fork of ${sourceTemplate.name}: ${sourceTemplate.description}`,
      category: sourceTemplate.category,
      difficulty: sourceTemplate.difficulty,
      estimatedSetupTime: sourceTemplate.estimatedSetupTime,
      serviceIds: sourceTemplate.serviceIds,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: ({
        ...sourceTemplate.metadata,
        forkedFrom: sourceTemplateId,
        forkedFromVersion: sourceTemplate.version,
        forkDate: new Date().toISOString()
      } as any),
      createdBy,
      featured: false
    }

    return await this.createTemplate(forkData)
  }

  /**
   * Generate migration plan between versions
   */
  async generateMigrationPlan(templateId: string, fromVersion: string, toVersion: string): Promise<any> {
    const comparison = await this.compareVersions(templateId, fromVersion, toVersion)
    
    const migrationSteps = []
    
    // Add steps for removed services
    for (const serviceId of comparison.serviceChanges.removed) {
const service = await this.prisma.services.findUnique({ where: { id: serviceId } })
      migrationSteps.push({
        type: 'remove_service',
        serviceId,
        serviceName: service?.name || 'Unknown Service',
        description: `Remove ${service?.name || 'service'} from stack`,
        required: true,
        impact: 'high'
      })
    }

    // Add steps for new services
    for (const serviceId of comparison.serviceChanges.added) {
const service = await this.prisma.services.findUnique({ where: { id: serviceId } })
      migrationSteps.push({
        type: 'add_service',
        serviceId,
        serviceName: service?.name || 'Unknown Service',
        description: `Add ${service?.name || 'service'} to stack`,
        required: true,
        impact: 'medium'
      })
    }

    // Add metadata update step if needed
    if (comparison.metadataChanged) {
      migrationSteps.push({
        type: 'update_metadata',
        description: 'Update template metadata and configuration',
        required: false,
        impact: 'low'
      })
    }

    return {
      fromVersion,
      toVersion,
      templateId,
      steps: migrationSteps,
      automatic: migrationSteps.every(step => step.impact !== 'high'),
      estimatedTime: this.estimateMigrationTime(migrationSteps),
      breakingChanges: migrationSteps.filter(step => step.impact === 'high').length
    }
  }

  /**
   * Apply migration plan
   */
  async applyMigration(templateId: string, stackId: string, migrationPlan: any): Promise<any> {
    const results = []
    
    for (const step of migrationPlan.steps) {
      try {
        switch (step.type) {
          case 'add_service':
            // This would integrate with stack management to add the service
            results.push({
              step: step.type,
              serviceId: step.serviceId,
              success: true,
              message: `Added ${step.serviceName}`
            })
            break
            
          case 'remove_service':
            // This would integrate with stack management to remove the service
            results.push({
              step: step.type,
              serviceId: step.serviceId,
              success: true,
              message: `Removed ${step.serviceName}`
            })
            break
            
          case 'update_metadata':
            // Update any configuration or metadata
            results.push({
              step: step.type,
              success: true,
              message: 'Updated template metadata'
            })
            break
        }
      } catch (error: any) {
        results.push({
          step: step.type,
          success: false,
          error: error.message
        })
      }
    }
    
    return {
      success: results.every(r => r.success),
      results,
      completedSteps: results.filter(r => r.success).length,
      totalSteps: results.length
    }
  }

  /**
   * Get template changelog/history
   */
  async getTemplateHistory(templateId: string, limit?: number): Promise<any[]> {
const versions = await this.prisma.template_versions.findMany({
      where: { templateId },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return versions.map(version => ({
      ...version,
      changes: version.changes ? JSON.parse(version.changes) : null,
      serviceIds: JSON.parse(version.serviceIds || '[]')
    }))
  }

  /**
   * Check for template updates (for templates based on community templates)
   */
  async checkForUpdates(templateId: string): Promise<any> {
    const template = await this.getTemplateById(templateId)
    if (!template || !template.metadata?.forkedFrom) {
      return { hasUpdates: false, message: 'Template is not based on another template' }
    }

    const sourceTemplate = await this.getTemplateById(template.metadata.forkedFrom)
    if (!sourceTemplate) {
      return { hasUpdates: false, message: 'Source template no longer exists' }
    }

    const forkedVersion = template.metadata.forkedFromVersion || '1.0.0'
    const currentSourceVersion = sourceTemplate.version

    if (this.compareVersionNumbers(currentSourceVersion, forkedVersion) > 0) {
      return {
        hasUpdates: true,
        sourceVersion: currentSourceVersion,
        forkedVersion,
        sourceTemplate: sourceTemplate.name,
        updateAvailable: true
      }
    }

    return {
      hasUpdates: false,
      message: 'Template is up to date with source'
    }
  }

  /**
   * Calculate popularity trend for a template
   */
  private async calculatePopularityTrend(templateId: string): Promise<'rising' | 'stable' | 'declining'> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    const [recentUsage, olderUsage] = await Promise.all([
      this.prisma.template_usage.count({
        where: {
          templateId,
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      this.prisma.template_usage.count({
        where: {
          templateId,
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
        }
      })
    ])

    if (recentUsage > olderUsage * 1.2) return 'rising'
    if (recentUsage < olderUsage * 0.8) return 'declining'
    return 'stable'
  }

  /**
   * Get trending templates based on recent activity
   */
  async getTrendingTemplates(limit: number = 10): Promise<UseCaseTemplate[]> {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Get templates with recent usage
const recentlyUsedTemplates = await this.prisma.template_usage.groupBy({
      by: ['templateId'],
      _count: { templateId: true },
      where: {
        createdAt: { gte: sevenDaysAgo }
      },
      orderBy: {
        _count: { templateId: 'desc' }
      },
      take: limit * 2 // Get more to filter later
    })

    const templateIds = recentlyUsedTemplates.map(t => t.templateId)
const templates = await this.prisma.use_case_templates.findMany({
      where: {
        id: { in: templateIds },
        isActive: true
      },
      include: { services: true }
    })

    // Sort by recent usage count and format
      return recentlyUsedTemplates
        .map(usage => {
          const template = templates.find(t => t.id === usage.templateId)
          return template ? this.formatTemplate(template) : null
        })
        .filter((t): t is UseCaseTemplate => Boolean(t))
        .slice(0, limit)
  }

  /**
   * Get top rated templates
   */
  async getTopRatedTemplates(limit: number = 10, minRatings: number = 3): Promise<any[]> {
const topRated = await this.prisma.template_ratings.groupBy({
      by: ['templateId'],
      _avg: { rating: true },
      _count: { rating: true },
      having: {
        rating: {
          _count: { gte: minRatings }
        }
      },
      orderBy: {
        _avg: { rating: 'desc' }
      },
      take: limit
    })

    const templateIds = topRated.map(t => t.templateId)
const templates = await this.prisma.use_case_templates.findMany({
      where: {
        id: { in: templateIds },
        isActive: true
      },
      include: { services: true }
    })

    return topRated.map(rating => {
      const template = templates.find(t => t.id === rating.templateId)
      if (!template) return null

      return {
        template: this.formatTemplate(template),
        averageRating: rating._avg.rating,
        ratingCount: rating._count.rating
      }
    }).filter(Boolean)
  }

  /**
   * Get community insights for templates
   */
  async getCommunityInsights(): Promise<any> {
    const [totalTemplates, totalUsage, totalRatings, avgRating, categoryStats] = await Promise.all([
      this.prisma.use_case_templates.count({ where: { isActive: true } }),
      this.prisma.template_usage.count(),
      this.prisma.template_ratings.count(),
      this.prisma.template_ratings.aggregate({ _avg: { rating: true } }),
      this.prisma.use_case_templates.groupBy({
        by: ['category'],
        _count: { category: true },
        where: { isActive: true },
        orderBy: { _count: { category: 'desc' } }
      })
    ])

    // Get most active users
    const topContributors = await this.prisma.use_case_templates.groupBy({
      by: ['createdBy'],
      _count: { createdBy: true },
      where: {
        isActive: true,
        createdBy: { not: null }
      },
      orderBy: { _count: { createdBy: 'desc' } },
      take: 5
    })

    return {
      overview: {
        totalTemplates,
        totalUsage,
        totalRatings,
        averageRating: avgRating._avg.rating || 0
      },
      categories: categoryStats,
      topContributors: topContributors.filter(c => c.createdBy)
    }
  }

  /**
   * Advanced rating with helpful votes
   */
  async rateTemplateAdvanced(data: RateTemplateInput & { helpful?: boolean }): Promise<any> {
    // Check if user has already rated this template
const existingRating = await this.prisma.template_ratings.findFirst({
      where: {
        templateId: data.templateId,
        userId: data.userId
      }
    })

    if (existingRating) {
      // Update existing rating
return await this.prisma.template_ratings.update({
        where: { id: existingRating.id },
        data: {
          rating: data.rating,
          comment: data.comment,
          updatedAt: new Date()
        }
      })
    } else {
      // Create new rating
      return await this.prisma.template_ratings.create({
        data: {
          id: randomUUID(),
          templateId: data.templateId,
          userId: data.userId,
          rating: data.rating,
          comment: data.comment,
          helpful: 0, // Initialize helpful count
          updatedAt: new Date(),
        }
      })
    }
  }

  /**
   * Mark rating as helpful
   */
  async markRatingHelpful(ratingId: string, userId: string): Promise<any> {
    // Check if user has already marked this rating as helpful
    // In a full implementation, you'd have a separate table for this
    
const rating = await this.prisma.template_ratings.findUnique({
      where: { id: ratingId }
    })

    if (!rating) {
      throw new Error('Rating not found')
    }

    // For now, just increment the helpful count
return await this.prisma.template_ratings.update({
      where: { id: ratingId },
      data: { helpful: { increment: 1 } }
    })
  }

  /**
   * Get detailed rating analysis for a template
   */
  async getTemplateRatingAnalysis(templateId: string): Promise<any> {
const [ratings, ratingDistribution] = await Promise.all([
      this.prisma.template_ratings.findMany({
        where: { templateId },
        orderBy: [{ helpful: 'desc' }, { createdAt: 'desc' }],
        take: 10 // Get top 10 most helpful ratings
      }),
this.prisma.template_ratings.groupBy({
        by: ['rating'],
        _count: { rating: true },
        where: { templateId }
      })
    ])

    // Calculate rating distribution
    const distribution = [1, 2, 3, 4, 5].map(star => {
      const found = ratingDistribution.find(d => d.rating === star)
      return {
        stars: star,
        count: found?._count.rating || 0
      }
    })

    return {
      recentRatings: ratings,
      ratingDistribution: distribution,
      totalRatings: ratings.length
    }
  }

  /**
   * Get personalized template recommendations based on user activity
   */
  async getPersonalizedRecommendations(userId: string, limit: number = 5): Promise<any[]> {
    // Get user's template usage history (templateIds only)
    const userTemplateUsage = await this.prisma.template_usage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { templateId: true },
    })

    if (userTemplateUsage.length === 0) {
      // If no usage history, return popular templates
      return await this.getTrendingTemplates(limit)
    }

    const usedIds = userTemplateUsage.map(u => u.templateId)

    // Load used templates to infer preferences
    const usedTemplates = await this.prisma.use_case_templates.findMany({
      where: { id: { in: usedIds } },
      select: { id: true, category: true, difficulty: true },
    })

    // Extract categories and difficulty levels the user prefers
    const userCategories = [...new Set(usedTemplates.map(u => u.category).filter(Boolean))] as string[]
    const userDifficulties = [...new Set(usedTemplates.map(u => u.difficulty).filter(Boolean))] as string[]

    // Find similar templates
    const recommendations = await this.prisma.use_case_templates.findMany({
      where: {
        isActive: true,
        id: { notIn: usedIds }, // Exclude already used templates
        OR: [
          { category: { in: userCategories as any } },
          { difficulty: { in: userDifficulties as any } }
        ]
      },
      include: { services: true },
      orderBy: [{ featured: 'desc' }, { usageCount: 'desc' }],
      take: limit
    })

    return recommendations.map(template => ({
      template: this.formatTemplate(template),
      reason: this.generateRecommendationReason(template, userCategories, userDifficulties)
    }))
  }

  /**
   * Generate recommendation reason
   */
  private generateRecommendationReason(template: any, userCategories: string[], userDifficulties: string[]): string {
    const reasons = []
    
    if (userCategories.includes(template.category)) {
      reasons.push(`matches your interest in ${template.category}`)
    }
    
    if (userDifficulties.includes(template.difficulty)) {
      reasons.push(`fits your ${template.difficulty} skill level`)
    }
    
    if (template.featured) {
      reasons.push('featured template')
    }
    
    if (template.usageCount > 100) {
      reasons.push('popular in the community')
    }
    
    return reasons.length > 0 ? `Recommended because it ${reasons.join(' and ')}` : 'Matches your profile'
  }

  /**
   * Initialize curated templates
   */
  async initializeCuratedTemplates(): Promise<void> {
    const curatedTemplates = this.getCuratedTemplates()
    
    for (const template of curatedTemplates) {
      const existing = await this.prisma.use_case_templates.findUnique({
        where: { id: template.id }
      })

      if (!existing) {
        await this.createTemplate(template)
        console.log(`Created curated template: ${template.name}`)
      }
    }
  }

  /**
   * Get predefined curated templates
   */
  private getCuratedTemplates(): CreateTemplateInput[] {
    return [
      // Media Server Stack
      {
        id: 'tpl-media-server-complete',
        name: 'Complete Media Server Stack',
        description: 'Full-featured media server with management tools, request system, and monitoring. Perfect for home media streaming with automated content acquisition.',
        category: 'media',
        difficulty: 'intermediate',
        estimatedSetupTime: '45 minutes',
        serviceIds: [1, 2, 3, 4], // Plex, Tautulli, Overseerr, Jackett
        featured: true,
        metadata: {
          requiredResources: {
            ram: '4GB',
            storage: '1TB',
            network: 'High-speed internet recommended'
          },
          tags: ['media', 'streaming', 'plex', 'entertainment', 'automated'],
          prerequisites: [
            'Domain name for external access (optional)',
            'Port forwarding configured for remote access',
            'Media storage location prepared'
          ],
          postSetupSteps: [
            'Configure Plex libraries and scan media',
            'Set up Overseerr for content requests',
            'Configure Jackett indexers for content discovery',
            'Set up Tautulli monitoring and notifications'
          ],
          compatiblePlatforms: ['linux', 'windows', 'macos'],
          networkRequirements: {
            ports: [32400, 8096, 5055, 9117],
            domainRequired: false,
            sslRequired: false
          },
          supportStatus: 'active'
        }
      },

      // Development Environment
      {
        id: 'tpl-web-dev-full-stack',
        name: 'Full-Stack Web Development Environment',
        description: 'Complete development environment with database, cache, web server, and development tools. Ideal for modern web application development.',
        category: 'development',
        difficulty: 'intermediate',
        estimatedSetupTime: '30 minutes',
        serviceIds: [5, 6, 7, 8, 9], // PostgreSQL, Redis, Nginx, pgAdmin, Redis Commander
        featured: true,
        metadata: {
          requiredResources: {
            ram: '3GB',
            storage: '20GB',
            cpu: '2 cores recommended'
          },
          tags: ['development', 'web', 'database', 'cache', 'postgres', 'redis'],
          prerequisites: [
            'Basic understanding of web development',
            'Familiarity with databases and caching'
          ],
          postSetupSteps: [
            'Create your application database in PostgreSQL',
            'Configure Redis for session storage or caching',
            'Set up Nginx reverse proxy for your applications',
            'Connect to databases using admin tools'
          ],
          compatiblePlatforms: ['linux', 'windows', 'macos'],
          networkRequirements: {
            ports: [5432, 6379, 80, 443, 5050, 8081],
            domainRequired: false,
            sslRequired: false
          },
          supportStatus: 'active'
        }
      },

      // Business Applications
      {
        id: 'tpl-business-productivity',
        name: 'Business Productivity Suite',
        description: 'Essential business applications including document management, project management, and team collaboration tools.',
        category: 'business',
        difficulty: 'beginner',
        estimatedSetupTime: '25 minutes',
        serviceIds: [10, 11, 12, 13], // NextCloud, Bookstack, Kanboard, Mattermost
        featured: true,
        metadata: {
          requiredResources: {
            ram: '2GB',
            storage: '100GB',
            network: 'Stable internet connection'
          },
          tags: ['business', 'productivity', 'collaboration', 'documents', 'chat'],
          prerequisites: [
            'SSL certificate for secure access (recommended)',
            'Domain name for professional setup'
          ],
          postSetupSteps: [
            'Create user accounts for team members',
            'Configure NextCloud for file sharing',
            'Set up Bookstack for documentation',
            'Initialize Kanboard for project management'
          ],
          compatiblePlatforms: ['linux'],
          networkRequirements: {
            ports: [80, 443, 8080, 8000],
            domainRequired: true,
            sslRequired: true
          },
          supportStatus: 'active'
        }
      },

      // Monitoring Stack
      {
        id: 'tpl-monitoring-observability',
        name: 'Monitoring & Observability Stack',
        description: 'Comprehensive monitoring solution with metrics collection, visualization, alerting, and log aggregation for system observability.',
        category: 'monitoring',
        difficulty: 'advanced',
        estimatedSetupTime: '60 minutes',
        serviceIds: [14, 15, 16, 17, 18], // Prometheus, Grafana, AlertManager, Loki, cAdvisor
        featured: true,
        metadata: {
          requiredResources: {
            ram: '4GB',
            storage: '50GB',
            cpu: '2 cores minimum'
          },
          tags: ['monitoring', 'metrics', 'alerting', 'observability', 'grafana', 'prometheus'],
          prerequisites: [
            'Understanding of monitoring concepts',
            'Knowledge of metrics and alerting',
            'Experience with Grafana dashboards'
          ],
          postSetupSteps: [
            'Configure Prometheus scraping targets',
            'Import Grafana dashboards for system monitoring',
            'Set up AlertManager notification channels',
            'Configure log aggregation in Loki'
          ],
          compatiblePlatforms: ['linux'],
          networkRequirements: {
            ports: [9090, 3000, 9093, 3100, 8080],
            domainRequired: false,
            sslRequired: false
          },
          supportStatus: 'active',
          configurationNotes: [
            'Requires careful resource planning',
            'Consider data retention policies',
            'Set up proper alerting rules to avoid noise'
          ]
        }
      },

      // Home Automation
      {
        id: 'tpl-home-automation',
        name: 'Smart Home Automation Hub',
        description: 'Central hub for home automation with device control, monitoring, and intelligent automation rules.',
        category: 'productivity',
        difficulty: 'intermediate',
        estimatedSetupTime: '40 minutes',
        serviceIds: [19, 20, 21], // Home Assistant, Node-RED, MQTT Broker
        metadata: {
          requiredResources: {
            ram: '2GB',
            storage: '20GB',
            network: 'Stable local network'
          },
          tags: ['automation', 'iot', 'smart-home', 'home-assistant', 'mqtt'],
          prerequisites: [
            'Smart home devices (lights, sensors, etc.)',
            'Basic understanding of IoT concepts',
            'Network with IoT device access'
          ],
          postSetupSteps: [
            'Configure Home Assistant integrations',
            'Set up Node-RED automation flows',
            'Connect IoT devices to MQTT broker',
            'Create automation rules and scenes'
          ],
          compatiblePlatforms: ['linux', 'macos'],
          networkRequirements: {
            ports: [8123, 1880, 1883],
            domainRequired: false,
            sslRequired: false
          },
          supportStatus: 'active'
        }
      },

      // Security & Privacy
      {
        id: 'tpl-security-privacy',
        name: 'Security & Privacy Stack',
        description: 'Essential security tools including VPN, ad-blocking, password management, and network security monitoring.',
        category: 'security',
        difficulty: 'advanced',
        estimatedSetupTime: '50 minutes',
        serviceIds: [22, 23, 24, 25], // WireGuard, Pi-hole, Vaultwarden, Fail2Ban
        metadata: {
          requiredResources: {
            ram: '1GB',
            storage: '10GB',
            network: 'Stable internet with static IP recommended'
          },
          tags: ['security', 'privacy', 'vpn', 'adblock', 'passwords'],
          prerequisites: [
            'Understanding of network security concepts',
            'Static IP or dynamic DNS service',
            'Port forwarding capability'
          ],
          postSetupSteps: [
            'Generate WireGuard client configurations',
            'Configure Pi-hole DNS settings on devices',
            'Set up Vaultwarden for password management',
            'Configure Fail2Ban protection rules'
          ],
          compatiblePlatforms: ['linux'],
          networkRequirements: {
            ports: [51820, 53, 80, 443],
            domainRequired: true,
            sslRequired: true
          },
          supportStatus: 'active',
          knownIssues: [
            'WireGuard may require kernel module support',
            'Pi-hole DNS changes affect entire network'
          ]
        }
      }
    ]
  }

  // Helper methods

  private formatTemplate(template: any): UseCaseTemplate {
    const formatted: UseCaseTemplate = {
      ...(template as any),
      serviceIds: JSON.parse(template.serviceIds || '[]'),
      metadata: template.metadata ? JSON.parse(template.metadata) : undefined,
    }
    // Ensure services shape matches expected type when present
    if (template.services) {
      (formatted as any).services = template.services as any
    }
    return formatted
  }

  private generateTemplateId(name: string): string {
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50)
    
    return `tpl-${slug}-${Date.now()}`
  }

  private incrementVersion(currentVersion: string, breakingChange?: boolean): string {
    const [major, minor, patch] = currentVersion.split('.').map(Number)
    
    if (breakingChange) {
      return `${major + 1}.0.0`
    } else {
      return `${major}.${minor + 1}.0`
    }
  }

  private async createVersionHistory(
    templateId: string, 
    oldVersion: string, 
    newVersion: string, 
    data: { serviceIds: number[], changes: VersionChanges }
  ): Promise<void> {
    await this.prisma.template_versions.create({
      data: {
        id: randomUUID(),
        templateId,
        version: newVersion,
        changes: JSON.stringify(data.changes),
        serviceIds: JSON.stringify(data.serviceIds)
      }
    })
  }

  private generateChanges(existing: any, updates: UpdateTemplateInput): VersionChanges {
    const changes: VersionChanges = {
      type: updates.breakingChange ? 'major' : 'minor',
      summary: 'Template updated'
    }

    if (updates.name && updates.name !== existing.name) {
      changes.summary = 'Updated template name and configuration'
    }

    if (updates.serviceIds) {
      const oldServices = JSON.parse(existing.serviceIds || '[]')
      const newServices = updates.serviceIds
      
      changes.servicesAdded = newServices.filter((id: number) => !oldServices.includes(id))
      changes.servicesRemoved = oldServices.filter((id: number) => !newServices.includes(id))
    }

    return changes
  }

  /**
   * Estimate migration time based on steps
   */
  private estimateMigrationTime(steps: any[]): string {
    const baseTime = 5 // 5 minutes base
    const serviceTime = steps.filter(s => s.type.includes('service')).length * 3 // 3 minutes per service
    const metadataTime = steps.filter(s => s.type === 'update_metadata').length * 2 // 2 minutes per metadata update
    
    const totalMinutes = baseTime + serviceTime + metadataTime
    
    if (totalMinutes < 60) {
      return `${totalMinutes} minutes`
    } else {
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      return `${hours}h ${minutes}m`
    }
  }

  /**
   * Compare version numbers (returns -1, 0, or 1)
   */
  private compareVersionNumbers(version1: string, version2: string): number {
    const v1parts = version1.split('.').map(Number)
    const v2parts = version2.split('.').map(Number)
    
    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0
      const v2part = v2parts[i] || 0
      
      if (v1part < v2part) return -1
      if (v1part > v2part) return 1
    }
    
    return 0
  }
}

// Utility function to initialize templates on server start
export const initializeDefaultTemplates = async (prisma: PrismaClient): Promise<void> => {
  const engine = new TemplateEngine(prisma)
  await engine.initializeCuratedTemplates()
}