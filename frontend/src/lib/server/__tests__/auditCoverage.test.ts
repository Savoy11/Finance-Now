import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { NOT_AUDITED, appRoutes, auditCalls, coverageGaps } from '../../../../scripts/lib/auditCoverage.mjs'
import { GET as fundingRates } from '@/app/live-data/funding-rates/route'
import { GET as futuresCurve } from '@/app/live-data/futures-curve/route'
import { GET as optionsScore } from '@/app/api/v1/options/score/route'

// The live-data audit (scripts/test-live-data.mjs) must call every /live-data and /api/v1
// route or name it in NOT_AUDITED with the reason, and must not report a decided state as
// a fault.
//
// On 2026-10-14 it called 50 of 60 /live-data routes and 8 of 13 /api/v1 routes while its
// header said "every", and its funding-rates check had failed the whole run for two weeks
// over a source the owner withdrew on terms (D40). The audit runs on import, so its checks
// are lifted out of the file and executed here, the way archiveBranchWorkflow.test.ts runs
// its workflow's script; where a route answers without the network, the check is fed that
// route's real response.

const FRONTEND = process.cwd()
const AUDIT = readFileSync(join(FRONTEND, 'scripts', 'test-live-data.mjs'), 'utf8')
const ROUTES = appRoutes(join(FRONTEND, 'src', 'app'))

type Verdict = { verdict: string; detail: string }
type Check = (json: unknown, status: number, headers: Headers) => string | Verdict

/** One test object from the audit's `tests` array, by its name, with the verdict helpers it uses. */
function auditTest(name: string): { path: string; expectStatus?: number | number[]; check: Check } {
  const at = AUDIT.indexOf(`name: '${name}'`)
  if (at === -1) throw new Error(`the audit has no test named '${name}'`)
  const start = AUDIT.lastIndexOf('{ group:', at)
  let depth = 0
  let end = start
  for (; end < AUDIT.length; end++) {
    if (AUDIT[end] === '{') depth++
    else if (AUDIT[end] === '}' && --depth === 0) break
  }
  const helpers = {
    fallback: (detail: string) => ({ verdict: 'FALLBACK', detail }),
    unconfigured: (detail: string) => ({ verdict: 'UNCONFIGURED', detail }),
    empty: (detail: string) => ({ verdict: 'EMPTY', detail }),
  }
  return new Function(...Object.keys(helpers), `return (${AUDIT.slice(start, end + 1)})`)(...Object.values(helpers))
}

/** What the audit's runner would record: a thrown check is FAIL, a string is REAL. */
function verdictOf(check: Check, json: unknown, status = 200, headers = new Headers()): Verdict {
  try {
    const r = check(json, status, headers)
    return typeof r === 'string' ? { verdict: 'REAL', detail: r } : r
  } catch (e) {
    return { verdict: 'FAIL', detail: (e as Error).message }
  }
}

describe('the live-data audit calls every route', () => {
  it('finds the app’s routes (guards the guard)', () => {
    expect(ROUTES.filter((r) => r.startsWith('/live-data/')).length).toBeGreaterThan(50)
    expect(ROUTES).toContain('/api/v1')
    expect(ROUTES).toContain('/api/v1/macro/fx-rates')
    expect(ROUTES).toContain('/live-data/wallet/btc')
  })

  it('calls each route, or names it in NOT_AUDITED with a reason', () => {
    expect(coverageGaps(AUDIT, ROUTES)).toEqual([])
    for (const reason of Object.values(NOT_AUDITED)) expect(reason.length).toBeGreaterThan(40)
  })

  it('reports an uncalled route, a route both called and excused, and an excuse for no route', () => {
    const audit = "const tests = [{ path: '/live-data/a?x=1' }, { path: '/live-data/b' }]"
    expect(coverageGaps(audit, ['/live-data/a', '/live-data/b', '/live-data/c'], { '/live-data/b': 'why', '/live-data/gone': 'why' })).toEqual([
      '/live-data/b: called by the audit and also named in NOT_AUDITED; drop one',
      '/live-data/c: never called by the audit, and not named in NOT_AUDITED',
      'NOT_AUDITED names /live-data/gone, which is not a route',
    ])
  })

  it('does not count a longer path, or a comment, as calling a route', () => {
    expect(auditCalls("path: '/live-data/fx-rates-extended'", '/live-data/fx-rates')).toBe(false)
    expect(auditCalls("path: '/live-data/fx-rates'", '/live-data/fx-rates')).toBe(true)
    expect(auditCalls("path: '/api/v1/'", '/api/v1')).toBe(true)
    expect(coverageGaps("// path: '/live-data/a'", ['/live-data/a'], {})).toHaveLength(1)
  })
})

