import { DashboardShell } from "@/components/layout/dashboard-shell"

/**
 * Dashboard Layout
 *
 * Layout wrapper for all dashboard pages.
 * Provides the sidebar navigation and header with breadcrumbs.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardShell>{children}</DashboardShell>
}
