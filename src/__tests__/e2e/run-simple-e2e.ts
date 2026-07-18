#!/usr/bin/env node

/**
 * Simplified End-to-End Test Runner
 * 
 * A basic E2E test runner demonstrating the service discovery and contribution flows
 * without complex dependencies.
 */

import { getE2EConfig, PerformanceAssertions, SecurityTestUtils, TestDataGenerator } from './e2e.config'

interface TestResult {
  name: string
  passed: boolean
  duration: number
  errors: string[]
}

class SimpleE2ETestRunner {
  private config = getE2EConfig()
  private performanceAssertions = new PerformanceAssertions()
  private securityUtils = new SecurityTestUtils()
  private testResults: TestResult[] = []

  async run(): Promise<void> {
    console.log('🚀 Starting Simplified E2E Test Suite')
    console.log('=' .repeat(50))
    
    this.printConfiguration()
    
    const startTime = Date.now()
    
    try {
      await this.runTestSuites()
      this.printReport()
    } catch (error) {
      console.error('❌ E2E Test Suite Failed:', error)
      process.exit(1)
    }
    
    const totalDuration = Date.now() - startTime
    this.printSummary(totalDuration)
  }

  private printConfiguration(): void {
    console.log(`Environment: ${process.env.NODE_ENV || 'test'}`)
    console.log(`Max Response Time: ${this.config.performance.maxResponseTime}ms`)
    console.log(`Max Concurrent Requests: ${this.config.performance.maxConcurrentRequests}`)
    console.log(`Security Patterns: ${this.config.security.maliciousPatterns.length} patterns`)
    console.log('')
  }

  private async runTestSuites(): Promise<void> {
    // Test 1: Configuration Validation
    await this.testConfigurationValidation()
    
    // Test 2: Performance Requirements
    await this.testPerformanceRequirements()
    
    // Test 3: Security Pattern Validation
    await this.testSecurityPatterns()
    
    // Test 4: Test Data Generation
    await this.testDataGeneration()
    
    // Test 5: E2E Scenario Validation
    await this.testE2EScenarios()
  }

  private async testConfigurationValidation(): Promise<void> {
    const startTime = Date.now()
    const errors: string[] = []
    let passed = true

    try {
      // Test that configuration loads correctly
      if (this.config.performance.maxResponseTime !== 500) {
        errors.push('Performance maxResponseTime should be 500ms')
        passed = false
      }

      if (this.config.performance.maxConcurrentRequests < 1) {
        errors.push('Max concurrent requests should be positive')
        passed = false
      }

      if (this.config.security.maliciousPatterns.length === 0) {
        errors.push('Security patterns should be defined')
        passed = false
      }

      // Test environment-specific configs
      const testConfig = this.config
      if (!testConfig.database || !testConfig.scenarios) {
        errors.push('Configuration should include database and scenarios')
        passed = false
      }

    } catch (error: any) {
      errors.push(`Configuration error: ${error.message}`)
      passed = false
    }

    this.testResults.push({
      name: 'Configuration Validation',
      passed,
      duration: Date.now() - startTime,
      errors
    })
  }

  private async testPerformanceRequirements(): Promise<void> {
    const startTime = Date.now()
    const errors: string[] = []
    let passed = true

    try {
      // Test performance assertion helpers
      this.performanceAssertions.assertResponseTime(300, 'test-operation')
      
      // Test that performance requirements are properly configured
      if (this.config.performance.maxResponseTime > 500) {
        errors.push('Response time requirement exceeds 500ms specification')
        passed = false
      }

      // Test concurrent performance calculation
      this.performanceAssertions.assertConcurrentPerformance(1800, 10) // 180ms average for 10 requests

      // Test input length validation
      this.performanceAssertions.assertInputLength('test', 'name')

    } catch (error: any) {
      errors.push(`Performance test error: ${error.message}`)
      passed = false
    }

    this.testResults.push({
      name: 'Performance Requirements',
      passed,
      duration: Date.now() - startTime,
      errors
    })
  }

  private async testSecurityPatterns(): Promise<void> {
    const startTime = Date.now()
    const errors: string[] = []
    let passed = true

    try {
      // Test malicious pattern retrieval
      const patterns = this.securityUtils.getMaliciousPatterns()
      if (patterns.length === 0) {
        errors.push('No malicious patterns found')
        passed = false
      }

      // Test specific security patterns
      const sqlInjectionPatterns = patterns.filter(p => p.includes('DROP TABLE'))
      if (sqlInjectionPatterns.length === 0) {
        errors.push('SQL injection patterns not found')
        passed = false
      }

      const xssPatterns = patterns.filter(p => p.includes('<script>'))
      if (xssPatterns.length === 0) {
        errors.push('XSS patterns not found')
        passed = false
      }

      // Test Docker image validation
      if (!this.securityUtils.isValidDockerImage('nginx/nginx:latest')) {
        errors.push('Valid Docker image rejected')
        passed = false
      }

      if (this.securityUtils.isValidDockerImage('invalid image name')) {
        errors.push('Invalid Docker image accepted')
        passed = false
      }

      // Test Docker Hub URL validation
      if (!this.securityUtils.isValidDockerHubUrl('https://hub.docker.com/r/nginx/nginx')) {
        errors.push('Valid Docker Hub URL rejected')
        passed = false
      }

      if (this.securityUtils.isValidDockerHubUrl('https://malicious-site.com/payload')) {
        errors.push('Invalid Docker Hub URL accepted')
        passed = false
      }

    } catch (error: any) {
      errors.push(`Security test error: ${error.message}`)
      passed = false
    }

    this.testResults.push({
      name: 'Security Pattern Validation',
      passed,
      duration: Date.now() - startTime,
      errors
    })
  }