describe('the audit reports a decided state as a decision, against the route’s real answer', () => {
  it('funding-rates: no source since D40 is UNCONFIGURED with the reason, not FAIL', async () => {
    const res = await fundingRates()
    const v = verdictOf(auditTest('funding-rates (no source, D40)').check, await res.json())
    expect(v.verdict).toBe('UNCONFIGURED')
    expect(v.detail).toMatch(/D40/)
  })

  it('futures-curve: no dated-contract source is UNCONFIGURED, with the months it resolved', async () => {
    const t = auditTest('futures-curve gold (no source)')
    const res = await futuresCurve(new NextRequest(`http://localhost${t.path}`))
    const v = verdictOf(t.check, await res.json(), res.status)
    expect(v.verdict).toBe('UNCONFIGURED')
    expect(v.detail).toMatch(/contract months resolved/)
  })

  it('v1 options score: the 503 the runner expects is what the route sends, with a reason', async () => {
    const t = auditTest('v1 options score (withheld, D64)')
    // The audit calls the dev server on localhost, where no API key is needed (D173).
    const res = await optionsScore(new NextRequest('http://localhost/api/v1/options/score', { headers: { host: 'localhost:3000' } }))
    expect(t.expectStatus).toBe(res.status)
    expect(verdictOf(t.check, await res.json(), res.status).verdict).toBe('REAL')
  })

  it('stock-social: Reddit withheld by its robots gate is UNCONFIGURED, not a green row', () => {
    const check = auditTest('stock-social').check
    const signals = [{ platform: 'stocktwits' }, { platform: 'stocktwits' }]
    const withheld = [{ id: 'reddit-stocks', name: 'Reddit', reason: 'Reddit is not read: its robots.txt disallows this app.' }]
    expect(verdictOf(check, { ok: true, signals, providers: [{ id: 'stocktwits' }], withheld }).verdict).toBe('UNCONFIGURED')
    expect(verdictOf(check, { ok: true, signals, providers: [{ id: 'stocktwits' }] }).verdict).toBe('REAL')
    // The id the check reads is the one the route sends.
    expect(readFileSync(join(FRONTEND, 'src/app/live-data/stock-social/route.ts'), 'utf8')).toMatch(/withheld: \[\{\s*id: 'reddit-stocks'/)
  })

  it('staking-rates: a fallback withheld past its window is reported, and only a key gone for no reason fails', () => {
    const check = auditTest('staking-rates').check
    const rates = { renzo_eth: 3, kelp_eth: 3, benqi_avax: 5, lombard_btc: 1, quicksilver_atom: 10, lido_eth: 3, marinade_sol: 7, jito_sol: 7 }
    const sources = { lido_eth: 'live', marinade_sol: 'live', jito_sol: 'live' }
    const base = { ok: true, rates, sources, upstreams: { 'defillama-yields': 'http-error (HTTP 500)' } }
    const expired = verdictOf(check, { ...base, gaps: { frax_eth: 'estimate-expired' } })
    expect(expired.verdict).toBe('FALLBACK')
    expect(expired.detail).toMatch(/withheld past their 14-day window.*frax_eth/)
    expect(verdictOf(check, { ...base, gaps: {} }).verdict).toBe('FAIL')
  })
})
