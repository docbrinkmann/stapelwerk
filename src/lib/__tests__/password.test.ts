import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../password'

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', () => {
    const stored = hashPassword('s3cret-Pass!')
    expect(stored.startsWith('scrypt:')).toBe(true)
    expect(verifyPassword('s3cret-Pass!', stored)).toBe(true)
    expect(verifyPassword('wrong', stored)).toBe(false)
  })

  it('rejects malformed stored values without throwing', () => {
    expect(verifyPassword('x', 'not-a-hash')).toBe(false)
    expect(verifyPassword('x', '')).toBe(false)
  })

  it('produces unique salts', () => {
    expect(hashPassword('same')).not.toEqual(hashPassword('same'))
  })
})
