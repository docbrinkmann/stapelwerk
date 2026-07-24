"use client"

import * as React from "react"

import {
  SidebarHeader as SidebarHeaderPrimitive,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useT } from "@/lib/i18n/client"

/**
 * Sidebar Header Component
 *
 * Displays the Stapelwerk logo and a static "Personal" workspace label.
 * Stapelwerk is a single-user, self-hosted stack builder — there are no
 * organizations to switch between.
 */
export function SidebarHeader() {
  const t = useT()
  return (
    <SidebarHeaderPrimitive>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="pointer-events-none">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-foreground text-background">
              <span className="font-bold text-sm">B</span>
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">Stapelwerk</span>
              <span className="truncate text-xs text-muted-foreground">{t("shell.workspacePersonal")}</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeaderPrimitive>
  )
}
