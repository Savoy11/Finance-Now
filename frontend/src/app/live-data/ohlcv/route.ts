import { NextRequest, NextResponse } from 'next/server'
import { coingeckoIdFor } from '@/lib/api/live/coingeckoIds'
import { coingeckoBase, coingeckoHeaders } from '@/lib/api/live/coingecko'
import { EXTERNAL_FETCH_TIMEOUT_MS } from '@/lib/server/fetchBudget'
import { describeThrottle } from '@/lib/server/coingeckoThrottle'
import { candleGranularity } from '@/lib/utils/candleGranularity'
import type { CandleBars } from '@/lib/utils/indicators'

// OHLCV proxy. Which source answers depends on what the caller can use.
//
//   Candles (the default): CoinGecko.
//   Closing prices (`closes=1`): DefiLlama, then CoinGecko's candles.
//
// Charts launch on CoinGecko's candles and DefiLlama's closing prices (T-423,
// owner decision D103, 2026-10-13). DefiLlama's price API (coins.llama.fi) sends
// one price per interval, with no high, low or volume, so it answers only a
// caller that computes from closing prices and asks for them. A chart or a
// pattern finder asking for candles never receives it. Measured 2026-10-13: no
// key, 15-minute to weekly spacing, history back to each coin's listing
// (Bitcoin from April 2013), at most 500 prices a request.
//
// CoinGecko's free service refuses history older than 365 days and sends 4-day
// candles for any window over 30 days. So a candle caller gets coarse candles past
// 30 days and none past 365, and the readers that can use closing prices switch
// to them there: the two crypto charts (hooks/useCryptoChartSeries.ts) and the
// assistant's get_price_history. CoinGecko's refusal is addressed to "Public API
// users"; a paid key (COINGECKO_API_KEY) is not refused the same way.
//
// Binance and Binance.US were the first candle rungs until 2026-10-13 and came
// out under T-423 (D102, D103): Binance.US licenses its data "personal to you"
// and names no route to public use, and Binance.com's terms could not be read.
// A `?source=binance` from an old client is served like `auto`.
//
// Query params:
//   id     = internal asset id (e.g. "btc")
//   range  = 1H | 4H | 1M | 3M | 6M | YTD | 1Y | 3Y | 5Y | 10Y | MAX  (default "1Y")
//            (legacy: timeframe=1H|4H|1D|1W is aliased)
//   closes = "1" when the caller computes from closing prices only
//   source = "auto" (default) | "coingecko" | "defillama"
//
// Response: { ok, range, candles: OhlcvCandle[], granularity, source, bars }
// `bars` is 'ohlc' for real candles and 'close' for DefiLlama's prices, which
// arrive as candles whose open, high, low and close are the one price, with
// volume 0. `granularity` is measured from the candles
// (lib/utils/candleGranularity), not typed per range: the same range can be
// daily from DefiLlama but 4-day from CoinGecko.

export const dynamic = 'force-dynamic'

export interface OhlcvCandle {
  time: number   // unix seconds
  open: number
  high: number
  low: number
  close: number
  volume: number // USD millions
}

/** 'ohlc': real candles. 'close': one price per interval, carried in the candle shape. */
export type OhlcvBars = CandleBars

const CG_HEADERS = coingeckoHeaders

// ─── Legacy alias ──────────────────────────────────────────────────────────────
const LEGACY_MAP: Record<string, string> = { '1D': '1Y', '1W': '5Y' }

// ─── Range config ──────────────────────────────────────────────────────────────
interface RangeConfig {
  cgDays: string
  resample: 'none' | 'daily' | 'weekly'
  sliceDays?: number
  ytd?: true
  revalidate: number
  /** The spacing asked of DefiLlama, in its notation: 15m, 1h, 4h, 1d, 1w. */
  interval: string
  /** How many of them. */
  points: number
}

