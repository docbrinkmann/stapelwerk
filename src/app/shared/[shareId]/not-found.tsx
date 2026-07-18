import Link from 'next/link'

export default function NotFound() {
  return (
    <main aria-labelledby="nf-title" className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <h1 id="nf-title" className="text-3xl font-semibold mb-3">Shared stack not found</h1>
      <p className="text-muted-foreground mb-6 max-w-xl">The requested shared stack does not exist or is no longer available.</p>
      <Link href="/community" className="px-4 py-2 rounded bg-primary text-primary-foreground">Browse community stacks</Link>
    </main>
  )
}