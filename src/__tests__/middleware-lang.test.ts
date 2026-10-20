import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limiter', () => ({
  getClientIdentifier: vi.fn(() => 'test'),
  checkRateLimit: vi.fn(async () => ({ allowed: true, limit: 100, remaining: 99, resetTime: new Date() })),
}))

import { middleware } from '@/middleware'

describe('middleware: language handed over from the landing', () => {
  it('keeps ?lang=de as the app language and redirects to the clean URL', async () => {
    const res = await middleware(new NextRequest('https://app.stapelwerk.dev/auth/signup?lang=de'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://app.stapelwerk.dev/auth/signup')
    expect(res.cookies.get('bms_locale')?.value).toBe('de')
  })

  it('leaves unknown languages and API routes alone', async () => {
    for (const url of ['https://app.stapelwerk.dev/?lang=fr', 'https://app.stapelwerk.dev/api/health?lang=de']) {
      const res = await middleware(new NextRequest(url))
      expect(res.status).toBe(200)
      expect(res.cookies.get('bms_locale')).toBeUndefined()
    }
  })
})
