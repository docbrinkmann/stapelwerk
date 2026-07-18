import { describe, it, expect } from 'vitest'
import {
  ValidationErrorHandler,
  ValidationUtils,
  ValidationErrorCodes,
  ValidationErrorMessages,
  FieldDisplayNames
} from '../../lib/validation/error-handling'
import { ServiceCreateSchema } from '../../lib/validation/service-catalog-schemas'

describe('Validation Error Handling', () => {
  
  describe('ValidationErrorHandler', () => {
    
    it('should convert Zod error to user-friendly response', () => {
      const invalidData = {
        name: 'a', // too short
        dockerImage: 'invalid-image' // invalid format
        // missing required fields
      }
      
      const result = ServiceCreateSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      
      if (!result.success) {
        const errorResponse = ValidationErrorHandler.handleZodError(result.error)
        
        expect(errorResponse.success).toBe(false)
        expect(errorResponse.error.code).toBe('INVALID_INPUT')
        expect(errorResponse.error.message).toContain('validation errors')
        expect(errorResponse.error.details).toBeDefined()
        expect(errorResponse.error.details!.length).toBeGreaterThan(0)
        expect(errorResponse.error.timestamp).toBeDefined()
      }
    })
    
    it('should create success response', () => {
      const data = { test: 'value' }
      const response = ValidationErrorHandler.createSuccessResponse(data)
      
      expect(response.success).toBe(true)
      expect(response.data).toEqual(data)
    })
    
    it('should create custom error response', () => {
      const response = ValidationErrorHandler.createErrorResponse(
        'NOT_FOUND',
        'Resource not found',
        []
      )
      
      expect(response.success).toBe(false)
      expect(response.error.code).toBe('NOT_FOUND')
      expect(response.error.message).toBe('Resource not found')
      expect(response.error.details).toEqual([])
      expect(response.error.timestamp).toBeDefined()
    })
    
    it('should handle safe validation correctly', () => {
      const validData = {
        name: 'Test Service',
        description: 'A valid test service description',
        dockerImage: 'nginx:latest',
        categoryId: 1
      }
      
      const response = ValidationErrorHandler.validateSafely(ServiceCreateSchema, validData)
      
      expect(response.success).toBe(true)
      if (response.success) {
        expect(response.data).toBeDefined()
        expect(response.data.name).toBe('Test Service')
      }
    })
    
    it('should handle validation errors safely', () => {
      const invalidData = {
        name: 'a' // too short
      }
      
      const response = ValidationErrorHandler.validateSafely(ServiceCreateSchema, invalidData)
      
      expect(response.success).toBe(false)
      if (!response.success) {
        expect(response.error.code).toBe('INVALID_INPUT')
        expect(response.error.details).toBeDefined()
        expect(response.error.details!.length).toBeGreaterThan(0)
      }
    })
    
    it('should combine multiple errors', () => {
      const errors = [
        {
          field: 'name',
          message: 'Name is required',
          code: 'REQUIRED_FIELD'
        },
        {
          field: 'email',
          message: 'Invalid email format',
          code: 'INVALID_EMAIL'
        }
      ]
      
      const response = ValidationErrorHandler.combineErrors(errors)
      
      expect(response.success).toBe(false)
      expect(response.error.message).toContain('2 validation errors')
      expect(response.error.details).toEqual(errors)
    })
    
    it('should create database constraint errors', () => {
      const response = ValidationErrorHandler.createDatabaseError(
        'DUPLICATE_ENTRY',
        'email'
      )
      
      expect(response.success).toBe(false)
      expect(response.error.code).toBe('DUPLICATE_ENTRY')
      expect(response.error.message).toContain('already exists')
    })
  })
  
  describe('ValidationUtils', () => {
    
    it('should identify success responses correctly', () => {
      const successResponse = ValidationErrorHandler.createSuccessResponse({ test: 'data' })
      const errorResponse = ValidationErrorHandler.createErrorResponse('INVALID_INPUT', 'Error')
      
      expect(ValidationUtils.isSuccess(successResponse)).toBe(true)
      expect(ValidationUtils.isSuccess(errorResponse)).toBe(false)
      expect(ValidationUtils.isError(successResponse)).toBe(false)
      expect(ValidationUtils.isError(errorResponse)).toBe(true)
    })
    
    it('should unwrap success data', () => {
      const testData = { test: 'value' }
      const successResponse = ValidationErrorHandler.createSuccessResponse(testData)
      
      const unwrapped = ValidationUtils.unwrapSuccess(successResponse)
      expect(unwrapped).toEqual(testData)
    })
    
    it('should throw error when unwrapping error response', () => {
      const errorResponse = ValidationErrorHandler.createErrorResponse('INVALID_INPUT', 'Test error')
      
      expect(() => ValidationUtils.unwrapSuccess(errorResponse)).toThrow('Validation failed')
    })
    
    it('should extract error details', () => {
      const errors = [
        { field: 'name', message: 'Required', code: 'REQUIRED_FIELD' }
      ]
      const errorResponse = ValidationErrorHandler.combineErrors(errors)
      
      const extractedErrors = ValidationUtils.extractErrors(errorResponse)
      expect(extractedErrors).toEqual(errors)
    })
    
    it('should get field-specific errors', () => {
      const errors = [
        { field: 'name', message: 'Name required', code: 'REQUIRED_FIELD' },
        { field: 'email', message: 'Email invalid', code: 'INVALID_EMAIL' }
      ]
      const errorResponse = ValidationErrorHandler.combineErrors(errors)
      
      const nameError = ValidationUtils.getFieldError(errorResponse, 'name')
      expect(nameError).toBeDefined()
      expect(nameError?.message).toBe('Name required')
      
      const nonExistentError = ValidationUtils.getFieldError(errorResponse, 'nonexistent')
      expect(nonExistentError).toBeUndefined()
    })
  })
  
  describe('Error Messages and Field Names', () => {
    
    it('should have comprehensive error codes', () => {
      expect(ValidationErrorCodes.INVALID_INPUT).toBeDefined()
      expect(ValidationErrorCodes.INVALID_DOCKER_IMAGE).toBeDefined()
      expect(ValidationErrorCodes.INVALID_URL).toBeDefined()
      expect(ValidationErrorCodes.DUPLICATE_ENTRY).toBeDefined()
    })
    
    it('should have user-friendly error messages', () => {
      expect(ValidationErrorMessages[ValidationErrorCodes.INVALID_INPUT]).toBeDefined()
      expect(ValidationErrorMessages[ValidationErrorCodes.INVALID_DOCKER_IMAGE]).toBeDefined()
      
      // Test function-based messages
      const fieldErrorMsg = ValidationErrorMessages[ValidationErrorCodes.REQUIRED_FIELD]('Name')
      expect(fieldErrorMsg).toContain('Name')
      expect(fieldErrorMsg).toContain('required')
    })
    
    it('should have context-aware field names', () => {
      expect(FieldDisplayNames.name).toBe('Service name')
      expect(FieldDisplayNames.dockerImage).toBe('Docker image')
      expect(FieldDisplayNames['ports.containerPort']).toBe('Container port')
    })
  })
  
  describe('Error Message Generation', () => {
    
    it('should generate contextual error messages for service validation', () => {
      const invalidService = {
        name: '', // empty string
        description: 'short', // too short  
        dockerImage: 'invalid', // invalid format
        categoryId: 'not-number', // wrong type
        ports: [
          { containerPort: 0, protocol: 'tcp' as const } // invalid port and protocol
        ]
      }
      
      const result = ServiceCreateSchema.safeParse(invalidService)
      expect(result.success).toBe(false)
      
      if (!result.success) {
        const errorResponse = ValidationErrorHandler.handleZodError(result.error)
        const errors = errorResponse.error.details || []
        
        // Should have multiple validation errors
        expect(errors.length).toBeGreaterThan(3)
        
        // Should have meaningful error messages
        const errorMessages = errors.map(e => e.message)
        expect(errorMessages.some(msg => msg.length > 10)).toBe(true) // Non-trivial messages
        
        // Should have proper field paths
        const errorFields = errors.map(e => e.field)
        expect(errorFields).toContain('name')
        expect(errorFields).toContain('description')
        expect(errorFields).toContain('dockerImage')
      }
    })
    
    it('should handle nested field errors correctly', () => {
      const serviceWithInvalidPorts = {
        name: 'Test Service',
        description: 'Valid description for testing nested errors',
        dockerImage: 'nginx:latest',
        categoryId: 1,
        ports: [
          { containerPort: 70000, protocol: 'tcp' as const } // port too high, invalid protocol
        ]
      }
      
      const result = ServiceCreateSchema.safeParse(serviceWithInvalidPorts)
      expect(result.success).toBe(false)
      
      if (!result.success) {
        const errorResponse = ValidationErrorHandler.handleZodError(result.error)
        const errors = errorResponse.error.details || []
        
        // Should have errors for nested port fields
        const portErrors = errors.filter(e => e.field.includes('ports'))
        expect(portErrors.length).toBeGreaterThan(0)
        
        // Should have meaningful messages for port validation
        const portErrorMessages = portErrors.map(e => e.message)
        expect(portErrorMessages.some(msg => 
          msg.includes('port') || msg.includes('protocol')
        )).toBe(true)
      }
    })
  })
})