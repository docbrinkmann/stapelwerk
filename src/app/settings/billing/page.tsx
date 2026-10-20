"use client"

import Link from "next/link"
import { SettingsLayout } from "@/components/settings"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { trpc } from "@/utils/trpc"
import { useT } from "@/lib/i18n/client"

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
}

export default function BillingSettingsPage() {
  const t = useT()
  const me = trpc.users.me.useQuery(undefined, { refetchOnWindowFocus: false })
  const data = me.data as
    | { billingEnabled: boolean; plan?: string; planValidUntil?: string | Date | null; manageUrl?: string | null }
    | null
    | undefined

  return (
    <SettingsLayout title={t("billing.settingsTitle")} description={t("billing.settingsDescription")}>
      {me.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !data?.billingEnabled ? (
        // Self-host build: no gates, no billing.
        <div className="space-y-2">
          <p className="text-sm text-foreground">
            {t("billing.selfHostPre")} <strong>{t("billing.selfHostStrong")}</strong>.
          </p>
          <p className="text-sm text-muted-foreground">
            {t("billing.selfHostSupport")}{" "}
            <Link href={"/pricing" as never} className="text-primary hover:underline">{t("billing.seeSupporterLicense")}</Link>.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t("billing.currentPlan")}</p>
              <p className="text-lg font-semibold capitalize text-foreground" data-testid="current-plan">
                {data.plan ?? "free"}
              </p>
            </div>
            {(data.plan === "free" || !data.plan) && (
              <Button asChild>
                <Link href={"/pricing" as never}>{t("billing.upgrade")}</Link>
              </Button>
            )}
          </div>

          {data.plan && data.plan !== "free" && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("billing.renewsUntil")}</p>
                  <p className="text-sm text-foreground">{formatDate(data.planValidUntil)}</p>
                </div>
                {data.manageUrl && (
                  <Button asChild variant="outline">
                    <a href={data.manageUrl} target="_blank" rel="noopener noreferrer">{t("billing.manageSubscription")}</a>
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
