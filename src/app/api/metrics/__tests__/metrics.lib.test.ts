import { describe, it, expect } from 'vitest'
import { metrics, getMetricsText } from '@/lib/metrics'

describe('metrics library', () => {
  it('increments custom metrics and reflects in output', async () => {
    metrics.httpRequestsTotal.inc({ method: 'GET', route: '/api/test', status: '200' })
    metrics.httpRequestDuration.observe({ method: 'GET', route: '/api/test', status: '200' }, 0.01)
    metrics.servicesViewed.inc()
    metrics.stacksCreated.inc(2)

    const text = await getMetricsText()
    expect(text).toContain('http_requests_total')
    expect(text).toContain('http_request_duration_seconds_bucket')
    expect(text).toContain('services_viewed')
    expect(text).toContain('stacks_created')
  })
})
