/**
 * Command Palette Store
 *
 * Zustand store for managing command palette state, recent actions, and search history.
 * Persists recent actions to localStorage for cross-session continuity.
 *
 * Features:
 * - Recent actions tracking (last 10 actions)
 * - LocalStorage persistence
 * - Type-safe action history
 * - Auto-cleanup of old actions
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Types of actions that can be tracked in the command palette
 */
export type RecentActionType =
  | 'service-view'      // Viewed a service detail page
  | 'service-add'       // Added a service to stack
  | 'search'            // Performed a search
  | 'navigation'        // Navigated to a page

/**
 * Recent action entry with metadata
 */
export interface RecentAction {
  /** Unique identifier */
  id: string
  /** Type of action performed */
  type: RecentActionType
  /** Display label for the action */
  label: string
  /** Timestamp when action was performed */
  timestamp: number
  /** Optional data associated with the action */
  data?: unknown
  /** Optional icon identifier */
  icon?: string
}

/**
 * Command Palette Store State
 */
interface CommandPaletteState {
  /** List of recent actions (max 10) */
  recentActions: RecentAction[]

  /** Whether the command palette is currently open */
  isOpen: boolean

  /** Current search query */
  searchQuery: string

  /** Add a new recent action */
  addRecentAction: (action: Omit<RecentAction, 'id' | 'timestamp'>) => void

  /** Clear all recent actions */
  clearRecentActions: () => void

  /** Remove a specific recent action */
  removeRecentAction: (id: string) => void

  /** Set the open state of the command palette */
  setIsOpen: (isOpen: boolean) => void

  /** Set the search query */
  setSearchQuery: (query: string) => void

  /** Get recent actions by type */
  getRecentActionsByType: (type: RecentActionType) => RecentAction[]
}

/**
 * Maximum number of recent actions to store
 */
const MAX_RECENT_ACTIONS = 10

/**
 * Generate a unique ID for actions
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Command Palette Store
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { addRecentAction, recentActions } = useCommandPaletteStore()
 *
 *   const handleServiceClick = (service) => {
 *     addRecentAction({
 *       type: 'service-view',
 *       label: `Viewed ${service.name}`,
 *       data: service
 *     })
 *   }
 * }
 * ```
 */
export const useCommandPaletteStore = create<CommandPaletteState>()(
  persist(
    (set, get) => ({
      recentActions: [],
      isOpen: false,
      searchQuery: '',

      addRecentAction: (action) => {
        const newAction: RecentAction = {
          ...action,
          id: generateId(),
          timestamp: Date.now(),
        }

        set((state) => {
          // Remove duplicate actions (same label)
          const filteredActions = state.recentActions.filter(
            (a) => a.label !== newAction.label
          )

          // Add new action at the beginning and limit to MAX_RECENT_ACTIONS
          const updatedActions = [newAction, ...filteredActions].slice(
            0,
            MAX_RECENT_ACTIONS
          )

          return { recentActions: updatedActions }
        })
      },

      clearRecentActions: () => {
        set({ recentActions: [] })
      },

      removeRecentAction: (id) => {
        set((state) => ({
          recentActions: state.recentActions.filter((action) => action.id !== id),
        }))
      },

      setIsOpen: (isOpen) => {
        set({ isOpen })

        // Clear search query when closing
        if (!isOpen) {
          set({ searchQuery: '' })
        }
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query })
      },

      getRecentActionsByType: (type) => {
        return get().recentActions.filter((action) => action.type === type)
      },
    }),
    {
      name: 'command-palette-storage',
      // Only persist recent actions, not ephemeral UI state
      partialize: (state) => ({ recentActions: state.recentActions }),
    }
  )
)

/**
 * Selectors for optimized component re-renders
 */
export const selectRecentActions = (state: CommandPaletteState) => state.recentActions
export const selectIsOpen = (state: CommandPaletteState) => state.isOpen
export const selectSearchQuery = (state: CommandPaletteState) => state.searchQuery
