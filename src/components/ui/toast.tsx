/**
 * Toast Component (Enhanced)
 *
 * Enhanced toast notification system with multiple variants, progress indicator,
 * and hover-to-pause functionality.
 *
 * New features:
 * - 3 new variants: success, warning, info
 * - Progress indicator showing time remaining
 * - Hover to pause auto-dismiss (with progress pause)
 * - Icons for each variant
 * - Action button support
 * - Proper toast stacking
 * - Reduced motion support
 * - Full ARIA attributes
 */

'use client'

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils/cn"
import { useReducedMotion } from "@/hooks/useReducedMotion"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
        success:
          "success group border-success/20 bg-success/10 text-success-foreground dark:border-success/30 dark:bg-success/20",
        warning:
          "warning group border-warning/20 bg-warning/10 text-warning-foreground dark:border-warning/30 dark:bg-warning/20",
        info:
          "info group border-info/20 bg-info/10 text-info-foreground dark:border-info/30 dark:bg-info/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root>,
    VariantProps<typeof toastVariants> {
  /** Show progress indicator */
  showProgress?: boolean
  /** Duration for auto-dismiss (used for progress calculation) */
  duration?: number
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  ToastProps
>(({ className, variant, showProgress = false, duration, ...props }, ref) => {
  const reducedMotion = useReducedMotion()
  const [isPaused, setIsPaused] = React.useState(false)
  const [progress, setProgress] = React.useState(100)
  const startTimeRef = React.useRef<number>(Date.now())
  const pausedTimeRef = React.useRef<number>(0)
  const animationFrameRef = React.useRef<number | undefined>(undefined)

  // Progress animation
  React.useEffect(() => {
    if (!showProgress || !duration || reducedMotion) return

    const animate = () => {
      if (isPaused) {
        pausedTimeRef.current = Date.now()
        return
      }

      const elapsed = Date.now() - startTimeRef.current
      const remaining = Math.max(0, duration - elapsed)
      const progressValue = (remaining / duration) * 100

      setProgress(progressValue)

      if (progressValue > 0) {
        animationFrameRef.current = requestAnimationFrame(animate)
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [showProgress, duration, isPaused, reducedMotion])

  // Handle pause on hover
  const handleMouseEnter = () => {
    setIsPaused(true)
  }

  const handleMouseLeave = () => {
    if (isPaused) {
      const pauseDuration = Date.now() - pausedTimeRef.current
      startTimeRef.current += pauseDuration
      setIsPaused(false)
    }
  }

  // Get icon for variant
  const Icon = React.useMemo(() => {
    switch (variant) {
      case 'success':
        return CheckCircle
      case 'warning':
        return AlertTriangle
      case 'info':
        return Info
      case 'destructive':
        return AlertCircle
      default:
        return null
    }
  }, [variant])

  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      duration={duration}
      {...props}
    >
      {/* Variant Icon */}
      {Icon && (
        <div className="flex-shrink-0" aria-hidden="true">
          <Icon className="h-5 w-5" />
        </div>
      )}

      {/* Toast Content */}
      <div className="flex-1">{props.children}</div>

      {/* Progress Bar */}
      {showProgress && !reducedMotion && duration && (
        <div
          className="absolute bottom-0 left-0 h-1 bg-current opacity-30 transition-all"
          style={{
            width: `${progress}%`,
            transitionDuration: isPaused ? '0ms' : '100ms',
          }}
          role="progressbar"
          aria-label="Time remaining"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      )}
    </ToastPrimitives.Root>
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      "group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      "group-[.success]:border-success/40 group-[.success]:hover:border-success/60 group-[.success]:hover:bg-success/20 group-[.success]:focus:ring-success",
      "group-[.warning]:border-warning/40 group-[.warning]:hover:border-warning/60 group-[.warning]:hover:bg-warning/20 group-[.warning]:focus:ring-warning",
      "group-[.info]:border-info/40 group-[.info]:hover:border-info/60 group-[.info]:hover:bg-info/20 group-[.info]:focus:ring-info",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100",
      "group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      "group-[.success]:text-success-foreground/70 group-[.success]:hover:text-success-foreground group-[.success]:focus:ring-success",
      "group-[.warning]:text-warning-foreground/70 group-[.warning]:hover:text-warning-foreground group-[.warning]:focus:ring-warning",
      "group-[.info]:text-info-foreground/70 group-[.info]:hover:text-info-foreground group-[.info]:focus:ring-info",
      className
    )}
    toast-close=""
    aria-label="Close notification"
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastActionElement = React.ReactElement<typeof ToastAction>

export type { ToastProps, ToastActionElement }

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
