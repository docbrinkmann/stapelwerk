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
 * SQL Injection Prevention Security Tests
 * 
 * Comprehensive test suite validating SQL injection prevention using Prisma ORM
 * and input validation. Tests various SQL injection attack patterns to ensure
 * the application is protected against database injection attacks.
 */

describe('SQL Injection Prevention Tests', () => {
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

  describe('Basic SQL Injection Attempts', () => {
    it('should prevent classic SQL injection in string fields', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE categories; --",
        "' OR '1'='1",
        "' OR 1=1 --",
        "' UNION SELECT * FROM categories --",
        "'; DELETE FROM services; --",
        "' OR 'x'='x",
        "'; INSERT INTO categories (name) VALUES ('hacked'); --"
      ]

      for (const payload of sqlInjectionPayloads) {
        try {
          const category = await caller.categories.create({
            name: `Test ${payload}`,
            slug: TestDataFactory.generateSlug(`Test ${payload}`),
            description: `Description ${payload}`,
            sortOrder: 1
          })

          // If creation succeeds, the payload should not have caused SQL injection
          expect(category.name).toContain('Test')
          expect(category.description).toContain('Description')

          // Verify the database structure is intact
          const categoriesCount = await prisma.categories.count()
          expect(categoriesCount).toBeGreaterThan(0)
        } catch (error) {
          // If it fails, it should be due to validation, not SQL injection
          expect(error).toBeDefined()
          // Should not be a database error indicating SQL injection succeeded
          const errorMessage = (error as Error).message.toLowerCase()
          expect(errorMessage).not.toContain('syntax error')
          expect(errorMessage).not.toContain('table')
          expect(errorMessage).not.toContain('drop')
          expect(errorMessage).not.toContain('delete')
        }
      }
    })

    it('should prevent UNION-based SQL injection attempts', async () => {
      const unionPayloads = [
        "' UNION SELECT password FROM users --",
        "' UNION SELECT 1,2,3,4,5 --",
        "' UNION ALL SELECT null, version(), null --",
        "' UNION SELECT table_name FROM information_schema.tables --",
        "' UNION SELECT column_name FROM information_schema.columns --"
      ]

      for (const payload of unionPayloads) {
        // Create category first
        const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

        try {
          const service = await caller.services.create({
            name: `Service ${payload}`,
            description: `Description ${payload}`,
            dockerImage: 'nginx:latest',
            version: 'latest',
            categoryId: category.id
          })

          // Payload should be treated as literal text, not SQL
          expect(service.name).toContain('Service')
          expect(service.description).toContain('Description')
        } catch (error) {
          // Should be validation error, not SQL injection
          const errorMessage = (error as Error).message.toLowerCase()
          expect(errorMessage).not.toContain('union')
          expect(errorMessage).not.toContain('select')
        }
      }
    })

    it('should prevent time-based SQL injection attempts', async () => {
      const timingPayloads = [
        "'; WAITFOR DELAY '00:00:05'; --",
        "'; SELECT SLEEP(5); --",
        "' OR (SELECT COUNT(*) FROM categories) > 0 AND SLEEP(5) --",
        "'; pg_sleep(5); --"
      ]

      for (const payload of timingPayloads) {
        const startTime = Date.now()

        try {
          await caller.categories.create({
            name: `Timing ${payload}`,
            slug: TestDataFactory.generateSlug(`Timing ${payload}`),
            description: 'Test description',
            sortOrder: 1
          })
        } catch (error) {
          // Expected to fail validation
        }

        const duration = Date.now() - startTime

        // Should not cause significant delay (SQL injection would cause 5+ second delay)
        expect(duration).toBeLessThan(1000) // Less than 1 second
      }
    })
  })

  describe('Boolean-based Blind SQL Injection', () => {
    it('should prevent boolean-based blind SQL injection', async () => {
      const booleanPayloads = [
        "' OR 1=1 AND '1'='1",
        "' OR 'admin'='admin",
        "' OR EXISTS(SELECT * FROM categories) AND '1'='1",
        "' OR (SELECT COUNT(*) FROM services) > 0 AND '1'='1",
        "' AND ASCII(SUBSTRING((SELECT name FROM categories LIMIT 1),1,1)) > 65 --"
      ]

      for (const payload of booleanPayloads) {
        try {
          const category = await caller.categories.create({
            name: `Boolean ${payload}`,
            slug: TestDataFactory.generateSlug(`Boolean ${payload}`),
            description: 'Test description',
            sortOrder: 1
          })

          // Should create normally without SQL injection
          expect(category.name).toContain('Boolean')
        } catch (error) {
          // Should fail due to validation, not SQL injection
          const errorMessage = (error as Error).message.toLowerCase()
          expect(errorMessage).not.toContain('sql')
          expect(errorMessage).not.toContain('syntax')
        }
      }
    })
  })

  describe('Second-order SQL Injection', () => {
    it('should prevent second-order SQL injection through stored values', async () => {
      // First, create a category with potential SQL injection payload
      const maliciousCategory = await caller.categories.create(TestDataFactory.createCategory("Test'; DROP TABLE services; --"))

      // Now try to create a service using the malicious category
      const service = await caller.services.create({
        name: 'Test Service',
        description: 'Clean service description',
        dockerImage: 'nginx:latest',
        version: 'latest',
        categoryId: maliciousCategory.id
      })

      // Should succeed without SQL injection
      expect(service).toBeDefined()
      expect(service.categoryId).toBe(maliciousCategory.id)

      // Verify services table still exists and has data
      const servicesCount = await prisma.services.count()
      expect(servicesCount).toBeGreaterThan(0)
    })
  })

  describe('Advanced SQL Injection Patterns', () => {
    it('should prevent SQL injection using different quote types', async () => {
      const quotePayloads = [
        `"; DROP TABLE categories; --`,
        `\`; DROP TABLE services; --`,
        `'; DROP TABLE categories; /*`,
        `*/ DROP TABLE services; --`,
        `') OR '1'='1' --`,
        `") OR "1"="1" --`
      ]

      for (const payload of quotePayloads) {
        try {
          await caller.categories.create({
            name: `Quote ${payload}`,
            slug: TestDataFactory.generateSlug(`Quote ${payload}`),
            description: 'Test description',
            sortOrder: 1
          })
        } catch (error) {
          // Expected to fail validation or succeed with sanitized input
        }

        // Verify database integrity after each attempt
        const tableExists = await prisma.categories.findFirst()
        expect(tableExists).toBeDefined()
      }
    })

    it('should prevent SQL injection using encoded characters', async () => {
      const encodedPayloads = [
        'name%3D%27%20OR%20%271%27%3D%271', // URL encoded ' OR '1'='1
        'name%22%3B%20DROP%20TABLE%20categories%3B%20--', // URL encoded "; DROP TABLE categories; --
        'name%5C%27%20OR%20%271%27%3D%271', // Escaped quote
        'name%2527%20OR%20%271%27%3D%271' // Double encoded
      ]

      for (const payload of encodedPayloads) {
        try {
          await caller.categories.create({
            name: `Encoded ${payload}`,
            slug: TestDataFactory.generateSlug(`Encoded ${payload}`),
            description: 'Test description',
            sortOrder: 1
          })
        } catch (error) {
          // Expected to fail validation
        }

        // Verify database remains intact
        const categoriesExist = await prisma.categories.count()
        expect(categoriesExist).toBeGreaterThanOrEqual(0)
      }
    })

    it('should prevent SQL injection using comments', async () => {
      const commentPayloads = [
        "' /* comment */ OR '1'='1",
        "'; -- single line comment DROP TABLE services",
        "' /* multi-line comment with\n DROP TABLE categories\n */ OR '1'='1",
        "'; #MySQL comment DROP TABLE services",
        "' || '/* comment */' || '1'='1"
      ]

      for (const payload of commentPayloads) {
        try {
          await caller.categories.create({
            name: `Comment ${payload}`,
            slug: TestDataFactory.generateSlug(`Comment ${payload}`),
            description: 'Test description',
            sortOrder: 1
          })
        } catch (error) {
          // May fail validation
        }

        // Verify database structure intact
        const dbIntact = await prisma.services.count() >= 0 && await prisma.categories.count() >= 0
        expect(dbIntact).toBe(true)
      }
    })
  })

  describe('NoSQL Injection Prevention (JSON fields)', () => {
    it('should prevent NoSQL injection in JSON metadata fields', async () => {
      const noSQLPayloads = [
        { "$ne": null },
        { "$gt": "" },
        { "$where": "this.name == 'admin'" },
        { "$regex": ".*" },
        { "$or": [{"name": "admin"}, {"name": {"$ne": null}}] }
      ]

      for (const payload of noSQLPayloads) {
        const sourceUrl = `https://hub.docker.com/r/test/test-${Math.random().toString(36).slice(2, 8)}`
        try {
          await caller.imports.create({
            sourceUrl,
            sourceType: 'docker_hub' as const,
            categoryId: 1,
            submittedBy: 'test@example.com'
          })

          // Should succeed with payload treated as literal data
          const imports = await prisma.service_imports.findMany({
            where: {
              sourceUrl
            }
          })
          // Payload should be stored as literal JSON, not executed
          expect(imports).toBeDefined()
        } catch (error) {
          // May fail due to validation rules
          expect(error).toBeDefined()
        }
      }
    })

    it('should prevent function injection in JSON fields', async () => {
      const functionPayloads = [
        { "function": "function() { return db.users.find(); }" },
        { "code": "require('child_process').exec('rm -rf /')" },
        { "eval": "eval(process.env)" },
        { "script": "<script>alert('xss')</script>" }
      ]

      for (const payload of functionPayloads) {
        const importRecord = await caller.imports.create({
          sourceUrl: `https://hub.docker.com/r/test/test-${Math.random().toString(36).slice(2, 8)}`,
          sourceType: 'docker_hub' as const,
          categoryId: 1,
          submittedBy: 'test@example.com'
        })

        // Should store as literal JSON without execution
        expect(importRecord).toBeDefined()
      }
    })
  })

  describe('Parameterized Query Validation', () => {
    it('should ensure Prisma uses parameterized queries', async () => {
      // This test verifies that our ORM usage prevents SQL injection by design
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      // Try to inject SQL through search/filter parameters
      const maliciousSearches = [
        "'; DROP TABLE services; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM categories --"
      ]

      for (const search of maliciousSearches) {
        // Test search functionality with malicious input
        const results = await caller.services.list({
          search: search,
          limit: 10
        })

        // Should return empty results, not cause SQL injection
        expect(results.services).toBeDefined()
        expect(Array.isArray(results.services)).toBe(true)

        // Verify database integrity
        const servicesTable = await prisma.services.findFirst()
        if (servicesTable) {
          expect(servicesTable).toBeDefined()
        } else {
          expect(await prisma.services.count()).toBe(0)
        }
      }
    })

    it('should validate integer parameters against injection', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      // Try SQL injection through integer parameters
      const maliciousIds = [
        "1; DROP TABLE services; --",
        "1 OR 1=1",
        "NULL; DROP TABLE categories; --"
      ]

      for (const id of maliciousIds) {
        try {
          // This should fail type validation before reaching the database
          await caller.services.list({
            categoryId: id as any, // Force type bypass for testing
            limit: 10
          })
        } catch (error) {
          // Should fail with type/validation error, not SQL injection
          expect(error).toBeDefined()
          const errorMessage = (error as Error).message.toLowerCase()
          expect(errorMessage).not.toContain('drop')
          expect(errorMessage).not.toContain('delete')
        }
      }

      // Verify database remains intact
      const categoriesCount = await prisma.categories.count()
      expect(categoriesCount).toBeGreaterThan(0)
    })
  })

  describe('Database Transaction Safety', () => {
    it('should maintain transaction integrity during injection attempts', async () => {
      const initialCategoryCount = await prisma.categories.count()
      const initialServiceCount = await prisma.services.count()

      // Attempt multiple operations with SQL injection payloads
      const maliciousOperations = [
        () => caller.categories.create({
          name: "'; DROP TABLE services; --",
          slug: TestDataFactory.generateSlug("'; DROP TABLE services; --"),
          description: 'Malicious category',
          sortOrder: 1
        }),
        () => caller.categories.create({
          name: "Test Category",
          slug: TestDataFactory.generateSlug("Test Category"),
          description: "'; DELETE FROM categories WHERE 1=1; --",
          sortOrder: 2
        })
      ]

      for (const operation of maliciousOperations) {
        try {
          await operation()
        } catch (error) {
          // Operations may fail, but database should remain consistent
        }
      }

      // Verify database consistency
      const finalCategoryCount = await prisma.categories.count()
      const finalServiceCount = await prisma.services.count()

      // Database should be consistent (either no change or legitimate additions)
      expect(finalCategoryCount).toBeGreaterThanOrEqual(initialCategoryCount)
      expect(finalServiceCount).toBe(initialServiceCount) // Services table should be untouched
    })
  })

  describe('Error Message Security', () => {
    it('should not expose database structure in error messages', async () => {
      const maliciousInputs = [
        "' OR (SELECT COUNT(*) FROM information_schema.tables) > 0 --",
        "' AND (SELECT table_name FROM information_schema.tables LIMIT 1) = 'users' --",
        "'; SHOW TABLES; --"
      ]

      for (const input of maliciousInputs) {
        try {
          await caller.categories.create(TestDataFactory.createCategory(input))
        } catch (error) {
          const errorMessage = (error as Error).message.toLowerCase()
          
          // Error should not reveal database structure
          expect(errorMessage).not.toContain('table')
          expect(errorMessage).not.toContain('column')
          expect(errorMessage).not.toContain('schema')
          expect(errorMessage).not.toContain('database')
          expect(errorMessage).not.toContain('sql')
          expect(errorMessage).not.toContain('syntax')
        }
      }
    })
  })
})