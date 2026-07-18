'use client'

import { useEffect, useState } from 'react'

/**
 * useReducedMotion Hook
 * 
 * Detects the user's motion preferences and respects the
 * `prefers-reduced-motion` media query for accessibility.
 * 
 * This hook is essential for WCAG 2.2 compliance and respects
 * user preferences for reduced motion animations.
 * 
 * @returns {boolean} True if user prefers reduced motion
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const reducedMotion = useReducedMotion()
 *   
 *   return (
 *     <motion.div
 *       initial={{ opacity: 0 }}
 *       animate={{ opacity: 1 }}
 *       transition={{ duration: reducedMotion ? 0 : 0.5 }}
 *     >
 *       Content
 *     </motion.div>
 *   )
 * }
 * ```
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState<boolean>(false)

  useEffect(() => {
    // Check if the browser supports the media query
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    // Set initial value
    setReducedMotion(mediaQuery.matches)

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setReducedMotion(event.matches)
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    } 
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    }
  }, [])

  return reducedMotion
}

/**
 * getAnimationProps
 * 
 * Helper function to conditionally apply animation properties
 * based on reduced motion preference.
 * 
 * @param reducedMotion - Whether reduced motion is preferred
 * @param animationProps - Animation properties to apply when motion is enabled
 * @param staticProps - Properties to apply when reduced motion is preferred
 * @returns Animation properties or static properties
 * 
 * @example
 * ```tsx
 * const reducedMotion = useReducedMotion()
 * 
 * <motion.div
 *   {...getAnimationProps(
 *     reducedMotion,
 *     { initial: { opacity: 0 }, animate: { opacity: 1 } },
 *     { initial: { opacity: 1 }, animate: { opacity: 1 } }
 *   )}
 * />
 * ```
 */
export function getAnimationProps<T extends Record<string, any>>(
  reducedMotion: boolean,
  animationProps: T,
  staticProps?: Partial<T>
): T {
  if (reducedMotion) {
    return {
      ...animationProps,
      ...staticProps,
      transition: { duration: 0 },
    } as T
  }
  return animationProps
}

/**
 * Animation duration multiplier based on reduced motion preference
 * 
 * @param reducedMotion - Whether reduced motion is preferred
 * @returns Duration multiplier (0 for reduced motion, 1 for normal)
 */
export function getMotionDuration(reducedMotion: boolean): number {
  return reducedMotion ? 0 : 1
}
