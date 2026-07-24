// Types for the AI-Powered Recommendation System

export interface Recommendation {
  id: string
  serviceId: number
  targetStackId?: string
  userId?: string
  score: number // 0.0 to 1.0
  rationale: string
  category: RecommendationCategory
  algorithmVersion: string
  metadata?: RecommendationMetadata
  viewCount: number
  adoptionCount: number
  createdAt: Date
  updatedAt: Date
  expiresAt?: Date
  
  // Relations
  service?: ServiceWithDetails
  feedback?: RecommendationFeedback[]
}

export type RecommendationCategory = 
  | 'complementary'  // Services that work well with existing stack
  | 'essential'      // Must-have services for the use case
  | 'popular'        // Community favorites
  | 'optional'       // Nice-to-have additions

export interface RecommendationMetadata {
  communityRating?: number
  deploymentCount?: number
  tags?: string[]
  compatibilityScore?: number
  setupComplexity?: 'simple' | 'moderate' | 'complex'
  estimatedSetupTime?: string
  resourceRequirements?: {
    cpu?: string
    memory?: string
    storage?: string
  }
}

export interface ServiceWithDetails {
  id: number
  name: string
  slug: string
  description: string
  dockerImage: string
  version: string
  categoryId: number
  ports: string
  environmentVariables: string
  resourceRequirements: string
  compatibilityInfo: string
  documentationUrl?: string
  featured: boolean
  status: string
  category?: {
    name: string
    slug: string
  }
}

export interface RecommendationPattern {
  id: string
  serviceIds: number[] // Array of service IDs that appear together
  frequency: number // How often this pattern occurs
  successRate: number // 0.0 to 1.0 deployment success rate
  category: string
  minStackSize: number
  maxStackSize: number
  metadata?: PatternMetadata
  createdAt: Date
  updatedAt: Date
}

export interface PatternMetadata {
  description?: string
  averageSetupTime?: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  requiredResources?: {
    ram: string
    storage: string
    cpu?: string
  }
  useCase?: string
  tags?: string[]
}

export interface RecommendationFeedback {
  id: string
  recommendationId: string
  userId?: string
  sessionId?: string
  rating?: number // 1-5 stars
  action: FeedbackAction
  comment?: string
  contextData?: FeedbackContext
  createdAt: Date
}

export type FeedbackAction = 
  | 'adopted'    // User added the service to their stack
  | 'rejected'   // User explicitly rejected the recommendation
  | 'dismissed'  // User dismissed without action
  | 'saved'      // User saved for later consideration

export interface FeedbackContext {
  stackSize?: number
  userExperience?: 'beginner' | 'intermediate' | 'expert'
  useCase?: string
  deploymentTarget?: 'home' | 'vps' | 'cloud'
}

// Input types for API calls

export interface GetRecommendationsInput {
  stackId?: string
  serviceIds?: number[]
  useCase?: string
  userId?: string
  limit?: number
  category?: RecommendationCategory
  minScore?: number
}

export interface RecommendationOptions {
  limit?: number
  category?: RecommendationCategory
  includeMetadata?: boolean
  userId?: string
}

export interface UseCaseTemplate {
  useCase: string
  name: string
  description: string
  services: ServiceWithDetails[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedSetupTime: string
  category: string
  requiredResources?: {
    ram: string
    storage: string
    network?: string
  }
  tags?: string[]
}

export interface StackService {
  serviceId: number
  service: ServiceWithDetails
  order?: number
}

export interface RecommendationSearchOptions {
  query?: string
  category?: string
  minFrequency?: number
  minSuccessRate?: number
  limit?: number
  offset?: number
}

export interface RecommendationEngineConfig {
  weightsConfig: {
    compatibilityWeight: number
    popularityWeight: number
    communityWeight: number
    categoryWeight: number
    freshnessWeight: number
  }
  thresholds: {
    minScore: number
    maxRecommendations: number
    cacheExpiryMinutes: number
  }
  features: {
    enableMLRecommendations: boolean
    enableCommunityPatterns: boolean
    enablePersonalization: boolean
  }
}

// Service compatibility and scoring

export interface CompatibilityMatrix {
  [serviceSlug: string]: {
    compatibleWith?: string[]
    incompatibleWith?: string[]
    enhancedBy?: string[]
    requires?: string[]
    categories?: string[]
    tags?: string[]
  }
}

export interface ScoringFactors {
  compatibility: number
  popularity: number
  community: number
  category: number
  freshness: number
}

// Error types

export class RecommendationError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message)
    this.name = 'RecommendationError'
  }
}

export class RecommendationNotFoundError extends RecommendationError {
  constructor(id: string) {
    super(`Recommendation with id ${id} not found`, 'RECOMMENDATION_NOT_FOUND', { id })
  }
}

export class InvalidScoreError extends RecommendationError {
  constructor(score: number) {
    super(`Invalid score ${score}. Score must be between 0 and 1`, 'INVALID_SCORE', { score })
  }
}

// Utility types

export type RecommendationWithService = Recommendation & {
  service: ServiceWithDetails
}

export type PopularPattern = RecommendationPattern & {
  services: ServiceWithDetails[]
  description?: string
}

export interface RecommendationStats {
  totalRecommendations: number
  avgScore: number
  categoryDistribution: Record<RecommendationCategory, number>
  adoptionRate: number
  topPerformingServices: ServiceWithDetails[]
}

export interface RecommendationCacheEntry {
  key: string
  recommendations: Recommendation[]
  timestamp: Date
  expiresAt: Date
  hitCount: number
}

// ML and Collaborative Filtering types

export interface RecommendationContext {
  userId?: string
  stackId?: string
  serviceIds?: number[]
  useCase?: string
  userPreferences?: Record<string, any>
  deploymentTarget?: 'home' | 'vps' | 'cloud'
  currentServices?: Array<{ id: string; name: string }>
  projectType?: string
}

export interface ServiceRecommendation {
  serviceId: number
  score: number
  rationale: string
  category: RecommendationCategory
  metadata?: RecommendationMetadata
}

export interface UserProfile {
  userId: string
  preferences?: Record<string, any>
  interactions?: InteractionData[]
  expertise?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  createdAt: Date
  updatedAt: Date
}

export interface InteractionData {
  id: string
  userId: string
  type: 'recommendation_clicked' | 'service_added' | 'service_removed' | 'stack_created' | 'stack_deployed'
  targetId?: string
  serviceId?: number
  stackId?: string
  metadata?: Record<string, any>
  timestamp: Date
}
