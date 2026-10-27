import { NextRequest, NextResponse } from 'next/server'
import { getProviderKey } from '@/lib/api/live/providers'
import { SECTOR_INFO, catalogUniverseNote, type SectorId } from '@/lib/data/equityCatalog'
import type { StockUniverseResponse } from '@/app/live-data/stock-universe/route'
import type { SecurityQuotesResponse } from '@/app/live-data/security-quotes/route'
import { EXTERNAL_FETCH_TIMEOUT_MS } from '@/lib/server/fetchBudget'
import { perShareFromFields, stockFigures } from '@/lib/data/stockPerShare'
import { marketCapUsd } from '@/lib/data/stockShares'
import { selfRequestHeaders } from '@/lib/server/apiKeys'

// Cross-sectional outlier detection over the stock universe.
//   GET /live-data/stock-outliers?min_mcap=2
//
// Pulls the universe and a live quote for every stock in it, works out P/E, dividend
// yield and market cap against those quotes, then computes SECTOR-RELATIVE z-scores and
// surfaces the statistical outliers per category. This is the cheap universe-wide pass;
// the Equity Screener agent enriches the flagged names with SEC financials/news.
//
// LIVE PRICES ONLY (D170, 2026-10-25). It used to read P/E against the catalog's reference
// prices (2026-07-07): Netflix and ServiceNow had split since, and read 435 and 569. A stock
// with no live quote is left out and counted (`unpriced`), never priced from storage. Beta
// went with the reference prices: it is worked out on each stock's own page.

export const dynamic = 'force-dynamic'

export interface OutlierItem {
  symbol: string
  name: string
  sector: SectorId
  sectorLabel: string
  metric: 'pe' | 'yield'
  value: number
  sectorAvg: number
  /** Standard deviations from the sector mean (signed). */
  z: number
}

export interface StockOutliersResponse {
  ok: boolean
  configured: boolean
  universeSize: number
  evaluated: number          // after the market-cap floor
  /** Stocks left out because no live quote came back: their figures cannot be worked out. */
  unpriced: number
  sectorsEvaluated: number
  peCoverage: number         // fraction of evaluated names with a usable P/E
  categories: {
    cheap: OutlierItem[]     // low P/E vs sector — potential value
    expensive: OutlierItem[] // high P/E vs sector — momentum / rich valuation
    highYield: OutlierItem[] // high dividend yield vs sector — income / value-trap
  }
  updatedAt: string
  note?: string
}

const MIN_SECTOR_N = 5      // need enough peers for a meaningful distribution
const Z_THRESHOLD = 1.75    // |z| above this counts as an outlier
const TOP_PER_CATEGORY = 10
/** Live quotes in one request (the quote route's own cap); the curated list is well inside it. */
const QUOTE_CAP = 200

interface Enriched {
  symbol: string; name: string; sector: SectorId
  pe: number | null; yield: number | null
  peZ: number | null; yieldZ: number | null
}

interface Priced { symbol: string; name: string; sector: SectorId; pe: number | null; yield: number | null }

function meanStd(vals: number[]): { mean: number; std: number } {
  const n = vals.length
  if (n === 0) return { mean: 0, std: 0 }
  const mean = vals.reduce((s, v) => s + v, 0) / n
  if (n < 2) return { mean, std: 0 }
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
  return { mean, std: Math.sqrt(variance) }
}

