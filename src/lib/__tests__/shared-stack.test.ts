import { describe, it, expect } from 'vitest'
import { deriveDifficulty, deriveTags, templateCategoryFilter } from '../shared-stack'

describe('templateCategoryFilter', () => {
  it('is empty when no category is given', () => {
    expect(templateCategoryFilter(undefined)).toEqual({})
    expect(templateCategoryFilter('')).toEqual({})
    expect(templateCategoryFilter('  ')).toEqual({})
  })

  it('filters via services -> categories by slug or name', () => {
    expect(templateCategoryFilter('web')).toEqual({
      stack_services: { some: { services: { categories: { OR: [{ slug: 'web' }, { name: 'web' }] } } } },
    })
  })
})

describe('deriveDifficulty', () => {
  it('scales with the number of services', () => {
    expect(deriveDifficulty(0)).toBe('beginner')
    expect(deriveDifficulty(2)).toBe('beginner')
    expect(deriveDifficulty(3)).toBe('intermediate')
    expect(deriveDifficulty(5)).toBe('intermediate')
    expect(deriveDifficulty(6)).toBe('advanced')
  })
})

describe('deriveTags', () => {
  it('returns unique category names in order', () => {
    const services = [
      { categories: { name: 'Web' } },
      { categories: { name: 'Database' } },
      { categories: { name: 'Web' } }, // dup
      { categories: null },
      null,
    ]
    expect(deriveTags(services)).toEqual(['Web', 'Database'])
  })

  it('is empty when no categories are present', () => {
    expect(deriveTags([{ categories: null }, undefined])).toEqual([])
  })
})
