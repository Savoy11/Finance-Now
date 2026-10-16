import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'
import { db, isDbConfigured } from '@/lib/db'
import { passwordResetTokens, passwordStates, users } from '@/lib/db/schema'
import { isSchemaBehindError } from '@/lib/db/errors'
import type { PasswordResetStore, ResetTokenRow } from './passwordReset'

// The database half of the password reset (T-435, D123). The rules live in ./passwordReset.ts.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** The reset's writes, bound to one transaction so a link is spent exactly once. */
export function drizzleResetStore(tx: Tx): PasswordResetStore {
  return {
    async findToken(tokenHash: string): Promise<ResetTokenRow | null> {
      const [row] = await tx
        .select({
          id: passwordResetTokens.id,
          userId: passwordResetTokens.userId,
          expiresAt: passwordResetTokens.expiresAt,
          usedAt: passwordResetTokens.usedAt,
        })
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash))
        .limit(1)
        // Two submissions of the same link wait for each other instead of both succeeding.
        .for('update')
      return row ?? null
    },
    async setPassword(userId: string, passwordHash: string, now: Date): Promise<void> {
      await tx.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, userId))
      await tx
        .insert(passwordStates)
        .values({ userId, mustReset: false, mustResetSince: null, passwordChangedAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: passwordStates.userId,
          set: { mustReset: false, mustResetSince: null, passwordChangedAt: now, updatedAt: now },
        })
    },
    async spendTokens(userId: string, now: Date): Promise<void> {
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)))
    },
  }
}

let reportedBehind = false

/**
 * Whether sign-in must be refused until this account's password is reset.
 *
 * False when migration 0008 has not run: the flag cannot have been set without its table,
 * and refusing every sign-in over a missing table would turn an unrun migration into a
 * lockout. Said once in the server log so the owner can see why the feature is idle.
 */
export async function mustResetPassword(userId: string): Promise<boolean> {
  if (!isDbConfigured) return false
  try {
    const [row] = await db
      .select({ mustReset: passwordStates.mustReset })
      .from(passwordStates)
      .where(eq(passwordStates.userId, userId))
      .limit(1)
    return row?.mustReset === true
  } catch (e) {
    if (!isSchemaBehindError(e)) throw e
    if (!reportedBehind) {
      reportedBehind = true
      console.warn('[auth] Password reset is idle until migration 0008 is applied: run `npm run db:migrate`.')
    }
    return false
  }
}
