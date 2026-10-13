'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { trpc } from '@/trpc/react-client'
import { useT } from '@/lib/i18n/client'
import { AuthAlert, AuthCard, AuthLink } from '../auth-card'

/** Landing page of both mailed links: finish sign-up, or reset a password. */
function SetPasswordForm() {
  const t = useT()
  const router = useRouter()
  const token = useSearchParams()?.get('token') ?? ''
  const setPassword = trpc.auth.setPassword.useMutation()
  const [error, setError] = useState<string | null>(null)
  const [linkDead, setLinkDead] = useState(!token)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const password = String(data.get('password') || '')
    if (password.length < 10) return setError(t('landing.setPasswordTooShort'))
    if (password !== String(data.get('confirm') || '')) return setError(t('landing.setPasswordMismatch'))
    setError(null)
    setPassword.mutate(
      { token, password },
      {
        onSuccess: async ({ email }) => {
          const res = await signIn('credentials', { email, password, redirect: false })
          router.push((res?.error ? '/auth/signin?password=set' : '/dashboard') as never)
          router.refresh()
        },
        onError: (err) => {
          if ((err as { data?: { code?: string } }).data?.code === 'BAD_REQUEST') setLinkDead(true)
          else setError(t('landing.authErrorGeneric'))
        },
      },
    )
  }

  if (linkDead) {
    return (
      <AuthCard title={t('landing.setPasswordTitle')}>
        <AuthAlert tone="error">{token ? t('landing.setPasswordInvalid') : t('landing.setPasswordMissingToken')}</AuthAlert>
        <p className="mt-4 text-center text-sm">
          <AuthLink href="/auth/forgot-password">{t('landing.requestNewLink')}</AuthLink>
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard title={t('landing.setPasswordTitle')} subtitle={t('landing.setPasswordSubtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        <div className="space-y-2">
          <Label htmlFor="password">{t('landing.setPasswordNew')}</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required disabled={setPassword.isPending} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">{t('landing.setPasswordConfirm')}</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required disabled={setPassword.isPending} />
        </div>
        <Button type="submit" className="w-full" disabled={setPassword.isPending}>
          {setPassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {t('landing.setPasswordSubmit')}
        </Button>
      </form>
    </AuthCard>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  )
}
