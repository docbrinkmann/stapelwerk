import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import ThemeToggle from "@/components/ui/theme-toggle"
import LanguageToggle from "@/components/ui/language-toggle"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb"
import { getT } from "@/lib/i18n/server"

/**
 * Services Layout
 *
 * Layout wrapper for service browser pages.
 * Uses the same sidebar navigation as the dashboard.
 */
export default async function ServicesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getT()
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard">
                  {t('catalog.breadcrumbDashboard')}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <span className="text-muted-foreground">/</span>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbLink href="/services">
                  {t('catalog.services')}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
