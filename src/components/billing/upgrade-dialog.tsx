"use client"

import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { PLAN_PRICING, planFeatureBullets, type PlanId } from "@/lib/plans"
import { Check } from "lucide-react"

/** The plan-limit context surfaced by the tRPC errorFormatter (data.planLimit). */
export interface PlanLimitInfo {
  limit: number | null
  plan: string | null
}

/**
 * Read a PLAN_LIMIT gate off a tRPC error, or null. Callers do:
 *   onError: (e) => { const pl = planLimitFromError(e); if (pl) setUpgrade(pl) }
 */
export function planLimitFromError(err: unknown): PlanLimitInfo | null {
  const data = (err as { data?: { planLimit?: PlanLimitInfo | null } })?.data
  return data?.planLimit ?? null
}

interface UpgradeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  info: PlanLimitInfo | null
  /** Which plan to pitch (default: pro). */
  suggest?: PlanId
}

export function UpgradeDialog({ open, onOpenChange, info, suggest = "pro" }: UpgradeDialogProps) {
  const target = PLAN_PRICING[suggest]
  const bullets = planFeatureBullets(suggest)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade to {target.name}</DialogTitle>
          <DialogDescription>
            {info?.limit != null
              ? `You've reached your plan's limit of ${info.limit}. ${target.tagline}`
              : target.tagline}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-foreground">
              <Check className="h-4 w-4 mt-0.5 text-success shrink-0" aria-hidden="true" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <p className="text-sm text-muted-foreground">
          {target.name} is €{target.priceMonthly}/month.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button asChild>
            <Link href={"/pricing" as never} data-testid="upgrade-cta">See plans</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
