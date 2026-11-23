import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/session'
import { TWO_FACTOR_NEEDS_SESSION } from '@/lib/auth/twoFactor'
import { twoFactorStatus } from '@/lib/auth/twoFactorStore'

// Two-factor sign-in, status (T-088, D233). The Settings panel reads this.
//
// Every /api/user/two-factor/* route resolves the account through
// getSessionUserId — the signed-in session only, never the shared local user —
// so in local mode (today, with the wall off) they answer 401 and the whole
// surface stays dark until launch. The reason is in session.ts: second-step
// protection on an account nobody can sign into protects nothing.

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ ok: false, error: TWO_FACTOR_NEEDS_SESSION }, { status: 401 })
  return NextResponse.json({ ok: true, ...(await twoFactorStatus(userId)) })
}
