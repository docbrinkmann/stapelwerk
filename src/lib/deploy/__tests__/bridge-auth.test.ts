import { describe, it, expect } from 'vitest'
import { bridgeTokenAuthorized } from '../bridge-auth'

describe('bridgeTokenAuthorized', () => {
  it('accepts the exact Bearer token', () => {
    expect(bridgeTokenAuthorized('Bearer s3cret', 's3cret')).toBe(true)
  })

  it('rejects a wrong token', () => {
    expect(bridgeTokenAuthorized('Bearer nope', 's3cret')).toBe(false)
  })

  it('rejects a missing/blank Authorization header', () => {
    expect(bridgeTokenAuthorized(undefined, 's3cret')).toBe(false)
    expect(bridgeTokenAuthorized('', 's3cret')).toBe(false)
  })

  it('fails closed when no token is configured (bridge disabled)', () => {
    // The whole security boundary is the token — an unset token must never
    // authorize, even for an empty/"Bearer " header.
    expect(bridgeTokenAuthorized('Bearer ', undefined)).toBe(false)
    expect(bridgeTokenAuthorized('Bearer anything', '')).toBe(false)
    expect(bridgeTokenAuthorized(undefined, undefined)).toBe(false)
  })

  it('rejects a token that is a prefix of the real one (length guard)', () => {
    expect(bridgeTokenAuthorized('Bearer s3cre', 's3cret')).toBe(false)
    expect(bridgeTokenAuthorized('Bearer s3crett', 's3cret')).toBe(false)
  })
})
