import { describe, it, expect } from 'vitest'
import { authMail } from '../auth-mails'

describe('auth-mails', () => {
  const url = 'https://app.example/auth/set-password?token=abc&x=<y>'

  it('puts the escaped link on the button and as copyable text, in the mail language', () => {
    const m = authMail('confirm', 'de', 'a@b.co', url)
    const escaped = 'https://app.example/auth/set-password?token=abc&amp;x=&lt;y&gt;'
    expect(m.html).toContain('<html lang="de">')
    expect(m.html).toContain(`<a href="${escaped}"`)
    expect(m.html).toContain('Adresse bestätigen und Passwort festlegen</a>')
    expect(m.html).toContain(`Kopiere diesen Link in deinen Browser:</p>`)
    expect(m.html).not.toContain('<y>')
    expect(m.text).toContain(url)
  })

  it('loads nothing remote when opened', () => {
    for (const kind of ['confirm', 'reset', 'already_registered'] as const) {
      expect(authMail(kind, 'en', 'a@b.co', url).html).not.toMatch(/<img|<link|<script|url\(/i)
    }
  })
})
