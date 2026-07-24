import { FullConfig } from '@playwright/test'
import * as fs from 'fs'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global E2E test teardown...')

  try {
    // Clean up E2E test database
    if (fs.existsSync('./prisma/e2e-test.db')) {
      fs.unlinkSync('./prisma/e2e-test.db')
      console.log('🗑️  Cleaned up E2E test database')
    }

    // Clean up any test artifacts in temporary directories
    const testArtifactDirs = [
      'test-results',
      'playwright-report',
      'allure-results',
    ]

    for (const dir of testArtifactDirs) {
      if (fs.existsSync(dir)) {
        // Note: In a real scenario, you might want to preserve these for CI
        // Here we just log that they exist
        console.log(`📁 Test artifacts available in: ${dir}`)
      }
    }

    console.log('✅ E2E test teardown completed successfully')
  } catch (error) {
    console.error('❌ E2E test teardown failed:', error)
    // Don't throw error as teardown failure shouldn't fail the tests
  }
}

export default globalTeardown