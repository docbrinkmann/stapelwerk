'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { trpc } from '@/trpc/react-client'
import { useLocale, useT } from '@/lib/i18n/client'
import { AuthAlert, AuthCard, AuthLink, authErrorKey, isEmail } from '../auth-card'

export default function ForgotPasswordPage() {
  const t = useT()
  const locale = useLocale()
  const request = trpc.auth.requestPasswordReset.useMutation()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email') || '').trim()
    if (!isEmail(email)) {
      setError(t('landing.authEmailInvalid'))
      return
    }
    setError(null)
    request.mutate(
      { email, locale },
      { onSuccess: () => setSentTo(email), onError: (err) => setError(t(authErrorKey(err))) },
    )
  }

  return (
    <AuthCard title={t('landing.forgotTitle')} subtitle={sentTo ? undefined : t('landing.forgotSubtitle')}>
      {sentTo ? (
        <AuthAlert tone="success">{t('landing.forgotSentBody', { email: sentTo })}</AuthAlert>
      ) : (
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
              disabled={request.isPending}
            />
          </div>
          <Button type="submit" className="w-full" disabled={request.isPending}>
            {request.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t('landing.forgotSubmit')}
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <AuthLink href="/auth/signin">{t('landing.backToSignin')}</AuthLink>
      </p>
    </AuthCard>
  )
}