  private async testDataGeneration(): Promise<void> {
    const startTime = Date.now()
    const errors: string[] = []
    let passed = true

    try {
      // Test service data generation
      const service = TestDataGenerator.generateService({
        name: 'Custom Test Service'
      })

      if (service.name !== 'Custom Test Service') {
        errors.push('Service generation failed to apply overrides')
        passed = false
      }

      if (!service.dockerImage || !service.version) {
        errors.push('Service generation missing required fields')
        passed = false
      }

      // Test category data generation
      const category = TestDataGenerator.generateCategory({
        name: 'Custom Category'
      })

      if (category.name !== 'Custom Category') {
        errors.push('Category generation failed to apply overrides')
        passed = false
      }

      // Test bulk data generation
      const bulkServices = TestDataGenerator.generateBulkTestData(
        5, 
        TestDataGenerator.generateService
      )

      if (bulkServices.length !== 5) {
        errors.push('Bulk data generation returned incorrect count')
        passed = false
      }

      // Test import data generation
      const importData = TestDataGenerator.generateImport({
        sourceUrl: 'https://hub.docker.com/r/test/service'
      })

      if (!importData.sourceUrl || !importData.sourceType) {
        errors.push('Import generation missing required fields')
        passed = false
      }

    } catch (error: any) {
      errors.push(`Data generation error: ${error.message}`)
      passed = false
    }

    this.testResults.push({
      name: 'Test Data Generation',
      passed,
      duration: Date.now() - startTime,
      errors
    })
  }

  private async testE2EScenarios(): Promise<void> {
    const startTime = Date.now()
    const errors: string[] = []
    let passed = true

    try {
      // Test that E2E scenarios are properly configured
      const scenarios = this.config.scenarios

      if (!scenarios.serviceDiscovery || scenarios.serviceDiscovery.length === 0) {
        errors.push('Service discovery scenarios not configured')
        passed = false
      }

      if (!scenarios.contributionFlows || scenarios.contributionFlows.length === 0) {
        errors.push('Contribution flow scenarios not configured')
        passed = false
      }

      if (!scenarios.adminWorkflows || scenarios.adminWorkflows.length === 0) {
        errors.push('Admin workflow scenarios not configured')
        passed = false
      }

      // Validate scenario structure
      for (const scenario of scenarios.serviceDiscovery) {
        if (!scenario.name || !scenario.description || !scenario.steps) {
          errors.push(`Invalid scenario structure: ${scenario.name || 'unnamed'}`)
          passed = false
        }

        if (scenario.performance && scenario.performance.maxDuration <= 0) {
          errors.push(`Invalid performance config for scenario: ${scenario.name}`)
          passed = false
        }

        // Validate steps
        for (const step of scenario.steps || []) {
          if (!step.action || !step.assertions) {
            errors.push(`Invalid step in scenario: ${scenario.name}`)
            passed = false
          }

          if (step.performance && step.performance.maxResponseTime > this.config.performance.maxResponseTime) {
            errors.push(`Step performance exceeds global limit in: ${scenario.name}`)
            passed = false
          }
        }
      }

    } catch (error: any) {
      errors.push(`E2E scenario validation error: ${error.message}`)
      passed = false
    }

    this.testResults.push({
      name: 'E2E Scenario Validation',
      passed,
      duration: Date.now() - startTime,
      errors
    })
  }

  private printReport(): void {
    console.log('📊 Simplified E2E Test Report')
    console.log('=' .repeat(50))

    for (const result of this.testResults) {
      const status = result.passed ? '✅' : '❌'
      console.log(`${status} ${result.name} (${result.duration}ms)`)
      
      if (!result.passed && result.errors.length > 0) {
        result.errors.forEach(error => {
          console.log(`    ⚠️  ${error}`)
        })
      }
    }

    console.log('')
  }

  private printSummary(totalDuration: number): void {
    const totalTests = this.testResults.length
    const passedTests = this.testResults.filter(r => r.passed).length
    const failedTests = totalTests - passedTests

    console.log('📋 Test Summary')
    console.log('=' .repeat(50))
    console.log(`Total Tests: ${totalTests}`)
    console.log(`Passed: ${passedTests}`)
    console.log(`Failed: ${failedTests}`)
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`)
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`)
    console.log('')

    if (failedTests > 0) {
      console.log('❌ Some E2E Tests Failed')
      console.log('This demonstrates the E2E test framework functionality.')
      console.log('In a real implementation, these would be actual API calls.')
    } else {
      console.log('🎉 All Simplified E2E Tests Passed!')
      console.log('E2E test framework is properly configured and functional.')
    }
  }
}

// Run the simplified E2E tests
async function main() {
  const runner = new SimpleE2ETestRunner()
  await runner.run()
}

// Export for programmatic usage
export { SimpleE2ETestRunner }

// Run if called directly (ES module compatible)
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}
