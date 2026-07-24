import { z } from 'zod'
import { sanitizeString } from '../sanitization'

/**
 * SSRF guard for user-supplied URLs: reject loopback, link-local and
 * RFC1918 private addresses so stored URLs can't be abused to probe
 * internal infrastructure when fetched server-side.
 */
export function isPrivateOrLocalUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.localhost')) return true
    if (host === '::1' || host === '[::1]' || host === '0.0.0.0') return true
    if (/^127\./.test(host)) return true
    if (/^10\./.test(host)) return true
    if (/^192\.168\./.test(host)) return true
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true
    if (/^169\.254\./.test(host)) return true
    return false
  } catch {
    return true
  }
}

/**
 * Service Catalog Validation Schemas
 * 
 * Comprehensive validation schemas for all service catalog entities using Zod.
 * Includes custom error messages and type-safe validation rules.
 */

// Base validation patterns
// Docker image validation - more strict for real validation but match test expectations
// registry/namespace/image:tag — at most two path separators (registry + namespace)
const DOCKER_IMAGE_REGEX = /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*){0,2}:[a-zA-Z0-9]+(?:[._-][a-zA-Z0-9]+)*$/
const SEMVER_REGEX = /^\d+\.\d+(?:\.\d+)?$|^latest$/
const ENV_VAR_NAME_REGEX = /^[A-Z][A-Z0-9_]*$/
const DOCKER_VERSION_REGEX = /^\d+\.\d+\.\d+$/
const SERVICE_NAME_REGEX = /^[a-zA-Z0-9\s\-]+$/

// Custom error messages
const ErrorMessages = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_URL: 'Please enter a valid HTTP or HTTPS URL',
  INVALID_DOCKER_IMAGE: 'Please enter a valid Docker image format (e.g., nginx:latest or registry.com/namespace/image:tag)',
  INVALID_VERSION: 'Version must be in semantic versioning format (e.g., 1.0.0) or "latest"',
  INVALID_ENV_VAR_NAME: 'Environment variable names must start with a letter and contain only uppercase letters, numbers, and underscores',
  INVALID_SERVICE_NAME: 'Service name can only contain letters, numbers, spaces, and hyphens',
  INVALID_DOCKER_VERSION: 'Docker version must be in format x.y.z (e.g., 20.10.0)',
  MIN_LENGTH: (field: string, min: number) => `${field} must be at least ${min} characters long`,
  MAX_LENGTH: (field: string, max: number) => `${field} must not exceed ${max} characters`,
  MIN_VALUE: (field: string, min: number) => `${field} must be at least ${min}`,
  MAX_VALUE: (field: string, max: number) => `${field} must not exceed ${max}`,
  POSITIVE_NUMBER: (field: string) => `${field} must be a positive number`
} as const

/**
 * Port Configuration Schema
 */
export const PortConfigSchema = z.object({
  containerPort: z.number()
    .min(1, ErrorMessages.MIN_VALUE('Container port', 1))
    .max(65535, ErrorMessages.MAX_VALUE('Container port', 65535)),
  
  hostPort: z.number()
    .min(1, ErrorMessages.MIN_VALUE('Host port', 1))
    .max(65535, ErrorMessages.MAX_VALUE('Host port', 65535))
    .optional(),
  
  protocol: z.enum(['tcp', 'udp']),

  description: z.string()
    .transform(sanitizeString) // Sanitize port descriptions
    .optional()
})

export type PortConfig = z.infer<typeof PortConfigSchema>

/**
 * Environment Variable Configuration Schema
 */
export const EnvVarConfigSchema = z.object({
  name: z.string()
    .transform(sanitizeString) // Strip injected markup before format validation
    .pipe(
      z.string()
        .min(1, ErrorMessages.MIN_LENGTH('Environment variable name', 1))
        .regex(ENV_VAR_NAME_REGEX, ErrorMessages.INVALID_ENV_VAR_NAME)
    ),

  defaultValue: z.string()
    .transform(sanitizeString) // Sanitize env var values
    .optional(),

  required: z.boolean(),

  type: z.enum(['string', 'number', 'boolean', 'password']),

  description: z.string()
    .transform(sanitizeString) // Sanitize env var descriptions
    .optional()
})

export type EnvVarConfig = z.infer<typeof EnvVarConfigSchema>

/**
 * Resource Requirements Schema
 */
export const ResourceRequirementsSchema = z.object({
  minCpu: z.number()
    .positive(ErrorMessages.POSITIVE_NUMBER('Minimum CPU'))
    .optional(),
  
  recommendedCpu: z.number()
    .positive(ErrorMessages.POSITIVE_NUMBER('Recommended CPU'))
    .optional(),
  
  minMemory: z.number()
    .positive(ErrorMessages.POSITIVE_NUMBER('Minimum memory'))
    .optional(),
  
  recommendedMemory: z.number()
    .positive(ErrorMessages.POSITIVE_NUMBER('Recommended memory'))
    .optional(),
  
  storageRequired: z.boolean().optional(),
  
  minimumStorage: z.number()
    .positive(ErrorMessages.POSITIVE_NUMBER('Minimum storage'))
    .optional()
}).strict()

