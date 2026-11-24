import { NextRequest, NextResponse } from 'next/server'
import { ALL_FUND_SYMBOLS } from '@/lib/data/fundCatalog'
import { ALL_EQUITY_SYMBOLS } from '@/lib/data/equityCatalog'
import { getProviderKey, recordProviderFetch } from '@/lib/api/live/providers'
import { fetchFmpDailyHistory } from '@/lib/api/live/fmpHistory'
import { computeReturns, type CloseSeries, type SecurityReturns } from '@/lib/utils/returns'
import { EXTERNAL_FETCH_TIMEOUT_MS } from '@/lib/server/fetchBudget'

export type { SecurityReturns }

// Trailing returns for stocks/ETFs/mutual funds, computed server-side from a
// year of daily closes.
//   GET /live-data/security-returns?universe=funds|equities
//   GET /live-data/security-returns?symbols=SPY,QQQ
//
// Response: { ok, updatedAt, source, sources, returns: Record<SYMBOL, SecurityReturns> }
// Percentages; null when the series is too short (e.g. funds younger than the
// window).
//
// ⚠ THIS USED TO BE FREE AND IS NOT ANY MORE. Until 2026-08-06 it made one
// batched Yahoo spark call per ~20 symbols and covered a whole universe in a
// handful of requests. Yahoo was removed on terms grounds (see
// lib/server/sourceTerms.ts) and nothing keyless replaces it, so returns come
// from Tiingo — one request per symbol.
//
// A SECOND RUNG SINCE 2026-11-24 (T-470, D242): when Tiingo serves nothing for
// a symbol — no key, an outage, or the vendor gone — the same returns are
// computed from FMP's dividend-adjusted daily history (lib/api/live/fmpHistory,
// T-441), which is on Tiingo's basis so the two rungs cannot disagree about
// what a return means. This closed D21's one named no-fallback surface. The
// rung serves FALLBACK TRAFFIC ONLY — it is never called for a symbol Tiingo
// answered — because FMP's free tier allows 250 calls a day; its fetches cache
// (FMP carries no Tiingo-style no-persistent-cache condition), and on free FMP
// keys the endpoint serves stocks but answered 402 for QQQ, VOO and VTSAX
// (measured 2026-09-18), so most funds still rest on Tiingo until the deferred
// paid plan. Each response says which rung served which symbol (`sources`),
// and a symbol neither rung carries stays a dash — never an error, never a
// fabricated figure.
//
// That changes the economics, so the route is capped rather than left to fan
// out over 118 funds on every page load:
//   • a `?symbols=` request (the visible page — how the Funds table actually
//     asks) is served up to MAX_SYMBOLS;
//   • a whole-`?universe=` request is REFUSED, not silently truncated. A
//     partial universe would sort and filter as if it were the whole one,
//     which is the failure mode this project treats as worse than an empty
//     state (see the FALLBACK-vs-REAL note in CLAUDE.md).
// With neither key the route returns {} with source 'none' — the UI already
// renders em-dashes for that, rather than fabricating a number.

export const dynamic = 'force-dynamic'

/** Per-symbol upstream calls one request may make. */
const MAX_SYMBOLS = 60

/** The FMP rung's cache (seconds). Tiingo's §1.6(a) no-cache condition is Tiingo's alone. */
const FMP_RETURNS_REVALIDATE = 900

