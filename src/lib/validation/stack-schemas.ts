import { z } from 'zod'

/**
 * Stack Builder Validation Schemas
 * 
 * Comprehensive validation schemas for stack building entities using Zod.
 * Includes custom error messages and type-safe validation rules.
 */

// Custom error messages for stacks
const ErrorMessages = {
  REQUIRED: 'This field is required',
  INVALID_UUID: 'Invalid UUID format',
  INVALID_JSON: 'Invalid JSON format',
  INVALID_PORT: 'Port must be between 1 and 65535',
  INVALID_ENV_VAR_NAME: 'Environment variable names must contain only letters, numbers, and underscores',
  MIN_LENGTH: (field: string, min: number) => `${field} must be at least ${min} characters long`,
  MAX_LENGTH: (field: string, max: number) => `${field} must not exceed ${max} characters`,
  POSITIVE_NUMBER: (field: string) => `${field} must be a positive number`,
  UNIQUE_SLUG: 'This slug is already taken'
} as const

// UUID validation pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Environment Variables Schema for Stack Service Configuration
 */
export const StackEnvVarSchema = z.record(
  z.string().regex(/^[A-Z_][A-Z0-9_]*$/i, ErrorMessages.INVALID_ENV_VAR_NAME),
  z.string()
)

export type StackEnvVar = z.infer<typeof StackEnvVarSchema>

/**
 * Port Mappings Schema for Stack Service Configuration
 */
export const StackPortMappingSchema = z.record(
  z.string().regex(/^\d+$/, 'Container port must be numeric'),
  z.string().regex(/^\d+$/, 'Host port must be numeric')
).refine(
  (data) => {
    // Validate port ranges
    for (const [containerPort, hostPort] of Object.entries(data)) {
      const cPort = parseInt(containerPort, 10)
      const hPort = parseInt(hostPort, 10)
      if (cPort < 1 || cPort > 65535 || hPort < 1 || hPort > 65535) {
        return false
      }
    }
    return true
  },
  { message: ErrorMessages.INVALID_PORT }
)

export type StackPortMapping = z.infer<typeof StackPortMappingSchema>

/**
 * Volume Mounts Schema for Stack Service Configuration
 */
export const StackVolumeMountSchema = z.record(
  z.string().min(1, 'Container path cannot be empty'),
  z.string().min(1, 'Host path cannot be empty')
)

export type StackVolumeMount = z.infer<typeof StackVolumeMountSchema>

/**
 * Service Dependencies Schema
 */
export const StackDependenciesSchema = z.array(
  z.string().min(1, 'Dependency name cannot be empty')
)

export type StackDependencies = z.infer<typeof StackDependenciesSchema>

/**
 * Stack Status Enum
 */
export const StackStatus = {
  DRAFT: 'draft',
  PRIVATE: 'private',
  PUBLIC: 'public',
  PENDING_APPROVAL: 'pending_approval'
} as const

export const StackStatusSchema = z.enum(['draft', 'private', 'public', 'pending_approval'])

export type StackStatusType = typeof StackStatus[keyof typeof StackStatus]

/**
 * Stack Create Schema
 */
export const StackCreateSchema = z.object({
  name: z.string()
    .min(2, ErrorMessages.MIN_LENGTH('Stack name', 2))
    .max(255, ErrorMessages.MAX_LENGTH('Stack name', 255)),
  
  description: z.string()
    .max(1000, ErrorMessages.MAX_LENGTH('Description', 1000))
    .optional(),
  
  userId: z.string()
    .regex(UUID_REGEX, ErrorMessages.INVALID_UUID)
    .nullable()
    .optional(), // Optional for anonymous stacks
  
  isPublic: z.boolean()
    .default(false)
    .optional(),
  
  isTemplate: z.boolean()
    .default(false)
    .optional(),
  
  status: StackStatusSchema
    .default('draft')
    .optional(),
  
  // Services to add to the stack (optional for initial creation)
  services: z.array(z.object({
    serviceId: z.number()
      .positive('Service ID must be positive'),
    
    order: z.number()
      .int('Order must be a whole number')
      .positive('Order must be positive')
      .optional(),
    
    configuration: z.object({
      environmentVariables: StackEnvVarSchema.optional(),
      portMappings: StackPortMappingSchema.optional(),
      volumeMounts: StackVolumeMountSchema.optional(),
      dependsOn: StackDependenciesSchema.optional()
    }).optional()
  })).optional()
})

export type StackCreate = z.infer<typeof StackCreateSchema>

/**
 * Stack Update Schema
 */
export const StackUpdateSchema = z.object({
  name: z.string()
    .min(2, ErrorMessages.MIN_LENGTH('Stack name', 2))
    .max(255, ErrorMessages.MAX_LENGTH('Stack name', 255))
    .optional(),
  
  description: z.string()
    .max(1000, ErrorMessages.MAX_LENGTH('Description', 1000))
    .nullable()
    .optional(),
  
  isPublic: z.boolean().optional(),
  
  isTemplate: z.boolean().optional(),
  
  status: StackStatusSchema.optional(),
  
  // Services configuration update
  services: z.array(z.object({
    serviceId: z.coerce.number()
      .positive('Service ID must be positive'),
    
    order: z.coerce.number()
      .int('Order must be a whole number')
      .positive('Order must be positive')
      .optional(),
    
    configuration: z.object({
      environmentVariables: StackEnvVarSchema.optional(),
      portMappings: StackPortMappingSchema.optional(),
      volumeMounts: StackVolumeMountSchema.optional(),
      dependsOn: StackDependenciesSchema.optional()
    }).optional()
  })).optional()
})

