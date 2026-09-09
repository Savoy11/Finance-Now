import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Repo-wide guard: a CoinGecko route may not report a refusal as a bare status.
 *
 * This exists because fixing it once was not enough. Four audit pacing models
 * were tuned against a rate limit nobody had read, so `describeThrottle` was
 * added to capture what CoinGecko says about its own allowance — but it went
 * into `coingeckoPages.ts` only. The very next run's derived-gap change moved the
 * refusal off the paging routes onto `alerts` and `portfolio-history`, which
 * fetch CoinGecko directly, and the run reported `HTTP 429` with nothing attached
 * and settled nothing.
 *
 * Instrumenting the site that happens to be failing is whack-a-mole. This walks
 * every CoinGecko route instead, so the next one added inherits the requirement
 * rather than rediscovering it. Same enforcement idiom as sourceTerms.test.ts.
 */

const liveData = join(__dirname, '..', '..', '..', 'app', 'live-data')

function routeFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...routeFiles(full))
    else if (entry === 'route.ts') out.push(full)
  }
  return out
}

/** A failure string built from a Response status — the shape that loses the headers. */
const REPORTS_BARE_STATUS = /HTTP \$\{\s*\w+\.status\s*\}/

const coinGeckoRoutes = routeFiles(liveData)
  .map((f) => ({ path: f.slice(f.indexOf('live-data')), src: readFileSync(f, 'utf8') }))
  .filter((r) => /api\.coingecko\.com|coingeckoBase\(\)/.test(r.src))

describe('CoinGecko routes report the stated limit, not just the status', () => {
  it('finds the CoinGecko routes at all (guards the walker)', () => {
    // A walker that matched nothing would make the assertion below vacuous.
    expect(coinGeckoRoutes.length).toBeGreaterThan(5)
    expect(coinGeckoRoutes.map((r) => r.path).join(' ')).toContain('alerts')
  })

  it('every route building an HTTP-status failure string also describes the throttle', () => {
    const offenders = coinGeckoRoutes
      .filter((r) => REPORTS_BARE_STATUS.test(r.src) && !r.src.includes('describeThrottle'))
      .map((r) => r.path)

    expect(
      offenders,
      'These CoinGecko routes turn a refusal into a bare status, discarding the '
      + 'rate-limit headers and body that say what the allowance actually is. '
      + "Import describeThrottle from '@/lib/server/coingeckoThrottle' and append "
      + `it to the failure string:\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })

  it('the shared reporter is the only implementation', () => {
    // Two copies drift, and the one that drifts is always the one that fires.
    const withHeaderList = routeFiles(liveData)
      .concat([join(__dirname, '..', 'coingeckoPages.ts')])
      .filter((f) => readFileSync(f, 'utf8').includes("'x-ratelimit-limit'"))
      .map((f) => f.slice(f.indexOf('src')))

    expect(withHeaderList, 'header list duplicated outside coingeckoThrottle.ts').toEqual([])
  })
})
