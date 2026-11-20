import { createHash, randomBytes } from 'node:crypto'
import { looksLikeTotpCode, verifyTotp, type TotpVerification } from './totp'

// ─── Two-factor sign-in rules (T-088, D233) ──────────────────────────────────
//
// The pure half: recovery codes, the sign-in decision over a stored enrollment,
// and the wrong-code throttle. The database half is ./twoFactorStore.ts; the
// sign-in wiring is ./config.ts. No 'server-only' import, for the same reason
// as passwordReset.ts: the owner's command runs this under tsx.
//
// Sign-in stays off until launch (D174), so all of this is dark until the flip:
// nothing can enroll without a signed-in session, and the second step only
// exists for an enrolled account.

/** How many recovery codes an enrollment gets. Each works once. */
export const RECOVERY_CODE_COUNT = 10
/** Letters and digits that cannot be misread: no I, O, 0 or 1. */
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** Characters per code: 10 of 32 → 50 random bits. */
const RECOVERY_CODE_LENGTH = 10

/** Why the two-factor routes answer 401 in local mode: shown by the API and the Settings panel. */
export const TWO_FACTOR_NEEDS_SESSION =
  'Two-factor sign-in protects a signed-in account. While the app runs without sign-in, there is no account to protect.'

/** Wrong codes allowed in a row before sign-in makes the account wait. */
export const TOTP_MAX_FAILURES = 5
/** How long the wait lasts. In-memory, per server process — the same posture as D173's API rate limit. */
export const TOTP_THROTTLE_MS = 5 * 60_000

export interface RecoveryCode {
  /** The code as shown to the person, once: "A2CDE-FGH3K". */
  code: string
  /** Its SHA-256 (of the normalized form), the only thing stored. */
  codeHash: string
}

/** One unbiased character: rejection-sampled so no letter is likelier than another. */
function recoveryChar(): string {
  // 32 divides 256, so a single byte masked to 5 bits is already unbiased.
  return RECOVERY_ALPHABET[randomBytes(1)[0] & 31]
}

export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): RecoveryCode[] {
  return Array.from({ length: count }, () => {
    const raw = Array.from({ length: RECOVERY_CODE_LENGTH }, recoveryChar).join('')
    const code = `${raw.slice(0, 5)}-${raw.slice(5)}`
    return { code, codeHash: hashRecoveryCode(code) }
  })
}

/** Case, spaces and dashes do not matter when typing a recovery code back in. */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '')
}

export function hashRecoveryCode(input: string): string {
  return createHash('sha256').update(normalizeRecoveryCode(input)).digest('hex')
}

export function looksLikeRecoveryCode(input: unknown): input is string {
  if (typeof input !== 'string') return false
  const clean = normalizeRecoveryCode(input)
  return clean.length === RECOVERY_CODE_LENGTH && [...clean].every((ch) => RECOVERY_ALPHABET.includes(ch))
}

// ─── The stored enrollment, as the sign-in decision reads it ─────────────────

export interface TwoFactorRow {
  /** The TOTP secret, base32. */
  secret: string
  /** Set when the first code was verified; null is a begun, unconfirmed enrollment that gates nothing. */
  confirmedAt: Date | null
  /** The last TOTP step that signed someone in, so that exact code cannot be replayed. */
  lastUsedStep: number | null
}

export interface RecoveryCodeRow {
  id: string
  codeHash: string
  usedAt: Date | null
}

export type SignInCodeResult =
  | { ok: true; kind: 'totp'; matchedStep: number }
  | { ok: true; kind: 'recovery'; spentCodeId: string; codesLeft: number }
  | { ok: false }

/**
 * Whether what was typed at sign-in's second step is this account's current
 * authenticator code or one of its unspent recovery codes. Pure: the caller
 * records the matched step or spends the matched code.
 */
export function checkSignInCode(
  row: TwoFactorRow,
  recoveryCodes: readonly RecoveryCodeRow[],
  input: string,
  now: Date,
): SignInCodeResult {
  if (row.confirmedAt === null) return { ok: false }
  if (looksLikeTotpCode(input)) {
    const v: TotpVerification = verifyTotp(row.secret, input, now, { notAfterStep: row.lastUsedStep })
    if (v.ok && v.matchedStep !== undefined) return { ok: true, kind: 'totp', matchedStep: v.matchedStep }
    // A six-digit recovery code cannot exist (codes carry letters), so stop here.
    return { ok: false }
  }
  if (looksLikeRecoveryCode(input)) {
    const hash = hashRecoveryCode(input)
    const unspent = recoveryCodes.filter((c) => c.usedAt === null)
    const match = unspent.find((c) => c.codeHash === hash)
    if (match) return { ok: true, kind: 'recovery', spentCodeId: match.id, codesLeft: unspent.length - 1 }
  }
  return { ok: false }
}

/** Confirming an enrollment takes the authenticator's own code, never a recovery code. */
export function checkEnrollmentCode(secret: string, input: string, now: Date): TotpVerification {
  if (!looksLikeTotpCode(input)) return { ok: false }
  return verifyTotp(secret, input, now)
}

// ─── Wrong-code throttle ─────────────────────────────────────────────────────
// Guessing a 6-digit code is a one-in-a-million shot per try; what makes it a
// threat is unlimited tries against a stolen password. Five wrong codes in a
// row make the account wait five minutes. Counted in this server's memory, the
// posture D173 set for the API rate limit: a restart forgets, which costs an
// attacker nothing meaningful against a 10^6 space and keeps the table-free
// guarantee that an unrun migration can never lock sign-in.

export interface ThrottleState {
  failures: number
  /** Set once failures reach the limit; tries before this moment are refused unseen. */
  retryAt: number | null
}

export function throttled(state: ThrottleState | undefined, now: Date): boolean {
  return state?.retryAt != null && now.getTime() < state.retryAt
}

export function recordFailure(state: ThrottleState | undefined, now: Date): ThrottleState {
  const failures = (state?.failures ?? 0) + 1
  return { failures, retryAt: failures >= TOTP_MAX_FAILURES ? now.getTime() + TOTP_THROTTLE_MS : null }
}

/** A right code clears the slate. */
export function recordSuccess(): undefined {
  return undefined
}
