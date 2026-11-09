import 'server-only'
import { revalidateTag } from 'next/cache'
import { getProviderKey } from '@/lib/api/live/providers'
import { EXTERNAL_FETCH_TIMEOUT_MS } from '@/lib/server/fetchBudget'
import {
  EARNINGS_LISTED_WINDOW_DAYS, addDays, marketToday, mergeEarnings, parseAlphaVantageEarnings, parseFmpEarnings,
  type EarningsSource, type UpcomingEarnings,
} from '@/lib/data/earningsCalendar'

// Upcoming earnings from FMP, with Alpha Vantage behind it (T-458, D213). Used by the Market
// Calendar (/live-data/market-calendar) and the next-date lookup (/live-data/earnings-dates).
//
// ⚠ ALPHA VANTAGE'S 25 REQUESTS A DAY IS A TERMS CONDITION. Its whole three-month list comes in one
// request whose address never changes, cached a day, so the earnings calendar spends one request a
// day beside the IPO calendar's four. Do not shorten the cache or add a parameter to the address.

/** One request a day: the address is fixed, so every caller shares the cached answer. */
const ALPHA_VANTAGE_REVALIDATE_SECONDS = 86_400
/**
 * The cache tag on that request. Alpha Vantage sends its rate-limit note with HTTP 200, which the
 * fetch cache keeps like any answer, so a failure would stand for the whole day (code audit
 * 2026-11-09, D214). A failed answer marks the tag stale, and the next caller asks again.
 */
export const ALPHA_VANTAGE_EARNINGS_TAG = 'alpha-vantage-earnings-calendar'

/** Drop a failed Alpha Vantage answer from the cache. Outside a request (a test, a script) there is no cache to drop. */
function forgetAlphaVantageAnswer(): void {
  try { revalidateTag(ALPHA_VANTAGE_EARNINGS_TAG) } catch { /* no request cache here */ }
}
const FMP_REVALIDATE_SECONDS = 3_600

/** How one source answered. */
export interface EarningsSourceStatus {
  configured: boolean
  ok: boolean
  /** Rows it gave for the range asked. */
  count: number
  /** Why it gave nothing, in words a page can show. */
  detail?: string
}

export interface UpcomingEarningsResult {
  /** At least one earnings source has a key. */
  configured: boolean
  sources: Record<EarningsSource, EarningsSourceStatus>
  /** FMP's rows, then Alpha Vantage's for companies FMP does not list, inside [from, to]. */
  events: UpcomingEarnings[]
}

async function fromFmp(from: string, to: string): Promise<{ status: EarningsSourceStatus; events: UpcomingEarnings[] }> {
  const key = getProviderKey('fmp')
  if (!key) return { status: { configured: false, ok: false, count: 0, detail: 'no FMP key' }, events: [] }
  try {
    const res = await fetch(`https://financialmodelingprep.com/stable/earnings-calendar?from=${from}&to=${to}&apikey=${key}`, {
      next: { revalidate: FMP_REVALIDATE_SECONDS }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return { status: { configured: true, ok: false, count: 0, detail: `FMP HTTP ${res.status}` }, events: [] }
    const events = parseFmpEarnings(await res.json())
    return { status: { configured: true, ok: true, count: events.length }, events }
  } catch (err) {
    return { status: { configured: true, ok: false, count: 0, detail: err instanceof Error ? err.message : 'FMP request failed' }, events: [] }
  }
}

async function fromAlphaVantage(): Promise<{ status: EarningsSourceStatus; events: UpcomingEarnings[] }> {
  const key = getProviderKey('alpha-vantage')
  if (!key) return { status: { configured: false, ok: false, count: 0, detail: 'no Alpha Vantage key' }, events: [] }
  try {
    // No Accept header: Alpha Vantage answers `Accept: text/csv` with a 406 (see the IPO route).
    const res = await fetch(`https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=${encodeURIComponent(key)}`, {
      next: { revalidate: ALPHA_VANTAGE_REVALIDATE_SECONDS, tags: [ALPHA_VANTAGE_EARNINGS_TAG] }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return { status: { configured: true, ok: false, count: 0, detail: `Alpha Vantage HTTP ${res.status}` }, events: [] }
    const parsed = parseAlphaVantageEarnings(await res.text())
    if (!parsed.ok) {
      forgetAlphaVantageAnswer()
      return { status: { configured: true, ok: false, count: 0, detail: `${parsed.reason}: ${parsed.detail}` }, events: [] }
    }
    return { status: { configured: true, ok: true, count: parsed.events.length }, events: parsed.events }
  } catch (err) {
    return { status: { configured: true, ok: false, count: 0, detail: err instanceof Error ? err.message : 'Alpha Vantage request failed' }, events: [] }
  }
}

/**
 * Answers kept for half an hour per range. FMP's list for three months can pass the 2 MB the
 * fetch cache keeps, and then every stock page would ask FMP again; this keeps it to one request
 * per range per half hour on this server.
 */
const MEMO_MS = 30 * 60_000
const memo = new Map<string, { at: number; value: Promise<UpcomingEarningsResult> }>()

/**
 * Every expected report in [from, to]. The two sources are independent requests, so they run
 * side by side; a failure in one leaves the other's rows.
 */
export function upcomingEarnings(from: string, to: string, now = Date.now()): Promise<UpcomingEarningsResult> {
  const key = `${from}|${to}`
  const hit = memo.get(key)
  if (hit && now - hit.at < MEMO_MS) return hit.value
  const value = collect(from, to, now)
  memo.set(key, { at: now, value })
  // A failed collection is not kept: the next caller tries again.
  value.then((r) => { if (!r.sources.fmp.ok && !r.sources['alpha-vantage'].ok) memo.delete(key) }, () => memo.delete(key))
  for (const [k, v] of memo) if (now - v.at >= MEMO_MS) memo.delete(k)
  return value
}

async function collect(from: string, to: string, now: number): Promise<UpcomingEarningsResult> {
  // Which companies FMP lists is decided over Alpha Vantage's whole reach, the same for every
  // range asked, so a company shows one date wherever it appears (D214). That window's FMP
  // request is shared through the fetch cache; it is skipped when the range asked is that window.
  const today = marketToday(new Date(now))
  const windowEnd = addDays(today, EARNINGS_LISTED_WINDOW_DAYS)
  const sameWindow = from === today && to === windowEnd
  const [fmp, av, fmpWindow] = await Promise.all([
    fromFmp(from, to), fromAlphaVantage(), sameWindow ? null : fromFmp(today, windowEnd),
  ])
  const inRange = (e: UpcomingEarnings) => e.date >= from && e.date <= to
  const avInRange = av.events.filter(inRange)
  const fmpListed = (fmpWindow?.events ?? []).map((e) => e.symbol)
  return {
    configured: fmp.status.configured || av.status.configured,
    sources: {
      fmp: fmp.status,
      'alpha-vantage': { ...av.status, count: avInRange.length },
    },
    events: mergeEarnings(fmp.events.filter(inRange), avInRange, fmpListed),
  }
}
