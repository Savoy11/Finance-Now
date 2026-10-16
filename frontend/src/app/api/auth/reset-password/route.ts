import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, isDbConfigured } from '@/lib/db'
import { isSchemaBehindError } from '@/lib/db/errors'
import { applyPasswordReset } from '@/lib/auth/passwordReset'
import { drizzleResetStore } from '@/lib/auth/passwordResetStore'

export const dynamic = 'force-dynamic'

// POST /api/auth/reset-password { token, password } — spends an owner-issued reset link
// (T-435, D123). Public on purpose: the person resetting cannot sign in. The token is 32
// random bytes, so guessing one is not a practical attack, and it is never logged here.
// The rules are in lib/auth/passwordReset.ts; this file only wires them to the database.

export async function POST(request: Request) {
  if (!isDbConfigured) {
    return NextResponse.json({ error: 'Database is not configured. See DATABASE_URL in frontend/.env.local.' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 })
  }
  const { token, password } = (body ?? {}) as Record<string, unknown>

  try {
    const outcome = await db.transaction((tx) =>
      applyPasswordReset(drizzleResetStore(tx), { token, password, hashPassword: (p) => bcrypt.hash(p, 12) }, new Date()),
    )
    if (!outcome.ok) return NextResponse.json({ error: outcome.message }, { status: outcome.status })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (isSchemaBehindError(e)) {
      return NextResponse.json(
        { error: 'Password reset needs migration 0008, which has not been applied. Run `npm run db:migrate`.' },
        { status: 503 },
      )
    }
    // A failed query's message can carry its parameters (here, a password hash), so only
    // the error's kind is logged.
    const err = e as { name?: string; code?: string; cause?: { code?: string } }
    console.error('[reset-password] failed:', err?.name ?? 'Error', err?.code ?? err?.cause?.code ?? '')
    return NextResponse.json({ error: 'The password could not be reset. Try again, or ask for a new link.' }, { status: 500 })
  }
}
