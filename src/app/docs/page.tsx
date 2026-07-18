import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Help & Docs — BuildMyStack',
  description: 'How to compose, export and deploy a Docker stack with BuildMyStack.',
}

/**
 * In-app help page. Static, honest content about what BuildMyStack actually
 * does (a guided Docker Compose composer). Anchored sections back the help
 * links elsewhere in the app (#getting-started, #service-catalog, #support).
 */
export default function DocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Help &amp; Docs</h1>
      <p className="mt-2 text-muted-foreground">
        BuildMyStack helps you compose a curated, compatibility-checked Docker stack and
        export a ready-to-run <code className="rounded bg-muted px-1 py-0.5 text-sm">docker-compose.yml</code>.
      </p>

      <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-3 text-sm">
        <a href="#getting-started" className="text-primary hover:underline">Getting started</a>
        <a href="#service-catalog" className="text-primary hover:underline">Service catalog</a>
        <a href="#support" className="text-primary hover:underline">Getting help</a>
      </nav>

      <section id="getting-started" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold">Getting started</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>
            <Link href="/services" className="text-primary hover:underline">Browse the service catalog</Link> or
            start from a <Link href="/stack-builder" className="text-primary hover:underline">template in the Stack Builder</Link>.
          </li>
          <li>Add the services you need to a stack. The builder flags port and volume conflicts as you go.</li>
          <li>Configure each service — environment variables, ports and volumes. Required secrets are generated for you.</li>
          <li>Export the generated <code className="rounded bg-muted px-1 py-0.5 text-sm">docker-compose.yml</code> plus an <code className="rounded bg-muted px-1 py-0.5 text-sm">.env</code>, or hand it off to Portainer/Coolify/Dokploy.</li>
          <li>Optionally deploy it directly to a Docker host from the stack&apos;s Deploy tab and watch live logs.</li>
        </ol>
      </section>

      <section id="service-catalog" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold">Understanding the service catalog</h2>
        <p className="mt-3 text-muted-foreground">
          The catalog is a curated set of self-hostable services grouped by category (databases, media,
          networking, monitoring, …). Each service ships with real image, environment and volume metadata
          so the exported compose file actually runs. When you add services, BuildMyStack checks:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
          <li><strong>Compatibility</strong> — warns about combinations that clash (e.g. two reverse proxies on the same port).</li>
          <li><strong>Resource budget</strong> — sums CPU/RAM so you can tell whether the stack fits your Pi or server.</li>
          <li><strong>Required configuration</strong> — surfaces the secrets and volumes a service needs to start cleanly.</li>
        </ul>
      </section>

      <section id="support" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold">Getting help</h2>
        <p className="mt-3 text-muted-foreground">
          Every stack can generate its own README and troubleshooting notes from its
          Documentation view — that is the best place to start when a deployment misbehaves.
          Check the Deploy tab&apos;s live logs for the exact error from the Docker host.
        </p>
        <p className="mt-3 text-muted-foreground">
          Still stuck? Review your service configuration for missing required variables, confirm the
          host has enough free memory for the stack, and make sure the target ports aren&apos;t already in use.
        </p>
      </section>
    </main>
  )
}
