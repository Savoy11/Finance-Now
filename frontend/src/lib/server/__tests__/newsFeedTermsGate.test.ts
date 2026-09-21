import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { assertSourceNotProhibited, SourceTermsError } from '../sourceTerms'

/**
 * The three news routes fetch HARDCODED publisher feeds, and until 2026-09-20 none of
 * them checked the source-terms registry before doing it.
 *
 * ⚠ WHY THAT WAS NOT OBVIOUS. `pinnedFetch` calls `assertSourceNotProhibited` internally,
 * and CLAUDE.md describes that as binding "every request forever". It binds every request
 * THAT GOES THROUGH pinnedFetch — and 39 of the live-data routes use a bare `fetch()`.
 * In these three, pinnedFetch was reached only by user-added CUSTOM feeds; the built-in
 * publisher feeds went straight out. So a `prohibited` verdict governed the feeds a user
 * pasted in and not the ones the app ships with, which is exactly backwards.
 *
 * It became load-bearing on 2026-09-20, when dowjones.io was the first prohibition to
 * withdraw a *working* feed (Dow Jones ToU §9.1/§9.4.1). Removing the feed from the route
 * stops it being fetched today. Only a gate stops it being re-added tomorrow.
 *
 * ⚠ THE GATE IS CALLED DIRECTLY, NOT BY ADOPTING pinnedFetch, and the test asserts that
 * on purpose. pinnedFetch uses a custom undici dispatcher, which opts the request out of
 * Next's Data Cache — switching these routes to it would silently kill `revalidate` and
 * send every page load to the publisher. For news feeds that means MORE load on the very
 * publishers whose terms the gate exists to respect. `assertSourceNotProhibited` is a
 * pure registry lookup with no network, so it costs nothing and keeps the cache.
 */

const routes = join(__dirname, '..', '..', '..', 'app', 'live-data')

const FEED_ROUTES = [
  { name: 'market-news', file: join(routes, 'market-news', 'route.ts') },
  { name: 'macro-news', file: join(routes, 'macro-news', 'route.ts') },
  { name: 'news', file: join(routes, 'news', 'route.ts') },
]

const read = (f: string) => readFileSync(f, 'utf8')

describe('news routes gate their built-in feeds on the source-terms registry', () => {
  it('has routes to check (guards against this list silently emptying)', () => {
    expect(FEED_ROUTES.length).toBeGreaterThan(0)
    for (const r of FEED_ROUTES) expect(read(r.file).length, `${r.name} is empty`).toBeGreaterThan(0)
  })

  it.each(FEED_ROUTES)('$name reaches the terms gate before fetching', ({ file }) => {
    const src = read(file)
    const direct = /assertSourceNotProhibited\s*\(/.test(src)
    const viaPinned = /pinnedFetch\s*\(/.test(src)
    expect(
      direct || viaPinned,
      'route fetches publisher feeds without reaching assertSourceNotProhibited — ' +
        'either call it directly (keeps Next caching) or fetch through pinnedFetch',
    ).toBe(true)
  })

  // ── The behavioural half. The checks above are textual and would pass against a
  //    registry that had stopped blocking anything at all.
  it('actually blocks the prohibited feed host and not its neighbours', () => {
    expect(() =>
      assertSourceNotProhibited('https://feeds.content.dowjones.io/public/rss/mw_topstories'),
    ).toThrow(SourceTermsError)
    expect(() =>
      assertSourceNotProhibited('https://feeds.content.dowjones.io/public/rss/mw_bulletins'),
    ).toThrow(SourceTermsError)

    // The surviving feeds must NOT be blocked — a gate that refuses everything would
    // satisfy the assertions above while emptying every news surface.
    expect(() =>
      assertSourceNotProhibited('https://search.cnbc.com/rs/search/combinedcms/view.xml'),
    ).not.toThrow()
    expect(() => assertSourceNotProhibited('https://www.investing.com/rss/news_11.rss')).not.toThrow()
    expect(() => assertSourceNotProhibited('https://www.coindesk.com/arc/outboundfeeds/rss/')).not.toThrow()
  })

  // ⚠ The routes that still use a bare fetch() keep their Next cache, and that is the
  //    reason the gate is called directly. If someone "simplifies" this by switching to
  //    pinnedFetch, `revalidate` stops working silently — so the caching intent is
  //    asserted rather than left to a comment.
  it.each([
    { name: 'market-news', file: join(routes, 'market-news', 'route.ts') },
    { name: 'macro-news', file: join(routes, 'macro-news', 'route.ts') },
  ])('$name keeps its Next revalidate cache on the built-in feed fetch', ({ file }) => {
    const src = read(file)
    expect(
      /next:\s*\{\s*revalidate:/.test(src),
      'built-in feed fetch lost its `next: { revalidate }` — pinnedFetch’s dispatcher ' +
        'opts out of the Data Cache, so adopting it here sends every page load upstream',
    ).toBe(true)
  })
})
