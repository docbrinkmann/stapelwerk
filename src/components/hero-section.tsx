'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, Layers, ShieldCheck, FileCode2 } from 'lucide-react'

/** A real, deployable compose snippet — the actual thing the app produces. */
const COMPOSE_PREVIEW = `services:
  jellyfin:
    image: jellyfin/jellyfin:latest
    ports: ["8096:8096"]
    volumes: ["media:/media", "config:/config"]
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]

volumes:
  media: {}
  config: {}
  pgdata: {}`

const FEATURES = [
  {
    icon: Layers,
    title: 'A curated catalog',
    body: 'Self-hostable services that ship with real image, environment and volume metadata — so the export actually starts.',
  },
  {
    icon: ShieldCheck,
    title: 'Checked as you build',
    body: 'Port and volume conflicts flagged live, plus a resource budget that tells you whether it fits your Pi or server.',
  },
  {
    icon: FileCode2,
    title: 'Yours to keep',
    body: 'A clean compose file you own — run it anywhere, or hand it straight to Coolify, Portainer or Dokploy.',
  },
]

export default function HeroSection() {
  const router = useRouter()

  return (
    <section className="border-b border-border/60 bg-background" aria-label="Introduction">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pt-28">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Open source · runs on your own hardware
        </div>

        <div className="mt-6 grid items-start gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.05]">
              Build a Docker stack that actually runs.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Pick from a curated catalog, get compatibility and resource checks as you go, and
              export a clean{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                docker-compose.yml
              </code>{' '}
              — or hand it straight to Coolify, Portainer or Dokploy.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => router.push('/stack-builder')}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                Start building
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => router.push('/services')}
                className="inline-flex items-center rounded-lg border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Browse the catalog
              </button>
            </div>
          </div>

          {/* The real output, shown as a compose file in an editor frame. */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
              <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
              <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
              <span className="ml-2 inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
                docker-compose.yml
              </span>
            </div>
            <div className="overflow-x-auto">
              <pre className="px-4 py-4 text-[0.8rem] leading-relaxed">
                <code className="font-mono text-muted-foreground">{COMPOSE_PREVIEW}</code>
              </pre>
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-8 border-t border-border/60 pt-12 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-base font-medium text-foreground">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
