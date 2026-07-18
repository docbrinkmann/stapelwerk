import { z } from 'zod'

/**
 * Validation Error Handling Utilities
 * 
 * Comprehensive error handling system for validation with user-friendly messages,
 * internationalization support, and standardized error responses.
 */

/**
 * Standard error response format for APIs
 */
export interface ValidationErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: ValidationFieldError[]
    timestamp: string
  }
}

/**
 * Field-specific validation error
 */
export interface ValidationFieldError {
  field: string
  message: string
  code: string
  value?: any
}

/**
 * Success response format
 */
export interface ValidationSuccessResponse<T> {
  success: true
  data: T
}

/**
 * Combined response type
 */
export type ValidationResponse<T> = ValidationSuccessResponse<T> | ValidationErrorResponse

/**
 * Error codes for different validation failures
 */
export const ValidationErrorCodes = {
  // General validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_TYPE: 'INVALID_TYPE',
  
  // String validation
  STRING_TOO_SHORT: 'STRING_TOO_SHORT',
  STRING_TOO_LONG: 'STRING_TOO_LONG',
  INVALID_PATTERN: 'INVALID_PATTERN',
  
  // Number validation
  NUMBER_TOO_SMALL: 'NUMBER_TOO_SMALL',
  NUMBER_TOO_LARGE: 'NUMBER_TOO_LARGE',
  NOT_POSITIVE: 'NOT_POSITIVE',
  NOT_INTEGER: 'NOT_INTEGER',
  
  // Array validation
  ARRAY_TOO_SHORT: 'ARRAY_TOO_SHORT',
  ARRAY_TOO_LONG: 'ARRAY_TOO_LONG',
  INVALID_ARRAY_ITEM: 'INVALID_ARRAY_ITEM',
  
  // Service-specific errors
  INVALID_SERVICE_NAME: 'INVALID_SERVICE_NAME',
  INVALID_DOCKER_IMAGE: 'INVALID_DOCKER_IMAGE',
  INVALID_DOCKER_VERSION: 'INVALID_DOCKER_VERSION',
  INVALID_SEMVER: 'INVALID_SEMVER',
  INVALID_URL: 'INVALID_URL',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PORT_RANGE: 'INVALID_PORT_RANGE',
  INVALID_ENV_VAR_NAME: 'INVALID_ENV_VAR_NAME',
  INVALID_ENUM_VALUE: 'INVALID_ENUM_VALUE',
  
  // Database errors
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',
  NOT_FOUND: 'NOT_FOUND',
  
  // Authorization errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN'
} as const

/**
 * User-friendly error messages with context
 */
export const ValidationErrorMessages = {
  [ValidationErrorCodes.INVALID_INPUT]: 'The provided data is invalid. Please check your input and try again.',
  [ValidationErrorCodes.REQUIRED_FIELD]: (field: string) => `${field} is required and cannot be empty.`,
  [ValidationErrorCodes.INVALID_FORMAT]: (field: string, format: string) => `${field} must be in ${format} format.`,
  [ValidationErrorCodes.INVALID_TYPE]: (field: string, expectedType: string) => `${field} must be a ${expectedType}.`,
  
  // String validation messages
  [ValidationErrorCodes.STRING_TOO_SHORT]: (field: string, min: number) => 
    `${field} must be at least ${min} character${min === 1 ? '' : 's'} long.`,
  [ValidationErrorCodes.STRING_TOO_LONG]: (field: string, max: number) => 
    `${field} must not exceed ${max} character${max === 1 ? '' : 's'}.`,
  [ValidationErrorCodes.INVALID_PATTERN]: (field: string, pattern: string) => 
    `${field} format is invalid. ${pattern}`,
  
  // Number validation messages  
  [ValidationErrorCodes.NUMBER_TOO_SMALL]: (field: string, min: number) => 
    `${field} must be at least ${min}.`,
  [ValidationErrorCodes.NUMBER_TOO_LARGE]: (field: string, max: number) => 
    `${field} must not exceed ${max}.`,
  [ValidationErrorCodes.NOT_POSITIVE]: (field: string) => 
    `${field} must be a positive number (greater than 0).`,
  [ValidationErrorCodes.NOT_INTEGER]: (field: string) => 
    `${field} must be a whole number.`,
  
  // Array validation messages
  [ValidationErrorCodes.ARRAY_TOO_SHORT]: (field: string, min: number) => 
    `${field} must contain at least ${min} item${min === 1 ? '' : 's'}.`,
  [ValidationErrorCodes.ARRAY_TOO_LONG]: (field: string, max: number) => 
    `${field} must not contain more than ${max} item${max === 1 ? '' : 's'}.`,
  [ValidationErrorCodes.INVALID_ARRAY_ITEM]: (field: string, index: number) => 
    `Item ${index + 1} in ${field} is invalid.`,
  
  // Service-specific messages
  [ValidationErrorCodes.INVALID_SERVICE_NAME]: 
    'Service name can only contain letters, numbers, spaces, and hyphens.',
  [ValidationErrorCodes.INVALID_DOCKER_IMAGE]: 
    'Docker image must be in format "image:tag" or "registry/namespace/image:tag".',
  [ValidationErrorCodes.INVALID_DOCKER_VERSION]: 
    'Docker version must be in format "x.y.z" (e.g., 20.10.0).',
  [ValidationErrorCodes.INVALID_SEMVER]: 
    'Version must be in semantic versioning format (e.g., 1.0.0) or "latest".',
  [ValidationErrorCodes.INVALID_URL]: 
    'Please enter a valid HTTP or HTTPS URL.',
  [ValidationErrorCodes.INVALID_EMAIL]: 
    'Please enter a valid email address.',
  [ValidationErrorCodes.INVALID_PORT_RANGE]: 
    'Port number must be between 1 and 65535.',
  [ValidationErrorCodes.INVALID_ENV_VAR_NAME]: 
    'Environment variable names must start with a letter and contain only uppercase letters, numbers, and underscores.',
  [ValidationErrorCodes.INVALID_ENUM_VALUE]: (field: string, validValues: string[]) => 
    `${field} must be one of: ${validValues.join(', ')}.`,
  
  // Database error messages
  [ValidationErrorCodes.DUPLICATE_ENTRY]: (field: string) => 
    `A record with this ${field} already exists. Please choose a different value.`,
  [ValidationErrorCodes.FOREIGN_KEY_VIOLATION]: (field: string) => 
    `The specified ${field} does not exist or is invalid.`,
  [ValidationErrorCodes.NOT_FOUND]: (resource: string) => 
    `The requested ${resource} was not found.`,
  
  // Authorization messages
  [ValidationErrorCodes.UNAUTHORIZED]: 
    'Authentication is required to perform this action.',
  [ValidationErrorCodes.FORBIDDEN]: 
    'You do not have permission to perform this action.'
} as const

