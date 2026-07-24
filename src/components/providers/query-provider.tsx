'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { serviceBrowserQueryClient } from '@/lib/query/query-client'
import { ReactNode } from 'react'

interface QueryProviderProps {
  children: ReactNode
}

/**
 * Query Provider component for Service Browser
 * Wraps the application with TanStack Query context
 */
import { TRPCProvider } from '@/trpc/react-client'

export function ServiceBrowserQueryProvider({ children }: QueryProviderProps) {
  return (
    <TRPCProvider>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false}
        />
      )}
    </TRPCProvider>
  )
}
