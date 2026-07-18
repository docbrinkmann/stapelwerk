"use client"

import Link from "next/link"
import type { Route } from "next"
import { Plus, Layers, Server, FileText } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

/**
 * Quick Actions Component
 * 
 * Provides quick access to common dashboard actions.
 * Create stack, browse templates, and other frequent tasks.
 */

interface QuickAction {
  title: string
  description: string
  icon: typeof Plus
  href: string
  variant?: "default" | "outline"
}

const quickActions: QuickAction[] = [
  {
    title: "Create Stack",
    description: "Start a new stack from scratch",
    icon: Plus,
    href: "/stack-builder",
    variant: "default",
  },
  {
    title: "Browse Templates",
    description: "Explore community templates",
    icon: Layers,
    href: "/services",
    variant: "outline",
  },
  {
    title: "View Services",
    description: "Manage your running services",
    icon: Server,
    href: "/services",
    variant: "outline",
  },
  {
    title: "Documentation",
    description: "Learn how to use BuildMyStack",
    icon: FileText,
    href: "/docs",
    variant: "outline",
  },
]

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>
          Common tasks to get you started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {quickActions.map((action) => (
            <Button
              key={action.title}
              variant={action.variant}
              className="h-auto flex-col items-start gap-1 p-4"
              asChild
            >
              <Link href={action.href as Route}>
                <div className="flex w-full items-center gap-2">
                  <action.icon className="h-4 w-4" />
                  <span className="font-semibold">{action.title}</span>
                </div>
                <span
                  className={`text-xs font-normal ${
                    // muted-foreground is unreadable on the solid primary CTA
                    action.variant === "default"
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground"
                  }`}
                >
                  {action.description}
                </span>
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
