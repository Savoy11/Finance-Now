import crypto from 'crypto'
import type { NextRequest } from 'next/server'

// Owner access off localhost (hosting brief §4 item 2, 2026-10-26).
//
// With FN_ADMIN_TOKEN set, guardSensitiveRoute requires the token on every request to
// the owner's tools (AI agents, the Pump Report, Integrations, prompts, video answers,
// the hidden ratings). No page in the app sends it, so on a host every one of those
// answered 401. The owner now types the token once at /owner; the server checks it and
// sets a cookie the guard accepts instead.
//
// The cookie never holds the token: it holds an HMAC of a fixed label keyed by the token,
// so it reveals nothing about the token, and changing FN_ADMIN_TOKEN voids every cookie
// issued under the old one. It is HttpOnly (no script can read it) and SameSite=Strict
// (no other site can make the browser send it), and a request the browser marks as
// cross-site is refused even if the cookie arrives. Without FN_ADMIN_TOKEN there is no
// cookie to issue: the tools stay localhost-only, as before.

export const OWNER_COOKIE = 'fn_owner'
/** How long one unlock lasts on a browser: 30 days. */
export const OWNER_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60

const LABEL = 'finance-now-owner-cookie-v1'

export function adminToken(): string | undefined {
  return process.env.FN_ADMIN_TOKEN || process.env.CAEP_ADMIN_TOKEN || undefined
}

/** The cookie's value for this token. */
export function ownerCookieValue(token: string): string {
  return crypto.createHmac('sha256', token).update(LABEL).digest('hex')
}

export function sameSecret(supplied: string, expected: string): boolean {
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** The browser said this request came from another site (Fetch Metadata). */
export function isCrossSite(req: NextRequest): boolean {
  return req.headers.get('sec-fetch-site') === 'cross-site'
}

/** True when the request carries a valid owner cookie for `token`. */
export function ownerCookieMatches(req: NextRequest, token: string): boolean {
  if (isCrossSite(req)) return false
  const supplied = req.cookies.get(OWNER_COOKIE)?.value ?? ''
  return supplied.length > 0 && sameSecret(supplied, ownerCookieValue(token))
}

/** Whether the request reached the app over HTTPS, directly or through the host's proxy. */
export function isHttps(req: NextRequest): boolean {
  const forwarded = req.headers.get('x-forwarded-proto')?.split(',')[0].trim().toLowerCase()
  return forwarded ? forwarded === 'https' : req.nextUrl.protocol === 'https:'
}

/** Cookie options: Secure whenever the request came over HTTPS, so localhost over HTTP still works. */
export function ownerCookieOptions(req: NextRequest, maxAge: number) {
  return { httpOnly: true, sameSite: 'strict' as const, secure: isHttps(req), path: '/', maxAge }
}
