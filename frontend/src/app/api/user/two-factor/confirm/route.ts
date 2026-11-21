import { NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { isSchemaBehindError } from '@/lib/db/errors'
import { getSessionUserId } from '@/lib/auth/session'
import { TWO_FACTOR_NEEDS_SESSION, generateRecoveryCodes } from '@/lib/auth/twoFactor'
import { confirmTwoFactorEnrollment } from '@/lib/auth/twoFactorStore'
import { recordAudit } from '@/lib/server/auditLog'

// Two-factor enrollment, step 2 (T-088, D233): verify the authenticator's first
// code. On a match the enrollment turns on and the response carries the account's
// recovery codes — the ONE time they are ever shown; only their hashes are stored.

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!isDbConfigured) {
    return NextResponse.json({ ok: false, error: 'There is no database set up.' }, { status: 503 })
  }
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ ok: false, error: TWO_FACTOR_NEEDS_SESSION }, { status: 401 })

  const body = await request.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (!code) return NextResponse.json({ ok: false, error: 'Enter the 6-digit code your authenticator shows.' }, { status: 400 })

  try {
    const codes = generateRecoveryCodes()
    const result = await confirmTwoFactorEnrollment(userId, code, codes, new Date())
    if (result.outcome === 'confirmed') {
      await recordAudit({ userId, actor: 'user', event: 'two_factor_enabled' })
      return NextResponse.json({ ok: true, recoveryCodes: codes.map((c) => c.code) })
    }
    if (result.outcome === 'no-enrollment') {
      return NextResponse.json({ ok: false, error: 'Nothing is waiting to be confirmed — start the setup first.' }, { status: 409 })
    }
    if (result.outcome === 'already-confirmed') {
      return NextResponse.json({ ok: false, error: 'Two-factor sign-in is already on for this account.' }, { status: 409 })
    }
    if (result.outcome === 'throttled') {
      return NextResponse.json({ ok: false, error: 'Too many wrong codes. Wait a few minutes and try again.' }, { status: 429 })
    }
    return NextResponse.json(
      { ok: false, error: 'That code didn’t work. Codes change every 30 seconds — enter the one showing now.' },
      { status: 400 },
    )
  } catch (e) {
    if (isSchemaBehindError(e)) {
      return NextResponse.json(
        { ok: false, error: 'Two-factor sign-in needs migration 0012: run `npm run db:migrate`.' },
        { status: 503 },
      )
    }
    throw e
  }
}
