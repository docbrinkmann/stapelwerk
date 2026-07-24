'use client'

import { Suspense, useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Layers, Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n/client'

function SignInForm() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard'
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  // Gate submit until hydrated so the client handler is attached.
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Read from the form, not React state: mobile password managers autofill
    // the fields without firing onChange, so controlled state can be empty.
    const data = new FormData(e.currentTarget)
    const email = String(data.get('email') || '').trim()
    const password = String(data.get('password') || '')
    if (!email || !password) {
      setError(t('landing.signinErrorMissing'))
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      if (result?.error) {
        setError(t('landing.signinErrorInvalid'))
        return
      }
      router.push(callbackUrl as any)
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Layers className="h-6 w-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl">{t('landing.signinTitle')}</CardTitle>
          <CardDescription>
            {t('landing.signinSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* No form action: in React 19 a string `action` runs a native
              submit even with preventDefault, which broke login. handleSubmit
              reads values from FormData so mobile autofill works even when the
              password manager doesn't fire React onChange. */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t('landing.signinEmail')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder={t('landing.signinEmailPlaceholder')}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('landing.signinPassword')}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || !hydrated}>
              {(isLoading || !hydrated) && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {hydrated ? t('landing.signIn') : t('common.loading')}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t('landing.signinDemo')} <span className="font-medium text-foreground">demo@buildmystack.dev</span> / <span className="font-medium text-foreground">demo1234</span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
