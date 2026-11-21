import { NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { isSchemaBehindError } from '@/lib/db/errors'
import { getSessionUserId } from '@/lib/auth/session'
import { TWO_FACTOR_NEEDS_SESSION } from '@/lib/auth/twoFactor'
import { disableTwoFactor, twoFactorStatus, verifyTwoFactorSignIn } from '@/lib/auth/twoFactorStore'
import { recordAudit } from '@/lib/server/auditLog'

// Turn two-factor off (T-088, D233). It takes a CURRENT code — authenticator or
// recovery — so a walked-away-from session cannot quietly strip the protection.
// The locked-out path (phone and recovery codes both gone) is the owner's command,
// `npm run auth:2fa -- --disable --user <email>`, after checking identity offline.

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!isDbConfigured) {
    return NextResponse.json({ ok: false, error: 'There is no database set up.' }, { status: 503 })
  }
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ ok: false, error: TWO_FACTOR_NEEDS_SESSION }, { status: 401 })

  const body = await request.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (!code) {
    return NextResponse.json({ ok: false, error: 'Enter a current authenticator or recovery code to turn this off.' }, { status: 400 })
  }

  try {
    const status = await twoFactorStatus(userId)
    if (!status.enrolled) {
      return NextResponse.json({ ok: false, error: 'Two-factor sign-in is not on for this account.' }, { status: 409 })
    }
    const check = await verifyTwoFactorSignIn(userId, code, new Date())
    if (check === 'throttled') {
      return NextResponse.json({ ok: false, error: 'Too many wrong codes. Wait a few minutes and try again.' }, { status: 429 })
    }
    if (check !== 'ok') {
      return NextResponse.json({ ok: false, error: 'That code didn’t work.' }, { status: 400 })
    }
    await disableTwoFactor(userId)
    await recordAudit({ userId, actor: 'user', event: 'two_factor_disabled' })
    return NextResponse.json({ ok: true })
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
