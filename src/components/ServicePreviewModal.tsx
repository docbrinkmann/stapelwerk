import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { Star, Shield, Zap } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useServiceBrowserStore } from '@/store/service-browser'
import { useStackServices } from '@/stores/stack-builder'
import type { Service } from '@/types/service-browser'
import type { Service as CatalogService } from '@/types/service'
import './ServicePreviewModal.css'

interface ServicePreviewModalProps {
  className?: string
}

interface ServiceInfoSectionProps {
  service: Service
}

interface ServiceMetricsProps {
  metrics: Service['metrics']
}

interface ServiceActionsProps {
  service: Service
  onClose: () => void
}

const ServiceMetrics = ({ metrics }: ServiceMetricsProps) => (
  <div className="service-metrics">
    <div className="metrics-grid">
      {metrics.popularity && (
        <div className="metric-item">
          <Star className="metric-icon h-4 w-4" aria-hidden="true" />
          <span className="metric-label">Popularity</span>
          <span 
            className="metric-value" 
            aria-label={`Popularity rating: ${metrics.popularity}`}
          >
            {metrics.popularity}
          </span>
        </div>
      )}
      {metrics.reliability && (
        <div className="metric-item">
          <Shield className="metric-icon h-4 w-4" aria-hidden="true" />
          <span className="metric-label">Reliability</span>
          <span 
            className="metric-value"
            aria-label={`Reliability rating: ${metrics.reliability}`}
          >
            {metrics.reliability}
          </span>
        </div>
      )}
      {metrics.performance && (
        <div className="metric-item">
          <Zap className="metric-icon h-4 w-4" aria-hidden="true" />
          <span className="metric-label">Performance</span>
          <span 
            className="metric-value"
            aria-label={`Performance rating: ${metrics.performance}`}
          >
            {metrics.performance}
          </span>
        </div>
      )}
    </div>
  </div>
)

