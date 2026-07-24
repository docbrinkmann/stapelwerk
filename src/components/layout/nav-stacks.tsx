"use client"

import Link from "next/link"
import type { Route } from "next"
import { Layers, MoreHorizontal, Plus } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useT } from "@/lib/i18n/client"

/**
 * Nav Stacks Component
 *
 * Collapsible section showing quick links to the user's stacks.
 */

interface NavStacksProps {
  stacks: {
    name: string
    url: string
  }[]
}

export function NavStacks({ stacks }: NavStacksProps) {
  const t = useT()
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{t("shell.yourStacks")}</SidebarGroupLabel>
      <SidebarGroupAction title={t("shell.addStack")} asChild>
        <Link href="/stack-builder">
          <Plus className="size-4" />
          <span className="sr-only">{t("shell.addStack")}</span>
        </Link>
      </SidebarGroupAction>
      <SidebarGroupContent>
        <SidebarMenu>
          {stacks.map((stack) => (
            <SidebarMenuItem key={stack.url}>
              <SidebarMenuButton asChild>
                <Link href={stack.url as Route}>
                  <Layers className="size-4" />
                  <span>{stack.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="text-sidebar-foreground/70">
              <Link href={"/stacks" as Route}>
                <MoreHorizontal className="text-sidebar-foreground/70" />
                <span>{t("shell.browseAllStacks")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