const RANGE_CONFIG: Record<string, RangeConfig> = {
  // A long DAILY series (~2.7y) so 200-period strategies have a real usable
  // window. Not exposed in the chart range picker. Cycle Context's Pi Cycle reads
  // it as closes from DefiLlama. The hidden Backtest tab asks for candles, which
  // have had no source past 365 days on CoinGecko's free service since the
  // Binance rungs went (T-423, 2026-10-13).
  'BT':  { cgDays: 'max', resample: 'daily',  revalidate: 3600, interval: '1d',  points: 1000 },
  '15m': { cgDays: '1',   resample: 'none',   revalidate: 60,   interval: '15m', points: 200  },
  '1H':  { cgDays: '1',   resample: 'none',   revalidate: 60,   interval: '1h',  points: 168  },
  '4H':  { cgDays: '7',   resample: 'none',   revalidate: 300,  interval: '4h',  points: 540  },
  '1M':  { cgDays: '30',  resample: 'none',   revalidate: 300,  interval: '4h',  points: 180  },
  '3M':  { cgDays: '90',  resample: 'daily',  revalidate: 900,  interval: '1d',  points: 90   },
  '6M':  { cgDays: '180', resample: 'daily',  revalidate: 900,  interval: '1d',  points: 180  },
  'YTD': { cgDays: '365', resample: 'daily',  ytd: true, revalidate: 900, interval: '1d', points: 365 },
  '1Y':  { cgDays: '365', resample: 'daily',  revalidate: 900,  interval: '1d',  points: 365  },
  '3Y':  { cgDays: 'max', resample: 'weekly', sliceDays: 1095, revalidate: 3600, interval: '1w', points: 157 },
  '5Y':  { cgDays: 'max', resample: 'weekly', sliceDays: 1825, revalidate: 3600, interval: '1w', points: 261 },
  '10Y': { cgDays: 'max', resample: 'weekly', sliceDays: 3650, revalidate: 3600, interval: '1w', points: 522 },
  'MAX': { cgDays: 'max', resample: 'weekly', revalidate: 3600, interval: '1w',  points: 1000 },
}

// The requested range is upper-cased so a legacy "1d" still finds "1D", which
// made "15m" into "15M": no key, so it fell back to a year of daily candles.
// The multi-timeframe grid's 15m row read daily data under a 15m label until
// granularity was measured, then said "only daily" (found 2026-10-13). Keys are
// matched without regard to case instead; no two differ only in case.
const RANGE_KEY = new Map(Object.keys(RANGE_CONFIG).map((k) => [k.toUpperCase(), k]))
// `daily` resampling cannot make daily candles out of 4-day ones: past 30 days
// CoinGecko's free service sends one candle per four days, and grouping them by
// day leaves them as they are. The granularity the response reports says so.

// ─── Resamplers ────────────────────────────────────────────────────────────────

function resampleToDaily(candles: OhlcvCandle[]): OhlcvCandle[] {
  const byDay = new Map<string, OhlcvCandle[]>()
  for (const c of candles) {
    const day = new Date(c.time * 1000).toISOString().slice(0, 10)
    const arr = byDay.get(day) ?? []; arr.push(c); byDay.set(day, arr)
  }
  return Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, cs]) => ({
    time: cs[0].time,
    open: cs[0].open,
    high: Math.max(...cs.map((c) => c.high)),
    low:  Math.min(...cs.map((c) => c.low)),
    close: cs[cs.length - 1].close,
    volume: cs.reduce((s, c) => s + c.volume, 0),
  }))
}

function resampleToWeekly(candles: OhlcvCandle[]): OhlcvCandle[] {
  const byWeek = new Map<string, OhlcvCandle[]>()
  for (const c of candles) {
    const d = new Date(c.time * 1000)
    const day = d.getUTCDay()
    const diff = day === 0 ? -6 : 1 - day
    const mon = new Date(d); mon.setUTCDate(d.getUTCDate() + diff)
    const key = mon.toISOString().slice(0, 10)
    const arr = byWeek.get(key) ?? []; arr.push(c); byWeek.set(key, arr)
  }
  return Array.from(byWeek.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, cs]) => ({
    time: cs[0].time,
    open: cs[0].open,
    high: Math.max(...cs.map((c) => c.high)),
    low:  Math.min(...cs.map((c) => c.low)),
    close: cs[cs.length - 1].close,
    volume: cs.reduce((s, c) => s + c.volume, 0),
  }))
}

