import { redirect } from "next/navigation"
import type { Route } from "next"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { getPageSession } from "@/lib/auth"
import { getT } from "@/lib/i18n/server"

export default async function SettingsRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Same session guard as DashboardShell — settings pages are account-bound
  if (process.env.NEXT_PUBLIC_APP_DISABLE_AUTH !== "true") {
    const session = await getPageSession()
    if (!session) redirect("/auth/signin" as Route)
  }

  const t = await getT()
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-6">
          <SidebarTrigger className="-ml-2" />
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-lg font-semibold">{t('common.settings')}</h1>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
