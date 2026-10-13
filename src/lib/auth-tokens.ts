import { createHash, randomBytes, randomUUID } from 'crypto'

/**
 * Single-use email links. Only the SHA-256 of a token is stored; the raw
 * token exists only in the link that was mailed.
 */
export type AuthTokenType = 'verify_email' | 'reset_password'

export const TOKEN_TTL_MS: Record<AuthTokenType, number> = {
  verify_email: 24 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
}

// Minimal prisma surface used here (the real client and the test harness both fit).
interface TokenStore {
  auth_tokens: {
    deleteMany(args: unknown): Promise<unknown>
    create(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<{ id: string; userId: string; type: string; usedAt: Date | null; expiresAt: Date } | null>
    updateMany(args: unknown): Promise<{ count: number }>
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Issue a token for the user; older unused links of the same type stop working. */
export async function issueAuthToken(
  prisma: TokenStore,
  userId: string,
  type: AuthTokenType,
  now: Date = new Date(),
): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await prisma.auth_tokens.deleteMany({ where: { userId, type, usedAt: null } })
  await prisma.auth_tokens.create({
    data: {
      id: randomUUID(),
      userId,
      type,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[type]),
      usedAt: null,
      createdAt: now,
    },
  })
  return token
}

/** Redeem a token: the owner's id if valid (unused, unexpired, allowed type), else null. */
export async function consumeAuthToken(
  prisma: TokenStore,
  token: string,
  types: AuthTokenType[],
  now: Date = new Date(),
): Promise<{ userId: string; type: AuthTokenType } | null> {
  const row = await prisma.auth_tokens.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!row || !types.includes(row.type as AuthTokenType) || row.usedAt || new Date(row.expiresAt) <= now) return null
  // Conditional update: a double submit can't redeem the same link twice.
  const { count } = await prisma.auth_tokens.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } })
  return count === 1 ? { userId: row.userId, type: row.type as AuthTokenType } : null
}
