// Types for the Use Case Template System

export interface UseCaseTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  difficulty: TemplateDifficulty
  estimatedSetupTime: string
  serviceIds: number[]
  version: string
  isActive: boolean
  featured: boolean
  usageCount: number
  metadata?: TemplateMetadata
  createdAt: Date
  updatedAt: Date
  createdBy?: string
  
  // Relations
  services?: ServiceWithDetails[]
  usage?: TemplateUsage[]
  ratings?: TemplateRating[]
  versions?: TemplateVersion[]
}

export type TemplateCategory = 
  | 'media'           // Media servers, streaming, entertainment
  | 'development'     // Development environments, tools
  | 'business'        // Business applications, productivity
  | 'monitoring'      // Monitoring, logging, observability
  | 'security'        // Security tools, VPN, authentication
  | 'networking'      // Network tools, DNS, proxy
  | 'productivity'    // Personal productivity tools
  | 'communication'   // Chat, email, collaboration
  | 'storage'         // File storage, backup, sync
  | 'mixed'           // Multi-purpose or uncategorized

export type TemplateDifficulty =
  | 'beginner'        // 1-3 services, minimal configuration
  | 'intermediate'    // 4-8 services, moderate configuration
  | 'advanced'        // 9+ services, complex setup

export interface TemplateMetadata {
  // Resource requirements
  requiredResources?: {
    ram?: string
    storage?: string
    cpu?: string
    network?: string
  }
  
  // Categorization and search
  tags?: string[]
  keywords?: string[]
  
  // Setup information
  prerequisites?: string[]
  postSetupSteps?: string[]
  configurationNotes?: string[]
  
  // Documentation links
  documentationUrl?: string
  tutorialUrl?: string
  videoUrl?: string
  
  // Visual presentation
  iconUrl?: string
  screenshotUrls?: string[]
  
  // Compatibility information
  compatiblePlatforms?: ('linux' | 'windows' | 'macos')[]
  minimumDockerVersion?: string
  networkRequirements?: {
    ports?: number[]
    domainRequired?: boolean
    sslRequired?: boolean
  }
  
  // Community information
  authorName?: string
  authorUrl?: string
  licenseType?: string
  sourceUrl?: string
  
  // Fork lineage
  forkedFrom?: string
  forkedFromVersion?: string
  forkDate?: string

