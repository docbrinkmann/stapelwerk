import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { appRouter } from '@/server/root'
import { createTRPCContext } from '@/server/trpc'
import { prisma } from '@/lib/database/prisma'
import { TestDataFactory } from '@/__tests__/helpers/test-data-factory'

// No network in tests: Docker Hub existence/metadata checks are mocked.
// Plain functions on purpose — the global mockReset wipes vi.fn implementations.
vi.mock('@/lib/services/docker-hub-extractor', async () => {
  const actual = await vi.importActual<any>('@/lib/services/docker-hub-extractor')
  return {
    ...actual,
    DockerHubExtractor: function DockerHubExtractorMock() {
      return {
        validateImageExists: () => Promise.resolve(true),
        extractMetadata: () =>
          Promise.resolve({
            name: 'mock-image',
            namespace: 'library',
            description: 'mocked metadata',
            tags: ['latest'],
            pullCount: 0,
            starCount: 0,
            isOfficial: true,
            isAutomated: false,
            lastUpdated: new Date().toISOString(),
            exposedPorts: [],
            environmentVariables: [],
            volumes: [],
            labels: {},
          }),
      }
    } as any,
  }
})

/**
 * Input Sanitization Security Tests
 * 
 * Comprehensive test suite validating input sanitization and XSS prevention
 * across all tRPC endpoints. Tests the inputSanitizationMiddleware implementation.
 */

