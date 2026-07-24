import { describe, it, expect } from 'vitest'
import { stackContainerName, containerBelongsToStack } from '../terminal-containers'

// The stack terminal execs into deployed compose containers. Names come from
// the compose project (`bms-<stackId>`) plus compose's `<service>-1` suffix —
// and the WS executor must be able to verify a client-supplied container name
// really belongs to the claimed stack (the ownership check builds on this).
describe('stackContainerName', () => {
  it('builds the deployed compose container name for a service', () => {
    expect(
      stackContainerName('3385f27f-6928-4f77-9cb8-a68b109481e3', 'nextcloud'),
    ).toBe('bms-3385f27f-6928-4f77-9cb8-a68b109481e3-nextcloud-1')
  })
})

describe('containerBelongsToStack', () => {
  const stackId = '3385f27f-6928-4f77-9cb8-a68b109481e3'

  it('accepts containers of the stack project', () => {
    expect(containerBelongsToStack(`bms-${stackId}-postgresql-1`, stackId)).toBe(true)
  })

  it("rejects another stack's containers and the app's own infra", () => {
    expect(containerBelongsToStack('bms-other-stack-nextcloud-1', stackId)).toBe(false)
    expect(containerBelongsToStack('stapelwerk_postgres', stackId)).toBe(false)
    // Prefix tricks must not pass either.
    expect(containerBelongsToStack(`bms-${stackId}extra-svc-1`, stackId)).toBe(false)
  })
})

import { extractSessionToken } from '../../../../server/terminal-executor'

// next-auth chunks large session cookies into .0/.1/…; the WS upgrade must
// reassemble them (unchunked and __Secure- forms too) or docker-mode auth
// rejects every real session.
describe('extractSessionToken', () => {
  it('reads the unchunked cookie', () => {
    expect(extractSessionToken('foo=1; next-auth.session-token=ABC; bar=2')).toBe('ABC')
  })

  it('reassembles chunked cookies in index order', () => {
    expect(
      extractSessionToken('next-auth.session-token.1=BBB; other=x; next-auth.session-token.0=AAA'),
    ).toBe('AAABBB')
  })

  it('handles the __Secure- prefix', () => {
    expect(extractSessionToken('__Secure-next-auth.session-token=XYZ')).toBe('XYZ')
  })

  it('returns undefined when absent', () => {
    expect(extractSessionToken('session=nope')).toBeUndefined()
    expect(extractSessionToken(undefined)).toBeUndefined()
  })
})
