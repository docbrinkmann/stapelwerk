import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, publicProcedure, adminProcedure } from '../trpc'
import {
  ImportCreateSchema,
  ImportListSchema,
  ImportGetSchema,
  ImportApproveSchema,
  ImportRejectSchema,
  ImportDeleteSchema,
  ImportBulkActionSchema,
  ImportStatus,
  ImportSourceType
} from '@/lib/validation/import-schemas'
import { DockerHubExtractor, ExtractedMetadataSchema } from '@/lib/services/docker-hub-extractor'
import { ValidationErrorHandler } from '@/lib/validation/error-handling'
import { ServiceStatus } from '@/lib/validation/service-catalog-schemas'

// Initialize Docker Hub extractor
const dockerHubExtractor = new DockerHubExtractor()

// Response schemas
const ImportListResponseSchema = z.object({
  imports: z.array(z.any()),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  total: z.number()
})

const ImportResponseSchema = z.any()

const DeleteResponseSchema = z.object({
  success: z.boolean()
})

const BulkActionResponseSchema = z.object({
  success: z.boolean(),
  processed: z.number(),
  failed: z.number(),
  results: z.array(z.object({
    id: z.number(),
    success: z.boolean(),
    error: z.string().optional()
  }))
})

export const importsRouter = createTRPCRouter({
  // Create a new import request
  create: adminProcedure
    .input(ImportCreateSchema)
    .output(ImportResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { sourceUrl, sourceType, categoryId, submittedBy } = input

        // Validate that category exists
        const categoryExists = await ctx.prisma.categories.findUnique({
          where: { id: categoryId }
        })

        if (!categoryExists) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Category not found'
          })
        }

        // Check for duplicate imports
        const existingImport = await ctx.prisma.service_imports.findFirst({
          where: {
            sourceUrl,
            sourceType,
            status: {
              in: [ImportStatus.PENDING, ImportStatus.PROCESSING, ImportStatus.APPROVED]
            }
          }
        })

        if (existingImport) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'An import for this source already exists and is pending or approved'
          })
        }

        let extractedMetadata = {}

        // Extract metadata based on source type
        if (sourceType === ImportSourceType.DOCKER_HUB) {
          // Validate Docker Hub image exists
          const imageExists = await dockerHubExtractor.validateImageExists(sourceUrl)
          if (!imageExists) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Docker image does not exist on Docker Hub'
            })
          }

          // Extract metadata from Docker Hub
          try {
            extractedMetadata = await dockerHubExtractor.extractMetadata(sourceUrl)
            
            // Validate extracted metadata
            const validationResult = ExtractedMetadataSchema.safeParse(extractedMetadata)
            if (!validationResult.success) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Invalid metadata extracted from Docker Hub',
                cause: validationResult.error
              })
            }
          } catch (error) {
            // Preserve intentional TRPC errors (e.g. BAD_REQUEST for invalid
            // metadata) instead of shadowing them as 500s
            if (error instanceof TRPCError) {
              throw error
            }
            console.error('Error extracting Docker Hub metadata:', error)
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Failed to extract metadata from Docker Hub: ${error instanceof Error ? error.message : 'Unknown error'}`
            })
          }
        }

        // Create the import record
        const importRecord = await ctx.prisma.service_imports.create({
          data: {
            sourceUrl,
            sourceType,
            status: ImportStatus.PENDING,
            extractedMetadata: JSON.stringify(extractedMetadata),
            submittedBy,
            updatedAt: new Date()
          }
        })

        return {
          ...importRecord,
          parsedMetadata: extractedMetadata
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        // Handle validation errors
        const validationResult = ValidationErrorHandler.validateSafely(
          ImportCreateSchema,
          input
        )
        
        if (!validationResult.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid import data',
            cause: validationResult.error
          })
        }
        
        console.error('Error creating import:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create import'
        })
      }
    }),

  // List imports with filtering and pagination
  list: publicProcedure
    .input(ImportListSchema)
    .output(ImportListResponseSchema)
    .query(async ({ input, ctx }) => {
      try {
        const {
          cursor,
          limit,
          status,
          sourceType,
          search,
          submittedBy
        } = input

        // Build filter conditions
        const filters: any = {}
        
        if (status) {
          filters.status = status
        }
        
        if (sourceType) {
          filters.sourceType = sourceType
        }
        
        if (submittedBy) {
          filters.submittedBy = submittedBy
        }

        // Handle search
        let searchConditions = {}
        if (search) {
          searchConditions = {
            OR: [
              { sourceUrl: { contains: search } },
              { submittedBy: { contains: search } },
              { reviewNotes: { contains: search } }
            ]
          }
        }

        // Parse cursor for pagination
        let cursorCondition = {}
        if (cursor) {
          cursorCondition = { id: { lt: cursor } }
        }

        // Fetch imports with pagination
        const imports = await ctx.prisma.service_imports.findMany({
          where: {
            ...filters,
            ...searchConditions,
            ...cursorCondition
          },
          include: {
            services: {
              include: {
                categories: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: limit + 1 // Fetch one extra to check if there are more
        })

        // Parse metadata for each import
        const parsedImports = imports.slice(0, limit).map(importRecord => ({
          ...importRecord,
          parsedMetadata: importRecord.extractedMetadata 
            ? JSON.parse(importRecord.extractedMetadata)
            : null
        }))

        // Determine pagination info
        const hasMore = imports.length > limit
        const nextCursor = hasMore ? imports[limit - 1].id.toString() : null

        // Get total count for this query
        const total = await ctx.prisma.service_imports.count({
          where: {
            ...filters,
            ...searchConditions
          }
        })

        return {
          imports: parsedImports,
          nextCursor,
          hasMore,
          total
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Error listing imports:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch imports'
        })
      }
    }),

  // Get single import by ID
  get: publicProcedure
    .input(ImportGetSchema)
    .output(ImportResponseSchema)
    .query(async ({ input, ctx }) => {
      try {
        const importRecord = await ctx.prisma.service_imports.findUnique({
          where: { id: input.id },
          include: {
            services: {
              include: {
                categories: true
              }
            }
          }
        })
        
        if (!importRecord) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Import not found'
          })
        }

        return {
          ...importRecord,
          parsedMetadata: importRecord.extractedMetadata 
            ? JSON.parse(importRecord.extractedMetadata)
            : null
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Error fetching import:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch import'
        })
      }
    }),

  // Approve an import (creates service)
  approve: adminProcedure
    .input(ImportApproveSchema)
    .output(ImportResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, reviewedBy, reviewNotes } = input

        // Get the import record
        const importRecord = await ctx.prisma.service_imports.findUnique({
          where: { id }
        })

        // We need to find the categoryId from the original import request
        // For now, we'll get the first category as default
        const defaultCategory = await ctx.prisma.categories.findFirst()

        if (!importRecord) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Import not found'
          })
        }

        if (importRecord.status !== ImportStatus.PENDING) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Import has already been processed'
          })
        }

        // Parse the extracted metadata
        const metadata = JSON.parse(importRecord.extractedMetadata)
        
        // Generate slug from service name
        const slug = metadata.name.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')

        // Check if service with same name already exists
        const existingService = await ctx.prisma.services.findFirst({
          where: {
            OR: [
              { name: metadata.name },
              { slug }
            ]
          }
        })

        if (existingService) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Service with name "${metadata.name}" already exists`
          })
        }

        // Create the service from metadata
        const service = await ctx.prisma.services.create({
          data: {
            name: metadata.name,
            slug,
            description: metadata.description || `${metadata.name} service`,
            dockerImage: importRecord.sourceUrl,
            version: metadata.tags?.[0] || 'latest',
            categoryId: defaultCategory?.id || 1, // Use default category
            ports: JSON.stringify(metadata.exposedPorts || []),
            environmentVariables: JSON.stringify(metadata.environmentVariables || []),
            resourceRequirements: JSON.stringify({}),
            compatibilityInfo: JSON.stringify({}),
            documentationUrl: null,
            featured: metadata.isOfficial || false,
            status: ServiceStatus.APPROVED,
            updatedAt: new Date()
          }
        })

        // Update the import record
        const updatedImport = await ctx.prisma.service_imports.update({
          where: { id },
          data: {
            status: ImportStatus.APPROVED,
            reviewedBy,
            reviewNotes,
            serviceId: service.id,
            updatedAt: new Date()
          },
          include: {
            services: {
              include: {
                categories: true
              }
            }
          }
        })

        return {
          ...updatedImport,
          parsedMetadata: metadata
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Error approving import:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to approve import'
        })
      }
    }),

  // Reject an import
  reject: adminProcedure
    .input(ImportRejectSchema)
    .output(ImportResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, reviewedBy, reviewNotes } = input

        // Get the import record
        const importRecord = await ctx.prisma.service_imports.findUnique({
          where: { id }
        })

        if (!importRecord) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Import not found'
          })
        }

        if (importRecord.status !== ImportStatus.PENDING) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Import has already been processed'
          })
        }

        // Update the import record
        const updatedImport = await ctx.prisma.service_imports.update({
          where: { id },
          data: {
            status: ImportStatus.REJECTED,
            reviewedBy,
            reviewNotes,
            updatedAt: new Date()
          }
        })

        return {
          ...updatedImport,
          parsedMetadata: updatedImport.extractedMetadata 
            ? JSON.parse(updatedImport.extractedMetadata)
            : null
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Error rejecting import:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reject import'
        })
      }
    }),

  // Delete an import
  delete: adminProcedure
    .input(ImportDeleteSchema)
    .output(DeleteResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Get the import record
        const importRecord = await ctx.prisma.service_imports.findUnique({
          where: { id: input.id }
        })

        if (!importRecord) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Import not found'
          })
        }

        // Don't allow deletion of approved imports with associated services
        if (importRecord.status === ImportStatus.APPROVED && importRecord.serviceId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot delete approved import with associated service'
          })
        }

        // Delete the import record
        await ctx.prisma.service_imports.delete({
          where: { id: input.id }
        })

        return { success: true }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Error deleting import:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete import'
        })
      }
    }),

  // Bulk operations on imports
  bulkAction: adminProcedure
    .input(ImportBulkActionSchema)
    .output(BulkActionResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { ids, action, reviewedBy, reviewNotes } = input
        
        const results = []
        let processed = 0
        let failed = 0

        // Process each import
        for (const id of ids) {
          try {
            switch (action) {
              case 'approve':
                await ctx.prisma.service_imports.update({
                  where: { id },
                  data: {
                    status: ImportStatus.APPROVED,
                    reviewedBy,
                    reviewNotes,
                    updatedAt: new Date()
                  }
                })
                break

              case 'reject':
                await ctx.prisma.service_imports.update({
                  where: { id },
                  data: {
                    status: ImportStatus.REJECTED,
                    reviewedBy,
                    reviewNotes,
                    updatedAt: new Date()
                  }
                })
                break

              case 'delete':
                await ctx.prisma.service_imports.delete({
                  where: { id }
                })
                break
            }

            results.push({ id, success: true })
            processed++
          } catch (error) {
            results.push({ 
              id, 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            })
            failed++
          }
        }

        return {
          success: failed === 0,
          processed,
          failed,
          results
        }
      } catch (error) {
        console.error('Error performing bulk action:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to perform bulk action'
        })
      }
    }),

  // Create import specifically from Docker Hub with simplified input
  createFromDockerHub: adminProcedure
    .input(z.object({
      dockerImage: z.string(),
      categoryId: z.number(),
      submittedBy: z.string()
    }))
    .output(ImportResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { dockerImage, categoryId, submittedBy } = input

        // Convert Docker image to Docker Hub URL format
        const sourceUrl = dockerImage.includes('/') ? dockerImage : `library/${dockerImage}`
        
        // Call the create logic directly
        const createInput = {
          sourceUrl,
          sourceType: ImportSourceType.DOCKER_HUB,
          categoryId,
          submittedBy
        }
        
        // Validate that category exists
        const categoryExists = await ctx.prisma.categories.findUnique({
          where: { id: categoryId }
        })

        if (!categoryExists) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Category not found'
          })
        }

        // Check for duplicate imports
        const existingImport = await ctx.prisma.service_imports.findFirst({
          where: {
            sourceUrl,
            sourceType: ImportSourceType.DOCKER_HUB,
            status: {
              in: [ImportStatus.PENDING, ImportStatus.PROCESSING, ImportStatus.APPROVED]
            }
          }
        })

        if (existingImport) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'An import for this Docker Hub image already exists and is pending or approved'
          })
        }

        // Extract metadata from Docker Hub
        let extractedMetadata = {}
        try {
          const imageExists = await dockerHubExtractor.validateImageExists(sourceUrl)
          if (!imageExists) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Docker image does not exist on Docker Hub'
            })
          }

          extractedMetadata = await dockerHubExtractor.extractMetadata(sourceUrl)
        } catch (error) {
          console.error('Error extracting Docker Hub metadata:', error)
          // Continue with empty metadata if extraction fails
        }

        // Create the import record
        const importRecord = await ctx.prisma.service_imports.create({
          data: {
            sourceUrl,
            sourceType: ImportSourceType.DOCKER_HUB,
            status: ImportStatus.PENDING,
            extractedMetadata: JSON.stringify(extractedMetadata),
            submittedBy,
            updatedAt: new Date()
          }
        })

        return {
          ...importRecord,
          parsedMetadata: extractedMetadata
        }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }
        
        console.error('Error creating Docker Hub import:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create Docker Hub import'
        })
      }
    }),

  // Get import statistics
  statistics: publicProcedure
    .output(z.object({
      totalImports: z.number(),
      pendingImports: z.number(),
      approvedImports: z.number(),
      rejectedImports: z.number(),
      bySourceType: z.record(z.string(), z.number())
    }))
    .query(async ({ ctx }) => {
      try {
        const totalImports = await ctx.prisma.service_imports.count()
        
        const pendingImports = await ctx.prisma.service_imports.count({
          where: { status: ImportStatus.PENDING }
        })
        
        const approvedImports = await ctx.prisma.service_imports.count({
          where: { status: ImportStatus.APPROVED }
        })
        
        const rejectedImports = await ctx.prisma.service_imports.count({
          where: { status: ImportStatus.REJECTED }
        })

        // Get counts by source type
        const sourceTypeCounts = await ctx.prisma.service_imports.groupBy({
          by: ['sourceType'],
          _count: {
            id: true
          }
        })

        const bySourceType = sourceTypeCounts.reduce((acc, item) => {
          acc[item.sourceType] = item._count.id
          return acc
        }, {} as Record<string, number>)

        return {
          totalImports,
          pendingImports,
          approvedImports,
          rejectedImports,
          bySourceType
        }
      } catch (error) {
        console.error('Error fetching import statistics:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch import statistics'
        })
      }
    })
})