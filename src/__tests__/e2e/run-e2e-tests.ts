#!/usr/bin/env node

/**
 * End-to-End Test Runner
 * 
 * Orchestrates the execution of complete E2E test suites for service discovery
 * and contribution flows. Provides comprehensive validation and reporting.
 * 
 * Usage:
 *   npm run test:e2e                    # Run all E2E tests
 *   npm run test:e2e -- --suite=flows  # Run specific test suite
 *   npm run test:e2e -- --perf         # Focus on performance tests
 *   npm run test:e2e -- --security     # Focus on security tests
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { resolve } from 'path'
import { getE2EConfig, PerformanceAssertions, SecurityTestUtils } from './e2e.config'

const execAsync = promisify(exec)

interface TestRunOptions {
  suite?: 'flows' | 'performance' | 'security' | 'all'
  environment?: 'test' | 'ci' | 'production'
  parallel?: boolean
  coverage?: boolean
  timeout?: number
  verbose?: boolean
  bail?: boolean // Stop on first failure
}

interface TestResult {
  suite: string
  passed: number
  failed: number
  duration: number
  coverage?: number
  errors: TestError[]
}

interface TestError {
  test: string
  error: string
  file: string
  line?: number
}

class E2ETestRunner {
  private config = getE2EConfig()
  private performanceAssertions = new PerformanceAssertions()
  private securityUtils = new SecurityTestUtils()
  private results: TestResult[] = []

  async run(options: TestRunOptions = {}): Promise<void> {
    console.log('🚀 Starting End-to-End Test Suite')
    console.log('=' .repeat(50))
    
    this.printConfiguration(options)
    
    const startTime = Date.now()
    
    try {
      await this.setupTestEnvironment()
      await this.runTestSuites(options)
      await this.generateReport()
    } catch (error) {
      console.error('❌ E2E Test Suite Failed:', error)
      process.exit(1)
    } finally {
      await this.cleanup()
    }
    
    const totalDuration = Date.now() - startTime
    this.printSummary(totalDuration)
  }

  private printConfiguration(options: TestRunOptions): void {
    console.log(`Environment: ${process.env.NODE_ENV || 'test'}`)
    console.log(`Suite: ${options.suite || 'all'}`)
    console.log(`Max Response Time: ${this.config.performance.maxResponseTime}ms`)
    console.log(`Max Concurrent Requests: ${this.config.performance.maxConcurrentRequests}`)
    console.log(`Security Patterns: ${this.config.security.maliciousPatterns.length} patterns`)
    console.log('')
  }

  private async setupTestEnvironment(): Promise<void> {
    console.log('⚙️  Setting up test environment...')
    
    // Ensure test database is available
    await this.ensureTestDatabase()
    
    // Verify required services are running
    await this.verifyServices()
    
    // Clear any existing test data
    await this.clearTestData()
    
    console.log('✅ Test environment ready')
    console.log('')
  }

  private async ensureTestDatabase(): Promise<void> {
    try {
      const { stdout } = await execAsync('npx prisma db push --accept-data-loss', {
        cwd: resolve(__dirname, '../../..')
      })
      
      if (stdout.includes('error') || stdout.includes('Error')) {
        throw new Error(`Database setup failed: ${stdout}`)
      }
    } catch (error: any) {
      throw new Error(`Failed to setup test database: ${error.message}`)
    }
  }

  private async verifyServices(): Promise<void> {
    // Verify that the application server can start
    // This is a minimal health check for E2E testing
    console.log('  Verifying application services...')
    
    // Add any service health checks here
    // For now, we assume services are ready
  }

  private async clearTestData(): Promise<void> {
    try {
      await execAsync('npx prisma db seed --reset-test-data', {
        cwd: resolve(__dirname, '../../..')
      })
    } catch (error) {
      // If seed script doesn't exist, that's OK
      console.log('  No test data reset script found (this is OK)')
    }
  }

  private async runTestSuites(options: TestRunOptions): Promise<void> {
    const suites = this.getSuitesToRun(options.suite)
    
    for (const suite of suites) {
      console.log(`🧪 Running ${suite} tests...`)
      
      const result = await this.runSuite(suite, options)
      this.results.push(result)
      
      if (options.bail && result.failed > 0) {
        console.log(`❌ Stopping on first failure (${suite})`)
        break
      }
      
      console.log('')
    }
  }

  private getSuitesToRun(suite?: string): string[] {
    switch (suite) {
      case 'flows':
        return ['service-discovery-flows']
      case 'performance':
        return ['performance-security-flows']
      case 'security':
        return ['performance-security-flows']
      case 'all':
      default:
        return ['service-discovery-flows', 'performance-security-flows']
    }
  }

  private async runSuite(suite: string, options: TestRunOptions): Promise<TestResult> {
    const startTime = Date.now()
    const testFile = resolve(__dirname, `${suite}.test.ts`)
    
    try {
      const vitestArgs = this.buildVitestArgs(options)
      const command = `npx vitest run ${testFile} ${vitestArgs.join(' ')}`
      
      console.log(`  Command: ${command}`)
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: resolve(__dirname, '../../..'),
        timeout: options.timeout || 300000, // 5 minutes default
        env: {
          ...process.env,
          NODE_ENV: (options.environment || 'test') as 'test' | 'development' | 'production'
        }
      })
      
      return this.parseTestOutput(suite, stdout, stderr, Date.now() - startTime)
      
    } catch (error: any) {
      const duration = Date.now() - startTime
      
      // Vitest returns exit code 1 for test failures, which is expected
      if (error.code === 1 && error.stdout) {
        return this.parseTestOutput(suite, error.stdout, error.stderr, duration)
      }
      
      // Actual execution error
      throw new Error(`Failed to run ${suite}: ${error.message}`)
    }
  }

  private buildVitestArgs(options: TestRunOptions): string[] {
    const args: string[] = []
    
    if (options.coverage) {
      args.push('--coverage')
    }
    
    if (options.verbose) {
      args.push('--reporter=verbose')
    }
    
    if (options.timeout) {
      args.push(`--testTimeout=${options.timeout}`)
    }
    
    return args
  }

  private parseTestOutput(
    suite: string, 
    stdout: string, 
    stderr: string, 
    duration: number
  ): TestResult {
    // Parse Vitest output to extract test results
    const lines = stdout.split('\\n')
    
    let passed = 0
    let failed = 0
    const errors: TestError[] = []
    
    // Parse test results from Vitest output
    for (const line of lines) {
      if (line.includes('✓') || line.includes('PASS')) {
        passed++
      } else if (line.includes('✗') || line.includes('FAIL')) {
        failed++
        
        // Extract error information
        const errorMatch = line.match(/✗\\s+(.+)/)
        if (errorMatch) {
          errors.push({
            test: errorMatch[1],
            error: 'Test failed',
            file: suite
          })
        }
      }
    }
    
    // Extract coverage if available
    let coverage: number | undefined
    const coverageMatch = stdout.match(/All files\\s+\\|\\s+(\\d+\\.\\d+)/)
    if (coverageMatch) {
      coverage = parseFloat(coverageMatch[1])
    }
    
    return {
      suite,
      passed,
      failed,
      duration,
      coverage,
      errors
    }
  }

  private async generateReport(): Promise<void> {
    console.log('📊 Generating E2E Test Report')
    console.log('=' .repeat(50))
    
    // Performance analysis
    await this.analyzePerformance()
    
    // Security analysis
    await this.analyzeSecurity()
    
    // Coverage analysis
    await this.analyzeCoverage()
  }

  private async analyzePerformance(): Promise<void> {
    console.log('⚡ Performance Analysis:')
    
    const performanceSuite = this.results.find(r => r.suite.includes('performance'))
    if (!performanceSuite) {
      console.log('  No performance tests found')
      return
    }
    
    const maxResponseTime = this.config.performance.maxResponseTime
    
    console.log(`  Max allowed response time: ${maxResponseTime}ms`)
    console.log(`  Performance tests: ${performanceSuite.passed} passed, ${performanceSuite.failed} failed`)
    
    if (performanceSuite.failed > 0) {
      console.log('  ⚠️  Performance requirements not met:')
      performanceSuite.errors.forEach(error => {
        console.log(`    - ${error.test}: ${error.error}`)
      })
    } else {
      console.log('  ✅ All performance requirements met')
    }
    
    console.log('')
  }

  private async analyzeSecurity(): Promise<void> {
    console.log('🔒 Security Analysis:')
    
    const securitySuite = this.results.find(r => r.suite.includes('security') || r.suite.includes('performance'))
    if (!securitySuite) {
      console.log('  No security tests found')
      return
    }
    
    const maliciousPatterns = this.config.security.maliciousPatterns.length
    
    console.log(`  Malicious patterns tested: ${maliciousPatterns}`)
    console.log(`  Security tests: ${securitySuite.passed} passed, ${securitySuite.failed} failed`)
    
    if (securitySuite.failed > 0) {
      console.log('  ⚠️  Security vulnerabilities detected:')
      securitySuite.errors.forEach(error => {
        console.log(`    - ${error.test}: ${error.error}`)
      })
    } else {
      console.log('  ✅ All security tests passed')
    }
    
    console.log('')
  }

  private async analyzeCoverage(): Promise<void> {
    console.log('📈 Test Coverage Analysis:')
    
    const totalCoverage = this.results
      .filter(r => r.coverage !== undefined)
      .reduce((sum, r) => sum + (r.coverage || 0), 0) / this.results.length || 0
    
    if (totalCoverage > 0) {
      console.log(`  Average test coverage: ${totalCoverage.toFixed(1)}%`)
      
      if (totalCoverage >= 90) {
        console.log('  ✅ Excellent coverage')
      } else if (totalCoverage >= 80) {
        console.log('  ✅ Good coverage')
      } else if (totalCoverage >= 70) {
        console.log('  ⚠️  Coverage could be improved')
      } else {
        console.log('  ❌ Low coverage - consider adding more tests')
      }
    } else {
      console.log('  No coverage data available')
    }
    
    console.log('')
  }

  private printSummary(totalDuration: number): void {
    console.log('📋 Test Summary')
    console.log('=' .repeat(50))
    
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0)
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0)
    const totalTests = totalPassed + totalFailed
    
    console.log(`Total Tests: ${totalTests}`)
    console.log(`Passed: ${totalPassed}`)
    console.log(`Failed: ${totalFailed}`)
    console.log(`Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`)
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`)
    console.log('')
    
    // Suite breakdown
    this.results.forEach(result => {
      const status = result.failed === 0 ? '✅' : '❌'
      console.log(`${status} ${result.suite}: ${result.passed}/${result.passed + result.failed} (${(result.duration / 1000).toFixed(2)}s)`)
    })
    
    console.log('')
    
    if (totalFailed > 0) {
      console.log('❌ E2E Tests Failed')
      console.log('Review the errors above and fix the failing tests.')
      process.exit(1)
    } else {
      console.log('🎉 All E2E Tests Passed!')
      console.log('Service discovery and contribution flows are working correctly.')
    }
  }

  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test environment...')
    
    try {
      // Clean up test data
      await this.clearTestData()
      
      // Any other cleanup tasks
      console.log('✅ Cleanup completed')
    } catch (error) {
      console.warn('⚠️  Cleanup encountered errors (this may be OK):', error)
    }
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2)
  const options: TestRunOptions = {}
  
  // Parse command line arguments
  for (const arg of args) {
    if (arg.startsWith('--suite=')) {
      options.suite = arg.split('=')[1] as TestRunOptions['suite']
    } else if (arg.startsWith('--environment=')) {
      options.environment = arg.split('=')[1] as TestRunOptions['environment']
    } else if (arg === '--perf') {
      options.suite = 'performance'
    } else if (arg === '--security') {
      options.suite = 'security'
    } else if (arg === '--parallel') {
      options.parallel = true
    } else if (arg === '--coverage') {
      options.coverage = true
    } else if (arg === '--verbose') {
      options.verbose = true
    } else if (arg === '--bail') {
      options.bail = true
    } else if (arg.startsWith('--timeout=')) {
      options.timeout = parseInt(arg.split('=')[1])
    }
  }
  
  const runner = new E2ETestRunner()
  await runner.run(options)
}

// Export for programmatic usage
export type { TestRunOptions, TestResult }
export { E2ETestRunner }

// Run if called directly (ES module compatible)
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}
