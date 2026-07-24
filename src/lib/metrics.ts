import client from 'prom-client'

// Singleton registry across hot reloads/tests
const globalAny = global as any

if (!globalAny.__BMS_PROM_REGISTRY__) {
  const registry = new client.Registry()

  // Default metrics
  client.collectDefaultMetrics({ register: registry })

  // Custom metrics
  const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [registry],
  })

  const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [registry],
  })

  const servicesViewed = new client.Counter({
    name: 'services_viewed',
    help: 'Number of service previews viewed',
    registers: [registry],
  })

  const stacksCreated = new client.Counter({
    name: 'stacks_created',
    help: 'Number of stacks created',
    registers: [registry],
  })

  globalAny.__BMS_PROM_REGISTRY__ = {
    registry,
    httpRequestsTotal,
    httpRequestDuration,
    servicesViewed,
    stacksCreated,
  }
}

export const metrics = globalAny.__BMS_PROM_REGISTRY__ as {
  registry: client.Registry
  httpRequestsTotal: client.Counter<'method' | 'route' | 'status'>
  httpRequestDuration: client.Histogram<'method' | 'route' | 'status'>
  servicesViewed: client.Counter<string>
  stacksCreated: client.Counter<string>
}

export async function getMetricsText(): Promise<string> {
  return metrics.registry.metrics()
}
