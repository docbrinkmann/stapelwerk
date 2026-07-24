/**
 * Server side of i18n — for async server components only (uses next/headers).
 * Client components use useT() from './client' instead.
 */
import { cookies } from 'next/headers'
import { LOCALE_COOKIE, makeT, parseLocale, type Locale, type Translate } from './messages'

export async function getServerLocale(): Promise<Locale> {
  const store = await cookies()
  return parseLocale(store.get(LOCALE_COOKIE)?.value)
}

/** Translate function bound to the request's locale (from the bms_locale cookie). */
export async function getT(): Promise<Translate> {
  return makeT(await getServerLocale())
}
