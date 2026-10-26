'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink, KeyRound, LineChart, RefreshCw, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { SourceLine } from '@/components/ui/SourceLine'
import { MetricCard } from '@/components/ui/MetricCard'
import { OutlierScanPanel } from '@/components/markets/OutlierScanPanel'
import { SECTOR_INFO, type SectorId } from '@/lib/data/equityCatalog'
import { peText, perShareFromFields, stockFigures, stockFiguresLink, yieldText, type StockFigures } from '@/lib/data/stockPerShare'
import { marketCapText, marketCapUsd } from '@/lib/data/stockShares'
import { formatCompact, formatCurrency, formatPercent } from '@/lib/utils/format'
import { STALE_TIME_SHORT } from '@/lib/constants'
import { useScreenerUrl } from '@/lib/hooks/useScreenerUrl'
import type { StockUniverseResponse, UniverseEntry } from '@/app/live-data/stock-universe/route'
import type { SecurityQuotesResponse } from '@/app/live-data/security-quotes/route'
import type { SecurityReturnsResponse } from '@/app/live-data/security-returns/route'

type SortKey = 'symbol' | 'sector' | 'price' | 'marketCap' | 'pe' | 'dividend'
const PAGE_SIZE = 50
/**
 * Live quotes are fetched for the whole list up to this many stocks, so every price-derived
 * filter and sort sees every stock (D170: there is no stored price to fall back on). The
 * curated list is well inside it; the paid FMP universe is not, and there they cover the
 * largest stocks by FMP's own ordering, plus the page on screen.
 */
const QUOTE_ALL_UP_TO = 200

// Shared column template so the header and every row line up. 9 columns:
// Company · Sector · Price · Chg% · Mkt Cap · P/E · Yield · YTD · 1Y
const COLS = 'grid grid-cols-[minmax(0,2.4fr)_1.2fr_1fr_0.8fr_1.1fr_0.7fr_0.7fr_0.8fr_0.8fr] gap-2 px-4'

/**
 * A trailing-return cell. Module-level, not declared inside the client: a
 * component created during render is a new component type every render, which
 * defeats reconciliation (the code-scanning finding on #147).
 *
 * A missing return renders a dash, never 0%. Without a provider key the route
 * reports `source: 'none'` and every value is null — "we could not fetch this"
 * and "this stock returned nothing" must not look the same.
 *
 * `adjusted === false` carries the same spirit one step further: the figure was
 * computed on UNADJUSTED closes because the provider omitted `adjClose`, so a
 * split or distribution inside the window distorts it — a 4:1 split reads as
 * -75%. T-401 (2026-09-22) decided to serve these rather than go dark, on the
 * condition that they SAY SO, and this marker is that condition. `undefined`
 * means no fallback occurred, so nothing is rendered.
 */
function ReturnCell({ value, adjusted }: { value: number | null; adjusted?: boolean }) {
  const unadjusted = adjusted === false && value != null
  return (
    <div className={clsx('text-right font-mono tabular-nums text-xs',
      value == null ? 'text-text-muted' : value >= 0 ? 'text-emerald-400' : 'text-red-400')}>
      {value == null ? '—' : formatPercent(value, 1)}
      {unadjusted && (
        <span
          className="ml-0.5 align-super text-[9px] font-semibold text-amber-400"
          title="Computed from unadjusted closes — this provider did not supply an adjusted price for every day in the window, so a split or distribution inside it distorts this figure."
        >
          unadj
        </span>
      )}
    </div>
  )
}

/** What a stock's live quote makes of its SEC figures (D170): null fields without a quote. */
interface LiveFigures {
  livePrice: number | null
  /** P/E and yield against livePrice, from the SEC per-share figures (D167). */
  figures: StockFigures
  changePercent: number | null
  /** SEC cover-page shares × livePrice (D170). */
  liveMarketCap: number | null
}

interface Row extends UniverseEntry, LiveFigures {
  /** Trailing returns, page-scoped and key-gated. Null when unavailable — never 0. */
  ytdPct: number | null
  y1Pct: number | null
  /** false when these came from unadjusted closes — see ReturnCell. */
  returnsAdjusted?: boolean
}

