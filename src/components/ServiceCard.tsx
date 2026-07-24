import { useState, useMemo } from 'react'
import { Star, Shield, Zap } from 'lucide-react'
import { useServiceBrowserStore } from '@/store/service-browser'
import type { Service } from '@/types/service-browser'
import { ServiceCardSkeleton } from '@/components/ui/skeleton-shimmer'
import { useT } from '@/lib/i18n/client'
import './ServiceCard.css'

interface ServiceCardProps {
  service: Service
  loading?: boolean
  compact?: boolean
  className?: string
}

interface MetricsDisplayProps {
  metrics: Service['metrics']
  compact?: boolean
}

interface CompanyInfoProps {
  company: Service['company']
}

interface TagsDisplayProps {
  tags: string[]
  maxTags?: number
}

interface FeaturesDisplayProps {
  features: string[]
  maxFeatures?: number
}

const MetricsDisplay = ({ metrics, compact = false }: MetricsDisplayProps) => {
  const t = useT()
  if (!metrics) return null

  const displayMetrics = [
    {
      key: 'popularity',
      label: t('catalog.popularityRating'),
      value: metrics.popularity,
      format: (val: number) => val.toFixed(1),
      icon: Star
    },
    {
      key: 'reliability',
      label: t('catalog.reliabilityPercentage'),
      value: metrics.reliability,
      format: (val: number) => `${val}%`,
      icon: Shield
    },
    {
      key: 'performance',
      label: t('catalog.performanceRating'),
      value: metrics.performance,
      format: (val: number) => val.toFixed(1),
      icon: Zap
    }
  ].filter(metric => metric.value !== undefined && metric.value !== null)

  if (displayMetrics.length === 0) return null

  return (
    <div className={`metrics-display ${compact ? 'metrics-display--compact' : ''}`}>
      {displayMetrics.slice(0, compact ? 1 : 3).map(metric => (
        <div key={metric.key} className="metric-item">
          <metric.icon className="metric-icon h-3.5 w-3.5" aria-hidden="true" />
          <span
            className="metric-value"
            aria-label={`${metric.label}: ${metric.format(metric.value)}`}
          >
            {metric.format(metric.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

const CompanyInfo = ({ company }: CompanyInfoProps) => {
  const t = useT()
  if (!company?.name) return null

  const content = (
    <>
      <span className="company-name">{company.name}</span>
      {company.founded && (
        <span className="company-founded" aria-label={t('catalog.foundedIn', { year: company.founded })}>
          {t('catalog.estYear', { year: company.founded })}
        </span>
      )}
    </>
  )

  if (company.website) {
    return (
      <a
        href={company.website}
        target="_blank"
        rel="noopener noreferrer"
        className="company-info company-info--link"
        onClick={(e) => e.stopPropagation()} // Prevent card click
      >
        {content}
      </a>
    )
  }

  return <div className="company-info">{content}</div>
}

const TagsDisplay = ({ tags, maxTags = 3 }: TagsDisplayProps) => {
  const t = useT()
  if (!tags || tags.length === 0) return null

  const visibleTags = tags.slice(0, maxTags)
  const remainingCount = Math.max(0, tags.length - maxTags)

  return (
    <div className="tags-display">
      {visibleTags.map(tag => (
        <span key={tag} className="tag">
          {tag}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="tag tag--more">{t('catalog.moreCount', { count: remainingCount })}</span>
      )}
    </div>
  )
}

const FeaturesDisplay = ({ features, maxFeatures = 2 }: FeaturesDisplayProps) => {
  const t = useT()
  if (!features || features.length === 0) return null

  const visibleFeatures = features.slice(0, maxFeatures)
  const remainingCount = Math.max(0, features.length - maxFeatures)

  return (
    <div className="features-display">
      {visibleFeatures.map(feature => (
        <span key={feature} className="feature">
          {feature}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="feature feature--more">{t('catalog.moreCount', { count: remainingCount })}</span>
      )}
    </div>
  )
}

export const ServiceCard = ({ service, loading = false, compact = false, className }: ServiceCardProps) => {
  const t = useT()
  const [isHovered, setIsHovered] = useState(false)
  const { openServiceModal, modalState } = useServiceBrowserStore()

  // Task 2.5: Enhanced skeleton with shimmer
  if (loading) {
    return <ServiceCardSkeleton data-testid="service-card-skeleton" />
  }

  // Early return if service is not provided or invalid
  if (!service || !service.id || !service.name) {
    return null
  }

  const isSelected = modalState?.service?.id === service.id

  const cardClasses = useMemo(() => {
    const classes = ['service-card']

    if (compact) classes.push('service-card--compact')
    if (isSelected) classes.push('service-card--selected')
    if (isHovered) classes.push('service-card--hover')
    if (className) classes.push(className)

    return classes.join(' ')
  }, [compact, isSelected, isHovered, className])

  const handleCardClick = () => {
    // Open the service preview modal
    openServiceModal(service)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleCardClick()
    }
  }

  const integrationCount = service.integrations?.length || 0

  return (
    <button
      type="button"
      // Task 2.6: Container queries for true component-level responsiveness
      className={`${cardClasses} container-inline`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={t('catalog.viewServiceDetailsAria', { name: service.name })}
      data-testid="service-card"
      tabIndex={0}
    >
      <div className="service-card__header">
        <div className="service-card__title-section">
          {/* Task 2.6: Typography scales with container width, not viewport */}
          <h3
            className="service-card__title @container(min-width: 300px):text-fluid-lg"
            data-testid="service-name"
          >
            {service.name}
          </h3>
          <div className="service-card__category">
            <span className="category-primary" data-testid="service-category">{service.category}</span>
            {service.subcategory && (
              <span className="category-secondary">{service.subcategory}</span>
            )}
          </div>
        </div>
        <div className="service-card__pricing">
        </div>
      </div>

      <div className="service-card__content">
        {service.description && (
          <p
            className="service-card__description line-clamp-2 @container(min-width: 300px):line-clamp-3 @container(min-width: 400px):line-clamp-4"
          >
            {compact
              ? service.description.slice(0, 100) + (service.description.length > 100 ? '...' : '')
              : service.description
            }
          </p>
        )}

        {/* Task 2.6: Show tags based on container width */}
        <div className="@container(min-width: 280px):block hidden">
          <TagsDisplay tags={service.tags} maxTags={compact ? 2 : 3} />
        </div>

        {/* Task 2.6: Features only visible in wider containers */}
        {!compact && (
          <div className="@container(min-width: 350px):block hidden">
            <FeaturesDisplay features={service.features} maxFeatures={2} />
          </div>
        )}

        {/* Task 2.6: Metrics adapt to container space */}
        <div className="@container(min-width: 280px):block hidden">
          <MetricsDisplay metrics={service.metrics} compact={compact} />
        </div>
      </div>

      <div className="service-card__footer">
        <CompanyInfo company={service.company} />

        {/* Task 2.6: Integration count only in wider containers */}
        {integrationCount > 0 && (
          <div className="integrations-info @container(min-width: 300px):block hidden">
            <span className="integrations-count">
              {integrationCount === 1
                ? t('catalog.integrationCountOne', { count: integrationCount })
                : t('catalog.integrationsCount', { count: integrationCount })}
            </span>
          </div>
        )}
      </div>
    </button>
  )
}
