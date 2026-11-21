import { NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { isSchemaBehindError } from '@/lib/db/errors'
import { getSessionUserId } from '@/lib/auth/session'
import { TWO_FACTOR_NEEDS_SESSION, generateRecoveryCodes } from '@/lib/auth/twoFactor'
import { replaceRecoveryCodes, twoFactorStatus, verifyTwoFactorSignIn } from '@/lib/auth/twoFactorStore'

// A fresh set of recovery codes (T-088, D233), for when the old ones are running
// low or their copy was lost. Takes a current code, like /disable, and REPLACES
// the whole set: the old codes stop working, and the new ones are shown once.

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
    return NextResponse.json({ ok: false, error: 'Enter a current authenticator or recovery code first.' }, { status: 400 })
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
    const codes = generateRecoveryCodes()
    await replaceRecoveryCodes(userId, codes, new Date())
    return NextResponse.json({ ok: true, recoveryCodes: codes.map((c) => c.code) })
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
