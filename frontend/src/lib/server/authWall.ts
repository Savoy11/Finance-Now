/**
 * The sign-in wall's two questions, pure so the middleware stays thin and the
 * answers are testable (D232, 2026-11-16).
 *
 * The wall itself lives in src/middleware.ts, AFTER the site lock: when
 * FN_REQUIRE_AUTH is "true", a page request without a signed-in session is
 * redirected to /login. It ships DARK — the flag is unset until launch — so
 * turning sign-in on is environment only, no code flip (what T-131's old recipe
 * did with LOGIN_DISABLED and REQUIRE_AUTH constants):
 *
 *   FN_REQUIRE_AUTH=true   — the wall, and /login + /signup start rendering
 *   AUTH_SECRET=…          — Auth.js signs sessions with it (openssl rand -base64 32)
 *   FN_SITE_OPEN=true      — lifts the owner-only site lock (D174), launch's own switch
 *
 * What the wall covers: pages. What it never covers: the (auth) pages themselves
 * (/login, /signup, /reset-password, /owner — or sign-in would wall itself off),
 * the public (legal) pages (/about and below — a signed-out visitor must reach
 * the Privacy Policy, D50), every API and data route (/api/*, including Auth.js's
 * own /api/auth/*, and /live-data/*: each guards itself — apiGuard, guardApiV1,
 * getCurrentUserId — and ROOT-level files with an extension (robots.txt, icons).
 * Only the root: a dot deeper in is part of a page's own address — /equities/BRK.B
 * is a stock — and reading any dot as a file let a signed-out visitor straight to
 * every detail page (2026-11-21 audit). The matcher already excludes Next's
 * build files.
 */

/** True only when the environment turns the wall on. Unset, the app behaves as before. */
export function requireAuthOn(env: Record<string, string | undefined> = process.env): boolean {
  return env.FN_REQUIRE_AUTH === 'true'
}

const OPEN_PREFIXES = ['/login', '/signup', '/reset-password', '/owner', '/about', '/api', '/live-data']

/** Should this path be behind the sign-in wall? Pages yes; the open set and assets no. */
export function walledPath(pathname: string): boolean {
  for (const prefix of OPEN_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return false
  }
  // A dotted name at the ROOT is a file (robots.txt, icons); a dot deeper in is
  // a page's own address (/equities/BRK.B), so it stays walled (2026-11-21 audit).
  if (pathname.lastIndexOf('/') === 0 && pathname.includes('.')) return false
  return true
}
