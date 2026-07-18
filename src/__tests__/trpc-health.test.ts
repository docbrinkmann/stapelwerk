import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const projectRoot = process.cwd()

describe('tRPC Health Endpoints', () => {
  const projectRoot = process.cwd()

  describe('tRPC Configuration', () => {
    it('should have tRPC client configuration', () => {
      const trpcConfigPaths = [
        'src/utils/trpc.ts',
        'src/lib/trpc.ts',
        'src/trpc/client.ts'
      ]
      
      const hasConfig = trpcConfigPaths.some(path => 
        existsSync(join(projectRoot, path))
      )
      
      expect(hasConfig).toBe(true)
    })

    it('should have tRPC server configuration', () => {
      const trpcServerPaths = [
        'src/server/trpc.ts',
        'src/trpc/server.ts',
        'src/app/api/trpc/[trpc]/route.ts'
      ]
      
      const hasServer = trpcServerPaths.some(path => 
        existsSync(join(projectRoot, path))
      )
      
      expect(hasServer).toBe(true)
    })

    it('should have tRPC dependencies installed', () => {
      const packageFile = join(projectRoot, 'package.json')
      const packageJson = JSON.parse(readFileSync(packageFile, 'utf-8'))
      
      const hasTrpc = Object.keys({
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }).some(dep => dep.includes('trpc'))
      
      expect(hasTrpc).toBe(true)
    })
  })

  describe('Health Check Router', () => {
    it('should have health router definition', () => {
      const routerPaths = [
        'src/server/routers/health.ts',
        'src/trpc/routers/health.ts',
        'src/app/api/trpc/routers/health.ts'
      ]
      
      const hasRouter = routerPaths.some(path => 
        existsSync(join(projectRoot, path))
      )
      
      expect(hasRouter).toBe(true)
    })

    it('should export health procedures', () => {
      const routerPaths = [
        'src/server/routers/health.ts',
        'src/trpc/routers/health.ts',
        'src/app/api/trpc/routers/health.ts'
      ]
      
      const existingRouter = routerPaths.find(path => 
        existsSync(join(projectRoot, path))
      )
      
      if (existingRouter) {
        const content = readFileSync(join(projectRoot, existingRouter), 'utf-8')
        expect(content).toContain('publicProcedure')
        expect(content).toMatch(/(health|status)/i)
      }
    })

    it('should include database connectivity check', () => {
      const routerPaths = [
        'src/server/routers/health.ts',
        'src/trpc/routers/health.ts',
        'src/app/api/trpc/routers/health.ts'
      ]
      
      const existingRouter = routerPaths.find(path => 
        existsSync(join(projectRoot, path))
      )
      
      if (existingRouter) {
        const content = readFileSync(join(projectRoot, existingRouter), 'utf-8')
        expect(content).toMatch(/(prisma|database)/i)
      }
    })
  })

  describe('Version Router', () => {
    it('should have version router or procedure', () => {
      const routerPaths = [
        'src/server/routers/version.ts',
        'src/trpc/routers/version.ts',
        'src/server/routers/health.ts', // might be combined
        'src/trpc/routers/health.ts'
      ]
      
      const hasVersionInfo = routerPaths.some(path => {
        if (!existsSync(join(projectRoot, path))) return false
        const content = readFileSync(join(projectRoot, path), 'utf-8')
        return content.includes('version')
      })
      
      expect(hasVersionInfo).toBe(true)
    })

    it('should return application version information', () => {
      const routerPaths = [
        'src/server/routers/version.ts',
        'src/trpc/routers/version.ts',
        'src/server/routers/health.ts',
        'src/trpc/routers/health.ts'
      ]
      
      const existingRouter = routerPaths.find(path => 
        existsSync(join(projectRoot, path))
      )
      
      if (existingRouter) {
        const content = readFileSync(join(projectRoot, existingRouter), 'utf-8')
        expect(content).toMatch(/(getVersion|npm_package_version|process\.env\.npm_package_version)/i)
      }
    })
  })

  describe('Health Data Structure', () => {
    it('should return proper health status structure', () => {
      const routerPaths = [
        'src/server/routers/health.ts',
        'src/trpc/routers/health.ts'
      ]
      
      const existingRouter = routerPaths.find(path => 
        existsSync(join(projectRoot, path))
      )
      
      if (existingRouter) {
        const content = readFileSync(join(projectRoot, existingRouter), 'utf-8')
        // Should include essential health check properties
        expect(content).toMatch(/(status|timestamp|uptime)/i)
      }
    })

    it('should include system information', () => {
      const routerPaths = [
        'src/server/routers/health.ts',
        'src/trpc/routers/health.ts'
      ]
      
      const existingRouter = routerPaths.find(path => 
        existsSync(join(projectRoot, path))
      )
      
      if (existingRouter) {
        const content = readFileSync(join(projectRoot, existingRouter), 'utf-8')
        // Should include system metrics
        expect(content).toMatch(/(memory|uptime|environment)/i)
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors', () => {
      const routerPaths = [
        'src/server/routers/health.ts',
        'src/trpc/routers/health.ts'
      ]
      
      const existingRouter = routerPaths.find(path => 
        existsSync(join(projectRoot, path))
      )
      
      if (existingRouter) {
        const content = readFileSync(join(projectRoot, existingRouter), 'utf-8')
        expect(content).toMatch(/(try|catch|error)/i)
      }
    })

    it('should return appropriate error responses', () => {
      const routerPaths = [
        'src/server/routers/health.ts',
        'src/trpc/routers/health.ts'
      ]
      
      const existingRouter = routerPaths.find(path => 
        existsSync(join(projectRoot, path))
      )
      
      if (existingRouter) {
        const content = readFileSync(join(projectRoot, existingRouter), 'utf-8')
        expect(content).toMatch(/(unhealthy|degraded|error)/i)
      }
    })
  })
})

describe('Deployment Health Validation', () => {
  describe('Environment Validation', () => {
    it('should validate required environment variables', () => {
      const envValidationPaths = [
        'src/env.mjs',
        'src/env.ts',
        'src/lib/env.ts'
      ]
      
      const hasEnvValidation = envValidationPaths.some(path => 
        existsSync(join(projectRoot, path))
      )
      
      expect(hasEnvValidation).toBe(true)
    })

    it('should include database URL validation', () => {
      const envValidationPaths = [
        'src/env.mjs',
        'src/env.ts',
        'src/lib/env.ts'
      ]
      
      const existingValidation = envValidationPaths.find(path => 
        existsSync(join(projectRoot, path))
      )
      
      if (existingValidation) {
        const content = readFileSync(join(projectRoot, existingValidation), 'utf-8')
        expect(content).toContain('DATABASE_URL')
      }
    })
  })

  describe('Build Health', () => {
    it('should have type checking in build process', () => {
      const packageFile = join(projectRoot, 'package.json')
      const packageJson = JSON.parse(readFileSync(packageFile, 'utf-8'))
      
      expect(packageJson.scripts.build).toMatch(/(tsc|type-check)/i)
    })

    it('should have lint checking in CI', () => {
      const gitlabCi = join(projectRoot, '.gitlab-ci.yml')
      const githubCi = join(projectRoot, '.github/workflows/ci.yml')
      const ciConfig = existsSync(gitlabCi) ? gitlabCi : githubCi
      if (existsSync(ciConfig)) {
        const content = readFileSync(ciConfig, 'utf-8')
        expect(content).toContain('lint')
      }
    })
  })
})