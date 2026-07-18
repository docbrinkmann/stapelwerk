import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { LayoutProps } from '@/types/globals'
import { METADATA } from '@/lib/constants'
import './globals.css'
import { ProvidersRoot } from './providers-root'

// Optimize font loading with Next.js font optimization
// Task 4.3: Preload critical font with fetchpriority for LCP optimization
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
  adjustFontFallback: true,
  variable: '--font-inter'
})

export const metadata: Metadata = {
  title: METADATA.title,
  description: METADATA.description,
  keywords: METADATA.keywords,
  authors: [{ name: 'BuildMyStack Team' }],
  generator: 'Next.js',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

import { getServerSession } from 'next-auth/next'
import { defaultAuthOptions } from '@/lib/auth'

export default async function RootLayout({ children }: LayoutProps) {
  const session = await getServerSession(defaultAuthOptions)

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Task 4.3: Preload critical Inter font for LCP optimization */}
        <link
          rel="preload"
          href="/_next/static/media/inter-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className={`min-h-screen bg-background text-foreground ${inter.className}`}>
        <ProvidersRoot session={session}>
          {children}
        </ProvidersRoot>
      </body>
    </html>
  )
}