  // Maintenance information
  lastTested?: Date
  supportStatus?: 'active' | 'maintenance' | 'deprecated'
  knownIssues?: string[]
  changelog?: string[]
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

export interface TemplateUsage {
  id: string
  templateId: string
  stackId: string
  userId?: string
  servicesAdded: number
  successful?: boolean
  feedback?: string
  createdAt: Date
}

export interface TemplateRating {
  id: string
  templateId: string
  userId: string
  rating: number // 1-5 stars
  comment?: string
  helpful: number
  createdAt: Date
  updatedAt: Date
}

export interface TemplateVersion {
  id: string
  templateId: string
  version: string
  changes: VersionChanges
  serviceIds: number[]
  metadata?: TemplateMetadata
  createdAt: Date
  createdBy?: string
}

export interface VersionChanges {
  type: 'major' | 'minor' | 'patch'
  summary: string
  servicesAdded?: number[]
  servicesRemoved?: number[]
  servicesModified?: number[]
  configurationChanges?: string[]
  metadataUpdates?: string[]
  breakingChanges?: string[]
  bugFixes?: string[]
  improvements?: string[]
}

// Input types for API operations

export interface CreateTemplateInput {
  id?: string // Auto-generated if not provided
  name: string
  description: string
  category: TemplateCategory
  difficulty: TemplateDifficulty
  estimatedSetupTime: string
  serviceIds: number[]
  metadata?: TemplateMetadata
  createdBy?: string
  featured?: boolean
}

export interface UpdateTemplateInput {
  name?: string
  description?: string
  category?: TemplateCategory
  difficulty?: TemplateDifficulty
  estimatedSetupTime?: string
  serviceIds?: number[]
  metadata?: TemplateMetadata
  featured?: boolean
  isActive?: boolean
  breakingChange?: boolean // Forces major version increment
}

export interface TemplateFilters {
  category?: TemplateCategory
  difficulty?: TemplateDifficulty
  featured?: boolean
  includeInactive?: boolean
  minRating?: number
  maxRating?: number
  minUsageCount?: number
  tags?: string[]
  createdBy?: string
  dateRange?: {
    from: Date
    to: Date
  }
}

export interface TemplateSearchOptions {
  query?: string
  category?: TemplateCategory
  difficulty?: TemplateDifficulty
  limit?: number
  offset?: number
  sortBy?: 'popularity' | 'rating' | 'newest' | 'name' | 'usage'
  sortOrder?: 'asc' | 'desc'
}

export interface ApplyTemplateResult {
  success: boolean
  error?: string
  servicesAdded: number
  services?: ServiceWithDetails[]
  templateId?: string
  stackId?: string
  conflicts?: ServiceConflict[]
}

export interface ServiceConflict {
  serviceId: number
  serviceName: string
  reason: 'duplicate' | 'incompatible' | 'resource_conflict'
  details: string
}

export interface TemplateStats {
  templateId: string
  usageCount: number
  averageRating: number
  ratingCount: number
  successfulDeployments?: number
  failedDeployments?: number
  lastUsed?: Date
  popularityTrend?: 'rising' | 'stable' | 'declining'
}

export interface TemplateValidationResult {
  isValid: boolean
  errors: string[]
  warnings?: string[]
  suggestions?: string[]
}

export interface RateTemplateInput {
  templateId: string
  userId: string
  rating: number // 1-5
  comment?: string
}

export interface TemplateRecommendation {
  template: UseCaseTemplate
  score: number
  reason: string
  matchingTags: string[]
}

// Template creation wizard types

export interface TemplateWizardStep {
  id: string
  title: string
  description: string
  component: 'BasicInfo' | 'ServiceSelection' | 'Configuration' | 'Metadata' | 'Review'
  required: boolean
  completed: boolean
}

export interface TemplateWizardData {
  currentStep: number
  steps: TemplateWizardStep[]
  templateData: Partial<CreateTemplateInput>
  selectedServices: ServiceWithDetails[]
  validationResults: TemplateValidationResult
}

// Template gallery and presentation types

export interface TemplateGalleryItem {
  template: UseCaseTemplate
  stats: TemplateStats
  previewServices: ServiceWithDetails[] // First 3-4 services for preview
  isRecommended?: boolean
  recommendationReason?: string
}

export interface TemplateDetailView {
  template: UseCaseTemplate
  services: ServiceWithDetails[]
  stats: TemplateStats
  recentRatings: TemplateRating[]
  versions: TemplateVersion[]
  relatedTemplates: UseCaseTemplate[]
  isBookmarked?: boolean
}

// Error handling

export class TemplateError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message)
    this.name = 'TemplateError'
  }
}

export class TemplateNotFoundError extends TemplateError {
  constructor(id: string) {
    super(`Template with id ${id} not found`, 'TEMPLATE_NOT_FOUND', { id })
  }
}

export class TemplateValidationError extends TemplateError {
  constructor(errors: string[]) {
    super(`Template validation failed: ${errors.join(', ')}`, 'TEMPLATE_VALIDATION_ERROR', { errors })
  }
}

export class TemplateVersionError extends TemplateError {
  constructor(message: string) {
    super(message, 'TEMPLATE_VERSION_ERROR')
  }
}

// Utility types

export type TemplateWithStats = UseCaseTemplate & {
  stats: TemplateStats
}

export type PopularTemplate = UseCaseTemplate & {
  usageRank: number
  trendingScore: number
}

export type FeaturedTemplate = UseCaseTemplate & {
  featuredReason: string
  featuredUntil?: Date
}

// Template migration types for version updates

export interface TemplateMigration {
  fromVersion: string
  toVersion: string
  steps: MigrationStep[]
  automatic: boolean // Whether migration can be applied automatically
}

export interface MigrationStep {
  type: 'add_service' | 'remove_service' | 'update_service' | 'update_metadata'
  description: string
  serviceId?: number
  changes?: Record<string, any>
  required: boolean
}

// Community and sharing types

export interface CommunityTemplate extends UseCaseTemplate {
  isOfficial: boolean
  verifiedBy?: string
  communityScore: number
  forkCount: number
  originalTemplate?: string
  contributors: string[]
}

export interface TemplateCollection {
  id: string
  name: string
  description: string
  templates: UseCaseTemplate[]
  createdBy: string
  isPublic: boolean
  tags: string[]
  createdAt: Date
  updatedAt: Date
}