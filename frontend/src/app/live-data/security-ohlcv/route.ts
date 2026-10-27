import { NextRequest, NextResponse } from 'next/server'
import type { OhlcvCandle } from '@/lib/utils/indicators'
import { getEquityOhlcvProviders, getProviderKey, recordProviderFetch } from '@/lib/api/live/providers'
import { fetchCustomUrl, findArray, pickNumber, type ActiveCustom } from '@/lib/server/customFeeds'
import { fetchFmpDailyHistory, type PriceBasis } from '@/lib/api/live/fmpHistory'
import { EXTERNAL_FETCH_TIMEOUT_MS } from '@/lib/server/fetchBudget'

// OHLCV proxy for equities / ETFs / mutual funds — feeds the TA and backtest
// pages. REGISTRY-DRIVEN ladder (getEquityOhlcvProviders): user-added custom
// json-ohlcv feeds first, then Tiingo → FMP as enabled/keyed on the
// Integrations page. Mirrors /live-data/ohlcv (crypto).
//   GET /live-data/security-ohlcv?symbol=AAPL&range=1Y
//
// Response: { ok, symbol, range, candles: OhlcvCandle[], source, basis }
//
// ⚠ BOTH BUILT-IN RUNGS ARE KEYED. Yahoo Finance headed this ladder, keylessly,
// until 2026-08-06, when it was removed on terms grounds (see
// lib/server/sourceTerms.ts). With no Tiingo or FMP key the route returns
// ok:false / source:'none' and the TA, backtest and candlestick surfaces show
// their "no live source" state. Do not paper over that with synthetic candles.

export const dynamic = 'force-dynamic'

/** Ranges the route accepts, and how long each is cached. */
const RANGE_CONFIG: Record<string, { revalidate: number }> = {
  '1M':  { revalidate: 300 },
  '3M':  { revalidate: 900 },
  '6M':  { revalidate: 900 },
  '1Y':  { revalidate: 900 },
  // 2Y returned 2026-10-26 (T-095) for the equity backtests. It was dropped with D-2, which
  // removed the button when the route had no such range; the route has one again.
  '2Y':  { revalidate: 3600 },
  '5Y':  { revalidate: 3600 },
  'MAX': { revalidate: 3600 },
}

export interface SecurityOhlcvResponse {
  ok: boolean
  symbol: string
  range: string
  candles: OhlcvCandle[]
  /** Provider id that served the candles ('tiingo', 'fmp', 'custom-…') or 'none'. */
  source: string
  /**
   * What the prices have had taken out, when candles were served. Tiingo and FMP are both
   * 'splits-and-dividends' (T-441); FMP reads 'splits' only if its plan withholds its
   * dividend-adjusted prices; a user-added feed is 'unknown'.
   */
  basis?: PriceBasis
  error?: string
  /**
   * With error 'fetch_failed': each configured provider that was tried, in order, and
   * why it failed ("tiingo: Tiingo 429"). Without it a scan that came back empty could
   * not say whether a key was missing, a quota was spent or a symbol was unknown.
   */
  failures?: string[]
}

/** A provider's failure reason, with anything shaped like a key in a URL taken out. */
function failureReason(id: string, e: unknown): string {
  const message = (e instanceof Error ? e.message : String(e))
    .replace(/((?:token|apikey|api_key|key)=)[^&\s]+/gi, '$1…')
    .slice(0, 200)
  return `${id}: ${message}`
}

const RANGE_DAYS: Record<string, number> = { '1M': 22, '3M': 66, '6M': 130, '1Y': 260, '2Y': 520, '5Y': 1300, 'MAX': 10000 }

/** Candles, oldest first, and what their prices have had taken out. */
interface Served { candles: OhlcvCandle[]; basis: PriceBasis }

