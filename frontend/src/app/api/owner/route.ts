import { NextRequest, NextResponse } from 'next/server'
import { guardQuotaRoute } from '@/lib/server/apiGuard'
import {
  OWNER_COOKIE,
  OWNER_COOKIE_MAX_AGE_S,
  adminToken,
  isCrossSite,
  ownerCookieMatches,
  ownerCookieOptions,
  ownerCookieValue,
  sameSecret,
} from '@/lib/server/ownerAccess'

export const dynamic = 'force-dynamic'

// Owner access for this browser (lib/server/ownerAccess.ts). GET says how the owner's
// tools are reached here; POST takes the admin token once and sets the owner cookie;
// DELETE removes the cookie from this browser. The token is never stored or echoed.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export type OwnerAccessMode = 'token' | 'local' | 'closed'

export interface OwnerAccessStatus {
  /** token: FN_ADMIN_TOKEN is set, unlock with it. local: no token, and this is the owner's machine. closed: neither. */
  mode: OwnerAccessMode
  /** This browser carries a valid owner cookie. */
  unlocked: boolean
}

function modeFor(req: NextRequest): OwnerAccessMode {
  if (adminToken()) return 'token'
  const host = (req.headers.get('host') ?? '').split(':')[0].toLowerCase()
  return LOCAL_HOSTS.has(host) ? 'local' : 'closed'
}

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest) {
  const token = adminToken()
  const status: OwnerAccessStatus = { mode: modeFor(req), unlocked: !!token && ownerCookieMatches(req, token) }
  return NextResponse.json(status, { headers: noStore })
}

export async function POST(req: NextRequest) {
  // Five tries a minute per client: enough for typing mistakes, too few to guess a token.
  const limited = guardQuotaRoute(req, 'owner-unlock', 5)
  if (limited) return limited
  if (isCrossSite(req)) return NextResponse.json({ error: 'Refused: the request came from another site.' }, { status: 403, headers: noStore })
  const token = adminToken()
  if (!token) {
    return NextResponse.json(
      { error: 'FN_ADMIN_TOKEN is not set on this server, so there is nothing to unlock. On your own machine the tools already work.' },
      { status: 409, headers: noStore },
    )
  }
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null
  const supplied = typeof body?.token === 'string' ? body.token.trim() : ''
  if (!supplied || !sameSecret(supplied, token)) {
    return NextResponse.json({ error: 'That is not the admin token.' }, { status: 401, headers: noStore })
  }
  const res = NextResponse.json({ mode: 'token', unlocked: true } satisfies OwnerAccessStatus, { headers: noStore })
  res.cookies.set(OWNER_COOKIE, ownerCookieValue(token), ownerCookieOptions(req, OWNER_COOKIE_MAX_AGE_S))
  return res
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ mode: modeFor(req), unlocked: false } satisfies OwnerAccessStatus, { headers: noStore })
  res.cookies.set(OWNER_COOKIE, '', ownerCookieOptions(req, 0))
  return res
}
