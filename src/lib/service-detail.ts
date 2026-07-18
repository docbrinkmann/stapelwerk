/**
 * Pure formatting helpers for the service-detail page. services.get pre-parses
 * some JSON fields (ports/env) into arrays but leaves others (volumes) as
 * strings, and port/volume objects use a few different key conventions — these
 * tolerate all of it.
 */

export function asArray(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw) {
    try {
      const v = JSON.parse(raw)
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  }
  return []
}

export function portLabel(p: any): string {
  if (typeof p !== 'object' || p === null) return String(p)
  const host = p.host ?? p.hostPort ?? p.published ?? p.external
  const container = p.container ?? p.containerPort ?? p.target ?? p.port ?? p.internal
  if (host && container) return `${host}:${container}`
  return String(container ?? host ?? '—')
}

export function volumeLabel(v: any): string {
  if (typeof v !== 'object' || v === null) return String(v)
  return v.containerPath ?? v.path ?? v.container ?? v.target ?? v.mountPath ?? JSON.stringify(v)
}