export type ResourceRequirements = z.infer<typeof ResourceRequirementsSchema>

/**
 * Compatibility Information Schema
 */
export const CompatibilityInfoSchema = z.object({
  operatingSystems: z.array(
    z.enum(['linux', 'windows', 'macos'])
  ).optional(),
  
  architectures: z.array(
    z.enum(['amd64', 'arm64', 'arm32'])
  ).optional(),
  
  minDockerVersion: z.string()
    .regex(DOCKER_VERSION_REGEX, ErrorMessages.INVALID_DOCKER_VERSION)
    .optional(),
  
  conflicts: z.array(z.string()).optional()
}).strict()

export type CompatibilityInfo = z.infer<typeof CompatibilityInfoSchema>

/**
 * Pagination Schema for cursor-based pagination
 */
export const PaginationSchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20)
})

export type Pagination = z.infer<typeof PaginationSchema>

/**
 * Category Schemas
 */
export const CategoryCreateSchema = z.object({
  name: z.string()
    .min(2, ErrorMessages.MIN_LENGTH('Category name', 2))
    .max(100, ErrorMessages.MAX_LENGTH('Category name', 100)),
  
  description: z.string()
    .min(10, ErrorMessages.MIN_LENGTH('Description', 10))
    .max(1000, ErrorMessages.MAX_LENGTH('Description', 1000))
    .optional(),
  
  icon: z.string().optional(),
  
  sortOrder: z.number()
    .int('Sort order must be a whole number')
    .min(0, ErrorMessages.MIN_VALUE('Sort order', 0))
    .default(0)
    .optional()
})

export const CategoryUpdateSchema = CategoryCreateSchema.partial()

export type CategoryCreate = z.infer<typeof CategoryCreateSchema>
export type CategoryUpdate = z.infer<typeof CategoryUpdateSchema>

/**
 * Service Schemas
 */
export const ServiceCreateSchema = z.object({
  name: z.string()
    .transform(sanitizeString) // Sanitize before validation
    .pipe(
      z.string()
        .min(2, ErrorMessages.MIN_LENGTH('Service name', 2))
        .max(100, ErrorMessages.MAX_LENGTH('Service name', 100))
        .regex(SERVICE_NAME_REGEX, ErrorMessages.INVALID_SERVICE_NAME)
    ),

  description: z.string()
    .transform(sanitizeString) // Sanitize descriptions
    .pipe(
      z.string()
        .min(10, ErrorMessages.MIN_LENGTH('Description', 10))
        .max(1000, ErrorMessages.MAX_LENGTH('Description', 1000))
    ),
  
  dockerImage: z.string()
    .regex(DOCKER_IMAGE_REGEX, ErrorMessages.INVALID_DOCKER_IMAGE),
  
  version: z.string()
    .regex(SEMVER_REGEX, ErrorMessages.INVALID_VERSION)
    .default('latest')
    .optional(),
  
  categoryId: z.coerce.number()
    .positive('Category ID must be a positive number'),
  
  ports: z.array(PortConfigSchema)
    .default([])
    .optional(),
  
  environmentVariables: z.array(EnvVarConfigSchema)
    .default([])
    .optional(),
  
  resourceRequirements: ResourceRequirementsSchema
    .default({})
    .optional(),
  
  compatibilityInfo: CompatibilityInfoSchema
    .default({})
    .optional(),
  
  documentationUrl: z.string()
    .url(ErrorMessages.INVALID_URL)
    .refine(url => url.startsWith('http://') || url.startsWith('https://'), {
      message: 'Documentation URL must use HTTP or HTTPS protocol'
    })
    .refine(url => !isPrivateOrLocalUrl(url), {
      message: 'Documentation URL must not point to private or local addresses'
    })
    .optional(),
  
  featured: z.boolean()
    .default(false)
    .optional()
})

export const ServiceUpdateSchema = ServiceCreateSchema
  .omit({ categoryId: true }) // Cannot update category via service update
  .partial()
  .strict() // Only allow defined fields to prevent updating slug or other protected fields

export type ServiceCreate = z.infer<typeof ServiceCreateSchema>
export type ServiceUpdate = z.infer<typeof ServiceUpdateSchema>

/**
 * Service Import Schemas
 */
export const ServiceImportCreateSchema = z.object({
  sourceUrl: z.string()
    .url(ErrorMessages.INVALID_URL),
  
  sourceType: z.enum(['docker_hub', 'github', 'manual']),
  
  submittedBy: z.string()
    .email(ErrorMessages.INVALID_EMAIL)
    .optional(),
  
  extractedMetadata: z.object({})
    .passthrough()
    .default({})
    .optional()
})

