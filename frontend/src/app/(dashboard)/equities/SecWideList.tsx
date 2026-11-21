'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink, Info, Layers, RefreshCw, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { SourceLine } from '@/components/ui/SourceLine'
import { MetricCard } from '@/components/ui/MetricCard'
import { peText, perShareFromFields, stockFigures, stockFiguresLink, yieldText } from '@/lib/data/stockPerShare'
import { marketCapText, marketCapUsd, outsideShareBand } from '@/lib/data/stockShares'
import {
  LEFT_OUT_LABELS, NO_WIDE_FILTERS, WHOLE_LIST_PRICE_REFUSAL, filterWide, isWideSortKey, sortWide,
  type LeftOutReason, type ListedExchange, type WideSortKey,
} from '@/lib/data/secListings'
import { formatCompact, formatCompactNumber, formatCurrency, formatPercent } from '@/lib/utils/format'
import { STALE_TIME_SHORT } from '@/lib/constants'
import { useScreenerUrl } from '@/lib/hooks/useScreenerUrl'
import type { StockUniverseResponse, UniverseEntry } from '@/app/live-data/stock-universe/route'
import type { SecurityQuotesResponse } from '@/app/live-data/security-quotes/route'

// The Stock Registry's wider list (T-450, D205): every NYSE and Nasdaq common stock the SEC
// names, keyless. Screens and sorts run over the SEC figures for every stock; price, market
// cap, P/E and yield are worked out against a live quote for the fifty rows on screen and are
// never sorted or screened over the whole list. The rules are in lib/data/secListings.ts.

const PAGE_SIZE = 50

// Company · Exch · EPS · Div/sh · Shares · Price · Chg% · Mkt Cap · P/E · Yield
const COLS = 'grid grid-cols-[minmax(0,2.6fr)_0.7fr_0.9fr_0.8fr_0.9fr_0.9fr_0.7fr_0.9fr_0.7fr_0.7fr] gap-2 px-4'

/** Every URL key this list writes, so it can take them out of the link when the list closes. */
const URL_DEFAULTS = {
  wq: '', wexch: 'all', wepsMin: '', wepsMax: '', wdpsMin: '', wdpsMax: '', wshMin: '', wshMax: '',
  wpayers: '', wearn: '', wsort: 'list', wdir: 'asc',
}

const SORT_TITLES: Record<WideSortKey, string> = {
  list: 'The order of the SEC’s own file',
  symbol: 'By ticker',
  eps: 'By earnings per share for the latest fiscal year; stocks with no figure come last',
  dps: 'By dividends per share for that year (none counts as 0); stocks with no figure come last',
  shares: 'By shares outstanding on the latest SEC cover page; stocks with no figure come last',
}

const SPLIT_TITLE =
  'The share count has changed by a split’s worth since this fiscal year, so this figure is in the old shares. P/E and yield are not worked out until the next annual report.'
const NO_EPS_TITLE =
  'The SEC’s structured data has no earnings-per-share figure this app can use for this company. Companies reporting under international accounting standards, most foreign ones, have none.'
const CLASSES_TITLE = (n: number) =>
  `One of ${n} listed share classes of this company. Its SEC per-share figures are the company’s own and may be stated for one class only; check its filings.`

function SortHeader({ label, colKey, sortKey, sortAsc, onToggle, align = 'end' }: {
  label: string
  colKey: WideSortKey
  sortKey: WideSortKey
  sortAsc: boolean
  onToggle: (k: WideSortKey) => void
  align?: 'start' | 'end'
}) {
  return (
    <button
      onClick={() => onToggle(colKey)}
      title={SORT_TITLES[colKey]}
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

/** A price-based column: labelled, never sortable over the whole list. */
function OnScreenHeader({ label }: { label: string }) {
  return (
    <span className="text-xs font-medium uppercase tracking-wider text-text-muted text-right" title={WHOLE_LIST_PRICE_REFUSAL}>
      {label}
    </span>
  )
}

function NumInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <input
      type="number"
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-16 rounded-sm border border-border bg-bg-elevated px-2 py-1 text-xs font-mono text-text-primary placeholder:text-text-muted/60 focus:border-accent-blue/50 focus:outline-hidden"
    />
  )
}

function RangeFilter({ label, min, max, setMin, setMax, title }: { label: string; min: string; max: string; setMin: (v: string) => void; setMax: (v: string) => void; title?: string }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-text-muted" title={title}>
      {label}
      <NumInput value={min} onChange={setMin} placeholder="min" label={`${label} minimum`} />
      <span className="text-text-muted/50">–</span>
      <NumInput value={max} onChange={setMax} placeholder="max" label={`${label} maximum`} />
    </label>
  )
}

