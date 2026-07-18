'use client'

import React, { useEffect, useRef } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  return (
    <main role="alert" className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold mb-2">Unable to load Stack Builder</h1>
      <p className="text-muted-foreground mb-4">An error occurred while loading this page. You can retry below.</p>
      <div className="flex gap-3">
        <button onClick={() => reset()} className="px-4 py-2 rounded bg-primary text-primary-foreground">Try again</button>
        <a href="/" className="px-4 py-2 rounded border">Go home</a>
      </div>
    </main>
  )
}