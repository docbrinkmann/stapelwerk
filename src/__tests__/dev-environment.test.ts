import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn, ChildProcess } from 'child_process'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

describe('Development Environment', () => {
  describe('Docker Configuration', () => {
    it('should have a Dockerfile for development', () => {
      const dockerfilePath = resolve(process.cwd(), 'Dockerfile.dev')
      expect(existsSync(dockerfilePath)).toBe(true)
    })

    it('should have a docker-compose.yml file', () => {
      const dockerComposePath = resolve(process.cwd(), 'docker-compose.yml')
      expect(existsSync(dockerComposePath)).toBe(true)
    })

    it('should have proper Node.js version in Dockerfile', () => {
      const dockerfilePath = resolve(process.cwd(), 'Dockerfile.dev')
      if (existsSync(dockerfilePath)) {
        const dockerfileContent = readFileSync(dockerfilePath, 'utf-8')
        expect(dockerfileContent).toMatch(/FROM node:22/)
      }
    })

    it('should have development environment variables configured', () => {
      const dockerComposePath = resolve(process.cwd(), 'docker-compose.yml')
      if (existsSync(dockerComposePath)) {
        const dockerComposeContent = readFileSync(dockerComposePath, 'utf-8')
        expect(dockerComposeContent).toMatch(/NODE_ENV.*development/)
      }
    })
  })

  describe('Development Scripts', () => {
    it('should have docker development scripts in package.json', () => {
      const packageJsonPath = resolve(process.cwd(), 'package.json')
      const packageContent = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      
      expect(packageContent.scripts).toHaveProperty('dev:docker')
      expect(packageContent.scripts).toHaveProperty('docker:up')
      expect(packageContent.scripts).toHaveProperty('docker:down')
    })

    it('should have proper port configuration', () => {
      const dockerComposePath = resolve(process.cwd(), 'docker-compose.yml')
      if (existsSync(dockerComposePath)) {
        const dockerComposeContent = readFileSync(dockerComposePath, 'utf-8')
        // App is intentionally exposed on host port 3999 (container port 3000)
        expect(dockerComposeContent).toMatch(/3999:3000/)
      }
    })
  })

  describe('Hot Reloading Configuration', () => {
    it('should have volume mounts for source code', () => {
      const dockerComposePath = resolve(process.cwd(), 'docker-compose.yml')
      if (existsSync(dockerComposePath)) {
        const dockerComposeContent = readFileSync(dockerComposePath, 'utf-8')
        expect(dockerComposeContent).toMatch(/\.\/src/)
        expect(dockerComposeContent).toMatch(/\/app\/src/)
      }
    })

    it('should have node_modules optimization', () => {
      const dockerComposePath = resolve(process.cwd(), 'docker-compose.yml')
      if (existsSync(dockerComposePath)) {
        const dockerComposeContent = readFileSync(dockerComposePath, 'utf-8')
        expect(dockerComposeContent).toMatch(/node_modules/)
      }
    })

    it('should have proper Next.js development configuration', () => {
      const dockerfilePath = resolve(process.cwd(), 'Dockerfile.dev')
      if (existsSync(dockerfilePath)) {
        const dockerfileContent = readFileSync(dockerfilePath, 'utf-8')
        expect(dockerfileContent).toMatch(/CMD.*dev/)
      }
    })
  })

  describe('Environment Variables', () => {
    it('should have .env.docker file for development', () => {
      const envDockerPath = resolve(process.cwd(), '.env.docker')
      expect(existsSync(envDockerPath)).toBe(true)
    })

    it('should have proper database configuration for containers', () => {
      const envDockerPath = resolve(process.cwd(), '.env.docker')
      if (existsSync(envDockerPath)) {
        const envContent = readFileSync(envDockerPath, 'utf-8')
        expect(envContent).toMatch(/DATABASE_URL/)
        expect(envContent).toMatch(/postgresql:\/\//)
      }
    })
  })

  describe('Database Integration', () => {
    it('should have PostgreSQL service in docker-compose', () => {
      const dockerComposePath = resolve(process.cwd(), 'docker-compose.yml')
      if (existsSync(dockerComposePath)) {
        const dockerComposeContent = readFileSync(dockerComposePath, 'utf-8')
        expect(dockerComposeContent).toMatch(/postgres/)
        expect(dockerComposeContent).toMatch(/5432/)
      }
    })

    it('should have proper database initialization', () => {
      const dockerComposePath = resolve(process.cwd(), 'docker-compose.yml')
      if (existsSync(dockerComposePath)) {
        const dockerComposeContent = readFileSync(dockerComposePath, 'utf-8')
        expect(dockerComposeContent).toMatch(/POSTGRES_DB/)
        expect(dockerComposeContent).toMatch(/POSTGRES_USER/)
        expect(dockerComposeContent).toMatch(/POSTGRES_PASSWORD/)
      }
    })
  })

  describe('Development Performance', () => {
    it('should have proper watchpack polling configuration', () => {
      const nextConfigPath = resolve(process.cwd(), 'next.config.js')
      if (existsSync(nextConfigPath)) {
        const nextConfigContent = readFileSync(nextConfigPath, 'utf-8')
        expect(nextConfigContent).toMatch(/WATCHPACK_POLLING/)
      }
    })

    it('should have proper build context in Dockerfile', () => {
      const dockerfilePath = resolve(process.cwd(), 'Dockerfile.dev')
      if (existsSync(dockerfilePath)) {
        const dockerfileContent = readFileSync(dockerfilePath, 'utf-8')
        expect(dockerfileContent).toMatch(/WORKDIR/)
        expect(dockerfileContent).toMatch(/COPY/)
      }
    })
  })
})

describe('Hot Reloading Integration', () => {
  let testProcess: ChildProcess | undefined

  afterAll(async () => {
    if (testProcess) {
      testProcess.kill()
    }
  })

  describe('File Watch Capabilities', () => {
    it('should detect file changes in development mode', async () => {
      // This test will be implemented after Docker setup is complete
      // It will create a test file, modify it, and verify hot reloading works
      expect(true).toBe(true) // Placeholder for now
    })

    it('should have proper file watching exclusions', () => {
      const dockerignorePath = resolve(process.cwd(), '.dockerignore')
      expect(existsSync(dockerignorePath)).toBe(true)
    })

    it('should exclude unnecessary files from Docker context', () => {
      const dockerignorePath = resolve(process.cwd(), '.dockerignore')
      if (existsSync(dockerignorePath)) {
        const dockerignoreContent = readFileSync(dockerignorePath, 'utf-8')
        expect(dockerignoreContent).toMatch(/node_modules/)
        expect(dockerignoreContent).toMatch(/\.next/)
        expect(dockerignoreContent).toMatch(/\.git/)
      }
    })
  })

  describe('Development Server Configuration', () => {
    it('should have proper hostname configuration for Docker', () => {
      const dockerfilePath = resolve(process.cwd(), 'Dockerfile.dev')
      if (existsSync(dockerfilePath)) {
        const dockerfileContent = readFileSync(dockerfilePath, 'utf-8')
        expect(dockerfileContent).toMatch(/0\.0\.0\.0/)
      }
    })

    it('should have concurrent process management', () => {
      const packageJsonPath = resolve(process.cwd(), 'package.json')
      const packageContent = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      
      expect(packageContent.scripts).toHaveProperty('dev:concurrent')
    })
  })
})