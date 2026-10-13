import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Transactional mail (sign-up confirmation, password reset).
 *
 * SMTP_HOST set → send via SMTP (hosted: the gateway relay, reached over the
 * tailnet). Unset → no mail in production, so self-registration is off
 * there; dev/test log the message instead.
 */
export function isMailConfigured(): boolean {
  return !!process.env.SMTP_HOST
}

/** Self-registration needs a way to prove the address — no mail, no sign-up. */
export function isSignupEnabled(): boolean {
  return isMailConfigured() || process.env.NODE_ENV !== 'production'
}

let transport: Transporter | null = null

function getTransport(): Transporter {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    // The hop to the relay may already run inside an encrypted tunnel with a
    // self-signed relay cert; both knobs default to strict.
    ignoreTLS: process.env.SMTP_IGNORE_TLS === 'true',
    tls: { rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false' },
  })
  return transport
}

export interface Mail {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendMail(mail: Mail): Promise<void> {
  if (!isMailConfigured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP is not configured')
    console.info(`[mail:dev] to=${mail.to} subject=${mail.subject}\n${mail.text}`)
    return
  }
  await getTransport().sendMail({
    from: process.env.SMTP_FROM || 'Stapelwerk <noreply@stapelwerk.dev>',
    ...mail,
  })
}
