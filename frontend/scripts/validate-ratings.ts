/**
 * The rating validation (T-420 item 7; docs/architecture/risk-ratings-methodology.md §8).
 *
 *   npx tsx scripts/validate-ratings.ts --out <report.md>        (from frontend/, dev server running)
 *   npm run ratings:validate -- --out <report.md>
 *
 * Four checks, on the live universe (every rated coin and catalog stock), each under the method
 * as it stands and under the first draft's price curves and lift (FIRST_DRAFT, replaced by D97):
 *   1. Sanity order: today's class for every asset, beside the class its volatility alone
 *      would get on the EU PRIIPs scale (indicative).
 *   2. Backtest: scores at past quarter starts against the volatility and largest fall over
 *      the next 6 and 12 months (Spearman; negative = higher scores went with calmer prices).
 *   3. Sensitivity: each weight and each curve breakpoint moved ±20%, assets that change class.
 *   4. Stability: how often the class changes month to month, with and without the 16-week rule.
 *
 * READS ONLY, STORES NOTHING. No database, no route that records a reading. Prices are
 * held in memory and dropped at exit: stock candles come from /live-data/security-ohlcv,
 * which may be Tiingo, whose Starter terms (§1.6(a)) bar keeping its data. The report
 * carries classes and scores for stocks, never their prices or price-derived figures.
 *
 * Data limits, stated in the report: CoinGecko's free tier serves 365 days, which is one
 * rating's worth, so coin backtests and stability use Binance.US closes (via /live-data/ohlcv)
 * and measure price behaviour only. Stock backtests scale today's reference market cap by
 * price and use each year's net margin; debt ÷ equity has no history in the route, so it is
 * left out at past dates.
 */
import { writeFileSync } from 'node:fs'
import { ASSET_CATALOG } from '../src/lib/data/assetCatalog'
import { EQUITY_CATALOG, type EquityEntry } from '../src/lib/data/equityCatalog'
import { coingeckoBase, coingeckoHeaders } from '../src/lib/api/live/coingecko'
import { METHODOLOGY_V1 as M } from '../src/lib/risk/methodology/v1'
import {
  annualisedVolatility, applyStability, maxDrawdownFraction, rateAsset,
  type AssetRating, type AssetRatingInputs, type RatingClassNumber,
} from '../src/lib/risk/assetRating'
import { coinEligibility, coinInputsFromChart, stockInputsFrom, type MarketChart } from '../src/lib/risk/ratingInputs'
import type { OhlcvCandle } from '../src/lib/utils/indicators'
import type { CompanyFactsResponse } from '../src/app/live-data/company-facts/route'
import {
  FIRST_DRAFT, countChanges, mean, median, mondays, monthlySamples, priipsBandClass, quarterStarts, spearman, withPatch,
} from './lib/ratingValidation'

const DAY = 86_400_000
const args = process.argv.slice(2)
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const BASE = (flag('--base') ?? 'http://localhost:3000').replace(/\/+$/, '')
const OUT = flag('--out')
const NOW = new Date()
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms))
const log = (s: string) => process.stderr.write(`${s}\n`)
const pct = (x: number | null | undefined) => (x == null ? '—' : `${(x * 100).toFixed(0)}%`)
const f2 = (x: number | null | undefined) => (x == null ? '—' : x.toFixed(2))
type Rated = Extract<AssetRating, { rated: true }>
type MethodShape = typeof M

// ── fetching (memory only) ───────────────────────────────────────────────────

async function getJson<T>(url: string, init?: RequestInit): Promise<{ ok: true; body: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) })
    if (!res.ok && res.status !== 404 && res.status !== 503) return { ok: false, error: `HTTP ${res.status}` }
    return { ok: true, body: await res.json() as T }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** CoinGecko's free tier: about one request every eight seconds, and a minute's rest after a refusal. */
