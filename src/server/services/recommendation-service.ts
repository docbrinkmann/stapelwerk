// @ts-nocheck
import { PrismaClient } from '@prisma/client'
import type { 
  Recommendation, 
  RecommendationOptions,
  RecommendationPattern,
  RecommendationFeedback,
  StackService,
  ServiceWithDetails,
  UseCaseTemplate,
  RecommendationEngineConfig,
  CompatibilityMatrix,
  ScoringFactors,
  FeedbackAction,
  RecommendationCategory,
  RecommendationSearchOptions,
  PopularPattern
} from '@/types/recommendations'
import { COMPATIBILITY_MATRIX as SHARED_COMPATIBILITY_MATRIX } from '@/lib/recommendations/compatibility-matrix'

export class RecommendationService {
  private prisma: PrismaClient
  private config: RecommendationEngineConfig

  // Default scoring weights
  private readonly DEFAULT_CONFIG: RecommendationEngineConfig = {
    weightsConfig: {
      compatibilityWeight: 0.4,    // Most important factor
      popularityWeight: 0.25,      // Community usage
      communityWeight: 0.2,        // Success patterns
      categoryWeight: 0.1,         // Category relevance
      freshnessWeight: 0.05        // Recent additions
    },
    thresholds: {
      minScore: 0.3,               // Minimum recommendation score
      maxRecommendations: 10,      // Max recommendations per request
      cacheExpiryMinutes: 60       // Cache expiry time
    },
    features: {
      enableMLRecommendations: false,    // Disable ML for initial version
      enableCommunityPatterns: true,     // Use community patterns
      enablePersonalization: false      // No user-specific learning yet
    }
  }

  // Service compatibility matrix for rule-based recommendations.
  // Shared with the client stack builder — see
  // src/lib/recommendations/compatibility-matrix.ts (single source of truth).
  private readonly COMPATIBILITY_MATRIX: CompatibilityMatrix = SHARED_COMPATIBILITY_MATRIX

  constructor(prisma: PrismaClient, config?: Partial<RecommendationEngineConfig>) {
    this.prisma = prisma
    this.config = { ...this.DEFAULT_CONFIG, ...config }
  }

  /**
   * Get contextual recommendations for a stack based on current services
   */
  async getRecommendationsForStack(
    stackServices: StackService[], 
    options: RecommendationOptions = {}
  ): Promise<Recommendation[]> {
    const { limit = 5, category, includeMetadata = true, userId } = options
    
    // Get all available services
    const availableServices = await this.prisma.service.findMany({
      where: {
        status: 'approved',
        ...(category && { 
          category: { 
            slug: { 
              in: this.getCategoryFilters(category) 
            } 
          } 
        })
      },
      include: {
        category: true
      }
    })

    // Filter out services already in stack
    const currentServiceIds = stackServices.map(s => s.serviceId)
    const candidateServices = availableServices.filter(
      service => !currentServiceIds.includes(service.id)
    )

    // Generate recommendations with scoring
    const recommendations = await Promise.all(
      candidateServices.map(async (service) => {
        const score = await this.calculateRecommendationScore(service, stackServices)
        
        if (score < this.config.thresholds.minScore) {
          return null
        }

        const rationale = this.generateRationale(service, stackServices, score)
        const recCategory = this.determineRecommendationCategory(service, stackServices, score)

        return {
          id: `rec-${Date.now()}-${service.id}`,
          serviceId: service.id,
          score,
          rationale,
          category: recCategory,
          algorithmVersion: '1.0',
          viewCount: 0,
          adoptionCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId,
          service: includeMetadata ? service : undefined
        } as Recommendation
      })
    )

    // Filter out null recommendations and sort by score
    const validRecommendations = recommendations
      .filter((rec): rec is Recommendation => rec !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(limit, this.config.thresholds.maxRecommendations))

    return validRecommendations
  }

