import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const projectRoot = process.cwd()

describe('Docker Production Configuration', () => {
  describe('Dockerfile for Production', () => {
    it('should have production Dockerfile', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      expect(existsSync(dockerfile)).toBe(true)
    })

    it('should use Node 22 Alpine base image', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')
      
      // Verify Node 22 Alpine is used in all stages
      expect(content).toMatch(/FROM node:22-alpine/)
    })

    it('should have multi-stage build (deps, builder, runner)', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')
      
      // Verify all three stages exist
      expect(content).toMatch(/FROM node:22-alpine AS deps/)
      expect(content).toMatch(/FROM node:22-alpine AS builder/)
      expect(content).toMatch(/FROM node:22-alpine AS runner/)
    })

    it('should use npm with the committed lockfile', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')

      expect(content).toMatch(/COPY package\.json package-lock\.json/)
    })

    it('should install dependencies in deps stage', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')

      // All deps (incl. devDeps) are installed in deps; the runner stage
      // only copies the standalone output + Prisma client, so the final
      // image stays minimal.
      expect(content).toMatch(/RUN npm install/)
    })

    it('should generate Prisma client in builder stage', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')

      expect(content).toMatch(/npm run db:generate/)
    })

    it('should build Next.js application in builder stage', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')

      expect(content).toMatch(/npm run build/)
    })
  })

  describe('Docker Security Configuration', () => {
    it('should create non-root user', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')
      
      expect(content).toMatch(/addgroup --system --gid 1001 nodejs/)
      expect(content).toMatch(/adduser --system --uid 1001 nextjs/)
    })

    it('should switch to non-root user', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')
      
      expect(content).toMatch(/USER nextjs/)
    })

    it('should set proper file ownership for nextjs user', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')
      
      expect(content).toMatch(/--chown=nextjs:nodejs/)
    })

    it('should disable Next.js telemetry', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')
      
      expect(content).toMatch(/NEXT_TELEMETRY_DISABLED=1/)
    })

    it('should set NODE_ENV to production', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')
      
      expect(content).toMatch(/NODE_ENV=production/)
    })
  })

  describe('Docker Optimization', () => {
    it('should copy standalone output from builder', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')
      
      expect(content).toMatch(/COPY --from=builder.*\.next\/standalone/)
      expect(content).toMatch(/COPY --from=builder.*\.next\/static/)
    })

    it('should copy Prisma client to runner', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')
      
      expect(content).toMatch(/COPY --from=builder.*node_modules\/.prisma/)
      expect(content).toMatch(/COPY --from=builder.*node_modules\/@prisma/)
    })

    it('should expose port 3000', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')
      
      expect(content).toMatch(/EXPOSE 3000/)
    })
  })

  describe('Docker Health Check', () => {
    it('should have health check configured', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')
      
      expect(content).toMatch(/HEALTHCHECK/)
    })

    it('should check /api/health endpoint', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')
      
      expect(content).toMatch(/\/api\/health/)
    })

    it('should have proper health check timing', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')
      
      // Should have interval, timeout, retries, and start-period
      expect(content).toMatch(/--interval/)
      expect(content).toMatch(/--timeout/)
      expect(content).toMatch(/--retries/)
      expect(content).toMatch(/--start-period/)
    })
  })

  describe('Docker Runtime Configuration', () => {
    it('should start application with node server.js', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')
      
      expect(content).toMatch(/CMD.*node.*server\.js/)
    })

    it('should have healthcheck.js file', () => {
      const healthcheck = join(projectRoot, 'healthcheck.js')
      expect(existsSync(healthcheck)).toBe(true)
    })
  })
})

