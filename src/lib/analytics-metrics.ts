/**
 * Real, honest analytics helpers (no fabricated estimates).
 */

type StackForStorage = {
  name?: string | null
  description?: string | null
  envVars?: string | null
  performanceConfig?: string | null
  stack_services?: unknown[]
}

/**
 * Actual bytes of stored stack configuration — the sum of each stack's textual
 * config fields plus a small fixed cost per service row. Replaces the old
 * "1KB per stack" estimate with a measurement of what's really stored.
 */
export function computeStorageBytes(stacks: StackForStorage[]): number {
  const enc = new TextEncoder()
  return stacks.reduce((sum, s) => {
    const blob = (s.name ?? '') + (s.description ?? '') + (s.envVars ?? '') + (s.performanceConfig ?? '')
    return sum + enc.encode(blob).length + (s.stack_services?.length ?? 0) * 8
  }, 0)
}

type LifecycleJob = {
  stackId?: string | null
  mode: string
  status: string
  createdAt: Date | string
}

/**
 * The ids of stacks that are currently up: the latest apply/destroy job per
 * stack is a succeeded `apply`. Single source of truth for "running" across
 * the dashboard cards, the "Running Stacks" tile and the monitoring panel.
 */
export function upStackIds(jobs: LifecycleJob[]): Set<string> {
  const latest = new Map<string, LifecycleJob>()
  for (const j of jobs) {
    if (!j.stackId || (j.mode !== 'apply' && j.mode !== 'destroy')) continue
    const prev = latest.get(j.stackId)
    if (!prev || new Date(j.createdAt) > new Date(prev.createdAt)) latest.set(j.stackId, j)
  }
  const up = new Set<string>()
  latest.forEach((j, stackId) => {
    if (j.mode === 'apply' && j.status === 'succeeded') up.add(stackId)
  })
  return up
}

/** How many stacks are currently up (see upStackIds). */
export function countUpStacks(jobs: LifecycleJob[]): number {
  return upStackIds(jobs).size
}
