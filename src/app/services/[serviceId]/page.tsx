import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { appRouter } from '@/server/root'
import { createTRPCContext } from '@/server/trpc'
import { ArrowLeft, ExternalLink, Server, HardDrive, Network, KeyRound } from 'lucide-react'
import { asArray, portLabel, volumeLabel } from '@/lib/service-detail'

export const dynamic = 'force-dynamic'

async function getService(id: number) {
  const ctx = await createTRPCContext({})
  const caller = appRouter.createCaller(ctx)
  try {
    return await caller.services.get({ id })
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ serviceId: string }> }): Promise<Metadata> {
  const { serviceId } = await params
  const svc = Number.isFinite(Number(serviceId)) ? await getService(Number(serviceId)) : null
  return { title: svc ? `${(svc as any).name} — BuildMyStack` : 'Service — BuildMyStack' }
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params
  const id = Number(serviceId)
  if (!Number.isFinite(id) || id <= 0) notFound()

  const service = (await getService(id)) as any
  if (!service) notFound()

  const ports = asArray(service.ports)
  const envVars = asArray(service.environmentVariables)
  const volumes = asArray(service.volumes)
  const image = service.version && service.version !== 'latest' && !String(service.dockerImage).includes(':')
    ? `${service.dockerImage}:${service.version}`
    : service.dockerImage

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/services" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to catalog
      </Link>

      <div className="mt-6 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
          <Server className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{service.name}</h1>
          {service.categories?.name && (
            <span className="mt-2 inline-flex rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              {service.categories.name}
            </span>
          )}
        </div>
      </div>

      {service.description && (
        <p className="mt-5 leading-relaxed text-muted-foreground">{service.description}</p>
      )}

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Image</dt>
          <dd className="mt-1 font-mono text-sm text-foreground">{image}</dd>
        </div>
        {service.documentationUrl && (
          <div>
            <dt className="text-sm text-muted-foreground">Documentation</dt>
            <dd className="mt-1">
              <a
                href={service.documentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-info hover:underline"
              >
                Official docs
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </dd>
          </div>
        )}
      </dl>

      {ports.length > 0 && (
        <Section title="Ports" icon={Network}>
          <ul className="flex flex-wrap gap-2">
            {ports.map((p: any, i: number) => (
              <li key={i} className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {portLabel(p)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {envVars.length > 0 && (
        <Section title="Environment variables" icon={KeyRound}>
          <ul className="space-y-1">
            {envVars.map((e: any, i: number) => (
              <li key={i} className="font-mono text-xs text-muted-foreground">
                {typeof e === 'object' ? (e.name ?? e.key ?? JSON.stringify(e)) : String(e)}
                {e?.required ? <span className="ml-1 text-warning">(required)</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {volumes.length > 0 && (
        <Section title="Volumes" icon={HardDrive}>
          <ul className="space-y-1">
            {volumes.map((v: any, i: number) => (
              <li key={i} className="font-mono text-xs text-muted-foreground">
                {volumeLabel(v)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/stack-builder"
          className="inline-flex items-center rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Add it in the Stack Builder
        </Link>
        <Link
          href="/services"
          className="inline-flex items-center rounded-lg border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Browse more services
        </Link>
      </div>
    </main>
  )
}
