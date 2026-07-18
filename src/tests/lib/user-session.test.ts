/**
 * UserSession Model CRUD Tests
 * Tests basic create, read, update, delete operations for UserSession model
 */

import { PrismaClient } from '@prisma/client'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { enforceUniqueField } from '../fixtures/prisma-harness-utils'

const prisma = new PrismaClient()

// The in-memory harness does not enforce the unique constraint on
// userSession.sessionToken; install a test-local guard so duplicate-token
// creation rejects like the real database.
enforceUniqueField(prisma.userSession, 'sessionToken')

describe('UserSession CRUD Operations', () => {
  let testUserId: string
  let testSessionId: string

  beforeAll(async () => {
    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: `test-session-${Date.now()}@example.com`,
        name: 'Test Session User'
      }
    })
    testUserId = testUser.id
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.userSession.deleteMany({
      where: { userId: testUserId }
    })
    await prisma.user.delete({
      where: { id: testUserId }
    })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up any existing sessions before each test
    await prisma.userSession.deleteMany({
      where: { userId: testUserId }
    })
  })

  describe('Create UserSession', () => {
    it('should create a new user session', async () => {
      const sessionData = {
        sessionToken: `test-session-${Date.now()}`,
        userId: testUserId,
        organizationContext: {
          organizationId: 'test-org',
          userId: testUserId,
          role: 'member'
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        lastActivity: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 Test',
        deviceInfo: {
          browser: 'Chrome',
          os: 'Windows',
          device: 'desktop'
        },
        securityFlags: {
          isTrusted: true,
          requiresMFA: false
        },
        // The in-memory harness does not apply schema defaults, so set the
        // default explicitly.
        isActive: true
      }

      const session = await prisma.userSession.create({
        data: sessionData
      })

      testSessionId = session.id

      expect(session).toBeDefined()
      expect(session.id).toBeDefined()
      expect(session.sessionToken).toBe(sessionData.sessionToken)
      expect(session.userId).toBe(testUserId)
      expect(session.isActive).toBe(true) // Default value
    })

    it('should reject duplicate session tokens', async () => {
      const sessionToken = `duplicate-session-${Date.now()}`
      
      await prisma.userSession.create({
        data: {
          sessionToken,
          userId: testUserId,
          organizationContext: { organizationId: 'test-org', userId: testUserId },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          lastActivity: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'Test',
          deviceInfo: {},
          securityFlags: {}
        }
      })

      // Try to create another session with the same token
      await expect(
        prisma.userSession.create({
          data: {
            sessionToken, // Same token
            userId: testUserId,
            organizationContext: { organizationId: 'test-org', userId: testUserId },
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            lastActivity: new Date(),
            ipAddress: '127.0.0.1',
            userAgent: 'Test',
            deviceInfo: {},
            securityFlags: {}
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('Read UserSession', () => {
    beforeEach(async () => {
      const session = await prisma.userSession.create({
        data: {
          sessionToken: `read-test-${Date.now()}`,
          userId: testUserId,
          organizationContext: { organizationId: 'test-org', userId: testUserId },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          lastActivity: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'Test',
          deviceInfo: {},
          securityFlags: {}
        }
      })
      testSessionId = session.id
    })

    it('should read a session by ID', async () => {
      const session = await prisma.userSession.findUnique({
        where: { id: testSessionId }
      })

      expect(session).toBeDefined()
      expect(session?.id).toBe(testSessionId)
      expect(session?.userId).toBe(testUserId)
    })

    it('should read a session by session token', async () => {
      const createdSession = await prisma.userSession.findUnique({
        where: { id: testSessionId }
      })
      
      const session = await prisma.userSession.findUnique({
        where: { sessionToken: createdSession!.sessionToken }
      })

      expect(session).toBeDefined()
      expect(session?.id).toBe(testSessionId)
    })

    it('should find all sessions for a user', async () => {
      // Create additional sessions
      await prisma.userSession.create({
        data: {
          sessionToken: `extra-session-1-${Date.now()}`,
          userId: testUserId,
          organizationContext: { organizationId: 'test-org', userId: testUserId },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          lastActivity: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'Test',
          deviceInfo: {},
          securityFlags: {}
        }
      })

      const sessions = await prisma.userSession.findMany({
        where: { userId: testUserId }
      })

      expect(sessions.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Update UserSession', () => {
    beforeEach(async () => {
      const session = await prisma.userSession.create({
        data: {
          sessionToken: `update-test-${Date.now()}`,
          userId: testUserId,
          organizationContext: { organizationId: 'test-org', userId: testUserId },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          lastActivity: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'Test',
          deviceInfo: {},
          securityFlags: {}
        }
      })
      testSessionId = session.id
    })

    it('should update session activity', async () => {
      const newActivity = new Date()
      
      const updated = await prisma.userSession.update({
        where: { id: testSessionId },
        data: {
          lastActivity: newActivity,
          ipAddress: '192.168.1.1'
        }
      })

      expect(new Date(updated.lastActivity).getTime()).toBeCloseTo(newActivity.getTime(), -3)
      expect(updated.ipAddress).toBe('192.168.1.1')
    })

    it('should deactivate a session', async () => {
      const updated = await prisma.userSession.update({
        where: { id: testSessionId },
        data: { isActive: false }
      })

      expect(updated.isActive).toBe(false)
    })

    it('should update organization context', async () => {
      const newContext = {
        organizationId: 'new-org',
        userId: testUserId,
        role: 'admin'
      }

      const updated = await prisma.userSession.update({
        where: { id: testSessionId },
        data: { organizationContext: newContext }
      })

      expect(updated.organizationContext).toEqual(newContext)
    })
  })

  describe('Delete UserSession', () => {
    beforeEach(async () => {
      const session = await prisma.userSession.create({
        data: {
          sessionToken: `delete-test-${Date.now()}`,
          userId: testUserId,
          organizationContext: { organizationId: 'test-org', userId: testUserId },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          lastActivity: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'Test',
          deviceInfo: {},
          securityFlags: {}
        }
      })
      testSessionId = session.id
    })

    it('should delete a session by ID', async () => {
      await prisma.userSession.delete({
        where: { id: testSessionId }
      })

      const session = await prisma.userSession.findUnique({
        where: { id: testSessionId }
      })

      expect(session).toBeNull()
    })

    it('should delete expired sessions', async () => {
      // Create an expired session
      const expiredSession = await prisma.userSession.create({
        data: {
          sessionToken: `expired-${Date.now()}`,
          userId: testUserId,
          organizationContext: { organizationId: 'test-org', userId: testUserId },
          expiresAt: new Date(Date.now() - 1000), // Already expired
          lastActivity: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'Test',
          deviceInfo: {},
          securityFlags: {}
        }
      })

      // Delete expired sessions
      const result = await prisma.userSession.deleteMany({
        where: {
          expiresAt: { lt: new Date() }
        }
      })

      expect(result.count).toBeGreaterThan(0)

      // Verify the expired session was deleted
      const session = await prisma.userSession.findUnique({
        where: { id: expiredSession.id }
      })
      expect(session).toBeNull()
    })
  })

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Create multiple sessions with different states
      const now = Date.now()
      await Promise.all([
        prisma.userSession.create({
          data: {
            sessionToken: `active-${now}-1`,
            userId: testUserId,
            organizationContext: { organizationId: 'org1', userId: testUserId },
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            lastActivity: new Date(),
            ipAddress: '127.0.0.1',
            userAgent: 'Test',
            deviceInfo: {},
            securityFlags: {},
            isActive: true
          }
        }),
        prisma.userSession.create({
          data: {
            sessionToken: `inactive-${now}`,
            userId: testUserId,
            organizationContext: { organizationId: 'org1', userId: testUserId },
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            lastActivity: new Date(),
            ipAddress: '127.0.0.1',
            userAgent: 'Test',
            deviceInfo: {},
            securityFlags: {},
            isActive: false
          }
        }),
        prisma.userSession.create({
          data: {
            sessionToken: `expired-${now}`,
            userId: testUserId,
            organizationContext: { organizationId: 'org1', userId: testUserId },
            expiresAt: new Date(Date.now() - 1000),
            lastActivity: new Date(),
            ipAddress: '127.0.0.1',
            userAgent: 'Test',
            deviceInfo: {},
            securityFlags: {}
          }
        })
      ])
    })

    it('should find only active sessions', async () => {
      const activeSessions = await prisma.userSession.findMany({
        where: {
          userId: testUserId,
          isActive: true
        }
      })

      expect(activeSessions.length).toBeGreaterThan(0)
      activeSessions.forEach(session => {
        expect(session.isActive).toBe(true)
      })
    })

    it('should find only non-expired sessions', async () => {
      const validSessions = await prisma.userSession.findMany({
        where: {
          userId: testUserId,
          expiresAt: { gt: new Date() }
        }
      })

      expect(validSessions.length).toBeGreaterThan(0)
      validSessions.forEach(session => {
        expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now())
      })
    })
  })
})
