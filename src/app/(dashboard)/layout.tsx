import { DashboardShell } from "@/components/layout/dashboard-shell"

/**
 * Layout for the (dashboard) route group (e.g. /stacks/[stackId]/*).
 * Unpadded main: the stack detail layout renders its own flush tab bar
 * and pads its content area itself.
 */
export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardShell mainClassName="flex flex-1 flex-col">
      {children}
    </DashboardShell>
  )
}
