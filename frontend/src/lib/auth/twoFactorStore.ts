import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'
import { db, isDbConfigured } from '@/lib/db'
import { twoFactorRecoveryCodes, twoFactorSecrets } from '@/lib/db/schema'
import { isSchemaBehindError } from '@/lib/db/errors'
import {
  checkEnrollmentCode, checkSignInCode, recordFailure, recordSuccess, throttled,
  type RecoveryCode, type RecoveryCodeRow, type ThrottleState, type TwoFactorRow,
} from './twoFactor'

// The database half of two-factor sign-in (T-088, D233). The rules live in ./twoFactor.ts;
// the sign-in wiring is ./config.ts; the routes are /api/user/two-factor/*.
//
// The one property everything here protects: a database without migration 0012 reads as
// "nobody is enrolled", said once in the server log — the mustResetPassword pattern — so an
// unrun migration can never lock sign-in.

let reportedBehind = false

function behind(e: unknown): boolean {
  if (!isSchemaBehindError(e)) return false
  if (!reportedBehind) {
    reportedBehind = true
    console.warn('[auth] Two-factor sign-in is idle until migration 0012 is applied: run `npm run db:migrate`.')
  }
  return true
}

// ─── Wrong-code throttle, per user, in this server's memory (see twoFactor.ts) ───
const throttle = new Map<string, ThrottleState>()

/** Tests only: forget every wait. */
export function resetTwoFactorThrottle(): void {
  throttle.clear()
}

// ─── Reads ───────────────────────────────────────────────────────────────────

async function readRow(userId: string): Promise<(TwoFactorRow & { createdAt: Date }) | null> {
  const [row] = await db
    .select({
      secret: twoFactorSecrets.secret,
      confirmedAt: twoFactorSecrets.confirmedAt,
      lastUsedStep: twoFactorSecrets.lastUsedStep,
      createdAt: twoFactorSecrets.createdAt,
    })
    .from(twoFactorSecrets)
    .where(eq(twoFactorSecrets.userId, userId))
    .limit(1)
  return row ?? null
}

async function readRecoveryRows(userId: string): Promise<RecoveryCodeRow[]> {
  return db
    .select({ id: twoFactorRecoveryCodes.id, codeHash: twoFactorRecoveryCodes.codeHash, usedAt: twoFactorRecoveryCodes.usedAt })
    .from(twoFactorRecoveryCodes)
    .where(eq(twoFactorRecoveryCodes.userId, userId))
}

/**
 * Whether sign-in must ask this account for a second step. Null when not enrolled,
 * not yet confirmed, the database is not configured, or migration 0012 has not run.
 */
export async function twoFactorRequired(userId: string): Promise<boolean> {
  if (!isDbConfigured) return false
  try {
    const row = await readRow(userId)
    return row?.confirmedAt != null
  } catch (e) {
    if (behind(e)) return false
    throw e
  }
}

export interface TwoFactorStatus {
  /** False only when the database is missing or behind; `reason` then says which. */
  available: boolean
  reason?: string
  enrolled: boolean
  confirmedAt: string | null
  /** A begun enrollment waiting on its first code (gates nothing yet). */
  pending: boolean
  recoveryCodesLeft: number
}

export async function twoFactorStatus(userId: string): Promise<TwoFactorStatus> {
  const none: Omit<TwoFactorStatus, 'available' | 'reason'> =
    { enrolled: false, confirmedAt: null, pending: false, recoveryCodesLeft: 0 }
  if (!isDbConfigured) {
    return { available: false, reason: 'There is no database set up, so two-factor sign-in has nowhere to live.', ...none }
  }
  try {
    const row = await readRow(userId)
    if (!row) return { available: true, ...none }
    const codes = row.confirmedAt ? await readRecoveryRows(userId) : []
    return {
      available: true,
      enrolled: row.confirmedAt != null,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      pending: row.confirmedAt == null,
      recoveryCodesLeft: codes.filter((c) => c.usedAt === null).length,
    }
  } catch (e) {
    if (behind(e)) {
      return { available: false, reason: 'Two-factor sign-in needs migration 0012: run `npm run db:migrate`.', ...none }
    }
    throw e
  }
}

// ─── The sign-in (and re-authentication) check ───────────────────────────────

export type SignInCheck = 'ok' | 'bad' | 'throttled'

/**
 * Whether a typed second-step code signs this account in now. On a match it also
 * records the TOTP step (so the same code cannot be replayed) or spends the
 * recovery code. The same check re-authenticates the Settings actions.
 */
