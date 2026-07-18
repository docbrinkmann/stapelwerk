"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import {
  LayoutDashboard,
  Layers,
  Server,
  Rocket,
  Settings,
  ShieldCheck,
  Network,
} from "lucide-react"

import { NavMain } from "@/components/layout/nav-main"
import { NavStacks } from "@/components/layout/nav-stacks"
import { NavUser } from "@/components/layout/nav-user"
import { SidebarHeader } from "@/components/layout/sidebar-header"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar"
import { trpc } from "@/utils/trpc"

/**
 * App Sidebar Component
 *
 * Main sidebar navigation component for the dashboard.
 * Implements Dokploy/Coolify-style navigation with:
 * - Collapsible icon-only mode
 * - Primary navigation (Dashboard, Stacks, Services, etc.)
 * - User stacks section
 * - User profile menu
 *
 * @example
 * ```tsx
 * <SidebarProvider>
 *   <AppSidebar />
 *   <SidebarInset>
 *     {children}
 *   </SidebarInset>
 * </SidebarProvider>
 * ```
 */

// Navigation items for main menu
const mainNavItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: "Stacks",
    url: "/stacks",
    icon: Layers,
  },
  {
    title: "Network",
    url: "/network",
    icon: Network,
  },
  {
    title: "Stack Builder",
    url: "/stack-builder",
    icon: Rocket,
  },
  {
    title: "Services",
    url: "/services",
    icon: Server,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
  {
    title: "Admin",
    url: "/admin/templates",
    icon: ShieldCheck,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()
  const user = {
    name: session?.user?.name ?? "User",
    email: session?.user?.email ?? "",
  }

  // Quick links to the user's most recent stacks
  const { data: stackList } = trpc.stacks.list.useQuery(
    { limit: 3 },
    { staleTime: 60 * 1000, retry: false }
  )
  const userStacks = (stackList?.stacks ?? []).map((stack: { id: string; name: string }) => ({
    name: stack.name,
    url: `/stacks/${stack.id}`,
  }))

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader />
      <SidebarContent>
        <NavMain items={mainNavItems} />
        <NavStacks stacks={userStacks} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