export interface SecurityReturnsResponse {
  ok: boolean
  updatedAt: string
  /** The rung(s) that served: 'mixed' means both did, for different symbols. */
  source: 'tiingo' | 'fmp' | 'mixed' | 'none'
  /** Which rung served each served symbol. */
  sources?: Record<string, 'tiingo' | 'fmp'>
  returns: Record<string, SecurityReturns>
  /** Set when the caller asked for more than this route will fetch. */
  error?: string
  /** Symbols requested but not fetched — reported, never silently dropped. */
  skipped?: string[]
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * One year of daily closes for a symbol, or null when Tiingo has no series.
 *
 * ⚠ UNCACHED ON PURPOSE — Tiingo Starter ToS §1.6(a). The plan forbids retaining
 * Tiingo Data in "any persistent or durable storage" and allows only transient
 * processing, removed "immediately after the calculation or operation is completed".
 * Next's fetch `revalidate` persists to `.next/cache` on disk, so the 900s cache
 * that used to sit here was the prohibited case. Full reasoning and the restore
 * condition are on `fetchTiingoOhlcv` in live-data/security-ohlcv/route.ts.
 *
 * ⚠ THIS ROUTE IS THE EXPENSIVE ONE. Tiingo is its FIRST rung (FMP backs it up
 * per symbol since T-470) and it fetches PER SYMBOL, so an uncached call costs one
 * upstream request per symbol per request. The existing caps are what keep that
 * bounded and they matter more now, not less: `?universe=` is refused outright and
 * `?symbols=` is capped at 60. Do not raise either to "make returns work" — on
 * Starter that trades a licence-compliant route for a rate-limit failure.
 */
async function fetchTiingoSeries(symbol: string, key: string): Promise<CloseSeries | null> {
  const start = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10)
  const res = await fetch(
    `https://api.tiingo.com/tiingo/daily/${encodeURIComponent(symbol.toLowerCase())}/prices?startDate=${start}&token=${key}`,
    { headers: { Accept: 'application/json' }, next: { revalidate: 0 }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS) }
  )
  if (!res.ok) throw new Error(`Tiingo ${res.status}`)
  const rows = await res.json() as Array<{ date: string; close: number; adjClose?: number }>
  if (!Array.isArray(rows) || rows.length === 0) return null

  const closes: number[] = []
  const timestamps: number[] = []
  let adjusted = true
  for (const row of [...rows].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
    // Adjusted closes, so a split or a distribution isn't read as a return.
    //
    // ⚠ DECIDED 2026-09-22 (T-401): the fallback STAYS, and every figure computed
    // through it now says so. It had been silent, which was the actual defect —
    // docs/decisions/2026-09-18-owner-decisions.md recorded this as open "so it is
    // not decided by default", and a `??` had decided it by default.
    //
    // The stricter option — refuse to serve unadjusted returns at all — is the
    // closer reading of this repo's "not available rather than fabricated" rule,
    // and it was not chosen for a measured reason: that same decision record notes
    // there is no free, held provider with adjusted closes across funds, so
    // refusing would empty the funds Returns column rather than improve it.
    //
    // `adjusted` is sticky-false: ONE unadjusted close inside the window distorts
    // every return computed across it, so a partially-adjusted series is not
    // partially trustworthy.
    if (row.adjClose == null) adjusted = false
    const close = row.adjClose ?? row.close
    const ms = Date.parse(row.date)
    if (!Number.isFinite(close) || Number.isNaN(ms)) continue
    closes.push(close)
    timestamps.push(Math.floor(ms / 1000))
  }
  return closes.length > 0 ? { closes, timestamps, adjusted } : null
}

/**
 * The FMP rung (T-470): the same year of closes from the dividend-adjusted
 * reader T-441 built — Tiingo's basis, so a symbol served here means the same
 * thing. Where the plan withholds that endpoint the reader falls to
 * split-adjusted-only closes and this labels them `adjusted: false`, exactly
 * as the Tiingo path labels a series with an unadjusted close (T-401). A 402
 * (symbol outside the free plan — QQQ, VOO, VTSAX measured) throws, and the
 * caller's allSettled turns that into a dash for the symbol, never an error.
 */
async function fetchFmpSeries(symbol: string, key: string): Promise<CloseSeries | null> {
  const start = Date.now() - 400 * 86_400_000
  const { bars, basis } = await fetchFmpDailyHistory(symbol, key, { revalidate: FMP_RETURNS_REVALIDATE, label: 'FMP' })
  const closes: number[] = []
  const timestamps: number[] = []
  for (const bar of bars) {
    const ms = Date.parse(bar.date)
    if (!Number.isFinite(bar.close) || Number.isNaN(ms) || ms < start) continue
    closes.push(bar.close)
    timestamps.push(Math.floor(ms / 1000))
  }
  return closes.length > 0 ? { closes, timestamps, adjusted: basis === 'splits-and-dividends' } : null
}

