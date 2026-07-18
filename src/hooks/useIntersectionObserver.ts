import { useEffect, useState, useRef, RefObject } from 'react'

interface UseIntersectionObserverOptions {
  /** The element to observe */
  elementRef: RefObject<Element | null>
  /** Root margin for the intersection observer */
  rootMargin?: string
  /** Threshold for triggering intersection */
  threshold?: number | number[]
  /** Root element to observe intersections against */
  root?: Element | null
  /** Whether the observer is enabled */
  enabled?: boolean
  /** Trigger only once when element first intersects */
  triggerOnce?: boolean
}

interface UseIntersectionObserverResult {
  /** Whether the element is currently intersecting */
  isIntersecting: boolean
  /** The intersection observer entry */
  entry: IntersectionObserverEntry | null
  /** Whether the observer is supported */
  isSupported: boolean
}

/**
 * Hook for observing element intersection with viewport or parent element
 * Provides automatic cleanup and performance optimizations
 */
export const useIntersectionObserver = ({
  elementRef,
  rootMargin = '0px',
  threshold = 0,
  root = null,
  enabled = true,
  triggerOnce = false,
}: UseIntersectionObserverOptions): UseIntersectionObserverResult => {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null)
  const [hasTriggered, setHasTriggered] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Check if IntersectionObserver is supported
  const isSupported = typeof window !== 'undefined' && 'IntersectionObserver' in window

  useEffect(() => {
    const element = elementRef.current

    // Early return if not supported, not enabled, or no element
    if (!isSupported || !enabled || !element) {
      setIsIntersecting(false)
      setEntry(null)
      return
    }

    // Early return if triggerOnce and already triggered
    if (triggerOnce && hasTriggered) {
      return
    }

    // Clean up existing observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    // Create intersection observer
    observerRef.current = new IntersectionObserver(
      ([observerEntry]) => {
        const isCurrentlyIntersecting = observerEntry.isIntersecting

        setIsIntersecting(isCurrentlyIntersecting)
        setEntry(observerEntry)

        // Mark as triggered if using triggerOnce and currently intersecting
        if (triggerOnce && isCurrentlyIntersecting) {
          setHasTriggered(true)
        }
      },
      {
        root,
        rootMargin,
        threshold,
      }
    )

    // Start observing
    observerRef.current.observe(element)

    // Cleanup function
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
    }
  }, [
    elementRef,
    rootMargin,
    threshold,
    root,
    enabled,
    triggerOnce,
    hasTriggered,
    isSupported,
  ])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  return {
    isIntersecting,
    entry,
    isSupported,
  }
}

/**
 * Simplified hook for basic intersection detection
 */
export const useInView = (
  elementRef: RefObject<Element | null>,
  options?: Partial<UseIntersectionObserverOptions>
) => {
  const { isIntersecting, entry } = useIntersectionObserver({
    elementRef,
    threshold: 0.1,
    rootMargin: '50px',
    ...options,
  })

  return {
    inView: isIntersecting,
    entry,
  }
}

/**
 * Hook for lazy loading elements when they come into view
 */
export const useLazyLoad = (
  elementRef: RefObject<Element | null>,
  callback: () => void,
  options?: Partial<UseIntersectionObserverOptions>
) => {
  const { isIntersecting } = useIntersectionObserver({
    elementRef,
    threshold: 0.1,
    triggerOnce: true,
    ...options,
  })

  useEffect(() => {
    if (isIntersecting) {
      callback()
    }
  }, [isIntersecting, callback])

  return isIntersecting
}

/**
 * Hook for tracking multiple elements intersection
 */
export const useMultipleIntersectionObserver = (
  elementRefs: RefObject<Element | null>[],
  options?: Partial<Omit<UseIntersectionObserverOptions, 'elementRef'>>
) => {
  const [intersections, setIntersections] = useState<Map<Element, boolean>>(new Map())
  const observerRef = useRef<IntersectionObserver | null>(null)

  const isSupported = typeof window !== 'undefined' && 'IntersectionObserver' in window

  useEffect(() => {
    if (!isSupported || !options?.enabled) {
      return
    }

    // Clean up existing observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    const elements = elementRefs
      .map(ref => ref.current)
      .filter((element): element is Element => element !== null)

    if (elements.length === 0) {
      return
    }

    // Create intersection observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        setIntersections(prev => {
          const newMap = new Map(prev)
          entries.forEach(entry => {
            newMap.set(entry.target, entry.isIntersecting)
          })
          return newMap
        })
      },
      {
        root: options?.root || null,
        rootMargin: options?.rootMargin || '0px',
        threshold: options?.threshold || 0,
      }
    )

    // Observe all elements
    elements.forEach(element => {
      observerRef.current?.observe(element)
    })

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [elementRefs, options, isSupported])

  return intersections
}