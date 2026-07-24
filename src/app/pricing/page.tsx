"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  PLAN_PRICING,
  planFeatureBullets,
  yearlyPrice,
  SUPPORTER_PRICE_YEARLY,
  VERIFIED_DEPLOY_PRICE,
  type PlanId,
} from "@/lib/plans"

const ORDER: PlanId[] = ["free", "pro", "fleet"]

export default function PricingPage() {
  const [yearly, setYearly] = useState(false)

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Simple, honest pricing</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Composing, checking and exporting are <span className="text-foreground font-medium">free forever</span>.
          Pay for the part that&apos;s hard to get right: a deploy we <span className="text-foreground font-medium">verify</span> —
          leak-proof VPN kill-switch and all.
        </p>

        {/* Billing period toggle */}
        <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setYearly(false)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              !yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={!yearly}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setYearly(true)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={yearly}
          >
            Yearly <span className="text-success">·2 months free</span>
          </button>
        </div>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {ORDER.map((id) => {
          const p = PLAN_PRICING[id]
          const price = p.priceMonthly === 0 ? 0 : yearly ? yearlyPrice(p.priceMonthly) : p.priceMonthly
          const unit = p.priceMonthly === 0 ? "" : yearly ? "/year" : "/month"
          return (
            <div
              key={id}
              data-testid={`plan-card-${id}`}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-6 shadow-sm",
                p.featured ? "border-primary ring-1 ring-primary" : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">{p.name}</h2>
                {p.featured && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Most popular
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">€{price}</span>
                <span className="text-muted-foreground">{unit}</span>
              </div>

              <ul className="mt-6 flex-1 space-y-2 text-sm">
                {planFeatureBullets(id).map((b) => (
                  <li key={b} className="flex items-start gap-2 text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <Button asChild className="mt-6 w-full" variant={p.featured ? "default" : "outline"}>
                {/* routes exist; cast matches the repo's typed-route convention */}
                <Link href={(id === "free" ? "/auth/signin" : "/settings/billing") as never}>
                  {id === "free" ? "Get started" : `Choose ${p.name}`}
                </Link>
              </Button>
            </div>
          )
        })}
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
              BuildMyStack is AGPL-3.0 and a self-hosted build already has{" "}
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
