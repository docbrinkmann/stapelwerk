import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const projectRoot = process.cwd()

describe('Server Infrastructure Setup', () => {
  describe('Docker Compose Production Configuration', () => {
    it('should have docker-compose.prod.yml file', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      expect(existsSync(dockerCompose)).toBe(true)
    })

    it('should have PostgreSQL 18 service configured', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      expect(content).toMatch(/postgres:18-alpine/)
      expect(content).toMatch(/POSTGRES_DB/)
      expect(content).toMatch(/POSTGRES_USER/)
      expect(content).toMatch(/POSTGRES_PASSWORD/)
    })

    it('should have app service with proper image reference', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      expect(content).toMatch(/CI_REGISTRY_IMAGE/)
      expect(content).toMatch(/DOCKER_IMAGE_TAG/)
    })

    it('should configure health checks for PostgreSQL', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      expect(content).toMatch(/healthcheck/)
      expect(content).toMatch(/pg_isready/)
    })

    it('should configure health checks for application', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      // App healthcheck is an inline node check (healthcheck.js is not traced
      // into the standalone output), hitting /api/health.
      expect(content).toMatch(/node.*\/api\/health/)
    })

    it('should have persistent volume for PostgreSQL data', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      expect(content).toMatch(/postgres-data/)
      expect(content).toMatch(/\/var\/lib\/postgresql\/data/)
    })

    it('should configure app network', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      expect(content).toMatch(/networks:/)
      expect(content).toMatch(/app-network/)
    })

    it('should configure restart policy', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      expect(content).toMatch(/restart: unless-stopped/)
    })
  })

  describe('Environment Configuration', () => {
    it('should have .env.production.example file', () => {
      const envExample = join(projectRoot, '.env.production.example')
      expect(existsSync(envExample)).toBe(true)
    })

    it('should include database configuration variables', () => {
      const envExample = join(projectRoot, '.env.production.example')
      const content = readFileSync(envExample, 'utf-8')
      
      expect(content).toMatch(/POSTGRES_DB/)
      expect(content).toMatch(/POSTGRES_USER/)
      expect(content).toMatch(/POSTGRES_PASSWORD/)
      expect(content).toMatch(/DATABASE_URL/)
    })

    it('should include NextAuth configuration', () => {
      const envExample = join(projectRoot, '.env.production.example')
      const content = readFileSync(envExample, 'utf-8')
      
      expect(content).toMatch(/NEXTAUTH_SECRET/)
      expect(content).toMatch(/NEXTAUTH_URL/)
    })

    it('should include GitLab registry configuration', () => {
      const envExample = join(projectRoot, '.env.production.example')
      const content = readFileSync(envExample, 'utf-8')
      
      expect(content).toMatch(/CI_REGISTRY/)
      expect(content).toMatch(/CI_REGISTRY_IMAGE/)
      expect(content).toMatch(/DOCKER_IMAGE_TAG/)
    })

    it('should include application URL configuration', () => {
      const envExample = join(projectRoot, '.env.production.example')
      const content = readFileSync(envExample, 'utf-8')
      
      expect(content).toMatch(/NEXT_PUBLIC_APP_URL/)
    })

    it('should include optional Sentry configuration', () => {
      const envExample = join(projectRoot, '.env.production.example')
      const content = readFileSync(envExample, 'utf-8')
      
      expect(content).toMatch(/SENTRY_DSN/)
      expect(content).toMatch(/SENTRY_AUTH_TOKEN/)
    })

    it('should include security warnings for sensitive values', () => {
      const envExample = join(projectRoot, '.env.production.example')
      const content = readFileSync(envExample, 'utf-8')
      
      expect(content).toMatch(/CHANGE_ME|GENERATE/)
    })
  })

  describe('Server Setup Documentation', () => {
    it('should have SERVER_SETUP.md documentation', () => {
      const serverSetup = join(projectRoot, 'docs/SERVER_SETUP.md')
      expect(existsSync(serverSetup)).toBe(true)
    })

    it('should document Docker installation steps', () => {
      const serverSetup = join(projectRoot, 'docs/SERVER_SETUP.md')
      const content = readFileSync(serverSetup, 'utf-8')
      
      expect(content).toMatch(/Install Docker/)
      expect(content).toMatch(/docker --version/)
    })

    it('should document SSH key setup', () => {
      const serverSetup = join(projectRoot, 'docs/SERVER_SETUP.md')
      const content = readFileSync(serverSetup, 'utf-8')
      
      expect(content).toMatch(/SSH Key Setup/)
      expect(content).toMatch(/ssh-keygen/)
    })

    it('should document GitLab Container Registry authentication', () => {
      const serverSetup = join(projectRoot, 'docs/SERVER_SETUP.md')
      const content = readFileSync(serverSetup, 'utf-8')
      
      expect(content).toMatch(/Container Registry/)
      expect(content).toMatch(/docker login/)
    })

    it('should document application directory structure', () => {
      const serverSetup = join(projectRoot, 'docs/SERVER_SETUP.md')
      const content = readFileSync(serverSetup, 'utf-8')
      
      expect(content).toMatch(/\/opt\/stapelwerk/)
    })

    it('should document firewall configuration', () => {
      const serverSetup = join(projectRoot, 'docs/SERVER_SETUP.md')
      const content = readFileSync(serverSetup, 'utf-8')
      
      expect(content).toMatch(/Firewall/)
      expect(content).toMatch(/ufw/)
    })

    it('should document GitLab CI/CD variables', () => {
      const serverSetup = join(projectRoot, 'docs/SERVER_SETUP.md')
      const content = readFileSync(serverSetup, 'utf-8')
      
      expect(content).toMatch(/CI\/CD Variables/)
      expect(content).toMatch(/SSH_PRIVATE_KEY/)
      expect(content).toMatch(/SERVER_HOST/)
    })
  })

  describe('PostgreSQL Configuration', () => {
    it('should configure PostgreSQL performance parameters', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      // Should have tuned PostgreSQL parameters
      expect(content).toMatch(/max_connections/)
      expect(content).toMatch(/shared_buffers/)
      expect(content).toMatch(/effective_cache_size/)
    })

    it('should configure PostgreSQL data persistence', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      expect(content).toMatch(/PGDATA/)
      expect(content).toMatch(/pgdata/)
    })

    it('should configure PostgreSQL health check', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      expect(content).toMatch(/pg_isready/)
      expect(content).toMatch(/interval: 10s/)
      expect(content).toMatch(/retries: 5/)
    })
  })

  describe('Application Service Configuration', () => {
    it('should configure app to depend on PostgreSQL health', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      expect(content).toMatch(/depends_on:/)
      expect(content).toMatch(/postgres:/)
      expect(content).toMatch(/condition: service_healthy/)
    })

    it('should configure proper port mapping', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      expect(content).toMatch(/ports:/)
      expect(content).toMatch(/3000/) // Port 3000 configured
    })

    it('should configure logging', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      expect(content).toMatch(/logging:/)
      expect(content).toMatch(/json-file/)
      expect(content).toMatch(/max-size/)
      expect(content).toMatch(/max-file/)
    })

    it('should configure all required environment variables', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      expect(content).toMatch(/NODE_ENV/)
      expect(content).toMatch(/DATABASE_URL/)
      expect(content).toMatch(/NEXTAUTH_SECRET/)
      expect(content).toMatch(/NEXTAUTH_URL/)
    })
  })

  describe('Security Configuration', () => {
    it('should require critical environment variables', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      // Variables that must be set (using :? syntax)
      expect(content).toMatch(/POSTGRES_PASSWORD:\?/)
      expect(content).toMatch(/NEXTAUTH_URL:\?/)
      // DATABASE_URL and NEXTAUTH_SECRET may be provided via Docker
      // secrets (*_FILE) instead of plain env vars, so they are optional
      // in the compose file but the *_FILE variants must be wired up
      expect(content).toMatch(/DATABASE_URL_FILE/)
      expect(content).toMatch(/NEXTAUTH_SECRET_FILE/)
    })

    it('should not expose PostgreSQL port externally', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      // PostgreSQL service should not have ports mapping
      const postgresSection = content.split('# Next.js Application')[0]
      expect(postgresSection).not.toMatch(/ports:.*5432/)
    })

    it('should configure secure network isolation', () => {
      const dockerCompose = join(projectRoot, 'docker-compose.prod.yml')
      const content = readFileSync(dockerCompose, 'utf-8')
      
      expect(content).toMatch(/networks:/)
      expect(content).toMatch(/app-network/)
      expect(content).toMatch(/driver: bridge/)
    })
  })

  describe('Directory Structure', () => {
    it('should have deployment scripts directory', () => {
      const scripts = join(projectRoot, 'scripts')
      expect(existsSync(scripts)).toBe(true)
    })

    it('should have documentation directory', () => {
      const docs = join(projectRoot, 'docs')
      expect(existsSync(docs)).toBe(true)
    })

    it('should have config directory for nginx', () => {
      const config = join(projectRoot, 'config/nginx')
      expect(existsSync(config)).toBe(true)
    })
  })
})
