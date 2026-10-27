import { NextResponse, type NextRequest } from 'next/server'
import { isLocalRequest } from './apiGuard'
import { INTERNAL_HEADER, internalApiToken, presentedKey } from './apiKeys'
import { adminToken, isHttps, ownerCookieMatches, sameSecret } from './ownerAccess'

// The site is locked to its owner until launch (hosting brief §4 item 1; owner decision D174,
// 2026-10-26: "Keep sign-in off until launch").
//
// Under D22 the first page load by anyone other than the owner IS launch, and a test copy someone
// else can reach counts. That would take the app outside the free licences it runs on before
// launch (FMP, Finnhub and Twelve Data are personal use only; NewsAPI's free plan forbids staging
// and production outright), which hold only while the owner is the only user (D96). With sign-in
// off until launch, sign-in cannot be the lock, so the owner cookie /owner issues is:
//
// - On the owner's machine (localhost) nothing changes.
// - On any other host, every page and route needs the owner cookie, unless FN_SITE_OPEN=true.
//   Setting it is the launch, and nothing else opens the site.
// - Pages redirect to /owner, where the owner types FN_ADMIN_TOKEN once; routes answer 401.
// - Always open: /owner and /api/owner (to unlock), /api/health (the host's and the uptime
//   check's probe; it reads no data) and the app icon.
// - The app's own server-side calls to itself carry the internal token (selfRequestHeaders in
//   apiKeys.ts), and /api/v1 requests carrying a key go on to the API's own key check, so the
//   owner's MCP server works from another machine.
//
// Closed by default, like the owner's tools (apiGuard) and the public API (apiKeys): a host
// deployed with nothing set shows nothing but the unlock page.

/** Where a locked page sends the browser. */
export const LOCK_REDIRECT = '/owner?locked=1'

/** Paths that stay reachable while the site is locked. */
export const LOCK_EXEMPT_PATHS = ['/owner', '/api/owner', '/api/health', '/icon'] as const

export function siteOpen(): boolean {
  return process.env.FN_SITE_OPEN === 'true'
}

function exempt(pathname: string): boolean {
  return LOCK_EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

function isRoute(pathname: string): boolean {
  return pathname.startsWith('/api/') || pathname.startsWith('/live-data/')
}

/** Whether the lock lets this request through. */
export function siteLockAllows(req: NextRequest): boolean {
  if (siteOpen() || isLocalRequest(req)) return true
  const { pathname } = req.nextUrl
  if (exempt(pathname)) return true
  const internal = req.headers.get(INTERNAL_HEADER)
  if (internal && sameSecret(internal, internalApiToken())) return true
  // The key itself is checked by guardApiV1, the first statement of every /api/v1 handler.
  if (pathname.startsWith('/api/v1') && presentedKey(req)) return true
  const token = adminToken()
  return !!token && ownerCookieMatches(req, token)
}

/** The lock's answer: null to proceed, else a redirect to /owner (pages) or a 401 (routes). */
export function siteLockResponse(req: NextRequest): NextResponse | null {
  if (siteLockAllows(req)) return null
  const { pathname } = req.nextUrl
  if (isRoute(pathname)) {
    return NextResponse.json(
      { error: 'This site is locked to its owner until launch. Unlock this browser at /owner.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }
  return new NextResponse(null, { status: 307, headers: { Location: lockRedirectUrl(req), 'Cache-Control': 'no-store' } })
}

/**
 * The redirect's address, on the host the browser asked for. Next.js refuses a relative Location
 * from middleware, and behind a host's proxy the server's own idea of its address (req.nextUrl)
 * can be an internal one, such as 0.0.0.0:8080.
 */
export function lockRedirectUrl(req: NextRequest): string {
  const host = req.headers.get('host') || req.nextUrl.host
  return `${isHttps(req) ? 'https' : 'http'}://${host}${LOCK_REDIRECT}`
}
