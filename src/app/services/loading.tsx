'use client'

import { useT } from '@/lib/i18n/client'

export default function Loading() {
  const t = useT()
  return (
    <div role="region" aria-label={t('catalog.loadingServices')} className="p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-1/3 bg-muted rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}