export type StackUpdate = z.infer<typeof StackUpdateSchema>

/**
 * Stack Service Add Schema
 */
export const StackServiceAddSchema = z.object({
  stackId: z.string()
    .regex(UUID_REGEX, ErrorMessages.INVALID_UUID),
  
  serviceId: z.coerce.number()
    .positive('Service ID must be positive'),
  
  order: z.coerce.number()
    .int('Order must be a whole number')
    .positive('Order must be positive')
    .optional(),
  
  configuration: z.object({
    environmentVariables: StackEnvVarSchema
      .default({})
      .optional(),
    
    portMappings: StackPortMappingSchema
      .default({})
      .optional(),
    
    volumeMounts: StackVolumeMountSchema
      .default({})
      .optional(),
    
    dependsOn: StackDependenciesSchema
      .default([])
      .optional()
  }).optional()
})

export type StackServiceAdd = z.infer<typeof StackServiceAddSchema>

/**
 * Stack Service Configuration Update Schema
 */
export const StackServiceConfigurationUpdateSchema = z.object({
  stackId: z.string()
    .regex(UUID_REGEX, ErrorMessages.INVALID_UUID),
  
  serviceId: z.coerce.number()
    .positive('Service ID must be positive'),
  
  configuration: z.object({
    environmentVariables: StackEnvVarSchema.optional(),
    portMappings: StackPortMappingSchema.optional(),
    volumeMounts: StackVolumeMountSchema.optional(),
    dependsOn: StackDependenciesSchema.optional()
  })
})

export type StackServiceConfigurationUpdate = z.infer<typeof StackServiceConfigurationUpdateSchema>

/**
 * Stack List Query Schema (for API endpoints)
 */
export const StackListQuerySchema = z.object({
  cursor: z.string()
    .regex(UUID_REGEX, ErrorMessages.INVALID_UUID)
    .optional(),
  
  limit: z.number()
    .int('Limit must be a whole number')
    .min(1, ErrorMessages.MIN_LENGTH('Limit', 1))
    .max(50, ErrorMessages.MAX_LENGTH('Limit', 50))
    .default(10)
    .optional(),
  
  status: StackStatusSchema.optional(),
  
  userId: z.string()
    .regex(UUID_REGEX, ErrorMessages.INVALID_UUID)
    .optional(),
  
  isPublic: z.boolean().optional(),
  
  isTemplate: z.boolean().optional()
})

export type StackListQuery = z.infer<typeof StackListQuerySchema>

/**
 * Complete Stack Entity Types (with database fields)
 */
export interface StackEntity {
  id: string
  name: string
  description?: string
  slug: string
  userId?: string
  isPublic: boolean
  isTemplate: boolean
  status: StackStatusType
  createdAt: Date
  updatedAt: Date
  stackServices?: StackServiceEntity[]
}

export interface StackServiceEntity {
  id: string
  stackId: string
  serviceId: number
  order: number
  createdAt: Date
  configurations?: StackServiceConfigurationEntity[]
  service?: any // Service entity from existing schemas
}

export interface StackServiceConfigurationEntity {
  id: string
  stackServiceId: string
  environmentVariables: StackEnvVar
  portMappings: StackPortMapping
  volumeMounts: StackVolumeMount
  dependsOn: StackDependencies
  createdAt: Date
  updatedAt: Date
}

/**
 * Stack validation helper functions
 */
export const StackValidationHelpers = {
  /**
   * Generate unique stack slug from name
   */
  generateStackSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
  },

  /**
   * Validate JSON string for database storage
   */
  validateJsonString(jsonString: string): boolean {
    try {
      JSON.parse(jsonString)
      return true
    } catch {
      return false
    }
  },

  /**
   * Parse JSON configuration safely
   */
  parseJsonConfig<T>(jsonString: string, fallback: T): T {
    try {
      return JSON.parse(jsonString) as T
    } catch {
      return fallback
    }
  },

  /**
   * Stringify configuration for database storage
   */
  stringifyConfig(config: any): string {
    return JSON.stringify(config || {})
  },

  /**
   * Validate port conflict in stack
   */
  validatePortConflicts(services: Array<{ portMappings: StackPortMapping }>): string[] {
    const usedHostPorts = new Set<string>()
    const conflicts: string[] = []

    for (const service of services) {
      for (const [containerPort, hostPort] of Object.entries(service.portMappings)) {
        if (usedHostPorts.has(hostPort)) {
          conflicts.push(`Host port ${hostPort} is used multiple times`)
        }
        usedHostPorts.add(hostPort)
      }
    }

    return conflicts
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
 * Stack schema validation utilities
 */
export const StackSchemaUtils = {
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
      errors: StackValidationHelpers.formatValidationErrors(result.error)
    }
  },

  /**
   * Validate stack creation data
   */
  validateStackCreate(data: unknown) {
    return this.safeParseWithErrors(StackCreateSchema, data)
  },

  /**
   * Validate stack update data
   */
  validateStackUpdate(data: unknown) {
    return this.safeParseWithErrors(StackUpdateSchema, data)
  },

  /**
   * Validate stack service add data
   */
  validateStackServiceAdd(data: unknown) {
    return this.safeParseWithErrors(StackServiceAddSchema, data)
  },

  /**
   * Validate stack service configuration update
   */
  validateStackServiceConfigurationUpdate(data: unknown) {
    return this.safeParseWithErrors(StackServiceConfigurationUpdateSchema, data)
  },

  /**
   * Validate stack list query
   */
  validateStackListQuery(data: unknown) {
    return this.safeParseWithErrors(StackListQuerySchema, data)
  }
}