const num = (s: string): number => (s.trim() === '' ? NaN : parseFloat(s))

export function SecWideList({ modeSwitch }: { modeSwitch: ReactNode }) {
  const [query, setQuery] = useState('')
  const [exchange, setExchange] = useState<'all' | ListedExchange>('all')
  const [epsMin, setEpsMin] = useState('')
  const [epsMax, setEpsMax] = useState('')
  const [dpsMin, setDpsMin] = useState('')
  const [dpsMax, setDpsMax] = useState('')
  const [sharesMin, setSharesMin] = useState('')
  const [sharesMax, setSharesMax] = useState('')
  const [payersOnly, setPayersOnly] = useState(false)
  const [withEarningsOnly, setWithEarningsOnly] = useState(false)
  const [sortKey, setSortKey] = useState<WideSortKey>('list')
  const [sortAsc, setSortAsc] = useState(true)
  const [pageState, setPageState] = useState<{ sig: string; page: number }>({ sig: '', page: 0 })

  useScreenerUrl(
    {
      wq: query, wexch: exchange, wepsMin: epsMin, wepsMax: epsMax, wdpsMin: dpsMin, wdpsMax: dpsMax,
      wshMin: sharesMin, wshMax: sharesMax, wpayers: payersOnly ? '1' : '', wearn: withEarningsOnly ? '1' : '',
      wsort: sortKey, wdir: sortAsc ? 'asc' : 'desc',
    },
    { wq: '', wexch: 'all', wepsMin: '', wepsMax: '', wdpsMin: '', wdpsMax: '', wshMin: '', wshMax: '', wpayers: '', wearn: '', wsort: 'list', wdir: 'asc' },
    (p) => {
      if (p.wq) setQuery(p.wq)
      if (p.wexch === 'NYSE' || p.wexch === 'Nasdaq') setExchange(p.wexch)
      if (p.wepsMin) setEpsMin(p.wepsMin)
      if (p.wepsMax) setEpsMax(p.wepsMax)
      if (p.wdpsMin) setDpsMin(p.wdpsMin)
      if (p.wdpsMax) setDpsMax(p.wdpsMax)
      if (p.wshMin) setSharesMin(p.wshMin)
      if (p.wshMax) setSharesMax(p.wshMax)
      if (p.wpayers === '1') setPayersOnly(true)
      if (p.wearn === '1') setWithEarningsOnly(true)
      if (p.wsort && isWideSortKey(p.wsort)) setSortKey(p.wsort)
      if (p.wdir) setSortAsc(p.wdir !== 'desc')
    },
  )

  // Leaving the wider list takes its filters out of the link, so they do not ride along on the
  // curated list's address.
  useEffect(() => () => {
    const sp = new URLSearchParams(window.location.search)
    for (const k of Object.keys(URL_DEFAULTS)) sp.delete(k)
    const qs = sp.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`)
  }, [])

  const { data, isLoading, isFetching, refetch } = useQuery<StockUniverseResponse>({
    queryKey: ['stock-universe', 'sec'],
    queryFn: () => fetch('/live-data/stock-universe?list=sec').then((r) => r.json()),
    staleTime: 1000 * 60 * 30,
  })
  const all = useMemo(() => data?.entries ?? [], [data])

  const filters = useMemo(() => ({
    ...NO_WIDE_FILTERS, query, exchange,
    epsMin: num(epsMin), epsMax: num(epsMax), dpsMin: num(dpsMin), dpsMax: num(dpsMax),
    sharesMinM: num(sharesMin), sharesMaxM: num(sharesMax), payersOnly, withEarningsOnly,
  }), [query, exchange, epsMin, epsMax, dpsMin, dpsMax, sharesMin, sharesMax, payersOnly, withEarningsOnly])
  const filtered = useMemo(() => sortWide(filterWide(all, filters), sortKey, sortAsc), [all, filters, sortKey, sortAsc])

  const filterSig = JSON.stringify([filters, sortKey, sortAsc])
  const page = pageState.sig === filterSig ? pageState.page : 0
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const setPage = (next: number) => setPageState({ sig: filterSig, page: next })
  const pageEntries = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const pageSymbols = pageEntries.map((e) => e.symbol)

  // Live quotes for the rows on screen only: the whole list would be thousands of keyed requests.
  const { data: quoteData } = useQuery<SecurityQuotesResponse>({
    queryKey: ['security-quotes', 'sec-page', pageSymbols.join(',')],
    queryFn: () => fetch(`/live-data/security-quotes?symbols=${encodeURIComponent(pageSymbols.join(','))}`).then((r) => r.json()),
    enabled: pageSymbols.length > 0,
    staleTime: STALE_TIME_SHORT,
    refetchInterval: 120_000,
    placeholderData: keepPreviousData,
  })

  const leftOut = data?.leftOut
  const leftOutTotal = leftOut ? Object.values(leftOut).reduce((s, n) => s + n, 0) : 0
  const withEps = useMemo(() => all.filter((e) => e.eps != null).length, [all])
  const byExchange = useMemo(() => {
    const out: Record<string, number> = {}
    for (const e of all) if (e.exchange) out[e.exchange] = (out[e.exchange] ?? 0) + 1
    return out
  }, [all])
  const listedOn = (data?.listedOn ?? ['NYSE', 'Nasdaq']).join(' and ')

  const anyFilter = !!(query || exchange !== 'all' || epsMin || epsMax || dpsMin || dpsMax || sharesMin || sharesMax || payersOnly || withEarningsOnly)
  const clearAll = () => {
    setQuery(''); setExchange('all'); setEpsMin(''); setEpsMax(''); setDpsMin(''); setDpsMax('')
    setSharesMin(''); setSharesMax(''); setPayersOnly(false); setWithEarningsOnly(false)
  }
  const toggleSort = (k: WideSortKey) => {
    if (sortKey === k) setSortAsc((a) => !a)
    else { setSortKey(k); setSortAsc(k === 'symbol' || k === 'list') }
  }

  return (
    <div className="space-y-6 max-w-(--breakpoint-2xl) mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Stock Registry"
          subtitle={data?.ok
            ? `${all.length.toLocaleString()} ${listedOn} stocks from the SEC’s list · refreshed daily`
            : `Every ${listedOn} stock the SEC lists`}
          icon={<Layers size={20} aria-hidden />}
          description="Every common stock the SEC lists on the NYSE or Nasdaq, with each company’s figures from its SEC annual report and latest filing cover. No API key needed. Screens and sorts on those figures cover every stock; price, market cap, P/E and yield need a live quote, so they appear for the stocks on screen and are not sorted or screened over the whole list."
        />
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbol or name…"
              aria-label="Search the wider list"
              className="w-56 sm:w-64 rounded-sm border border-border bg-bg-elevated pl-8 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue/50 focus:outline-hidden"
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

      <SourceLine id="stock-universe" />
      {modeSwitch}

      {data && !data.ok && (
        <div className="flex items-start gap-2.5 rounded-card border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-400/80 mt-0.5 shrink-0" aria-hidden />
          <p className="text-xs text-text-secondary leading-relaxed">
            The SEC’s list of listed companies could not be read just now{data.error ? ` (${data.error})` : ''}. The curated list still works; try again later.
          </p>
        </div>
      )}

      {/* What this list can and cannot do */}
      <div className="flex items-start gap-2.5 rounded-card border border-border bg-bg-card px-4 py-3">
        <Info size={15} className="text-accent-blue/70 mt-0.5 shrink-0" aria-hidden />
        <ul className="text-xs text-text-secondary leading-relaxed space-y-1">
          <li>
            Earnings and dividends per share, and shares outstanding, come from each company’s SEC filings and are screened and sorted over every stock.
          </li>
          <li>
            Price, market cap, P/E and yield need a live quote, so they appear only for the {PAGE_SIZE} stocks on screen and are never sorted or screened over the whole list.
          </li>
          <li>
            A sector is known only for the 79 curated stocks: the SEC’s industry code takes one request per company. The sector filter is on the curated list.
          </li>
          {leftOut && leftOutTotal > 0 && (
            <li>
              Left out of the SEC’s file: {(Object.entries(leftOut) as Array<[LeftOutReason, number]>)
                .filter(([, n]) => n > 0)
                .map(([r, n]) => `${n.toLocaleString()} ${LEFT_OUT_LABELS[r]}`)
                .join(' · ')}. A few closed-end funds and trusts that file like companies may remain.
            </li>
          )}
        </ul>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Listed stocks" loading={isLoading} value={all.length.toLocaleString()}
          subtitle={Object.entries(byExchange).map(([x, n]) => `${x} ${n.toLocaleString()}`).join(' · ') || '—'} accentColor="#3b82f6" />
        <MetricCard title="Matches" loading={isLoading} value={filtered.length.toLocaleString()}
          subtitle={anyFilter ? 'after filters' : 'no filters applied'} accentColor="#8b5cf6" />
        <MetricCard title="With earnings figure" loading={isLoading} value={withEps.toLocaleString()}
          subtitle="from the SEC’s annual data" accentColor="#14b8a6" />
        <MetricCard title="Left out" loading={isLoading} value={leftOut ? leftOutTotal.toLocaleString() : '—'}
          subtitle="other exchanges, preferred shares, funds" accentColor="#94a3b8" />
      </div>

      {/* Screener: SEC figures only */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-border bg-bg-card px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Screener</span>
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          Exchange
          <select
            value={exchange}
            onChange={(e) => setExchange(e.target.value as 'all' | ListedExchange)}
            className="rounded-sm border border-border bg-bg-elevated px-2 py-1 text-xs text-text-primary focus:border-accent-blue/50 focus:outline-hidden"
          >
            <option value="all">All</option>
            <option value="NYSE">NYSE</option>
            <option value="Nasdaq">Nasdaq</option>
          </select>
        </label>
        <RangeFilter label="EPS $" min={epsMin} max={epsMax} setMin={setEpsMin} setMax={setEpsMax}
          title="Earnings per share for the latest fiscal year, from the SEC’s annual data" />
        <RangeFilter label="Div/share $" min={dpsMin} max={dpsMax} setMin={setDpsMin} setMax={setDpsMax}
          title="Dividends per share for that fiscal year; a company paying none counts as 0, one with no figure is left out by any bound" />
        <RangeFilter label="Shares (M)" min={sharesMin} max={sharesMax} setMin={setSharesMin} setMax={setSharesMax}
          title="Shares outstanding on the latest SEC cover page, in millions" />
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          <input type="checkbox" checked={withEarningsOnly} onChange={(e) => setWithEarningsOnly(e.target.checked)} className="rounded-sm border-border" />
          With an earnings figure
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          <input type="checkbox" checked={payersOnly} onChange={(e) => setPayersOnly(e.target.checked)} className="rounded-sm border-border" />
          Dividend payers only
        </label>
        {anyFilter && <button onClick={clearAll} className="text-xs text-accent-blue hover:underline">Clear all</button>}
        <span className="ml-auto text-[11px] text-text-muted">{filtered.length.toLocaleString()} match{filtered.length !== 1 ? 'es' : ''}</span>
      </div>

      {/* Table */}
      <div className="rounded-card border border-border bg-bg-card overflow-x-auto">
        <div className="min-w-[960px]">
          <div className={clsx(COLS, 'py-2.5 border-b border-border bg-bg-elevated/40')}>
            <SortHeader label="Company" colKey="symbol" align="start" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
            <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Exch</span>
            <SortHeader label="EPS (FY)" colKey="eps" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
            <SortHeader label="Div/sh" colKey="dps" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
            <SortHeader label="Shares" colKey="shares" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
            <OnScreenHeader label="Price" />
            <OnScreenHeader label="Chg %" />
            <OnScreenHeader label="Mkt Cap" />
            <OnScreenHeader label="P/E" />
            <OnScreenHeader label="Yield" />
          </div>

          <div className="divide-y divide-border/60">
            {isLoading && all.length === 0
              ? Array.from({ length: 12 }, (_, i) => <div key={i} className="h-12 animate-shimmer bg-shimmer-gradient bg-size-[200%_100%]" />)
              : pageEntries.map((row) => <WideRowView key={row.symbol} row={row} quotes={quoteData} />)}
            {!isLoading && data?.ok && filtered.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-text-muted">No stocks match the current filters.</p>
            )}
          </div>
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-t border-border bg-bg-elevated/40">
            <span className="text-[11px] text-text-muted">
              {(safePage * PAGE_SIZE + 1).toLocaleString()}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, safePage - 1))}
                disabled={safePage === 0}
                className="flex items-center gap-1 px-2 py-1 rounded-sm border border-border text-xs text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft size={13} aria-hidden /> Prev
              </button>
              <span className="text-[11px] text-text-muted tabular-nums">Page {safePage + 1} / {totalPages.toLocaleString()}</span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
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
        From the SEC’s list of companies, tickers and exchanges, refreshed daily
        {sortKey === 'list' ? ' · in the order the SEC’s file gives' : ''}
        {' · '}per-share figures and share counts from the SEC’s structured filing data
        {' · '}P/E, yield and market cap worked out against the live price for the stocks on screen, linked to each company’s filings
        {quoteData?.updatedAt && ` · quotes updated ${new Date(quoteData.updatedAt).toLocaleTimeString()}`}
      </p>
    </div>
  )
}

/** One row: the SEC figures always; the price-based figures only against a live quote. */
function WideRowView({ row, quotes }: { row: UniverseEntry; quotes: SecurityQuotesResponse | undefined }) {
  const q = quotes?.quotes?.[row.symbol.toUpperCase()]
  const livePrice = q && !q.reference && q.price != null && q.price > 0 ? q.price : null
  const change = livePrice != null ? q?.changePercent ?? null : null
  const figures = stockFigures(perShareFromFields(row), livePrice)
  const cap = marketCapUsd(row.shares, livePrice)
  const pe = peText(figures)
  const yld = yieldText(figures)
  const link = stockFiguresLink(row.symbol)
  const split = outsideShareBand(row.shareChange)
  const fy = row.perShareAsOf ? `the fiscal year ending ${row.perShareAsOf}` : 'the latest fiscal year'
  const icon = (what: string) => (
    <a href={link.href} target="_blank" rel="noopener noreferrer" title={link.title}
      aria-label={`${row.symbol} ${what}: ${link.text}`} onClick={(e) => e.stopPropagation()}
      className="ml-1 inline-flex align-middle text-accent-blue hover:text-accent-blue/80">
      <ExternalLink size={10} aria-hidden />
    </a>
  )
  return (
    <Link href={`/equities/${row.symbol.toLowerCase()}`} className={clsx(COLS, 'py-2.5 text-sm items-center hover:bg-bg-elevated/40 transition-colors')}>
      <div className="min-w-0 flex items-center gap-2">
        <span className="font-mono font-semibold text-text-primary">{row.symbol}</span>
        <span className="text-xs text-text-muted truncate">{row.name}</span>
        {(row.shareClasses ?? 1) > 1 && (
          <span className="shrink-0 rounded-sm border border-border px-1 text-[10px] text-text-muted" title={CLASSES_TITLE(row.shareClasses!)}>
            {row.shareClasses} classes
          </span>
        )}
      </div>
      <div className="text-xs text-text-secondary">{row.exchange ?? '—'}</div>
      <div className="text-right font-mono tabular-nums text-xs text-text-secondary">
        {row.eps == null
          ? <span className="text-text-muted" title={NO_EPS_TITLE}>—</span>
          : <span title={`${row.epsBasis === 'basic' ? 'Basic' : 'Diluted'} earnings per share for ${fy}, from the SEC’s annual data`}>{formatCurrency(row.eps)}</span>}
        {split && row.eps != null && (
          <span className="ml-0.5 align-super text-[9px] font-semibold text-amber-400" title={SPLIT_TITLE}>split</span>
        )}
      </div>
      <div className="text-right font-mono tabular-nums text-xs text-text-secondary">
        {row.dividendState === 'paid' && row.dividendsPerShare != null
          ? <span title={`Dividends per share for ${fy}, from the SEC’s annual data`}>{formatCurrency(row.dividendsPerShare)}</span>
          : row.dividendState === 'none'
            ? <span className="text-text-muted" title={`No dividend for ${fy}`}>none</span>
            : <span className="text-text-muted" title="No dividend-per-share figure in the SEC’s structured data for this company’s latest annual report">—</span>}
      </div>
      <div className="text-right font-mono tabular-nums text-xs text-text-secondary"
        title={row.shares ? `${row.shares.val.toLocaleString('en-US')} shares outstanding as of ${row.shares.end}, from the cover of the company’s latest SEC filing` : 'No single share count in the SEC’s structured data, as for a company with more than one class of stock'}>
        {row.shares ? formatCompactNumber(row.shares.val) : '—'}
      </div>
      <div className={clsx('text-right font-mono tabular-nums', livePrice == null ? 'text-text-muted' : 'text-text-primary')}
        title={livePrice == null ? 'No live quote: every quote provider needs an API key, and no stored price is shown in its place' : undefined}>
        {livePrice == null ? '—' : formatCurrency(livePrice)}
      </div>
      <div className={clsx('text-right font-mono tabular-nums text-xs',
        change == null ? 'text-text-muted' : change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
        {change == null ? '—' : formatPercent(change, 2)}
      </div>
      <div className="text-right font-mono tabular-nums text-xs text-text-secondary" title={marketCapText(row.shares, livePrice).explain}>
        {cap == null ? '—' : formatCompact(cap)}
      </div>
      <div className="text-right font-mono tabular-nums text-xs text-text-secondary">
        <span title={pe.explain}>{pe.value}</span>{icon('P/E')}
      </div>
      <div className="text-right font-mono tabular-nums text-xs text-text-secondary">
        <span title={yld.explain}>{yld.value}</span>{icon('dividend yield')}
      </div>
    </Link>
  )
}
