'use client'

import { forwardRef, HTMLAttributes } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

export interface SkeletonShimmerProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Visual variant of the skeleton
   * - text: Single line text placeholder
   * - circular: Avatar or icon placeholder
   * - rectangular: Block content placeholder
   * - card: Full card structure placeholder
   * @default 'rectangular'
   */
  variant?: 'text' | 'circular' | 'rectangular' | 'card'

  /**
   * Width of the skeleton (CSS value)
   * @default '100%'
   */
  width?: string | number

  /**
   * Height of the skeleton (CSS value)
   * @default varies by variant
   */
  height?: string | number

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Override reduced motion detection for testing
   */
  forceReducedMotion?: boolean
}

/**
 * SkeletonShimmer - Enhanced loading skeleton with gradient shimmer animation
 *
 * Provides better perceived performance than pulse animation by showing
 * directional movement. Automatically falls back to pulse animation when
 * user prefers reduced motion.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <SkeletonShimmer variant="text" width="60%" height={20} />
 *
 * // Card skeleton
 * <SkeletonShimmer variant="card" />
 *
 * // Circular avatar
 * <SkeletonShimmer variant="circular" width={40} height={40} />
 * ```
 *
 * @accessibility
 * - role="status" for loading state announcement
 * - aria-label="Loading..." for screen readers
 * - Respects prefers-reduced-motion
 *
 * @performance
 * - GPU-accelerated transform animations
 * - No layout shifts (dimensions match target content)
 * - Bundle impact: ~1KB gzipped
 */
export const SkeletonShimmer = forwardRef<HTMLDivElement, SkeletonShimmerProps>(
  (
    {
      variant = 'rectangular',
      width = '100%',
      height,
      className = '',
      forceReducedMotion = false,
      ...props
    },
    ref
  ) => {
    const reducedMotion = useReducedMotion() || forceReducedMotion

    // Default heights for each variant if not specified
    const defaultHeights: Record<typeof variant, number> = {
      text: 16,
      circular: 40,
      rectangular: 100,
      card: 200,
    }

    const finalHeight = height ?? defaultHeights[variant]

    // Variant-specific classes
    const variantClasses: Record<typeof variant, string> = {
      text: 'rounded',
      circular: 'rounded-full aspect-square',
      rectangular: 'rounded-md',
      card: 'rounded-xl',
    }

    // Convert number dimensions to px
    const widthStyle = typeof width === 'number' ? `${width}px` : width
    const heightStyle = typeof finalHeight === 'number' ? `${finalHeight}px` : finalHeight

    return (
      <div
        ref={ref}
        role="status"
        aria-label="Loading..."
        aria-live="polite"
        className={`relative overflow-hidden bg-muted ${variantClasses[variant]} ${
          reducedMotion ? 'animate-pulse' : ''
        } ${className}`}
        style={{
          width: widthStyle,
          height: heightStyle,
        }}
        {...props}
      >
        {/* Shimmer effect (only shown when motion is not reduced) */}
        {!reducedMotion && (
          <div
            className="absolute inset-0 -translate-x-full animate-shimmer"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
              transform: 'translateX(-100%)',
            }}
            aria-hidden="true"
          />
        )}

        {/* Card variant content structure */}
        {variant === 'card' && (
          <div className="p-fluid-md space-y-fluid-sm" aria-hidden="true">
            <div className="flex items-start gap-fluid-sm">
              <div className="w-10 h-10 rounded-full bg-muted-foreground/10" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-3/5 rounded bg-muted-foreground/10" />
                <div className="h-4 w-2/5 rounded bg-muted-foreground/10" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-muted-foreground/10" />
              <div className="h-4 w-4/5 rounded bg-muted-foreground/10" />
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded bg-muted-foreground/10" />
              <div className="h-6 w-16 rounded bg-muted-foreground/10" />
              <div className="h-6 w-16 rounded bg-muted-foreground/10" />
            </div>
          </div>
        )}
      </div>
    )
  }
)

SkeletonShimmer.displayName = 'SkeletonShimmer'

/**
 * ServiceCardSkeleton - Pre-configured skeleton for service cards
 *
 * Matches the exact layout of ServiceCard to prevent CLS
 */
export const ServiceCardSkeleton = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <article
        ref={ref}
        className={`relative bg-card border border-border rounded-xl p-fluid-md ${className}`}
        role="status"
        aria-label="Loading service"
        {...props}
      >
        {/* Header: Icon + Title + Category */}
        <div className="flex items-start gap-fluid-sm mb-fluid-sm">
          <SkeletonShimmer variant="circular" width={40} height={40} />
          <div className="flex-1 space-y-2">
            <SkeletonShimmer variant="text" width="60%" height={20} />
            <SkeletonShimmer variant="text" width="40%" height={16} />
          </div>
        </div>

        {/* Description */}
        <div className="mb-fluid-sm space-y-2">
          <SkeletonShimmer variant="text" width="100%" height={16} />
          <SkeletonShimmer variant="text" width="90%" height={16} />
          <SkeletonShimmer variant="text" width="75%" height={16} />
        </div>

        {/* Tags */}
        <div className="flex gap-2 mb-fluid-sm">
          <SkeletonShimmer variant="rectangular" width={60} height={24} />
          <SkeletonShimmer variant="rectangular" width={70} height={24} />
          <SkeletonShimmer variant="rectangular" width={55} height={24} />
        </div>

        {/* Footer: Company + Pricing */}
        <div className="flex items-center justify-between pt-fluid-sm border-t border-border">
          <SkeletonShimmer variant="text" width="40%" height={16} />
          <SkeletonShimmer variant="rectangular" width={80} height={24} />
        </div>
      </article>
    )
  }
)

ServiceCardSkeleton.displayName = 'ServiceCardSkeleton'
