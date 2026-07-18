'use client'

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes'

/**
 * Theme Provider Component
 * 
 * Wraps the application with next-themes provider for theme management.
 * Features:
 * - Automatic dark/light mode switching
 * - System preference detection
 * - LocalStorage persistence
 * - FOUC (Flash of Unstyled Content) prevention
 * 
 * @see https://github.com/pacocoursey/next-themes
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      storageKey="buildmystack-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
