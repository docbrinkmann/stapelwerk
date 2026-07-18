import React from 'react';
import { ServiceCardSkeleton } from '@/components/ui/skeleton-shimmer';
import './ServiceGridSkeleton.css';

interface ServiceGridSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * ServiceGridSkeleton - Loading state for service grid
 *
 * Task 2.5: Updated to use enhanced SkeletonShimmer component
 * with gradient animation for better perceived performance.
 *
 * @param count - Number of skeleton cards to display (default: 12)
 * @param className - Additional CSS classes
 *
 * @accessibility
 * - Each skeleton has role="status" and aria-label
 * - Announces loading state to screen readers
 * - Respects prefers-reduced-motion
 *
 * @performance
 * - Maintains exact dimensions to prevent CLS
 * - GPU-accelerated shimmer animations
 * - Graceful fallback to pulse for reduced motion
 */
export function ServiceGridSkeleton({ count = 12, className }: ServiceGridSkeletonProps) {
  return (
    <div className={`service-grid-skeleton ${className || ''}`.trim()}>
      <div className="service-grid-skeleton__grid">
        {Array.from({ length: count }, (_, index) => (
          <ServiceCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

export default ServiceGridSkeleton;
