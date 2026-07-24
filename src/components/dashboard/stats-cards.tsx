"use client"

import { Database, Layers, Rocket, Server } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { trpc } from "@/utils/trpc"
import { useT } from "@/lib/i18n/client"

/**
 * Stats Cards Component
 *
 * Displays key metrics in a responsive grid of cards.
 * Shape matches the analytics.getAnalytics router output.
 */

interface DashboardStats {
  totalStacks: number
  runningStacks: number
  totalServices: number
  storageUsed: number
}

interface StatsCardsProps {
  stats?: DashboardStats
  isLoading?: boolean
}

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B"
  const k = 1024
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1)
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`
}

export function StatsCards({ stats, isLoading = false }: StatsCardsProps) {
  const t = useT()
  const cards = [
    {
      title: t("shell.totalStacks"),
      value: String(stats?.totalStacks ?? 0),
      icon: Layers,
      description: t("shell.totalStacksDesc"),
    },
    {
      title: t("shell.runningStacks"),
      value: String(stats?.runningStacks ?? 0),
      icon: Rocket,
      description: t("shell.runningStacksDesc"),
    },
    {
      title: t("shell.servicesLabel"),
      value: String(stats?.totalServices ?? 0),
      icon: Server,
      description: t("shell.servicesDesc"),
    },
    {
      title: t("shell.storageUsed"),
      value: formatBytes(stats?.storageUsed ?? 0),
      icon: Database,
      description: t("shell.storageUsedDesc"),
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="mb-1 h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{card.value}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/**
 * StatsCards wired to the analytics router.
 * Shows zeros when the query fails (e.g. unauthenticated in dev).
 */
export function StatsCardsLive() {
  const { data, isLoading } = trpc.analytics.getAnalytics.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  return (
    <StatsCards
      isLoading={isLoading}
      stats={
        data
          ? {
              totalStacks: data.totalStacks,
              runningStacks: data.runningStacks,
              totalServices: data.totalServices,
              storageUsed: data.storageUsed,
            }
          : undefined
      }
    />
  )
}
