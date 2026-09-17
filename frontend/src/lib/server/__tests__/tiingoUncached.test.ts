import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Repo-wide guard: no Tiingo fetch may be cached by Next's Data Cache.
 *
 * Owner decision 2026-09-15 — development runs on a Tiingo STARTER plan, whose
 * ToS §1.6(a) forbids retaining Tiingo Data in "any persistent or durable
 * storage", permits only transient processing "in volatile memory or in a
 * temporary, non-persistent cache", and requires removal "immediately after the
 * calculation or operation is completed". File systems, caches, logs and backups
 * are named explicitly.
 *
 * Next's `next: { revalidate: N }` persists responses to `.next/cache` on disk.
 * For any N > 0 that is precisely the prohibited case.
 *
 * WHY A SOURCE SCAN rather than a behavioural test: the constraint is a property
 * of how the fetch is *written*, and the failure mode is someone adding a cache
 * back as a performance win — `security-returns` fetches per symbol and is
 * genuinely expensive uncached, so the temptation is real and looks like an
 * optimisation rather than a licence breach. Same enforcement idiom as
 * coingeckoThrottleReporting.test.ts and sourceTerms.test.ts.
 *
 * If the plan ever moves to a tier without §1.6(a), this test is the thing to
 * delete — deliberately, with the decision written down, not quietly.
 *
 * ⚠ IT SCANS THE WHOLE SOURCE TREE, and that is the point. The first version of
 * this test walked only `app/live-data/**` because that is where the audit said
 * the two Tiingo fetches were. Widening it found THREE more call sites the audit
 * never mentioned — `fetchTiingoQuotes` (revalidate 60) and `fetchTiingoChart`
 * (revalidate 300) in lib/api/live/marketData.ts, plus the key-test ping in
 * live-data/config. Two of those were cached. Scoping an enforcement test to
 * where the known instances are is how the unknown instances survive.
 */

const srcRoot = join(__dirname, '..', '..', '..')

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(full)
  }
  return out
}

const tiingoRoutes = sourceFiles(srcRoot)
  .map((f) => ({ path: f.slice(f.indexOf('src')).replace(/\\/g, '/'), src: readFileSync(f, 'utf8') }))
  // The registry and catalog NAME the host without fetching it.
  .filter((r) => /fetch\(\s*$|api\.tiingo\.com/.test(r.src) && /api\.tiingo\.com/.test(r.src))
  .filter((r) => !/sourceTerms\.ts$|dataSources\.ts$/.test(r.path))

/**
 * The fetch options that follow a Tiingo URL, up to the end of the call.
 * Deliberately narrow: it reads the text between the tiingo URL and the next
 * `)` that closes the fetch, so a cached FMP fetch elsewhere in the same file
 * cannot make this pass or fail.
 */
function fetchOptionsAfterTiingoUrl(src: string): string[] {
  const out: string[] = []
  let i = 0
  for (;;) {
    const at = src.indexOf('api.tiingo.com', i)
    if (at === -1) break
    // The options object sits between the URL and the closing paren of fetch(...).
    const tail = src.slice(at, at + 600)
    const close = tail.indexOf('\n  )')
    out.push(close === -1 ? tail : tail.slice(0, close))
    i = at + 'api.tiingo.com'.length
  }
  return out
}

describe('Tiingo is never fetched into a durable cache (Starter ToS §1.6(a))', () => {
  it('finds every Tiingo call site (guards against the scan silently emptying)', () => {
    // Four known fetchers as of 2026-09-15. A NEW one is expected to be added to
    // this list deliberately — that is the review step, not a nuisance.
    expect(tiingoRoutes.map((r) => r.path).sort()).toEqual([
      'src/app/live-data/config/route.ts',
      'src/app/live-data/security-ohlcv/route.ts',
      'src/app/live-data/security-returns/route.ts',
      'src/lib/api/live/marketData.ts',
    ])
  })

  it.each(tiingoRoutes.map((r) => r.path))('%s fetches Tiingo with revalidate: 0', (path) => {
    const route = tiingoRoutes.find((r) => r.path === path)!
    const optionBlocks = fetchOptionsAfterTiingoUrl(route.src)
    expect(optionBlocks.length).toBeGreaterThan(0)

    for (const block of optionBlocks) {
      // Must set revalidate explicitly — an omitted one inherits Next's default
      // caching for the segment, which is not "no cache".
      expect(block, `${path}: Tiingo fetch sets no revalidate`).toMatch(/revalidate:\s*\d/)
      // And it must be 0. A named constant is rejected too: it can be changed
      // elsewhere without touching this call site, which is the regression.
      expect(block, `${path}: Tiingo fetch is cached — §1.6(a) forbids durable storage`)
        .toMatch(/revalidate:\s*0\b/)
      expect(block, `${path}: Tiingo fetch has a non-zero revalidate`)
        .not.toMatch(/revalidate:\s*[1-9]/)
    }
  })

  it('states the constraint next to the code, not only in this test', () => {
    for (const route of tiingoRoutes) {
      expect(route.src, `${route.path}: no comment explaining the uncached fetch`)
        .toMatch(/1\.6\(a\)|Starter/)
    }
  })
})
