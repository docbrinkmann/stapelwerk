/**
 * Pure helpers for the public shared-stack view. Kept separate from the router
 * so the derivation logic is unit-testable without the DB include machinery.
 */

export type SharedDifficulty = 'beginner' | 'intermediate' | 'advanced'

/** Real difficulty from the stack's size rather than a hardcoded value. */
export function deriveDifficulty(serviceCount: number): SharedDifficulty {
  if (serviceCount <= 2) return 'beginner'
  if (serviceCount <= 5) return 'intermediate'
  return 'advanced'
}

/**
 * Prisma `where` fragment that filters stacks to those with at least one service
 * in the given category (matched by slug or name). Stacks have no direct
 * category, so we go through stack_services -> services -> categories.
 * Returns {} when no category is requested.
 */
export function templateCategoryFilter(category?: string | null): Record<string, unknown> {
  const c = category?.trim()
  if (!c) return {}
  return {
    stack_services: {
      some: { services: { categories: { OR: [{ slug: c }, { name: c }] } } },
    },
  }
}

/** Real tags from the services' category names (unique, order-preserving). */
export function deriveTags(services: Array<{ categories?: { name?: string | null } | null } | null | undefined>): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const s of services) {
    const name = s?.categories?.name?.trim()
    if (name && !seen.has(name)) {
      seen.add(name)
      tags.push(name)
    }
  }
  return tags
}