const ServiceInfoSection = ({ service }: ServiceInfoSectionProps) => {
  return (
    <div className="service-info-section" data-testid="service-info-section">
      {/* Basic Information */}
      <div className="service-header">
        <div className="service-title-group">
          <h2 
            id="modal-title" 
            className="service-title"
            data-testid="modal-service-name"
          >
            {service.name}
          </h2>
          <div className="service-categories">
            <span 
              className="category-primary"
              data-testid="service-category"
            >
              {service.category}
            </span>
            {service.subcategory && (
              <span className="category-secondary">{service.subcategory}</span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="service-description">
        <p 
          id="modal-description"
          data-testid="modal-service-description"
        >
          {service.description}
        </p>
      </div>

      {/* Tags */}
      {service.tags && service.tags.length > 0 && (
        <div className="service-tags">
          <h3 className="section-title">Tags</h3>
          <div className="tags-list">
            {service.tags.map((tag, index) => (
              <span key={index} className="tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      {service.features && service.features.length > 0 && (
        <div className="service-features">
          <h3 className="section-title">Key Features</h3>
          <ul className="features-list">
            {service.features.map((feature, index) => (
              <li key={index} className="feature-item">
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Integrations */}
      {service.integrations && service.integrations.length > 0 && (
        <div className="service-integrations">
          <h3 className="section-title">Integrations</h3>
          <div className="integrations-list">
            {service.integrations.slice(0, 5).map((integration, index) => (
              <span key={index} className="integration-item">
                {integration}
              </span>
            ))}
            {service.integrations.length > 5 && (
              <span className="integration-count">
                +{service.integrations.length - 5} more
              </span>
            )}
          </div>
          <p className="integrations-summary">
            {service.integrations.length} integration{service.integrations.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Metrics */}
      {service.metrics && (
        <div className="service-metrics-section">
          <h3 className="section-title">Metrics</h3>
          <ServiceMetrics metrics={service.metrics} />
        </div>
      )}

      {/* Company Information */}
      {service.company && (
        <div className="service-company">
          <h3 className="section-title">Company</h3>
          <div className="company-info">
            <h4 className="company-name">{service.company.name}</h4>
            <div className="company-details">
              {service.company.founded && (
                <p>Founded: {service.company.founded}</p>
              )}
              {service.company.headquarters && (
                <p>Headquarters: {service.company.headquarters}</p>
              )}
            </div>
            {service.company.website && (
              <a
                href={service.company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="company-website-link"
                aria-label="Visit company website"
              >
                Visit Website
              </a>
            )}
          </div>
        </div>
      )}

      {/* Documentation */}
      {service.documentation && (
        <div className="service-documentation">
          <h3 className="section-title">Documentation</h3>
          <div className="documentation-links">
            <a
              href={service.documentation.quickStart}
              target="_blank"
              rel="noopener noreferrer"
              className="documentation-link"
            >
              Quick Start Guide
            </a>
            <a
              href={service.documentation.apiReference}
              target="_blank"
              rel="noopener noreferrer"
              className="documentation-link"
            >
              API Reference
            </a>
            {service.documentation.examples && service.documentation.examples.length > 0 && (
              <div className="examples-section">
                <h4>Examples</h4>
                <ul>
                  {service.documentation.examples.map((example, index) => (
                    <li key={index}>{example}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const ServiceActions = ({ service, onClose }: ServiceActionsProps) => {
  const router = useRouter()
  // Add to the stack-builder store — the same store the builder canvas reads from
  const { services: stackServices, addService } = useStackServices()

  const isInStack = stackServices.some(s => String(s.serviceId) === String(service.id))

  const handleAddToStack = useCallback(() => {
    // Services from the catalog API carry the fields the stack builder needs
    addService(service as unknown as CatalogService)
  }, [addService, service])

  const handleViewDetails = useCallback(() => {
    router.push(`/services/${service.id}` as any)
    onClose()
  }, [router, service.id, onClose])

  return (
    <div className="service-actions" data-testid="service-actions">
      <div className="action-buttons">
        <button
          type="button"
          className={`action-button action-button--primary${isInStack ? ' action-button--success' : ''}`}
          onClick={handleAddToStack}
          disabled={isInStack}
          data-testid="modal-add-to-stack"
          aria-label={isInStack ? 'Added to stack successfully' : 'Add service to stack'}
        >
          {isInStack ? 'Added to Stack!' : 'Add to Stack'}
        </button>

        <a
          href={`/services/${service.id}`}
          className="action-button action-button--secondary"
          onClick={(e) => {
            e.preventDefault()
            handleViewDetails()
          }}
          aria-label="View full service details"
        >
          View Full Details
        </a>
      </div>
    </div>
  )
}

const LoadingState = () => (
  <div className="modal-loading" data-testid="modal-loading-spinner">
    <div className="loading-spinner" aria-hidden="true"></div>
    <p className="loading-text">Loading service details...</p>
  </div>
)

const ErrorState = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <div className="modal-error" role="alert">
    <h3 className="error-title">Error loading service</h3>
    <p className="error-message">{error}</p>
    <button
      type="button"
      className="action-button action-button--primary"
      onClick={onRetry}
      aria-label="Try loading service again"
    >
      Try Again
    </button>
  </div>
)

const EmptyState = () => (
  <div className="modal-empty">
    <p className="empty-message">No service data available</p>
  </div>
)

export const ServicePreviewModal = ({ className }: ServicePreviewModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )
  const [mounted, setMounted] = useState(false)
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null)
  
  const { 
    modalState, 
    closeServiceModal, 
    retryServiceLoad 
  } = useServiceBrowserStore()

  const { isOpen, service, isLoading, error } = modalState

  // Handle window resize for responsive classes
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Client-side mount check and portal root resolution to avoid hydration errors
  useEffect(() => {
    setMounted(true)
    if (typeof document !== 'undefined') {
      let root = document.getElementById('modal-root')
      if (!root) {
        // Create a fallback root for test environments
        root = document.createElement('div')
        root.id = 'modal-root'
        document.body.appendChild(root)
      }
      setPortalEl(root)
    }
  }, [])

  // Store previous focus element when modal opens
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
    }
  }, [isOpen])

  // Handle focus management and keyboard events
  useEffect(() => {
    if (!isOpen || !mounted) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeServiceModal()
      }
    }

    const handleFocusTrap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const modal = modalRef.current
      if (!modal) return

      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      
      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault()
        	  lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keydown', handleFocusTrap)

    // Focus first element in modal
    const firstFocusable = modalRef.current?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement | null
    
    firstFocusable?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keydown', handleFocusTrap)
    }
  }, [isOpen, mounted, closeServiceModal])

  // Restore focus when modal closes
  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }, [isOpen])

  // Handle backdrop click
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      closeServiceModal()
    }
  }, [closeServiceModal])

  // Generate responsive classes
  const modalClasses = useMemo(() => {
    const classes = ['service-preview-modal']
    
    // Responsive classes based on window width state
    if (windowWidth < 768) {
      classes.push('service-modal--mobile')
    } else if (windowWidth < 1024) {
      classes.push('service-modal--tablet')
    } else {
      classes.push('service-modal--desktop')
    }

    // Animation classes
    classes.push('animate-fade-in', 'animate-scale-up')
    
    if (className) classes.push(className)
    
    return classes.join(' ')
  }, [windowWidth, className])

  // Don't render anything if modal is not open or not mounted yet
  if (!isOpen || !mounted || !portalEl) {
    return null
  }

  const modalTree = (
    <div
      className="modal-overlay"
      data-testid="modal-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={modalClasses}
        data-testid="service-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        aria-label="Service preview modal"
      >
        <div 
          className="modal-content"
          data-testid="modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            type="button"
            className="modal-close-button"
            onClick={closeServiceModal}
            aria-label="Close modal"
          >
            <span aria-hidden="true">×</span>
          </button>

          {/* Modal Header */}
          <div className="modal-header">
            <h1 className="modal-title">Service Details</h1>
          </div>

          {/* Modal Body */}
          <div className="modal-body">
            {isLoading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState error={error} onRetry={retryServiceLoad} />
            ) : service ? (
              <>
                <ServiceInfoSection service={service} />
                <ServiceActions service={service} onClose={closeServiceModal} />
              </>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>

        {/* Screen reader announcements */}
        <div 
          role="status" 
          aria-live="polite" 
          className="sr-only"
          aria-hidden="true"
        >
          {isOpen && 'Service preview modal opened'}
        </div>
      </div>
    </div>
  )

  return createPortal(modalTree, portalEl)
}

export default ServicePreviewModal