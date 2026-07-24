import Link from 'next/link'

export default function NotFound() {
  return (
    <main aria-labelledby="nf-title" className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <h1 id="nf-title" className="text-3xl font-semibold mb-3">Page not found</h1>
      <p className="text-muted-foreground mb-6 max-w-xl">The page you’re looking for doesn’t exist or may have moved.</p>
      <Link href="/" className="px-4 py-2 rounded bg-primary text-primary-foreground">Back to home</Link>
    </main>
  )
}