import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, isDbConfigured } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { isSchemaBehindError } from '@/lib/db/errors'
import { getSessionUserId } from '@/lib/auth/session'
import { formatManualKey, generateTotpSecret, otpauthUri } from '@/lib/auth/totp'
import { TWO_FACTOR_NEEDS_SESSION } from '@/lib/auth/twoFactor'
import { beginTwoFactorEnrollment } from '@/lib/auth/twoFactorStore'
import { APP_NAME } from '@/lib/constants'

// Two-factor enrollment, step 1 (T-088, D233): mint a secret and hand it over ONCE,
// as the otpauth:// link an authenticator opens and the manual key its "enter a
// setup key" box takes. Nothing is enforced until /confirm verifies the app's
// first code. Beginning again replaces an unconfirmed secret; a confirmed
// enrollment refuses (turn it off first), so a hijacked session cannot quietly
// swap the authenticator without knowing a current code.

export const dynamic = 'force-dynamic'

export async function POST() {
  if (!isDbConfigured) {
    return NextResponse.json(
      { ok: false, error: 'There is no database set up, so two-factor sign-in has nowhere to live.' },
      { status: 503 },
    )
  }
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ ok: false, error: TWO_FACTOR_NEEDS_SESSION }, { status: 401 })

  try {
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1)
    if (!user) return NextResponse.json({ ok: false, error: 'Account not found' }, { status: 401 })

    const secret = generateTotpSecret()
    const begun = await beginTwoFactorEnrollment(userId, secret, new Date())
    if (begun === 'already-enrolled') {
      return NextResponse.json(
        { ok: false, error: 'Two-factor sign-in is already on for this account. Turn it off before setting up a new authenticator.' },
        { status: 409 },
      )
    }
    return NextResponse.json({
      ok: true,
      otpauthUri: otpauthUri(secret, user.email, APP_NAME),
      manualKey: formatManualKey(secret),
    })
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
