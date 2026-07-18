import { PrismaClient } from '@prisma/client'

/**
 * Stack Slug Generation Utility
 * 
 * Handles unique slug generation for stacks with collision detection
 * and consistent formatting rules.
 */

export class StackSlugGenerator {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate URL-friendly slug from stack name
   */
  static formatSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      // Remove special characters except spaces, hyphens, and underscores
      .replace(/[^\w\s-]/g, '')
      // Replace spaces and underscores with hyphens
      .replace(/[\s_-]+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Ensure slug is not empty
      || 'stack'
  }

  /**
   * Generate unique slug with collision handling
   */
  async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    const baseSlug = StackSlugGenerator.formatSlug(name)
    let slug = baseSlug
    let counter = 2

    while (await this.isSlugTaken(slug, excludeId)) {
      slug = `${baseSlug}-${counter}`
      counter++
      
      // Prevent infinite loops
      if (counter > 9999) {
        slug = `${baseSlug}-${Date.now()}`
        break
      }
    }

    return slug
  }

  /**
   * Check if slug is already taken
   */
  private async isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const existing = await this.prisma.stacks.findUnique({
      where: { slug },
      select: { id: true }
    })

    // If no existing stack found, slug is available
    if (!existing) return false

    // If excludeId is provided and matches existing stack, slug is available for update
    if (excludeId && existing.id === excludeId) return false

    // Slug is taken
    return true
  }

  /**
   * Validate slug format
   */
  static validateSlug(slug: string): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // Check length
    if (slug.length < 2) {
      errors.push('Slug must be at least 2 characters long')
    }

    if (slug.length > 100) {
      errors.push('Slug must not exceed 100 characters')
    }

    // Check format
    if (!slug.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)) {
      errors.push('Slug must contain only lowercase letters, numbers, and hyphens (no spaces or special characters)')
    }

    // Check for invalid patterns
    if (slug.startsWith('-') || slug.endsWith('-')) {
      errors.push('Slug cannot start or end with hyphens')
    }

    if (slug.includes('--')) {
      errors.push('Slug cannot contain consecutive hyphens')
    }

    // Check for reserved slugs
    const reservedSlugs = [
      'api', 'admin', 'www', 'mail', 'ftp', 'blog', 'shop', 'store',
      'app', 'apps', 'service', 'services', 'system', 'root', 'user',
      'users', 'account', 'accounts', 'profile', 'profiles', 'settings',
      'config', 'configuration', 'dashboard', 'panel', 'control',
      'help', 'support', 'contact', 'about', 'terms', 'privacy',
      'legal', 'docs', 'documentation', 'guide', 'tutorial', 'example',
      'demo', 'test', 'dev', 'development', 'staging', 'production',
      'beta', 'alpha', 'v1', 'v2', 'version', 'latest', 'stable'
    ]

    if (reservedSlugs.includes(slug)) {
      errors.push(`Slug "${slug}" is reserved and cannot be used`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Suggest alternative slugs if the preferred one is taken
   */
  async suggestAlternatives(name: string, count = 5): Promise<string[]> {
    const baseSlug = StackSlugGenerator.formatSlug(name)
    const suggestions: string[] = []

    // Try variations of the base slug
    const variations = [
      baseSlug,
      `${baseSlug}-stack`,
      `${baseSlug}-app`,
      `${baseSlug}-service`,
      `my-${baseSlug}`,
      `${baseSlug}-v1`,
      `${baseSlug}-${new Date().getFullYear()}`,
      `${baseSlug}-${Math.random().toString(36).substr(2, 4)}`
    ]

    for (const variation of variations) {
      if (suggestions.length >= count) break
      
      if (!(await this.isSlugTaken(variation))) {
        suggestions.push(variation)
      }
    }

    // If we still need more suggestions, add numbered versions
    let counter = 2
    while (suggestions.length < count && counter <= 99) {
      const numberedSlug = `${baseSlug}-${counter}`
      if (!(await this.isSlugTaken(numberedSlug))) {
        suggestions.push(numberedSlug)
      }
      counter++
    }

    return suggestions
  }

  /**
   * Generate slug preview for user interface
   */
  static generatePreview(name: string): {
    slug: string
    warning?: string
  } {
    const slug = this.formatSlug(name)
    const validation = this.validateSlug(slug)
    
    return {
      slug,
      warning: validation.errors.length > 0 
        ? `Slug may need adjustment: ${validation.errors[0]}`
        : undefined
    }
  }

  /**
   * Batch check multiple slugs for availability
   */
  async checkSlugsAvailability(slugs: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {}

    // Query all slugs at once for efficiency
    const existingSlugs = await this.prisma.stacks.findMany({
      where: {
        slug: {
          in: slugs
        }
      },
      select: { slug: true }
    })

    const takenSlugs = new Set(existingSlugs.map(s => s.slug))

    slugs.forEach(slug => {
      results[slug] = !takenSlugs.has(slug)
    })

    return results
  }
}