// Vitest global types and jest-to-vi shims for TypeScript
// This file provides minimal compatibility for tests written with Jest APIs

import type { Mock, MockedFunction } from 'vitest'

declare const vi: typeof import('vitest')['vi']

declare global {
  // Allow using `jest` as an alias of `vi` in tests
  // Value-level alias
  // eslint-disable-next-line no-var
  var jest: typeof vi

  // Namespace with common Jest types used in tests
  namespace jest {
    // Map Jest.Mock to Vitest's Mock type
    type Mock<T = any, Y extends any[] = any[]> = Mock<T, Y>
    // Map Jest.MockedFunction to Vitest's equivalent
    type MockedFunction<T extends (...args: any[]) => any> = MockedFunction<T>
  }
}

// Provide a declaration for `jest` at module scope as well
declare const jest: typeof vi

export {}
