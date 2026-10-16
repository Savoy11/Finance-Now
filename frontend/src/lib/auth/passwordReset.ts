import { createHash, randomBytes } from 'node:crypto'
import { passwordProblem } from './passwordPolicy'

export { MIN_PASSWORD_LENGTH, passwordProblem } from './passwordPolicy'

/**
 * Password reset without email (T-435, owner decision D123, 2026-10-15).
 *
 * Sign-in had no reset at all, and after a breach the only lever was rotating AUTH_SECRET,
 * which signs everyone out but cannot make anyone choose a new password. Sending a reset
 * link needs an email provider, a choice deferred to launch (D21). So the owner issues the
 * link (`npm run auth:reset`) and hands it over directly, and can force any or every
 * account to reset before it signs in again.
 *
 * Pure: no database, no clock, no environment. The route and the owner command supply
 * those, so every rule here is tested without them.
 *
 * Token handling, all of it deliberate:
 * - 32 random bytes, base64url. Only its SHA-256 is stored; the token itself is shown once,
 *   to the owner, and never stored or logged.
 * - Single use, and short-lived (RESET_TOKEN_TTL_MINUTES). Using one spends every other
 *   outstanding token for the same account.
 * - Carried in the link's fragment (`#token=`), which browsers never send to a server, so it
 *   stays out of server logs and Referer headers.
 */

export const RESET_TOKEN_TTL_MINUTES = 60
const RESET_TOKEN_BYTES = 32

/** base64url of 32 bytes is 43 characters, no padding. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/

export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(RESET_TOKEN_BYTES).toString('base64url')
  return { token, tokenHash: hashResetToken(token) }
}

/** What is stored and looked up. A database copy cannot be turned back into a link. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function looksLikeResetToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_SHAPE.test(value)
}

export function resetTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60_000)
}

/** The link the owner hands over: the token in the fragment, never in the query string. */
export function resetLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/reset-password#token=${encodeURIComponent(token)}`
}

export interface ResetTokenRow {
  id: string
  userId: string
  expiresAt: Date
  usedAt: Date | null
}

/** The few writes a reset makes; the route implements it inside one transaction. */
export interface PasswordResetStore {
  /** The token row, locked for this transaction, or null. */
  findToken(tokenHash: string): Promise<ResetTokenRow | null>
  /** Set the new hash, clear any forced reset, record when the password changed. */
  setPassword(userId: string, passwordHash: string, now: Date): Promise<void>
  /** Spend every unused token of this account, the one just used included. */
  spendTokens(userId: string, now: Date): Promise<void>
}

export function isResetTokenUsable(row: ResetTokenRow | null, now: Date): row is ResetTokenRow {
  return row !== null && row.usedAt === null && row.expiresAt.getTime() > now.getTime()
}

/** One message for every bad link, so a guess learns nothing about which part failed. */
export const INVALID_LINK_MESSAGE =
  'This reset link is not valid: it may have expired or already been used. Ask for a new one.'

export type ResetOutcome = { ok: true } | { ok: false; status: 400; message: string }

export async function applyPasswordReset(
  store: PasswordResetStore,
  input: { token: unknown; password: unknown; hashPassword: (password: string) => Promise<string> },
  now: Date,
): Promise<ResetOutcome> {
  if (!looksLikeResetToken(input.token)) return { ok: false, status: 400, message: INVALID_LINK_MESSAGE }
  const row = await store.findToken(hashResetToken(input.token))
  if (!isResetTokenUsable(row, now)) return { ok: false, status: 400, message: INVALID_LINK_MESSAGE }
  const problem = passwordProblem(input.password)
  if (problem) return { ok: false, status: 400, message: problem }
  await store.setPassword(row.userId, await input.hashPassword(input.password as string), now)
  await store.spendTokens(row.userId, now)
  return { ok: true }
}
