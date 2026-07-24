import { PrismaClient } from '@prisma/client'

/**
 * Database utility functions for Stapelwerk
 */

// Global Prisma instance for development
// In production, this prevents multiple instances during hot reloads
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Singleton Prisma client instance
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/**
 * Validate database URL format
 */
export function validateDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false
  
  // Check for basic database URL patterns
  const patterns = [
    /^postgresql:\/\//, // PostgreSQL
    /^file:/, // SQLite
    /^mysql:\/\//, // MySQL
  ]
  
  return patterns.some(pattern => pattern.test(url))
}

/**
 * Create database connection
 */
export function createDatabaseConnection(): PrismaClient {
  return prisma
}

/**
 * Close database connection
 */
export async function closeDatabaseConnection(client: PrismaClient): Promise<void> {
  await client.$disconnect()
}

/**
 * Check database health
 */
export async function checkDatabaseHealth() {
  try {
    // Test basic connectivity
    await prisma.$queryRaw`SELECT 1`
    
    return {
      connected: true,
      timestamp: new Date().toISOString(),
      status: 'healthy'
    }
  } catch (error) {
    return {
      connected: false,
      timestamp: new Date().toISOString(),
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Initialize database connection
 */
export async function initializeDatabase() {
  try {
    await prisma.$connect()
    console.log('✅ Database connected successfully')
    
    // Test the connection
    const health = await checkDatabaseHealth()
    if (!health.connected) {
      throw new Error(`Database health check failed: ${health.error}`)
    }
    
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    throw error
  }
}