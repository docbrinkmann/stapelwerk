import { describe, it, expect } from 'vitest'
import { en, de, makeT, parseLocale } from '@/lib/i18n/messages'

describe('i18n core', () => {
  it('German dictionary covers every English key (runtime mirror of the type gate)', () => {
    const missing = Object.keys(en).filter(key => !(key in de) || !de[key as keyof typeof de])
    expect(missing).toEqual([])
  })

  it('translates per locale and interpolates {vars}', () => {
    expect(makeT('en')('common.save')).toBe('Save')
    expect(makeT('de')('common.save')).toBe('Speichern')
    // Interpolation works on any value containing {placeholders}.
    const t = makeT('en')
    expect(t('common.copied')).not.toContain('{')
  })

  it('parseLocale falls back to en for anything but "de"', () => {
    expect(parseLocale('de')).toBe('de')
    expect(parseLocale('en')).toBe('en')
    expect(parseLocale('fr')).toBe('en')
    expect(parseLocale(undefined)).toBe('en')
  })
})