/**
 * Context-aware field names for better error messages
 */
export const FieldDisplayNames = {
  // Service fields
  'name': 'Service name',
  'description': 'Description', 
  'dockerImage': 'Docker image',
  'version': 'Version',
  'categoryId': 'Category',
  'documentationUrl': 'Documentation URL',
  'featured': 'Featured status',
  
  // Port fields
  'ports': 'Ports',
  'ports.containerPort': 'Container port',
  'ports.hostPort': 'Host port', 
  'ports.protocol': 'Protocol',
  'ports.description': 'Port description',
  
  // Environment variable fields
  'environmentVariables': 'Environment variables',
  'environmentVariables.name': 'Environment variable name',
  'environmentVariables.defaultValue': 'Default value',
  'environmentVariables.required': 'Required status',
  'environmentVariables.type': 'Variable type',
  'environmentVariables.description': 'Variable description',
  
  // Resource fields
  'resourceRequirements': 'Resource requirements',
  'resourceRequirements.minCpu': 'Minimum CPU',
  'resourceRequirements.recommendedCpu': 'Recommended CPU',
  'resourceRequirements.minMemory': 'Minimum memory',
  'resourceRequirements.recommendedMemory': 'Recommended memory',
  'resourceRequirements.storageRequired': 'Storage required',
  'resourceRequirements.minimumStorage': 'Minimum storage',
  
  // Compatibility fields
  'compatibilityInfo': 'Compatibility information',
  'compatibilityInfo.operatingSystems': 'Operating systems',
  'compatibilityInfo.architectures': 'Architectures',
  'compatibilityInfo.minDockerVersion': 'Minimum Docker version',
  'compatibilityInfo.conflicts': 'Conflicting services',
  
  // Category fields
  'icon': 'Icon',
  'sortOrder': 'Sort order',
  
  // Import fields
  'sourceUrl': 'Source URL',
  'sourceType': 'Source type',
  'submittedBy': 'Submitted by',
  'extractedMetadata': 'Extracted metadata',
  'status': 'Status',
  'reviewedBy': 'Reviewed by',
  'reviewNotes': 'Review notes',
  'serviceId': 'Service ID'
} as const

/**
 * Enhanced validation error handling class
 */
export class ValidationErrorHandler {
  /**
   * Convert Zod error to user-friendly validation response
   */
  static handleZodError<T>(error: z.ZodError): ValidationErrorResponse {
    const fieldErrors = error.issues.map(issue => this.convertZodIssueToFieldError(issue))
    
    return {
      success: false,
      error: {
        code: ValidationErrorCodes.INVALID_INPUT,
        message: 'The provided data contains validation errors. Please check the details below.',
        details: fieldErrors,
        timestamp: new Date().toISOString()
      }
    }
  }
  
