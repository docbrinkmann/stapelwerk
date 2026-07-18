import { createTRPCRouter, publicProcedure } from '../trpc'
import { getVersion, getDeploymentEnvironment, getDatabaseUrl } from '@/lib/env'

export const healthRouter = createTRPCRouter({
  // Basic health check
  check: publicProcedure.query(async ({ ctx }) => {
    const timestamp = new Date().toISOString()
    
    // Check database connectivity
    let dbStatus = 'unknown'
    let dbDetails = {}
    
    try {
      // Test database connection with a simple query
      await ctx.prisma.$queryRaw`SELECT 1 as test`
      dbStatus = 'healthy'
      
      // Get database info for PostgreSQL
      try {
        const versionResult = await ctx.prisma.$queryRaw<Array<{ version: string }>>`SELECT version() as version`
        dbDetails = {
          connected: true,
          version: versionResult[0]?.version?.split(' ')[1] || 'unknown',
          engine: 'postgresql'
        }
      } catch {
        // Fallback for other databases
        dbDetails = {
          connected: true,
          engine: 'database'
        }
      }
    } catch (dbError) {
      dbStatus = 'unhealthy'
      dbDetails = {
        connected: false,
        error: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }
    }

    const health = {
      status: 'healthy',
      timestamp,
      version: getVersion(),
      environment: getDeploymentEnvironment(),
      uptime: Math.floor(process.uptime()),
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
      },
      database: {
        status: dbStatus,
        ...dbDetails
      },
      services: {
        nextjs: 'healthy',
        database: dbStatus,
        trpc: 'healthy'
      }
    }

    // Set overall status based on critical services
    if (dbStatus === 'unhealthy') {
      health.status = 'degraded'
    }

    return health
  }),

  // Version information
  version: publicProcedure.query(async () => {
    return {
      version: getVersion(),
      environment: getDeploymentEnvironment(),
      buildTime: process.env.BUILD_TIME || new Date().toISOString(),
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'unknown',
      branch: process.env.VERCEL_GIT_COMMIT_REF || process.env.GITHUB_REF_NAME || 'unknown',
      nodeVersion: process.version,
    }
  }),

  // System information
  system: publicProcedure.query(async () => {
    const memUsage = process.memoryUsage()
    
    return {
      uptime: process.uptime(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: {
        rss: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
        heapTotal: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
        heapUsed: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
        external: Math.round((memUsage.external / 1024 / 1024) * 100) / 100,
      },
      env: getDeploymentEnvironment(),
      pid: process.pid,
    }
  }),

  // Database health check
  database: publicProcedure.query(async ({ ctx }) => {
    try {
      const start = Date.now()
      await ctx.prisma.$queryRaw`SELECT 1 as test`
      const responseTime = Date.now() - start
      
      // Get connection info
      let connectionInfo = {}
      try {
        const result = await ctx.prisma.$queryRaw<Array<{ version: string }>>`SELECT version() as version`
        connectionInfo = {
          version: result[0]?.version || 'unknown',
          engine: 'postgresql'
        }
      } catch {
        connectionInfo = {
          engine: 'database'
        }
      }

      return {
        status: 'healthy',
        connected: true,
        responseTime,
        url: getDatabaseUrl()?.replace(/\/\/[^@]+@/, '//***:***@') || 'unavailable', // Hide credentials
        ...connectionInfo
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        url: getDatabaseUrl()?.replace(/\/\/[^@]+@/, '//***:***@') || 'unavailable', // Hide credentials
      }
    }
  }),

  // Ping endpoint for simple availability checks
  ping: publicProcedure.query(() => {
    return {
      message: 'pong',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  }),
})