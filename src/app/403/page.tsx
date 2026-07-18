export default function ForbiddenPage() {
  return (
    <main role="main" className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <h1 className="text-3xl font-semibold mb-3">Access denied</h1>
      <p className="text-muted-foreground mb-6 max-w-xl">You don’t have permission to view this page. It may require an admin account, or you may need to sign in.</p>
      <div className="flex gap-3">
        <a href="/docs" className="px-4 py-2 rounded bg-primary text-primary-foreground">Get help</a>
        <a href="/" className="px-4 py-2 rounded border">Go home</a>
      </div>
    </main>
  )
}