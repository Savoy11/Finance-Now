// The platform fetch, behind the two source-terms checks pinnedFetch runs first.
//
// Why this exists (2026-10-13). CLAUDE.md said the Reddit robots gate lives in pinnedFetch
// "so a new call site inherits it", and that a prohibited host re-added to any fetcher
// fails at the socket. Both hold only for code that calls pinnedFetch, which was 4 of the
// 60 /live-data routes; the rest use the platform fetch. The Integrations page's Test
// button for Reddit Finance was one of them: it fetched reddit.com/r/stocks/hot.json on
// every click, while the registry entry says robots.txt disallows this app's agent and
// "Until then Finance Now does not fetch reddit.com".
//
// Why not pinnedFetch itself: it routes through a custom dispatcher, which takes the
// request out of Next's fetch cache (see the warning on that function). Callers that need
// `next: { revalidate }`, including the Tiingo probe whose `revalidate: 0` is a licence
// condition, keep it here. pinnedFetch remains the one to use for a URL a user supplied:
// it also pins the connection to a vetted address, which a built-in host does not need.

import { assertRobotsPermits, assertSourceNotProhibited } from '@/lib/server/sourceTerms'

/**
 * fetch(), refused before anything is opened when the registry prohibits the host
 * (SourceTermsError) or its robots.txt disallows this app's agent and the lifting
 * credential is not configured (RobotsDisallowedError). `init` passes through unchanged.
 */
export async function termsGatedFetch(
  url: string,
  init?: RequestInit,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Response> {
  assertSourceNotProhibited(url)
  assertRobotsPermits(url, env)
  return fetch(url, init)
}