export async function GET(request: NextRequest) {
  const universe = request.nextUrl.searchParams.get('universe')
  const symbolsParam = request.nextUrl.searchParams.get('symbols')

  let symbols: string[]
  if (universe === 'funds' || universe === 'equities') {
    const size = (universe === 'funds' ? ALL_FUND_SYMBOLS : ALL_EQUITY_SYMBOLS).length
    return NextResponse.json({
      ok: false,
      updatedAt: new Date().toISOString(),
      source: 'none',
      returns: {},
      error: `Whole-universe returns are no longer available: the keyless batched source was withdrawn on terms grounds, and the remaining provider is one request per symbol (${size} would be needed). Request the symbols you are showing instead — ?symbols=SPY,QQQ, up to ${MAX_SYMBOLS}.`,
    } satisfies SecurityReturnsResponse, { status: 400 })
  }
  if (symbolsParam) {
    symbols = symbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
  } else {
    return NextResponse.json({ ok: false, error: 'Pass ?symbols=SPY,QQQ' }, { status: 400 })
  }

  const requested = [...new Set(symbols)]
  const wanted = requested.slice(0, MAX_SYMBOLS)
  const skipped = requested.slice(MAX_SYMBOLS)

  const tiingoKey = getProviderKey('tiingo')
  const fmpKey = getProviderKey('fmp')
  if (!tiingoKey && !fmpKey) {
    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      source: 'none',
      returns: {},
      error: 'No trailing-returns provider is configured. Add a Tiingo (or FMP) API key on the Integrations page.',
      ...(skipped.length > 0 ? { skipped } : {}),
    } satisfies SecurityReturnsResponse)
  }

  const nowYear = new Date().getUTCFullYear()
  const returns: Record<string, SecurityReturns> = {}
  const sources: Record<string, 'tiingo' | 'fmp'> = {}

  // Symbols are independent, so allSettled is the right boundary — one delisted
  // ticker must not cost the other 59. Batched 8 at a time to stay polite
  // rather than opening 60 sockets at once.
  if (tiingoKey) {
    let failures = 0
    for (const group of chunk(wanted, 8)) {
      const settled = await Promise.allSettled(group.map((s) => fetchTiingoSeries(s, tiingoKey)))
      settled.forEach((res, i) => {
        if (res.status === 'rejected') { failures++; return }
        if (!res.value) return
        returns[group[i]] = computeReturns(res.value, nowYear)
        sources[group[i]] = 'tiingo'
      })
    }
    const served = Object.keys(returns).length
    if (served > 0) recordProviderFetch('tiingo', { count: served })
    else if (failures > 0) recordProviderFetch('tiingo', { error: `all ${failures} symbol requests failed` })
  }

  // The FMP rung (T-470): ONLY the symbols Tiingo did not serve — fallback
  // traffic, never a second always-on source (the free tier is 250 calls a day).
  const missing = wanted.filter((s) => !(s in returns))
  if (fmpKey && missing.length > 0) {
    let served = 0
    let failures = 0
    for (const group of chunk(missing, 8)) {
      const settled = await Promise.allSettled(group.map((s) => fetchFmpSeries(s, fmpKey)))
      settled.forEach((res, i) => {
        if (res.status === 'rejected') { failures++; return }
        if (!res.value) return
        returns[group[i]] = computeReturns(res.value, nowYear)
        sources[group[i]] = 'fmp'
        served++
      })
    }
    if (served > 0) recordProviderFetch('fmp', { count: served })
    else if (failures > 0) recordProviderFetch('fmp', { error: `all ${failures} fallback symbol requests failed` })
  }

  const tiingoServed = Object.values(sources).includes('tiingo')
  const fmpServed = Object.values(sources).includes('fmp')
  return NextResponse.json({
    ok: true,
    updatedAt: new Date().toISOString(),
    source: tiingoServed && fmpServed ? 'mixed' : tiingoServed ? 'tiingo' : fmpServed ? 'fmp' : 'none',
    ...(Object.keys(sources).length > 0 ? { sources } : {}),
    returns,
    ...(skipped.length > 0
      ? { skipped, error: `Capped at ${MAX_SYMBOLS} symbols per request; ${skipped.length} not fetched.` }
      : {}),
  } satisfies SecurityReturnsResponse)
}