describe('Next.js Standalone Output Configuration', () => {
  describe('Next.js Config', () => {
    it('should have next.config.js file', () => {
      const nextConfig = join(projectRoot, 'next.config.js')
      expect(existsSync(nextConfig)).toBe(true)
    })

    it('should have standalone output configured', () => {
      const nextConfig = join(projectRoot, 'next.config.js')
      const content = readFileSync(nextConfig, 'utf-8')
      
      expect(content).toMatch(/output:\s*['"]standalone['"]/)
    })

    it('should have serverExternalPackages for Prisma', () => {
      const nextConfig = join(projectRoot, 'next.config.js')
      const content = readFileSync(nextConfig, 'utf-8')

      // Next.js 15+ renamed experimental.serverComponentsExternalPackages
      // to top-level serverExternalPackages
      expect(content).toMatch(/serverExternalPackages/)
      expect(content).toMatch(/@prisma\/client/)
    })

    it('should have proper webpack watch configuration for Docker', () => {
      const nextConfig = join(projectRoot, 'next.config.js')
      const content = readFileSync(nextConfig, 'utf-8')
      
      expect(content).toMatch(/watchOptions/)
      expect(content).toMatch(/WATCHPACK_POLLING/)
    })
  })

  describe('Build Scripts', () => {
    it('should have build script in package.json', () => {
      const packageFile = join(projectRoot, 'package.json')
      const packageJson = JSON.parse(readFileSync(packageFile, 'utf-8'))
      
      expect(packageJson.scripts).toHaveProperty('build')
      expect(packageJson.scripts.build).toContain('next build')
    })

    it('should have Prisma generate in Docker build process', () => {
      // For Docker production builds, Prisma generate should be in the Dockerfile
      // This is the correct approach for containerized deployments
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')

      expect(content).toMatch(/npm run db:generate/)
    })
  })
})

describe('Health Check Endpoint', () => {
  describe('Health Check Implementation', () => {
    it('should have health check route', () => {
      const healthRoute = join(projectRoot, 'src/app/api/health/route.ts')
      expect(existsSync(healthRoute)).toBe(true)
    })

    it('should export GET method', () => {
      const healthRoute = join(projectRoot, 'src/app/api/health/route.ts')
      const content = readFileSync(healthRoute, 'utf-8')
      
      expect(content).toContain('export async function GET')
    })

    it('should export HEAD method for lightweight checks', () => {
      const healthRoute = join(projectRoot, 'src/app/api/health/route.ts')
      const content = readFileSync(healthRoute, 'utf-8')
      
      expect(content).toContain('export async function HEAD')
    })

    it('should include database connectivity check', () => {
      const healthRoute = join(projectRoot, 'src/app/api/health/route.ts')
      const content = readFileSync(healthRoute, 'utf-8')
      
      expect(content).toMatch(/(prisma|database)/i)
    })

    it('should return proper JSON format with status and timestamp', () => {
      const healthRoute = join(projectRoot, 'src/app/api/health/route.ts')
      const content = readFileSync(healthRoute, 'utf-8')
      
      expect(content).toContain('status')
      expect(content).toContain('timestamp')
    })
  })

  describe('Healthcheck Script', () => {
    it('should have healthcheck.js file', () => {
      const healthcheck = join(projectRoot, 'healthcheck.js')
      expect(existsSync(healthcheck)).toBe(true)
    })

    it('should make request to /api/health', () => {
      const healthcheck = join(projectRoot, 'healthcheck.js')
      const content = readFileSync(healthcheck, 'utf-8')
      
      expect(content).toContain('/api/health')
    })

    it('should exit with 0 on success, 1 on failure', () => {
      const healthcheck = join(projectRoot, 'healthcheck.js')
      const content = readFileSync(healthcheck, 'utf-8')
      
      expect(content).toMatch(/process\.exit\(0\)/)
      expect(content).toMatch(/process\.exit\(1\)/)
    })

    it('should handle timeouts', () => {
      const healthcheck = join(projectRoot, 'healthcheck.js')
      const content = readFileSync(healthcheck, 'utf-8')
      
      expect(content).toMatch(/timeout/)
    })

    it('should handle connection errors', () => {
      const healthcheck = join(projectRoot, 'healthcheck.js')
      const content = readFileSync(healthcheck, 'utf-8')
      
      expect(content).toMatch(/on\(['"]error['"]/)
    })
  })
})

describe('Docker Image Quality', () => {
  describe('Image Size Optimization', () => {
    it('should use Alpine Linux for minimal image size', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')
      
      expect(content).toMatch(/alpine/)
    })

    it('should only copy necessary files to runner stage', () => {
      const dockerfile = join(projectRoot, 'Dockerfile')
      const content = readFileSync(dockerfile, 'utf-8')
      
      // Should copy .next/standalone, not the entire .next directory
      expect(content).toMatch(/\.next\/standalone/)
      expect(content).not.toMatch(/COPY --from=builder .*\.next \.\/\.next/)
    })

    it('should have .dockerignore file', () => {
      const dockerignore = join(projectRoot, '.dockerignore')
      expect(existsSync(dockerignore)).toBe(true)
    })

    it('should exclude development files from Docker context', () => {
      const dockerignore = join(projectRoot, '.dockerignore')
      const content = readFileSync(dockerignore, 'utf-8')
      
      expect(content).toMatch(/node_modules/)
      expect(content).toMatch(/\.next/)
      expect(content).toMatch(/\.git/)
    })
  })

  describe('Production Environment', () => {
    it('should have .env.production.example file', () => {
      const envExample = join(projectRoot, '.env.production.example')
      expect(existsSync(envExample)).toBe(true)
    })

    it('should not include .env files in Docker context', () => {
      const dockerignore = join(projectRoot, '.dockerignore')
      const content = readFileSync(dockerignore, 'utf-8')
      
      expect(content).toMatch(/\.env/)
    })
  })
})
