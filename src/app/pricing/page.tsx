"use client"

import Link from "next/link"
import { Check, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PLAN_PRICING, planFeatureBullets, SUPPORTER_PRICE_YEARLY, VERIFIED_DEPLOY_PRICE } from "@/lib/plans"

// Gate G: the hosted instance sells no monthly deploy plans (Pro/Fleet) — direct
// deploy there is admin-only. Offer = free composer + one-time €29 + supporter,
// same as the landing page.
export default function PricingPage() {
  const free = PLAN_PRICING.free

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Simple, honest pricing</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Composing, checking and exporting are <span className="text-foreground font-medium">free forever</span>.
          Pay for the part that&apos;s hard to get right: a deploy we <span className="text-foreground font-medium">verify</span> —
          leak-proof VPN kill-switch and all.
        </p>
      </div>

      <div className="mt-12 flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm" data-testid="plan-card-free">
        <h2 className="text-xl font-semibold text-foreground">{free.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{free.tagline}</p>
        <div className="mt-4">
          <span className="text-4xl font-bold text-foreground">€0</span>
        </div>

        <ul className="mt-6 flex-1 space-y-2 text-sm">
          {planFeatureBullets("free").map((b) => (
            <li key={b} className="flex items-start gap-2 text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <Button asChild className="mt-6 w-full md:w-auto md:self-start" variant="outline">
          {/* routes exist; cast matches the repo's typed-route convention */}
          <Link href={"/auth/signup" as never}>Create a free account</Link>
        </Button>
      </div>

      {/* One-time verified deploy — the lead paid outcome (v2 thesis) */}
      <div className="mt-8 rounded-xl border border-primary/40 bg-primary/5 p-6" data-testid="verified-deploy-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-xl font-semibold text-foreground">Verified deploy</h2>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">one-time</span>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              A provenance-signed report that your stack is deploy-safe by construction — the VPN kill-switch confines
              the download client to gluetun&apos;s firewall (no real-IP leak if the tunnel drops), plus a safety audit:
              no datastore exposed on the host network, datastores keep their data, no default secrets, images pinned. You
              keep and run the compose (free forever); this is the signed proof, verifiable with our public key. Your
              machine drives your server over your own SSH — we never hold your keys.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-3xl font-bold text-foreground">
              €{VERIFIED_DEPLOY_PRICE}
              <span className="text-base text-muted-foreground"> once</span>
            </div>
            <Button asChild className="mt-2">
              <Link href={"/stacks" as never}>Get a verified deploy</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Self-host supporter — sustainability, NOT a feature unlock */}
      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Self-host supporter</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Stapelwerk is AGPL-3.0 and a self-hosted build already has{" "}
              <strong className="text-foreground">every feature, no gates</strong>. This optional license
              funds development — signed builds, priority updates, and your name in SUPPORTERS. It is a
              thank-you, not a feature unlock.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-3xl font-bold text-foreground">€{SUPPORTER_PRICE_YEARLY}<span className="text-base text-muted-foreground">/year</span></div>
            <Button asChild variant="outline" className="mt-2">
              <Link href={"/settings/billing" as never}>Support the project</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
