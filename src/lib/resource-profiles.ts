import type { StackService } from '@/types/stack'
import type { Service } from '@/types/service'

/**
 * Resource budgeting — "does this fit on my Pi?"
 *
 * Target hardware profiles the builder can budget a stack against, plus the
 * pure summing/evaluation logic. Services carry `resourceRequirements`
 * as `{ cpu (cores), memory (MB) }`; we sum those across the stack and compare
 * to the selected profile.
 */

export interface TargetProfile {
  id: string
  name: string
  /** Total RAM in MB. 0 = unbounded / informational (custom hardware). */
  memoryMb: number
  /** Total CPU cores. 0 = unbounded / informational. */
  cpuCores: number
}

export const TARGET_PROFILES: TargetProfile[] = [
  { id: 'rpi4', name: 'Raspberry Pi 4 (4 GB / 4 cores)', memoryMb: 4 * 1024, cpuCores: 4 },
  { id: 'rpi5', name: 'Raspberry Pi 5 (8 GB / 4 cores)', memoryMb: 8 * 1024, cpuCores: 4 },
  { id: 'home', name: 'Home Server (16 GB / 8 cores)', memoryMb: 16 * 1024, cpuCores: 8 },
  { id: 'vps', name: 'VPS / Custom (no limit)', memoryMb: 0, cpuCores: 0 },
]

export const DEFAULT_TARGET_PROFILE_ID = 'rpi4'

export function getProfile(id: string | undefined): TargetProfile {
  return (
    TARGET_PROFILES.find(p => p.id === id) ??
    TARGET_PROFILES.find(p => p.id === DEFAULT_TARGET_PROFILE_ID)!
  )
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : 0
}

export interface StackResourceUsage {
  cpuCores: number
  memoryMb: number
}

/**
 * Read a single service's declared resource footprint. Tolerant of the runtime
 * shape (numbers) and the declared string shape; missing metadata counts as 0.
 */
export function readServiceResources(service: Service): StackResourceUsage {
  const r = (service as { resourceRequirements?: { cpu?: unknown; memory?: unknown } })
    .resourceRequirements
  return { cpuCores: toNumber(r?.cpu), memoryMb: toNumber(r?.memory) }
}

/** Sum resource requirements across every service in the stack. */
export function sumStackResources(services: StackService[]): StackResourceUsage {
  return services.reduce<StackResourceUsage>(
    (acc, { service }) => {
      const r = readServiceResources(service)
      acc.cpuCores += r.cpuCores
      acc.memoryMb += r.memoryMb
      return acc
    },
    { cpuCores: 0, memoryMb: 0 }
  )
}

export interface BudgetDimension {
  used: number
  /** Profile limit for this dimension; 0 means unbounded. */
  limit: number
  /** used/limit as a fraction (0 when unbounded). */
  ratio: number
  exceeds: boolean
}

export interface BudgetEvaluation {
  profile: TargetProfile
  bounded: boolean
  memory: BudgetDimension
  cpu: BudgetDimension
  /** True when the stack overruns any bounded dimension. */
  exceeds: boolean
}

function evaluateDimension(used: number, limit: number): BudgetDimension {
  if (limit <= 0) {
    return { used, limit: 0, ratio: 0, exceeds: false }
  }
  return { used, limit, ratio: used / limit, exceeds: used > limit }
}

/** Compare a stack's summed usage against a target profile. */
export function evaluateBudget(
  usage: StackResourceUsage,
  profile: TargetProfile
): BudgetEvaluation {
  const memory = evaluateDimension(usage.memoryMb, profile.memoryMb)
  const cpu = evaluateDimension(usage.cpuCores, profile.cpuCores)
  return {
    profile,
    bounded: profile.memoryMb > 0 || profile.cpuCores > 0,
    memory,
    cpu,
    exceeds: memory.exceeds || cpu.exceeds,
  }
}

/** Format an MB value as a compact GB string, e.g. 3277 -> "3.2 GB". */
export function formatGb(memoryMb: number): string {
  return `${(memoryMb / 1024).toFixed(1)} GB`
}
