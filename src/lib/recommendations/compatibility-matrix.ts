import type { CompatibilityMatrix } from '@/types/recommendations'

/**
 * Service compatibility matrix for rule-based recommendations and builder
 * compatibility warnings.
 *
 * Shared single source of truth: the server recommendation engine
 * (`RecommendationService`) reads it bidirectionally for scoring, and the
 * client stack builder reads it to surface advisory "these may conflict" notes.
 * Keep it free of server-only imports so it stays safe to bundle client-side.
 *
 * `incompatibleWith` captures pairs that fight over the same fixed host
 * resource — most commonly the reverse proxies / web servers that all bind
 * host port :80 by default (only one can win). This is advisory, not blocking.
 */
export const COMPATIBILITY_MATRIX: CompatibilityMatrix = {
  postgresql: {
    compatibleWith: ['pgadmin', 'grafana', 'nginx', 'redis'],
    enhancedBy: ['pgbouncer', 'postgrest'],
    categories: ['database', 'web'],
    tags: ['sql', 'relational', 'acid'],
  },
  mysql: {
    compatibleWith: ['phpmyadmin', 'grafana', 'nginx', 'redis'],
    enhancedBy: ['mysql-workbench'],
    categories: ['database', 'web'],
    tags: ['sql', 'relational'],
  },
  redis: {
    compatibleWith: ['redis-commander', 'redis-insight', 'nginx'],
    enhancedBy: ['redis-sentinel'],
    categories: ['cache', 'database'],
    tags: ['nosql', 'cache', 'memory'],
  },
  nginx: {
    compatibleWith: ['postgresql', 'mysql', 'redis', 'grafana'],
    enhancedBy: ['certbot', 'fail2ban'],
    // Only one process can own host :80 — running a second reverse proxy
    // alongside nginx means a port clash unless one is reconfigured.
    incompatibleWith: ['httpd', 'caddy', 'traefik', 'haproxy'],
    categories: ['web', 'proxy'],
    tags: ['reverse-proxy', 'load-balancer', 'web-server'],
  },
  httpd: {
    incompatibleWith: ['nginx', 'caddy', 'traefik', 'haproxy'],
    categories: ['web', 'proxy'],
    tags: ['web-server'],
  },
  caddy: {
    incompatibleWith: ['nginx', 'httpd', 'traefik', 'haproxy'],
    categories: ['web', 'proxy'],
    tags: ['reverse-proxy', 'web-server', 'automatic-https'],
  },
  traefik: {
    incompatibleWith: ['nginx', 'httpd', 'caddy', 'haproxy'],
    categories: ['web', 'proxy'],
    tags: ['reverse-proxy', 'load-balancer'],
  },
  haproxy: {
    incompatibleWith: ['nginx', 'httpd', 'caddy', 'traefik'],
    categories: ['web', 'proxy'],
    tags: ['load-balancer', 'reverse-proxy'],
  },
  grafana: {
    compatibleWith: ['prometheus', 'influxdb', 'postgresql'],
    enhancedBy: ['loki', 'jaeger'],
    categories: ['monitoring', 'observability'],
    tags: ['monitoring', 'dashboards', 'visualization'],
  },
  plex: {
    compatibleWith: ['tautulli', 'overseerr', 'sonarr', 'radarr'],
    enhancedBy: ['jackett', 'bazarr'],
    categories: ['media'],
    tags: ['media-server', 'streaming', 'entertainment'],
  },
}

/**
 * Whether two service slugs are declared incompatible with each other.
 * Checks both directions so a single matrix entry is enough to define a pair.
 */
export function areIncompatible(slugA: string, slugB: string): boolean {
  if (slugA === slugB) return false
  const a = COMPATIBILITY_MATRIX[slugA]
  const b = COMPATIBILITY_MATRIX[slugB]
  return Boolean(
    a?.incompatibleWith?.includes(slugB) || b?.incompatibleWith?.includes(slugA)
  )
}