function applySlice(candles: OhlcvCandle[], cfg: RangeConfig): OhlcvCandle[] {
  if (cfg.ytd) {
    const jan1 = new Date(new Date().getUTCFullYear(), 0, 1).getTime() / 1000
    return candles.filter((c) => c.time >= jan1)
  }
  if (cfg.sliceDays) {
    const cutoff = Date.now() / 1000 - cfg.sliceDays * 86400
    return candles.filter((c) => c.time >= cutoff)
  }
  // Cap only. CoinGecko's `/ohlc?days=1` returns 30-minute candles covering one
  // day — about 48 bars — so this slice never actually trims. It is a ceiling
  // against a provider that starts serving more, not a window: 168 × 30m would
  // be 3.5 days, not the week an earlier comment here claimed. DefiLlama's 1H
  // answer is 168 hourly prices asked for directly, so this does not trim it either.
  if (cfg.cgDays === '1') return candles.slice(-168)
  return candles
}

// ─── CoinGecko ─────────────────────────────────────────────────────────────────

async function fetchCoinGecko(id: string, cfg: RangeConfig): Promise<OhlcvCandle[]> {
  const cgId = coingeckoIdFor(id)
  if (!cgId) throw new Error('no-cg-mapping')

  const [ohlcRes, volRes] = await Promise.all([
    fetch(`${coingeckoBase()}/coins/${cgId}/ohlc?vs_currency=usd&days=${cfg.cgDays}`, {
      headers: CG_HEADERS(),
      next: { revalidate: cfg.revalidate }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    }),
    fetch(`${coingeckoBase()}/coins/${cgId}/market_chart?vs_currency=usd&days=${cfg.cgDays}`, {
      headers: CG_HEADERS(),
      next: { revalidate: cfg.revalidate }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    }),
  ])

  // CoinGecko's own words go in the error: past 365 days its free service answers
  // "Public API users are limited to querying historical data within the past
  // 365 days", which is the reason a 3Y chart is empty, and a bare status hides it.
  if (!ohlcRes.ok) throw new Error(`CoinGecko HTTP ${ohlcRes.status}${await describeThrottle(ohlcRes)}`)

  const ohlcRaw = (await ohlcRes.json()) as [number, number, number, number, number][]

  const volLookup = new Map<number, number>()
  if (volRes.ok) {
    const volData = (await volRes.json()) as { total_volumes: [number, number][] }
    for (const [ms, vol] of volData.total_volumes ?? []) {
      volLookup.set(Math.round(ms / 3_600_000) * 3_600_000, vol)
    }
  }

  let candles: OhlcvCandle[] = ohlcRaw.map(([ms, open, high, low, close]) => {
    const hk = Math.round(ms / 3_600_000) * 3_600_000
    let vol = 0
    for (let o = 0; o <= 4; o++) {
      if (volLookup.has(hk + o * 3_600_000)) { vol = volLookup.get(hk + o * 3_600_000)!; break }
      if (volLookup.has(hk - o * 3_600_000)) { vol = volLookup.get(hk - o * 3_600_000)!; break }
    }
    return { time: Math.floor(ms / 1000), open, high, low, close, volume: vol / 1e6 }
  })

  if (cfg.resample === 'daily')  candles = resampleToDaily(candles)
  if (cfg.resample === 'weekly') candles = resampleToWeekly(candles)
  candles = applySlice(candles, cfg)
  return candles
}

// ─── DefiLlama (closing prices) ────────────────────────────────────────────────

const LLAMA_COINS = 'https://coins.llama.fi'

/** Measured 2026-10-13: "Requested 1000 data points exceeds the maximum of 500." */
const LLAMA_MAX_POINTS = 500
/** MAX asks for 1,000 weekly prices, which is two requests; three is the ceiling. */
const LLAMA_MAX_PAGES = 3

const INTERVAL_SECONDS: Record<string, number> = { '15m': 900, '1h': 3_600, '4h': 14_400, '1d': 86_400, '1w': 604_800 }

/** DefiLlama's refusals carry a `message` ("…exceeds the maximum of 500"); a bare status hides it. */
async function llamaReason(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown }
    return typeof body.message === 'string' ? `: ${body.message}` : ''
  } catch {
    return ''
  }
}

