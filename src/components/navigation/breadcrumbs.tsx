'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Fragment, useMemo } from 'react'
import { useT } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/messages'

interface BreadcrumbSegment {
  label: string
  href: string
  isLast: boolean
}

// Route label mappings (message keys, translated at render time)
const routeLabels: Record<string, MessageKey> = {
  dashboard: 'shell.navDashboard',
  stacks: 'shell.navStacks',
  services: 'shell.navServices',
  env: 'shell.crumbEnvironment',
  deployments: 'shell.crumbDeployments',
  logs: 'shell.crumbLogs',
  terminal: 'shell.crumbTerminal',
  settings: 'common.settings',
  templates: 'shell.crumbTemplates',
  analytics: 'shell.crumbAnalytics',
  recommendations: 'shell.crumbRecommendations',
  profile: 'shell.profile',
}

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname()
  const t = useT()

  const segments = useMemo(() => {
    if (!pathname || pathname === '/') return []

    const parts = pathname.slice(1).split('/').filter(Boolean)

    // The root crumb already is "Dashboard" — drop a leading /dashboard segment
    // so /dashboard/* paths don't render "Dashboard > Dashboard".
    let currentPath = ''
    if (parts[0] === 'dashboard') {
      parts.shift()
      currentPath = '/dashboard'
    }

    const breadcrumbs: BreadcrumbSegment[] = []
    parts.forEach((part, index) => {
      // Skip route group segments like (dashboard)
      if (part.startsWith('(') && part.endsWith(')')) return

      currentPath += `/${part}`
      const isLast = index === parts.length - 1

      // Get label - check if it's a known route or use the segment
      const labelKey = routeLabels[part]
      let label = labelKey ? t(labelKey) : part

      // Handle dynamic segments (UUIDs, IDs)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(part)
      const isNumeric = /^\d+$/.test(part)

      if (isUUID || isNumeric) {
        // For UUIDs/IDs, we'll show a shortened version or use context
        label = isUUID ? `#${part.slice(0, 8)}...` : `#${part}`
      }

      // Capitalize first letter if it's just a plain segment
      if (!labelKey && !isUUID && !isNumeric) {
        label = label.charAt(0).toUpperCase() + label.slice(1).replace(/-/g, ' ')
      }

      breadcrumbs.push({
        label,
        href: currentPath,
        isLast,
      })
    })

    return breadcrumbs
  }, [pathname, t])

  const rootLabel = (
    <>
      <Home className="h-4 w-4" aria-hidden="true" />
      {t('shell.navDashboard')}
    </>
  )

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        <BreadcrumbItem>
          {segments.length === 0 ? (
            <BreadcrumbPage className="flex items-center gap-1.5">
              {rootLabel}
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href="/dashboard" className="flex items-center gap-1.5">
                {rootLabel}
              </Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>

        {segments.map((segment) => (
          // Separator is an <li> itself, so it must be a sibling of
          // BreadcrumbItem (also <li>) — nesting them breaks hydration.
          <Fragment key={segment.href}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {segment.isLast ? (
                <BreadcrumbPage>{segment.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={segment.href as any}>{segment.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
