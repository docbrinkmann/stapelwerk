import { vi } from 'vitest'
import { PrismaClient } from '@prisma/client'

// Mock Prisma Client for unit tests that don't need real database
export const createMockPrismaClient = () => {
  const mockPrisma = {
    // Example model mock
    example: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },

    // Database operations
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $executeRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $transaction: vi.fn(),

    // Add other models as needed
    // user: {
    //   findMany: vi.fn(),
    //   findUnique: vi.fn(),
    //   // ... etc
    // },
  }

  return mockPrisma as unknown as PrismaClient
}

// Default mock responses
export const mockResponses = {
  example: {
    single: {
      id: 1,
      name: 'Test Example',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    multiple: [
      {
        id: 1,
        name: 'Test Example 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        name: 'Test Example 2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  },

  // Health check response
  health: {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    environment: 'test',
    uptime: 100,
    memory: {
      used: 50.5,
      total: 100.0,
    },
    database: {
      status: 'healthy',
      connected: true,
      version: '3.45.0',
      engine: 'sqlite',
    },
    services: {
      nextjs: 'healthy',
      database: 'healthy',
    },
  },
}

// Mock implementations
export const mockImplementations = {
  example: {
    findMany: () => Promise.resolve(mockResponses.example.multiple),
    findUnique: () => Promise.resolve(mockResponses.example.single),
    create: (data: any) => Promise.resolve({ ...mockResponses.example.single, ...data.data }),
    update: (data: any) => Promise.resolve({ ...mockResponses.example.single, ...data.data }),
    delete: () => Promise.resolve(mockResponses.example.single),
    count: () => Promise.resolve(mockResponses.example.multiple.length),
  },

  database: {
    connect: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    queryRaw: () => Promise.resolve([{ test: 1 }]),
    executeRaw: () => Promise.resolve({ count: 1 }),
  },
}

// Setup mock Prisma client with default implementations
export const setupMockPrisma = () => {
  const mockPrisma = createMockPrismaClient()

  // Setup default implementations
  // Example model removed - using real models like category and service instead

  // Database connection methods don't need mocking for most tests

  return mockPrisma
}

// Utility to reset all mocks
export const resetMocks = (mockPrisma: ReturnType<typeof createMockPrismaClient>) => {
  // Reset all category and service mocks
  Object.values(mockPrisma.category).forEach((mock: any) => {
    if (mock && typeof mock.mockReset === 'function') {
      mock.mockReset()
    }
  })
  Object.values(mockPrisma.service).forEach((mock: any) => {
    if (mock && typeof mock.mockReset === 'function') {
      mock.mockReset()
    }
  })

  const dbMethods = ['$connect', '$disconnect', '$queryRaw', '$executeRaw'] as const
  dbMethods.forEach(method => {
    if (typeof (mockPrisma as any)[method]?.mockReset === 'function') {
      ;(mockPrisma as any)[method].mockReset()
    }
  })
}

export default createMockPrismaClient