'use client'

import Link from 'next/link'

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main role="alert" className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <h1 className="text-3xl font-semibold mb-3" tabIndex={-1}>Something went wrong</h1>
      <p className="text-muted-foreground mb-6 max-w-xl">
        An unexpected error occurred. You can try again, or return to the homepage.
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="px-4 py-2 rounded bg-primary text-primary-foreground">Try again</button>
        <Link href="/" className="px-4 py-2 rounded border">Go home</Link>
      </div>
    </main>
  )
}
