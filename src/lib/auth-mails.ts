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

const FALLBACK: Record<MailLocale, string> = {
  en: 'Button not working? Paste this link into your browser:',
  de: 'Button funktioniert nicht? Kopiere diesen Link in deinen Browser:',
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

// The app's look (stone palette and radius from globals.css, the sidebar's
// logo tile), in tables and inline styles because mail clients ignore most
// CSS. Dark mode follows the reader's client where it supports
// prefers-color-scheme. No images or remote resources: opening the mail
// loads nothing.
function html(locale: MailLocale, t: (typeof TEXTS)[MailLocale][AuthMailKind], url: string): string {
  const href = escapeHtml(url)
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(t.subject)}</title>
<style>
@media (prefers-color-scheme: dark) {
  .bg { background: #0c0a09 !important; }
  .card { background: #1c1917 !important; border-color: #292524 !important; }
  .fg { color: #fafaf9 !important; }
  .muted { color: #a8a29e !important; }
  .mark { background: #fafaf9 !important; color: #0c0a09 !important; }
  .btn { background: #e7e5e4 !important; }
  .btn a { color: #1c1917 !important; }
  .code { background: #292524 !important; color: #d6d3d1 !important; }
  .rule { border-color: #292524 !important; }
}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:#f5f5f4;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(t.lead)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:#f5f5f4;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card" style="max-width:480px;background:#ffffff;border:1px solid #e7e5e4;border-radius:10px;">
<tr><td style="padding:32px;font-family:${FONT};">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td class="mark" width="32" height="32" align="center" style="width:32px;height:32px;background:#0c0a09;color:#fafaf9;border-radius:8px;font-family:${FONT};font-size:14px;font-weight:700;">S</td>
<td class="fg" style="padding-left:10px;font-family:${FONT};font-size:15px;font-weight:600;color:#0c0a09;">Stapelwerk</td>
</tr></table>
<h1 class="fg" style="margin:28px 0 8px;font-size:20px;line-height:1.3;font-weight:600;color:#0c0a09;">${escapeHtml(t.subject)}</h1>
<p class="fg" style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#0c0a09;">${escapeHtml(t.lead)}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td class="btn" style="background:#1c1917;border-radius:8px;"><a href="${href}" style="display:inline-block;padding:11px 20px;font-family:${FONT};font-size:14px;font-weight:500;color:#fafaf9;text-decoration:none;">${escapeHtml(t.action)}</a></td>
</tr></table>
<p class="muted" style="margin:24px 0 6px;font-size:13px;line-height:1.5;color:#78716c;">${escapeHtml(FALLBACK[locale])}</p>
<p class="code" style="margin:0;padding:10px 12px;background:#f5f5f4;border-radius:6px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;color:#44403c;word-break:break-all;">${href}</p>
<p class="muted" style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#78716c;">${escapeHtml(t.note)}</p>
<hr class="rule" style="margin:28px 0 16px;border:0;border-top:1px solid #e7e5e4;">
<p class="muted" style="margin:0;font-size:12px;color:#78716c;">Stapelwerk · <a href="https://stapelwerk.dev" class="muted" style="color:#78716c;">stapelwerk.dev</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export function authMail(kind: AuthMailKind, locale: MailLocale, to: string, url: string): Mail {
  const t = TEXTS[locale][kind]
  return {
    to,
    subject: t.subject,
    text: `${t.lead}\n\n${t.action}:\n${url}\n\n${t.note}\n\n— Stapelwerk · https://stapelwerk.dev`,
    html: html(locale, t, url),
  }
}