async function coingeckoChart(cgId: string): Promise<MarketChart | string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${coingeckoBase()}/coins/${cgId}/market_chart?vs_currency=usd&days=${M.crypto.priceWindowDays}&interval=daily`,
      { headers: coingeckoHeaders(), signal: AbortSignal.timeout(30_000) }).catch((e) => e as Error)
    if (res instanceof Error) return res.message
    if (res.status === 429) { log(`  CoinGecko 429 on ${cgId}; waiting 65s`); await sleep(65_000); continue }
    if (!res.ok) return `HTTP ${res.status}`
    return await res.json() as MarketChart
  }
  return 'HTTP 429 after three tries'
}

interface Coin { id: string; symbol: string; chart: MarketChart | null; history: OhlcvCandle[] | null; notes: string[] }
interface Stock { entry: EquityEntry; candles: OhlcvCandle[] | null; source: string; facts: CompanyFactsResponse | null; notes: string[] }

async function loadCoins(): Promise<Coin[]> {
  const ids = ASSET_CATALOG.filter((a) => coinEligibility(a.id).eligible)
  const out: Coin[] = []
  for (const [i, a] of ids.entries()) {
    const e = coinEligibility(a.id)
    if (!e.eligible) continue
    log(`coin ${i + 1}/${ids.length} ${a.id}`)
    const notes: string[] = []
    const chart = await coingeckoChart(e.coingeckoId)
    if (typeof chart === 'string') notes.push(`CoinGecko: ${chart}`)
    const h = await getJson<{ ok: boolean; candles: OhlcvCandle[]; error?: string }>(`${BASE}/live-data/ohlcv?id=${a.id}&range=BT&source=binance`)
    const history = h.ok && h.body.ok && h.body.candles.length ? h.body.candles : null
    if (!history) notes.push(`Binance history: ${h.ok ? h.body.error ?? 'none' : h.error}`)
    out.push({ id: a.id, symbol: a.symbol, chart: typeof chart === 'string' ? null : chart, history, notes })
    await sleep(8_000)
  }
  return out
}

async function loadStocks(): Promise<Stock[]> {
  const out: Stock[] = []
  for (const [i, entry] of EQUITY_CATALOG.entries()) {
    log(`stock ${i + 1}/${EQUITY_CATALOG.length} ${entry.symbol}`)
    const q = encodeURIComponent(entry.symbol)
    const notes: string[] = []
    const o = await getJson<{ ok: boolean; candles: OhlcvCandle[]; source: string; error?: string }>(
      `${BASE}/live-data/security-ohlcv?symbol=${q}&range=5Y`, { cache: 'no-store' })
    const candles = o.ok && o.body.ok && o.body.candles.length ? o.body.candles : null
    if (!candles) notes.push(`prices: ${o.ok ? o.body.error ?? 'none' : o.error}`)
    const fr = await getJson<CompanyFactsResponse>(`${BASE}/live-data/company-facts?symbol=${q}`)
    const facts = fr.ok ? fr.body : null
    if (!fr.ok) notes.push(`filing: ${fr.error}`)
    else if (!fr.body.ok) notes.push(`filing: ${fr.body.error}`)
    out.push({ entry, candles, source: o.ok ? o.body.source : 'none', facts, notes })
    await sleep(1_200)
  }
  return out
}

// ── ratings ──────────────────────────────────────────────────────────────────

function rateCoinToday(c: Coin): AssetRating | null {
  return c.chart ? rateAsset(coinInputsFromChart(c.chart, NOW).inputs, NOW) : null
}

function rateStockToday(s: Stock): AssetRating | null {
  if (!s.candles) return null
  const f = s.facts?.ok ? s.facts : null
  return rateAsset(stockInputsFrom(s.entry, { candles: s.candles, fundamentals: f?.fundamentals ?? null, fiscalYearEnd: f?.fiscalYearEnd ?? null }, NOW).inputs, NOW)
}

/** A stock's rating as of `at`, from what was known then (see the header for the approximations). */
function rateStockAt(s: Stock, at: Date): Rated | null {
  const past = s.candles!.filter((c) => c.time * 1000 < at.getTime())
  if (past.length < M.stock.minHistoryDays) return null
  const lastClose = s.candles![s.candles!.length - 1].close
  const closeAt = past[past.length - 1].close
  const filingCutoff = new Date(at.getTime() - 90 * DAY).toISOString().slice(0, 10)
  const year = s.facts?.ok ? s.facts.annualSeries.find((p) => p.fiscalYearEnd <= filingCutoff) : undefined
  const inputs: AssetRatingInputs = {
    kind: 'stock',
    closes: past.map((c) => c.close),
    volumes: past.map((c) => c.volume),
    marketCapUsd: s.entry.marketCapB * 1e9 * (closeAt / lastClose),
    sector: s.entry.sector,
    fundamentals: year ? { revenue: year.revenue, netIncome: year.netIncome, periodEnd: year.fiscalYearEnd } : null,
  }
  const r = rateAsset(inputs, at)
  return r.rated ? r : null
}

/**
 * A coin's price-behaviour score as of `at`, from Binance.US closes. Liquidity and scale are
 * filled with placeholders only to clear the coverage floor; the core score the engine
 * returns depends on volatility and drawdown alone.
 */
function coinCoreAt(c: Coin, at: Date): { core: number; coreCls: RatingClassNumber } | null {
  const past = c.history!.filter((x) => x.time * 1000 < at.getTime()).slice(-M.crypto.priceWindowDays)
  if (past.length < M.crypto.minHistoryDays) return null
  const r = rateAsset({ kind: 'crypto', closes: past.map((x) => x.close), dollarVolumes: Array(30).fill(1e9), marketCapUsd: 1e10 }, at)
  return r.rated ? { core: r.coreScore, coreCls: r.coreCls } : null
}

function forward(candles: OhlcvCandle[], at: Date, days: number, periodsPerYear: number) {
  const from = at.getTime(), to = from + days * DAY
  const before = candles.filter((x) => x.time * 1000 < from)
  const window = candles.filter((x) => x.time * 1000 >= from && x.time * 1000 < to)
  if (!before.length || window.length < days * (periodsPerYear / 365) * 0.8) return null
  const closes = [before[before.length - 1].close, ...window.map((x) => x.close)]
  return { vol: annualisedVolatility(closes, periodsPerYear), dd: maxDrawdownFraction(closes) }
}

// ── the method, and the first draft it replaced (D97, 2026-10-11) ──
// The 2026-10-10 runs compared candidates A, B and C against the draft; B and C were adopted,
// so the candidates are now the method itself and the draft is the comparison left.

const VARIANTS: Array<{ key: string; label: string; patch: (m: MethodShape) => void }> = [
  { key: 'base', label: 'The method', patch: () => {} },
  { key: 'draft', label: 'First draft (hand-set price curves, a one-class lift)', patch: (m) => {
    const mm = m as unknown as { capClassesAboveCore: number } & Record<'crypto' | 'stock', { curves: Record<string, unknown> }>
    mm.capClassesAboveCore = FIRST_DRAFT.capClassesAboveCore
    for (const kind of ['crypto', 'stock'] as const) {
      mm[kind].curves.volatility = structuredClone(FIRST_DRAFT[kind].volatility)
      mm[kind].curves.drawdown = structuredClone(FIRST_DRAFT[kind].drawdown)
    }
  } },
]
const tag =(key: string) => (key === 'base' ? 'the method' : 'first draft')

// ── report ───────────────────────────────────────────────────────────────────

const lines: string[] = []
const out = (s = '') => lines.push(s)

function table(head: string[], rows: (string | number)[][]) {
  out(`| ${head.join(' | ')} |`)
  out(`|${head.map(() => '---').join('|')}|`)
  for (const r of rows) out(`| ${r.join(' | ')} |`)
  out()
}

function distribution(classes: number[]): string {
  return [1, 2, 3, 4, 5, 6, 7].map((c) => `${c}: ${classes.filter((x) => x === c).length}`).join(' · ')
}

async function main() {
  log(`validating against ${BASE}; this takes about ten minutes`)
  const coins = await loadCoins()
  const stocks = await loadStocks()

  out(`# Rating validation report`)
  out()
  out(`Generated ${NOW.toISOString()} by \`scripts/validate-ratings.ts\`, method \`${M.version}\`. Reads only; stores nothing.`)
  out()

  // ── 1. sanity order, with the variants ──
  const baseline = new Map<string, number>() // asset → class, to check every variant restores it
  const sanity: Array<{ key: string; kind: 'crypto' | 'stock'; name: string; vol: number | null; dd: number | null; band: number | null; byVariant: Record<string, Rated | null>; reason?: string }> = []
  for (const v of VARIANTS) {
    withPatch(M, v.patch, () => {
      for (const c of coins) {
        const r = rateCoinToday(c)
        let row = sanity.find((x) => x.key === `crypto:${c.id}`)
        if (!row) {
          const vol = r?.dimensions.find((d) => d.key === 'volatility')?.raw.volatility ?? null
          const dd = r?.dimensions.find((d) => d.key === 'drawdown')?.raw.drawdown ?? null
          row = { key: `crypto:${c.id}`, kind: 'crypto', name: `${c.symbol} (${c.id})`, vol, dd, band: vol == null ? null : priipsBandClass(vol), byVariant: {}, reason: r && !r.rated ? r.reason : c.notes.join('; ') || undefined }
          sanity.push(row)
        }
        row.byVariant[v.key] = r?.rated ? r : null
      }
      for (const s of stocks) {
        const r = rateStockToday(s)
        let row = sanity.find((x) => x.key === `stock:${s.entry.symbol}`)
        if (!row) {
          const vol = r?.dimensions.find((d) => d.key === 'volatility')?.raw.volatility ?? null
          row = { key: `stock:${s.entry.symbol}`, kind: 'stock', name: s.entry.symbol, vol: null, dd: null, band: vol == null ? null : priipsBandClass(vol), byVariant: {}, reason: r && !r.rated ? r.reason : s.notes.join('; ') || undefined }
          sanity.push(row)
        }
        row.byVariant[v.key] = r?.rated ? r : null
      }
    })
    // The patch must not leak: the baseline reproduces exactly after every variant.
    for (const row of sanity) {
      const again = row.kind === 'crypto' ? rateCoinToday(coins.find((c) => `crypto:${c.id}` === row.key)!) : rateStockToday(stocks.find((s) => `stock:${s.entry.symbol}` === row.key)!)
      const cls = again?.rated ? again.cls : 0
      if (!baseline.has(row.key)) baseline.set(row.key, cls)
      else if (baseline.get(row.key) !== cls) throw new Error(`variant ${v.key} leaked: ${row.key} changed from ${baseline.get(row.key)} to ${cls}`)
    }
  }

  out(`## 1. Sanity order`)
  out()
  for (const kind of ['crypto', 'stock'] as const) {
    const rows = sanity.filter((r) => r.kind === kind)
    const rated = rows.filter((r) => r.byVariant.base)
    out(`**${kind === 'crypto' ? 'Coins' : 'Stocks'}: ${rated.length} of ${rows.length} rated.**`)
    out()
    table(['Variant', 'Classes (1 … 7)', 'Median class', 'Same as PRIIPs band', 'Within one', 'Mean gap (PRIIPs − ours)'],
      VARIANTS.map((v) => {
        const pairs = rows.filter((r) => r.byVariant[v.key] && r.band != null).map((r) => ({ ours: r.byVariant[v.key]!.cls, band: r.band! }))
        return [v.label, distribution(pairs.map((p) => p.ours)), String(median(pairs.map((p) => p.ours)) ?? '—'),
          `${pairs.filter((p) => p.ours === p.band).length}/${pairs.length}`,
          `${pairs.filter((p) => Math.abs(p.ours - p.band) <= 1).length}/${pairs.length}`,
          f2(mean(pairs.map((p) => p.band - p.ours)))]
      }))
  }
  out(`PRIIPs band = the class plain one-year volatility falls in on the EU PRIIPs scale (survey §1.1). Indicative, and a lower bound: PRIIPs counts fat tails.`)
  out()
  out(`### Every coin`)
  out()
  table(['Coin', 'Class', 'Score', 'Price alone (class)', 'Capped', 'Volatility', 'Largest fall', 'PRIIPs band', 'First draft', 'Note'],
    sanity.filter((r) => r.kind === 'crypto').map((r) => {
      const b = r.byVariant.base
      return [r.name, b ? `${b.cls} (${b.label})` : 'not rated', b?.score ?? '—', b ? `${b.coreScore} (${b.coreCls})` : '—', b?.capped ? 'yes' : '',
        pct(r.vol), pct(r.dd), r.band ?? '—', r.byVariant.draft?.cls ?? '—', b ? '' : (r.reason ?? '')]
    }))
  out(`### Every stock`)
  out()
  out(`Classes and scores only: stock prices may come from Tiingo, whose terms bar keeping its data, so no price-derived figure is written here.`)
  out()
  table(['Stock', 'Class', 'Score', 'Price alone (class)', 'Capped', 'PRIIPs band', 'First draft', 'Prices from', 'Note'],
    sanity.filter((r) => r.kind === 'stock').map((r) => {
      const b = r.byVariant.base
      const s = stocks.find((x) => `stock:${x.entry.symbol}` === r.key)!
      return [r.name, b ? `${b.cls} (${b.label})` : 'not rated', b?.score ?? '—', b ? `${b.coreScore} (${b.coreCls})` : '—', b?.capped ? 'yes' : '',
        r.band ?? '—', r.byVariant.draft?.cls ?? '—', s.source, b ? '' : (r.reason ?? s.notes.join('; '))]
    }))

  // ── 2. backtest ──
  out(`## 2. Backtest`)
  out()
  out(`Spearman rank correlation, per quarter start, between the score and what followed. Negative means higher scores (lower measured risk) went with lower later volatility or smaller later falls; −1 is a perfect ordering, 0 none.`)
  out()
  const stockSpan = stocks.filter((s) => s.candles).map((s) => [s.candles![0].time * 1000, s.candles![s.candles!.length - 1].time * 1000])
  const coinSpan = coins.filter((c) => c.history).map((c) => [c.history![0].time * 1000, c.history![c.history!.length - 1].time * 1000])
  const backRows: (string | number)[][] = []
  for (const horizon of [182, 365]) {
    // Stocks: the full score and the price-only core, under the method and the first draft.
    const sDates = stockSpan.length ? quarterStarts(new Date(median(stockSpan.map((x) => x[0]))! + 366 * DAY), new Date(NOW.getTime() - horizon * DAY)) : []
    const months = horizon === 182 ? '6 months' : '12 months'
    for (const v of VARIANTS) {
      const res = { score: { vol: [] as number[], dd: [] as number[] }, core: { vol: [] as number[], dd: [] as number[] }, n: [] as number[] }
      withPatch(M, v.patch, () => {
        for (const d of sDates) {
          const pts = stocks.filter((s) => s.candles).map((s) => ({ r: rateStockAt(s, d), f: forward(s.candles!, d, horizon, 252) }))
            .filter((p): p is { r: Rated; f: { vol: number; dd: number } } => !!p.r && !!p.f && p.f.vol != null && p.f.dd != null)
          if (pts.length < 10) continue
          res.n.push(pts.length)
          const push = (arr: number[], x: number | null) => { if (x != null) arr.push(x) }
          push(res.score.vol, spearman(pts.map((p) => p.r.score), pts.map((p) => p.f.vol)))
          push(res.score.dd, spearman(pts.map((p) => p.r.score), pts.map((p) => p.f.dd)))
          push(res.core.vol, spearman(pts.map((p) => p.r.coreScore), pts.map((p) => p.f.vol)))
          push(res.core.dd, spearman(pts.map((p) => p.r.coreScore), pts.map((p) => p.f.dd)))
        }
      })
      backRows.push([`Stocks, full score (${tag(v.key)})`, months, res.n.length, f2(median(res.n)), f2(mean(res.score.vol)), f2(mean(res.score.dd))])
      backRows.push([`Stocks, price alone (${tag(v.key)})`, months, res.n.length, f2(median(res.n)), f2(mean(res.core.vol)), f2(mean(res.core.dd))])
    }

    // Coins: price alone only (no free history of total volume or market cap), on each set of curves.
    const cDates = coinSpan.length ? quarterStarts(new Date(median(coinSpan.map((x) => x[0]))! + 366 * DAY), new Date(NOW.getTime() - horizon * DAY)) : []
    for (const v of VARIANTS) {
      const cr ={ vol: [] as number[], dd: [] as number[], n: [] as number[] }
      const pooled = { vol: [] as number[], n: [] as number[] }
      withPatch(M, v.patch, () => {
        for (const d of cDates) {
          const pts = coins.filter((c) => c.history).map((c) => ({ r: coinCoreAt(c, d), f: forward(c.history!, d, horizon, 365) }))
            .filter((p): p is { r: { core: number; coreCls: RatingClassNumber }; f: { vol: number; dd: number } } => !!p.r && !!p.f && p.f.vol != null && p.f.dd != null)
          if (pts.length < 5) continue
          cr.n.push(pts.length)
          const a = spearman(pts.map((p) => p.r.core), pts.map((p) => p.f.vol)); if (a != null) cr.vol.push(a)
          const b = spearman(pts.map((p) => p.r.core), pts.map((p) => p.f.dd)); if (b != null) cr.dd.push(b)
          // Coins and stocks together: does one scale order a coin against a stock?
          const sp = stocks.filter((s) => s.candles).map((s) => ({ r: rateStockAt(s, d), f: forward(s.candles!, d, horizon, 252) }))
            .filter((p): p is { r: Rated; f: { vol: number; dd: number } } => !!p.r && !!p.f && p.f.vol != null)
          if (sp.length >= 10) {
            const xs = [...pts.map((p) => p.r.core), ...sp.map((p) => p.r.coreScore)]
            const ys = [...pts.map((p) => p.f.vol), ...sp.map((p) => p.f.vol)]
            const c = spearman(xs, ys); if (c != null) { pooled.vol.push(c); pooled.n.push(xs.length) }
          }
        }
      })
      backRows.push([`Coins, price alone (${tag(v.key)})`, months, cr.n.length, f2(median(cr.n)), f2(mean(cr.vol)), f2(mean(cr.dd))])
      backRows.push([`Coins and stocks pooled, price alone (${tag(v.key)})`, months, pooled.n.length, f2(median(pooled.n)), f2(mean(pooled.vol)), '—'])
    }
  }
  table(['Set', 'Horizon', 'Quarter starts', 'Median assets', 'ρ with later volatility', 'ρ with later largest fall'], backRows)
  out(`Stocks at past dates: market cap is today's reference figure scaled by price, net margin is each fiscal year's from SEC filings (filed 90 days after year end), and debt ÷ equity is left out (the route carries no history of it). Coins: Binance.US closes, price behaviour only.`)
  out()

  // ── 3. sensitivity ──
  out(`## 3. Sensitivity`)
  out()
  const ratedNow = sanity.filter((r) => r.byVariant.base)
  const classNow = () => new Map(ratedNow.map((r) => {
    const x = r.kind === 'crypto' ? rateCoinToday(coins.find((c) => `crypto:${c.id}` === r.key)!) : rateStockToday(stocks.find((s) => `stock:${s.entry.symbol}` === r.key)!)
    return [r.key, x?.rated ? x.cls : 0]
  }))
  const base = classNow()
  const sens: Array<{ param: string; down: number; up: number; of: number }> = []
  for (const kind of ['crypto', 'stock'] as const) {
    const of = ratedNow.filter((r) => r.kind === kind).length
    const method = kind === 'crypto' ? M.crypto : M.stock
    const changed = (patch: (m: MethodShape) => void) => withPatch(M, patch, () => {
      const now = classNow()
      return [...now].filter(([k, c]) => k.startsWith(kind) && c !== base.get(k)).length
    })
    method.dimensions.forEach((d, i) => {
      const w = (f: number) => (m: MethodShape) => { ((m[kind] as unknown as { dimensions: { weight: number }[] }).dimensions[i]).weight = d.weight * f }
      sens.push({ param: `${kind} weight: ${d.label} (${d.weight})`, down: changed(w(0.8)), up: changed(w(1.2)), of })
    })
    for (const [curve, points] of Object.entries(method.curves as Record<string, ReadonlyArray<readonly [number, number]>>)) {
      points.forEach((p, j) => {
        const move = (f: number) => (m: MethodShape) => {
          const pts = ((m[kind] as unknown as { curves: Record<string, [number, number][]> }).curves[curve])
          pts[j] = [p[0] * f, p[1]]
        }
        const ordered = (f: number) => {
          const xs = points.map((q, k) => (k === j ? q[0] * f : q[0]))
          return xs.every((x, k) => k === 0 || x > xs[k - 1])
        }
        sens.push({
          param: `${kind} curve: ${curve} point ${j + 1} (${p[0]} → ${p[1]})`,
          down: ordered(0.8) ? changed(move(0.8)) : -1,
          up: ordered(1.2) ? changed(move(1.2)) : -1,
          of,
        })
      })
    }
  }
  const restored = classNow()
  for (const [k, c] of restored) if (base.get(k) !== c) throw new Error(`sensitivity leaked: ${k}`)
  const cell = (n: number, of: number) => (n < 0 ? 'skipped (would reorder the curve)' : `${n}/${of}`)
  const sorted = [...sens].sort((a, b) => Math.max(b.down, b.up) - Math.max(a.down, a.up))
  out(`Each parameter moved −20% and +20% alone; the count is how many rated assets change class. All ${sens.length} parameters, most sensitive first:`)
  out()
  table(['Parameter', '−20%', '+20%'], sorted.map((s) => [s.param, cell(s.down, s.of), cell(s.up, s.of)]))

  // ── 4. stability ──
  out(`## 4. Stability`)
  out()
  const stab: (string | number)[][] = []
  const simulate = (classes: RatingClassNumber[]) => {
    const shown: RatingClassNumber[] = []
    classes.forEach((c, i) => {
      const prev = i === 0 ? null : shown[i - 1]
      shown.push(applyStability(prev, classes.slice(Math.max(0, i - M.stabilityWeeks + 1), i + 1)).shownCls)
    })
    return shown
  }
  const summarise = (label: string, series: Array<{ dates: Date[]; classes: RatingClassNumber[] }>) => {
    let raw = 0, held = 0, monthsTotal = 0
    for (const s of series) {
      const shown = simulate(s.classes)
      const mRaw = monthlySamples(s.dates, s.classes)
      const mShown = monthlySamples(s.dates, shown)
      raw += countChanges(mRaw)
      held += countChanges(mShown)
      monthsTotal += Math.max(0, mRaw.length - 1)
    }
    const perYear = (n: number) => (monthsTotal ? (n / monthsTotal * 12).toFixed(2) : '—')
    stab.push([label, series.length, monthsTotal, raw, perYear(raw), held, perYear(held)])
  }
  for (const v of VARIANTS) {
    withPatch(M, v.patch, () => summarise(`Stocks, class (${tag(v.key)})`, stocks.filter((s) => s.candles).map((s) => {
      const ds = mondays(new Date(s.candles![0].time * 1000 + 366 * DAY), NOW)
      const pairs = ds.map((d) => ({ d, r: rateStockAt(s, d) })).filter((p): p is { d: Date; r: Rated } => !!p.r)
      return { dates: pairs.map((p) => p.d), classes: pairs.map((p) => p.r.cls) }
    }).filter((s) => s.classes.length > 8)))
  }
  for (const v of VARIANTS) {
    withPatch(M, v.patch, () => summarise(`Coins, price-alone class (${tag(v.key)})`, coins.filter((c) => c.history).map((c) => {
      const ds = mondays(new Date(c.history![0].time * 1000 + 366 * DAY), NOW)
      const pairs = ds.map((d) => ({ d, r: coinCoreAt(c, d) })).filter((p): p is { d: Date; r: { core: number; coreCls: RatingClassNumber } } => !!p.r)
      return { dates: pairs.map((p) => p.d), classes: pairs.map((p) => p.r.coreCls) }
    }).filter((s) => s.classes.length > 8)))
  }
  table(['Set', 'Assets', 'Asset-months', 'Changes, no rule', 'Per asset per year', 'Changes, 16-week rule', 'Per asset per year'], stab)
  out(`Weekly ratings from each asset's second year of history to today, sampled on the first Monday of each month. The rule is simulated with a reading every week.`)
  out()

  // ── data notes ──
  out(`## Data notes`)
  out()
  const problems = [...coins.filter((c) => c.notes.length).map((c) => `- ${c.id}: ${c.notes.join('; ')}`), ...stocks.filter((s) => s.notes.length).map((s) => `- ${s.entry.symbol}: ${s.notes.join('; ')}`)]
  out(problems.length ? problems.join('\n') : 'Every request answered.')
  out()

  const report = lines.join('\n')
  if (OUT) { writeFileSync(OUT, report); log(`wrote ${OUT}`) } else process.stdout.write(report)
}

main().catch((e) => { log(String(e?.stack ?? e)); process.exit(1) })
