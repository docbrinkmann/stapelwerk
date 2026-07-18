"use client"

import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Plus,
  Settings,
  Trash2,
  RefreshCw
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { trpc } from "@/utils/trpc"
import { formatDistanceToNow } from "date-fns"

/**
 * Recent Activity Component
 * 
 * Displays a feed of recent user actions and system events.
 * Shows deployment status, stack changes, and service updates.
 */

interface ActivityItem {
  id: string
  type: "deployment" | "create" | "update" | "delete" | "error"
  title: string
  description: string
  timestamp: string
  status?: "success" | "pending" | "error"
}

interface RecentActivityProps {
  activities?: ActivityItem[]
}

const defaultActivities: ActivityItem[] = [
  {
    id: "1",
    type: "deployment",
    title: "Production Stack deployed",
    description: "nginx, redis, postgres services started",
    timestamp: "2 minutes ago",
    status: "success",
  },
  {
    id: "2",
    type: "create",
    title: "New stack created",
    description: "Development environment with Node.js",
    timestamp: "15 minutes ago",
    status: "success",
  },
  {
    id: "3",
    type: "update",
    title: "Service configuration updated",
    description: "Redis memory limit increased to 2GB",
    timestamp: "1 hour ago",
    status: "success",
  },
  {
    id: "4",
    type: "deployment",
    title: "Staging Stack deployment",
    description: "Waiting for health checks...",
    timestamp: "2 hours ago",
    status: "pending",
  },
  {
    id: "5",
    type: "error",
    title: "Database backup failed",
    description: "Insufficient disk space on backup volume",
    timestamp: "3 hours ago",
    status: "error",
  },
  {
    id: "6",
    type: "delete",
    title: "Test stack removed",
    description: "Cleanup of temporary development stack",
    timestamp: "5 hours ago",
    status: "success",
  },
]

const getActivityIcon = (type: ActivityItem["type"], status?: ActivityItem["status"]) => {
  if (status === "error") return <AlertCircle className="h-4 w-4 text-destructive" />
  if (status === "pending") return <Clock className="h-4 w-4 text-warning animate-pulse" />
  
  switch (type) {
    case "deployment":
      return <RefreshCw className="h-4 w-4 text-info" />
    case "create":
      return <Plus className="h-4 w-4 text-success" />
    case "update":
      return <Settings className="h-4 w-4 text-info" />
    case "delete":
      return <Trash2 className="h-4 w-4 text-muted-foreground" />
    default:
      return <CheckCircle2 className="h-4 w-4 text-success" />
  }
}

export function RecentActivity({
  activities = defaultActivities,
  isLoading = false,
}: RecentActivityProps & { isLoading?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Latest actions and deployments across your stacks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="flex h-full items-center justify-center py-12 text-sm text-muted-foreground">
              No activity yet — deploy or update a stack to see it here.
            </div>
          ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="mt-0.5">
                  {getActivityIcon(activity.type, activity.status)}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {activity.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activity.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

/**
 * RecentActivity wired to the analytics router.
 * Maps stack updates and deployment jobs into the activity feed;
 * shows the empty state when the query fails (e.g. unauthenticated in dev).
 */
export function RecentActivityLive() {
  const { data, isLoading } = trpc.analytics.getRecentActivity.useQuery(
    { limit: 20 },
    { staleTime: 60 * 1000, retry: false }
  )

  const activities: ActivityItem[] = (data ?? []).map((entry: any) => {
    const status: ActivityItem["status"] =
      entry.metadata?.status === "failed" || entry.metadata?.status === "error"
        ? "error"
        : entry.metadata?.status === "pending" || entry.metadata?.status === "running"
          ? "pending"
          : "success"
    return {
      id: entry.id,
      type: entry.type === "deployment" ? "deployment" : "update",
      title: entry.title,
      description: entry.description,
      timestamp: entry.timestamp
        ? formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })
        : "",
      status,
    }
  })

  return <RecentActivity activities={activities} isLoading={isLoading} />
}
