// What a CoinGecko refusal actually says about the limit.
//
// WHY THIS IS SHARED, AND WHY IT EXISTS AT ALL
// Four pacing models for the audit harness were tuned against an allowance
// nobody had read — each inferred from how many calls a run happened to make
// before a 429, which is a guess wearing the clothes of a measurement. The first
// attempt at fixing that instrumented only `coingeckoPages.ts`, so when the
// derived-gap change moved the refusal off the paging routes and onto `alerts`
// and `portfolio-history` — which fetch CoinGecko directly — the run still
// reported a bare `HTTP 429` and settled nothing.
//
// So the reporter lives here, and every CoinGecko call site uses it. One
// implementation, because two would drift and the second one to drift is always
// the one that fires.

/** Rate-limit headers CoinGecko may set. Absent ones are simply skipped. */
const RATE_LIMIT_HEADERS = [
  'retry-after',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
] as const

/**
 * A one-line description of what the upstream said about its own limit.
 *
 * Returns a parenthesised suffix to append to an existing status string, e.g.
 * `HTTP 429 (retry-after=58, x-ratelimit-limit=30, message="…")`. Kept to one line
 * because it lands in an audit row and in a route's `upstreamFailures`.
 *
 * The body is read from a CLONE. Reading the original would leave the caller
 * with a disturbed stream, which on the retry path breaks the retry while
 * presenting as a throttling bug.
 *
 * Safe to call on any non-OK response, not only a 429 — a 401 or 403 carrying a
 * plan message is worth the same treatment.
 */
export async function describeThrottle(res: Response): Promise<string> {
  const parts: string[] = []
  for (const h of RATE_LIMIT_HEADERS) {
    const v = res.headers.get(h)
    if (v) parts.push(`${h}=${v}`)
  }
  try {
    const body = (await res.clone().text()).replace(/\s+/g, ' ').trim()
    // CoinGecko states the reason in status.error_message, at the top level on a
    // 429 and under `error` on a plan refusal. The message is taken out whole: a
    // 180-character excerpt of the raw body spent its length on the JSON wrapper,
    // and the 365-day refusal arrived cut off at "within the past 365 da" (T-423).
    const message = errorMessageOf(body)
    if (message) parts.push(`message="${message.slice(0, 300)}"`)
    else if (body) parts.push(`body="${body.slice(0, 180)}"`)
  } catch { /* body already consumed or unreadable — headers still stand */ }

  // "No headers" must not be mistakable for "headers nobody looked at".
  return parts.length ? ` (${parts.join(', ')})` : ' (upstream stated no limit headers)'
}

/** CoinGecko's `status.error_message`, wherever the body nests it, or undefined. */
function errorMessageOf(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { status?: { error_message?: unknown }; error?: { status?: { error_message?: unknown } } }
    const message = parsed?.status?.error_message ?? parsed?.error?.status?.error_message
    return typeof message === 'string' && message.trim() ? message.trim() : undefined
  } catch {
    return undefined
  }
}
