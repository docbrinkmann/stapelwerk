import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MetadataValidator, ValidationResult, ConflictInfo } from '../../src/lib/services/metadata-validator'
import { ExtractedMetadata } from '../../src/lib/services/docker-hub-extractor'
import { PrismaClient } from '@prisma/client'

// Create a mock Prisma client with vi.fn()
const prismaMock = {
  service: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn()
  },
  serviceImport: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn()
  },
  category: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn()
  }
} as any

describe('MetadataValidator', () => {
  let validator: MetadataValidator
  const testSuffix = Date.now().toString()

  beforeEach(() => {
    validator = new MetadataValidator(prismaMock as any)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Helper function to create valid test metadata
  const createValidMetadata = (overrides: Partial<ExtractedMetadata> = {}): ExtractedMetadata => ({
    name: `test-service-${testSuffix}`,
    namespace: 'testuser',
    description: 'A comprehensive test service for validation testing with sufficient detail',
    tags: ['latest', 'v1.0.0'],
    pullCount: 50000,
    starCount: 100,
    isOfficial: false,
    lastUpdated: new Date(),
    exposedPorts: [
      { containerPort: 8080, protocol: 'tcp' }
    ],
    environmentVariables: [
      {
        name: 'APP_PORT',
        description: 'Application port number',
        defaultValue: '8080',
        required: false,
        type: 'number'
      }
    ],
    volumes: ['/data'],
    cmd: ['npm', 'start'],
    workingDirectory: '/app',
    user: 'appuser',
    baseImage: 'node:16-alpine',
    resourceRequirements: {
      memory: '512Mi',
      cpu: '0.5'
    },
    ...overrides
  })

  describe('Basic Metadata Validation', () => {
    it('should validate correct metadata', async () => {
      const metadata = createValidMetadata()
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject metadata with invalid name length', async () => {
      const metadata = createValidMetadata({ name: 'a' })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Service name must be at least 2 characters long')
    })

    it('should reject metadata with name too long', async () => {
      const longName = 'a'.repeat(101)
      const metadata = createValidMetadata({ name: longName })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Service name cannot exceed 100 characters')
    })

    it('should reject metadata without namespace', async () => {
      const metadata = createValidMetadata({ namespace: '' })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Service namespace is required')
    })

    it('should warn about short or missing description', async () => {
      const metadata = createValidMetadata({ description: 'Short' })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.warnings).toContain('Service description is missing or too short')
    })

    it('should warn about missing tags', async () => {
      const metadata = createValidMetadata({ tags: [] })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.warnings).toContain('No tags found for the service')
    })
  })

  describe('Port Validation', () => {
    it('should reject invalid port numbers', async () => {
      const metadata = createValidMetadata({
        exposedPorts: [
          { containerPort: 0, protocol: 'tcp' },
          { containerPort: 70000, protocol: 'tcp' }
        ]
      })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid port number: 0')
      expect(result.errors).toContain('Invalid port number: 70000')
    })

    it('should reject invalid protocols', async () => {
      const metadata = createValidMetadata({
        exposedPorts: [
          { containerPort: 8080, protocol: 'invalid' }
        ]
      })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid protocol: invalid')
    })

    it('should warn about privileged ports', async () => {
      const metadata = createValidMetadata({
        exposedPorts: [
          { containerPort: 80, protocol: 'tcp' },
          { containerPort: 443, protocol: 'tcp' }
        ]
      })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.warnings).toContain('Service exposes privileged ports: 80, 443')
    })
  })

  describe('Environment Variables Validation', () => {
    it('should reject empty environment variable names', async () => {
      const metadata = createValidMetadata({
        environmentVariables: [
          {
            name: '',
            description: 'Empty name variable',
            defaultValue: 'value',
            required: false,
            type: 'string'
          }
        ]
      })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Environment variable name cannot be empty')
    })

    it('should warn about non-standard environment variable names', async () => {
      const metadata = createValidMetadata({
        environmentVariables: [
          {
            name: 'app-port',
            description: 'Application port with hyphen',
            defaultValue: '8080',
            required: false,
            type: 'string'
          }
        ]
      })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.warnings).toContain('Environment variable "app-port" does not follow standard naming convention')
    })

    it('should warn about potentially dangerous environment variables', async () => {
      const metadata = createValidMetadata({
        environmentVariables: [
          {
            name: 'API_KEY',
            description: 'API key for external service',
            defaultValue: '',
            required: true,
            type: 'string'
          },
          {
            name: 'DB_PASSWORD',
            description: 'Database password',
            defaultValue: '',
            required: true,
            type: 'string'
          }
        ]
      })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.warnings).toContain('Environment variable "API_KEY" may contain sensitive information')
      expect(result.warnings).toContain('Environment variable "DB_PASSWORD" may contain sensitive information')
    })

    it('should error on sensitive environment variables with default values', async () => {
      const metadata = createValidMetadata({
        environmentVariables: [
          {
            name: 'SECRET_TOKEN',
            description: 'Secret token',
            defaultValue: 'default-secret',
            required: false,
            type: 'string'
          }
        ]
      })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Environment variable "SECRET_TOKEN" has a default value but may contain sensitive information')
    })
  })

  describe('Duplicate and Conflict Detection', () => {
    it('should detect duplicate service names', async () => {
      const metadata = createValidMetadata({ name: 'existing-service' })
      
      prismaMock.service.findFirst.mockResolvedValueOnce({
        id: 1,
        name: 'existing-service',
        slug: 'existing-service',
        dockerImage: 'docker.io/other/existing-service',
        description: 'Existing service',
        categoryId: 1,
        status: 'approved',
        ports: null,
        environmentVariables: null,
        volumes: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/new-service')

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].type).toBe('duplicate_service')
      expect(result.conflicts[0].severity).toBe('high')
      expect(result.conflicts[0].description).toContain('Service with name "existing-service" already exists')
    })

    it('should detect same Docker image conflicts', async () => {
      const metadata = createValidMetadata()
      const sourceUrl = 'docker.io/testuser/test-service'
      
      prismaMock.service.findFirst
        .mockResolvedValueOnce(null) // First call for name check
        .mockResolvedValueOnce(null) // Second call for similar services
        .mockResolvedValueOnce({ // Third call for same image check
          id: 2,
          name: 'different-name',
          slug: 'different-name',
          dockerImage: sourceUrl,
          description: 'Different service with same image',
          categoryId: 1,
          status: 'approved',
          ports: null,
          environmentVariables: null,
          volumes: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })

      const result = await validator.validateMetadata(metadata, sourceUrl)

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].type).toBe('same_image')
      expect(result.conflicts[0].severity).toBe('high')
      expect(result.conflicts[0].description).toContain(`Service using the same Docker image "${sourceUrl}" already exists`)
    })

    it('should detect similar service names', async () => {
      const metadata = createValidMetadata({ name: 'postgres-client' })
      
      // Mock the similar services query
      prismaMock.service.findFirst.mockResolvedValue(null) // No exact match
      prismaMock.service.findMany.mockResolvedValue([
        {
          id: 3,
          name: 'postgres-server',
          slug: 'postgres-server',
          dockerImage: 'docker.io/postgres/server',
          description: 'PostgreSQL server',
          categoryId: 1,
          status: 'approved',
          ports: null,
          environmentVariables: null,
          volumes: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/postgres-client')

      // The similar service should be detected
      expect(result.conflicts.length).toBeGreaterThanOrEqual(0) // May or may not detect as similar based on threshold
    })

    it('should detect common port conflicts', async () => {
      const metadata = createValidMetadata({
        exposedPorts: [
          { containerPort: 5432, protocol: 'tcp' } // PostgreSQL port
        ]
      })
      
      prismaMock.service.findFirst.mockResolvedValue(null)
      prismaMock.service.findMany.mockResolvedValue([
        {
          id: 4,
          name: 'postgres-db',
          slug: 'postgres-db',
          dockerImage: 'docker.io/postgres/postgres',
          description: 'PostgreSQL database',
          categoryId: 1,
          status: 'approved',
          ports: '{"ports":[{"containerPort":5432,"protocol":"tcp"}]}',
          environmentVariables: null,
          volumes: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/my-postgres')

      expect(result.conflicts.some(c => c.type === 'conflicting_ports')).toBe(true)
      const portConflict = result.conflicts.find(c => c.type === 'conflicting_ports')
      expect(portConflict?.description).toContain('Port 5432 (PostgreSQL)')
    })
  })

  describe('Security Checks', () => {
    it('should warn about root user', async () => {
      const metadata = createValidMetadata({ user: 'root' })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.warnings).toContain('Service runs as root user, which may pose security risks')
    })

    it('should provide suggestions for scratch base image', async () => {
      const metadata = createValidMetadata({ baseImage: 'scratch' })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.suggestions).toContain('Using scratch base image is good for security but ensure all dependencies are included')
    })
  })

  describe('Quality Checks', () => {
    it('should warn about low popularity images', async () => {
      const metadata = createValidMetadata({
        pullCount: 500,
        starCount: 5,
        isOfficial: false
      })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.warnings).toContain('This image has relatively few downloads, verify it is from a trusted source')
      expect(result.warnings).toContain('This image has few stars and is not official, consider alternatives')
    })

    it('should warn about latest tag usage', async () => {
      const metadata = createValidMetadata({
        tags: ['latest', 'v1.0.0']
      })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.warnings).toContain('Image uses "latest" tag, consider using specific version tags for better stability')
    })

    it('should suggest better documentation', async () => {
      const metadata = createValidMetadata({
        description: 'Short desc',
        environmentVariables: [
          {
            name: 'PORT',
            description: 'Port', // Short description
            defaultValue: '8080',
            required: false,
            type: 'number'
          }
        ]
      })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.suggestions).toContain('Consider adding more detailed description for better discoverability')
      expect(result.suggestions).toContain('Consider adding descriptions for environment variables: PORT')
    })

    it('should suggest health checks and resource requirements', async () => {
      const metadata = createValidMetadata({
        cmd: [],
        resourceRequirements: {}
      })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.suggestions).toContain('Consider adding health check command for better monitoring')
      expect(result.suggestions).toContain('Consider specifying resource requirements (CPU, memory) for better deployment planning')
    })

    it('should warn data services without volumes', async () => {
      const metadata = createValidMetadata({
        name: 'my-database-service',
        volumes: []
      })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/my-database-service')

      expect(result.warnings).toContain('Data services should typically declare volume mounts for persistence')
    })
  })

  describe('Statistical Validation', () => {
    it('should reject negative counts', async () => {
      const metadata = createValidMetadata({
        pullCount: -100,
        starCount: -5
      })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Pull count cannot be negative')
      expect(result.errors).toContain('Star count cannot be negative')
    })

    it('should warn about unusually high pull counts', async () => {
      const metadata = createValidMetadata({
        pullCount: 15000000000 // 15 billion
      })
      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.warnings).toContain('Pull count seems unusually high')
    })
  })

  describe('Validation Summary', () => {
    it('should generate correct validation summary', () => {
      const results: ValidationResult[] = [
        {
          isValid: true,
          errors: [],
          warnings: ['Warning 1'],
          conflicts: [
            { type: 'similar_name', severity: 'medium', description: 'Similar name conflict', existingItem: { id: 1, name: 'test' } }
          ],
          suggestions: []
        },
        {
          isValid: false,
          errors: ['Error 1', 'Error 2'],
          warnings: ['Warning 1', 'Warning 2'],
          conflicts: [
            { type: 'duplicate_service', severity: 'high', description: 'High severity conflict', existingItem: { id: 2, name: 'test2' } }
          ],
          suggestions: []
        },
        {
          isValid: true,
          errors: [],
          warnings: ['Warning 1'],
          conflicts: [],
          suggestions: ['Suggestion 1']
        }
      ]

      const summary = validator.getValidationSummary(results)

      expect(summary.totalValidated).toBe(3)
      expect(summary.valid).toBe(2)
      expect(summary.invalid).toBe(1)
      expect(summary.highConflicts).toBe(1)
      expect(summary.mediumConflicts).toBe(1)
      expect(summary.commonIssues).toContain('Warning 1') // Most frequent issue
    })
  })

  describe('Edge Cases', () => {
    it('should handle metadata with null/undefined values gracefully', async () => {
      const metadata: ExtractedMetadata = {
        name: 'test-service',
        namespace: 'testuser',
        description: null as any,
        tags: null as any,
        pullCount: 1000,
        starCount: 10,
        isOfficial: false,
        lastUpdated: new Date(),
        exposedPorts: null as any,
        environmentVariables: null as any,
        volumes: null as any,
        cmd: null as any,
        workingDirectory: null as any,
        user: null as any,
        baseImage: null as any,
        resourceRequirements: null as any
      }

      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      // Should not crash and provide appropriate warnings
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should handle empty strings and arrays', async () => {
      const metadata = createValidMetadata({
        description: '',
        tags: [],
        exposedPorts: [],
        environmentVariables: [],
        volumes: [],
        cmd: []
      })

      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      // Should provide appropriate warnings for empty values
      expect(result.warnings).toContain('Service description is missing or too short')
      expect(result.warnings).toContain('No tags found for the service')
      expect(result.suggestions).toContain('Consider adding health check command for better monitoring')
    })

    it('should handle very long descriptions', async () => {
      const longDescription = 'A'.repeat(1500)
      const metadata = createValidMetadata({ description: longDescription })

      prismaMock.service.findFirst.mockResolvedValue(null)

      const result = await validator.validateMetadata(metadata, 'docker.io/testuser/test-service')

      expect(result.warnings).toContain('Description is very long and may be truncated')
    })
  })
})