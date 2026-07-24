'use client'

/**
 * Client side of i18n: context provider + hooks.
 *
 * The provider receives `initialLocale` from the server root layout (which
 * reads the `bms_locale` cookie), so SSR and the first client render agree —
 * no language flash, no hydration mismatch. Components rendered WITHOUT a
 * provider (unit tests) get the English default from the context fallback.
 *
 * Switching locale persists the cookie, updates <html lang> and calls
 * router.refresh() so any server-rendered text re-renders in the new language.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LOCALE_COOKIE, makeT, type Locale, type Translate } from './messages'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Translate
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: makeT('en'),
})

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale
  children: React.ReactNode
}) {
  const router = useRouter()
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next)
      // One year; Lax is enough — the cookie only picks a language.
      document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;SameSite=Lax`
      document.documentElement.lang = next
      // Re-render server components (e.g. the landing page) in the new language.
      router.refresh()
    },
    [router],
  )

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t: makeT(locale) }),
    [locale, setLocale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}

/** The translate function for the active locale. */
export function useT(): Translate {
  return useContext(I18nContext).t
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale
}
