'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { trpc } from '@/trpc/react-client'
import { useLocale, useT } from '@/lib/i18n/client'
import { PRIVACY_URL } from '@/components/footer'
import { AuthAlert, AuthCard, AuthLink, authErrorKey, isEmail } from '../auth-card'

export default function SignUpPage() {
  const t = useT()
  const locale = useLocale()
  const config = trpc.auth.config.useQuery()
  const register = trpc.auth.register.useMutation()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = (email: string, name?: string): void => {
    setError(null)
    register.mutate(
      { email, name: name || undefined, locale },
      { onSuccess: () => setSentTo(email), onError: (e) => setError(t(authErrorKey(e))) },
    )
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const email = String(data.get('email') || '').trim()
    if (!isEmail(email)) {
      setError(t('landing.authEmailInvalid'))
      return
    }
    send(email, String(data.get('name') || '').trim())
  }

  const signInLink = (
    <p className="mt-4 text-center text-sm text-muted-foreground">
      {t('landing.signupHaveAccount')} <AuthLink href="/auth/signin">{t('landing.navSignIn')}</AuthLink>
    </p>
  )

  if (config.data && !config.data.signupEnabled) {
    return (
      <AuthCard title={t('landing.signupTitle')}>
        <p className="text-sm text-muted-foreground">{t('landing.signupDisabled')}</p>
        {signInLink}
      </AuthCard>
    )
  }

  if (sentTo) {
    return (
      <AuthCard title={t('landing.signupSentTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('landing.signupSentBody', { email: sentTo })}</p>
          {error && <AuthAlert tone="error">{error}</AuthAlert>}
          <Button variant="outline" className="w-full" disabled={register.isPending} onClick={() => send(sentTo)}>
            {register.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t('landing.signupResend')}
          </Button>
        </div>
        {signInLink}
      </AuthCard>
    )
  }

  return (
    <AuthCard title={t('landing.signupTitle')} subtitle={t('landing.signupSubtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        <div className="space-y-2">
          <Label htmlFor="email">{t('landing.signinEmail')}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder={t('landing.signinEmailPlaceholder')}
            disabled={register.isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">{t('landing.signupName')}</Label>
          <Input id="name" name="name" autoComplete="name" maxLength={100} disabled={register.isPending} />
        </div>
        <Button type="submit" className="w-full" disabled={register.isPending}>
          {register.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {t('landing.signupSubmit')}
        </Button>
        {PRIVACY_URL && (
          <p className="text-xs text-muted-foreground">
            {t('landing.signupPrivacy')}{' '}
            <a href={PRIVACY_URL} className="underline underline-offset-4 hover:text-foreground">
              {t('landing.signupPrivacyLink')}
            </a>
          </p>
        )}
      </form>
      {signInLink}
    </AuthCard>
  )
}
