import { NextRequest, NextResponse } from 'next/server'
import { guardSensitiveRoute } from '@/lib/server/apiGuard'
import {
  discoverArticles,
  DISCOVERY_MODULES,
  type DiscoveryModule,
  type DiscoveryResult,
} from '@/lib/server/newsDiscovery'

// News discovery — coverage from outlets the app does NOT already carry.
//   GET /live-data/news-discovery?module=crypto
//   GET /live-data/news-discovery?module=equities&q=NVDA supply chain
//
// ⚠ THIS ROUTE SPENDS MONEY. Every call bills Anthropic per web search. It is
// USER-TRIGGERED ONLY — never call it on mount, on an interval, or from a
// prefetch. `guardSensitiveRoute` rate-limits it for the same reason it guards the
// agent routes: a surface that costs per render is one accidental useEffect away
// from a bill nobody decided to spend.
//
// ⚠ IT FETCHES NO PUBLISHER. Retrieval happens inside Anthropic's server-side
// web_search tool; this app receives titles, URLs and snippets. That is what makes
// the feature possible at all — sourceTerms.test.ts fails the build on any host a
// route fetches without a dated verdict, and an unbounded set of small outlets can
// never satisfy that. Results are displayed as headline + source + link OUT, and
// carry `registered: false` so no surface can imply they are vetted sources.
//
// Promoting a good outlet into the app is unchanged and still gated: Integrations →
// add a custom feed, which runs probeSiteTerms and the 403/409 terms gate.

export const dynamic = 'force-dynamic'

export type { DiscoveredArticle, DiscoveryResult } from '@/lib/server/newsDiscovery'

/**
 * Hard ceiling on billed searches per request.
 *
 * Four is enough for the model to try a couple of phrasings and follow one thread. It
 * is a CEILING, not a target — most runs use fewer. Raising it raises the bill
 * linearly, so it is not a knob to turn casually; `maxUses` is deliberately not
 * accepted from the query string.
 */
const MAX_SEARCHES = 4

export async function GET(request: NextRequest) {
  // Same guard the agent routes use: token-or-localhost, and rate-limited. The number
  // is low because each call costs real money, unlike the RSS routes beside it.
  const denied = guardSensitiveRoute(request, 'news-discovery', 10)
  if (denied) return denied

  const moduleParam = (request.nextUrl.searchParams.get('module') ?? '').toLowerCase()
  if (!DISCOVERY_MODULES.includes(moduleParam as DiscoveryModule)) {
    return NextResponse.json(
      { ok: false, error: `module must be one of ${DISCOVERY_MODULES.join(', ')}` },
      { status: 400 },
    )
  }

  const query = (request.nextUrl.searchParams.get('q') ?? '').slice(0, 200)

  const result = await discoverArticles({
    module: moduleParam as DiscoveryModule,
    query,
    maxUses: MAX_SEARCHES,
  })

  // A failed search is reported as ok:false with the reason, not as an empty list.
  // "Found nothing" and "could not look" need different answers from the UI — the
  // first is a real result, the second is a broken feature wearing its clothes.
  return NextResponse.json(result satisfies DiscoveryResult, { status: result.ok ? 200 : 502 })
}
