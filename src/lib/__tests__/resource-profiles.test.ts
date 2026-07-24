import { describe, it, expect } from 'vitest'
import {
  TARGET_PROFILES,
  DEFAULT_TARGET_PROFILE_ID,
  getProfile,
  sumStackResources,
  readServiceResources,
  evaluateBudget,
  formatGb,
} from '@/lib/resource-profiles'
import type { StackService } from '@/types/stack'
import type { Service } from '@/types/service'

function makeStackService(id: number, cpu: unknown, memory: unknown): StackService {
  const service = {
    id,
    name: `svc-${id}`,
    slug: `svc-${id}`,
    description: '',
    dockerImage: 'x',
    version: 'latest',
    category: { id: 1, name: 'x', slug: 'x' },
    ports: [],
    environmentVariables: {},
    resourceRequirements: { cpu, memory },
  } as unknown as Service
  return {
    id: `ss-${id}`,
    serviceId: id,
    order: 0,
    service,
    configuration: { environmentVariables: {}, portMappings: [], volumeMounts: [], dependsOn: [] },
  }
}

describe('resource profiles', () => {
  it('has the default profile in the list', () => {
    expect(TARGET_PROFILES.some(p => p.id === DEFAULT_TARGET_PROFILE_ID)).toBe(true)
  })

  it('getProfile falls back to the default for unknown ids', () => {
    expect(getProfile('nope').id).toBe(DEFAULT_TARGET_PROFILE_ID)
    expect(getProfile('rpi5').id).toBe('rpi5')
  })

  it('readServiceResources coerces numbers and strings, defaulting missing to 0', () => {
    expect(readServiceResources(makeStackService(1, 0.5, 512).service)).toEqual({
      cpuCores: 0.5,
      memoryMb: 512,
    })
    expect(readServiceResources(makeStackService(2, '1.0', '1024').service)).toEqual({
      cpuCores: 1,
      memoryMb: 1024,
    })
    expect(readServiceResources(makeStackService(3, undefined, undefined).service)).toEqual({
      cpuCores: 0,
      memoryMb: 0,
    })
  })

  it('sums resources across the stack', () => {
    const stack = [
      makeStackService(1, 0.5, 512),
      makeStackService(2, 1.0, 2048),
      makeStackService(3, 0.25, 256),
    ]
    expect(sumStackResources(stack)).toEqual({ cpuCores: 1.75, memoryMb: 2816 })
  })

  it('marks a stack that fits the Raspberry Pi 4 as within budget', () => {
    const usage = { cpuCores: 2.5, memoryMb: 3 * 1024 }
    const budget = evaluateBudget(usage, getProfile('rpi4'))
    expect(budget.bounded).toBe(true)
    expect(budget.exceeds).toBe(false)
    expect(budget.memory.exceeds).toBe(false)
  })

  it('flags a stack that overruns the Raspberry Pi 4 RAM', () => {
    const usage = { cpuCores: 2, memoryMb: 5 * 1024 }
    const budget = evaluateBudget(usage, getProfile('rpi4'))
    expect(budget.exceeds).toBe(true)
    expect(budget.memory.exceeds).toBe(true)
  })

  it('treats the VPS/custom profile as unbounded', () => {
    const usage = { cpuCores: 99, memoryMb: 99 * 1024 }
    const budget = evaluateBudget(usage, getProfile('vps'))
    expect(budget.bounded).toBe(false)
    expect(budget.exceeds).toBe(false)
  })

  it('formats MB as GB', () => {
    expect(formatGb(3277)).toBe('3.2 GB')
    expect(formatGb(4096)).toBe('4.0 GB')
  })
})
