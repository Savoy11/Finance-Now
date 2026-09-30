import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * T-411 (2026-09-26). Source-mirror guards on the two fee scripts — they need sec.gov
 * and a multi-hundred-MB extraction to run, so the properties pinned here are about
 * their shape: that build-fund-fees.mjs walks quarters through the tested helper and
 * accepts candidates, and that the prospectus probe reads BOTH SEC ticker maps.
 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const fees = strip(readFileSync(join(process.cwd(), 'scripts/build-fund-fees.mjs'), 'utf8'))
const probe = strip(readFileSync(join(process.cwd(), 'scripts/probe-fund-prospectus-fees.mjs'), 'utf8'))

describe('build-fund-fees.mjs reads across quarters and accepts candidates', () => {
  it('selects quarters and merges hits through the unit-tested helper, not inline logic', () => {
    expect(fees).toMatch(/import \{ selectQuarters, mergeFirstHit \} from '\.\/lib\/rrQuarters\.mjs'/)
    expect(fees).toMatch(/selectQuarters\(links, \{ pinned, limit \}\)/)
    expect(fees).toMatch(/const byTicker = mergeFirstHit\(perQuarter\)/)
  })

  it('caches every quarter under its own suffixed folder — no unsuffixed cache that cannot say which quarter it holds', () => {
    expect(fees).toMatch(/`fn-rr-cache-\$\{d\.key\}`/)
    expect(fees).not.toMatch(/'fn-rr-cache'\)/)
  })

  it('reads the TOTAL expense line for every fund and the NET line only where a waiver exists', () => {
    // Until 2026-09-26 ExpensesOverAssets sat second in the NET list, so it was never read
    // in an archive that carried NetExpensesOverAssets for any fund — every no-waiver fund
    // reported no-expense-value. Pin the split.
    const net = /netExpenseRatio: \[([^\]]*)\]/.exec(fees)?.[1] ?? ''
    const gross = /grossExpenseRatio: \[([^\]]*)\]/.exec(fees)?.[1] ?? ''
    expect(net).toMatch(/'NetExpensesOverAssets'/)
    expect(net).not.toMatch(/'ExpensesOverAssets'/)
    expect(gross).toMatch(/^\s*'ExpensesOverAssets'/)
  })

  it('takes --symbols and reports a non-catalogued candidate without a delta', () => {
    expect(fees).toMatch(/process\.argv\.indexOf\('--symbols'\)/)
    expect(fees).toMatch(/expenseDeltaPct: secEr && catalogued \?/)
    expect(fees).toMatch(/Not in the catalog — SEC figure only/)
  })

  it('records which quarter each figure came from', () => {
    expect(fees).toMatch(/quarter: hit\?\.quarter \?\? null/)
    expect(fees).toMatch(/quartersRead: quarters\.map/)
  })

  it('still reports, never writes: nothing touches fundCatalog.ts or the stamp', () => {
    expect(fees).not.toMatch(/writeFileSync\([^)]*fundCatalog/)
    expect(fees).not.toMatch(/FUND_DATA_LAST_VERIFIED\s*=/)
  })
})

describe('probe-fund-prospectus-fees.mjs resolves a CIK through both SEC ticker maps', () => {
  it('reads company_tickers.json AND company_tickers_mf.json', () => {
    expect(probe).toMatch(/company_tickers\.json/)
    expect(probe).toMatch(/company_tickers_mf\.json/)
  })

  it('the operating-company map wins where both carry a ticker; the fund map fills the rest', () => {
    expect(probe).toMatch(/if \(!map\.has\(sym\)\) map\.set\(sym, \{ cik: [^}]*via: 'company_tickers_mf\.json' \}\)/)
  })

  it('a miss names both maps, so "no CIK" is read as the script’s reach and not as a fact about the fund', () => {
    expect(probe).toMatch(/no CIK in company_tickers\.json or company_tickers_mf\.json/)
  })

  it('a fund-map resolution is reported but its trust-wide prospectus is NOT read as the fund’s fee', () => {
    // The 2026-09-26 demonstration: XLC → Select Sector SPDR Trust → a sibling fund’s 0.35%
    // reported as "differs by +0.27pp". The status exists so the row is never a number.
    expect(probe).toMatch(/status: 'trust-unscoped'/)
    expect(probe).toMatch(/npm run fund-fees -- --symbols/)
    const branch = probe.slice(probe.indexOf("if (resolved.via === 'company_tickers_mf.json')"))
    expect(branch.slice(0, branch.indexOf('continue'))).not.toMatch(/candidateFilings|extractFee|FEE_LABELS/)
  })

  it('still reports, never writes', () => {
    expect(probe).not.toMatch(/writeFileSync\([^)]*fundCatalog/)
  })
})

describe('guards the guard', () => {
  it('the pre-T-411 shapes would fail these assertions', () => {
    const oldFees = "const work = path.join(os.tmpdir(), q ? `fn-rr-cache-${q}` : 'fn-rr-cache')\n  await download(await newestDatasetUrl(), zip)"
    expect(oldFees).toMatch(/'fn-rr-cache'\)/)
    expect(oldFees).not.toMatch(/mergeFirstHit/)
    const oldProbe = "log(`  ${symbol.padEnd(6)} no CIK in company_tickers.json`)"
    expect(oldProbe).not.toMatch(/company_tickers_mf\.json/)
  })
})
