"use client"

import Link from "next/link"
import type { Route } from "next"
import { Plus, Layers, Server, FileText } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/client"

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

export function QuickActions() {
  const t = useT()
  const quickActions: QuickAction[] = [
    {
      title: t("shell.createStack"),
      description: t("shell.createStackDesc"),
      icon: Plus,
      href: "/stack-builder",
      variant: "default",
    },
    {
      title: t("shell.browseTemplates"),
      description: t("shell.browseTemplatesDesc"),
      icon: Layers,
      href: "/services",
      variant: "outline",
    },
    {
      title: t("shell.viewServices"),
      description: t("shell.viewServicesDesc"),
      icon: Server,
      href: "/services",
      variant: "outline",
    },
    {
      title: t("shell.documentation"),
      description: t("shell.documentationDesc"),
      icon: FileText,
      href: "/docs",
      variant: "outline",
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("shell.quickActions")}</CardTitle>
        <CardDescription>
          {t("shell.quickActionsDesc")}
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