/**
 * `cfg.points` prices `cfg.interval` apart, ending now, read backwards 500 at a
 * time. Keyed by CoinGecko id, which DefiLlama takes as `coingecko:<id>`, so
 * every coin with a CoinGecko id is covered without a second symbol map.
 */
async function fetchDefiLlamaCloses(id: string, cfg: RangeConfig): Promise<OhlcvCandle[]> {
  const cgId = coingeckoIdFor(id)
  if (!cgId) throw new Error('no-cg-mapping')
  const step = INTERVAL_SECONDS[cfg.interval]
  if (!step) throw new Error(`defillama-no-interval-${cfg.interval}`)
  const key = `coingecko:${cgId}`

  // Rounded to the range's revalidate window so the URL, and with it Next's data
  // cache, holds still between calls. `end=now` would change every second and
  // never be served from the cache.
  let end = Math.floor(Date.now() / 1000 / cfg.revalidate) * cfg.revalidate
  let remaining = cfg.points
  const prices = new Map<number, number>()

  for (let page = 0; page < LLAMA_MAX_PAGES && remaining > 0; page++) {
    const span = Math.min(LLAMA_MAX_POINTS, remaining)
    const res = await fetch(`${LLAMA_COINS}/chart/${key}?period=${cfg.interval}&span=${span}&end=${end}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: cfg.revalidate }, signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    })
    if (!res.ok) {
      // A later page failing still leaves the recent history, which is the part
      // every reader uses; the first failing leaves nothing.
      if (page === 0) throw new Error(`DefiLlama HTTP ${res.status}${await llamaReason(res)}`)
      break
    }
    const body = (await res.json()) as { coins?: Record<string, { prices?: { timestamp: number; price: number }[] }> }
    const rows = body.coins?.[key]?.prices ?? []
    for (const p of rows) {
      if (Number.isFinite(p.timestamp) && Number.isFinite(p.price) && p.price > 0) prices.set(p.timestamp, p.price)
    }
    // The coin's history began inside this page when its earliest price is later
    // than the page's first slot: asking further back would return nothing.
    const pageStart = end - (span - 1) * step
    if (rows.length === 0 || Math.min(...rows.map((p) => p.timestamp)) > pageStart + step) break
    remaining -= span
    end -= span * step
  }

  if (prices.size === 0) throw new Error('defillama-no-prices')
  const candles = [...prices.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, price]) => ({ time, open: price, high: price, low: price, close: price, volume: 0 }))
  return applySlice(candles, cfg)
}

// ─── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const id  = request.nextUrl.searchParams.get('id') ?? ''
  const rawRange = (
    request.nextUrl.searchParams.get('range') ??
    request.nextUrl.searchParams.get('timeframe') ??
    '1Y'
  ).toUpperCase()
  const range  = LEGACY_MAP[rawRange] ?? RANGE_KEY.get(rawRange) ?? rawRange
  const cfg    = RANGE_CONFIG[range] ?? RANGE_CONFIG['1Y']
  const source = request.nextUrl.searchParams.get('source') ?? 'auto'
  const closesWanted = request.nextUrl.searchParams.get('closes') === '1'

  // auto: closing prices from DefiLlama when the caller asked for them; then
  //       CoinGecko's candles
  // defillama: DefiLlama only
  // coingecko: CoinGecko only
  // Anything else, `binance` included, is served like auto.

  if (source === 'defillama' || (source !== 'coingecko' && closesWanted)) {
    try {
      const candles = await fetchDefiLlamaCloses(id, cfg)
      return NextResponse.json({
        ok: true, range, candles, granularity: candleGranularity(candles.map((c) => c.time)),
        source: 'defillama', bars: 'close' satisfies OhlcvBars,
      })
    } catch (err) {
      // Falls through to CoinGecko, whose candles' closes serve this caller too.
      if (source === 'defillama') {
        return NextResponse.json({ ok: false, candles: [], error: String(err) })
      }
    }
  }

  try {
    const candles = await fetchCoinGecko(id, cfg)
    return NextResponse.json({
      ok: true, range, candles, granularity: candleGranularity(candles.map((c) => c.time)),
      source: 'coingecko', bars: 'ohlc' satisfies OhlcvBars,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, candles: [], error: String(err) })
  }
}
