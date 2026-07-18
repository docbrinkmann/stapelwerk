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

interface BreadcrumbSegment {
  label: string
  href: string
  isLast: boolean
}

// Route label mappings
const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  stacks: 'Stacks',
  services: 'Services',
  env: 'Environment',
  deployments: 'Deployments',
  logs: 'Logs',
  terminal: 'Terminal',
  settings: 'Settings',
  templates: 'Templates',
  analytics: 'Analytics',
  recommendations: 'Recommendations',
  profile: 'Profile',
}

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname()

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
      let label = routeLabels[part] || part

      // Handle dynamic segments (UUIDs, IDs)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(part)
      const isNumeric = /^\d+$/.test(part)

      if (isUUID || isNumeric) {
        // For UUIDs/IDs, we'll show a shortened version or use context
        label = isUUID ? `#${part.slice(0, 8)}...` : `#${part}`
      }

      // Capitalize first letter if it's just a plain segment
      if (!routeLabels[part] && !isUUID && !isNumeric) {
        label = label.charAt(0).toUpperCase() + label.slice(1).replace(/-/g, ' ')
      }

      breadcrumbs.push({
        label,
        href: currentPath,
        isLast,
      })
    })

    return breadcrumbs
  }, [pathname])

  const rootLabel = (
    <>
      <Home className="h-4 w-4" aria-hidden="true" />
      Dashboard
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
