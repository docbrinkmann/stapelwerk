import { describe, it, expect } from 'vitest'
import { computeStorageBytes } from '../analytics-metrics'

describe('computeStorageBytes', () => {
  it('sums the real byte size of stored config plus per-service cost', () => {
    const stacks = [
      { name: 'ab', description: 'cd', envVars: '[]', performanceConfig: '{}', stack_services: [{}, {}] },
    ]
    // "ab"+"cd"+"[]"+"{}" = 8 bytes, plus 2 services * 8 = 16 → 24
    expect(computeStorageBytes(stacks)).toBe(24)
  })

  it('is zero for no stacks and tolerates missing fields', () => {
    expect(computeStorageBytes([])).toBe(0)
    expect(computeStorageBytes([{}])).toBe(0)
  })

  it('counts multi-byte characters by their UTF-8 length', () => {
    // "é" is 2 bytes in UTF-8
    expect(computeStorageBytes([{ name: 'é' }])).toBe(2)
  })
})

// Regression: "Running Stacks" (dashboard card) and "Active Stacks"
// (monitoring tab) disagreed — one counted in-flight jobs, the other counted
// status='public' (a visibility state, not activity). Both now share this:
// a stack is up when its latest apply/destroy job is a succeeded apply.
describe('countUpStacks', () => {
  const job = (stackId: string, mode: string, status: string, at: string) => ({
    stackId, mode, status, createdAt: new Date(at),
  })

  it('counts a stack whose latest lifecycle job is a succeeded apply', async () => {
    const { countUpStacks } = await import('../analytics-metrics')
    expect(countUpStacks([
      job('a', 'apply', 'succeeded', '2026-07-09T10:00:00Z'),
    ])).toBe(1)
  })

  it('a later destroy takes the stack back down; export jobs are ignored', async () => {
    const { countUpStacks } = await import('../analytics-metrics')
    expect(countUpStacks([
      job('a', 'apply', 'succeeded', '2026-07-09T10:00:00Z'),
      job('a', 'destroy', 'succeeded', '2026-07-09T11:00:00Z'),
      job('a', 'export', 'succeeded', '2026-07-09T12:00:00Z'),
      job('b', 'apply', 'succeeded', '2026-07-09T10:00:00Z'),
      job('b', 'apply', 'failed', '2026-07-09T11:00:00Z'),
    ])).toBe(0)
  })
})

// The dashboard cards need which stacks are up (a Set of ids), not just a count.
describe('upStackIds', () => {
  const job = (stackId: string, mode: string, status: string, at: string) => ({
    stackId, mode, status, createdAt: new Date(at),
  })

  it('returns the ids of stacks whose latest lifecycle job is a succeeded apply', async () => {
    const { upStackIds } = await import('../analytics-metrics')
    const ids = upStackIds([
      job('a', 'apply', 'succeeded', '2026-07-09T10:00:00Z'),
      job('b', 'apply', 'succeeded', '2026-07-09T10:00:00Z'),
      job('b', 'destroy', 'succeeded', '2026-07-09T11:00:00Z'),
    ])
    expect([...ids].sort()).toEqual(['a'])
  })
})
