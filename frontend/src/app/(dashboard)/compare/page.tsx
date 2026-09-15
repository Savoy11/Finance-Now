'use client'

import { Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { GitCompareArrows, Search, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { SourceLine } from '@/components/ui/SourceLine'
import { LineChart } from '@/components/charts/LineChart'
import { LiveUnavailable } from '@/components/ui/LiveUnavailable'
import { EQUITY_CATALOG, SECTOR_INFO, getEquity } from '@/lib/data/equityCatalog'
import { FUND_CATALOG, getFund } from '@/lib/data/fundCatalog'
import { ASSET_CATALOG } from '@/lib/data/assetCatalog'
import { INSTRUMENTS, securitySymbol, type InstrumentClass } from '@/lib/data/instruments'
import { compareAssetClasses, CLASS_PROFILES } from '@/lib/data/assetClassProfiles'
import { CHART_COLORS, STALE_TIME_LONG } from '@/lib/constants'
import { formatCompact, formatRatio } from '@/lib/utils/format'
import {
  normalizeToCommonStart,
  windowStats,
  correlationMatrix,
  betaVsBenchmark,
  MIN_BETA_PERIODS,
  toDailyCloses,
  commonStartTime,
  type ChartPoint,
  type NamedSeries,
} from '@/lib/utils/compareStats'
import type { SecurityChartResponse } from '@/app/live-data/security-chart/route'
import type { CompanyFactsResponse } from '@/app/live-data/company-facts/route'
import { FundOverlapSection } from '@/components/markets/FundOverlapSection'
import { FundFactsSection } from '@/components/markets/FundFactsSection'

// Cross-module comparison of 2–6 assets of ANY class — stocks, ETFs, mutual
// funds, crypto, commodities, currencies, rate indices: a normalized
// growth-of-100 chart, computed window performance (return / volatility /
// drawdown / Sharpe from the live series), a return-correlation matrix, and a
// labeled reference-fundamentals table. Selection + range are URL-deep-linkable.

type Kind = 'stock' | 'fund' | 'crypto' | 'macro'
interface Option { symbol: string; name: string; kind: Kind; cls: InstrumentClass; id?: string }

const OPTIONS: Option[] = [
  ...EQUITY_CATALOG.map((e) => ({ symbol: e.symbol, name: e.name, kind: 'stock' as const, cls: 'equity' as const })),
  ...FUND_CATALOG.map((f) => ({ symbol: f.symbol, name: f.name, kind: 'fund' as const, cls: (f.type === 'etf' ? 'etf' : 'mutual') as InstrumentClass })),
  ...ASSET_CATALOG.map((a) => ({ symbol: a.symbol, name: a.name, kind: 'crypto' as const, cls: 'crypto' as const, id: a.id })),
  // Macro instruments (commodities, FX pairs, yield indices) price through the
  // same security-chart route stocks and funds use — zero new plumbing, per
  // the P2-R3 integration. Coverage is provider-dependent since the Yahoo
  // removal; a symbol with no history lands in the existing `missing` banner
  // rather than silently vanishing.
  ...INSTRUMENTS.filter((i) => ['commodity', 'currency', 'rate'].includes(i.class)).map((i) => ({
    symbol: securitySymbol(i.key), name: i.name, kind: 'macro' as const, cls: i.class,
  })),
]
const OPTION_BY_SYMBOL = new Map<string, Option>()
for (const o of OPTIONS) if (!OPTION_BY_SYMBOL.has(o.symbol)) OPTION_BY_SYMBOL.set(o.symbol, o)
// Case-insensitive lookup for URL deep links: several crypto symbols are
// mixed-case in the catalog (USDe, lisUSD, …) and would otherwise round-trip
// into the URL but silently drop on reload (review finding).
const OPTION_BY_UPPER = new Map<string, Option>()
for (const o of OPTIONS) if (!OPTION_BY_UPPER.has(o.symbol.toUpperCase())) OPTION_BY_UPPER.set(o.symbol.toUpperCase(), o)

// ─── Non-catalog tickers (D16 / T-096) ───────────────────────────────────────
//
// Compare's universe used to be exactly the four catalogs above, so anything
// outside them could not be compared at all — while equity/fund detail pages and
// the Portfolios add-search had already learned to resolve arbitrary tickers.
// The plumbing was never the obstacle: `security-chart` serves any symbol it can
// price. The universe list was.
//
// Two pieces make an off-catalog symbol work:
//   1. `searchRemoteOptions` widens the PICKER, reusing the same three keyless
//      lookups Portfolios uses (#116).
//   2. `provisionalOption` keeps a DEEP LINK working. A shared
//      /compare?symbols=TSLA,VOO reaches someone whose page has no idea what
//      TSLA is; resolving it to a security-chart fetch is right far more often
//      than dropping it, and when it is wrong the existing `missing` banner says
//      so by name.

/**
 * An Option for a symbol no catalog knows.
 *
 * Typed as a security rather than crypto on purpose: `fetchPoints` sends crypto
 * to `/live-data/chart?id=` (a CoinGecko id, which an unknown symbol does not
 * have) and everything else to `/live-data/security-chart?symbol=`, which
 * accepts any ticker. So the security path is the only one that can possibly
 * succeed without more information — and a coin added through the picker carries
 * its real id, so it never lands here.
 */
function provisionalOption(symbol: string): Option {
  return { symbol, name: symbol, kind: 'stock', cls: 'equity' }
}

/** Maps an instrument class from the universe routes onto Compare's `kind`. */
function kindForClass(cls: InstrumentClass): Kind {
  if (cls === 'crypto') return 'crypto'
  if (cls === 'etf' || cls === 'mutual') return 'fund'
  if (cls === 'equity') return 'stock'
  return 'macro'
}

/**
 * Widen the picker beyond the catalogs, reusing the routes the Portfolios
 * add-search already proved (coins, funds, stocks; all keyless-tolerant).
 *
 * Every leg is allSettled and a rejection contributes nothing, so a remote
 * failure degrades the picker to catalog-only rather than erroring it. Funds are
 * pushed before stocks because an ETF appears in both directories and first-in
 * wins the dedupe — it should be labeled a fund, not a stock.
 */
async function searchRemoteOptions(q: string): Promise<Option[]> {
  const [coins, funds, stocks] = await Promise.allSettled([
    fetch(`/live-data/coin-search?q=${encodeURIComponent(q)}`).then((r) => r.json()) as Promise<{
      coins?: { cgId: string; symbol: string; name: string }[]
    }>,
    fetch(`/live-data/fund-universe?q=${encodeURIComponent(q)}`).then((r) => r.json()) as Promise<{
      ok?: boolean; entries?: { symbol: string; name: string; type: 'etf' | 'mutual' }[]
    }>,
    fetch(`/live-data/stock-universe?q=${encodeURIComponent(q)}`).then((r) => r.json()) as Promise<{
      ok?: boolean; entries?: { symbol: string; name: string }[]
    }>,
  ])

  const out: Option[] = []
  const seen = new Set<string>()
  const push = (o: Option) => {
    const key = o.symbol.toUpperCase()
    if (!seen.has(key)) { seen.add(key); out.push(o) }
  }
  if (coins.status === 'fulfilled') {
    for (const c of (coins.value.coins ?? []).slice(0, 8)) {
      push({ symbol: c.symbol.toUpperCase(), name: c.name, kind: 'crypto', cls: 'crypto', id: c.cgId })
    }
  }
  if (funds.status === 'fulfilled' && funds.value.ok) {
    for (const e of funds.value.entries ?? []) {
      push({ symbol: e.symbol, name: e.name, kind: 'fund', cls: e.type === 'etf' ? 'etf' : 'mutual' })
    }
  }
  if (stocks.status === 'fulfilled' && stocks.value.ok) {
    for (const e of stocks.value.entries ?? []) {
      push({ symbol: e.symbol, name: e.name, kind: kindForClass('equity'), cls: 'equity' })
    }
  }
  return out
}

function useDebounced(value: string, ms: number): string {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

const MAX_SYMBOLS = 6
const DEFAULT_SYMBOLS = ['VOO', 'QQQ']

const RANGES = [
  { value: '1mo', label: '1M', days: '30' },
  { value: '3mo', label: '3M', days: '90' },
  { value: '6mo', label: '6M', days: '180' },
  { value: '1y', label: '1Y', days: '365' },
  { value: '5y', label: '5Y', days: '1825' },
  { value: 'max', label: 'MAX', days: 'max' },
] as const
type Range = (typeof RANGES)[number]['value']
const RANGE_VALUES = RANGES.map((r) => r.value) as readonly string[]

/**
 * Benchmarks for the beta row (item 2b — asked for in T3, delivered 2026-08-18).
 *
 * Deliberately a short list of liquid, unambiguous reference series rather than
 * "any symbol": beta is only interpretable against something the reader can name
 * from memory, and an arbitrary benchmark invites comparisons ("beta vs DOGE")
 * that read as analysis while meaning nothing. BTC is included because a beta
 * against equities is the wrong question for a crypto-only comparison.
 */
const BENCHMARKS: Array<{ symbol: string; label: string }> = [
  { symbol: 'SPY', label: 'S&P 500 (SPY)' },
  { symbol: 'QQQ', label: 'Nasdaq-100 (QQQ)' },
  { symbol: 'IWM', label: 'Russell 2000 (IWM)' },
  { symbol: 'VT',  label: 'Global equity (VT)' },
  { symbol: 'AGG', label: 'US bonds (AGG)' },
  { symbol: 'BTC', label: 'Bitcoin (BTC)' },
]

const color = (i: number) => CHART_COLORS[i % CHART_COLORS.length]

interface CryptoChartResponse { ok: boolean; candles?: Array<{ date: string; close: number }> }

/**
 * Fetch a symbol's close history as {t(ms), close}[], from the right source.
 * Every series is snapped to daily closes on UTC-date boundaries
 * (toDailyCloses) — crypto arrives midnight-stamped, equity bars carry
 * market-open epochs, and CoinGecko returns hourly points on short ranges;
 * without the shared date grid, cross-class rows never align (null
 * correlations, fragmented chart) and hourly points break annualization.
 */
async function fetchPoints(opt: Option, range: (typeof RANGES)[number]): Promise<ChartPoint[]> {
  if (opt.kind === 'crypto') {
    const r = await fetch(`/live-data/chart?id=${encodeURIComponent(opt.id ?? opt.symbol.toLowerCase())}&days=${range.days}`)
    const j = (await r.json()) as CryptoChartResponse
    if (!j.ok || !j.candles) return []
    return toDailyCloses(j.candles.map((c) => ({ t: new Date(c.date).getTime(), close: c.close })))
  }
  const r = await fetch(`/live-data/security-chart?symbol=${encodeURIComponent(opt.symbol)}&range=${range.value}`)
  const j = (await r.json()) as SecurityChartResponse
  return toDailyCloses(j.chart?.points ?? [])
}

// Filed-fundamentals rows. Every figure comes from the keyless SEC EDGAR XBRL
// route already powering /equities/[symbol] — Compare simply never asked for it,
// so a stock comparison showed only the 79-name catalog's static snapshot.
//
// EPS is deliberately absent: the route reports whether a value is diluted or
// basic per registrant, and a column comparing one company's diluted EPS with
// another's basic EPS under a single heading would be exactly the kind of
// unlabelled mixed basis this codebase avoids elsewhere.
const FUNDAMENTAL_ROWS: Array<{ label: string; render: (d: CompanyFactsResponse) => string }> = [
  { label: 'Revenue (FY)', render: (d) => (d.fundamentals?.revenue != null ? formatCompact(d.fundamentals.revenue) : '—') },
  { label: 'Net income (FY)', render: (d) => (d.fundamentals?.netIncome != null ? formatCompact(d.fundamentals.netIncome) : '—') },
  { label: 'Revenue growth YoY', render: (d) => (d.ratios?.revenueGrowthYoY != null ? formatRatio(d.ratios.revenueGrowthYoY, 1) : '—') },
  { label: 'Gross margin', render: (d) => (d.ratios?.grossMargin != null ? formatRatio(d.ratios.grossMargin, 1) : '—') },
  { label: 'Operating margin', render: (d) => (d.ratios?.operatingMargin != null ? formatRatio(d.ratios.operatingMargin, 1) : '—') },
  { label: 'Net margin', render: (d) => (d.ratios?.netMargin != null ? formatRatio(d.ratios.netMargin, 1) : '—') },
  { label: 'Return on equity', render: (d) => (d.ratios?.roe != null ? formatRatio(d.ratios.roe, 1) : '—') },
  { label: 'Return on assets', render: (d) => (d.ratios?.roa != null ? formatRatio(d.ratios.roa, 1) : '—') },
  { label: 'Current ratio', render: (d) => (d.ratios?.currentRatio != null ? `${d.ratios.currentRatio.toFixed(2)}×` : '—') },
  { label: 'LT debt / equity', render: (d) => (d.ratios?.debtToEquity != null ? `${d.ratios.debtToEquity.toFixed(2)}×` : '—') },
  { label: 'Free cash flow (FY)', render: (d) => (d.fundamentals?.freeCashFlow != null ? formatCompact(d.fundamentals.freeCashFlow) : '—') },
]

const STAT_LABELS = ['Type', 'Sector', 'Market cap', 'P/E (TTM)', 'Dividend yield', 'Beta (5Y)', 'Expense ratio']

/**
 * Reference-fundamentals column for one symbol.
 *
 * `opt` is the RESOLVED option (T-096), so a ticker that is not in any catalog
 * still gets its Type row filled in from what the picker found. The remaining
 * rows stay em-dashes because the figures genuinely come from the catalogs —
 * printing a Type we know while dashing a P/E we do not is the honest split,
 * and it is why this takes the option rather than looking the symbol up itself.
 */
function statRows(symbol: string, opt?: Option): Array<[string, string]> {
  const e = getEquity(symbol)
  if (e) {
    return [
      ['Type', 'Stock'],
      ['Sector', SECTOR_INFO[e.sector].label],
      ['Market cap', formatCompact(e.marketCapB * 1e9)],
      ['P/E (TTM)', e.peRatio != null ? String(e.peRatio) : '—'],
      ['Dividend yield', e.dividendYieldPct != null ? `${e.dividendYieldPct}%` : 'None'],
      ['Beta (5Y)', e.beta.toFixed(2)],
      ['Expense ratio', '—'],
    ]
  }
  const f = getFund(symbol)
  if (f) {
    return [
      ['Type', f.type === 'etf' ? 'ETF' : 'Mutual fund'],
      ['Sector', '—'],
      ['Market cap', '—'],
      ['P/E (TTM)', '—'],
      ['Dividend yield', f.yieldPct != null ? `${f.yieldPct}%` : '—'],
      ['Beta (5Y)', '—'],
      ['Expense ratio', `${f.expenseRatioPct}%`],
    ]
  }
  const o = opt ?? OPTION_BY_SYMBOL.get(symbol)
  if (!o) return []
  const label =
    o.kind === 'crypto' ? 'Crypto'
    : o.kind === 'fund' ? (o.cls === 'etf' ? 'ETF' : 'Mutual fund')
    : o.kind === 'stock' ? 'Stock'
    : CLASS_PROFILES[o.cls].label
  return [['Type', label], ['Sector', '—'], ['Market cap', '—'], ['P/E (TTM)', '—'], ['Dividend yield', '—'], ['Beta (5Y)', '—'], ['Expense ratio', '—']]
}

const pct = (v: number, dp = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(dp)}%`
const signClass = (v: number) => (v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-text-secondary')

function corrCellStyle(v: number | null): CSSProperties {
  if (v === null) return {}
  const a = Math.min(Math.abs(v), 1) * 0.5
  return { backgroundColor: v >= 0 ? `rgba(16,185,129,${a})` : `rgba(239,68,68,${a})` }
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <CompareInner />
    </Suspense>
  )
}

function CompareInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [symbols, setSymbols] = useState<string[]>(() => {
    const raw = searchParams.get('symbols')
    // Case-insensitive resolve to the catalog's canonical casing, deduped.
    //
    // A symbol no catalog knows is KEPT (uppercased), not dropped — T-096. It
    // used to be silently discarded, which made a shared comparison containing
    // any off-catalog ticker quietly different for the recipient than for the
    // sender: same URL, fewer lines, no explanation. It now resolves through
    // `provisionalOption` to a security-chart fetch, and a symbol that genuinely
    // cannot be priced reaches the `missing` banner, which names it.
    const parsed = raw
      ? Array.from(new Set(
          raw.split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => OPTION_BY_UPPER.get(s.toUpperCase())?.symbol ?? s.toUpperCase()),
        )).slice(0, MAX_SYMBOLS)
      : []
    return parsed.length ? parsed : DEFAULT_SYMBOLS
  })

  const [range, setRange] = useState<Range>(() => {
    const raw = searchParams.get('range')
    return raw && RANGE_VALUES.includes(raw) ? (raw as Range) : '1y'
  })

  const [benchmark, setBenchmark] = useState<string>(BENCHMARKS[0].symbol)
  const [search, setSearch] = useState('')

  // Options resolved from a live lookup this session, keyed by symbol. Kept in
  // state rather than a module map so it cannot leak between users in SSR, and
  // so a coin's CoinGecko `id` survives from the moment it is picked through to
  // `fetchPoints` — without it a non-catalog coin would fetch as a stock ticker.
  const [discovered, setDiscovered] = useState<Record<string, Option>>({})

  // One resolver for the whole page. Catalog first, then anything found this
  // session, then a provisional security. Every former `OPTION_BY_SYMBOL.get()`
  // call site goes through this, so a discovered symbol behaves like a catalog
  // one everywhere: chart fetch, class panel, missing banner, fund sections.
  const resolve = useCallback(
    (symbol: string): Option =>
      OPTION_BY_SYMBOL.get(symbol) ?? discovered[symbol] ?? provisionalOption(symbol),
    [discovered],
  )

  /**
   * Add a picked option, remembering it if the catalogs do not already carry it.
   *
   * Recording it is the whole point: the search results vanish when the box
   * clears, and with them a non-catalog coin's CoinGecko `id` and a fund's class.
   * Without this the symbol would fall back to `provisionalOption` on the very
   * next render and a coin would be fetched as if it were a stock ticker.
   */
  const addOption = useCallback((o: Option) => {
    setSymbols((prev) => (prev.includes(o.symbol) || prev.length >= MAX_SYMBOLS ? prev : [...prev, o.symbol]))
    if (!OPTION_BY_SYMBOL.has(o.symbol)) {
      setDiscovered((prev) => (prev[o.symbol] ? prev : { ...prev, [o.symbol]: o }))
    }
    setSearch('')
  }, [])

  // Keep the URL in sync so a comparison is shareable/bookmarkable.
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('symbols', symbols.join(','))
    params.set('range', range)
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [symbols, range, router])

  // Catalog matches answer instantly and stay first — typing "vo" should show
  // VOO before a network round trip, not after it.
  const localMatches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q || symbols.length >= MAX_SYMBOLS) return []
    return OPTIONS
      .filter((o) => !symbols.includes(o.symbol) && (o.symbol.toLowerCase().includes(q) || o.name.toLowerCase().includes(q)))
      .slice(0, 8)
  }, [search, symbols])

  // Remote lookups widen the universe past the catalogs (T-096). Debounced and
  // gated at 2 characters for the same reason Portfolios is: one letter matches
  // half the market and the local list already covers the obvious cases.
  // `retry: false` keeps a dead lookup from re-firing behind every keystroke.
  const debouncedSearch = useDebounced(search.trim(), 350)
  const { data: remoteMatches } = useQuery<Option[]>({
    queryKey: ['compare-add-search', debouncedSearch],
    queryFn: () => searchRemoteOptions(debouncedSearch),
    enabled: debouncedSearch.length >= 2 && symbols.length < MAX_SYMBOLS,
    staleTime: 5 * 60_000,
    retry: false,
  })

  // Local first, remote appended, deduped case-insensitively against both the
  // local list and what is already selected. Comparing on the uppercased symbol
  // matters: the catalogs carry mixed-case crypto (USDe, lisUSD) that the
  // universe routes return uppercased, and a case-sensitive dedupe would offer
  // the same asset twice under two spellings.
  const matches = useMemo(() => {
    if (!search.trim() || symbols.length >= MAX_SYMBOLS) return []
    const seen = new Set<string>([
      ...localMatches.map((o) => o.symbol.toUpperCase()),
      ...symbols.map((s) => s.toUpperCase()),
    ])
    const extra = (remoteMatches ?? []).filter((o) => {
      const key = o.symbol.toUpperCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return [...localMatches, ...extra].slice(0, 12)
  }, [search, symbols, localMatches, remoteMatches])

  const rangeObj = RANGES.find((r) => r.value === range)!
  const chartQueries = useQueries({
    queries: symbols.map((symbol) => {
      const opt = resolve(symbol)
      return {
        queryKey: ['compare-chart', opt.kind, opt.id ?? symbol, range],
        queryFn: () => fetchPoints(opt, rangeObj),
        staleTime: STALE_TIME_LONG,
      }
    }),
  })

  // Benchmark series for the beta row. The query key is IDENTICAL in shape to a
  // selected symbol's, so when the benchmark is also one of the compared series
  // React Query serves it from the same cache entry instead of fetching twice.
  const benchOpt = resolve(benchmark)
  const benchQuery = useQuery({
    queryKey: ['compare-chart', benchOpt.kind, benchOpt.id ?? benchmark, range],
    queryFn: () => fetchPoints(benchOpt, rangeObj),
    staleTime: STALE_TIME_LONG,
  })

  const dataKey = chartQueries.map((q) => q.dataUpdatedAt).join(',')
  const series: NamedSeries[] = useMemo(
    () => symbols.map((s, i) => ({ symbol: s, points: chartQueries[i]?.data ?? [] })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbols.join(','), dataKey],
  )

  // Filed fundamentals for the stock legs only. Keyless (SEC EDGAR), one request
  // per symbol, capped by MAX_SYMBOLS at 6 — and cached under the same
  // ['company-facts', symbol] key the equity detail page uses, so navigating
  // between the two costs nothing.
  const stockSymbols = useMemo(
    () => symbols.filter((s) => resolve(s).kind === 'stock'),
    [symbols],
  )
  const factsQueries = useQueries({
    queries: stockSymbols.map((symbol) => ({
      queryKey: ['company-facts', symbol],
      queryFn: async (): Promise<CompanyFactsResponse> => {
        const r = await fetch(`/live-data/company-facts?symbol=${encodeURIComponent(symbol)}`)
        const j: CompanyFactsResponse = await r.json()
        if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
        return j
      },
      staleTime: STALE_TIME_LONG * 6, // fundamentals move on filing cadence
    })),
  })
  const factsKey = factsQueries.map((q) => q.dataUpdatedAt).join(',')
  const { factsBySymbol, factsMissing } = useMemo(() => {
    const bySymbol: Record<string, CompanyFactsResponse | undefined> = {}
    const missing: string[] = []
    stockSymbols.forEach((s, i) => {
      const q = factsQueries[i]
      if (q?.data) bySymbol[s] = q.data
      else if (!q?.isLoading) missing.push(s)
    })
    return { factsBySymbol: bySymbol, factsMissing: missing }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockSymbols, factsKey])

  const chartData = useMemo(() => normalizeToCommonStart(series), [series])
  // Symbols the user asked for that returned no usable history. The chart's
  // LiveUnavailable only fires when EVERY series is empty, and crypto is keyless
  // so it practically always resolves — meaning a stock in a mixed comparison
  // used to vanish from the legend with no banner and a bare '—' in the table.
  // Partial coverage has to be named, not inferred from an absence (D-12 class).
  const missing = useMemo(
    () => symbols.filter((s) => !chartData.present.includes(s)),
    [symbols, chartData.present],
  )
  // Stats over the SAME common-start window the chart is rebased to — otherwise
  // series with different history depths report non-comparable "window" figures
  // side by side (review finding).
  const perf = useMemo(() => {
    const start = commonStartTime(series)
    return series.map((s) => ({
      symbol: s.symbol,
      stats: windowStats(start != null ? s.points.filter((p) => p.t >= start) : s.points),
    }))
  }, [series])
  // Beta over the same common-start window the chart and the other stats use, so
  // every figure in the table describes the same period.
  const betaBySymbol = useMemo(() => {
    const bench = benchQuery.data ?? []
    const start = commonStartTime(series)
    const clip = (pts: ChartPoint[]) => (start != null ? pts.filter((p) => p.t >= start) : pts)
    const benchClipped = clip(bench)
    const out: Record<string, ReturnType<typeof betaVsBenchmark>> = {}
    for (const s of series) out[s.symbol] = betaVsBenchmark(clip(s.points), benchClipped)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, benchQuery.dataUpdatedAt])

  const corr = useMemo(() => correlationMatrix(series.filter((s) => s.points.length > 1)), [series])

  // Structural cross-class comparison — null for a single-class selection,
  // where there is nothing structural to say.
  const classComparison = useMemo(
    () => compareAssetClasses(symbols.map((s) => resolve(s).cls).filter((c): c is InstrumentClass => !!c)),
    [symbols],
  )

  const loading = chartQueries.some((q) => q.isLoading)
  const anyStats = perf.some((p) => p.stats !== null)

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">
      <div className="flex items-center gap-3">
        <GitCompareArrows className="h-6 w-6 text-accent-blue" aria-hidden />
        <PageHeader
          title="Compare"
          subtitle="Side-by-side across every asset class — normalized performance, risk stats, correlation"
          description="Pick 2–6 assets of any type — stocks, ETFs, mutual funds, coins, commodities, currencies, or rate indices. The chart normalizes every series to 100 at the common start date; the stats below are computed from the live price series over the selected window."
          details={[
            { label: 'Performance stats', text: 'Return, volatility, drawdown and Sharpe are derived from the fetched history over the current range.' },
            { label: 'Fundamentals', text: 'The reference table shows approximate catalog values, labeled per the suite convention. A ticker outside the curated catalogs charts and scores normally — those figures simply come from the catalog, so it shows its type and em-dashes for the rest rather than a guess.' },
            { label: 'Beyond the catalogs', text: 'Search reaches past the curated lists to any coin CoinGecko carries and any quotable US-listed stock or fund. A symbol with no price history lands in the "no data" notice by name rather than disappearing.' },
          ]}
        />
      </div>

      <SourceLine id="compare" />

      {/* Selection row */}
      <div className="flex flex-wrap items-center gap-2">
        {symbols.map((s, i) => (
          <span key={s} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-mono font-medium"
            style={{ borderColor: `${color(i)}55`, color: color(i), backgroundColor: `${color(i)}14` }}>
            {s}
            <button onClick={() => setSymbols(symbols.filter((x) => x !== s))} aria-label={`Remove ${s}`} className="opacity-70 hover:opacity-100">
              <X size={12} aria-hidden />
            </button>
          </span>
        ))}
        {symbols.length < MAX_SYMBOLS && (
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Add stock, fund or coin…"
              className="w-56 rounded-lg border border-border bg-bg-elevated pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue/50 focus:outline-none"
            />
            {matches.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-72 rounded-lg border border-border bg-bg-card shadow-xl shadow-black/40 z-20 overflow-hidden">
                {matches.map((o) => (
                  <button key={`${o.kind}-${o.symbol}`} onClick={() => { addOption(o) }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors">
                    <span className="truncate"><span className="font-mono font-medium">{o.symbol}</span> — {o.name}</span>
                    <span className="text-[10px] text-text-muted ml-2">{CLASS_PROFILES[o.cls].label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="ml-auto flex items-center gap-0.5 bg-bg-elevated border border-border rounded p-0.5">
          {RANGES.map(({ value, label }) => (
            <button key={value} onClick={() => setRange(value)}
              className={clsx('px-2.5 py-1 rounded text-[11px] font-mono font-medium transition-colors',
                range === value ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-muted hover:text-text-secondary')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-card border border-border bg-bg-card p-4">
        <h2 className="text-sm font-medium text-text-secondary mb-3">Growth of 100 — common start date</h2>
        {loading ? (
          <div className="h-64 animate-shimmer bg-shimmer-gradient bg-[length:200%_100%] rounded" />
        ) : chartData.rows.length > 1 ? (
          <LineChart
            data={chartData.rows}
            series={chartData.present.map((s) => ({ key: s, label: s, color: color(symbols.indexOf(s)) }))}
            xKey="t"
            xFormatter={(v) => new Date(Number(v)).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
            yFormatter={(v) => String(v)}
            tooltipFormatter={(v, name) => [`${v}`, String(name)]}
            height={320}
            showLegend
            connectNulls
          />
        ) : (
          <LiveUnavailable reason="needs-api-key" message="No live history source is reachable for the selected symbols. Crypto history is keyless (CoinGecko); stock, fund and macro history now needs a Tiingo or FMP key, since the keyless source was withdrawn on terms grounds." />
        )}
        {!loading && chartData.rows.length > 1 && missing.length > 0 && (
          <p className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-300">
            <span className="font-medium">Charted {chartData.present.length} of {symbols.length}.</span>{' '}
            No history returned for{' '}
            <span className="font-mono">{missing.join(', ')}</span>
            {missing.every((s) => resolve(s).kind !== 'crypto')
              ? ' — stock and fund history needs a Tiingo or FMP key on the Integrations page.'
              : ' — the series is missing or too short to align over this window.'}{' '}
            Everything below is computed over the remaining {chartData.present.length}, so the
            correlation matrix and window statistics do not describe the full selection.
          </p>
        )}
      </div>

      {/* Computed performance over the window */}
      {anyStats && (
        <div className="rounded-card border border-border bg-bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">Performance <span className="normal-case">(this window)</span></th>
                {symbols.map((s, i) => (
                  <th key={s} className="px-4 py-2.5 text-right text-xs font-mono font-semibold" style={{ color: color(i) }}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono tabular-nums">
              <tr>
                <td className="px-4 py-2.5 text-text-muted font-sans">Total return</td>
                {perf.map((p) => (
                  <td key={p.symbol} className={clsx('px-4 py-2.5 text-right', p.stats ? signClass(p.stats.totalReturnPct) : 'text-text-muted')}>
                    {p.stats ? pct(p.stats.totalReturnPct) : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-text-muted font-sans">CAGR (ann.)</td>
                {perf.map((p) => (
                  <td key={p.symbol} className={clsx('px-4 py-2.5 text-right', p.stats?.cagrPct != null ? signClass(p.stats.cagrPct) : 'text-text-muted')}>
                    {p.stats?.cagrPct != null ? pct(p.stats.cagrPct) : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-text-muted font-sans">Volatility (ann.)</td>
                {perf.map((p) => (
                  <td key={p.symbol} className="px-4 py-2.5 text-right text-text-secondary">{p.stats ? `${p.stats.volPct.toFixed(1)}%` : '—'}</td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-text-muted font-sans">Max drawdown</td>
                {perf.map((p) => (
                  <td key={p.symbol} className="px-4 py-2.5 text-right text-red-400">{p.stats ? `-${p.stats.maxDrawdownPct.toFixed(1)}%` : '—'}</td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-text-muted font-sans">Sharpe (ann.)</td>
                {perf.map((p) => (
                  <td key={p.symbol} className="px-4 py-2.5 text-right text-text-secondary">{p.stats?.sharpe != null ? p.stats.sharpe.toFixed(2) : '—'}</td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-text-muted font-sans">Sortino (ann.)</td>
                {perf.map((p) => (
                  <td key={p.symbol} className="px-4 py-2.5 text-right text-text-secondary">{p.stats?.sortino != null ? p.stats.sortino.toFixed(2) : '—'}</td>
                ))}
              </tr>
              {/* Beta vs a benchmark (item 2b). R² rides along beneath each
                  figure because a beta without it is easy to over-read: an
                  unrelated series can regress to a slope near 1. */}
              <tr>
                <td className="px-4 py-2.5 text-text-muted font-sans align-top">
                  <div className="flex items-center gap-2">
                    <span>Beta vs</span>
                    <select
                      value={benchmark}
                      onChange={(e) => setBenchmark(e.target.value)}
                      aria-label="Beta benchmark"
                      className="rounded border border-border bg-bg-elevated px-1.5 py-0.5 text-xs font-sans text-text-primary focus:border-accent-blue/50 focus:outline-none"
                    >
                      {BENCHMARKS.map((b) => (
                        <option key={b.symbol} value={b.symbol}>{b.label}</option>
                      ))}
                    </select>
                  </div>
                </td>
                {perf.map((p) => {
                  const b = betaBySymbol[p.symbol]
                  return (
                    <td key={p.symbol} className="px-4 py-2.5 text-right align-top">
                      <div className="text-text-secondary">{b ? b.beta.toFixed(2) : '—'}</div>
                      {b && (
                        <div className={clsx('text-[10px] font-sans', b.rSquared < 0.2 ? 'text-amber-400' : 'text-text-muted')}>
                          R² {b.rSquared.toFixed(2)}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
          <p className="px-4 py-2 text-[11px] text-text-muted border-t border-border/60">
            Derived from date-aligned daily closes over the common window; annualization matches per-series bar spacing (daily/weekly/monthly). Sharpe and Sortino use a 0% risk-free rate; Sortino penalizes downside deviation only, so it exceeds Sharpe when volatility is mostly upside. CAGR is blank on windows under a year — annualizing a one-month move overstates it.
            {' '}Beta is the slope of a series&rsquo; returns against the chosen benchmark over the same window, paired by date and <strong>not</strong> annualized; R² is how much of the movement the benchmark explains, and a low one (under 0.20, shown amber) means the beta is describing noise rather than a relationship. Blank when fewer than {MIN_BETA_PERIODS} periods overlap. The catalog&rsquo;s static &ldquo;Beta (5Y)&rdquo; in the reference table below is a different figure from a different window.
          </p>
        </div>
      )}

      {/* Return correlation matrix */}
      {corr.symbols.length >= 2 && (
        <div className="rounded-card border border-border bg-bg-card overflow-x-auto">
          <h2 className="px-4 pt-4 pb-2 text-sm font-medium text-text-secondary">Return correlation <span className="text-text-muted font-normal">— date-aligned closes over the window</span></h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-xs font-medium text-text-muted"></th>
                {corr.symbols.map((s) => (
                  <th key={s} className="px-4 py-2 text-right text-xs font-mono font-semibold text-text-secondary">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {corr.symbols.map((rowSym, i) => (
                <tr key={rowSym}>
                  <td className="px-4 py-2 text-xs font-semibold text-text-secondary">{rowSym}</td>
                  {corr.matrix[i].map((v, j) => (
                    <td key={j} className="px-4 py-2 text-right text-text-primary" style={corrCellStyle(v)}>
                      {v === null ? '—' : v.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Holdings overlap — funds only; a stock has no portfolio to compare. */}
      {/* Cross-class structural comparison. The numbers above treat every
          series as just a price line; this panel says what KINDS of thing are
          actually being compared — a stock and a coin can print the same 1Y
          return while one is a claim on cash flows and the other is not a
          claim on anything. Facts only, class-level only, never advice. */}
      {classComparison && (
        <div className="rounded-card border border-border bg-bg-card p-4 space-y-4">
          <h2 className="text-sm font-medium text-text-secondary">
            Comparing different asset types
            <span className="text-text-muted font-normal"> — {classComparison.classes.map((c) => CLASS_PROFILES[c].label).join(' vs ')}</span>
          </h2>

          <div className="flex flex-wrap gap-2">
            {classComparison.classes.map((c) => (
              <span key={c} className="rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-xs">
                <span className="font-semibold text-text-primary">{CLASS_PROFILES[c].label}</span>
                <span className="text-text-muted"> — {CLASS_PROFILES[c].whatItIs}</span>
              </span>
            ))}
          </div>

          {classComparison.similarities.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-400/80">Shared</h3>
              <ul className="space-y-0.5 text-xs text-text-secondary">
                {classComparison.similarities.map((r) => (
                  <li key={r.dimension}>
                    <span className="text-text-muted">{r.label}:</span> {Object.values(r.values)[0]}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-400/80">Where they differ</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 text-left font-medium uppercase tracking-wider text-text-muted">Dimension</th>
                  {classComparison.classes.map((c) => (
                    <th key={c} className="py-2 px-3 text-left font-semibold text-text-primary">{CLASS_PROFILES[c].label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {classComparison.differences.map((r) => (
                  <tr key={r.dimension}>
                    <td className="py-2 pr-3 align-top text-text-muted">{r.label}</td>
                    {classComparison.classes.map((c) => (
                      <td key={c} className="py-2 px-3 align-top text-text-secondary">{r.values[c]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {classComparison.caveats.length > 0 && (
            <div className="rounded-lg border border-border bg-bg-elevated px-3 py-2.5">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Reading the numbers above with this mix</h3>
              <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-text-muted">
                {classComparison.caveats.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <FundOverlapSection symbols={symbols.filter((s) => resolve(s).kind === 'fund')} />

      {/* Fund facts side by side (S6 / T-069). Sits beside the overlap section
          because the two answer adjacent questions: overlap says whether these
          are the same bet, this says what they cost and hold. Renders nothing
          unless two or more catalogued funds are selected. */}
      <FundFactsSection symbols={symbols.filter((s) => resolve(s).kind === 'fund')} />

      {/* Filed fundamentals — stocks only, keyless SEC EDGAR XBRL. Kept in its
          own table rather than merged into the reference stats below, because
          one is audited filing data and the other is a hand-maintained catalog
          snapshot; a single table would present both as equally current. */}
      {stockSymbols.length > 0 && (
        <div className="rounded-card border border-border bg-bg-card overflow-x-auto">
          <h2 className="px-4 pt-4 pb-2 text-sm font-medium text-text-secondary">
            Fundamentals <span className="text-text-muted font-normal">— latest full fiscal year, as filed</span>
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">Metric</th>
                {stockSymbols.map((s) => (
                  <th key={s} className="px-4 py-2.5 text-right text-xs font-mono font-semibold" style={{ color: color(symbols.indexOf(s)) }}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono tabular-nums">
              {FUNDAMENTAL_ROWS.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-2.5 text-text-muted font-sans">{row.label}</td>
                  {stockSymbols.map((s) => (
                    <td key={s} className="px-4 py-2.5 text-right text-text-secondary">
                      {factsBySymbol[s] ? row.render(factsBySymbol[s]!) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-border/60">
            {factsMissing.length > 0 && (
              <p className="text-[11px] text-amber-300 mb-1">
                No filed fundamentals for <span className="font-mono">{factsMissing.join(', ')}</span> — foreign private issuers (20-F) and registrants with no US-GAAP annual facts do not appear in this dataset.
              </p>
            )}
            <SourceLine id="company-facts" />
          </div>
        </div>
      )}

      {/* Reference fundamentals */}
      <div className="rounded-card border border-border bg-bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">Stat <span className="normal-case">(reference)</span></th>
              {symbols.map((s, i) => (
                <th key={s} className="px-4 py-2.5 text-right text-xs font-mono font-semibold" style={{ color: color(i) }}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {STAT_LABELS.map((label, rowIdx) => (
              <tr key={label}>
                <td className="px-4 py-2.5 text-text-muted">{label}</td>
                {symbols.map((s) => (
                  <td key={s} className="px-4 py-2.5 text-right font-mono tabular-nums text-text-secondary">
                    {statRows(s, resolve(s))[rowIdx]?.[1] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
