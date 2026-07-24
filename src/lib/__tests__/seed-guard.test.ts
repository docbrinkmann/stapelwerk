import { describe, it, expect } from 'vitest'
import { shouldResetCatalog } from '~/prisma/seed-guard'

describe('shouldResetCatalog — protects the prod catalog from destructive re-seeds', () => {
  it('is OFF by default so a normal deploy (migrate → seed) never wipes', () => {
    expect(shouldResetCatalog({})).toBe(false)
    expect(shouldResetCatalog({ NODE_ENV: 'production' })).toBe(false)
    // A stray NODE_ENV=development on a prod box must NOT trigger a wipe on its own.
    expect(shouldResetCatalog({ NODE_ENV: 'development' })).toBe(false)
  })

  it('opts in only with an explicit SEED_RESET=true (dev)', () => {
    expect(shouldResetCatalog({ SEED_RESET: 'true', NODE_ENV: 'development' })).toBe(true)
    expect(shouldResetCatalog({ SEED_RESET: 'true' })).toBe(true)
  })

  it('HARD-REFUSES a reset in production even when SEED_RESET=true', () => {
    expect(() => shouldResetCatalog({ SEED_RESET: 'true', NODE_ENV: 'production' })).toThrow(/production/i)
  })
})
