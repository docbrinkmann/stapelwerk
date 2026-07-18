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
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Your Stacks</SidebarGroupLabel>
      <SidebarGroupAction title="Add Stack" asChild>
        <Link href="/stack-builder">
          <Plus className="size-4" />
          <span className="sr-only">Add Stack</span>
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
                <span>Browse All Stacks</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
