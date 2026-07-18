/**
 * Animation Configuration for Framer Motion
 * 
 * Provides reusable animation variants and utilities for consistent
 * animations across the application with accessibility support.
 */

import { Variants } from 'framer-motion'

/**
 * Page transition variants
 * Used for smooth page transitions in Next.js App Router
 */
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1], // Custom easing
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

/**
 * Fade in variants
 * Simple fade in animation for elements
 */
export const fadeInVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
}

/**
 * Slide up variants
 * Slide up with fade animation
 */
export const slideUpVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

/**
 * Scale variants
 * Scale animation for modals and popovers
 */
export const scaleVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.15,
      ease: 'easeIn',
    },
  },
}

/**
 * Stagger children variants
 * For staggering child element animations
 */
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
}

/**
 * Stagger item variants
 * Used with stagger container
 */
export const staggerItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
}

/**
 * Card hover variants
 * Interactive hover animation for cards
 */
export const cardHoverVariants: Variants = {
  rest: {
    scale: 1,
  },
  hover: {
    scale: 1.02,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
  tap: {
    scale: 0.98,
  },
}

/**
 * Glassmorphism card variants
 * Animated glassmorphic effect
 */
export const glassVariants: Variants = {
  hidden: {
    opacity: 0,
    backdropFilter: 'blur(0px)',
  },
  visible: {
    opacity: 1,
    backdropFilter: 'blur(10px)',
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
}

/**
 * Spring animation configuration
 * Reusable spring presets
 */
export const springConfigs = {
  gentle: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
  },
  bouncy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 10,
  },
  snappy: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 40,
  },
}

/**
 * Default transition
 * Standard transition for most animations
 */
export const defaultTransition = {
  duration: 0.3,
  ease: [0.22, 1, 0.36, 1],
}