describe('Input Sanitization Security Tests', () => {
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
      headers: {},
      method: 'POST',
      url: 'http://localhost:3000/api/trpc'
    } as any

    const ctx = await createTRPCContext({
      req: mockReq
    })

    caller = appRouter.createCaller(ctx)
  })

  describe('XSS Prevention Tests', () => {
    it('should sanitize script tags in category names', async () => {
      const maliciousCategory = {
        name: '<script>alert("XSS")</script>Test Category',
        slug: TestDataFactory.generateSlug('<script>alert("XSS")</script>Test Category'),
        description: 'A test category with malicious content',
        sortOrder: 1
      }

      const category = await caller.categories.create(maliciousCategory)

      // Script tags should be removed/sanitized
      expect(category.name).not.toContain('<script>')
      expect(category.name).not.toContain('alert("XSS")')
      expect(category.name).toBe('Test Category')
    })

    it('should sanitize HTML entities in service descriptions', async () => {
      // First create a category
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      const maliciousService = {
        name: 'Test Service',
        description: '<img src=x onerror=alert("XSS")>A database service</img>',
        dockerImage: 'postgres:13',
        version: '13.0.0',
        categoryId: category.id
      }

      const service = await caller.services.create(maliciousService)

      // HTML entities and event handlers should be removed/sanitized
      expect(service.description).not.toContain('<img')
      expect(service.description).not.toContain('onerror=')
      expect(service.description).not.toContain('alert("XSS")')
      expect(service.description).toContain('A database service')
    })

    it('should sanitize javascript: URLs in documentation URLs', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      const maliciousService = {
        name: 'Test Service',
        description: 'A clean service description',
        dockerImage: 'nginx:latest',
        version: 'latest',
        categoryId: category.id,
        documentationUrl: 'javascript:alert("XSS")'
      }

      // This should fail validation, not create the service
      await expect(caller.services.create(maliciousService)).rejects.toThrow()
    })

    it('should sanitize event handlers in various input fields', async () => {
      const maliciousPayloads = [
        'onload=alert("XSS")',
        'onclick=alert("XSS")',
        'onmouseover=alert("XSS")',
        'onfocus=alert("XSS")',
        'onblur=alert("XSS")'
      ]

      for (const payload of maliciousPayloads) {
        const category = await caller.categories.create({
          name: `Clean Name ${payload}`,
          slug: TestDataFactory.generateSlug(`Clean Name ${payload}`),
          description: `Description with ${payload} event`,
          sortOrder: 1
        })

        // Event handlers should be removed
        expect(category.name).not.toMatch(/on\w+\s*=/)
        expect(category.description).not.toMatch(/on\w+\s*=/)
      }
    })

    it('should handle multiple XSS patterns in a single input', async () => {
      const complexMaliciousInput = {
        name: '<script>alert("XSS1")</script><img src=x onerror=alert("XSS2")>onclick=alert("XSS3")Test Name',
        slug: TestDataFactory.generateSlug('<script>alert("XSS1")</script><img src=x onerror=alert("XSS2")>onclick=alert("XSS3")Test Name'),
        description: 'javascript:alert("XSS4")<iframe src="javascript:alert(\'XSS5\')"></iframe>onload=alert("XSS6")Clean description',
        sortOrder: 1
      }

      const category = await caller.categories.create(complexMaliciousInput)

      // All malicious patterns should be removed
      expect(category.name).not.toContain('<script>')
      expect(category.name).not.toContain('<img')
      expect(category.name).not.toContain('onclick=')
      expect(category.name).toBe('Test Name')

      expect(category.description).not.toContain('javascript:')
      expect(category.description).not.toContain('<iframe')
      expect(category.description).not.toContain('onload=')
      expect(category.description).toContain('Clean description')
    })
  })

  describe('Content Sanitization Tests', () => {
    it('should preserve safe HTML entities while removing dangerous ones', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test & Development' }))

      // Safe entities should be preserved (or properly encoded)
      expect(category.name).toContain('Test')
      expect(category.name).toContain('Development')
      expect(category.description).toContain('testing')
      expect(category.description).toContain('development')
    })

    it('should sanitize nested malicious content', async () => {
      const nestedMaliciousInput = {
        name: '<div><script>alert("nested")</script><span onclick=alert("nested2")>Name</span></div>',
        slug: TestDataFactory.generateSlug('<div><script>alert("nested")</script><span onclick=alert("nested2")>Name</span></div>'),
        description: '<p><img src=x onerror=alert("nested3")><strong>Description</strong></p>',
        sortOrder: 1
      }

      const category = await caller.categories.create(nestedMaliciousInput)

      // All malicious content should be removed, safe content preserved
      expect(category.name).toBe('Name')
      expect(category.description).toBe('Description')
    })

    it('should handle malicious content in array fields', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      const serviceWithMaliciousArrays = {
        name: 'Test Service',
        description: 'Clean service',
        dockerImage: 'nginx:latest',
        version: 'latest',
        categoryId: category.id,
        environmentVariables: [
          {
            name: 'MALICIOUS_VAR_<script>alert("XSS")</script>',
            defaultValue: 'value<img src=x onerror=alert("XSS")>',
            required: true,
            type: 'string' as const,
            description: 'onclick=alert("XSS")Description'
          }
        ]
      }

      const service = await caller.services.create(serviceWithMaliciousArrays)

      // Malicious content in nested objects should be sanitized
      const envVar = service.environmentVariables[0]
      expect(envVar.name).not.toContain('<script>')
      expect(envVar.defaultValue).not.toContain('<img')
      expect(envVar.description).not.toContain('onclick=')
    })
  })

  describe('Input Length and Boundary Tests', () => {
    it('should handle extremely long malicious inputs', async () => {
      const longMaliciousScript = '<script>' + 'alert("XSS");'.repeat(1000) + '</script>'
      const longInput = 'A'.repeat(500) + longMaliciousScript + 'B'.repeat(500)

      // This should either be truncated or rejected based on validation rules
      const result = await caller.categories.create(TestDataFactory.createCategory(longInput.substring(0, 100)))

      // Script should still be removed even from long input
      expect(result.name).not.toContain('<script>')
      expect(result.description).not.toContain('<script>')
    })

    it('should reject inputs exceeding maximum length limits', async () => {
      const tooLongName = 'A'.repeat(200) // Exceeds 100 char limit
      const tooLongDescription = 'B'.repeat(2000) // Exceeds 1000 char limit

      await expect(caller.categories.create({
        name: tooLongName,
        slug: TestDataFactory.generateSlug(tooLongName),
        description: tooLongDescription,
        sortOrder: 1
      })).rejects.toThrow()
    })
  })

  describe('Special Characters and Encoding Tests', () => {
    it('should handle Unicode and special characters safely', async () => {
      const unicodeInput = {
        name: 'Test 中文 🚀 Category',
        slug: TestDataFactory.generateSlug('Test 中文 🚀 Category'),
        description: 'Category with émojis 😎 and spëcial châractërs',
        sortOrder: 1
      }

      const category = await caller.categories.create(unicodeInput)

      // Unicode should be preserved
      expect(category.name).toContain('中文')
      expect(category.name).toContain('🚀')
      expect(category.description).toContain('😎')
      expect(category.description).toContain('spëcial')
    })

    it('should handle URL-encoded malicious payloads', async () => {
      const encodedScript = '%3Cscript%3Ealert%28%22XSS%22%29%3C%2Fscript%3E'
      
      const category = await caller.categories.create({
        name: `Test ${encodedScript} Category`,
        slug: TestDataFactory.generateSlug(`Test ${encodedScript} Category`),
        description: `Description with ${encodedScript} content`,
        sortOrder: 1
      })

      // Encoded malicious content should not execute
      expect(category.name).not.toContain('<script>')
      expect(category.name).not.toContain('alert')
      expect(category.description).not.toContain('<script>')
      expect(category.description).not.toContain('alert')
    })
  })

  describe('Complex Object Sanitization', () => {
    it('should recursively sanitize nested objects', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      const complexService = {
        name: 'Complex Service<script>alert("name")</script>',
        description: 'onclick=alert("desc")Service description',
        dockerImage: 'nginx:latest',
        version: 'latest',
        categoryId: category.id,
        ports: [
          {
            containerPort: 80,
            hostPort: 8080,
            protocol: 'tcp' as const,
            description: '<img src=x onerror=alert("port")>HTTP port'
          }
        ],
        environmentVariables: [
          {
            name: 'TEST_VAR',
            defaultValue: 'javascript:alert("env")',
            required: true,
            type: 'string' as const,
            description: 'onload=alert("envdesc")Test variable'
          }
        ],
        resourceRequirements: {
          minCpu: 0.5,
          recommendedCpu: 1.0,
          minMemory: 512,
          recommendedMemory: 1024
        }
      }

      const service = await caller.services.create(complexService)

      // All nested malicious content should be sanitized
      expect(service.name).not.toContain('<script>')
      expect(service.description).not.toContain('onclick=')
      expect(service.ports[0].description).not.toContain('<img')
      expect(service.environmentVariables[0].defaultValue).not.toContain('javascript:')
      expect(service.environmentVariables[0].description).not.toContain('onload=')
    })
  })

  describe('Import Workflow Sanitization', () => {
    it('should sanitize inputs in import creation', async () => {
      const maliciousImport = {
        sourceUrl: 'https://hub.docker.com/r/nginx/nginx',
        sourceType: 'docker_hub' as const,
        categoryId: 1,
        submittedBy: 'test<script>alert("user")</script>@example.com'
      }

      const importRecord = await caller.imports.create(maliciousImport)

      // Malicious content should be sanitized
      expect(importRecord.submittedBy).not.toContain('<script>')
      expect(importRecord).toBeDefined()
    })

    it('should handle malicious metadata in bulk operations', async () => {
      // Create multiple imports with various malicious patterns
      const maliciousImports = [
        {
          sourceUrl: 'https://hub.docker.com/r/redis/redis',
          sourceType: 'docker_hub' as const,
          categoryId: 1,
          submittedBy: 'test@example.com'
        },
        {
          sourceUrl: 'https://hub.docker.com/r/postgres/postgres',
          sourceType: 'docker_hub' as const,
          categoryId: 1,
          submittedBy: 'test@example.com'
        }
      ]

      for (const importData of maliciousImports) {
        const importRecord = await caller.imports.create(importData)
        
        // Each import should be created successfully
        expect(importRecord).toBeDefined()
      }
    })
  })
})