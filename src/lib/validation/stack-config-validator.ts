import {
  StackEnvVar,
  StackPortMapping,
  StackVolumeMount,
  StackDependencies,
  StackValidationHelpers
} from './stack-schemas'

/**
 * Stack Service Configuration Validator
 * 
 * Advanced validation logic for stack service configurations including
 * conflict detection, dependency validation, and security checks.
 */

export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning' | 'info'
}

export interface StackConfigValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  suggestions: ValidationError[]
}

export class StackServiceConfigValidator {
  /**
   * Validate complete stack service configuration
   */
  static validateServiceConfiguration(config: {
    environmentVariables?: StackEnvVar
    portMappings?: StackPortMapping
    volumeMounts?: StackVolumeMount
    dependsOn?: StackDependencies
  }): StackConfigValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []
    const suggestions: ValidationError[] = []

    // Validate environment variables
    if (config.environmentVariables) {
      const envErrors = this.validateEnvironmentVariables(config.environmentVariables)
      errors.push(...envErrors.filter(e => e.severity === 'error'))
      warnings.push(...envErrors.filter(e => e.severity === 'warning'))
      suggestions.push(...envErrors.filter(e => e.severity === 'info'))
    }

    // Validate port mappings
    if (config.portMappings) {
      const portErrors = this.validatePortMappings(config.portMappings)
      errors.push(...portErrors.filter(e => e.severity === 'error'))
      warnings.push(...portErrors.filter(e => e.severity === 'warning'))
      suggestions.push(...portErrors.filter(e => e.severity === 'info'))
    }

    // Validate volume mounts
    if (config.volumeMounts) {
      const volumeErrors = this.validateVolumeMounts(config.volumeMounts)
      errors.push(...volumeErrors.filter(e => e.severity === 'error'))
      warnings.push(...volumeErrors.filter(e => e.severity === 'warning'))
      suggestions.push(...volumeErrors.filter(e => e.severity === 'info'))
    }