  /**
   * Create successful validation response
   */
  static createSuccessResponse<T>(data: T): ValidationSuccessResponse<T> {
    return {
      success: true,
      data
    }
  }
  
  /**
   * Create custom error response
   */
  static createErrorResponse(
    code: keyof typeof ValidationErrorCodes,
    message: string,
    details?: ValidationFieldError[]
  ): ValidationErrorResponse {
    return {
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString()
      }
    }
  }
  
  /**
   * Convert individual Zod issue to field error
   */
  private static convertZodIssueToFieldError(issue: z.ZodIssue): ValidationFieldError {
    const fieldPath = issue.path.join('.')
    const fieldName = this.getFieldDisplayName(fieldPath)
    
    let errorCode: string
    let message: string
    
    switch (issue.code) {
      case 'invalid_type':
        errorCode = ValidationErrorCodes.INVALID_TYPE
        message = ValidationErrorMessages[ValidationErrorCodes.INVALID_TYPE](
          fieldName, 
          issue.expected
        )
        break
        
      case 'too_small':
        if ((issue as any).type === 'string') {
          errorCode = ValidationErrorCodes.STRING_TOO_SHORT
          message = ValidationErrorMessages[ValidationErrorCodes.STRING_TOO_SHORT](
            fieldName,
            issue.minimum as number
          )
        } else if ((issue as any).type === 'number') {
          errorCode = ValidationErrorCodes.NUMBER_TOO_SMALL
          message = ValidationErrorMessages[ValidationErrorCodes.NUMBER_TOO_SMALL](
            fieldName,
            issue.minimum as number
          )
        } else if ((issue as any).type === 'array') {
          errorCode = ValidationErrorCodes.ARRAY_TOO_SHORT
          message = ValidationErrorMessages[ValidationErrorCodes.ARRAY_TOO_SHORT](
            fieldName,
            issue.minimum as number
          )
        } else {
          errorCode = ValidationErrorCodes.INVALID_INPUT
          message = issue.message
        }
        break
        
      case 'too_big':
        if ((issue as any).type === 'string') {
          errorCode = ValidationErrorCodes.STRING_TOO_LONG
          message = ValidationErrorMessages[ValidationErrorCodes.STRING_TOO_LONG](
            fieldName,
            issue.maximum as number
          )
        } else if ((issue as any).type === 'number') {
          errorCode = ValidationErrorCodes.NUMBER_TOO_LARGE
          message = ValidationErrorMessages[ValidationErrorCodes.NUMBER_TOO_LARGE](
            fieldName,
            issue.maximum as number
          )
        } else if ((issue as any).type === 'array') {
          errorCode = ValidationErrorCodes.ARRAY_TOO_LONG
          message = ValidationErrorMessages[ValidationErrorCodes.ARRAY_TOO_LONG](
            fieldName,
            issue.maximum as number
          )
        } else {
          errorCode = ValidationErrorCodes.INVALID_INPUT
          message = issue.message
        }
        break
        
      case 'invalid_format':
        if ((issue as any).validation === 'email') {
          errorCode = ValidationErrorCodes.INVALID_EMAIL
          message = ValidationErrorMessages[ValidationErrorCodes.INVALID_EMAIL]
        } else if ((issue as any).validation === 'url') {
          errorCode = ValidationErrorCodes.INVALID_URL
          message = ValidationErrorMessages[ValidationErrorCodes.INVALID_URL]
        } else if ((issue as any).validation === 'regex') {
          errorCode = ValidationErrorCodes.INVALID_PATTERN
          // Use custom message from schema if available, otherwise generic pattern message
          message = issue.message.includes('Docker') 
            ? ValidationErrorMessages[ValidationErrorCodes.INVALID_DOCKER_IMAGE]
            : issue.message.includes('version')
            ? ValidationErrorMessages[ValidationErrorCodes.INVALID_SEMVER] 
            : issue.message.includes('Environment variable')
            ? ValidationErrorMessages[ValidationErrorCodes.INVALID_ENV_VAR_NAME]
            : ValidationErrorMessages[ValidationErrorCodes.INVALID_PATTERN](fieldName, 'the expected')
        } else {
          errorCode = ValidationErrorCodes.INVALID_FORMAT
          message = ValidationErrorMessages[ValidationErrorCodes.INVALID_FORMAT](fieldName, 'the expected')
        }
        break
        
      case 'invalid_value':
        if ((issue as any).options) {
          errorCode = ValidationErrorCodes.INVALID_ENUM_VALUE
          message = ValidationErrorMessages[ValidationErrorCodes.INVALID_ENUM_VALUE](
            fieldName,
            (issue as any).options as string[]
          )
        } else {
          errorCode = ValidationErrorCodes.INVALID_INPUT
          message = issue.message
        }
        break
        
      case 'custom':
        // Handle custom validation messages
        if (issue.message.includes('positive')) {
          errorCode = ValidationErrorCodes.NOT_POSITIVE
          message = ValidationErrorMessages[ValidationErrorCodes.NOT_POSITIVE](fieldName)
        } else if (issue.message.includes('integer')) {
          errorCode = ValidationErrorCodes.NOT_INTEGER
          message = ValidationErrorMessages[ValidationErrorCodes.NOT_INTEGER](fieldName)
        } else {
          errorCode = ValidationErrorCodes.INVALID_INPUT
          message = issue.message
        }
        break
        
      default:
        errorCode = ValidationErrorCodes.INVALID_INPUT
        message = issue.message || `${fieldName} is invalid`
        break
    }
    
    return {
      field: fieldPath,
      message,
      code: errorCode,
      value: issue.path.length > 0 ? (issue as any).received : undefined
    }
  }
  
  /**
   * Get user-friendly field display name
   */
  private static getFieldDisplayName(fieldPath: string): string {
    // Check for exact match first
    if (fieldPath in FieldDisplayNames) {
      return FieldDisplayNames[fieldPath as keyof typeof FieldDisplayNames]
    }
    
    // Check for pattern matches (e.g., ports.0.containerPort -> Container port)
    const patterns = Object.keys(FieldDisplayNames)
    for (const pattern of patterns) {
      if (pattern.includes('.') && fieldPath.match(new RegExp(pattern.replace(/\.\d+/g, '\\.\\d+')))) {
        return FieldDisplayNames[pattern as keyof typeof FieldDisplayNames]
      }
    }
    
    // Fallback to formatted field path
    return fieldPath
      .split('.')
      .pop()
      ?.replace(/([A-Z])/g, ' $1')
      ?.replace(/^./, str => str.toUpperCase()) || 'Field'
  }
  
  /**
   * Safe validation with proper error handling
   */
  static validateSafely<T>(
    schema: z.ZodSchema<T>, 
    data: unknown
  ): ValidationResponse<T> {
    try {
      const result = schema.safeParse(data)
      
      if (result.success) {
        return this.createSuccessResponse(result.data)
      } else {
        return this.handleZodError(result.error)
      }
    } catch (error) {
      // Handle unexpected errors during validation
      return this.createErrorResponse(
        ValidationErrorCodes.INVALID_INPUT,
        'An unexpected error occurred during validation. Please try again.',
        []
      )
    }
  }
  
  /**
   * Combine multiple validation errors
   */
  static combineErrors(errors: ValidationFieldError[]): ValidationErrorResponse {
    return {
      success: false,
      error: {
        code: ValidationErrorCodes.INVALID_INPUT,
        message: `Found ${errors.length} validation error${errors.length === 1 ? '' : 's'}. Please correct the highlighted fields.`,
        details: errors,
        timestamp: new Date().toISOString()
      }
    }
  }
  
  /**
   * Create database constraint error
   */
  static createDatabaseError(
    code: 'DUPLICATE_ENTRY' | 'FOREIGN_KEY_VIOLATION' | 'NOT_FOUND',
    field: string,
    resourceName?: string
  ): ValidationErrorResponse {
    let message: string
    
    switch (code) {
      case 'DUPLICATE_ENTRY':
        message = ValidationErrorMessages[ValidationErrorCodes.DUPLICATE_ENTRY](field)
        break
      case 'FOREIGN_KEY_VIOLATION':
        message = ValidationErrorMessages[ValidationErrorCodes.FOREIGN_KEY_VIOLATION](field)
        break
      case 'NOT_FOUND':
        message = ValidationErrorMessages[ValidationErrorCodes.NOT_FOUND](resourceName || 'resource')
        break
    }
    
    return this.createErrorResponse(code, message, [])
  }
}

/**
 * Convenient validation utility functions
 */
export const ValidationUtils = {
  /**
   * Check if response is successful
   */
  isSuccess<T>(response: ValidationResponse<T>): response is ValidationSuccessResponse<T> {
    return response.success === true
  },
  
  /**
   * Check if response is an error
   */
  isError<T>(response: ValidationResponse<T>): response is ValidationErrorResponse {
    return response.success === false
  },
  
  /**
   * Extract data from successful response or throw error
   */
  unwrapSuccess<T>(response: ValidationResponse<T>): T {
    if (this.isSuccess(response)) {
      return response.data
    }
    throw new Error(`Validation failed: ${response.error.message}`)
  },
  
  /**
   * Extract error details from error response
   */
  extractErrors(response: ValidationErrorResponse): ValidationFieldError[] {
    return response.error.details || []
  },
  
  /**
   * Get error message for specific field
   */
  getFieldError(response: ValidationErrorResponse, fieldPath: string): ValidationFieldError | undefined {
    return response.error.details?.find(error => error.field === fieldPath)
  }
}