import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TemplateEngine } from '@/server/services/template-engine'
import { PrismaClient } from '@prisma/client'
import { createMockContext } from '../helpers/test-utils'

// Mock Prisma
vi.mock('@prisma/client')

describe('TemplateEngine', () => {
  let engine: TemplateEngine
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      useCaseTemplate: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        groupBy: vi.fn().mockResolvedValue([])
      },
      templateUsage: {
        create: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([])
      },
      templateRating: {
        aggregate: vi.fn().mockResolvedValue({ _avg: { rating: 4.5 }, _count: { rating: 10 } }),
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
        update: vi.fn()
      },
      templateVersion: {
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null)
      },
      service: {
        findMany: vi.fn(),
        findUnique: vi.fn()
      },
      stack: {
        findUnique: vi.fn()
      },
      stackService: {
        findMany: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _max: { order: 0 } }),
        create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...data }))
      },
      stackServiceConfiguration: {
        create: vi.fn().mockResolvedValue({})
      }
    }
    // TemplateEngine uses the plural snake_case delegates from the Prisma
    // schema; alias them to the camelCase mocks the assertions use.
    mockPrisma.use_case_templates = mockPrisma.useCaseTemplate
    mockPrisma.template_usage = mockPrisma.templateUsage
    mockPrisma.template_ratings = mockPrisma.templateRating
    mockPrisma.template_versions = mockPrisma.templateVersion
    mockPrisma.services = mockPrisma.service
    mockPrisma.stacks = mockPrisma.stack
    mockPrisma.stack_services = mockPrisma.stackService
    mockPrisma.stack_service_configurations = mockPrisma.stackServiceConfiguration
    // $transaction runs its callback with the same mock delegates as `tx`.
    mockPrisma.$transaction = vi.fn().mockImplementation((cb: any) => cb(mockPrisma))
    engine = new TemplateEngine(mockPrisma)
  })

  describe('getTemplateById', () => {
    it('should retrieve template by ID with full details', async () => {
      const mockTemplate = {
        id: 'tpl-media-server',
        name: 'Media Server Stack',
        description: 'Complete media streaming setup',
        category: 'media',
        difficulty: 'intermediate',
        estimatedSetupTime: '45 minutes',
        version: '1.0.0',
        isActive: true,
        serviceIds: '[1,2]',
        services: [
          { id: 1, name: 'Plex', slug: 'plex' },
          { id: 2, name: 'Tautulli', slug: 'tautulli' }
        ],
        metadata: JSON.stringify({
          requiredResources: { ram: '4GB', storage: '1TB' },
          tags: ['media', 'streaming', 'entertainment']
        }),
        createdAt: new Date('2025-09-19T09:52:19.003Z'),
        updatedAt: new Date('2025-09-19T09:52:19.003Z')
      }

      mockPrisma.useCaseTemplate.findUnique.mockResolvedValue(mockTemplate)

      const result = await engine.getTemplateById('tpl-media-server')

      // The formatTemplate method parses serviceIds and metadata
      const expectedResult = {
        id: 'tpl-media-server',
        name: 'Media Server Stack',
        description: 'Complete media streaming setup',
        category: 'media',
        difficulty: 'intermediate',
        estimatedSetupTime: '45 minutes',
        version: '1.0.0',
        isActive: true,
        serviceIds: [1, 2], // Parsed from JSON
        services: [
          { id: 1, name: 'Plex', slug: 'plex' },
          { id: 2, name: 'Tautulli', slug: 'tautulli' }
        ],
        metadata: {
          requiredResources: { ram: '4GB', storage: '1TB' },
          tags: ['media', 'streaming', 'entertainment']
        },
        createdAt: new Date('2025-09-19T09:52:19.003Z'),
        updatedAt: new Date('2025-09-19T09:52:19.003Z')
      }
      
      expect(result).toEqual(expectedResult)
      expect(mockPrisma.useCaseTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 'tpl-media-server' },
        include: { services: true }
      })
    })

    it('should return null for non-existent template', async () => {
      mockPrisma.useCaseTemplate.findUnique.mockResolvedValue(null)

      const result = await engine.getTemplateById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getAllTemplates', () => {
    it('should return all active templates with filtering options', async () => {
      const mockTemplates = [
        {
          id: 'tpl-media',
          name: 'Media Server',
          category: 'media',
          difficulty: 'intermediate',
          isActive: true,
          serviceIds: '[1,2]',
          metadata: null
        },
        {
          id: 'tpl-web-dev',
          name: 'Web Development',
          category: 'development',
          difficulty: 'beginner',
          isActive: true,
          serviceIds: '[3,4]',
          metadata: null
        }
      ]

      mockPrisma.useCaseTemplate.findMany.mockResolvedValue(mockTemplates)

      const result = await engine.getAllTemplates({
        category: 'media',
        difficulty: 'intermediate',
        includeInactive: false
      })

      // Expected formatted results
      const expectedResults = [
        {
          id: 'tpl-media',
          name: 'Media Server',
          category: 'media',
          difficulty: 'intermediate',
          isActive: true,
          serviceIds: [1, 2],
          metadata: undefined
        },
        {
          id: 'tpl-web-dev',
          name: 'Web Development',
          category: 'development',
          difficulty: 'beginner',
          isActive: true,
          serviceIds: [3, 4],
          metadata: undefined
        }
      ]
      
      expect(result).toEqual(expectedResults)
      expect(mockPrisma.useCaseTemplate.findMany).toHaveBeenCalledWith({
        where: {
          category: 'media',
          difficulty: 'intermediate',
          isActive: true
        },
        include: { services: true },
        orderBy: [
          { featured: 'desc' },
          { usageCount: 'desc' },
          { createdAt: 'desc' }
        ]
      })
    })

    it('should include inactive templates when requested', async () => {
      mockPrisma.useCaseTemplate.findMany.mockResolvedValue([])
      
      await engine.getAllTemplates({ includeInactive: true })

      expect(mockPrisma.useCaseTemplate.findMany).toHaveBeenCalledWith({
        where: {},
        include: { services: true },
        orderBy: [
          { featured: 'desc' },
          { usageCount: 'desc' },
          { createdAt: 'desc' }
        ]
      })
    })
  })

  describe('createTemplate', () => {
    it('should create new template with valid data', async () => {
      const templateData = {
        id: 'tpl-new-stack',
        name: 'New Stack Template',
        description: 'A new template for testing',
        category: 'development',
        difficulty: 'beginner' as const,
        estimatedSetupTime: '30 minutes',
        serviceIds: [1, 2, 3],
        metadata: {
          requiredResources: { ram: '2GB', storage: '20GB' },
          tags: ['development', 'testing']
        }
      }

      const mockCreated = {
        id: 'tpl-new-stack',
        name: 'New Stack Template',
        description: 'A new template for testing',
        category: 'development',
        difficulty: 'beginner',
        estimatedSetupTime: '30 minutes',
        serviceIds: '[1,2,3]',
        metadata: JSON.stringify({
          requiredResources: { ram: '2GB', storage: '20GB' },
          tags: ['development', 'testing']
        }),
        version: '1.0.0',
        isActive: true,
        featured: false,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockPrisma.useCaseTemplate.create.mockResolvedValue(mockCreated)

      const result = await engine.createTemplate(templateData)

      // Expected formatted result
      const expectedResult = {
        id: 'tpl-new-stack',
        name: 'New Stack Template',
        description: 'A new template for testing',
        category: 'development',
        difficulty: 'beginner',
        estimatedSetupTime: '30 minutes',
        serviceIds: [1, 2, 3], // Parsed from JSON
        metadata: {
          requiredResources: { ram: '2GB', storage: '20GB' },
          tags: ['development', 'testing']
        },
        version: '1.0.0',
        isActive: true,
        featured: false,
        usageCount: 0,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }
      
      expect(result).toEqual(expectedResult)
      expect(mockPrisma.useCaseTemplate.create).toHaveBeenCalledWith({
        data: {
          id: templateData.id,
          name: templateData.name,
          description: templateData.description,
          category: templateData.category,
          difficulty: templateData.difficulty,
          estimatedSetupTime: templateData.estimatedSetupTime,
          serviceIds: JSON.stringify(templateData.serviceIds),
          metadata: JSON.stringify(templateData.metadata),
          version: '1.0.0',
          isActive: true,
          featured: false,
          usageCount: 0,
          createdBy: undefined,
          updatedAt: expect.any(Date)
        }
      })
    })

    it('should generate unique ID if not provided', async () => {
      const templateData = {
        name: 'Auto ID Template',
        description: 'Template without explicit ID',
        category: 'monitoring',
        difficulty: 'advanced' as const,
        estimatedSetupTime: '60 minutes',
        serviceIds: [4, 5]
      }

      const mockCreatedWithAutoId = {
        id: 'tpl-auto-id-template-123456789',
        name: 'Auto ID Template',
        description: 'Template without explicit ID',
        category: 'monitoring',
        difficulty: 'advanced',
        estimatedSetupTime: '60 minutes',
        serviceIds: '[4,5]',
        metadata: '{}',
        version: '1.0.0',
        isActive: true,
        featured: false,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      mockPrisma.useCaseTemplate.create.mockResolvedValue(mockCreatedWithAutoId)

      await engine.createTemplate(templateData)

      expect(mockPrisma.useCaseTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: expect.stringMatching(/^tpl-auto-id-template-/),
          name: templateData.name
        })
      })
    })
  })

  describe('applyTemplateToStack', () => {
    it('should apply template services to existing stack', async () => {
      const mockTemplate = {
        id: 'tpl-web-dev',
        isActive: true,
        serviceIds: JSON.stringify([1, 2, 3]),
        services: [
          { id: 1, name: 'PostgreSQL', slug: 'postgresql' },
          { id: 2, name: 'Redis', slug: 'redis' },
          { id: 3, name: 'Nginx', slug: 'nginx' }
        ]
      }

      mockPrisma.useCaseTemplate.findUnique.mockResolvedValue(mockTemplate)
      mockPrisma.service.findMany.mockResolvedValue(mockTemplate.services)
      mockPrisma.stack.findUnique.mockResolvedValue({
        id: 'stack-123', userId: 'user-456', isPublic: false, status: 'draft'
      })
      mockPrisma.templateUsage.create.mockResolvedValue({})
      mockPrisma.useCaseTemplate.update.mockResolvedValue({})

      const result = await engine.applyTemplateToStack('tpl-web-dev', 'stack-123', 'user-456')

      expect(result).toEqual({
        success: true,
        servicesAdded: 3,
        services: mockTemplate.services,
        templateId: 'tpl-web-dev',
        stackId: 'stack-123'
      })

      // The stack must actually be populated: one stack_services row plus a
      // default configuration per applied service (same shape as stacks.addService).
      expect(mockPrisma.stackService.create).toHaveBeenCalledTimes(3)
      expect(mockPrisma.stackServiceConfiguration.create).toHaveBeenCalledTimes(3)
      expect(mockPrisma.stackService.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ stackId: 'stack-123', serviceId: 1, order: 1 })
      })
      expect(mockPrisma.stackServiceConfiguration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          environmentVariables: '{}',
          portMappings: '{}',
          volumeMounts: '{}',
          dependsOn: '[]'
        })
      })

      expect(mockPrisma.templateUsage.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          templateId: 'tpl-web-dev',
          stackId: 'stack-123',
          userId: 'user-456',
          servicesAdded: 3
        }
      })
    })

    it('should skip services already present in the stack', async () => {
      const mockTemplate = {
        id: 'tpl-web-dev',
        isActive: true,
        serviceIds: JSON.stringify([1, 2, 3]),
        services: [
          { id: 1, name: 'PostgreSQL', slug: 'postgresql' },
          { id: 2, name: 'Redis', slug: 'redis' },
          { id: 3, name: 'Nginx', slug: 'nginx' }
        ]
      }

      mockPrisma.useCaseTemplate.findUnique.mockResolvedValue(mockTemplate)
      mockPrisma.service.findMany.mockResolvedValue(mockTemplate.services)
      mockPrisma.stack.findUnique.mockResolvedValue({
        id: 'stack-123', userId: 'user-456', isPublic: false, status: 'draft'
      })
      // Service 1 already in the stack → only 2 new rows should be written.
      mockPrisma.stackService.findMany.mockResolvedValue([{ serviceId: 1 }])
      mockPrisma.templateUsage.create.mockResolvedValue({})
      mockPrisma.useCaseTemplate.update.mockResolvedValue({})

      const result = await engine.applyTemplateToStack('tpl-web-dev', 'stack-123', 'user-456')

      expect(result.servicesAdded).toBe(2)
      expect(mockPrisma.stackService.create).toHaveBeenCalledTimes(2)
      expect(mockPrisma.templateUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ servicesAdded: 2 })
      })
    })

    it('should reject a stack the user does not own', async () => {
      mockPrisma.useCaseTemplate.findUnique.mockResolvedValue({
        id: 'tpl-web-dev',
        isActive: true,
        serviceIds: JSON.stringify([1])
      })
      mockPrisma.stack.findUnique.mockResolvedValue({
        id: 'stack-123', userId: 'someone-else', isPublic: false, status: 'draft'
      })

      const result = await engine.applyTemplateToStack('tpl-web-dev', 'stack-123', 'user-456')

      expect(result).toEqual({
        success: false,
        error: 'Access denied',
        servicesAdded: 0
      })
      expect(mockPrisma.stackService.create).not.toHaveBeenCalled()
    })

    it('should handle a missing target stack', async () => {
      mockPrisma.useCaseTemplate.findUnique.mockResolvedValue({
        id: 'tpl-web-dev',
        isActive: true,
        serviceIds: JSON.stringify([1])
      })
      mockPrisma.stack.findUnique.mockResolvedValue(null)

      const result = await engine.applyTemplateToStack('tpl-web-dev', 'missing-stack', 'user-456')

      expect(result).toEqual({
        success: false,
        error: 'Stack not found',
        servicesAdded: 0
      })
    })

    it('should handle template not found', async () => {
      mockPrisma.useCaseTemplate.findUnique.mockResolvedValue(null)

      const result = await engine.applyTemplateToStack('non-existent', 'stack-123', 'user-456')

      expect(result).toEqual({
        success: false,
        error: 'Template not found',
        servicesAdded: 0
      })
    })

    it('should handle inactive template', async () => {
      mockPrisma.useCaseTemplate.findUnique.mockResolvedValue({
        id: 'tpl-inactive',
        isActive: false
      })

      const result = await engine.applyTemplateToStack('tpl-inactive', 'stack-123', 'user-456')

      expect(result).toEqual({
        success: false,
        error: 'Template is not active',
        servicesAdded: 0
      })
    })
  })

  describe('updateTemplate', () => {
    it('should update template with version increment', async () => {
      const existingTemplate = {
        id: 'tpl-existing',
        version: '1.0.0',
        isActive: true,
        serviceIds: '[1,2]'
      }

      const updateData = {
        name: 'Updated Template Name',
        description: 'Updated description',
        serviceIds: [1, 2, 4] // Changed services
      }

      mockPrisma.useCaseTemplate.findUnique.mockResolvedValue(existingTemplate)
      const mockUpdatedTemplate = {
        id: 'tpl-existing',
        name: 'Updated Template Name',
        description: 'Updated description',
        serviceIds: '[1,2,4]',
        version: '1.1.0',
        isActive: true,
        metadata: null,
        updatedAt: expect.any(Date)
      }
      
      mockPrisma.useCaseTemplate.update.mockResolvedValue(mockUpdatedTemplate)

      const result = await engine.updateTemplate('tpl-existing', updateData)

      expect(result.version).toBe('1.1.0')
      expect(result.serviceIds).toEqual([1, 2, 4]) // Parsed from JSON
      expect(mockPrisma.useCaseTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-existing' },
        data: {
          name: updateData.name,
          description: updateData.description,
          serviceIds: JSON.stringify(updateData.serviceIds),
          version: '1.1.0',
          updatedAt: expect.any(Date)
        }
      })
    })

    it('should handle major version increment for breaking changes', async () => {
      const existingTemplate = { 
        id: 'tpl-existing',
        version: '1.5.2',
        serviceIds: '[1,2]'
      }
      mockPrisma.useCaseTemplate.findUnique.mockResolvedValue(existingTemplate)
      mockPrisma.useCaseTemplate.update.mockResolvedValue({
        ...existingTemplate,
        name: 'Breaking Change',
        version: '2.0.0'
      })

      const result = await engine.updateTemplate('tpl-existing', {
        name: 'Breaking Change',
        breakingChange: true
      })

      expect(mockPrisma.useCaseTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-existing' },
        data: expect.objectContaining({
          version: '2.0.0'
        })
      })
    })
  })

  describe('getTemplateUsageStats', () => {
    it('should return usage statistics for template', async () => {
      const templateId = 'tpl-popular'

      // Mock all the new enhanced stats calls
      mockPrisma.templateUsage.count.mockResolvedValueOnce(150) // total usage
        .mockResolvedValueOnce(120) // successful deployments
      mockPrisma.templateRating.aggregate.mockResolvedValue({
        _avg: { rating: 4.2 },
        _count: { rating: 47 }
      })
      mockPrisma.templateUsage.findFirst.mockResolvedValue({
        createdAt: new Date('2025-09-15T10:00:00Z')
      })
      
      // Mock the popularity trend calculation
      mockPrisma.templateUsage.count.mockResolvedValueOnce(30) // recent usage
        .mockResolvedValueOnce(20) // older usage

      const result = await engine.getTemplateUsageStats(templateId)

      expect(result).toEqual({
        templateId,
        usageCount: 150,
        averageRating: 4.2,
        ratingCount: 47,
        successfulDeployments: 120,
        failedDeployments: 30,
        lastUsed: new Date('2025-09-15T10:00:00Z'),
        popularityTrend: 'rising'
      })
    })

    it('should handle templates with no usage or ratings', async () => {
      mockPrisma.templateUsage.count.mockResolvedValueOnce(0) // total usage
        .mockResolvedValueOnce(0) // successful deployments  
        .mockResolvedValueOnce(0) // recent usage for trend
        .mockResolvedValueOnce(0) // older usage for trend
      mockPrisma.templateRating.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { rating: 0 }
      })
      mockPrisma.templateUsage.findFirst.mockResolvedValue(null)

      const result = await engine.getTemplateUsageStats('tpl-unused')

      expect(result).toEqual({
        templateId: 'tpl-unused',
        usageCount: 0,
        averageRating: 0,
        ratingCount: 0,
        successfulDeployments: 0,
        failedDeployments: 0,
        lastUsed: undefined,
        popularityTrend: 'stable'
      })
    })
  })

  describe('rateTemplate', () => {
    it('should record template rating and feedback', async () => {
      const ratingData = {
        templateId: 'tpl-rated',
        userId: 'user-123',
        rating: 5,
        comment: 'Excellent template!'
      }

      mockPrisma.templateRating.create.mockResolvedValue({
        id: 'rating-456',
        ...ratingData,
        createdAt: new Date()
      })

      const result = await engine.rateTemplate(ratingData)

      expect(result).toHaveProperty('id', 'rating-456')
      expect(mockPrisma.templateRating.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          ...ratingData,
          updatedAt: expect.any(Date)
        }
      })
    })

    it('should validate rating bounds', async () => {
      const invalidRating = {
        templateId: 'tpl-test',
        userId: 'user-123',
        rating: 6 // Invalid: > 5
      }

      await expect(engine.rateTemplate(invalidRating)).rejects.toThrow('Rating must be between 1 and 5')
    })
  })

  describe('searchTemplates', () => {
    it('should search templates by name and description', async () => {
      const mockResults = [
        { 
          id: 'tpl-1', 
          name: 'Media Server', 
          description: 'Plex media setup',
          serviceIds: '[]',
          metadata: null
        },
        { 
          id: 'tpl-2', 
          name: 'Development', 
          description: 'Media development tools',
          serviceIds: '[]',
          metadata: null
        }
      ]

      mockPrisma.useCaseTemplate.findMany.mockResolvedValue(mockResults)

      const result = await engine.searchTemplates('media', {
        limit: 10,
        offset: 0
      })

      const expectedResults = [
        { 
          id: 'tpl-1', 
          name: 'Media Server', 
          description: 'Plex media setup',
          serviceIds: [],
          metadata: undefined
        },
        { 
          id: 'tpl-2', 
          name: 'Development', 
          description: 'Media development tools',
          serviceIds: [],
          metadata: undefined
        }
      ]
      
      expect(result).toEqual(expectedResults)
      expect(mockPrisma.useCaseTemplate.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { isActive: true },
            {
              OR: [
                { name: { contains: 'media', mode: 'insensitive' } },
                { description: { contains: 'media', mode: 'insensitive' } }
              ]
            }
          ]
        },
        include: { services: true },
        skip: 0,
        take: 10,
        orderBy: [
          { featured: 'desc' },
          { usageCount: 'desc' }
        ]
      })
    })

    it('should handle empty search results', async () => {
      mockPrisma.useCaseTemplate.findMany.mockResolvedValue([])

      const result = await engine.searchTemplates('nonexistent-query')

      expect(result).toEqual([])
    })
  })

  describe('validateTemplate', () => {
    it('should validate template structure and services', async () => {
      const validTemplate = {
        name: 'Valid Template',
        description: 'A valid template for testing',
        category: 'development',
        difficulty: 'intermediate' as const,
        estimatedSetupTime: '30 minutes',
        serviceIds: [1, 2, 3]
      }

      mockPrisma.service.findMany.mockResolvedValue([
        { id: 1, status: 'approved' },
        { id: 2, status: 'approved' },
        { id: 3, status: 'approved' }
      ])

      const result = await engine.validateTemplate(validTemplate)

      expect(result).toEqual({
        isValid: true,
        errors: []
      })
    })

    it('should detect invalid services', async () => {
      const invalidTemplate = {
        name: 'Invalid Template',
        description: 'Template with invalid services',
        category: 'development',
        difficulty: 'intermediate' as const,
        estimatedSetupTime: '30 minutes',
        serviceIds: [1, 999] // 999 doesn't exist
      }

      mockPrisma.service.findMany.mockResolvedValue([
        { id: 1, status: 'approved' }
      ])

      const result = await engine.validateTemplate(invalidTemplate)

      expect(result).toEqual({
        isValid: false,
        errors: ['Service with ID 999 not found or not approved']
      })
    })

    it('should validate required fields', async () => {
      const incompleteTemplate = {
        name: '', // Invalid: empty name
        description: 'Valid description',
        category: 'development',
        serviceIds: [] // Invalid: no services
      }

      const result = await engine.validateTemplate(incompleteTemplate)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Template name is required')
      expect(result.errors).toContain('Template must include at least one service')
    })
  })
})