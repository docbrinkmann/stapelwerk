'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Layers } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** Shared frame for the account screens — same look as the sign-in page. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Layers className="h-6 w-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}

export function AuthAlert({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2
  return (
    <div
      className={
        tone === 'error'
          ? 'flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive'
          : 'flex items-start gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success'
      }
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href as never} className="font-medium text-foreground underline-offset-4 hover:underline">
      {children}
    </Link>
  )
}

/** tRPC error → message key: a rate limit says so, everything else stays generic. */
export function authErrorKey(e: unknown): 'landing.authErrorRateLimit' | 'landing.authErrorGeneric' {
  return (e as { data?: { code?: string } } | undefined)?.data?.code === 'TOO_MANY_REQUESTS'
    ? 'landing.authErrorRateLimit'
    : 'landing.authErrorGeneric'
}

export const isEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
