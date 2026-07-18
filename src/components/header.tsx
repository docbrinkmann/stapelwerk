'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, useScroll, useMotionValueEvent } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import ThemeToggle from '@/components/ui/theme-toggle'
import { useReducedMotion } from '@/hooks/useReducedMotion'

/**
 * Header Component
 * 
 * Sticky navigation header with:
 * - Scroll-aware background transitions
 * - Glassmorphic backdrop blur effect
 * - Responsive mobile menu
 * - Theme toggle integration
 * - Smooth scroll navigation
 * - Gradient logo treatment
 * 
 * @example
 * ```tsx
 * <Header />
 * ```
 */
function MobileMenuInert() {
  // Inert the app content when menu is open and restore on cleanup
  useEffect(() => {
    const root = document.getElementById('root')
    const btn = document.getElementById('mobile-menu-button') as HTMLButtonElement | null
    if (root) root.setAttribute('inert', '')
    return () => {
      if (root) root.removeAttribute('inert')
      // Restore focus to the opener
      btn?.focus()
    }
  }, [])
  return null
}

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { scrollY } = useScroll()
  const reducedMotion = useReducedMotion()
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuWasOpenRef = useRef(false)

  // Track scroll position for background transition
  useMotionValueEvent(scrollY, 'change', (latest) => {
    setIsScrolled(latest > 50)
  })

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
      menuWasOpenRef.current = true
    } else {
      document.body.style.overflow = 'unset'
      // Restore focus to the menu toggle when the menu CLOSES (for
      // environments without inert support). Must not run on initial mount —
      // stealing focus on page load breaks keyboard navigation.
      if (menuWasOpenRef.current) {
        menuWasOpenRef.current = false
        menuButtonRef.current?.focus()
      }
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isMobileMenuOpen])

  // ponytail: no marketing sections exist yet, so no anchor nav links.
  // Add entries back here once #features/#pricing/etc. sections are built.
  const navLinks: { href: string; label: string }[] = []

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    const element = document.querySelector(href)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setIsMobileMenuOpen(false)
    }
  }

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.5, ease: 'easeOut' }}
        className={`
          sticky top-0 z-50 w-full transition-all duration-300
          ${isScrolled 
            ? 'bg-background/80 backdrop-blur-md border-b border-border/50 shadow-sm' 
            : 'bg-transparent'
          }
        `}
      >
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <motion.a
              href="/"
              className="flex items-center gap-2 group"
              whileHover={reducedMotion ? {} : { scale: 1.02 }}
              whileTap={reducedMotion ? {} : { scale: 0.98 }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground md:h-9 md:w-9">
                <span className="text-base font-bold text-background md:text-lg">B</span>
              </div>
              <span className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
                BuildMyStack
              </span>
            </motion.a>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <ul className="flex items-center gap-6">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={(e) => handleSmoothScroll(e, link.href)}
                      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 relative group"
                    >
                      {link.label}
                      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-foreground group-hover:w-full transition-all duration-300" />
                    </a>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-4">
                <ThemeToggle />

                <a
                  href="/auth/signin"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  Sign In
                </a>

                <motion.a
                  href="/stack-builder"
                  whileHover={reducedMotion ? {} : { scale: 1.05 }}
                  whileTap={reducedMotion ? {} : { scale: 0.95 }}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Get Started
                </motion.a>
              </div>
            </div>

            {/* Mobile Menu Button & Theme Toggle */}
            <div className="flex md:hidden items-center gap-4">
              <ThemeToggle />
              
              <motion.button
                ref={menuButtonRef}
                id="mobile-menu-button"
                aria-controls="mobile-menu-dialog"
                whileTap={reducedMotion ? {} : { scale: 0.95 }}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-foreground hover:bg-accent rounded-lg transition-colors"
                aria-label="Toggle mobile menu"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </motion.button>
            </div>
          </div>
        </nav>
      </motion.header>

      {/* Mobile Menu Overlay — portaled into #modal-root (a sibling of #root)
          so MobileMenuInert, which sets `inert` on #root, doesn't also disable
          the menu's own buttons; z-[60] covers the header (z-50) so its toggle
          icon can't show through as a doubled X. */}
      {isMobileMenuOpen && (
        <>
          <MobileMenuInert />
          {createPortal(
          <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          className="fixed inset-0 z-[60] md:hidden"
          onClick={() => { setIsMobileMenuOpen(false); menuButtonRef.current?.focus() }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-lg" />
          
          {/* Menu Content */}
          <motion.div
            id="mobile-menu-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-menu-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-card border-l border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { 
                setIsMobileMenuOpen(false)
                menuButtonRef.current?.focus()
              }
            }}
          >
            <div className="flex flex-col h-full p-6">
              {/* Close button */}
              <div className="flex justify-end mb-8">
                <button autoFocus
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-foreground hover:bg-accent rounded-lg transition-colors"
                  aria-label="Close mobile menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="flex-1">
                <ul className="space-y-4">
                  {navLinks.map((link, index) => (
                    <motion.li
                      key={link.href}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: reducedMotion ? 0 : index * 0.1 }}
                    >
                      <a
                        href={link.href}
                        onClick={(e) => handleSmoothScroll(e, link.href)}
                        className="block text-lg font-medium text-foreground hover:text-primary transition-colors py-3 px-4 rounded-lg hover:bg-accent"
                      >
                        {link.label}
                      </a>
                    </motion.li>
                  ))}
                </ul>
              </nav>

              {/* CTA Buttons */}
              <motion.a
                href="/auth/signin"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reducedMotion ? 0 : 0.35 }}
                className="block w-full px-6 py-3 mb-3 text-center border border-border text-foreground rounded-lg font-semibold transition-all duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Sign In
              </motion.a>
              <motion.a
                href="/stack-builder"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reducedMotion ? 0 : 0.4 }}
                className="block w-full px-6 py-3 text-center bg-primary text-primary-foreground rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Get Started
              </motion.a>
            </div>
          </motion.div>
        </motion.div>,
          document.getElementById('modal-root') || document.body
          )}
        </>
      )}
    </>
  )
}
