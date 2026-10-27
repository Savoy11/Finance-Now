import { NextResponse, type NextRequest } from 'next/server'
import { siteLockResponse } from '@/lib/server/siteLock'

/**
 * Two jobs, in this order.
 *
 * 1. The site lock (lib/server/siteLock.ts, D174): until launch, on any host but the owner's
 *    machine, every page and route needs the owner cookie /owner issues, unless FN_SITE_OPEN=true.
 *    It runs on the Node.js runtime so it shares the owner cookie's and the API key's code with
 *    the route handlers instead of keeping a second copy for the Edge runtime.
 *
 * 2. Request logging for the public `/api/v1/*` contract (R2 §5.3, decision E2).
 *
 * Finance Now has no consumer telemetry on `/api/v1/`, so "no one is using it" is an
 * assumption, not a fact. This middleware emits one structured line per v1
 * request (method, path, query, a coarse client fingerprint) so a deprecation
 * decision is grounded in evidence. The logging is deliberately read-only: it never
 * blocks, rewrites, or mutates the response.
 *
 * It was written to decide whether the staking endpoint's legacy `riskScore` /
 * `max_risk` fields could be removed. Owner decision D14 (2026-09-14) removed
 * them on editorial grounds instead, without waiting for traffic data — so the
 * `max_risk` flag below no longer informs that decision. It is KEPT because its
 * meaning inverted into something more useful: a request still carrying
 * `max_risk` is a client whose filter is now being IGNORED, and which is
 * therefore receiving more rows than it asked for. That is the one failure mode
 * the route's graceful-ignore behaviour can produce, and this is how it
 * surfaces.
 *
 * The line is JSON on a single line for easy ingestion. It intentionally does
 * NOT log request bodies, cookies, or full headers (no auth/PII leakage).
 */
export function middleware(req: NextRequest) {
  const locked = siteLockResponse(req)
  if (locked) return locked

  const { pathname, search } = req.nextUrl
  if (!pathname.startsWith('/api/v1')) return NextResponse.next()

  // A client still sending max_risk is being silently un-filtered (D14 removed
  // the parameter). Logged so the widened result set is attributable.
  const usesRemovedRiskFilter =
    pathname.endsWith('/staking/opportunities') &&
    (req.nextUrl.searchParams.has('max_risk') ||
      req.nextUrl.searchParams.has('min_safety') ||
      req.nextUrl.searchParams.has('max_safety'))

  try {
    console.log(
      JSON.stringify({
        tag: 'api-v1-request',
        method: req.method,
        path: pathname,
        query: search || undefined,
        ua: req.headers.get('user-agent') || undefined,
        referer: req.headers.get('referer') || undefined,
        removedRiskFilter: usesRemovedRiskFilter || undefined,
      })
    )
  } catch {
    // Logging must never break a request.
  }

  return NextResponse.next()
}

export const config = {
  runtime: 'nodejs',
  // Every request but Next's own build files: the lock covers pages and routes alike.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
