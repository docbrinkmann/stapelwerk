/**
 * useToast Hook (Enhanced)
 *
 * Enhanced toast hook with support for new variants (success, warning, info),
 * progress indicator, and action buttons.
 *
 * New features:
 * - Support for success, warning, info variants
 * - Progress indicator option
 * - Configurable duration
 * - Action button support
 * - Multiple toast stacking (updated limit)
 */

// Inspired by react-hot-toast library
import * as React from "react"

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const TOAST_LIMIT = 5 // Allow multiple toasts to stack
const TOAST_REMOVE_DELAY = 1000000

type ToastProps = {
  className?: string
  variant?: "default" | "destructive" | "success" | "warning" | "info"
  duration?: number
  showProgress?: boolean
}

type ToastActionElement = React.ReactElement<any, string | React.JSXElementConstructor<any>>

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action
      const toasts = state.toasts.filter((t) => t.id !== toastId)

      return {
        ...state,
        toasts: toasts,
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
    default:
      return state
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type State = {
  toasts: ToasterToast[]
}

type Action =
  | { type: "ADD_TOAST"; toast: ToasterToast }
  | { type: "UPDATE_TOAST"; toast: Partial<ToasterToast> }
  | { type: "DISMISS_TOAST"; toastId: string }
  | { type: "REMOVE_TOAST"; toastId?: string }

let count = 0

function genId() {
  count = (count + 1) % 100
  return count.toString()
}

/**
 * Toast function with enhanced options
 */
const toast = (props: {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
} & ToastProps) => {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open: boolean) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

/**
 * useToast Hook
 *
 * Provides access to the toast system
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId: toastId || "" }),
  }
}

/**
 * Convenience functions for common toast variants
 */
export const toastSuccess = (props: Omit<Parameters<typeof toast>[0], 'variant'>) => {
  return toast({ ...props, variant: 'success', showProgress: true })
}

export const toastWarning = (props: Omit<Parameters<typeof toast>[0], 'variant'>) => {
  return toast({ ...props, variant: 'warning', showProgress: true })
}

export const toastInfo = (props: Omit<Parameters<typeof toast>[0], 'variant'>) => {
  return toast({ ...props, variant: 'info', showProgress: true })
}

export const toastError = (props: Omit<Parameters<typeof toast>[0], 'variant'>) => {
  return toast({ ...props, variant: 'destructive', showProgress: true })
}

export {
  useToast,
  toast,
}
