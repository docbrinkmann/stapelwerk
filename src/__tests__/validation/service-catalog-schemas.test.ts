import { describe, it, expect } from 'vitest'
import {
  ServiceCreateSchema,
  ServiceUpdateSchema,
  CategoryCreateSchema,
  CategoryUpdateSchema,
  ServiceImportCreateSchema,
  ServiceImportUpdateSchema,
  PortConfigSchema,
  EnvVarConfigSchema,
  ResourceRequirementsSchema,
  CompatibilityInfoSchema
} from '../../lib/validation/service-catalog-schemas'

describe('Service Catalog Validation Schemas', () => {
  
  describe('PortConfigSchema', () => {
    it('should validate valid port configurations', () => {
      const validPort = {
        containerPort: 8080,
        hostPort: 8080,
        protocol: 'tcp' as const,
        description: 'HTTP port'
      }

      const result = PortConfigSchema.safeParse(validPort)
      expect(result.success).toBe(true)
    })

    it('should require containerPort', () => {
      const invalidPort = {
        protocol: 'tcp' as const
      }

      const result = PortConfigSchema.safeParse(invalidPort)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('containerPort')
      }
    })

    it('should validate port range 1-65535', () => {
      const invalidLowPort = { containerPort: 0, protocol: 'tcp' as const }
      const invalidHighPort = { containerPort: 65536, protocol: 'tcp' as const }

      expect(PortConfigSchema.safeParse(invalidLowPort).success).toBe(false)
      expect(PortConfigSchema.safeParse(invalidHighPort).success).toBe(false)
    })

    it('should only allow tcp or udp protocols', () => {
      const validTcp = { containerPort: 80, protocol: 'tcp' as const }
      const validUdp = { containerPort: 53, protocol: 'udp' as const }
      const invalid = { containerPort: 80, protocol: 'http' }

      expect(PortConfigSchema.safeParse(validTcp).success).toBe(true)
      expect(PortConfigSchema.safeParse(validUdp).success).toBe(true)
      expect(PortConfigSchema.safeParse(invalid).success).toBe(false)
    })

    it('should make hostPort and description optional', () => {
      const minimalPort = { containerPort: 80, protocol: 'tcp' as const }
      expect(PortConfigSchema.safeParse(minimalPort).success).toBe(true)
    })
  })

  describe('EnvVarConfigSchema', () => {
    it('should validate valid environment variable configurations', () => {
      const validEnvVar = {
        name: 'DATABASE_URL',
        defaultValue: 'postgresql://localhost:5432/db',
        required: true,
        type: 'string' as const,
        description: 'Database connection URL'
      }

      const result = EnvVarConfigSchema.safeParse(validEnvVar)
      expect(result.success).toBe(true)
    })

    it('should require name and required fields', () => {
      const invalidEnvVar = {
        type: 'string'
      }

      const result = EnvVarConfigSchema.safeParse(invalidEnvVar)
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map(issue => issue.path).flat()
        expect(paths).toContain('name')
        expect(paths).toContain('required')
      }
    })

    it('should validate environment variable name format', () => {
      const validNames = ['DATABASE_URL', 'API_KEY', 'NODE_ENV', 'PORT']
      const invalidNames = ['123INVALID', 'invalid-name', 'invalid name', '']

      validNames.forEach(name => {
        const envVar = { name, required: true, type: 'string' as const }
        expect(EnvVarConfigSchema.safeParse(envVar).success).toBe(true)
      })

      invalidNames.forEach(name => {
        const envVar = { name, required: true, type: 'string' as const }
        expect(EnvVarConfigSchema.safeParse(envVar).success).toBe(false)
      })
    })

    it('should validate type values', () => {
      const validTypes = ['string', 'number', 'boolean', 'password'] as const
      const invalidType = 'object'

      validTypes.forEach(type => {
        const envVar = { name: 'TEST_VAR', required: true, type }
        expect(EnvVarConfigSchema.safeParse(envVar).success).toBe(true)
      })

      const envVar = { name: 'TEST_VAR', required: true, type: invalidType }
      expect(EnvVarConfigSchema.safeParse(envVar).success).toBe(false)
    })

    it('should make defaultValue and description optional', () => {
      const minimalEnvVar = { name: 'PORT', required: false, type: 'number' as const }
      expect(EnvVarConfigSchema.safeParse(minimalEnvVar).success).toBe(true)
    })
  })

  describe('ResourceRequirementsSchema', () => {
    it('should validate valid resource requirements', () => {
      const validResources = {
        minCpu: 0.5,
        recommendedCpu: 1.0,
        minMemory: 512,
        recommendedMemory: 1024,
        storageRequired: true,
        minimumStorage: 1000
      }

      const result = ResourceRequirementsSchema.safeParse(validResources)
      expect(result.success).toBe(true)
    })

    it('should require positive numbers for CPU and memory', () => {
      const invalidResources = [
        { minCpu: -1 },
        { minCpu: 0 },
        { minMemory: -512 },
        { minMemory: 0 },
        { recommendedCpu: -2 },
        { recommendedMemory: -1024 }
      ]

      invalidResources.forEach(resource => {
        expect(ResourceRequirementsSchema.safeParse(resource).success).toBe(false)
      })
    })

    it('should allow all fields to be optional', () => {
      const minimalResources = {}
      expect(ResourceRequirementsSchema.safeParse(minimalResources).success).toBe(true)
    })

    it('should validate storage requirements', () => {
      const validStorage = { storageRequired: false, minimumStorage: 500 }
      const invalidStorage = { minimumStorage: -100 }

      expect(ResourceRequirementsSchema.safeParse(validStorage).success).toBe(true)
      expect(ResourceRequirementsSchema.safeParse(invalidStorage).success).toBe(false)
    })
  })

  describe('CompatibilityInfoSchema', () => {
    it('should validate compatibility information', () => {
      const validCompatibility = {
        operatingSystems: ['linux', 'windows'],
        architectures: ['amd64', 'arm64'],
        minDockerVersion: '20.10.0',
        conflicts: ['service-a', 'service-b']
      }

      const result = CompatibilityInfoSchema.safeParse(validCompatibility)
      expect(result.success).toBe(true)
    })

    it('should validate operating system values', () => {
      const validOS = { operatingSystems: ['linux', 'windows', 'macos'] }
      const invalidOS = { operatingSystems: ['invalid-os'] }

      expect(CompatibilityInfoSchema.safeParse(validOS).success).toBe(true)
      expect(CompatibilityInfoSchema.safeParse(invalidOS).success).toBe(false)
    })

    it('should validate architecture values', () => {
      const validArch = { architectures: ['amd64', 'arm64', 'arm32'] }
      const invalidArch = { architectures: ['invalid-arch'] }

      expect(CompatibilityInfoSchema.safeParse(validArch).success).toBe(true)
      expect(CompatibilityInfoSchema.safeParse(invalidArch).success).toBe(false)
    })

    it('should validate Docker version format', () => {
      const validVersions = ['20.10.0', '19.03.12', '24.0.0']
      const invalidVersions = ['invalid', '20', 'v20.10.0']

      validVersions.forEach(version => {
        const compatibility = { minDockerVersion: version }
        expect(CompatibilityInfoSchema.safeParse(compatibility).success).toBe(true)
      })

      invalidVersions.forEach(version => {
        const compatibility = { minDockerVersion: version }
        expect(CompatibilityInfoSchema.safeParse(compatibility).success).toBe(false)
      })
    })

    it('should allow all fields to be optional', () => {
      const minimalCompatibility = {}
      expect(CompatibilityInfoSchema.safeParse(minimalCompatibility).success).toBe(true)
    })
  })

  describe('CategoryCreateSchema', () => {
    it('should validate valid category creation data', () => {
      const validCategory = {
        name: 'Test Databases',
        description: 'Database management systems',
        icon: 'database',
        sortOrder: 1
    }

      const result = CategoryCreateSchema.safeParse(validCategory)
      expect(result.success).toBe(true)
    })

    it('should require name field', () => {
      const invalidCategory = {
        description: 'Test description'
      }

      const result = CategoryCreateSchema.safeParse(invalidCategory)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('name')
      }
    })

    it('should validate name length (2-100 characters)', () => {
      const shortName = { name: 'a' }
      const longName = { name: 'a'.repeat(101) }
      const validName = { name: 'Valid Category Name' }

      expect(CategoryCreateSchema.safeParse(shortName).success).toBe(false)
      expect(CategoryCreateSchema.safeParse(longName).success).toBe(false)
      expect(CategoryCreateSchema.safeParse(validName).success).toBe(true)
    })

    it('should validate description length (10-1000 characters)', () => {
      const shortDesc = { name: 'Test', description: 'short' }
      const longDesc = { name: 'Test', description: 'a'.repeat(1001) }
      const validDesc = { name: 'Test', description: 'Valid description with enough content' }

      expect(CategoryCreateSchema.safeParse(shortDesc).success).toBe(false)
      expect(CategoryCreateSchema.safeParse(longDesc).success).toBe(false)
      expect(CategoryCreateSchema.safeParse(validDesc).success).toBe(true)
    })

    it('should make optional fields truly optional', () => {
      const minimalCategory = { name: 'Minimal Category' }
      expect(CategoryCreateSchema.safeParse(minimalCategory).success).toBe(true)
    })
  })

  describe('CategoryUpdateSchema', () => {
    it('should validate category update data', () => {
      const validUpdate = {
        name: 'Updated Category',
        description: 'Updated description with proper length',
        icon: 'updated-icon',
        sortOrder: 5
    }

      const result = CategoryUpdateSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow partial updates', () => {
      const partialUpdate = { name: 'New Name' }
      expect(CategoryUpdateSchema.safeParse(partialUpdate).success).toBe(true)
    })

    it('should validate same constraints as create schema', () => {
      const invalidUpdate = {
        name: 'a', // too short
        description: 'short' // too short
      }

      expect(CategoryUpdateSchema.safeParse(invalidUpdate).success).toBe(false)
    })
  })

  describe('ServiceCreateSchema', () => {
    it('should validate valid service creation data', () => {
      const validService = {
        name: 'Test PostgreSQL',
        description: 'PostgreSQL database for testing and development',
        dockerImage: 'postgres:15-alpine',
        version: '15.4',
        categoryId: 1,
        ports: [{
          containerPort: 5432,
          protocol: 'tcp' as const,
          description: 'PostgreSQL port'
        }],
        environmentVariables: [{
          name: 'POSTGRES_PASSWORD',
          required: true,
          type: 'password' as const,
          description: 'Database password'
        }],
        resourceRequirements: {
          minCpu: 0.5,
          recommendedCpu: 1.0,
          minMemory: 512,
          recommendedMemory: 1024
        },
        compatibilityInfo: {
          operatingSystems: ['linux'],
          architectures: ['amd64', 'arm64']
        },
        documentationUrl: 'https://hub.docker.com/_/postgres',
        featured: true
      }

      const result = ServiceCreateSchema.safeParse(validService)
      expect(result.success).toBe(true)
    })

    it('should require essential fields', () => {
      const invalidService = {}

      const result = ServiceCreateSchema.safeParse(invalidService)
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map(issue => issue.path).flat()
        expect(paths).toContain('name')
        expect(paths).toContain('description')
        expect(paths).toContain('dockerImage')
        expect(paths).toContain('categoryId')
      }
    })

    it('should validate service name constraints', () => {
      const shortName = { name: 'a', description: 'Valid description', dockerImage: 'nginx:latest', categoryId: 1 }
      const longName = { name: 'a'.repeat(101), description: 'Valid description', dockerImage: 'nginx:latest', categoryId: 1 }
      const invalidChars = { name: 'Invalid@Name!', description: 'Valid description', dockerImage: 'nginx:latest', categoryId: 1 }

      expect(ServiceCreateSchema.safeParse(shortName).success).toBe(false)
      expect(ServiceCreateSchema.safeParse(longName).success).toBe(false)
      expect(ServiceCreateSchema.safeParse(invalidChars).success).toBe(false)
    })

    it('should validate Docker image format', () => {
      const validImages = [
        'nginx:latest',
        'postgres:15-alpine',
        'registry.example.com/namespace/image:tag',
        'docker.io/library/node:18'
      ]

      const invalidImages = [
        'invalid',
        ':latest',
        'image:',
        'UPPERCASE:latest'
      ]

      validImages.forEach(dockerImage => {
        const service = { name: 'Test', description: 'Test description', dockerImage, categoryId: 1 }
        expect(ServiceCreateSchema.safeParse(service).success).toBe(true)
      })

      invalidImages.forEach(dockerImage => {
        const service = { name: 'Test', description: 'Test description', dockerImage, categoryId: 1 }
        expect(ServiceCreateSchema.safeParse(service).success).toBe(false)
      })
    })

    it('should validate version format', () => {
      const validVersions = ['1.0.0', '15.4', '2.1.3', 'latest']
      const invalidVersions = ['v1.0.0', 'invalid-version', '', '1', '1.']

      validVersions.forEach(version => {
        const service = { name: 'Test', description: 'Test description', dockerImage: 'nginx:latest', categoryId: 1, version }
        expect(ServiceCreateSchema.safeParse(service).success).toBe(true)
      })

      invalidVersions.forEach(version => {
        const service = { name: 'Test', description: 'Test description', dockerImage: 'nginx:latest', categoryId: 1, version }
        expect(ServiceCreateSchema.safeParse(service).success).toBe(false)
      })
    })

    it('should validate documentation URL format', () => {
      const validUrls = [
        'https://example.com',
        'http://docs.example.com/guide',
        'https://hub.docker.com/_/nginx'
      ]

      const invalidUrls = [
        'not-a-url',
        'ftp://example.com',
        'example.com',
        'invalid-url',
        ''
      ]

      validUrls.forEach(documentationUrl => {
        const service = { name: 'Test', description: 'Test description', dockerImage: 'nginx:latest', categoryId: 1, documentationUrl }
        expect(ServiceCreateSchema.safeParse(service).success).toBe(true)
      })

      invalidUrls.forEach(documentationUrl => {
        const service = { name: 'Test', description: 'Test description', dockerImage: 'nginx:latest', categoryId: 1, documentationUrl }
        expect(ServiceCreateSchema.safeParse(service).success).toBe(false)
      })
    })

    it('should validate arrays of ports and environment variables', () => {
      const service = {
        name: 'Test Service',
        description: 'Service with multiple ports and env vars',
        dockerImage: 'nginx:latest',
        categoryId: 1,
        ports: [
          { containerPort: 80, protocol: 'tcp' as const },
          { containerPort: 443, protocol: 'tcp' as const }
        ],
        environmentVariables: [
          { name: 'ENV_VAR_1', required: true, type: 'string' as const },
          { name: 'ENV_VAR_2', required: false, type: 'number' as const }
        ]
      }

      expect(ServiceCreateSchema.safeParse(service).success).toBe(true)
    })

    it('should make optional fields truly optional', () => {
      const minimalService = {
        name: 'Minimal Service',
        description: 'Minimal service with required fields only',
        dockerImage: 'nginx:latest',
        categoryId: 1
      }

      expect(ServiceCreateSchema.safeParse(minimalService).success).toBe(true)
    })
  })

  describe('ServiceUpdateSchema', () => {
    it('should validate service update data', () => {
      const validUpdate = {
        name: 'Updated Service',
        description: 'Updated service description',
        version: '2.0.0',
        featured: false
      }

      const result = ServiceUpdateSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should allow partial updates', () => {
      const partialUpdate = { featured: true }
      expect(ServiceUpdateSchema.safeParse(partialUpdate).success).toBe(true)
    })

    it('should validate same constraints as create schema', () => {
      const invalidUpdate = {
        name: 'a', // too short
        dockerImage: 'invalid-image', // invalid format
        documentationUrl: 'not-a-url' // invalid URL
      }

      expect(ServiceUpdateSchema.safeParse(invalidUpdate).success).toBe(false)
    })

    it('should not allow updating categoryId or slug', () => {
      const updateWithId = { categoryId: 999 }
      const updateWithSlug = { slug: 'new-slug' }

      // The schema is .strict(), so unknown/protected fields are rejected
      const resultWithId = ServiceUpdateSchema.safeParse(updateWithId)
      const resultWithSlug = ServiceUpdateSchema.safeParse(updateWithSlug)

      // The schema should not have categoryId or slug fields for updates
      expect(resultWithId.success).toBe(false)
      expect(resultWithSlug.success).toBe(false)

      // An empty partial update remains a valid no-op
      expect(ServiceUpdateSchema.safeParse({}).success).toBe(true)
    })
  })

  describe('ServiceImportCreateSchema', () => {
    it('should validate valid service import creation data', () => {
      const validImport = {
        sourceUrl: 'https://hub.docker.com/_/nginx',
        sourceType: 'docker_hub' as const,
        submittedBy: 'user@example.com'
      }

      const result = ServiceImportCreateSchema.safeParse(validImport)
      expect(result.success).toBe(true)
    })

    it('should require sourceUrl and sourceType', () => {
      const invalidImport = {
        submittedBy: 'user@example.com'
      }

      const result = ServiceImportCreateSchema.safeParse(invalidImport)
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map(issue => issue.path).flat()
        expect(paths).toContain('sourceUrl')
        expect(paths).toContain('sourceType')
      }
    })

    it('should validate source URL format', () => {
      const validUrls = [
        'https://hub.docker.com/_/nginx',
        'https://github.com/user/repo',
        'http://example.com/service'
      ]

      const invalidUrls = [
        'not-a-url',
        'invalid-url',
        '',
        'just-text'
      ]

      validUrls.forEach(sourceUrl => {
        const importData = { sourceUrl, sourceType: 'manual' as const }
        expect(ServiceImportCreateSchema.safeParse(importData).success).toBe(true)
      })

      invalidUrls.forEach(sourceUrl => {
        const importData = { sourceUrl, sourceType: 'manual' as const }
        expect(ServiceImportCreateSchema.safeParse(importData).success).toBe(false)
      })
    })

    it('should validate source type values', () => {
      const validTypes = ['docker_hub', 'github', 'manual'] as const
      const invalidType = 'invalid_source'

      validTypes.forEach(sourceType => {
        const importData = { sourceUrl: 'https://example.com', sourceType }
        expect(ServiceImportCreateSchema.safeParse(importData).success).toBe(true)
      })

      const importData = { sourceUrl: 'https://example.com', sourceType: invalidType }
      expect(ServiceImportCreateSchema.safeParse(importData).success).toBe(false)
    })

    it('should make optional fields truly optional', () => {
      const minimalImport = {
        sourceUrl: 'https://hub.docker.com/_/nginx',
        sourceType: 'docker_hub' as const
      }

      expect(ServiceImportCreateSchema.safeParse(minimalImport).success).toBe(true)
    })
  })

  describe('ServiceImportUpdateSchema', () => {
    it('should validate service import update data', () => {
      const validUpdate = {
        status: 'completed' as const,
        extractedMetadata: {
          name: 'NGINX',
          description: 'High-performance web server',
          version: '1.24'
        },
        reviewNotes: 'Approved after testing'
      }

      const result = ServiceImportUpdateSchema.safeParse(validUpdate)
      expect(result.success).toBe(true)
    })

    it('should validate status values', () => {
      const validStatuses = ['pending', 'processing', 'completed', 'failed', 'approved', 'rejected'] as const
      const invalidStatus = 'invalid_status'

      validStatuses.forEach(status => {
        const update = { status }
        expect(ServiceImportUpdateSchema.safeParse(update).success).toBe(true)
      })

      const update = { status: invalidStatus }
      expect(ServiceImportUpdateSchema.safeParse(update).success).toBe(false)
    })

    it('should allow partial updates', () => {
      const partialUpdate = { reviewNotes: 'In progress' }
      expect(ServiceImportUpdateSchema.safeParse(partialUpdate).success).toBe(true)
    })

    it('should validate extracted metadata as flexible object', () => {
      const updateWithMetadata = {
        extractedMetadata: {
          customField: 'value',
          ports: [80, 443],
          nested: {
            data: 'structure'
          }
        }
      }

      expect(ServiceImportUpdateSchema.safeParse(updateWithMetadata).success).toBe(true)
    })
  })

  describe('Error Messages', () => {
    it('should provide user-friendly error messages for service validation', () => {
      const invalidService = {
        name: 'a', // too short
        description: 'short', // too short
        dockerImage: 'invalid', // invalid format
        categoryId: 'not-a-number' // wrong type
      }

      const result = ServiceCreateSchema.safeParse(invalidService)
      expect(result.success).toBe(false)
      if (!result.success) {
        const errorMessages = result.error.issues.map(issue => issue.message)
        // Check that we get meaningful error messages
        expect(errorMessages.length).toBeGreaterThan(0)
        // Check for specific field validations
        const hasNameError = errorMessages.some(msg => msg.includes('name') || msg.includes('Service name'))
        const hasDescError = errorMessages.some(msg => msg.includes('description') || msg.includes('Description'))
        const hasDockerError = errorMessages.some(msg => msg.includes('Docker') || msg.includes('image'))
        const hasTypeError = errorMessages.some(msg => msg.includes('number') || msg.includes('type'))
        
        expect(hasNameError || hasDescError || hasDockerError || hasTypeError).toBe(true)
      }
    })

    it('should provide clear validation error context', () => {
      const invalidPorts = {
        name: 'Test Service',
        description: 'Test service description',
        dockerImage: 'nginx:latest',
        categoryId: 1,
        ports: [
          { containerPort: 0, protocol: 'tcp' as const } // invalid port and protocol
        ]
      }

      const result = ServiceCreateSchema.safeParse(invalidPorts)
      expect(result.success).toBe(false)
      if (!result.success) {
        const errorPaths = result.error.issues.map(issue => issue.path.join('.'))
        expect(errorPaths.some(path => path.includes('ports'))).toBe(true)
      }
    })
  })
})