async function fetchFmpOhlcv(symbol: string, range: string): Promise<Served> {
  // UI-saved key (Integrations page) or FMP_API_KEY env var. FMP's free tier
  // uses the /stable API; the legacy /api/v3 endpoints are retired (403).
  const FMP_KEY = getProviderKey('fmp')
  if (!FMP_KEY) throw new Error('FMP key not configured')
  // Dividend-adjusted prices, so FMP is on Tiingo's basis (T-441, 2026-10-18); split-only
  // ones, labelled, if the plan withholds them. See lib/api/live/fmpHistory.ts.
  const { bars, basis } = await fetchFmpDailyHistory(symbol, FMP_KEY, { revalidate: RANGE_CONFIG[range].revalidate })
  const candles = bars
    .map((b) => ({
      time: Math.floor(new Date(b.date).getTime() / 1000),
      open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
    }))
    .slice(-RANGE_DAYS[range])
  return { candles, basis }
}

// ⚠ TIINGO IS FETCHED UNCACHED, AND THAT IS A LICENCE CONSTRAINT, NOT AN OVERSIGHT.
//
// Owner decision 2026-09-15: development runs on a Tiingo STARTER plan. Starter's
// ToS §1.6(a) forbids retaining Tiingo Data "in any persistent or durable storage",
// permits processing it "only transiently in volatile memory or in a temporary,
// non-persistent cache", and requires removal "immediately after the calculation or
// operation is completed" — naming file systems, caches, logs and backups explicitly.
//
// Next's fetch `revalidate` writes to the Data Cache under `.next/cache`, which is
// on disk. So `RANGE_CONFIG[range].revalidate` — correct for FMP above — would be
// exactly what §1.6(a) prohibits. `revalidate: 0` is the repo's idiom for an
// uncached fetch (see the wallet routes).
//
// The strict reading also rules out an in-process LRU as a substitute: "immediately
// after the operation is completed" does not leave room for a cross-request TTL,
// however volatile the memory. Do not reintroduce caching here as an optimisation.
//
// COST: every OHLCV request now hits Tiingo. RANGE_CONFIG still governs FMP, so the
// fallback path is unchanged. If the plan moves to a paid tier without §1.6(a),
// restore `next: { revalidate: RANGE_CONFIG[range].revalidate }` here and say so.
async function fetchTiingoOhlcv(symbol: string, range: string): Promise<Served> {
  const key = getProviderKey('tiingo')
  if (!key) throw new Error('Tiingo key not configured')
  const start = new Date(Date.now() - RANGE_DAYS[range] * 1.5 * 86_400_000).toISOString().slice(0, 10)
  const res = await fetch(
    `https://api.tiingo.com/tiingo/daily/${encodeURIComponent(symbol.toLowerCase())}/prices?startDate=${start}&token=${key}`,
    { headers: { Accept: 'application/json' }, next: { revalidate: 0 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS) }
  )
  if (!res.ok) throw new Error(`Tiingo ${res.status}`)
  // Tiingo returns both raw (open/high/low/close/volume) and split+dividend
  // adjusted (adj*) fields. Use the adjusted set so a split is a continuous
  // series (not a cliff). Its adj* takes out dividends as well as splits, measured
  // on NVDA 2026-10-17: a steady 0.29% below the split-only closes across the 2024
  // split (docs/assessments/T11-equity-ta-audit.md, Deferred). FMP's rung reads its
  // dividend-adjusted prices for that reason (T-441), so a fall to it does not move
  // a dividend payer's history.
  const rows = await res.json() as Array<{
    date: string; open: number; high: number; low: number; close: number; volume: number
    adjOpen?: number; adjHigh?: number; adjLow?: number; adjClose?: number; adjVolume?: number
  }>
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Tiingo: empty result')
  const candles = rows
    .map((row) => ({
      time: Math.floor(new Date(row.date).getTime() / 1000),
      open: row.adjOpen ?? row.open, high: row.adjHigh ?? row.high,
      low: row.adjLow ?? row.low, close: row.adjClose ?? row.close,
      volume: row.adjVolume ?? row.volume ?? 0,
    }))
    .sort((a, b) => a.time - b.time)
  // A row missing adjClose falls back to its raw price, so only a series with every
  // adjusted close is labelled adjusted.
  return { candles, basis: rows.every((row) => row.adjClose != null) ? 'splits-and-dividends' : 'unknown' }
}