    // Validate dependencies
    if (config.dependsOn) {
      const depErrors = this.validateDependencies(config.dependsOn)
      errors.push(...depErrors.filter(e => e.severity === 'error'))
      warnings.push(...depErrors.filter(e => e.severity === 'warning'))
      suggestions.push(...depErrors.filter(e => e.severity === 'info'))
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    }
  }

  /**
   * Validate environment variables
   */
  static validateEnvironmentVariables(envVars: StackEnvVar): ValidationError[] {
    const errors: ValidationError[] = []

    Object.entries(envVars).forEach(([name, value]) => {
      // Check environment variable name format
      if (!name.match(/^[A-Z_][A-Z0-9_]*$/)) {
        errors.push({
          field: `environmentVariables.${name}`,
          message: 'Environment variable names should contain only uppercase letters, numbers, and underscores',
          severity: 'warning'
        })
      }

      // Check for common sensitive variable names
      const sensitiveNames = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'PRIVATE', 'CREDENTIAL']
      if (sensitiveNames.some(sensitive => name.includes(sensitive))) {
        if (value && value.length < 8) {
          errors.push({
            field: `environmentVariables.${name}`,
            message: 'Sensitive environment variables should have strong values (8+ characters)',
            severity: 'warning'
          })
        }
        
        errors.push({
          field: `environmentVariables.${name}`,
          message: 'Consider using secrets management for sensitive values',
          severity: 'info'
        })
      }

      // Check for empty values
      if (!value || value.trim() === '') {
        errors.push({
          field: `environmentVariables.${name}`,
          message: 'Environment variable has empty value',
          severity: 'warning'
        })
      }

      // Check for potentially dangerous values
      if (value && (value.includes('$(') || value.includes('`') || value.includes('eval'))) {
        errors.push({
          field: `environmentVariables.${name}`,
          message: 'Environment variable value contains potentially dangerous shell syntax',
          severity: 'error'
        })
      }

      // Suggest standard naming conventions
      if (name.toLowerCase() === name || name.includes('-')) {
        errors.push({
          field: `environmentVariables.${name}`,
          message: 'Environment variable names should follow UPPER_CASE convention',
          severity: 'info'
        })
      }
    })

    return errors
  }

  /**
   * Validate port mappings
   */
  static validatePortMappings(portMappings: StackPortMapping): ValidationError[] {
    const errors: ValidationError[] = []
    const usedHostPorts = new Set<string>()

    Object.entries(portMappings).forEach(([containerPort, hostPort]) => {
      const containerPortNum = parseInt(containerPort, 10)
      const hostPortNum = parseInt(hostPort, 10)

      // Validate port ranges
      if (containerPortNum < 1 || containerPortNum > 65535) {
        errors.push({
          field: `portMappings.${containerPort}`,
          message: 'Container port must be between 1 and 65535',
          severity: 'error'
        })
      }

      if (hostPortNum < 1 || hostPortNum > 65535) {
        errors.push({
          field: `portMappings.${containerPort}`,
          message: 'Host port must be between 1 and 65535',
          severity: 'error'
        })
      }

      // Check for host port conflicts
      if (usedHostPorts.has(hostPort)) {
        errors.push({
          field: `portMappings.${containerPort}`,
          message: `Host port ${hostPort} is already in use by another service`,
          severity: 'error'
        })
      }
      usedHostPorts.add(hostPort)

      // Warn about well-known ports
      if (hostPortNum < 1024 && hostPortNum !== 80 && hostPortNum !== 443) {
        errors.push({
          field: `portMappings.${containerPort}`,
          message: `Host port ${hostPort} is a system port (< 1024) and may require elevated privileges`,
          severity: 'warning'
        })
      }

      // Suggest standard port mappings
      const standardPorts: Record<string, string[]> = {
        '80': ['8080', '8000', '3000'],
        '443': ['8443', '8001', '3001'],
        '3306': ['3307', '3308'], // MySQL
        '5432': ['5433', '5434'], // PostgreSQL
        '6379': ['6380', '6381'], // Redis
        '27017': ['27018', '27019'] // MongoDB
      }

      if (standardPorts[containerPort] && !standardPorts[containerPort].includes(hostPort)) {
        errors.push({
          field: `portMappings.${containerPort}`,
          message: `Consider using standard host ports for ${containerPort}: ${standardPorts[containerPort].join(', ')}`,
          severity: 'info'
        })
      }

      // Warn about same port mapping
      if (containerPort === hostPort && containerPortNum < 1024) {
        errors.push({
          field: `portMappings.${containerPort}`,
          message: 'Mapping system ports directly may cause conflicts',
          severity: 'warning'
        })
      }
    })

    return errors
  }

  /**
   * Validate volume mounts
   */
  static validateVolumeMounts(volumeMounts: StackVolumeMount): ValidationError[] {
    const errors: ValidationError[] = []
    const usedHostPaths = new Set<string>()

    Object.entries(volumeMounts).forEach(([containerPath, hostPath]) => {
      // Validate container path format
      if (!containerPath.startsWith('/')) {
        errors.push({
          field: `volumeMounts.${containerPath}`,
          message: 'Container path must be an absolute path starting with "/"',
          severity: 'error'
        })
      }

      // Validate host path format
      if (!hostPath.startsWith('/')) {
        errors.push({
          field: `volumeMounts.${containerPath}`,
          message: 'Host path must be an absolute path starting with "/"',
          severity: 'error'
        })
      }

      // Check for host path conflicts
      if (usedHostPaths.has(hostPath)) {
        errors.push({
          field: `volumeMounts.${containerPath}`,
          message: `Host path ${hostPath} is already mounted by another volume`,
          severity: 'warning'
        })
      }
      usedHostPaths.add(hostPath)

      // Warn about sensitive system paths
      const sensitivePaths = ['/etc', '/usr', '/bin', '/sbin', '/lib', '/boot', '/sys', '/proc', '/dev', '/root']
      if (sensitivePaths.some(sensitive => hostPath.startsWith(sensitive))) {
        errors.push({
          field: `volumeMounts.${containerPath}`,
          message: `Host path ${hostPath} points to a sensitive system directory`,
          severity: 'warning'
        })
      }

      // Suggest good practices
      if (hostPath.includes(' ')) {
        errors.push({
          field: `volumeMounts.${containerPath}`,
          message: 'Host path contains spaces, which may cause issues with some systems',
          severity: 'warning'
        })
      }

      // Check for common data directories
      const commonDataPaths = ['/var/lib', '/opt', '/home', '/data', '/app/data']
      if (!commonDataPaths.some(common => hostPath.startsWith(common)) && !hostPath.startsWith('./')) {
        errors.push({
          field: `volumeMounts.${containerPath}`,
          message: 'Consider using standard data directories like /var/lib, /opt, or relative paths',
          severity: 'info'
        })
      }

      // Warn about tmp directories
      if (containerPath.startsWith('/tmp') || hostPath.startsWith('/tmp')) {
        errors.push({
          field: `volumeMounts.${containerPath}`,
          message: 'Mounting /tmp directories may cause data loss on container restart',
          severity: 'warning'
        })
      }
    })

    return errors
  }

  /**
   * Validate service dependencies
   */
  static validateDependencies(dependencies: StackDependencies): ValidationError[] {
    const errors: ValidationError[] = []

    dependencies.forEach((dep, index) => {
      // Check dependency name format
      if (!dep || dep.trim() === '') {
        errors.push({
          field: `dependsOn[${index}]`,
          message: 'Dependency name cannot be empty',
          severity: 'error'
        })
        return
      }

      // Check for valid service name format
      if (!dep.match(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/)) {
        errors.push({
          field: `dependsOn[${index}]`,
          message: 'Dependency name should be lowercase alphanumeric with hyphens',
          severity: 'warning'
        })
      }

      // Check for self-reference (will be validated with actual service names later)
      if (dep === 'self') {
        errors.push({
          field: `dependsOn[${index}]`,
          message: 'Service cannot depend on itself',
          severity: 'error'
        })
      }

      // Suggest common service names
      const commonServices = ['database', 'db', 'redis', 'cache', 'queue', 'api', 'web', 'nginx', 'postgres', 'mysql']
      if (commonServices.includes(dep.toLowerCase())) {
        errors.push({
          field: `dependsOn[${index}]`,
          message: `Dependency "${dep}" uses a common service name pattern`,
          severity: 'info'
        })
      }
    })

    // Check for duplicate dependencies
    const duplicates = dependencies.filter((dep, index) => dependencies.indexOf(dep) !== index)
    duplicates.forEach(dup => {
      errors.push({
        field: 'dependsOn',
        message: `Duplicate dependency: ${dup}`,
        severity: 'warning'
      })
    })

    return errors
  }

  /**
   * Validate configuration across multiple services for conflicts
   */
  static validateStackConfiguration(services: Array<{
    serviceName: string
    configuration: {
      environmentVariables?: StackEnvVar
      portMappings?: StackPortMapping
      volumeMounts?: StackVolumeMount
      dependsOn?: StackDependencies
    }
  }>): StackConfigValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []
    const suggestions: ValidationError[] = []

    // Collect all host ports across services
    const hostPortMap = new Map<string, string[]>()
    services.forEach(service => {
      if (service.configuration.portMappings) {
        Object.entries(service.configuration.portMappings).forEach(([containerPort, hostPort]) => {
          if (!hostPortMap.has(hostPort)) {
            hostPortMap.set(hostPort, [])
          }
          hostPortMap.get(hostPort)!.push(service.serviceName)
        })
      }
    })

    // Check for port conflicts
    hostPortMap.forEach((serviceNames, hostPort) => {
      if (serviceNames.length > 1) {
        errors.push({
          field: 'portMappings',
          message: `Host port ${hostPort} is used by multiple services: ${serviceNames.join(', ')}`,
          severity: 'error'
        })
      }
    })

    // Collect all host paths across services
    const hostPathMap = new Map<string, string[]>()
    services.forEach(service => {
      if (service.configuration.volumeMounts) {
        Object.entries(service.configuration.volumeMounts).forEach(([containerPath, hostPath]) => {
          if (!hostPathMap.has(hostPath)) {
            hostPathMap.set(hostPath, [])
          }
          hostPathMap.get(hostPath)!.push(service.serviceName)
        })
      }
    })

    // Check for volume mount conflicts (warnings only, as shared volumes can be intentional)
    hostPathMap.forEach((serviceNames, hostPath) => {
      if (serviceNames.length > 1) {
        warnings.push({
          field: 'volumeMounts',
          message: `Host path ${hostPath} is shared by multiple services: ${serviceNames.join(', ')}`,
          severity: 'warning'
        })
      }
    })

    // Validate dependencies exist within the stack
    const serviceNames = services.map(s => s.serviceName)
    services.forEach(service => {
      if (service.configuration.dependsOn) {
        service.configuration.dependsOn.forEach(dep => {
          if (!serviceNames.includes(dep)) {
            warnings.push({
              field: `${service.serviceName}.dependsOn`,
              message: `Dependency "${dep}" is not found in the current stack`,
              severity: 'warning'
            })
          }
        })
      }
    })

    // Check for circular dependencies
    const circularDeps = this.detectCircularDependencies(services)
    circularDeps.forEach(cycle => {
      errors.push({
        field: 'dependsOn',
        message: `Circular dependency detected: ${cycle.join(' -> ')}`,
        severity: 'error'
      })
    })

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    }
  }

  /**
   * Detect circular dependencies in service dependency graph
   */
  private static detectCircularDependencies(services: Array<{
    serviceName: string
    configuration: { dependsOn?: StackDependencies }
  }>): string[][] {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const cycles: string[][] = []

    const dfs = (serviceName: string, path: string[]): void => {
      if (recursionStack.has(serviceName)) {
        // Found a cycle
        const cycleStart = path.indexOf(serviceName)
        cycles.push([...path.slice(cycleStart), serviceName])
        return
      }

      if (visited.has(serviceName)) {
        return
      }

      visited.add(serviceName)
      recursionStack.add(serviceName)

      const service = services.find(s => s.serviceName === serviceName)
      if (service?.configuration.dependsOn) {
        service.configuration.dependsOn.forEach(dep => {
          dfs(dep, [...path, serviceName])
        })
      }

      recursionStack.delete(serviceName)
    }

    services.forEach(service => {
      if (!visited.has(service.serviceName)) {
        dfs(service.serviceName, [])
      }
    })

    return cycles
  }

  /**
   * Generate configuration suggestions based on service type
   */
  static generateConfigurationSuggestions(serviceName: string, dockerImage: string): {
    environmentVariables?: Record<string, string>
    portMappings?: Record<string, string>
    volumeMounts?: Record<string, string>
    dependsOn?: string[]
  } {
    const suggestions: any = {}

    // Database services
    if (dockerImage.includes('postgres') || dockerImage.includes('postgresql')) {
      suggestions.environmentVariables = {
        POSTGRES_DB: 'app_db',
        POSTGRES_USER: 'app_user',
        POSTGRES_PASSWORD: 'change_me'
      }
      suggestions.portMappings = { '5432': '5432' }
      suggestions.volumeMounts = { '/var/lib/postgresql/data': `/data/${serviceName}` }
    } else if (dockerImage.includes('mysql')) {
      suggestions.environmentVariables = {
        MYSQL_DATABASE: 'app_db',
        MYSQL_USER: 'app_user',
        MYSQL_PASSWORD: 'change_me',
        MYSQL_ROOT_PASSWORD: 'change_me'
      }
      suggestions.portMappings = { '3306': '3306' }
      suggestions.volumeMounts = { '/var/lib/mysql': `/data/${serviceName}` }
    } else if (dockerImage.includes('redis')) {
      suggestions.portMappings = { '6379': '6379' }
      suggestions.volumeMounts = { '/data': `/data/${serviceName}` }
    } else if (dockerImage.includes('mongo')) {
      suggestions.environmentVariables = {
        MONGO_INITDB_ROOT_USERNAME: 'root',
        MONGO_INITDB_ROOT_PASSWORD: 'change_me'
      }
      suggestions.portMappings = { '27017': '27017' }
      suggestions.volumeMounts = { '/data/db': `/data/${serviceName}` }
    }

    // Web servers
    else if (dockerImage.includes('nginx')) {
      suggestions.portMappings = { '80': '8080' }
      suggestions.volumeMounts = { '/usr/share/nginx/html': './html' }
    } else if (dockerImage.includes('apache') || dockerImage.includes('httpd')) {
      suggestions.portMappings = { '80': '8080' }
      suggestions.volumeMounts = { '/usr/local/apache2/htdocs': './html' }
    }

    // Application servers
    else if (dockerImage.includes('node')) {
      suggestions.environmentVariables = { NODE_ENV: 'production' }
      suggestions.portMappings = { '3000': '3000' }
    } else if (dockerImage.includes('php')) {
      suggestions.portMappings = { '9000': '9000' }
    }

    return suggestions
  }
}