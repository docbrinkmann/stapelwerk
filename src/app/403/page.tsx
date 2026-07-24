'use client'

import { useT } from '@/lib/i18n/client'

export default function ForbiddenPage() {
  const t = useT()
  return (
    <main role="main" className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <h1 className="text-3xl font-semibold mb-3">{t('landing.forbiddenTitle')}</h1>
      <p className="text-muted-foreground mb-6 max-w-xl">{t('landing.forbiddenBody')}</p>
      <div className="flex gap-3">
        <a href="/docs" className="px-4 py-2 rounded bg-primary text-primary-foreground">{t('landing.forbiddenHelp')}</a>
        <a href="/" className="px-4 py-2 rounded border">{t('landing.forbiddenHome')}</a>
      </div>
    </main>
  )
}
