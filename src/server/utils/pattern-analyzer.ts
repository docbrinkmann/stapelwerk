import { PrismaClient } from '@prisma/client'
import type { RecommendationPattern, ServiceWithDetails } from '@/types/recommendations'

export class PatternAnalyzer {
  constructor(private prisma: PrismaClient) {}

  /**
   * Analyze stack data to identify popular service combinations
   */
  async analyzeStackPatterns(): Promise<void> {
    // Get all public stacks for analysis
const stacks = await this.prisma.stacks.findMany({
      where: { 
        isPublic: true,
        status: 'public'
      },
      include: {
        stack_services: {
          include: {
            services: true
          }
        }
      }
    })

const stackData = stacks.map(stack => ({
      services: stack.stack_services.map(ss => ss.serviceId),
      deploymentSuccess: true // Assume public stacks are successful
    }))

    const patterns = await this.identifyPatterns(stackData)
    
    // Save patterns to database
    for (const pattern of patterns) {
      await this.savePattern(pattern)
    }
  }

  /**
   * Identify patterns from stack data
   */
  private async identifyPatterns(
    stackData: Array<{ services: number[], deploymentSuccess?: boolean }>
  ): Promise<RecommendationPattern[]> {
    const patternFrequency = new Map<string, { count: number, successes: number, stacks: number[] }>()
    
    // Analyze service combinations
    for (let i = 0; i < stackData.length; i++) {
      const stack = stackData[i]
      if (stack.services.length < 2) continue
      
      // Generate combinations of different sizes
      for (let size = 2; size <= Math.min(stack.services.length, 5); size++) {
        const combinations = this.generateCombinations(stack.services, size)
        
        for (const combination of combinations) {
          const key = combination.sort((a, b) => a - b).join(',')
          const current = patternFrequency.get(key) || { count: 0, successes: 0, stacks: [] }
          
          patternFrequency.set(key, {
            count: current.count + 1,
            successes: current.successes + (stack.deploymentSuccess !== false ? 1 : 0),
            stacks: [...current.stacks, i]
          })
        }
      }
    }

    // Convert to patterns with metadata
    const patterns: RecommendationPattern[] = []
    
    for (const [serviceIds, stats] of patternFrequency) {
      if (stats.count < 3) continue // Minimum frequency threshold
      
      const services = serviceIds.split(',').map(Number)
      const successRate = stats.successes / stats.count
      const category = await this.inferPatternCategory(services)
      
patterns.push({
        id: `pattern-${Date.now()}-${serviceIds.replace(/,/g, '-')}`,
        serviceIds: services,
        frequency: stats.count,
        successRate,
        category,
        minStackSize: services.length,
        maxStackSize: Math.max(...stats.stacks.map(i => stackData[i].services.length)),
        metadata: {
          description: await this.generatePatternDescription(services),
          difficulty: this.inferPatternDifficulty(services.length, successRate),
averageSetupTime: this.estimateSetupTime(services.length),
        },
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }

    return patterns.sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * Infer pattern category based on services
   */
  private async inferPatternCategory(serviceIds: number[]): Promise<string> {
const services = await this.prisma.services.findMany({
      where: { id: { in: serviceIds } },
      include: { categories: true }
    })

    const categories = services.map(s => s.categories.slug)
    const categoryCount = categories.reduce((acc, cat) => {
      acc[cat] = (acc[cat] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Return most common category
    const dominantCategory = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0]

    // Map to broader categories
    const categoryMapping: Record<string, string> = {
      'database': 'data-stack',
      'cache': 'data-stack', 
      'web': 'web-stack',
      'proxy': 'web-stack',
      'monitoring': 'observability',
      'logging': 'observability',
      'media': 'media-server',
      'entertainment': 'media-server',
      'development': 'dev-environment',
      'security': 'security-stack'
    }

    return categoryMapping[dominantCategory] || 'mixed-stack'
  }

  /**
   * Generate human-readable pattern description
   */
  private async generatePatternDescription(serviceIds: number[]): Promise<string> {
const services = await this.prisma.services.findMany({
      where: { id: { in: serviceIds } }
    })

    const names = services.map(s => s.name)
    
    if (names.length === 2) {
      return `${names[0]} paired with ${names[1]}`
    } else if (names.length === 3) {
      return `${names[0]}, ${names[1]}, and ${names[2]} stack`
    } else {
      return `${names.slice(0, 2).join(', ')}, and ${names.length - 2} other services`
    }
  }

  /**
   * Infer pattern difficulty based on size and success rate
   */
private inferPatternDifficulty(size: number, successRate: number): 'beginner' | 'intermediate' | 'advanced' {
    if (size <= 2 && successRate >= 0.8) return 'beginner'
    if (size <= 4 && successRate >= 0.6) return 'intermediate'
    return 'advanced'
  }

  /**
   * Estimate setup time based on number of services
   */
  private estimateSetupTime(serviceCount: number): string {
    const baseMinutes = serviceCount * 8 // 8 minutes per service on average
    const totalMinutes = Math.min(baseMinutes, 120) // Cap at 2 hours
    
    if (totalMinutes <= 15) return 'Under 15 minutes'
    if (totalMinutes <= 30) return '15-30 minutes'
    if (totalMinutes <= 60) return '30-60 minutes'
    return 'Over 1 hour'
  }

  /**
   * Save pattern to database, updating if exists
   */
  private async savePattern(pattern: RecommendationPattern): Promise<void> {
    const serviceIdsJson = JSON.stringify(pattern.serviceIds)
    
    // Check if pattern already exists
const existing = await this.prisma.recommendation_patterns.findFirst({
      where: { serviceIds: serviceIdsJson }
    })

    if (existing) {
      // Update existing pattern
await this.prisma.recommendation_patterns.update({
        where: { id: existing.id },
        data: {
          frequency: pattern.frequency,
          successRate: pattern.successRate,
          metadata: pattern.metadata ? JSON.stringify(pattern.metadata) : undefined,
          updatedAt: new Date()
        }
      })
    } else {
      // Create new pattern
await this.prisma.recommendation_patterns.create({
        data: {
          id: crypto.randomUUID(),
          serviceIds: serviceIdsJson,
          frequency: pattern.frequency,
          successRate: pattern.successRate,
          category: pattern.category,
          minStackSize: pattern.minStackSize,
          maxStackSize: pattern.maxStackSize,
          metadata: pattern.metadata ? JSON.stringify(pattern.metadata) : undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
    }
  }

  /**
   * Get trending patterns (patterns with increasing frequency)
   */
  async getTrendingPatterns(daysBack: number = 30): Promise<RecommendationPattern[]> {
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    
const rows = await this.prisma.recommendation_patterns.findMany({
      where: {
        updatedAt: { gte: cutoffDate },
        frequency: { gte: 5 }
      },
      orderBy: [
        { frequency: 'desc' },
        { successRate: 'desc' }
      ],
      take: 20
    })

    return rows.map((r) => ({
      id: r.id,
      serviceIds: JSON.parse(r.serviceIds || '[]') as number[],
      frequency: r.frequency,
      successRate: r.successRate,
      category: r.category,
      minStackSize: r.minStackSize,
      maxStackSize: r.maxStackSize,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  }

  /**
   * Get patterns by category
   */
  async getPatternsByCategory(category: string, limit: number = 10): Promise<RecommendationPattern[]> {
const rows = await this.prisma.recommendation_patterns.findMany({
      where: { category },
      orderBy: [
        { frequency: 'desc' },
        { successRate: 'desc' }
      ],
      take: limit
    })
    return rows.map((r) => ({
      id: r.id,
      serviceIds: JSON.parse(r.serviceIds || '[]') as number[],
      frequency: r.frequency,
      successRate: r.successRate,
      category: r.category,
      minStackSize: r.minStackSize,
      maxStackSize: r.maxStackSize,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  }

  /**
   * Generate service combinations
   */
  private generateCombinations<T>(arr: T[], size: number): T[][] {
    if (size === 1) return arr.map(item => [item])
    
    const combinations: T[][] = []
    for (let i = 0; i <= arr.length - size; i++) {
      const smallerCombinations = this.generateCombinations(arr.slice(i + 1), size - 1)
      for (const combination of smallerCombinations) {
        combinations.push([arr[i], ...combination])
      }
    }
    
    return combinations
  }

  /**
   * Clean up old patterns that are no longer relevant
   */
  async cleanupOldPatterns(maxAgeInDays: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - maxAgeInDays * 24 * 60 * 60 * 1000)
    
const result = await this.prisma.recommendation_patterns.deleteMany({
      where: {
        AND: [
          { updatedAt: { lt: cutoffDate } },
          { frequency: { lt: 3 } } // Only delete infrequent old patterns
        ]
      }
    })

    return result.count
  }
}

// Export utility functions for use elsewhere
export const patternUtils = {
  /**
   * Calculate Jaccard similarity between two service arrays
   */
  jaccardSimilarity(set1: number[], set2: number[]): number {
    const intersection = set1.filter(id => set2.includes(id))
    const union = [...new Set([...set1, ...set2])]
    return intersection.length / union.length
  },

  /**
   * Find common services across multiple patterns
   */
  findCommonServices(patterns: RecommendationPattern[]): number[] {
    if (patterns.length === 0) return []
    
    const serviceCounts = new Map<number, number>()
    
    patterns.forEach(pattern => {
      pattern.serviceIds.forEach(serviceId => {
        serviceCounts.set(serviceId, (serviceCounts.get(serviceId) || 0) + 1)
      })
    })

    // Return services that appear in at least half of the patterns
    const threshold = Math.ceil(patterns.length / 2)
    return Array.from(serviceCounts.entries())
      .filter(([, count]) => count >= threshold)
      .map(([serviceId]) => serviceId)
  },

  /**
   * Score pattern relevance for a given stack
   */
  scorePatternRelevance(
    pattern: RecommendationPattern, 
    currentServices: number[]
  ): number {
    const similarity = this.jaccardSimilarity(pattern.serviceIds, currentServices)
    const qualityScore = pattern.successRate * Math.log(pattern.frequency + 1) / 10
    return similarity * 0.7 + qualityScore * 0.3
  }
}