  /**
   * Calculate compatibility score between a service and existing stack
   */
  calculateCompatibilityScore(service: ServiceWithDetails, stackServices: StackService[]): number {
    const serviceSlug = service.slug
    const compatibility = this.COMPATIBILITY_MATRIX[serviceSlug]

    // Bidirectional lookup: a matrix entry on the candidate OR on an existing
    // stack service counts (companion tools like pgadmin have no entry of
    // their own but are listed by the services they complement)
    const referencedByStack = stackServices.some(s => {
      const reverse = this.COMPATIBILITY_MATRIX[s.service.slug]
      return reverse?.compatibleWith?.includes(serviceSlug) ||
        reverse?.enhancedBy?.includes(serviceSlug) ||
        reverse?.incompatibleWith?.includes(serviceSlug)
    })

    if (!compatibility && !referencedByStack) {
      return 0.1 // Low score for unknown services
    }

    let compatibilityScore = 0
    let totalChecks = 0

    // Check compatibility with each service in stack (either direction counts once)
    for (const stackService of stackServices) {
      const stackServiceSlug = stackService.service.slug
      const reverse = this.COMPATIBILITY_MATRIX[stackServiceSlug]
      totalChecks++

      // Direct compatibility
      if (compatibility?.compatibleWith?.includes(stackServiceSlug) ||
          reverse?.compatibleWith?.includes(serviceSlug)) {
        compatibilityScore += 1.0
      }
      // Enhanced by relationship (even better)
      else if (compatibility?.enhancedBy?.includes(stackServiceSlug) ||
               reverse?.enhancedBy?.includes(serviceSlug)) {
        compatibilityScore += 1.2
      }
      // Incompatible (negative score)
      else if (compatibility?.incompatibleWith?.includes(stackServiceSlug) ||
               reverse?.incompatibleWith?.includes(serviceSlug)) {
        compatibilityScore -= 0.5
      }
      // Same category services (moderate compatibility)
      else if (this.sharesCategoryOrTags(service, stackService.service)) {
        compatibilityScore += 0.3
      }
      // No relationship
      else {
        compatibilityScore += 0.1
      }
    }

    return totalChecks > 0 ? Math.max(0, compatibilityScore / totalChecks) : 0.5
  }

  /**
   * Calculate overall recommendation score using multiple factors
   */
  private async calculateRecommendationScore(
    service: ServiceWithDetails, 
    stackServices: StackService[]
  ): Promise<number> {
    const factors: ScoringFactors = {
      compatibility: this.calculateCompatibilityScore(service, stackServices),
      popularity: await this.calculatePopularityScore(service),
      community: await this.calculateCommunityScore(service, stackServices),
      category: this.calculateCategoryScore(service, stackServices),
      freshness: this.calculateFreshnessScore(service)
    }

    // Weighted average
    const score = 
      factors.compatibility * this.config.weightsConfig.compatibilityWeight +
      factors.popularity * this.config.weightsConfig.popularityWeight +
      factors.community * this.config.weightsConfig.communityWeight +
      factors.category * this.config.weightsConfig.categoryWeight +
      factors.freshness * this.config.weightsConfig.freshnessWeight

    return Math.min(1.0, Math.max(0.0, score))
  }

  /**
   * Calculate popularity score based on usage metrics
   */
  private async calculatePopularityScore(service: ServiceWithDetails): Promise<number> {
    // Count how many stacks use this service
    const usageCount = await this.prisma.stackService.count({
      where: { serviceId: service.id }
    })

    // Normalize based on total stacks (assuming max 1000 for scaling)
    const normalizedUsage = Math.min(usageCount / 100, 1.0)
    
    // Featured services get a boost
    const featuredBoost = service.featured ? 0.2 : 0
    
    return Math.min(1.0, normalizedUsage + featuredBoost)
  }

  /**
   * Calculate community pattern score
   */
  private async calculateCommunityScore(
    service: ServiceWithDetails, 
    stackServices: StackService[]
  ): Promise<number> {
    if (!this.config.features.enableCommunityPatterns || stackServices.length === 0) {
      return 0.5
    }

    const currentServiceIds = stackServices.map(s => s.serviceId)
    
    // Find patterns that include both current services and the candidate service
    const patterns = await this.prisma.recommendationPattern.findMany({
      where: {
        OR: currentServiceIds.map(id => ({
          serviceIds: { contains: String(id) }
        }))
      }
    })

    let bestPatternScore = 0
    
    for (const pattern of patterns) {
      const patternServiceIds = JSON.parse(pattern.serviceIds) as number[]
      
      // Check if this service is part of the pattern
      if (patternServiceIds.includes(service.id)) {
        const matchScore = this.calculatePatternMatchScore(currentServiceIds, patternServiceIds)
        const qualityScore = pattern.successRate * (pattern.frequency / 100)
        bestPatternScore = Math.max(bestPatternScore, matchScore * qualityScore)
      }
    }

    return bestPatternScore
  }

  /**
   * Calculate category relevance score
   */
  private calculateCategoryScore(service: ServiceWithDetails, stackServices: StackService[]): number {
    if (stackServices.length === 0) return 0.5

    const serviceCategoryId = service.categoryId
    const stackCategoryIds = stackServices.map(s => s.service.categoryId)
    
    // Higher score if same category as existing services
    const sameCategoryCount = stackCategoryIds.filter(id => id === serviceCategoryId).length
    const sameCategoryScore = sameCategoryCount / stackServices.length

    // Moderate score for complementary categories
    const complementaryScore = this.getComplementaryScore(service, stackServices)
    
    return Math.max(sameCategoryScore, complementaryScore)
  }

