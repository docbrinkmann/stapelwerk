"use client"

import Link from "next/link"
import { Check, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PLAN_PRICING, planFeatureBullets, SUPPORTER_PRICE_YEARLY, VERIFIED_DEPLOY_PRICE } from "@/lib/plans"
import { useT } from "@/lib/i18n/client"

// Gate G: the hosted instance sells no monthly deploy plans (Pro/Fleet) — direct
// deploy there is admin-only. Offer = free composer + one-time €29 + supporter,
// same as the landing page.
export default function PricingPage() {
  const t = useT()
  const free = PLAN_PRICING.free

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">{t("billing.pricingTitle")}</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {t("billing.pricingLeadPre")} <span className="text-foreground font-medium">{t("billing.pricingLeadFree")}</span>
          {t("billing.pricingLeadMid")} <span className="text-foreground font-medium">{t("billing.pricingLeadVerify")}</span>{" "}
          {t("billing.pricingLeadPost")}
        </p>
      </div>

      <div className="mt-12 flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm" data-testid="plan-card-free">
        <h2 className="text-xl font-semibold text-foreground">{free.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t(free.tagline)}</p>
        <div className="mt-4">
          <span className="text-4xl font-bold text-foreground">€0</span>
        </div>

        <ul className="mt-6 flex-1 space-y-2 text-sm">
          {planFeatureBullets("free", t).map((b) => (
            <li key={b} className="flex items-start gap-2 text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <Button asChild className="mt-6 w-full md:w-auto md:self-start" variant="outline">
          {/* routes exist; cast matches the repo's typed-route convention */}
          <Link href={"/auth/signup" as never}>{t("billing.createFreeAccount")}</Link>
        </Button>
      </div>

      {/* One-time verified deploy — the lead paid outcome (v2 thesis) */}
      <div className="mt-8 rounded-xl border border-primary/40 bg-primary/5 p-6" data-testid="verified-deploy-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-xl font-semibold text-foreground">{t("billing.verifiedTitle")}</h2>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{t("billing.oneTime")}</span>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t("billing.verifiedBody")}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-3xl font-bold text-foreground">
              €{VERIFIED_DEPLOY_PRICE}
              <span className="text-base text-muted-foreground"> {t("billing.once")}</span>
            </div>
            <Button asChild className="mt-2">
              <Link href={"/stacks" as never}>{t("billing.getVerified")}</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Self-host supporter — sustainability, NOT a feature unlock */}
      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{t("billing.supporterTitle")}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t("billing.supporterBodyPre")}{" "}
              <strong className="text-foreground">{t("billing.supporterBodyStrong")}</strong>
              {t("billing.supporterBodyPost")}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-3xl font-bold text-foreground">€{SUPPORTER_PRICE_YEARLY}<span className="text-base text-muted-foreground">{t("billing.perYear")}</span></div>
            <Button asChild variant="outline" className="mt-2">
              <Link href={"/settings/billing" as never}>{t("billing.supportProject")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