const SORT_BASIS_HINT: Partial<Record<SortKey, string>> = {
  price: 'Sorted by live price; stocks with no live quote come last',
  marketCap: 'Sorted by market cap (SEC shares outstanding × live price); stocks with no figure come last',
  pe: 'Sorted by P/E against the live price; stocks with no figure come last',
  dividend: 'Sorted by dividend yield against the live price; stocks with no figure come last',
}

/**
 * Sortable column header. Module-level, not declared inside `EquitiesClient`:
 * a component declared during render is a NEW component type every render, so
 * React unmounts and remounts everything beneath it instead of reconciling.
 * Same defect and same fix as FundsClient's SortHeader (#147) — the sort state
 * arrives as props rather than through a closure.
 */
function SortHeader({ label, colKey, align = 'end', sortKey, sortAsc, onToggle }: {
  label: string
  colKey: SortKey
  align?: 'start' | 'end'
  sortKey: SortKey
  sortAsc: boolean
  onToggle: (key: SortKey) => void
}) {
  return (
    <button
      onClick={() => onToggle(colKey)}
      title={SORT_BASIS_HINT[colKey]}
      className={clsx('flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors',
        align === 'end' ? 'justify-end' : 'justify-start',
        sortKey === colKey ? 'text-accent-blue' : 'text-text-muted hover:text-text-secondary')}
    >
      {label}
      {sortKey === colKey
        ? (sortAsc ? <ArrowUp size={11} aria-hidden /> : <ArrowDown size={11} aria-hidden />)
        : <ArrowUpDown size={11} className="opacity-40" aria-hidden />}
    </button>
  )
}

const parseNum = (s: string): number => parseFloat(s)

