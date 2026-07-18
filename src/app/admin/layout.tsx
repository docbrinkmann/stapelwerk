import { DashboardShell } from "@/components/layout/dashboard-shell"

/**
 * Admin pages live in the same app shell (sidebar + breadcrumbs) as the rest
 * of the dashboard — they used to render bare, which read as a broken page.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardShell>{children}</DashboardShell>
}
