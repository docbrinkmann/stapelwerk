"use client"

import Link from "next/link"
import { SettingsLayout } from "@/components/settings"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { trpc } from "@/utils/trpc"

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
}

export default function BillingSettingsPage() {
  const me = trpc.users.me.useQuery(undefined, { refetchOnWindowFocus: false })
  const data = me.data as
    | { billingEnabled: boolean; plan?: string; planValidUntil?: string | Date | null; manageUrl?: string | null }
    | null
    | undefined

  return (
    <SettingsLayout title="Billing" description="Your plan and subscription.">
      {me.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data?.billingEnabled ? (
        // Self-host build: no gates, no billing.
        <div className="space-y-2">
          <p className="text-sm text-foreground">
            This is a self-hosted build — <strong>every feature is enabled, with no plan limits</strong>.
          </p>
          <p className="text-sm text-muted-foreground">
            Billing only applies to the hosted instance. Want to support development?{" "}
            <Link href={"/pricing" as never} className="text-primary hover:underline">See the supporter license</Link>.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current plan</p>
              <p className="text-lg font-semibold capitalize text-foreground" data-testid="current-plan">
                {data.plan ?? "free"}
              </p>
            </div>
            {(data.plan === "free" || !data.plan) && (
              <Button asChild>
                <Link href={"/pricing" as never}>Upgrade</Link>
              </Button>
            )}
          </div>

          {data.plan && data.plan !== "free" && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Renews / valid until</p>
                  <p className="text-sm text-foreground">{formatDate(data.planValidUntil)}</p>
                </div>
                {data.manageUrl && (
                  <Button asChild variant="outline">
                    <a href={data.manageUrl} target="_blank" rel="noopener noreferrer">Manage subscription</a>
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </SettingsLayout>
  )
}