export async function verifyTwoFactorSignIn(userId: string, input: string, now: Date): Promise<SignInCheck> {
  if (throttled(throttle.get(userId), now)) return 'throttled'
  const fail = (): SignInCheck => {
    throttle.set(userId, recordFailure(throttle.get(userId), now))
    return 'bad'
  }

  const row = await readRow(userId)
  if (!row || row.confirmedAt == null) return fail()
  const result = checkSignInCode(row, await readRecoveryRows(userId), input, now)
  if (!result.ok) return fail()

  if (result.kind === 'totp') {
    await db
      .update(twoFactorSecrets)
      .set({ lastUsedStep: result.matchedStep, updatedAt: now })
      .where(eq(twoFactorSecrets.userId, userId))
  } else {
    const spent = await db
      .update(twoFactorRecoveryCodes)
      .set({ usedAt: now })
      .where(and(eq(twoFactorRecoveryCodes.id, result.spentCodeId), isNull(twoFactorRecoveryCodes.usedAt)))
      .returning({ id: twoFactorRecoveryCodes.id })
    // Two sign-ins racing the same code: only the one that spent it gets in.
    if (spent.length === 0) return fail()
  }
  const cleared = recordSuccess()
  if (cleared === undefined) throttle.delete(userId)
  return 'ok'
}

// ─── Enrollment ──────────────────────────────────────────────────────────────

export type BeginResult = 'begun' | 'already-enrolled'

/** Store a fresh, unconfirmed secret. Refused while a confirmed enrollment stands (turn it off first). */
export async function beginTwoFactorEnrollment(userId: string, secret: string, now: Date): Promise<BeginResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ confirmedAt: twoFactorSecrets.confirmedAt })
      .from(twoFactorSecrets)
      .where(eq(twoFactorSecrets.userId, userId))
      .limit(1)
      .for('update')
    if (existing?.confirmedAt != null) return 'already-enrolled'
    await tx
      .insert(twoFactorSecrets)
      .values({ userId, secret, confirmedAt: null, lastUsedStep: null, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: twoFactorSecrets.userId,
        set: { secret, confirmedAt: null, lastUsedStep: null, updatedAt: now },
      })
    return 'begun'
  })
}

export type ConfirmResult =
  | { outcome: 'confirmed' }
  | { outcome: 'no-enrollment' | 'already-confirmed' | 'bad-code' | 'throttled' }

/**
 * Verify the authenticator's first code against the pending secret; on a match the
 * enrollment is confirmed and the given recovery codes become the account's set.
 * The caller generated them and shows them once — only their hashes land here.
 */
export async function confirmTwoFactorEnrollment(
  userId: string,
  input: string,
  codes: readonly RecoveryCode[],
  now: Date,
): Promise<ConfirmResult> {
  if (throttled(throttle.get(userId), now)) return { outcome: 'throttled' }
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ secret: twoFactorSecrets.secret, confirmedAt: twoFactorSecrets.confirmedAt })
      .from(twoFactorSecrets)
      .where(eq(twoFactorSecrets.userId, userId))
      .limit(1)
      .for('update')
    if (!row) return { outcome: 'no-enrollment' as const }
    if (row.confirmedAt != null) return { outcome: 'already-confirmed' as const }
    const check = checkEnrollmentCode(row.secret, input, now)
    if (!check.ok) {
      throttle.set(userId, recordFailure(throttle.get(userId), now))
      return { outcome: 'bad-code' as const }
    }
    await tx
      .update(twoFactorSecrets)
      .set({ confirmedAt: now, lastUsedStep: check.matchedStep ?? null, updatedAt: now })
      .where(eq(twoFactorSecrets.userId, userId))
    await tx.delete(twoFactorRecoveryCodes).where(eq(twoFactorRecoveryCodes.userId, userId))
    await tx
      .insert(twoFactorRecoveryCodes)
      .values(codes.map((c) => ({ userId, codeHash: c.codeHash, createdAt: now })))
    throttle.delete(userId)
    return { outcome: 'confirmed' as const }
  })
}

/** Replace the account's recovery codes with a fresh set. The caller has already re-verified a code. */
export async function replaceRecoveryCodes(userId: string, codes: readonly RecoveryCode[], now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(twoFactorRecoveryCodes).where(eq(twoFactorRecoveryCodes.userId, userId))
    await tx
      .insert(twoFactorRecoveryCodes)
      .values(codes.map((c) => ({ userId, codeHash: c.codeHash, createdAt: now })))
  })
}

/**
 * Turn two-factor off: the secret and codes go, because a revoked shared secret
 * kept around is a live credential, not a record (D233). The caller has already
 * re-verified a code (or is the owner's command, after checking identity itself).
 */
export async function disableTwoFactor(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(twoFactorRecoveryCodes).where(eq(twoFactorRecoveryCodes.userId, userId))
    await tx.delete(twoFactorSecrets).where(eq(twoFactorSecrets.userId, userId))
  })
  throttle.delete(userId)
}
