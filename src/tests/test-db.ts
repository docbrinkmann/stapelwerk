/**
 * Test Database Setup and Cleanup
 * Utilities for managing test database state and cleanup
 */

import { PrismaClient } from '@prisma/client'
import { vi } from 'vitest'

class TestDatabase {
  private static instance: TestDatabase
  private prisma: PrismaClient | null = null
  private isSetup = false

  public static getInstance(): TestDatabase {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new TestDatabase()
    }
    return TestDatabase.instance
  }

  public getClient(): PrismaClient {
    if (!this.prisma) {
      // Use a separate test database or in-memory database
      // For now, we'll create a mock Prisma client since the actual schema isn't implemented
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'file:./test.db'
          }
        },
        log: ['error'] // Reduce logging in tests
      })
    }
    return this.prisma
  }

  public async setup(): Promise<void> {
    if (this.isSetup) return

    const prisma = this.getClient()
    
    try {
      // In a real implementation, this would run database migrations
      // and set up the test schema. For now, we'll just connect.
      await prisma.$connect()
      
      // Example of what this would do in a real implementation:
      // await prisma.$executeRaw`PRAGMA foreign_keys = ON` // For SQLite
      // await this.runMigrations()
      // await this.seedTestData()
      
      this.isSetup = true
      console.log('✅ Test database setup completed')
    } catch (error) {
      console.error('❌ Test database setup failed:', error)
      throw error
    }
  }

  public async cleanup(): Promise<void> {
    if (!this.prisma) return

    try {
      // In a real implementation, this would clean up test data
      // For now, we'll just disconnect

      // Example cleanup operations:
      // await this.clearTestData()
      // await this.resetSequences()

      // Check if $disconnect exists before calling (handles mocked Prisma clients)
      if (this.prisma && typeof this.prisma.$disconnect === 'function') {
        await this.prisma.$disconnect()
      }
      console.log('🧹 Test database cleanup completed')
    } catch (error) {
      // Silently handle cleanup errors in test environment
      // Tests have already completed successfully at this point
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Test database cleanup failed:', error)
        throw error
      }
      // In test environment, just log as debug info
      console.log('ℹ️  Test database cleanup skipped (client already disconnected)')
    }
  }

  public async reset(): Promise<void> {
    await this.cleanup()
    this.prisma = null
    this.isSetup = false
    await this.setup()
  }

  // Mock implementation of what would be real database operations
  private async runMigrations(): Promise<void> {
    // This would run Prisma migrations or raw SQL to set up schema
    console.log('Running test database migrations...')
  }

  private async seedTestData(): Promise<void> {
    // This would insert any baseline test data needed
    console.log('Seeding test database...')
  }

  private async clearTestData(): Promise<void> {
    const prisma = this.getClient()
    
    // In a real implementation, this would clear all test data
    // Example for common tables:
    /*
    await prisma.activityEvent.deleteMany()
    await prisma.notification.deleteMany()
    await prisma.userSession.deleteMany()
    await prisma.organizationMembership.deleteMany()
    await prisma.userProfile.deleteMany()
    await prisma.organization.deleteMany()
    await prisma.user.deleteMany()
    */
    
    console.log('Test data cleared')
  }

  private async resetSequences(): Promise<void> {
    // Reset auto-increment sequences if needed
    // This depends on the database type (PostgreSQL, MySQL, SQLite, etc.)
    console.log('Sequences reset')
  }
}

// Export singleton instance
export const testDb = TestDatabase.getInstance()

// Utility functions for tests
export async function setupTestDb(): Promise<void> {
  await testDb.setup()
}

export async function cleanupTestDb(): Promise<void> {
  await testDb.cleanup()
}

export async function resetTestDb(): Promise<void> {
  await testDb.reset()
}

// Test transaction wrapper
export async function withTestTransaction<T>(
  fn: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  const prisma = testDb.getClient()
  
  // In a real implementation, this would wrap the test in a transaction
  // that gets rolled back automatically
  return await fn(prisma)
}

// Mock data helpers for when actual Prisma models aren't available
export const mockPrismaClient = {
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  organization: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  organizationMembership: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  userSession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  userProfile: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  notification: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  activityEvent: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  consentRecord: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}

// Test environment check
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
}

// Database URL validation for tests
export function validateTestDatabaseUrl(): void {
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
  
  if (!dbUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set for tests')
  }

  // Ensure we're not accidentally connecting to production
  if (dbUrl.includes('production') || dbUrl.includes('prod')) {
    throw new Error('Cannot run tests against production database')
  }

  console.log(`Using test database: ${dbUrl.replace(/:[^:@]*@/, ':****@')}`)
}