export async function GET(req: NextRequest) {
  const minMcap = Math.max(0, parseFloat(req.nextUrl.searchParams.get('min_mcap') ?? '2') || 0)
  const origin = req.nextUrl.origin

  const empty = (extra: Partial<StockOutliersResponse> = {}): StockOutliersResponse => ({
    ok: true, configured: !!getProviderKey('fmp'), universeSize: 0, evaluated: 0, unpriced: 0,
    sectorsEvaluated: 0, peCoverage: 0,
    categories: { cheap: [], expensive: [], highYield: [] },
    updatedAt: new Date().toISOString(), ...extra,
  })

  let uni: StockUniverseResponse
  try {
    const res = await fetch(`${origin}/live-data/stock-universe`, { headers: selfRequestHeaders(), next: { revalidate: 3600 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS) })
    uni = await res.json() as StockUniverseResponse
  } catch {
    return NextResponse.json(empty({ ok: false, note: 'universe unavailable' }), { status: 503 })
  }

  const universe = uni.entries ?? []
  const candidates = universe.filter((e) => e.sector !== 'other').slice(0, QUOTE_CAP)
  let quotes: SecurityQuotesResponse['quotes'] = {}
  try {
    const res = await fetch(`${origin}/live-data/security-quotes?symbols=${encodeURIComponent(candidates.map((e) => e.symbol).join(','))}`,
      { headers: selfRequestHeaders(), cache: 'no-store', signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS * 3) })
    quotes = ((await res.json()) as SecurityQuotesResponse).quotes ?? {}
  } catch { /* every stock counts as unpriced below */ }

  let unpriced = 0
  const pool: Priced[] = []
  for (const e of candidates) {
    const q = quotes[e.symbol.toUpperCase()]
    const price = q && !q.reference && q.price != null && q.price > 0 ? q.price : null
    if (price == null) { unpriced++; continue }
    const cap = marketCapUsd(e.shares, price)
    // No share count (several share classes) leaves the market cap unknown: kept, not floored out.
    if (cap != null && cap < minMcap * 1e9) continue
    const f = stockFigures(perShareFromFields(e), price)
    pool.push({ symbol: e.symbol, name: e.name, sector: e.sector, pe: f.pe, yield: f.dividendYieldPct })
  }

  // Group by sector and compute per-metric sector stats
  const bySector = new Map<SectorId, typeof pool>()
  for (const e of pool) {
    const arr = bySector.get(e.sector) ?? []
    arr.push(e)
    bySector.set(e.sector, arr)
  }

  const enriched: Enriched[] = []
  let sectorsEvaluated = 0
  let peCount = 0
  for (const [sector, members] of bySector) {
    if (members.length < MIN_SECTOR_N) continue
    sectorsEvaluated++
    const peStats = meanStd(members.map((m) => m.pe).filter((v): v is number => v != null && v > 0))
    const yStats  = meanStd(members.map((m) => m.yield).filter((v): v is number => v != null && v > 0))
    for (const m of members) {
      const pe = m.pe != null && m.pe > 0 ? m.pe : null
      const yld = m.yield != null && m.yield > 0 ? m.yield : null
      if (pe != null) peCount++
      enriched.push({
        symbol: m.symbol, name: m.name, sector,
        pe, yield: yld,
        peZ:    pe != null && peStats.std > 0 ? (pe - peStats.mean) / peStats.std : null,
        yieldZ: yld != null && yStats.std > 0 ? (yld - yStats.mean) / yStats.std : null,
      })
    }
  }

  const sectorAvg = (sector: SectorId, metric: 'pe' | 'yield'): number => {
    const members = (bySector.get(sector) ?? [])
    const vals = members.map((m) => metric === 'pe' ? m.pe : m.yield)
      .filter((v): v is number => v != null && v > 0)
    return meanStd(vals).mean
  }

  const item = (e: Enriched, metric: 'pe' | 'yield', value: number, z: number): OutlierItem => ({
    symbol: e.symbol, name: e.name, sector: e.sector, sectorLabel: SECTOR_INFO[e.sector].label,
    metric, value: parseFloat(value.toFixed(2)), sectorAvg: parseFloat(sectorAvg(e.sector, metric).toFixed(2)),
    z: parseFloat(z.toFixed(2)),
  })

  const cheap = enriched.filter((e) => e.peZ != null && e.peZ <= -Z_THRESHOLD)
    .sort((a, b) => (a.peZ! - b.peZ!)).slice(0, TOP_PER_CATEGORY).map((e) => item(e, 'pe', e.pe!, e.peZ!))
  const expensive = enriched.filter((e) => e.peZ != null && e.peZ >= Z_THRESHOLD)
    .sort((a, b) => (b.peZ! - a.peZ!)).slice(0, TOP_PER_CATEGORY).map((e) => item(e, 'pe', e.pe!, e.peZ!))
  const highYield = enriched.filter((e) => e.yieldZ != null && e.yieldZ >= Z_THRESHOLD)
    .sort((a, b) => (b.yieldZ! - a.yieldZ!)).slice(0, TOP_PER_CATEGORY).map((e) => item(e, 'yield', e.yield!, e.yieldZ!))

  return NextResponse.json({
    ok: true,
    configured: uni.configured ?? false,
    universeSize: universe.length,
    evaluated: enriched.length,
    unpriced,
    sectorsEvaluated,
    peCoverage: enriched.length ? parseFloat((peCount / enriched.length).toFixed(2)) : 0,
    categories: { cheap, expensive, highYield },
    updatedAt: new Date().toISOString(),
    note: [
      uni.source === 'fmp' ? '' : catalogUniverseNote(!!getProviderKey('fmp')),
      unpriced ? `${unpriced} stock${unpriced === 1 ? ' was' : 's were'} left out: no live quote came back, so no figure could be worked out.` : '',
    ].filter(Boolean).join(' ') || undefined,
  } satisfies StockOutliersResponse)
}
