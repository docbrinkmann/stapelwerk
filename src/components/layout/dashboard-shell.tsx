import { redirect } from "next/navigation"
import type { Route } from "next"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import ThemeToggle from "@/components/ui/theme-toggle"
import { Breadcrumbs } from "@/components/navigation/breadcrumbs"
import { getPageSession } from "@/lib/auth"

/**
 * Shared dashboard shell: sidebar + header (breadcrumbs, theme toggle).
 * Used by both the /dashboard page layout and the (dashboard) route group.
 * Requires an authenticated session (unless auth is disabled for local dev).
 */
export async function DashboardShell({
  children,
  mainClassName = "flex-1 p-4 md:p-6",
}: {
  children: React.ReactNode
  mainClassName?: string
}) {
  if (process.env.NEXT_PUBLIC_APP_DISABLE_AUTH !== "true") {
    const session = await getPageSession()
    if (!session) redirect("/auth/signin" as Route)
  }
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <main className={mainClassName}>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