// Custom json-ohlcv feeds: URL with {symbol} (and optional {range}); the
// response must contain an array of candles — time/OHLC fields are
// auto-detected or mapped via jsonFieldMap.
async function fetchCustomOhlcv(provider: ActiveCustom, symbol: string, range: string): Promise<Served> {
  const url = provider.url.replace('{symbol}', encodeURIComponent(symbol)).replace('{range}', range)
  const res = await fetchCustomUrl(provider, url, RANGE_CONFIG[range].revalidate)
  const map = provider.jsonFieldMap ?? {}
  const candles: OhlcvCandle[] = []
  for (const entry of findArray(await res.json(), provider.jsonArrayPath)) {
    const rawTime = pickNumber(entry, map.time, ['time', 't', 'timestamp'])
    let time: number | null = rawTime != null ? (rawTime > 1e12 ? Math.floor(rawTime / 1000) : Math.floor(rawTime)) : null
    if (time == null) {
      const dateStr = entry && typeof entry === 'object' ? (entry as Record<string, unknown>)[map.date ?? 'date'] : null
      if (typeof dateStr === 'string') {
        const ms = Date.parse(dateStr)
        if (!isNaN(ms)) time = Math.floor(ms / 1000)
      }
    }
    const open = pickNumber(entry, map.open, ['open', 'o'])
    const high = pickNumber(entry, map.high, ['high', 'h'])
    const low = pickNumber(entry, map.low, ['low', 'l'])
    const close = pickNumber(entry, map.close, ['close', 'c'])
    if (time == null || open == null || high == null || low == null || close == null) continue
    candles.push({ time, open, high, low, close, volume: pickNumber(entry, map.volume, ['volume', 'v']) ?? 0 })
  }
  if (candles.length === 0) throw new Error('Custom feed returned no usable candles')
  // Nobody has read what a user-added feed adjusts for.
  return { candles: candles.sort((a, b) => a.time - b.time), basis: 'unknown' }
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')?.trim().toUpperCase()
  const range = (request.nextUrl.searchParams.get('range') ?? '1Y').toUpperCase()

  if (!symbol) {
    return NextResponse.json({ ok: false, error: 'Pass ?symbol=AAPL' }, { status: 400 })
  }
  if (!RANGE_CONFIG[range]) {
    return NextResponse.json(
      { ok: false, error: `range must be one of ${Object.keys(RANGE_CONFIG).join(', ')}` },
      { status: 400 }
    )
  }

  const failures: string[] = []
  for (const provider of getEquityOhlcvProviders()) {
    try {
      const { candles, basis } = provider.isCustom
        ? await fetchCustomOhlcv(provider, symbol, range)
        : provider.id === 'tiingo' ? await fetchTiingoOhlcv(symbol, range)
        : await fetchFmpOhlcv(symbol, range)
      recordProviderFetch(provider.id, { count: candles.length })
      return NextResponse.json({ ok: true, symbol, range, candles, source: provider.id, basis } satisfies SecurityOhlcvResponse)
    } catch (e) {
      recordProviderFetch(provider.id, { error: e instanceof Error ? e.message : String(e) })
      failures.push(failureReason(provider.id, e))
    }
  }

  // Distinguish "nothing is configured" from "the configured providers failed".
  // They need different fixes, and 'fetch_failed' sent a reader hunting for a
  // network problem when the actual answer was that no provider had a key.
  const configured = getEquityOhlcvProviders().length > 0
  return NextResponse.json({
    ok: false, symbol, range, candles: [], source: 'none',
    error: configured
      ? 'fetch_failed'
      : 'no_provider_configured: add a Tiingo or FMP API key on the Integrations page',
    ...(configured ? { failures } : {}),
  } satisfies SecurityOhlcvResponse)
}
