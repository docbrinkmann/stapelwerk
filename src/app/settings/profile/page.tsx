"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { SettingsLayout } from "@/components/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { trpc } from "@/utils/trpc"
import { useT } from "@/lib/i18n/client"

function initialsOf(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email || ""
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase() || "?"
}

// ponytail: profile = display name only; grow the form when the schema grows
export default function ProfileSettingsPage() {
  const t = useT()
  const { data: session, update: updateSession } = useSession()
  const me = trpc.users.me.useQuery(undefined, { refetchOnWindowFocus: false })
  const [name, setName] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (me.data?.name != null) setName(me.data.name)
  }, [me.data?.name])

  const updateProfile = trpc.users.updateProfile.useMutation({
    onSuccess: async () => {
      setSaved(true)
      await me.refetch()
      await updateSession?.()
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const email = me.data?.email ?? session?.user?.email ?? ""
  const displayName = me.data?.name ?? session?.user?.name ?? ""

  return (
    <SettingsLayout
      title={t('catalog.settingsProfile')}
      description={t('catalog.settingsProfileManageDesc')}
    >
      <div className="space-y-8">
        {/* Identity */}
        <div className="flex items-center gap-6">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-lg">
              {initialsOf(displayName, email)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{displayName || t('catalog.unnamedUser')}</p>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        </div>

        <Separator />

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">{t('catalog.basicInformation')}</h3>

          <div className="space-y-2">
            <Label htmlFor="name">{t('catalog.displayName')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('catalog.yourNamePlaceholder')}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('catalog.emailLabel')}</Label>
            <Input id="email" type="email" value={email} readOnly disabled />
            <p className="text-xs text-muted-foreground">
              {t('catalog.emailImmutableNote')}
            </p>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          {saved && <span className="text-sm text-success">{t('catalog.savedIndicator')}</span>}
          {updateProfile.error && (
            <span className="text-sm text-destructive" role="alert">
              {updateProfile.error.message}
            </span>
          )}
          <Button
            onClick={() => updateProfile.mutate({ name })}
            disabled={updateProfile.isPending || !name.trim() || name === (me.data?.name ?? "")}
          >
            {updateProfile.isPending ? t('catalog.saving') : t('catalog.saveChanges')}
          </Button>
        </div>
      </div>
    </SettingsLayout>
  )
}
