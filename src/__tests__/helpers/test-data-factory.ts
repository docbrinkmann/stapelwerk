import { ValidationHelpers } from '../../lib/validation/service-catalog-schemas'
import { PrismaClient } from '@prisma/client'

// Create a test database instance for helpers
const testPrisma = new PrismaClient()

// Unique suffix so repeated factory calls never collide on unique columns
// (tests share one DB run and don't clean up between cases)
const uniqueSuffix = () => Math.random().toString(36).slice(2, 8)

// Test data factories that generate compliant test data
export const TestDataFactory = {
  // Generate a unique slug from a name
  generateSlug: (name: string): string => {
    return `${ValidationHelpers.generateSlug(name)}-${uniqueSuffix()}`
  },

  // Create a valid category for testing
  createCategory: (nameOrOverrides?: string | {
    name?: string
    description?: string
    sortOrder?: number
    icon?: string | null
  }) => {
    // Handle both string (name) and object (overrides) arguments
    const overrides = typeof nameOrOverrides === 'string'
      ? { name: nameOrOverrides }
      : (nameOrOverrides || {})

    // ?? on purpose: boundary tests pass empty strings that must reach validation
    const name = overrides.name ?? 'Test Category'
    return {
      name,
      slug: TestDataFactory.generateSlug(name || 'empty'),
      description: overrides.description ?? 'Category description for testing and development',
      sortOrder: overrides.sortOrder || 1,
      icon: overrides.icon !== undefined ? overrides.icon : null
    }
  },

  // Create a valid service for testing
  createService: (categoryId: number, overrides: {
    name?: string
    description?: string
    dockerImage?: string
    version?: string
    ports?: any[]
    environmentVariables?: any[]
    resourceRequirements?: any
    compatibilityInfo?: any
    documentationUrl?: string
    featured?: boolean
  } = {}) => {
    const name = overrides.name || 'Test Service'
    return {
      name,
      slug: TestDataFactory.generateSlug(name),
      description: overrides.description || 'Test service description for testing purposes',
      dockerImage: overrides.dockerImage || 'nginx:latest',
      version: overrides.version || 'latest',
      categoryId,
      ports: overrides.ports || [],
      environmentVariables: overrides.environmentVariables || [],
      resourceRequirements: overrides.resourceRequirements || {},
      compatibilityInfo: overrides.compatibilityInfo || {},
      documentationUrl: overrides.documentationUrl,
      featured: overrides.featured || false
    }
  },

  // Create a valid service import for testing
  createServiceImport: (categoryId: number, overrides: {
    sourceUrl?: string
    sourceType?: 'docker_hub' | 'github' | 'manual'
    submittedBy?: string
  } = {}) => {
    return {
      sourceUrl: overrides.sourceUrl || 'https://hub.docker.com/_/nginx',
      sourceType: overrides.sourceType || 'docker_hub' as const,
      categoryId,
      submittedBy: overrides.submittedBy || 'test@example.com'
    }
  },

  // Create valid port configuration
  createPortConfig: (overrides: {
    containerPort?: number
    hostPort?: number
    protocol?: 'tcp' | 'udp'
    description?: string
  } = {}) => {
    return {
      containerPort: overrides.containerPort || 80,
      hostPort: overrides.hostPort,
      protocol: overrides.protocol || 'tcp' as const,
      description: overrides.description
    }
  },

  // Create valid environment variable configuration
  createEnvVarConfig: (overrides: {
    name?: string
    defaultValue?: string
    required?: boolean
    type?: 'string' | 'number' | 'boolean' | 'password'
    description?: string
  } = {}) => {
    return {
      name: overrides.name || 'TEST_VAR',
      defaultValue: overrides.defaultValue,
      required: overrides.required || false,
      type: overrides.type || 'string' as const,
      description: overrides.description
    }
  },

  // Create valid resource requirements
  createResourceRequirements: (overrides: {
    minCpu?: number
    recommendedCpu?: number
    minMemory?: number
    recommendedMemory?: number
    storageRequired?: boolean
    minimumStorage?: number
  } = {}) => {
    return {
      minCpu: overrides.minCpu,
      recommendedCpu: overrides.recommendedCpu,
      minMemory: overrides.minMemory,
      recommendedMemory: overrides.recommendedMemory,
      storageRequired: overrides.storageRequired,
      minimumStorage: overrides.minimumStorage
    }
  },

  // Create tRPC context with userId for test files
  createTRPCContext: (overrides: {
    userId?: string
  } = {}) => {
    return {
      userId: overrides.userId || 'test-user-123'
    }
  },

  // Create service mock data with proper slug for state management tests
  createServiceMockData: (overrides: {
    id?: string
    name?: string
    description?: string
    category?: string
    categoryId?: string | number
  } = {}) => {
    const name = overrides.name || 'Test Service'
    const slug = TestDataFactory.generateSlug(name)
    
    return {
      id: overrides.id || 'service-1',
      name,
      slug,
      description: overrides.description || 'Test service description',
      dockerImage: 'test/service:latest',
      category: overrides.category || 'Test Category',
      categoryId: overrides.categoryId || 1,
      ports: [{ containerPort: 3000, protocol: 'tcp' as const }],
      environmentVariables: [],
      volumes: [],
      featured: false,
      pricing: 'free',
      popularity: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  },

  // Create service filters with proper typing
  createServiceFilters: (overrides: {
    categories?: string[]
    popularity?: number
    sortBy?: string
  } = {}) => {
    return {
      categories: overrides.categories || [],
      popularity: overrides.popularity ?? 0, // Use number, not string
      sortBy: overrides.sortBy || 'popularity'
    }
  },

  // Create malicious payload data with proper slug for security tests
  createMaliciousPayload: (payload: string) => {
    const name = `Test ${payload} Category`
    return {
      name,
      slug: TestDataFactory.generateSlug(name),
      description: `Description with ${payload} command`,
      sortOrder: 1
    }
  },

  // Create bulk service data for performance tests
  createBulkServiceData: (count: number = 3, categoryId: number = 1) => {
    return Array.from({ length: count }, (_, index) => {
      const name = `Test Service ${index + 1}`
      return {
        name,
        slug: TestDataFactory.generateSlug(name),
        description: `Description for test service ${index + 1}`,
        dockerImage: `test/service${index + 1}:latest`,
        version: '1.0.0',
        categoryId,
        status: 'approved'
      }
    })
  },

  // Fix cursor type issues (string vs number)
  normalizeCursor: (cursor: string | number | null | undefined): number | null => {
    if (cursor === null || cursor === undefined) return null
    if (typeof cursor === 'string') {
      const parsed = parseInt(cursor, 10)
      return isNaN(parsed) ? null : parsed
    }
    return cursor
  }
}

export default TestDataFactory

// Database helper functions for tests
export const createTestData = {
  category: async (data: { name: string; slug?: string; description?: string; sortOrder?: number; icon?: string }) => {
    return await testPrisma.category.create({
      data: {
        name: data.name,
        slug: data.slug || ValidationHelpers.generateSlug(data.name),
        description: data.description || 'Test category',
        sortOrder: data.sortOrder || 1,
        icon: data.icon || null
      }
    })
  },

  service: async (data: { name: string; slug?: string; description?: string; categoryId: number; dockerImage?: string; version?: string }) => {
    return await testPrisma.service.create({
      data: {
        name: data.name,
        slug: data.slug || ValidationHelpers.generateSlug(data.name),
        description: data.description || 'Test service',
        categoryId: data.categoryId,
        dockerImage: data.dockerImage || 'test:latest',
        version: data.version || 'latest',
        status: 'approved'
      }
    })
  }
}

// Cleanup function to remove test data
export const cleanupTestData = async () => {
  // Delete in order to avoid foreign key constraints
  // Deployment-related first
  try { await (testPrisma as any).deploymentJob.deleteMany({}) } catch {}
  try { await (testPrisma as any).deploymentArtifact.deleteMany({}) } catch {}
  try { await (testPrisma as any).deploymentTargetOverride.deleteMany({}) } catch {}
  try { await (testPrisma as any).deploymentTarget.deleteMany({}) } catch {}

  // Existing domain data
  await testPrisma.stackServiceConfiguration.deleteMany({})
  await testPrisma.stackService.deleteMany({})
  await testPrisma.stack.deleteMany({})
  await testPrisma.serviceImport.deleteMany({})
  await testPrisma.service.deleteMany({})
  await testPrisma.category.deleteMany({})
}
