'use client'

import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Server, 
  Key, 
  History, 
  ScrollText, 
  Terminal,
  Settings
} from 'lucide-react'
import { useT } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/messages'

const tabs: Array<{ labelKey: MessageKey; href: string; icon: typeof LayoutDashboard }> = [
  { labelKey: 'ops.tabOverview', href: '', icon: LayoutDashboard },
  { labelKey: 'ops.tabServices', href: '/services', icon: Server },
  { labelKey: 'ops.tabEnvironment', href: '/env', icon: Key },
  { labelKey: 'ops.tabDeployments', href: '/deployments', icon: History },
  { labelKey: 'ops.tabLogs', href: '/logs', icon: ScrollText },
  { labelKey: 'ops.tabTerminal', href: '/terminal', icon: Terminal },
  { labelKey: 'common.settings', href: '/settings', icon: Settings },
]

export default function StackDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useT()
  const params = useParams()
  const pathname = usePathname()
  const stackId = params.stackId as string
  const basePath = `/stacks/${stackId}`

  const getCurrentTab = () => {
    const currentPath = pathname.replace(basePath, '') || ''
    return tabs.find(tab => 
      tab.href === currentPath || 
      (tab.href !== '' && currentPath.startsWith(tab.href))
    )?.href || ''
  }

  const currentTab = getCurrentTab()

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="flex space-x-1 px-4" aria-label={t('ops.stackNav')}>
          {tabs.map((tab) => {
            const isActive = tab.href === currentTab
            const Icon = tab.icon
            return (
              <Link
                key={tab.labelKey}
                href={`${basePath}${tab.href}` as any}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" />
                {t(tab.labelKey)}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-6">
        {children}
      </div>
    </div>
  )
}
