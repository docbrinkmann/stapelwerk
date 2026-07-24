'use client'

import { Languages } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'

/**
 * LanguageToggle Component
 *
 * Switches the app between English and German. Sits next to ThemeToggle in
 * the headers and mirrors its button styling. Shows the CURRENT locale as a
 * short label; the aria-label describes the switch action.
 */
export default function LanguageToggle() {
  const { locale, setLocale, t } = useI18n()
  const next = locale === 'en' ? 'de' : 'en'
  const label = t(next === 'de' ? 'shell.switchToDe' : 'shell.switchToEn')

  return (
    <button
      onClick={() => setLocale(next)}
      className="inline-flex items-center justify-center gap-1.5 rounded-md p-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      aria-label={label}
      title={label}
      type="button"
      data-testid="language-toggle"
    >
      <Languages className="h-5 w-5" />
      <span className="text-xs font-semibold uppercase" aria-hidden>
        {locale}
      </span>
      <span className="sr-only">{label}</span>
    </button>
  )
}
