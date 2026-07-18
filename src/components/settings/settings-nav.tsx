"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  User,
  Palette,
  type LucideIcon
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  description?: string
}

// ponytail: only pages that exist; add entries back when their pages ship
const navItems: NavItem[] = [
  {
    title: "Profile",
    href: "/settings/profile",
    icon: User,
    description: "Manage your profile information",
  },
  {
    title: "Appearance",
    href: "/settings/appearance",
    icon: Palette,
    description: "Customize the app appearance",
  },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 w-full md:w-64 shrink-0">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href as any}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              "hover:bg-muted/50",
              isActive
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export { navItems }
