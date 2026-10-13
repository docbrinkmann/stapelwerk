import type { Mail } from './mail'

/** Plain transactional texts for the account flows (EN/DE, no tracking, no images). */
export type AuthMailKind = 'confirm' | 'reset' | 'already_registered'
export type MailLocale = 'en' | 'de'

const TEXTS: Record<MailLocale, Record<AuthMailKind, { subject: string; lead: string; action: string; note: string }>> = {
  en: {
    confirm: {
      subject: 'Confirm your Stapelwerk account',
      lead: 'Someone (hopefully you) created a Stapelwerk account with this address.',
      action: 'Confirm your address and choose a password',
      note: 'The link works once and expires in 24 hours. If this wasn\'t you, ignore this mail — no account is active without it.',
    },
    reset: {
      subject: 'Reset your Stapelwerk password',
      lead: 'A password reset was requested for your Stapelwerk account.',
      action: 'Choose a new password',
      note: 'The link works once and expires in 1 hour. If this wasn\'t you, ignore this mail — your password stays as it is.',
    },
    already_registered: {
      subject: 'Your Stapelwerk account',
      lead: 'Someone tried to sign up with this address, but it already has an account.',
      action: 'Forgot your password? Reset it here',
      note: 'If this wasn\'t you, ignore this mail — nothing changed.',
    },
  },
  de: {
    confirm: {
      subject: 'Bestätige dein Stapelwerk-Konto',
      lead: 'Jemand (hoffentlich du) hat mit dieser Adresse ein Stapelwerk-Konto angelegt.',
      action: 'Adresse bestätigen und Passwort festlegen',
      note: 'Der Link funktioniert einmal und läuft nach 24 Stunden ab. Warst du das nicht, ignoriere diese Mail — ohne den Link wird kein Konto aktiv.',
    },
    reset: {
      subject: 'Stapelwerk-Passwort zurücksetzen',
      lead: 'Für dein Stapelwerk-Konto wurde ein neues Passwort angefordert.',
      action: 'Neues Passwort festlegen',
      note: 'Der Link funktioniert einmal und läuft nach 1 Stunde ab. Warst du das nicht, ignoriere diese Mail — dein Passwort bleibt unverändert.',
    },
    already_registered: {
      subject: 'Dein Stapelwerk-Konto',
      lead: 'Jemand wollte sich mit dieser Adresse registrieren, es gibt aber schon ein Konto dafür.',
      action: 'Passwort vergessen? Hier zurücksetzen',
      note: 'Warst du das nicht, ignoriere diese Mail — es hat sich nichts geändert.',
    },
  },
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function authMail(kind: AuthMailKind, locale: MailLocale, to: string, url: string): Mail {
  const t = TEXTS[locale][kind]
  return {
    to,
    subject: t.subject,
    text: `${t.lead}\n\n${t.action}:\n${url}\n\n${t.note}\n\n— Stapelwerk · https://stapelwerk.dev`,
    html:
      `<p>${escapeHtml(t.lead)}</p>` +
      `<p><a href="${escapeHtml(url)}">${escapeHtml(t.action)}</a></p>` +
      `<p style="color:#666">${escapeHtml(t.note)}</p>` +
      `<p style="color:#666">— Stapelwerk · <a href="https://stapelwerk.dev">stapelwerk.dev</a></p>`,
  }
}
