"use client"

import { SettingsNav } from "./settings-nav"
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"

interface SettingsLayoutProps {
  children: React.ReactNode
  title: string
  description?: string
}

export function SettingsLayout({ 
  children, 
  title, 
  description 
}: SettingsLayoutProps) {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      <Separator />

      {/* Content Area */}
      <div className="flex flex-col md:flex-row gap-8">
        {/* Vertical Navigation */}
        <SettingsNav />

        {/* Main Content */}
        <div className="flex-1 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          
          <div className="rounded-lg border border-border bg-card p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