export function EquitiesClient() {
  const [sector, setSector] = useState<SectorId | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('marketCap')
  const [sortAsc, setSortAsc] = useState(false)
  // Pagination keyed on the filter/sort signature rather than reset by an
  // effect — the reset used to land a render late, painting an empty table for
  // one frame when a filter changed past page 1. Same fix as FundsClient.
  const [pageState, setPageState] = useState<{ sig: string; page: number }>({ sig: '', page: 0 })
  // Screener ranges (blank = no bound)
  const [minMcapB, setMinMcapB] = useState('')
  const [maxMcapB, setMaxMcapB] = useState('')
  const [minPe, setMinPe] = useState('')
  const [maxPe, setMaxPe] = useState('')
  const [minYield, setMinYield] = useState('')
  const [maxYield, setMaxYield] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  // W3-5: every filter is a RANGE over a catalog fact — the owner asked for
  // "more like filters; more options", and half-ranges (min-only yield,
  // max-only beta) were the old shape's arbitrary limits. Beta left the list on 2026-10-25
  // (D170): it is worked out from a year of prices on each stock's own page.
  const [payersOnly, setPayersOnly] = useState(false)

  // Deep-linkable screener state — /equities?sector=technology&peMax=20&sort=pe
  useScreenerUrl(
    {
      sector, q: search, sort: sortKey, dir: sortAsc ? 'asc' : 'desc',
      mcapMin: minMcapB, mcapMax: maxMcapB, peMin: minPe, peMax: maxPe,
      yieldMin: minYield, yieldMax: maxYield,
      priceMin: minPrice, priceMax: maxPrice, payers: payersOnly ? '1' : '',
    },
    { sector: 'all', q: '', sort: 'marketCap', dir: 'desc', mcapMin: '', mcapMax: '', peMin: '', peMax: '', yieldMin: '', yieldMax: '', priceMin: '', priceMax: '', payers: '' },
    (p) => {
      if (p.sector && (p.sector === 'all' || p.sector in SECTOR_INFO)) setSector(p.sector as SectorId | 'all')
      if (p.q) setSearch(p.q)
      if (p.sort && ['symbol', 'sector', 'price', 'marketCap', 'pe', 'dividend'].includes(p.sort)) setSortKey(p.sort as SortKey)
      if (p.dir) setSortAsc(p.dir === 'asc')
      if (p.mcapMin) setMinMcapB(p.mcapMin)
      if (p.mcapMax) setMaxMcapB(p.mcapMax)
      if (p.peMin) setMinPe(p.peMin)
      if (p.peMax) setMaxPe(p.peMax)
      if (p.yieldMin) setMinYield(p.yieldMin)
      // These were written into the link from W3-5 on but never read back,
      // so a shared link dropped them and showed the unfiltered list (found by the
      // T-282 click-through, 2026-10-07). equitiesScreenerUrl.test.ts now fails if a
      // key written above is not read here.
      if (p.yieldMax) setMaxYield(p.yieldMax)
      if (p.priceMin) setMinPrice(p.priceMin)
      if (p.priceMax) setMaxPrice(p.priceMax)
      if (p.payers === '1') setPayersOnly(true)
    },
  )

  // ── Universe (daily-refreshed; server caches 24h) ──
  const { data: universeData, isLoading: uniLoading, refetch, isFetching } = useQuery<StockUniverseResponse>({
    queryKey: ['stock-universe'],
    queryFn: () => fetch('/live-data/stock-universe').then((r) => r.json()),
    staleTime: 1000 * 60 * 30,
  })
  const universe = useMemo(() => universeData?.entries ?? [], [universeData])
  const configured = universeData?.configured ?? false

  // ── Live quotes for the whole list (D170) ──
  // Every price-derived figure is worked out against a live quote and nothing else, so the
  // screen needs a quote for every stock it screens. The curated list is one request.
  const quotedSymbols = useMemo(() => universe.slice(0, QUOTE_ALL_UP_TO).map((e) => e.symbol), [universe])
  const { data: quoteData } = useQuery<SecurityQuotesResponse>({
    queryKey: ['security-quotes', 'registry', quotedSymbols.join(',')],
    queryFn: () => fetch(`/live-data/security-quotes?symbols=${encodeURIComponent(quotedSymbols.join(','))}`).then((r) => r.json()),
    enabled: quotedSymbols.length > 0,
    staleTime: STALE_TIME_SHORT,
    refetchInterval: 120_000,
    placeholderData: keepPreviousData,
  })

  const liveBySymbol = useMemo(() => {
    const out = new Map<string, LiveFigures>()
    for (const e of universe) {
      const q = quoteData?.quotes?.[e.symbol.toUpperCase()]
      out.set(e.symbol, liveFiguresOf(e, q && !q.reference ? q : undefined))
    }
    return out
  }, [universe, quoteData])

  // ── Filter + sort the whole universe ──
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const mcMin = parseNum(minMcapB), mcMax = parseNum(maxMcapB)
    const peMin = parseNum(minPe), peMax = parseNum(maxPe)
    const yMin = parseNum(minYield), yMax = parseNum(maxYield)
    const pMin = parseNum(minPrice), pMax = parseNum(maxPrice)
    const live = (e: UniverseEntry) => liveBySymbol.get(e.symbol)!
    const inRange = (v: number | null, lo: number, hi: number) =>
      (!isFinite(lo) || (v != null && v >= lo)) && (!isFinite(hi) || (v != null && v <= hi))
    const subset = universe.filter((e) => {
      const l = live(e)
      return (sector === 'all' || e.sector === sector) &&
        (!query || e.symbol.toLowerCase().includes(query) || e.name.toLowerCase().includes(query)) &&
        inRange(l.liveMarketCap != null ? l.liveMarketCap / 1e9 : null, mcMin, mcMax) &&
        inRange(l.figures.pe, peMin, peMax) &&
        inRange(l.figures.dividendYieldPct, yMin, yMax) &&
        inRange(l.livePrice, pMin, pMax) &&
        (!payersOnly || e.dividendState === 'paid')
    })
    const dir = sortAsc ? 1 : -1
    // Null for a stock with no figure: it sorts last whichever way the column runs.
    const value = (e: UniverseEntry): number | string | null => {
      const l = live(e)
      switch (sortKey) {
        case 'symbol':   return e.symbol
        case 'sector':   return `${SECTOR_INFO[e.sector].label} ${e.industry}`
        case 'price':    return l.livePrice
        case 'pe':       return l.figures.pe
        case 'dividend': return l.figures.dividendYieldPct
        default:         return l.liveMarketCap
      }
    }
    return [...subset].sort((a, b) => {
      const va = value(a), vb = value(b)
      if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * dir
      return ((va as number) - (vb as number)) * dir
    })
  }, [universe, liveBySymbol, sector, search, sortKey, sortAsc, minMcapB, maxMcapB, minPe, maxPe, minYield, maxYield, minPrice, maxPrice, payersOnly])

  // Reset to first page whenever the result set changes
  const filterSig = JSON.stringify([sector, search, sortKey, sortAsc, minMcapB, maxMcapB, minPe, maxPe, minYield, maxYield, minPrice, maxPrice, payersOnly])
  const page = pageState.sig === filterSig ? pageState.page : 0
  const setPage = (next: number | ((p: number) => number)) =>
    setPageState({ sig: filterSig, page: typeof next === 'function' ? next(page) : next })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageEntries = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const pageSymbols = pageEntries.map((e) => e.symbol)

  // ── The page's own quotes, only past QUOTE_ALL_UP_TO (the paid FMP universe) ──
  const unquotedOnPage = universe.length > QUOTE_ALL_UP_TO ? pageSymbols.filter((s) => !quotedSymbols.includes(s)) : []
  const { data: pageQuoteData } = useQuery<SecurityQuotesResponse>({
    queryKey: ['security-quotes', 'page', unquotedOnPage.join(',')],
    queryFn: () => fetch(`/live-data/security-quotes?symbols=${encodeURIComponent(unquotedOnPage.join(','))}`).then((r) => r.json()),
    enabled: unquotedOnPage.length > 0,
    staleTime: STALE_TIME_SHORT,
    refetchInterval: 120_000,
    placeholderData: keepPreviousData,
  })

  // ── Trailing returns for the visible page only ──
  //
  // Deliberately page-scoped, and deliberately NOT sortable or screenable. The
  // route is one keyed request per symbol since the Yahoo removal (it refuses
  // `?universe=` outright rather than truncating), so the only returns the app
  // can see are the fifty on screen. A sort or a screen over a column that has
  // seen fifty of several thousand rows would filter as though it had seen them
  // all — the same reason fund return screening is off.
  const { data: pageReturnsData } = useQuery<SecurityReturnsResponse>({
    queryKey: ['security-returns', 'equities-page', pageSymbols.join(',')],
    queryFn: () => fetch(`/live-data/security-returns?symbols=${encodeURIComponent(pageSymbols.join(','))}`).then((r) => r.json()),
    enabled: pageSymbols.length > 0,
    staleTime: 1000 * 60 * 15,
    placeholderData: keepPreviousData,
  })
  const returnsUnavailable = pageReturnsData?.source === 'none'

  const rows: Row[] = pageEntries.map((e) => {
    const pq = pageQuoteData?.quotes?.[e.symbol.toUpperCase()]
    const r = pageReturnsData?.returns?.[e.symbol.toUpperCase()]
    const l = liveBySymbol.get(e.symbol)!
    return {
      ...e,
      ...(l.livePrice == null && pq && !pq.reference ? liveFiguresOf(e, pq) : l),
      ytdPct: r?.ytd ?? null,
      y1Pct: r?.y1 ?? null,
      returnsAdjusted: r?.adjusted,
    }
  })

  // Universe-level KPIs + page breadth from the live quotes we do have
  const sectorsCovered = useMemo(() => new Set(universe.map((e) => e.sector)).size, [universe])
  const largest = useMemo(() => {
    let best: UniverseEntry | undefined
    let bestCap = 0
    for (const e of universe) {
      const cap = liveBySymbol.get(e.symbol)?.liveMarketCap ?? 0
      if (cap > bestCap) { best = e; bestCap = cap }
    }
    return best
  }, [universe, liveBySymbol])
  const pageWithChange = rows.filter((r) => r.changePercent != null)
  const advancers = pageWithChange.filter((r) => (r.changePercent ?? 0) > 0).length
  const decliners = pageWithChange.filter((r) => (r.changePercent ?? 0) < 0).length

  const anyFilter = !!(search || minMcapB || maxMcapB || minPe || maxPe || minYield || maxYield || minPrice || maxPrice || payersOnly || sector !== 'all')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a)
    else { setSortKey(key); setSortAsc(key === 'symbol' || key === 'sector') }
  }

  return (
    <div className="space-y-6 max-w-(--breakpoint-2xl) mx-auto">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Stock Registry"
          subtitle={configured
            ? `${universe.length.toLocaleString()} equities across ${sectorsCovered} sectors · refreshed daily`
            : `${universe.length} curated equities · add an FMP key for the full daily universe`}
          icon={<LineChart size={20} aria-hidden />}
          description="The universe is sourced daily from Financial Modeling Prep (all actively-traded common stocks, sector-tagged) and cached for 24h; live quotes for the visible page ladder through the configured providers. Every quote provider needs an API key. Without one, the universe falls back to a curated large-cap list, and prices and every figure worked out from them show a dash."
        />
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbol or name…"
              className="w-64 rounded-sm border border-border bg-bg-elevated pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue/50 focus:outline-hidden"
            />
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border bg-bg-elevated text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : undefined} aria-hidden /> Refresh
          </button>
        </div>
      </div>

      {/* Data provenance */}
      <SourceLine id="stock-universe" />

      {/* Not-configured notice */}
      {universeData && !configured && (
        <div className="flex items-start gap-2.5 rounded-card border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <KeyRound size={16} className="text-amber-400/70 mt-0.5 shrink-0" aria-hidden />
          <p className="text-xs text-text-secondary leading-relaxed">
            Showing the curated large-cap list.{' '}
            {universeData.error?.includes('paid')
              ? <>The full daily-refreshed universe (thousands of stocks) comes from FMP’s stock-screener endpoint, which requires a <span className="text-text-primary">paid FMP plan</span>. Your free key still powers per-stock quotes, profiles, charts, and earnings — and any ticker resolves on its detail page.</>
              : <>Add a Financial Modeling Prep key in <Link href="/settings" className="text-accent-blue hover:underline">Settings → Integrations → Equity Market Data</Link>. Note: the broad universe list needs FMP’s <span className="text-text-primary">paid</span> screener endpoint; a free key still powers per-stock data.</>}
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Universe" loading={uniLoading} value={universe.length.toLocaleString()}
          subtitle={configured ? 'live via FMP · daily' : 'curated fallback'} accentColor="#3b82f6" />
        <MetricCard title="Matches" loading={uniLoading} value={filtered.length.toLocaleString()}
          subtitle={anyFilter ? 'after filters' : 'no filters applied'} accentColor="#8b5cf6" />
        <MetricCard title="Sectors" loading={uniLoading} value={String(sectorsCovered)}
          subtitle="represented in the universe" accentColor="#14b8a6" />
        <MetricCard title="Largest" loading={uniLoading} value={largest ? largest.symbol : '—'}
          subtitle={largest ? largest.name : '—'} accentColor="#10b981" />
      </div>

      {/* AI outlier scan */}
      <OutlierScanPanel />

      {/* Sector filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSector('all')}
          className={clsx('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
            sector === 'all' ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/30'
              : 'text-text-muted border-border hover:text-text-secondary hover:bg-bg-elevated')}
        >
          All Sectors
        </button>
        {(Object.entries(SECTOR_INFO) as Array<[SectorId, { label: string; color: string }]>).map(([id, info]) => (
          <button
            key={id}
            onClick={() => setSector(sector === id ? 'all' : id)}
            className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
              sector === id ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/30'
                : 'text-text-muted border-border hover:text-text-secondary hover:bg-bg-elevated')}
          >
            <span className="size-1.5 rounded-full" style={{ backgroundColor: info.color }} aria-hidden />
            {info.label}
          </button>
        ))}
      </div>

      {/* Screener — range filters */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-border bg-bg-card px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Screener</span>
        <RangeFilter label="Mkt cap $B" min={minMcapB} max={maxMcapB} setMin={setMinMcapB} setMax={setMaxMcapB} />
        <RangeFilter label="P/E" min={minPe} max={maxPe} setMin={setMinPe} setMax={setMaxPe} />
        <RangeFilter label="Price $" min={minPrice} max={maxPrice} setMin={setMinPrice} setMax={setMaxPrice} />
        <RangeFilter label="Yield %" min={minYield} max={maxYield} setMin={setMinYield} setMax={setMaxYield} />
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          <input type="checkbox" checked={payersOnly} onChange={(e) => setPayersOnly(e.target.checked)} className="rounded-sm border-border" />
          Dividend payers only
        </label>
        {anyFilter && (
          <button
            onClick={() => { setMinMcapB(''); setMaxMcapB(''); setMinPe(''); setMaxPe(''); setMinYield(''); setMaxYield(''); setMinPrice(''); setMaxPrice(''); setPayersOnly(false); setSearch(''); setSector('all') }}
            className="text-xs text-accent-blue hover:underline"
          >
            Clear all
          </button>
        )}
        <span className="ml-auto text-[11px] text-text-muted">{filtered.length.toLocaleString()} match{filtered.length !== 1 ? 'es' : ''}</span>
      </div>

      {/* Table */}
      <div className="rounded-card border border-border bg-bg-card overflow-hidden">
        <div className={clsx(COLS, 'py-2.5 border-b border-border bg-bg-elevated/40')}>
          <SortHeader label="Company" colKey="symbol" align="start" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
          <SortHeader label="Sector" colKey="sector" align="start" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
          <SortHeader label="Price" colKey="price" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
          <span className="text-xs font-medium uppercase tracking-wider text-text-muted text-right">Chg %</span>
          <SortHeader label="Mkt Cap" colKey="marketCap" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
          <SortHeader label="P/E" colKey="pe" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
          <SortHeader label="Yield" colKey="dividend" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
          <span
            className="text-xs font-medium uppercase tracking-wider text-text-muted text-right"
            title="Year-to-date total return for the visible page. Not sortable or screenable: returns are fetched per page, so a sort would order fifty rows as though it had seen every one."
          >YTD</span>
          <span
            className="text-xs font-medium uppercase tracking-wider text-text-muted text-right"
            title="Trailing one-year return for the visible page. Not sortable or screenable, for the same reason as YTD."
          >1Y</span>
        </div>

        <div className="divide-y divide-border/60">
          {uniLoading && universe.length === 0
            ? Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="h-12 animate-shimmer bg-shimmer-gradient bg-size-[200%_100%]" />
              ))
            : rows.map((row) => {
                const info = SECTOR_INFO[row.sector]
                const change = row.changePercent
                return (
                  <Link
                    key={row.symbol}
                    href={`/equities/${row.symbol.toLowerCase()}`}
                    className={clsx(COLS, 'py-2.5 text-sm items-center hover:bg-bg-elevated/40 transition-colors')}
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-semibold text-text-primary">{row.symbol}</span>
                      <span className="ml-2 text-xs text-text-muted truncate">{row.name}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-medium border border-border text-text-secondary truncate">
                        <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: info.color }} aria-hidden />
                        <span className="truncate">{info.label}</span>
                      </span>
                    </div>
                    <div className={clsx('text-right font-mono tabular-nums', row.livePrice == null ? 'text-text-muted' : 'text-text-primary')}
                      title={row.livePrice == null ? 'No live quote: no stored price is shown in its place' : undefined}>
                      {row.livePrice == null ? '—' : formatCurrency(row.livePrice)}
                    </div>
                    <div className={clsx('text-right font-mono tabular-nums text-xs',
                      change == null ? 'text-text-muted' : change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {change == null ? '—' : formatPercent(change, 2)}
                    </div>
                    <div className="text-right font-mono tabular-nums text-text-secondary"
                      title={marketCapText(row.shares, row.livePrice).explain}>
                      {row.liveMarketCap == null ? '—' : formatCompact(row.liveMarketCap)}
                    </div>
                    {(() => {
                      // A link to the company's SEC filings beside each figure (D167). Nested in
                      // the row link, so stopPropagation keeps the click from opening the row.
                      const link = stockFiguresLink(row.symbol)
                      const pe = peText(row.figures)
                      const yld = yieldText(row.figures)
                      const icon = (what: string) => (
                        <a href={link.href} target="_blank" rel="noopener noreferrer" title={link.title}
                          aria-label={`${row.symbol} ${what}: ${link.text}`} onClick={(e) => e.stopPropagation()}
                          className="ml-1 inline-flex align-middle text-accent-blue hover:text-accent-blue/80">
                          <ExternalLink size={10} aria-hidden />
                        </a>
                      )
                      return (
                        <>
                          <div className="text-right font-mono tabular-nums text-xs text-text-secondary">
                            <span title={pe.explain}>{pe.value}</span>{icon('P/E')}
                          </div>
                          <div className="text-right font-mono tabular-nums text-xs text-text-secondary">
                            <span title={yld.explain}>{yld.value}</span>{icon('dividend yield')}
                          </div>
                        </>
                      )
                    })()}
                    <ReturnCell value={row.ytdPct} adjusted={row.returnsAdjusted} />
                    <ReturnCell value={row.y1Pct} adjusted={row.returnsAdjusted} />
                  </Link>
                )
              })}
          {!uniLoading && filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-text-muted">No equities match the current filters.</p>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-t border-border bg-bg-elevated/40">
            <span className="text-[11px] text-text-muted">
              {(safePage * PAGE_SIZE + 1).toLocaleString()}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="flex items-center gap-1 px-2 py-1 rounded-sm border border-border text-xs text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft size={13} aria-hidden /> Prev
              </button>
              <span className="text-[11px] text-text-muted tabular-nums">Page {safePage + 1} / {totalPages.toLocaleString()}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className="flex items-center gap-1 px-2 py-1 rounded-sm border border-border text-xs text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                Next <ChevronRight size={13} aria-hidden />
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-text-muted text-center">
        {configured ? 'Universe live via Financial Modeling Prep · refreshed daily' : 'Curated fallback universe'}
        {quoteData?.updatedAt && ` · quotes updated ${new Date(quoteData.updatedAt).toLocaleTimeString()}`}
        {' · '}P/E &amp; yield are worked out from each company&rsquo;s SEC annual report against the live price, linked beside each;
        market cap is SEC shares outstanding &times; the live price; no live quote, no figure
        {universe.length > QUOTE_ALL_UP_TO && ` · screens and sorts cover the ${QUOTE_ALL_UP_TO} largest stocks`}
        {' · '}beta is on each stock&rsquo;s page
        {' · '}YTD/1Y returns cover the visible page only and are not sortable or screenable
        {returnsUnavailable && (
          <span className="text-amber-400">
            {' · '}returns need a Tiingo or FMP key — showing dashes rather than a figure we cannot source
          </span>
        )}
      </p>
    </div>
  )
}

/** A stock's figures against its live quote, or none without one (D170). */
function liveFiguresOf(e: UniverseEntry, q: { price: number | null; changePercent: number | null } | undefined): LiveFigures {
  const livePrice = q?.price != null && q.price > 0 ? q.price : null
  return {
    livePrice,
    figures: stockFigures(perShareFromFields(e), livePrice),
    changePercent: livePrice != null ? q?.changePercent ?? null : null,
    liveMarketCap: marketCapUsd(e.shares, livePrice),
  }
}

// ─── Small inputs ─────────────────────────────────────────────────────────────

function NumInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-16 rounded-sm border border-border bg-bg-elevated px-2 py-1 text-xs font-mono text-text-primary placeholder:text-text-muted/60 focus:border-accent-blue/50 focus:outline-hidden"
    />
  )
}

function RangeFilter({ label, min, max, setMin, setMax }: { label: string; min: string; max: string; setMin: (v: string) => void; setMax: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-text-muted">
      {label}
      <NumInput value={min} onChange={setMin} placeholder="min" />
      <span className="text-text-muted/50">–</span>
      <NumInput value={max} onChange={setMax} placeholder="max" />
    </label>
  )
}
