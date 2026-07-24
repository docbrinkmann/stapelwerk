import { PrismaClient } from '@prisma/client'
import { beforeEach, afterEach, beforeAll, afterAll } from 'vitest'

// Test database instance

// Database utilities for testing
export class TestDatabase {
  private static instance: PrismaClient
  private static isSetup = false

  static getInstance(): PrismaClient {
    if (!TestDatabase.instance) {
      TestDatabase.instance = new PrismaClient({
        datasources: {
          db: {
url: process.env.DATABASE_TEST_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres_dev_password@localhost:5432/build_my_stack_test?schema=public'
          }
        },
        log: process.env.VITEST_VERBOSE ? ['query', 'info', 'warn', 'error'] : [],
      })
    }
    return TestDatabase.instance
  }

  static async setup(): Promise<void> {
    if (TestDatabase.isSetup) return

    const db = TestDatabase.getInstance()
    
    try {
      // Connect to database
      await db.$connect()
      
      // Ensure database schema is up to date
      // This is automatically handled by Prisma in most cases
      
      TestDatabase.isSetup = true
      console.log('✅ Test database setup completed')
    } catch (error) {
      console.error('❌ Test database setup failed:', error)
      throw error
    }
  }

  static async cleanup(): Promise<void> {
    const db = TestDatabase.getInstance()
    
    try {
// Clean all tables in the correct order (respecting foreign key constraints)
      try {
        const tables = await db.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma_%'`
        if (tables.length) {
          const names = tables.map(t => `\"public\".\"${t.tablename}\"`).join(', ')
          await db.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE;`)
        }
      } catch {
        // SQLite fallback
        const tableNames = await db.$queryRaw<Array<{ name: string }>>`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'`
        await db.$executeRaw`PRAGMA foreign_keys = OFF`
        for (const { name } of tableNames) {
          await db.$executeRawUnsafe(`DELETE FROM \"${name}\"`)
        }
        await db.$executeRaw`PRAGMA foreign_keys = ON`
      }
      
    } catch (error) {
      console.error('❌ Test database cleanup failed:', error)
      throw error
    }
  }

  static async teardown(): Promise<void> {
    if (!TestDatabase.instance) return

    try {
      await TestDatabase.instance.$disconnect()
      TestDatabase.isSetup = false
      console.log('🧹 Test database teardown completed')
    } catch (error) {
      console.error('❌ Test database teardown failed:', error)
    }
  }

  static async resetDatabase(): Promise<void> {
    await TestDatabase.cleanup()
  }
}

// Database test helpers
export const dbHelpers = {
  // Get test database instance
  getDb: () => TestDatabase.getInstance(),

  // Clean all data from database
  cleanDatabase: () => TestDatabase.cleanup(),

// Reset auto-increment counters (Postgres handled via RESTART IDENTITY)
  resetSequences: async () => {
    // no-op for Postgres
  },

  // Get record count for a table
  getRecordCount: async (tableName: string): Promise<number> => {
    const db = TestDatabase.getInstance()
try {
      const result = await db.$queryRawUnsafe(`SELECT COUNT(*) as count FROM \"public\".\"${tableName}\"`)
      return (result as any)[0].count
    } catch {
      const result = await db.$queryRawUnsafe(`SELECT COUNT(*) as count FROM \"${tableName}\"`)
      return (result as any)[0].count
    }
  },

  // Check if table exists
  tableExists: async (tableName: string): Promise<boolean> => {
    const db = TestDatabase.getInstance()
try {
      const rows = await db.$queryRaw<Array<{ exists: boolean }>>`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${tableName}) as exists`
      return rows[0]?.exists ?? false
    } catch {
      const result = await db.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name = ${tableName}`
      return result[0].count > 0
    }
  },

  // Execute raw SQL (use with caution in tests)
  executeRaw: async (sql: string, params?: any[]) => {
    const db = TestDatabase.getInstance()
    if (params) {
      return db.$queryRawUnsafe(sql, ...params)
    }
    return db.$queryRawUnsafe(sql)
  },

  // Seed database with test data
  seedTestData: async () => {
    const db = TestDatabase.getInstance()
    
    // Create some basic test data - using actual tables from schema
const webServers = await db.categories.create({
      data: {
        name: 'Web Servers',
        slug: 'web-servers',
        description: 'HTTP servers and proxies',
        sortOrder: 1,
        updatedAt: new Date(),
      }
    })
    
await db.services.create({
      data: {
        name: 'Test Service',
        slug: 'test-service',
        description: 'A test service for testing',
        dockerImage: 'nginx:alpine',
        categoryId: webServers.id,
        status: 'approved',
        updatedAt: new Date(),
      }
    })
  },
}

// Convenience wrappers used by schema tests: hand out a connected client and
// wipe it afterwards. Under the vitest harness the client is the shared
// in-memory store, which exposes $reset(); against a real database we fall
// back to the TRUNCATE-based cleanup.
export async function createTestDatabase(): Promise<PrismaClient> {
  const db = TestDatabase.getInstance()
  await db.$connect()
  return db
}

export async function cleanupTestDatabase(db?: PrismaClient): Promise<void> {
  const client = (db ?? TestDatabase.getInstance()) as PrismaClient & { $reset?: () => void }
  if (typeof client.$reset === 'function') {
    client.$reset()
    return
  }
  await TestDatabase.cleanup()
}

// Global test database hooks
export const setupTestDatabase = () => {
  beforeAll(async () => {
    await TestDatabase.setup()
  })

  afterAll(async () => {
    await TestDatabase.teardown()
  })

  beforeEach(async () => {
    await TestDatabase.cleanup()
  })
}

// Individual test database hooks
export const setupTestDatabaseForEachTest = () => {
  beforeEach(async () => {
    await TestDatabase.cleanup()
  })

  afterEach(async () => {
    // Optional: clean after each test for extra safety
    // await TestDatabase.cleanup()
  })
}

// Export test database helpers
export const testDb = {
  setup: () => TestDatabase.setup(),
  cleanup: () => TestDatabase.cleanup(),
  teardown: () => TestDatabase.teardown(),
  getInstance: () => TestDatabase.getInstance(),
  seed: async () => {
    const db = TestDatabase.getInstance()
    
    // First ensure clean state
    await TestDatabase.cleanup()
    
    // Create test categories (using upsert to handle duplicates)
const webServers = await db.categories.upsert({
      where: { slug: 'web-servers' },
      update: {},
      create: { name: 'Web Servers', slug: 'web-servers', description: 'HTTP servers and proxies', sortOrder: 1, updatedAt: new Date() }
    })
    
const databases = await db.categories.upsert({
      where: { slug: 'databases' },
      update: {},
      create: { name: 'Databases', slug: 'databases', description: 'Database systems', sortOrder: 2, updatedAt: new Date() }
    })
    
const messageQueues = await db.categories.upsert({
      where: { slug: 'message-queues' },
      update: {},
      create: { name: 'Message Queues', slug: 'message-queues', description: 'Messaging systems', sortOrder: 3, updatedAt: new Date() }
    })
    
    // Create test services
await db.services.createMany({
      data: [
        {
          name: 'Nginx',
          slug: 'nginx',
          description: 'High-performance web server',
          dockerImage: 'nginx:alpine',
          categoryId: webServers.id,
          status: 'approved',
          featured: true,
          updatedAt: new Date(),
        },
        {
          name: 'Apache',
          slug: 'apache',
          description: 'Popular web server',
          dockerImage: 'httpd:alpine',
          categoryId: webServers.id,
          status: 'approved',
          updatedAt: new Date(),
        },
        {
          name: 'PostgreSQL',
          slug: 'postgresql',
          description: 'Powerful relational database',
          dockerImage: 'postgres:14',
          categoryId: databases.id,
          status: 'approved',
          updatedAt: new Date(),
        },
        {
          name: 'Redis',
          slug: 'redis',
          description: 'In-memory data store',
          dockerImage: 'redis:alpine',
          categoryId: databases.id,
          status: 'pending',
          updatedAt: new Date(),
        },
        {
          name: 'RabbitMQ',
          slug: 'rabbitmq',
          description: 'Message broker',
          dockerImage: 'rabbitmq:management',
          categoryId: messageQueues.id,
          status: 'approved',
          updatedAt: new Date(),
        }
      ]
    })
  }
}

// Default export
export default TestDatabase