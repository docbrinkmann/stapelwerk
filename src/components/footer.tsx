'use client'

import Link from 'next/link'
import { APP_CONFIG } from '@/lib/constants'
import { formatVersion } from '@/utils/helpers'
import { useT } from '@/lib/i18n/client'

// Operator-specific legal pages (Impressum § 5 DDG, Datenschutz Art. 13 DSGVO). Build-time
// env, so a self-hosted instance never links to the hosted operator's imprint.
export const IMPRINT_URL = process.env.NEXT_PUBLIC_IMPRINT_URL
export const PRIVACY_URL = process.env.NEXT_PUBLIC_PRIVACY_URL

/**
 * Footer Component
 *
 * Marketing footer shown on every non-dashboard route (rendered by ProvidersRoot).
 */
export default function Footer() {
  const t = useT()

  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">{t('landing.footerTagline')}</p>
        <nav className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
          <Link href="/services" className="transition-colors hover:text-foreground">
            {t('landing.footerServices')}
          </Link>
          <Link href="/docs" className="transition-colors hover:text-foreground">
            {t('landing.footerDocs')}
          </Link>
          <Link href="/auth/signin" className="transition-colors hover:text-foreground">
            {t('landing.signIn')}
          </Link>
          {IMPRINT_URL && (
            <a href={IMPRINT_URL} className="transition-colors hover:text-foreground">
              {t('landing.footerImprint')}
            </a>
          )}
          {PRIVACY_URL && (
            <a href={PRIVACY_URL} className="transition-colors hover:text-foreground">
              {t('landing.footerPrivacy')}
            </a>
          )}
          <span className="text-muted-foreground/70">{formatVersion(APP_CONFIG.version)}</span>
        </nav>
      </div>
    </footer>
  )
}
