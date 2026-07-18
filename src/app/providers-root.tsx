"use client"

import React from 'react'
import { usePathname } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'
import { ServiceBrowserQueryProvider } from '@/components/providers/query-provider'
import Header from '@/components/header'
import { ThemeProvider } from './providers'
import { loadAppearancePrefs } from '@/lib/appearance'

/**
 * ProvidersRoot Component
 * 
 * Root provider component that wraps the entire application.
 * Conditionally shows the marketing Header only on non-dashboard routes.
 * Dashboard routes use their own sidebar layout.
 */
export function ProvidersRoot({ children, session }: { children: React.ReactNode; session?: any }) {
  const pathname = usePathname()

  // Apply persisted accent/font-size prefs app-wide on load.
  React.useEffect(() => { loadAppearancePrefs() }, [])

  // Determine if this is a dashboard route (uses sidebar layout instead of header)
  const isDashboardRoute = pathname?.startsWith('/dashboard') ||
                          pathname?.startsWith('/services') ||
                          pathname?.startsWith('/stack-builder') ||
                          pathname?.startsWith('/stacks') ||
                          pathname?.startsWith('/network') ||
                          pathname?.startsWith('/settings') ||
                          pathname?.startsWith('/admin')
  
  const content = (
    <ServiceBrowserQueryProvider>
      <div id="root">
        {/* Only show marketing header on non-dashboard routes */}
        {!isDashboardRoute && <Header />}
        {children}
      </div>
      <div id="modal-root" />
    </ServiceBrowserQueryProvider>
  )

  return (
    <ThemeProvider>
      {/* SessionProvider is always mounted: components like AppSidebar call
          useSession(), which throws without a provider. When
          NEXT_PUBLIC_APP_DISABLE_AUTH=true the session is simply
          unauthenticated — route guards are skipped elsewhere. */}
      <SessionProvider session={session}>{content}</SessionProvider>
    </ThemeProvider>
  )
}
