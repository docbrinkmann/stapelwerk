import { describe, it, expect } from 'vitest'
import { GET } from '../route'

describe('/api/metrics route', () => {
  it('returns 200 and prometheus text format', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const ct = res.headers.get('content-type') || res.headers.get('Content-Type')
    expect(ct).toMatch(/^text\/plain;\s*version=0\.0\.4/i)

    const text = await res.text()
    expect(text).toContain('# HELP')
    expect(text).toContain('http_requests_total')
    expect(text).toContain('http_request_duration_seconds')
  })
})
