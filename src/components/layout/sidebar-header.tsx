"use client"

import * as React from "react"

import {
  SidebarHeader as SidebarHeaderPrimitive,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

/**
 * Sidebar Header Component
 *
 * Displays the BuildMyStack logo and a static "Personal" workspace label.
 * BuildMyStack is a single-user, self-hosted stack builder — there are no
 * organizations to switch between.
 */
export function SidebarHeader() {
  return (
    <SidebarHeaderPrimitive>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="pointer-events-none">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-foreground text-background">
              <span className="font-bold text-sm">B</span>
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">BuildMyStack</span>
              <span className="truncate text-xs text-muted-foreground">Personal</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeaderPrimitive>
  )
}
