// FMP end-of-day price history, on Tiingo's basis: splits AND dividends taken out.
// Shared by /live-data/security-ohlcv (candles) and the security-chart ladder in
// marketData.ts (closes), so the two cannot end up on different FMP endpoints.
//
// Why (T-441, owner, 2026-10-18). Tiingo, the first rung of both ladders, takes out splits
// and dividends. FMP's /historical-price-eod/full takes out splits only (measured 2026-09-09
// on NVDA). So when the ladder fell to FMP, a dividend payer's older prices rose by the
// dividends paid since each date: about 0.3% on NVDA, and on a stock yielding 4% a 5-year
// chart starting about a fifth higher. FMP's /dividend-adjusted endpoint is on Tiingo's
// basis, and on the free key it answers the same symbols /full does (AAPL, MSFT, NVDA and
// SPY; 402 for QQQ, VOO and VTSAX, measured 2026-09-18 with the app's key:
// docs/decisions/2026-09-18-owner-decisions.md).
//
// It falls back to /full, and says so in `basis`, only where the plan withholds the endpoint
// (403) or its answer carries no usable adjusted prices. A 402 is a symbol outside the plan,
// which /full refuses too, so it is thrown rather than spent twice against the free tier's
// 250 calls a day.

import { EXTERNAL_FETCH_TIMEOUT_MS } from '@/lib/server/fetchBudget'

/**
 * What a price series has had taken out. Tiingo's adjusted prices, and FMP's here, are
 * 'splits-and-dividends'; 'unknown' is a user-added feed, whose basis nobody has read.
 * A list as well as a type, so the API spec reads its values rather than retyping them.
 */
export const PRICE_BASES = ['splits-and-dividends', 'splits', 'unadjusted', 'unknown'] as const
export type PriceBasis = typeof PRICE_BASES[number]

export interface FmpDailyBar { date: string; open: number; high: number; low: number; close: number; volume: number }

export interface FmpDailyHistory {
  /** Oldest first. */
  bars: FmpDailyBar[]
  basis: Extract<PriceBasis, 'splits-and-dividends' | 'splits'>
}

const FMP_STABLE = 'https://financialmodelingprep.com/stable'

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

type Row = Record<string, unknown>

/** The rows carrying `date` and the four named prices, as bars, oldest first. */
function bars(body: unknown, [open, high, low, close]: readonly [string, string, string, string]): FmpDailyBar[] {
  if (!Array.isArray(body)) return []
  return body
    .flatMap((r: Row) => (r && typeof r.date === 'string' && finite(r[open]) && finite(r[high]) && finite(r[low]) && finite(r[close])
      ? [{ date: r.date, open: r[open] as number, high: r[high] as number, low: r[low] as number, close: r[close] as number, volume: finite(r.volume) ? r.volume : 0 }]
      : []))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export async function fetchFmpDailyHistory(
  symbol: string,
  key: string,
  { revalidate, label = 'FMP' }: { revalidate: number; label?: string },
): Promise<FmpDailyHistory> {
  const query = `symbol=${encodeURIComponent(symbol)}&apikey=${key}`
  // A signal per call: one shared signal would give both calls a single budget.
  const init = () => ({ next: { revalidate }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS) })

  const adjusted = await fetch(`${FMP_STABLE}/historical-price-eod/dividend-adjusted?${query}`, init())
  if (adjusted.ok) {
    const rows = bars(await adjusted.json().catch(() => null), ['adjOpen', 'adjHigh', 'adjLow', 'adjClose'])
    if (rows.length > 0) return { bars: rows, basis: 'splits-and-dividends' }
  } else if (adjusted.status !== 403) {
    throw new Error(`${label} ${adjusted.status}`)
  }

  const full = await fetch(`${FMP_STABLE}/historical-price-eod/full?${query}`, init())
  if (!full.ok) throw new Error(`${label} ${full.status}`)
  const rows = bars(await full.json().catch(() => null), ['open', 'high', 'low', 'close'])
  if (rows.length === 0) throw new Error(`${label}: empty result`)
  return { bars: rows, basis: 'splits' }
}