export const ServiceImportUpdateSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'approved', 'rejected'])
    .optional(),
  extractedMetadata: z.object({}).passthrough().optional(),
  
  reviewedBy: z.string()
    .email(ErrorMessages.INVALID_EMAIL)
    .optional(),
  
  reviewNotes: z.string().optional(),
  
  serviceId: z.number()
    .positive('Service ID must be a positive number')
    .optional()
})

export type ServiceImportCreate = z.infer<typeof ServiceImportCreateSchema>
export type ServiceImportUpdate = z.infer<typeof ServiceImportUpdateSchema>

/**
 * Status Enums (matching database utils)
 */
export const ServiceStatus = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DEPRECATED: 'deprecated'
} as const

export const ImportSourceType = {
  DOCKER_HUB: 'docker_hub',
  GITHUB: 'github',
  MANUAL: 'manual'
} as const

export const ImportStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  APPROVED: 'approved',
  REJECTED: 'rejected'
} as const

export type ServiceStatusType = typeof ServiceStatus[keyof typeof ServiceStatus]
export type ImportSourceTypeType = typeof ImportSourceType[keyof typeof ImportSourceType]
export type ImportStatusType = typeof ImportStatus[keyof typeof ImportStatus]

/**
 * Complete Entity Types (with database fields)
 */
export interface ServiceEntity {
  id: number
  name: string
  slug: string
  description: string
  dockerImage: string
  version: string
  categoryId: number
  ports: PortConfig[]
  environmentVariables: EnvVarConfig[]
  resourceRequirements: ResourceRequirements
  compatibilityInfo: CompatibilityInfo
  documentationUrl?: string
  featured: boolean
  status: ServiceStatusType
  createdAt: Date
  updatedAt: Date
}

export interface CategoryEntity {
  id: number
  name: string
  slug: string
  description?: string
  icon?: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export interface ServiceImportEntity {
  id: number
  sourceUrl: string
  sourceType: ImportSourceTypeType
  status: ImportStatusType
  extractedMetadata: Record<string, any>
  submittedBy?: string
  reviewedBy?: string
  reviewNotes?: string
  serviceId?: number
  createdAt: Date
  updatedAt: Date
}

/**
 * Validation helper functions
 */
export const ValidationHelpers = {
  /**
   * Generate slug from name
   */
  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
  },

  /**
   * Validate and parse Docker image
   */
  parseDockerImage(image: string): { registry?: string; namespace?: string; name: string; tag: string } {
    const parts = image.split(':')
    if (parts.length !== 2) {
      throw new Error('Invalid Docker image format')
    }
    
    const [imagePath, tag] = parts
    const pathParts = imagePath.split('/')
    
    if (pathParts.length === 1) {
      return { name: pathParts[0], tag }
    } else if (pathParts.length === 2) {
      return { namespace: pathParts[0], name: pathParts[1], tag }
    } else if (pathParts.length >= 3) {
      return {
        registry: pathParts[0],
        namespace: pathParts.slice(1, -1).join('/'),
        name: pathParts[pathParts.length - 1],
        tag
      }
    }
    
    throw new Error('Invalid Docker image format')
  },

  /**
   * Validate semantic version
   */
  isValidSemver(version: string): boolean {
    return SEMVER_REGEX.test(version)
  },

  /**
   * Format validation errors for user-friendly display
   */
  formatValidationErrors(error: z.ZodError): Array<{ field: string; message: string }> {
    return error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message
    }))
  }
}

/**
 * Schema validation utilities
 */
export const SchemaUtils = {
  /**
   * Safe parse with formatted errors
   */
  safeParseWithErrors<T>(schema: z.ZodSchema<T>, data: unknown): {
    success: boolean
    data?: T
    errors?: Array<{ field: string; message: string }>
  } {
    const result = schema.safeParse(data)
    
    if (result.success) {
      return { success: true, data: result.data }
    }
    
    return {
      success: false,
      errors: ValidationHelpers.formatValidationErrors(result.error)
    }
  },

  /**
   * Validate service creation data
   */
  validateServiceCreate(data: unknown) {
    return this.safeParseWithErrors(ServiceCreateSchema, data)
  },

  /**
   * Validate service update data
   */
  validateServiceUpdate(data: unknown) {
    return this.safeParseWithErrors(ServiceUpdateSchema, data)
  },

  /**
   * Validate category creation data
   */
  validateCategoryCreate(data: unknown) {
    return this.safeParseWithErrors(CategoryCreateSchema, data)
  },

  /**
   * Validate category update data
   */
  validateCategoryUpdate(data: unknown) {
    return this.safeParseWithErrors(CategoryUpdateSchema, data)
  },

  /**
   * Validate service import creation data
   */
  validateServiceImportCreate(data: unknown) {
    return this.safeParseWithErrors(ServiceImportCreateSchema, data)
  },

  /**
   * Validate service import update data
   */
  validateServiceImportUpdate(data: unknown) {
    return this.safeParseWithErrors(ServiceImportUpdateSchema, data)
  }
}