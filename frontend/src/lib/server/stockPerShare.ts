import { EDGAR_HEADERS, fetchTickerCikMap } from './edgar'
import { recentAnnualFrames } from './secFundamentals'
import { EXTERNAL_FETCH_TIMEOUT_MS } from './fetchBudget'
import { perShareFrom, type PerShareFact, type PerShareFacts, type StockPerShare } from '@/lib/data/stockPerShare'

// Earnings and dividends per share for every SEC filer, from the XBRL "frames" API: one
// request per concept per year, across all filers (D167). Four concepts over the last two
// annual frames is eight requests, each cached for a day, whatever the number of stocks.
// The rules that turn them into a P/E and a yield are in lib/data/stockPerShare.ts.
//
// Never throws: an unreachable SEC leaves every stock's figures unknown, and pages say so.

const CONCEPTS = {
  epsDiluted: 'EarningsPerShareDiluted',
  epsBasic: 'EarningsPerShareBasic',
  dpsDeclared: 'CommonStockDividendsPerShareDeclared',
  dpsPaid: 'CommonStockDividendsPerShareCashPaid',
} as const satisfies Record<keyof PerShareFacts, string>

interface FrameRow { cik: number; val: number; end: string }

async function fetchFrame(concept: string, period: string): Promise<FrameRow[]> {
  try {
    const res = await fetch(`https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD-per-shares/${period}.json`, {
      headers: EDGAR_HEADERS,
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return []
    const json = await res.json() as { data?: FrameRow[] }
    return Array.isArray(json.data) ? json.data : []
  } catch {
    return []
  }
}

/** One concept across the recent annual frames: each filer's latest period wins. */
async function conceptByCik(concept: string, now: Date): Promise<Map<number, PerShareFact>> {
  const frames = await Promise.all(recentAnnualFrames(now).map((p) => fetchFrame(concept, p)))
  const out = new Map<number, PerShareFact>()
  for (const rows of frames) {
    for (const r of rows) {
      if (typeof r.val !== 'number' || !Number.isFinite(r.val) || typeof r.end !== 'string') continue
      const prev = out.get(r.cik)
      if (!prev || r.end > prev.end) out.set(r.cik, { val: r.val, end: r.end })
    }
  }
  return out
}

export interface PerShareResult {
  bySymbol: Map<string, StockPerShare>
  /** False when the SEC could not be reached: every figure is then unknown, not missing. */
  reached: boolean
}

/**
 * Per-share figures for the given symbols. `nonPayers` are the symbols the catalog records as
 * paying no dividend, which only tells "none" from "unknown" when the SEC has no figure.
 */
export async function fetchStockPerShare(
  symbols: readonly string[],
  nonPayers: ReadonlySet<string> = new Set(),
  now: Date = new Date(),
): Promise<PerShareResult> {
  const bySymbol = new Map<string, StockPerShare>()
  try {
    const keys = Object.keys(CONCEPTS) as Array<keyof PerShareFacts>
    const [tickers, ...maps] = await Promise.all([
      fetchTickerCikMap(),
      ...keys.map((k) => conceptByCik(CONCEPTS[k], now)),
    ])
    const reached = maps.some((m) => m.size > 0)
    for (const raw of symbols) {
      const symbol = raw.toUpperCase()
      const cik = tickers.get(symbol)?.cikNum
      const facts: PerShareFacts = {}
      if (cik != null) keys.forEach((k, i) => { const f = maps[i].get(cik); if (f) facts[k] = f })
      bySymbol.set(symbol, perShareFrom(facts, nonPayers.has(symbol)))
    }
    return { bySymbol, reached }
  } catch {
    for (const s of symbols) bySymbol.set(s.toUpperCase(), perShareFrom({}, false))
    return { bySymbol, reached: false }
  }
}
