import { cleanup, render, RenderOptions } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { ReactElement } from 'react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Custom render function with default providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, {
    // Add any global providers here (Theme, Router, etc.)
    // wrapper: ({ children }) => (
    //   <ThemeProvider theme={theme}>
    //     <Router>{children}</Router>
    //   </ThemeProvider>
    // ),
    ...options,
  })
}

// Re-export everything from testing library
export * from '@testing-library/react'
export { customRender as render }

// Test utility functions
export const createMockContext = () => {
  const stackServices = { findMany: vi.fn() }
  const prisma = {
    stack_services: stackServices,
    stackService: stackServices,
    services: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    recommendation_patterns: { findMany: vi.fn(), count: vi.fn() },
    recommendation_feedback: { count: vi.fn(), aggregate: vi.fn() },
  }
  const recommendationService = {
    getRecommendationsForStack: vi.fn(),
    getUseCaseRecommendations: vi.fn(),
    recordFeedback: vi.fn(),
    getPopularPatterns: vi.fn(),
    searchRecommendations: vi.fn(),
    refreshRecommendationsForStack: vi.fn(),
  }
  return { prisma, recommendationService, userId: 'test-user' }
}

export const testUtils = {
  // Wait for a specific condition
  waitFor: async (condition: () => boolean, timeout: number = 5000): Promise<void> => {
    const startTime = Date.now()
    
    while (!condition()) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Condition not met within timeout')
      }
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  },

  // Generate random test data
  generateRandomString: (length: number = 10): string => {
    return Math.random().toString(36).substring(2, length + 2)
  },

  generateRandomEmail: (): string => {
    return `test-${testUtils.generateRandomString(8)}@example.com`
  },

  generateRandomNumber: (min: number = 0, max: number = 100): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min
  },

  // Date utilities for testing
  createFutureDate: (daysFromNow: number = 1): Date => {
    const date = new Date()
    date.setDate(date.getDate() + daysFromNow)
    return date
  },

  createPastDate: (daysAgo: number = 1): Date => {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    return date
  },

  // Mock implementations
  createMockFunction: <T extends (...args: any[]) => any>(
    implementation?: T
  ): T & { mock: { calls: Parameters<T>[]; results: ReturnType<T>[] } } => {
    const calls: Parameters<T>[] = []
    const results: ReturnType<T>[] = []
    
    const mockFn = ((...args: Parameters<T>) => {
      calls.push(args)
      if (implementation) {
        const result = implementation(...args)
        results.push(result)
        return result
      }
    }) as T & { mock: { calls: Parameters<T>[]; results: ReturnType<T>[] } }
    
    mockFn.mock = { calls, results }
    return mockFn
  },

  // API testing helpers
  createMockResponse: (data: any, status: number = 200) => {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
      text: async () => JSON.stringify(data),
    }
  },

  // Local storage mock for testing
  mockLocalStorage: () => {
    let store: Record<string, string> = {}
    
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        store = {}
      },
      get length() {
        return Object.keys(store).length
      },
      key: (index: number) => Object.keys(store)[index] || null,
    }
  },

  // Console mock for testing
  mockConsole: () => {
    const originalConsole = console
    const mockLog = testUtils.createMockFunction()
    const mockError = testUtils.createMockFunction()
    const mockWarn = testUtils.createMockFunction()
    
    return {
      mock: () => {
        console.log = mockLog
        console.error = mockError
        console.warn = mockWarn
      },
      restore: () => {
        console.log = originalConsole.log
        console.error = originalConsole.error
        console.warn = originalConsole.warn
      },
      calls: {
        log: mockLog.mock.calls,
        error: mockError.mock.calls,
        warn: mockWarn.mock.calls,
      }
    }
  },

  // Form testing utilities
  fillForm: async (fields: Record<string, string>) => {
    const { userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    
    for (const [fieldName, value] of Object.entries(fields)) {
      const field = document.querySelector(`[name="${fieldName}"]`) as HTMLInputElement
      if (field) {
        await user.clear(field)
        await user.type(field, value)
      }
    }
  },

  // Async utilities
  sleep: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  // Test isolation utilities
  createTestContext: () => {
    const context = {
      data: new Map(),
      cleanup: [] as (() => void)[],
    }

    return {
      set: (key: string, value: any) => context.data.set(key, value),
      get: (key: string) => context.data.get(key),
      addCleanup: (fn: () => void) => context.cleanup.push(fn),
      cleanup: () => {
        context.cleanup.forEach(fn => fn())
        context.cleanup.length = 0
        context.data.clear()
      }
    }
  },
}

// Custom matchers (if needed)
export const customMatchers = {
  // Add custom Jest/Vitest matchers here
}

// Export default
export default testUtils