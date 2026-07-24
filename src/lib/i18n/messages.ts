/**
 * i18n message core — pure data + lookup, importable from BOTH server and
 * client code (no React, no next/headers).
 *
 * Structure: one file per namespace under ./messages, each exporting
 * `<ns>En` (as const, source of truth for keys) and `<ns>De` typed
 * `Record<keyof typeof <ns>En, string>` — so a missing German translation is
 * a TYPE ERROR and `npm run type-check` is the completeness gate.
 *
 * Values may contain `{var}` placeholders, filled by `makeT`'s vars argument:
 *   t('builder.servicesCount', { count: 3 })
 */
import { commonEn, commonDe } from './messages/common'
import { shellEn, shellDe } from './messages/shell'
import { landingEn, landingDe } from './messages/landing'
import { builderEn, builderDe } from './messages/builder'
import { deployEn, deployDe } from './messages/deploy'
import { opsEn, opsDe } from './messages/ops'
import { catalogEn, catalogDe } from './messages/catalog'

export const en = {
  ...commonEn,
  ...shellEn,
  ...landingEn,
  ...builderEn,
  ...deployEn,
  ...opsEn,
  ...catalogEn,
} as const

export type MessageKey = keyof typeof en

export const de: Record<MessageKey, string> = {
  ...commonDe,
  ...shellDe,
  ...landingDe,
  ...builderDe,
  ...deployDe,
  ...opsDe,
  ...catalogDe,
}

export type Locale = 'en' | 'de'

export const LOCALE_COOKIE = 'bms_locale'

export function parseLocale(value: string | undefined | null): Locale {
  return value === 'de' ? 'de' : 'en'
}

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

/** Build a translate function for a locale. Falls back EN → key, never throws. */
export function makeT(locale: Locale): Translate {
  const dict: Record<string, string> = locale === 'de' ? de : en
  return (key, vars) => {
    let text = dict[key] ?? (en as Record<string, string>)[key] ?? key
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(value))
      }
    }
    return text
  }
}
