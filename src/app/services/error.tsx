'use client'

import React, { useEffect, useRef } from 'react'
import { useT } from '@/lib/i18n/client'

export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  const t = useT()
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  return (
    <main role="alert" className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold mb-2">{t('catalog.errorTitle')}</h1>
      <p className="text-muted-foreground mb-4">{t('catalog.errorBody')}</p>
      <div className="flex gap-3">
        <button onClick={() => reset()} className="px-4 py-2 rounded bg-primary text-primary-foreground">{t('catalog.tryAgain')}</button>
        <a href="/" className="px-4 py-2 rounded border">{t('catalog.errorGoHome')}</a>
      </div>
    </main>
  )
}