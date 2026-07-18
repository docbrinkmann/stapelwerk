import { PrismaClient } from '@prisma/client'
import { ExtractedMetadata } from './docker-hub-extractor'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  conflicts: ConflictInfo[]
  suggestions: string[]
}

export interface ConflictInfo {
  type: 'duplicate_service' | 'similar_name' | 'same_image' | 'conflicting_ports'
  severity: 'high' | 'medium' | 'low'
  description: string
  existingItem: {
    id: number
    name: string
    slug?: string
    dockerImage?: string
  }
}

export class MetadataValidator {
  constructor(private prisma: PrismaClient) {}

  /**
   * Comprehensive validation of extracted metadata
   */
  async validateMetadata(metadata: ExtractedMetadata, sourceUrl: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      conflicts: [],
      suggestions: []
    }

    // Basic metadata validation
    this.validateBasicMetadata(metadata, result)

    // Check for duplicates and conflicts
    await this.checkForConflicts(metadata, sourceUrl, result)

    // Security and quality checks
    this.performSecurityChecks(metadata, result)

    // Performance and best practices
    this.performQualityChecks(metadata, result)

    // Set overall validity
    result.isValid = result.errors.length === 0

    return result
  }

  /**
   * Validate basic metadata structure and content
   */
  private validateBasicMetadata(metadata: ExtractedMetadata, result: ValidationResult): void {
    // Name validation
    if (!metadata.name || metadata.name.length < 2) {
      result.errors.push('Service name must be at least 2 characters long')
    }

    if (metadata.name && metadata.name.length > 100) {
      result.errors.push('Service name cannot exceed 100 characters')
    }

    // Namespace validation
    if (!metadata.namespace) {
      result.errors.push('Service namespace is required')
    }

    // Description validation
    if (metadata.description && metadata.description.length > 1000) {
      result.warnings.push('Description is very long and may be truncated')
    }

    if (!metadata.description || metadata.description.length < 10) {
      result.warnings.push('Service description is missing or too short')
    }

    // Tags validation
    if (!metadata.tags || metadata.tags.length === 0) {
      result.warnings.push('No tags found for the service')
    }

    // Port validation
    if (metadata.exposedPorts && metadata.exposedPorts.length > 0) {
      for (const port of metadata.exposedPorts) {
        if (port.containerPort < 1 || port.containerPort > 65535) {
          result.errors.push(`Invalid port number: ${port.containerPort}`)
        }

        if (port.protocol && !['tcp', 'udp'].includes(port.protocol.toLowerCase())) {
          result.errors.push(`Invalid protocol: ${port.protocol}`)
        }
      }
    }

    // Environment variables validation
    if (metadata.environmentVariables && metadata.environmentVariables.length > 0) {
      for (const env of metadata.environmentVariables) {
        if (!env.name || env.name.length === 0) {
          result.errors.push('Environment variable name cannot be empty')
        }

        if (env.name && !/^[A-Z_][A-Z0-9_]*$/.test(env.name)) {
          result.warnings.push(`Environment variable "${env.name}" does not follow standard naming convention`)
        }
      }
    }

    // Pull count validation (sanity check)
    if (metadata.pullCount < 0) {
      result.errors.push('Pull count cannot be negative')
    }

    if (metadata.pullCount > 10000000000) {
      result.warnings.push('Pull count seems unusually high')
    }

    // Star count validation
    if (metadata.starCount < 0) {
      result.errors.push('Star count cannot be negative')
    }
  }

  /**
   * Check for conflicts with existing services
   */
  private async checkForConflicts(
    metadata: ExtractedMetadata, 
    sourceUrl: string, 
    result: ValidationResult
  ): Promise<void> {
    // Check for exact name match
const existingServiceByName = await this.prisma.services.findFirst({
      where: { name: { equals: metadata.name } }
    })

    if (existingServiceByName) {
      result.conflicts.push({
        type: 'duplicate_service',
        severity: 'high',
        description: `Service with name "${metadata.name}" already exists`,
        existingItem: {
          id: existingServiceByName.id,
          name: existingServiceByName.name,
          slug: existingServiceByName.slug,
          dockerImage: existingServiceByName.dockerImage
        }
      })
    }

    // Check for similar names (fuzzy matching)
    const similarServices = await this.findSimilarServices(metadata.name)
    for (const similar of similarServices) {
      result.conflicts.push({
        type: 'similar_name',
        severity: 'medium',
        description: `Similar service "${similar.name}" already exists`,
        existingItem: {
          id: similar.id,
          name: similar.name,
          slug: similar.slug,
          dockerImage: similar.dockerImage
        }
      })
    }

    // Check for same Docker image
const existingServiceByImage = await this.prisma.services.findFirst({
      where: { dockerImage: sourceUrl }
    })

    if (existingServiceByImage) {
      result.conflicts.push({
        type: 'same_image',
        severity: 'high',
        description: `Service using the same Docker image "${sourceUrl}" already exists`,
        existingItem: {
          id: existingServiceByImage.id,
          name: existingServiceByImage.name,
          slug: existingServiceByImage.slug,
          dockerImage: existingServiceByImage.dockerImage
        }
      })
    }

    // Check for conflicting ports
    if (metadata.exposedPorts && metadata.exposedPorts.length > 0) {
      await this.checkPortConflicts(metadata.exposedPorts, result)
    }
  }

  /**
   * Find services with similar names using basic string similarity
   */
  private async findSimilarServices(name: string): Promise<any[]> {
    // Simple similarity check - find services with names that are substrings or have similar patterns
const services = await this.prisma.services.findMany({
      where: {
        OR: [
          { name: { contains: name.split(/[^a-zA-Z0-9]/)[0] } },
          { name: { startsWith: name.substring(0, 3) } }
        ]
      },
      take: 5
    })

    return services.filter(service => 
      service.name.toLowerCase() !== name.toLowerCase() &&
      this.calculateSimilarity(service.name.toLowerCase(), name.toLowerCase()) > 0.7
    )
  }

  /**
   * Calculate similarity between two strings (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = []
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  /**
   * Check for port conflicts with existing services
   */
  private async checkPortConflicts(
    exposedPorts: Array<{ containerPort: number; protocol: string }>,
    result: ValidationResult
  ): Promise<void> {
    for (const port of exposedPorts) {
      // Common port checks
      const commonPorts = [
        { port: 22, service: 'SSH' },
        { port: 80, service: 'HTTP' },
        { port: 443, service: 'HTTPS' },
        { port: 3306, service: 'MySQL' },
        { port: 5432, service: 'PostgreSQL' },
        { port: 6379, service: 'Redis' },
        { port: 27017, service: 'MongoDB' },
        { port: 25, service: 'SMTP' },
        { port: 53, service: 'DNS' }
      ]

      const commonPort = commonPorts.find(cp => cp.port === port.containerPort)
      if (commonPort) {
        const existingServices = await this.prisma.services.findMany({
          where: {
            ports: {
              contains: `"containerPort":${port.containerPort}`
            }
          },
          take: 3
        })

        if (existingServices.length > 0) {
          result.conflicts.push({
            type: 'conflicting_ports',
            severity: 'medium',
            description: `Port ${port.containerPort} (${commonPort.service}) is commonly used and conflicts with ${existingServices.length} existing service(s)`,
            existingItem: {
              id: existingServices[0].id,
              name: existingServices[0].name,
              dockerImage: existingServices[0].dockerImage
            }
          })
        }
      }
    }
  }

  /**
   * Perform security checks on metadata
   */
  private performSecurityChecks(metadata: ExtractedMetadata, result: ValidationResult): void {
    // Check for potentially dangerous environment variables
    const dangerousEnvVars = [
      'PASSWORD', 'PASSWD', 'SECRET', 'KEY', 'TOKEN', 'CREDENTIAL'
    ]

    if (metadata.environmentVariables) {
      for (const env of metadata.environmentVariables) {
        if (dangerousEnvVars.some(danger => env.name.toUpperCase().includes(danger))) {
          result.warnings.push(`Environment variable "${env.name}" may contain sensitive information`)
        }

        if (env.defaultValue && env.defaultValue.length > 0) {
          if (dangerousEnvVars.some(danger => env.name.toUpperCase().includes(danger))) {
            result.errors.push(`Environment variable "${env.name}" has a default value but may contain sensitive information`)
          }
        }
      }
    }

    // Check for privileged ports (< 1024)
    if (metadata.exposedPorts) {
      const privilegedPorts = metadata.exposedPorts.filter(p => p.containerPort < 1024)
      if (privilegedPorts.length > 0) {
        result.warnings.push(`Service exposes privileged ports: ${privilegedPorts.map(p => p.containerPort).join(', ')}`)
      }
    }

    // Check user configuration
    if (metadata.user === 'root') {
      result.warnings.push('Service runs as root user, which may pose security risks')
    }

    // Check base image
    if (metadata.baseImage && metadata.baseImage.toLowerCase().includes('scratch')) {
      result.suggestions.push('Using scratch base image is good for security but ensure all dependencies are included')
    }
  }

  /**
   * Perform quality and best practices checks
   */
  private performQualityChecks(metadata: ExtractedMetadata, result: ValidationResult): void {
    // Check image popularity
    if (metadata.pullCount < 1000) {
      result.warnings.push('This image has relatively few downloads, verify it is from a trusted source')
    }

    if (metadata.starCount < 10 && !metadata.isOfficial) {
      result.warnings.push('This image has few stars and is not official, consider alternatives')
    }

    // Check for latest tag
    if (metadata.tags && metadata.tags.includes('latest')) {
      result.warnings.push('Image uses "latest" tag, consider using specific version tags for better stability')
    }

    // Check documentation
    if (!metadata.description || metadata.description.length < 50) {
      result.suggestions.push('Consider adding more detailed description for better discoverability')
    }

    // Check environment variables documentation
    if (metadata.environmentVariables && metadata.environmentVariables.length > 0) {
      const undocumentedVars = metadata.environmentVariables.filter(env => 
        !env.description || env.description.length < 10
      )
      
      if (undocumentedVars.length > 0) {
        result.suggestions.push(`Consider adding descriptions for environment variables: ${undocumentedVars.map(v => v.name).join(', ')}`)
      }
    }

    // Check for health check configuration
    if (!metadata.cmd || metadata.cmd.length === 0) {
      result.suggestions.push('Consider adding health check command for better monitoring')
    }

    // Resource requirements (would need to be added to ExtractedMetadata schema)
    // if (!metadata.resourceRequirements || Object.keys(metadata.resourceRequirements).length === 0) {
    //   result.suggestions.push('Consider specifying resource requirements (CPU, memory) for better deployment planning')
    // }

    // Check for volumes
    if (!metadata.volumes || metadata.volumes.length === 0) {
      if (metadata.name.toLowerCase().includes('database') || 
          metadata.name.toLowerCase().includes('storage') ||
          metadata.name.toLowerCase().includes('data')) {
        result.warnings.push('Data services should typically declare volume mounts for persistence')
      }
    }
  }

  /**
   * Get validation summary for reporting
   */
  getValidationSummary(results: ValidationResult[]): {
    totalValidated: number
    valid: number
    invalid: number
    highConflicts: number
    mediumConflicts: number
    commonIssues: string[]
  } {
    const summary = {
      totalValidated: results.length,
      valid: results.filter(r => r.isValid).length,
      invalid: results.filter(r => !r.isValid).length,
      highConflicts: 0,
      mediumConflicts: 0,
      commonIssues: [] as string[]
    }

    const issueFrequency: Record<string, number> = {}

    for (const result of results) {
      // Count conflicts by severity
      summary.highConflicts += result.conflicts.filter(c => c.severity === 'high').length
      summary.mediumConflicts += result.conflicts.filter(c => c.severity === 'medium').length

      // Track common issues
      for (const error of result.errors) {
        issueFrequency[error] = (issueFrequency[error] || 0) + 1
      }
      for (const warning of result.warnings) {
        issueFrequency[warning] = (issueFrequency[warning] || 0) + 1
      }
    }

    // Get most common issues
    summary.commonIssues = Object.entries(issueFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([issue]) => issue)

    return summary
  }
}