  /**
   * Calculate freshness score (newer services get slight boost)
   */
  private calculateFreshnessScore(service: ServiceWithDetails): number {
    const daysSinceCreated = (Date.now() - new Date(service.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    
    // Services added in last 30 days get freshness boost
    if (daysSinceCreated <= 30) {
      return 1.0 - (daysSinceCreated / 30) * 0.3 // 0.7 to 1.0 range
    }
    
    return 0.5 // Neutral score for older services
  }

  /**
   * Generate human-readable rationale for recommendation
   */
  private generateRationale(
    service: ServiceWithDetails, 
    stackServices: StackService[], 
    score: number
  ): string {
    const compatibility = this.COMPATIBILITY_MATRIX[service.slug]
    
    if (!compatibility || stackServices.length === 0) {
      return `${service.name} is a popular ${service.category?.name || 'service'} that could enhance your stack.`
    }

    const compatibleServices = stackServices
      .filter(s => compatibility.compatibleWith?.includes(s.service.slug))
      .map(s => s.service.name)
    
    const enhancedByServices = stackServices
      .filter(s => compatibility.enhancedBy?.includes(s.service.slug))
      .map(s => s.service.name)

    if (enhancedByServices.length > 0) {
      return `${service.name} works exceptionally well with ${enhancedByServices.join(' and ')}, providing enhanced functionality for your ${enhancedByServices[0]} setup.`
    }
    
    if (compatibleServices.length > 0) {
      return `${service.name} is highly compatible with ${compatibleServices.join(' and ')}, making it a great addition to your stack.`
    }

    if (score > 0.7) {
      return `${service.name} is a highly recommended ${service.category?.name || 'service'} that's popular in the community.`
    }

    return `${service.name} could be a useful addition to complement your existing services.`
  }

  /**
   * Determine recommendation category based on service and score
   */
  private determineRecommendationCategory(
    service: ServiceWithDetails, 
    stackServices: StackService[], 
    score: number
  ): RecommendationCategory {
    const compatibility = this.COMPATIBILITY_MATRIX[service.slug]
    
    // Essential for high compatibility scores
    if (score >= 0.8) {
      return 'essential'
    }
    
    // Complementary if directly compatible
    if (compatibility && stackServices.some(s => 
      compatibility.compatibleWith?.includes(s.service.slug) || 
      compatibility.enhancedBy?.includes(s.service.slug)
    )) {
      return 'complementary'
    }
    
    // Popular if featured or high usage
    if (service.featured || score >= 0.6) {
      return 'popular'
    }
    
    return 'optional'
  }

  /**
   * Get use case specific recommendations
   */
  async getUseCaseRecommendations(useCase: string): Promise<UseCaseTemplate> {
    const templates: Record<string, Omit<UseCaseTemplate, 'services'> & { serviceIds: number[] }> = {
      'media-server': {
        useCase: 'media-server',
        name: 'Media Server Stack',
        description: 'Complete setup for home media streaming with management tools',
        serviceIds: [5, 6, 7], // Plex, Tautulli, Overseerr
        difficulty: 'intermediate',
        estimatedSetupTime: '45 minutes',
        category: 'media',
        requiredResources: { ram: '4GB', storage: '1TB' },
        tags: ['media', 'streaming', 'entertainment']
      },
      'web-development': {
        useCase: 'web-development',
        name: 'Web Development Stack',
        description: 'Full-stack development environment with database and caching',
        serviceIds: [1, 2, 4], // PostgreSQL, Redis, Nginx
        difficulty: 'intermediate',
        estimatedSetupTime: '30 minutes',
        category: 'development',
        requiredResources: { ram: '2GB', storage: '20GB' },
        tags: ['development', 'web', 'database']
      },
      'monitoring': {
        useCase: 'monitoring',
        name: 'Monitoring & Observability Stack',
        description: 'Complete monitoring solution with metrics and dashboards',
        serviceIds: [8, 9, 10], // Prometheus, Grafana, Loki
        difficulty: 'advanced',
        estimatedSetupTime: '60 minutes',
        category: 'monitoring',
        requiredResources: { ram: '3GB', storage: '50GB' },
        tags: ['monitoring', 'metrics', 'observability']
      }
    }

    const template = templates[useCase]
    
    if (!template) {
      return {
        useCase,
        name: 'Unknown Use Case',
        description: 'No recommendations available for this use case',
        services: [],
        difficulty: 'beginner',
        estimatedSetupTime: '0 minutes',
        category: 'unknown'
      }
    }

    // Fetch services for this template
    const services = await this.prisma.service.findMany({
      where: {
        id: { in: template.serviceIds },
        status: 'approved'
      },
      include: { category: true }
    })

    return {
      ...template,
      services
    } as UseCaseTemplate
  }

  /**
   * Record user feedback for learning
   */
  async recordFeedback(feedback: {
    recommendationId: string
    userId?: string
    sessionId?: string
    rating?: number
    action: FeedbackAction
    comment?: string
  }): Promise<RecommendationFeedback> {
    return await this.prisma.recommendationFeedback.create({
      data: {
        ...feedback,
        contextData: '{}' // Could include stack context, user experience level, etc.
      }
    })
  }

  /**
   * Analyze community patterns for machine learning
   */
  async analyzePatterns(stackData: Array<{ services: number[], deploymentSuccess?: boolean }>): Promise<RecommendationPattern[]> {
    const patternFrequency = new Map<string, { count: number, successes: number }>()
    
    // Analyze service combinations
    for (const stack of stackData) {
      if (stack.services.length < 2) continue
      
      // Generate all possible pairs and larger combinations
      for (let size = 2; size <= Math.min(stack.services.length, 4); size++) {
        const combinations = this.generateCombinations(stack.services, size)
        
        for (const combination of combinations) {
          const key = combination.sort((a, b) => a - b).join(',')
          const current = patternFrequency.get(key) || { count: 0, successes: 0 }
          
          patternFrequency.set(key, {
            count: current.count + 1,
            successes: current.successes + (stack.deploymentSuccess !== false ? 1 : 0)
          })
        }
      }
    }

    // Convert to RecommendationPattern format
    const patterns: RecommendationPattern[] = []
    
    for (const [serviceIds, stats] of patternFrequency) {
      if (stats.count < 3) continue // Minimum frequency threshold
      
      const services = serviceIds.split(',').map(Number)
      const successRate = stats.successes / stats.count
      
      patterns.push({
        id: `pattern-${Date.now()}-${serviceIds.replace(/,/g, '-')}`,
        serviceIds: services,
        frequency: stats.count,
        successRate,
        category: 'auto-detected',
        minStackSize: services.length,
        maxStackSize: services.length + 3,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }

    return patterns.sort((a, b) => b.frequency - a.frequency)
  }

  // Helper methods

  private getCategoryFilters(category: string): string[] {
    const categoryMap: Record<string, string[]> = {
      'complementary': ['admin', 'management', 'monitoring'],
      'essential': ['database', 'cache', 'web'],
      'popular': ['featured', 'trending'],
      'optional': ['utilities', 'extras']
    }
    
    return categoryMap[category] || [category]
  }

  private sharesCategoryOrTags(service1: ServiceWithDetails, service2: ServiceWithDetails): boolean {
    // Check if services share category
    if (service1.categoryId === service2.categoryId) return true
    
    // Check compatibility info for shared tags
    try {
      const info1 = JSON.parse(service1.compatibilityInfo || '{}')
      const info2 = JSON.parse(service2.compatibilityInfo || '{}')
      
      const tags1 = info1.tags || []
      const tags2 = info2.tags || []
      
      return tags1.some((tag: string) => tags2.includes(tag))
    } catch {
      return false
    }
  }

  private calculatePatternMatchScore(currentServices: number[], patternServices: number[]): number {
    const intersection = currentServices.filter(id => patternServices.includes(id))
    const union = [...new Set([...currentServices, ...patternServices])]
    
    return intersection.length / union.length // Jaccard similarity
  }

  private getComplementaryScore(service: ServiceWithDetails, stackServices: StackService[]): number {
    // Implement logic to determine complementary categories
    // For example: monitoring services complement web services
    const complementaryPairs = [
      ['database', 'admin'],
      ['web', 'monitoring'], 
      ['cache', 'database'],
      ['media', 'management']
    ]
    
    const serviceCategory = service.category?.slug
    if (!serviceCategory) return 0.3
    
    for (const stackService of stackServices) {
      const stackCategory = stackService.service.category?.slug
      if (!stackCategory) continue
      
      for (const [cat1, cat2] of complementaryPairs) {
        if ((serviceCategory === cat1 && stackCategory === cat2) ||
            (serviceCategory === cat2 && stackCategory === cat1)) {
          return 0.7
        }
      }
    }
    
    return 0.3
  }

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
}