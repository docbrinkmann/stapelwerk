/**
 * Stack optimization suggestions — pure, testable, and APPLICABLE.
 *
 * Each suggestion names concrete catalog services (by slug) so the UI can
 * offer one-click "add" instead of a read-only hint. Texts are message keys;
 * the component renders them through t() so the panel is fully translatable.
 */
import type { MessageKey } from '@/lib/i18n/messages'

export interface StackOptimization {
  type: 'missing-monitoring' | 'security-gap' | 'reverse-proxy'
  titleKey: MessageKey
  descriptionKey: MessageKey
  impactKey: MessageKey
  priority: 'high' | 'medium'
  /** Catalog slugs offered as one-click adds, in preference order. */
  suggestedSlugs: string[]
}

/** Display names for suggested slugs (catalog proper names, not translated). */
export const SUGGESTION_LABELS: Record<string, string> = {
  prometheus: 'Prometheus',
  grafana: 'Grafana',
  crowdsec: 'CrowdSec',
  vault: 'Vault',
  nginx: 'NGINX',
  caddy: 'Caddy',
  traefik: 'Traefik',
}

/**
 * Tolerant category-slug reader. Services reach the builder through several
 * transforms: the services API flattens `category` to the NAME string, the
 * recommendations API keeps the `categories` relation, and stored drafts may
 * carry an object. Derive the slug from whichever shape is present (name →
 * slug via lowercase/hyphens matches all seeded categories).
 */
export function categorySlugOf(service: unknown): string | undefined {
  const svc = service as {
    categories?: { slug?: string; name?: string } | null
    category?: { slug?: string; name?: string } | string | null
  }
  const fromObject = (o?: { slug?: string; name?: string } | null): string | undefined =>
    o?.slug ?? o?.name?.toLowerCase().replace(/\s+/g, '-')
  if (svc?.categories) return fromObject(svc.categories)
  if (typeof svc?.category === 'string') {
    return svc.category.toLowerCase().replace(/\s+/g, '-')
  }
  return fromObject(svc?.category)
}

/**
 * Analyze the current stack and return applicable optimization suggestions.
 * A suggestion never proposes a service family the stack already has.
 */
export function generateStackOptimizations(
  stackServices: Array<{ service: unknown }>,
): StackOptimization[] {
  if (stackServices.length === 0) return []

  const categories = new Set(
    stackServices.map(s => categorySlugOf(s.service)).filter(Boolean) as string[],
  )
  const optimizations: StackOptimization[] = []

  if (!categories.has('monitoring')) {
    optimizations.push({
      type: 'missing-monitoring',
      titleKey: 'builder.optMonitoringTitle',
      descriptionKey: 'builder.optMonitoringDesc',
      impactKey: 'builder.optMonitoringImpact',
      priority: 'high',
      suggestedSlugs: ['prometheus', 'grafana'],
    })
  }

  if (categories.has('databases') && !categories.has('security')) {
    optimizations.push({
      type: 'security-gap',
      titleKey: 'builder.optSecurityTitle',
      descriptionKey: 'builder.optSecurityDesc',
      impactKey: 'builder.optSecurityImpact',
      priority: 'high',
      suggestedSlugs: ['crowdsec', 'vault'],
    })
  }

  if (stackServices.length > 5 && !categories.has('web-servers')) {
    optimizations.push({
      type: 'reverse-proxy',
      titleKey: 'builder.optProxyTitle',
      descriptionKey: 'builder.optProxyDesc',
      impactKey: 'builder.optProxyImpact',
      priority: 'medium',
      suggestedSlugs: ['caddy', 'nginx', 'traefik'],
    })
  }

  return optimizations
}
