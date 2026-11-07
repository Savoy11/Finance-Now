import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CHAINS_SHOWN, chainSplit, formatSupplyChange, pctChange, supplyChange } from '../stablecoinSupply'
import { shareOfMaxCirculating, signedPct } from '../coinSupply'
import { FUND_FACTS_BUILT_ON, FUND_NET_ASSETS_LABEL, fundFactsAsOfLabel } from '../fundNetAssets'
import FACTS from '../fundFacts.generated.json'
import { fundFactsFor } from '@/lib/server/fundFacts'
import { cachedArchiveIsCurrent, quarterFromDatasetUrl } from '../../../../scripts/lib/nportQuarter.mjs'

// T-449 (D204): three figures the app already downloaded and threw away.
const read = (p: string) => readFileSync(join(__dirname, '../../../..', p), 'utf8')

describe('(a) stablecoin supply change and where it sits', () => {
  // USDT as DefiLlama returned it on 2026-11-07.
  const usdt = {
    circulating: { peggedUSD: 176776895353.88828 },
    circulatingPrevDay: { peggedUSD: 177495921532.30945 },
    circulatingPrevWeek: { peggedUSD: 179869459208.5747 },
    circulatingPrevMonth: { peggedUSD: 184119585753.7865 },
  }

  it('is today’s supply against a day, a week and a month earlier, as a percent', () => {
    expect(supplyChange(usdt, 'peggedUSD')).toEqual({ day: -0.41, week: -1.72, month: -3.99 })
    // Mutation: divide by today's figure instead of the earlier one and this fails.
    expect(pctChange(110, 100)).toBe(10)
    expect(pctChange(90, 100)).toBe(-10)
  })

  it('reads the amount under the coin’s own peg type, and gives nothing rather than a guess', () => {
    expect(supplyChange({ circulating: { peggedEUR: 105 }, circulatingPrevDay: { peggedEUR: 100 } }, 'peggedEUR').day).toBe(5)
    expect(supplyChange({ circulating: { peggedEUR: 105 }, circulatingPrevDay: { peggedEUR: 100 } }, 'peggedUSD').day).toBeNull()
    expect(supplyChange({ circulating: { peggedUSD: 5 }, circulatingPrevDay: { peggedUSD: 0 } }, 'peggedUSD').day).toBeNull()
    expect(supplyChange({}, 'peggedUSD')).toEqual({ day: null, week: null, month: null })
    expect(formatSupplyChange(-1.72)).toBe('−1.72%')
    expect(formatSupplyChange(0.4)).toBe('+0.40%')
    expect(formatSupplyChange(null)).toBe('—')
  })

  it('names the largest chains, groups the rest, and leaves out a chain holding nothing', () => {
    const chains: Record<string, { current: { peggedUSD: number } }> = {
      Ethereum: { current: { peggedUSD: 600 } }, Tron: { current: { peggedUSD: 300 } }, Solana: { current: { peggedUSD: 50 } },
      Arbitrum: { current: { peggedUSD: 20 } }, Base: { current: { peggedUSD: 15 } }, Polygon: { current: { peggedUSD: 10 } },
      Celo: { current: { peggedUSD: 5 } }, ThunderCore: { current: { peggedUSD: 0 } },
    }
    const s = chainSplit({ chainCirculating: chains }, 'peggedUSD')
    expect(s.top.map((c) => c.chain)).toEqual(['Ethereum', 'Tron', 'Solana', 'Arbitrum', 'Base'])
    expect(s.top).toHaveLength(CHAINS_SHOWN)
    expect(s.top[0]).toEqual({ chain: 'Ethereum', amount: 600, pct: 60 })
    expect(s.others).toEqual({ count: 2, amount: 15, pct: 1.5 })
    expect(chainSplit({}, 'peggedUSD')).toEqual({ top: [], others: null })
  })

  it('reaches the Reserve Monitor and each stablecoin’s page, with no alert on a fall (D204)', () => {
    expect(read('src/app/live-data/reserves/route.ts')).toMatch(/supplyChange: supplyChange\(coin, coin\.pegType/)
    expect(read('src/components/analytics/reserves.tsx')).toContain('<SupplyChangePanel change={selected.supplyChange}')
    expect(read('src/app/(dashboard)/assets/[id]/page.tsx')).toContain('<SupplyChangePanel change={liveAsset.supplyChange')
    // The owner chose figures only: the alert bell reads no supply figure.
    expect(read('src/app/live-data/alerts/route.ts')).not.toMatch(/circulatingPrev|supplyChange/)
  })
})

describe('(b) a coin’s supply and price facts', () => {
  it('works out the share of the maximum circulating, and nothing where the figures disagree', () => {
    expect(shareOfMaxCirculating(19_900_000, 21_000_000)).toBe(94.8)
    expect(shareOfMaxCirculating(21_000_000, 21_000_000)).toBe(100)
    expect(shareOfMaxCirculating(21_500_000, 21_000_000)).toBeNull()
    expect(shareOfMaxCirculating(1, null)).toBeNull()
    expect(shareOfMaxCirculating(1, 0)).toBeNull()
    expect(signedPct(-12.4)).toBe('−12.40%')
    expect(signedPct(3.1, 1)).toBe('+3.1%')
    expect(signedPct(null)).toBeNull()
  })

  it('shows supply as a count of coins, never dollars, and carries total supply through', () => {
    const page = read('src/app/(dashboard)/assets/[id]/page.tsx')
    expect(page).toContain('value={formatOrNA(md.circulatingSupply, formatCompactNumber)}')
    expect(page).toContain("{ label: 'Total supply', value: formatOrNA(asset.totalSupply, formatCompactNumber)")
    expect(read('src/lib/api/live/overlay.ts')).toContain('totalSupply: quote?.totalSupply ?? null,')
  })
})

describe('(c) size and filing trust for funds outside the catalog', () => {
  it('reads the N-PORT file on the server, one fund at a time', () => {
    const voo = fundFactsFor('voo')
    expect(voo?.issuer).toBe('VANGUARD INDEX FUNDS')
    expect(voo?.netAssetsB).toBeGreaterThan(0)
    expect(fundFactsFor('NOPE1')).toBeNull()
    // The 2 MB file is never sent to a browser: only the server module imports it.
    expect(read('src/lib/server/fundFacts.ts')).toMatch(/^import 'server-only'/)
  })

  it('labels the figure as every share class together, never AUM', () => {
    expect(FUND_NET_ASSETS_LABEL).toBe('Fund net assets, all share classes')
    const page = read('src/app/(dashboard)/funds/[symbol]/page.tsx')
    expect(page).toContain('FUND_NET_ASSETS_LABEL')
    expect(read('src/app/live-data/fund-universe/route.ts')).toContain('netAssetsB: facts?.netAssetsB ?? null')
  })

  it('dates it by the data set’s quarter, or by the month it was built, and never guesses', () => {
    expect(fundFactsAsOfLabel('2026q3')).toBe('SEC N-PORT data set for 2026 Q3')
    expect(fundFactsAsOfLabel('2026-07')).toBe('SEC N-PORT data, built July 2026')
    expect(fundFactsAsOfLabel('2026-13')).toBeNull()
    expect(fundFactsAsOfLabel('soon')).toBeNull()
  })

  it('keeps the review clock on the date the file was built', () => {
    const asOfs = new Set(Object.values(FACTS as Record<string, { asOf: string }>).map((r) => r.asOf))
    expect(asOfs.size).toBe(1)
    const [asOf] = [...asOfs]
    const q = /^(\d{4})q([1-4])$/.exec(asOf)
    if (q) {
      // A data set cannot be built before its quarter ends.
      const quarterEnd = new Date(Date.UTC(Number(q[1]), Number(q[2]) * 3, 0)).toISOString().slice(0, 10)
      expect(FUND_FACTS_BUILT_ON >= quarterEnd).toBe(true)
    } else {
      // Built before the quarter fix: asOf is the month the script ran.
      expect(FUND_FACTS_BUILT_ON.slice(0, 7)).toBe(asOf)
    }
  })

  it('the refresh script takes the quarter from the SEC’s own address, and never trusts an undated archive', () => {
    expect(quarterFromDatasetUrl('https://www.sec.gov/files/dera/data/form-n-port-data-sets/2026q3_nport.zip')).toBe('2026q3')
    expect(quarterFromDatasetUrl('https://www.sec.gov/files/nport.zip')).toBeNull()
    expect(cachedArchiveIsCurrent({ zipExists: true, cachedQuarter: '2026q3', newestQuarter: '2026q3' })).toBe(true)
    // An archive pulled before this fix has no recorded quarter: re-downloaded, not relabelled.
    expect(cachedArchiveIsCurrent({ zipExists: true, cachedQuarter: null, newestQuarter: '2026q3' })).toBe(false)
    expect(cachedArchiveIsCurrent({ zipExists: true, cachedQuarter: '2026q2', newestQuarter: '2026q3' })).toBe(false)
    expect(read('scripts/build-fund-facts.mjs')).not.toMatch(/new Date\(\)\.toISOString\(\)\.slice\(0, 7\)/)
  })
})
