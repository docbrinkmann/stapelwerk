import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { appRouter } from '@/server/root'
import { createTRPCContext } from '@/server/trpc'
import { prisma } from '@/lib/database/prisma'
import { TRPCError } from '@trpc/server'
import { TestDataFactory } from '@/__tests__/helpers/test-data-factory'

/**
 * Input Validation Boundary and Edge Case Tests
 * 
 * Test suite validating input validation boundaries, edge cases, malformed inputs,
 * oversized payloads, and invalid data types. Ensures proper HTTP error codes 
 * (400, 422) and security error responses are returned.
 */

describe('Input Validation Boundary Tests', () => {
  let caller: ReturnType<typeof appRouter.createCaller>

  beforeAll(async () => {
    // Clean test database
    await prisma.service_imports.deleteMany()
    await prisma.services.deleteMany()
    await prisma.categories.deleteMany()
  })

  afterAll(async () => {
    await prisma.service_imports.deleteMany()
    await prisma.services.deleteMany()
    await prisma.categories.deleteMany()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Create fresh caller with clean context
    const mockReq = {
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Test Client'
      },
      method: 'POST',
      url: 'http://localhost:3000/api/trpc'
    } as any

    const ctx = await createTRPCContext({
      req: mockReq
    })

    caller = appRouter.createCaller(ctx)
  })

  describe('String Length Validation Boundaries', () => {
    it('should enforce minimum length requirements', async () => {
      const minLengthTests = [
        { field: 'name', value: '', minLength: 2 },
        { field: 'name', value: 'A', minLength: 2 },
        { field: 'description', value: '', minLength: 10 },
        { field: 'description', value: 'Short', minLength: 10 }
      ]

      for (const test of minLengthTests) {
        await expect(caller.categories.create(TestDataFactory.createCategory(
          test.field === 'name'
            ? { name: test.value }
            : { name: 'Valid Name', description: test.value }
        ))).rejects.toThrow()
      }
    })

    it('should enforce maximum length requirements', async () => {
      const maxLengthTests = [
        { field: 'name', value: 'A'.repeat(101), maxLength: 100 },
        { field: 'description', value: 'A'.repeat(1001), maxLength: 1000 }
      ]

      for (const test of maxLengthTests) {
        try {
          await caller.categories.create(TestDataFactory.createCategory(
            test.field === 'name'
              ? { name: test.value }
              : { name: 'Valid Name', description: test.value }
          ))
          // Should not reach here
          expect(true).toBe(false)
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError)
          const trpcError = error as TRPCError
          expect(trpcError.code).toBe('BAD_REQUEST')
        }
      }
    })

    it('should accept values at exact length boundaries', async () => {
      // Test minimum acceptable lengths
      const minBoundaryCategory = await caller.categories.create(
        TestDataFactory.createCategory({ name: 'AB', description: '1234567890' })
      )

      expect(minBoundaryCategory.name).toBe('AB')
      expect(minBoundaryCategory.description).toBe('1234567890')

      // Test maximum acceptable lengths
      const maxBoundaryCategory = await caller.categories.create(
        TestDataFactory.createCategory({ name: 'A'.repeat(100), description: 'A'.repeat(1000) })
      )

      expect(maxBoundaryCategory.name).toHaveLength(100)
      expect(maxBoundaryCategory.description).toHaveLength(1000)
    })
  })

  describe('Numeric Value Boundaries', () => {
    it('should enforce port number boundaries', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      const invalidPortTests = [
        { containerPort: 0, description: 'Zero port' },
        { containerPort: -1, description: 'Negative port' },
        { containerPort: 65536, description: 'Port too high' },
        { containerPort: 99999, description: 'Way too high port' }
      ]

      for (const test of invalidPortTests) {
        await expect(caller.services.create({
          name: 'Test Service',
          description: 'Clean service',
          dockerImage: 'nginx:latest',
          version: 'latest',
          categoryId: category.id,
          ports: [
            {
              containerPort: test.containerPort,
              protocol: 'tcp' as const
            }
          ]
        })).rejects.toThrow()
      }
    })

    it('should accept valid port boundaries', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      const validPortTests = [
        { containerPort: 1, description: 'Minimum valid port' },
        { containerPort: 65535, description: 'Maximum valid port' },
        { containerPort: 80, description: 'Common HTTP port' },
        { containerPort: 443, description: 'Common HTTPS port' }
      ]

      for (const test of validPortTests) {
        const service = await caller.services.create({
          name: `Test Service ${test.containerPort}`,
          description: `Service with ${test.description}`,
          dockerImage: 'nginx:latest',
          version: 'latest',
          categoryId: category.id,
          ports: [
            {
              containerPort: test.containerPort,
              protocol: 'tcp' as const
            }
          ]
        })

        expect(service.ports[0].containerPort).toBe(test.containerPort)
      }
    })

    it('should enforce resource requirement boundaries', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      const invalidResourceTests = [
        { minCpu: -1, field: 'minCpu' },
        { recommendedCpu: 0, field: 'recommendedCpu' },
        { minMemory: -512, field: 'minMemory' },
        { recommendedMemory: 0, field: 'recommendedMemory' },
        { minimumStorage: -100, field: 'minimumStorage' }
      ]

      for (const test of invalidResourceTests) {
        await expect(caller.services.create({
          name: `Resource Test ${test.field}`,
          description: 'Service with invalid resource requirements',
          dockerImage: 'nginx:latest',
          version: 'latest',
          categoryId: category.id,
          resourceRequirements: test
        })).rejects.toThrow()
      }
    })
  })

  describe('Type Validation and Coercion', () => {
    it('should reject invalid data types', async () => {
      const typeViolationTests = [
        { name: 123, expectedField: 'name' }, // Number instead of string
        { name: true, expectedField: 'name' }, // Boolean instead of string
        { name: [], expectedField: 'name' }, // Array instead of string
        { name: {}, expectedField: 'name' }, // Object instead of string
        { sortOrder: '1', expectedField: 'sortOrder' }, // String instead of number
        { sortOrder: true, expectedField: 'sortOrder' }, // Boolean instead of number
        { sortOrder: [], expectedField: 'sortOrder' } // Array instead of number
      ]

      for (const test of typeViolationTests) {
        try {
          await caller.categories.create({
            name: 'Default Name',
        slug: TestDataFactory.generateSlug('Default Name'),
            description: 'Default description',
            sortOrder: 1,
            ...test
          } as any)
          // Should not reach here
          expect(true).toBe(false)
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError)
          const trpcError = error as TRPCError
          expect(trpcError.code).toBe('BAD_REQUEST')
        }
      }
      })

    it('should handle null and undefined values appropriately', async () => {
      // Test required fields with null/undefined
      const nullTests = [
        { name: null },
        { name: undefined },
        { description: null }, // Required field
        { sortOrder: null },
        { sortOrder: undefined }
      ]

      for (const test of nullTests) {
        await expect(caller.categories.create({
          name: 'Test Category',
          description: 'Test description',
          sortOrder: 1,
          ...test
        } as any)).rejects.toThrow()
      }

      // Test optional fields with null/undefined (should succeed)
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      expect(category.icon).toBeNull()
    })
  })

  describe('Array Validation Boundaries', () => {
    it('should handle empty arrays correctly', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      // Empty arrays should be allowed for optional array fields
      const service = await caller.services.create({
        name: 'Test Service',
        description: 'Service with empty arrays',
        dockerImage: 'nginx:latest',
        version: 'latest',
        categoryId: category.id,
        ports: [], // Empty array
        environmentVariables: [] // Empty array
      })

      expect(service.ports).toEqual([])
      expect(service.environmentVariables).toEqual([])
    })

    it('should validate array element types', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      // Invalid array elements should be rejected
      await expect(caller.services.create({
        name: 'Test Service',
        description: 'Service with invalid port array',
        dockerImage: 'nginx:latest',
        version: 'latest',
        categoryId: category.id,
        ports: [
          'invalid port object' // String instead of port config object
        ]
      } as any)).rejects.toThrow()
    })

    it('should handle large arrays within limits', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      // Create service with many environment variables (within reasonable limits)
      const manyEnvVars = Array.from({ length: 50 }, (_, i) => ({
        name: `VAR_${i}`,
        defaultValue: `value_${i}`,
        required: false,
        type: 'string' as const,
        description: `Environment variable ${i}`
      }))

      const service = await caller.services.create({
        name: 'Service with Many Env Vars',
        description: 'Service testing array limits',
        dockerImage: 'nginx:latest',
        version: 'latest',
        categoryId: category.id,
        environmentVariables: manyEnvVars
      })

      expect(service.environmentVariables).toHaveLength(50)
    })
  })

  describe('Enum Validation', () => {
    it('should reject invalid enum values', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      const invalidEnumTests = [
        { protocol: 'http' }, // Only 'tcp' or 'udp' are valid
        { protocol: 'TCP' }, // Case-sensitive enum
        { protocol: 123 },
        { protocol: null },
        { protocol: undefined }
      ]

      for (const test of invalidEnumTests) {
        await expect(caller.services.create({
          name: 'Test Service',
          description: 'Service with invalid enum',
          dockerImage: 'nginx:latest',
          version: 'latest',
          categoryId: category.id,
          ports: [
            {
              containerPort: 80,
              ...test
            }
          ]
        } as any)).rejects.toThrow()
      }
    })

    it('should accept valid enum values', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      const validProtocols = ['tcp', 'udp']

      for (const protocol of validProtocols) {
        const service = await caller.services.create({
          name: `Service with ${protocol}`,
          description: `Service using ${protocol} protocol`,
          dockerImage: 'nginx:latest',
          version: 'latest',
          categoryId: category.id,
          ports: [
            {
              containerPort: 80,
              protocol: protocol as 'tcp' | 'udp'
            }
          ]
        })

        expect(service.ports[0].protocol).toBe(protocol)
      }
    })
  })

  describe('Regular Expression Validation', () => {
    it('should validate Docker image format', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      const invalidDockerImages = [
        'INVALID-IMAGE-NAME', // Uppercase not allowed
        'invalid_image:', // Missing tag
        'image::', // Double colon
        'image:tag:extra', // Too many colons
        '', // Empty string
        'image/with/too/many/slashes/test:latest' // Too many path segments
      ]

      for (const dockerImage of invalidDockerImages) {
        await expect(caller.services.create({
          name: 'Test Service',
          description: 'Service with invalid Docker image',
          dockerImage,
          version: 'latest',
          categoryId: category.id
        })).rejects.toThrow()
      }
    })

    it('should accept valid Docker image formats', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      const validDockerImages = [
        'nginx:latest',
        'redis:6.2',
        'postgres:13',
        'registry.io/namespace/image:tag',
        'private-registry.com/team/service:v1.0.0'
      ]

      for (const dockerImage of validDockerImages) {
        const service = await caller.services.create({
          name: `Service image ${validDockerImages.indexOf(dockerImage)}`,
          description: 'Service with valid Docker image',
          dockerImage,
          version: 'latest',
          categoryId: category.id
        })

        expect(service.dockerImage).toBe(dockerImage)
      }
    })

    it('should validate environment variable names', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      const invalidEnvVarNames = [
        'lowercase_var', // Should start with uppercase
        '123VAR', // Should not start with number
        'VAR-NAME', // Hyphens not allowed
        'VAR.NAME', // Dots not allowed
        'VAR NAME', // Spaces not allowed
        '', // Empty string
      ]

      for (const varName of invalidEnvVarNames) {
        await expect(caller.services.create({
          name: 'Test Service',
          description: 'Service with invalid env var name',
          dockerImage: 'nginx:latest',
          version: 'latest',
          categoryId: category.id,
          environmentVariables: [
            {
              name: varName,
              defaultValue: 'test',
              required: false,
              type: 'string',
              description: 'Test variable'
            }
          ]
        })).rejects.toThrow()
      }
    })
  })

  describe('URL Validation Boundaries', () => {
    it('should validate documentation URLs strictly', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      const invalidUrls = [
        'not-a-url',
        'ftp://invalid-protocol.com',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'file:///etc/passwd',
        'http://', // Incomplete URL
        'https://', // Incomplete URL
        'http://[invalid-ipv6',
        '', // Empty string
      ]

      for (const url of invalidUrls) {
        await expect(caller.services.create({
          name: 'Test Service',
          description: 'Service with invalid URL',
          dockerImage: 'nginx:latest',
          version: 'latest',
          categoryId: category.id,
          documentationUrl: url
        })).rejects.toThrow()
      }
    })

    it('should accept valid HTTP/HTTPS URLs', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      const validUrls = [
        'https://example.com',
        'http://example.com',
        'https://example.com/path',
        'https://example.com/path?query=value',
        'https://example.com:8080',
        'https://subdomain.example.com'
      ]

      for (const url of validUrls) {
        const service = await caller.services.create({
          name: `Service url ${validUrls.indexOf(url)}`,
          description: 'Service with valid URL',
          dockerImage: 'nginx:latest',
          version: 'latest',
          categoryId: category.id,
          documentationUrl: url
        })

        expect(service.documentationUrl).toBe(url)
      }
    })
  })

  describe('Error Response Validation', () => {
    it('should return proper error codes for different validation failures', async () => {
      const errorCodeTests = [
        {
          input: { name: '', description: 'Valid desc', sortOrder: 1 },
          expectedCode: 'BAD_REQUEST',
          description: 'Empty required field'
        },
        {
          input: { name: 'Valid', description: 'Valid desc', sortOrder: 'invalid' },
          expectedCode: 'BAD_REQUEST',
          description: 'Invalid type'
        },
        {
          input: { name: 'A'.repeat(200), description: 'Valid desc', sortOrder: 1 },
          expectedCode: 'BAD_REQUEST',
          description: 'Field too long'
        }
      ]

      for (const test of errorCodeTests) {
        try {
          await caller.categories.create(test.input as any)
          expect(true).toBe(false) // Should not reach here
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError)
          const trpcError = error as TRPCError
          expect(trpcError.code).toBe(test.expectedCode)
        }
      }
    })

    it('should provide helpful error messages without exposing internals', async () => {
      try {
        await caller.categories.create(TestDataFactory.createCategory({ name: '' }))
      } catch (error) {
        const errorMessage = (error as Error).message

        // Should contain helpful information
        expect(errorMessage.toLowerCase()).toMatch(/(required|empty|minimum|length)/i)

        // Should not expose internal details
        expect(errorMessage).not.toContain('prisma')
        expect(errorMessage).not.toContain('database')
        expect(errorMessage).not.toContain('internal')
        expect(errorMessage).not.toContain('stack')
      }
    })
  })

  describe('Complex Validation Scenarios', () => {
    it('should handle nested validation errors', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      // Test nested object validation (ports and environment variables)
      await expect(caller.services.create({
        name: 'Test Service',
        description: 'Service with invalid nested data',
        dockerImage: 'nginx:latest',
        version: 'latest',
        categoryId: category.id,
        ports: [
          {
            containerPort: 99999, // Invalid port
            protocol: 'tcp' as const
          }
        ],
        environmentVariables: [
          {
            name: 'invalid-name', // Invalid env var name
            defaultValue: 'test',
            required: true,
            type: 'string',
            description: 'Test var'
          }
        ]
      })).rejects.toThrow()
    })

    it('should validate cross-field constraints', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      // Test that hostPort can be provided when containerPort is valid
      const service = await caller.services.create({
        name: 'Valid Service',
        description: 'Service with valid port mapping',
        dockerImage: 'nginx:latest',
        version: 'latest',
        categoryId: category.id,
        ports: [
          {
            containerPort: 80,
            hostPort: 8080,
            protocol: 'tcp' as const
          }
        ]
      })

      expect(service.ports[0].containerPort).toBe(80)
      expect(service.ports[0].hostPort).toBe(8080)
    })
  })

  describe('Performance Under Validation Load', () => {
    it('should handle validation of large payloads efficiently', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Performance Test Category' }))

      const startTime = Date.now()

      // Create service with maximum allowed data
      const service = await caller.services.create({
        name: 'A'.repeat(100), // Max length
        description: 'B'.repeat(1000), // Max length
        dockerImage: 'nginx:latest',
        version: 'latest',
        categoryId: category.id,
        ports: Array.from({ length: 10 }, (_, i) => ({
          containerPort: 8000 + i,
          protocol: 'tcp' as const,
          description: `Port ${i} description`.repeat(10) // Long description
        })),
        environmentVariables: Array.from({ length: 20 }, (_, i) => ({
          name: `LARGE_VAR_${i}`,
          defaultValue: 'X'.repeat(100), // Long default value
          required: false,
          type: 'string' as const,
          description: `Variable ${i} description`.repeat(10)
        }))
      })

      const duration = Date.now() - startTime

      // Validation should complete quickly even with large payloads
      expect(duration).toBeLessThan(1000) // Less than 1 second
      expect(service.name).toHaveLength(100)
      expect(service.description).toHaveLength(1000)
      expect(service.ports).toHaveLength(10)
      expect(service.environmentVariables).toHaveLength(20)
    })
  })
})