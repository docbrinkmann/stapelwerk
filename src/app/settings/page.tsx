"use client"

import { SettingsLayout } from "@/components/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  User,
  Palette,
  ChevronRight
} from "lucide-react"
import Link from "next/link"
import { useT } from "@/lib/i18n/client"

// ponytail: only pages that exist; add sections back when their pages ship
const settingsSections = [
  {
    titleKey: "catalog.settingsProfile",
    descriptionKey: "catalog.settingsProfileDesc",
    href: "/settings/profile",
    icon: User,
  },
  {
    titleKey: "catalog.settingsAppearance",
    descriptionKey: "catalog.settingsAppearanceDesc",
    href: "/settings/appearance",
    icon: Palette,
  },
] as const

export default function SettingsPage() {
  const t = useT()
  return (
    <SettingsLayout
      title={t('catalog.settingsGeneralTitle')}
      description={t('catalog.settingsGeneralDesc')}
    >
      <div className="space-y-6">
        {/* Quick Settings Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {settingsSections.map((section) => {
            const Icon = section.icon
            return (
              <Link
                key={section.href}
                href={section.href as any}
                className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
                <div>
                  <h3 className="font-medium">{t(section.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t(section.descriptionKey)}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </SettingsLayout>
  )
}
