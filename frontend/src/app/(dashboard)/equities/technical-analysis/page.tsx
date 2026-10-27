'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useQuery, useQueries } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, Activity,
  CandlestickChart as CandlestickIcon, AreaChart as AreaIcon, BarChart2,
  LineChart as LineIcon, Layers, GitBranch,
  Loader2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { ModuleGate } from '@/components/layout/ModuleGate'
import { PageHeader } from '@/components/ui/PageHeader'
import { SourceLine } from '@/components/ui/SourceLine'
import { LiveUnavailable } from '@/components/ui/LiveUnavailable'
import type { ChartType, DrawingTool, Drawing } from '@/components/charts/CandlestickChart'
import { ALL_INDICATORS } from '@/components/charts/indicatorRegistry'
import { IndicatorPicker } from '@/components/charts/IndicatorPicker'
import { DrawingToolbar } from '@/components/charts/DrawingToolbar'
import type { LucideIcon } from 'lucide-react'
import {
  computeSignalSummary, detectPatterns,
  type Signal, type DetectedPattern,
} from '@/lib/utils/indicators'
import { EQUITY_CATALOG, SECTOR_INFO } from '@/lib/data/equityCatalog'
import type { SecurityOhlcvResponse } from '@/app/live-data/security-ohlcv/route'
import { SymbolSearch } from '@/components/markets/SymbolSearch'

const CandlestickChart = dynamic(() => import('@/components/charts/CandlestickChart'), { ssr: false })

// Equities counterpart of the crypto Technical Analysis page. Reuses the
// shared CandlestickChart, indicator registry, signal engine, and pattern
// detector — fed by /live-data/security-ohlcv instead of the crypto route.

// Daily bars only, starting at 1M. The crypto surface offers 1H/4H on purpose
// and this one does not: equities trade a ~6.5h session, so an intraday series
// is dominated by open/close effects and overnight gaps rather than trend. Not
// an oversight — see the note on the crypto page's RANGES.
const RANGES = ['1M', '3M', '6M', '1Y', '5Y', 'MAX'] as const
type Range = typeof RANGES[number]

const CHART_TYPES: { type: ChartType; label: string; Icon: LucideIcon }[] = [
  { type: 'candlestick', label: 'Candlestick', Icon: CandlestickIcon },
  { type: 'hollow',      label: 'Hollow',      Icon: CandlestickIcon },
  { type: 'heikin-ashi', label: 'Heikin Ashi', Icon: Activity },
  { type: 'bars',        label: 'OHLC Bars',   Icon: BarChart2 },
  { type: 'line',        label: 'Line',        Icon: LineIcon },
  { type: 'step-line',   label: 'Step Line',   Icon: GitBranch },
  { type: 'area',        label: 'Area',        Icon: AreaIcon },
  { type: 'baseline',    label: 'Baseline',    Icon: Layers },
]

// Indicators and drawing tools come from the shared TA engine, not a private
// list. This page used to declare 18 of the 62 the engine can render and 5 of
// the 6 drawing tools — not by decision, but because three pages each kept
// their own copy and only crypto's was ever extended.
//
// Stocks and ETFs carry real volume, so the full set applies here.
const SIGNAL_STYLES: Record<Signal, { label: string; color: string; Icon: LucideIcon }> = {
  strong_buy:  { label: 'Strong Buy',  color: 'text-emerald-400', Icon: TrendingUp },
  buy:         { label: 'Buy',         color: 'text-emerald-400', Icon: TrendingUp },
  neutral:     { label: 'Neutral',     color: 'text-slate-400',   Icon: Minus },
  sell:        { label: 'Sell',        color: 'text-red-400',     Icon: TrendingDown },
  strong_sell: { label: 'Strong Sell', color: 'text-red-400',     Icon: TrendingDown },
}


function useOhlcv(symbol: string, range: Range, enabled = true) {
  return useQuery<SecurityOhlcvResponse>({
    queryKey: ['security-ohlcv', symbol, range],
    queryFn: () => fetch(`/live-data/security-ohlcv?symbol=${encodeURIComponent(symbol)}&range=${range}`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    enabled,
  })
}

// ─── Chart tab ────────────────────────────────────────────────────────────────

function ChartTab() {
  const [symbol, setSymbol] = useState('AAPL')
  const [range, setRange] = useState<Range>('1Y')
  const [chartType, setChartType] = useState<ChartType>('candlestick')
  const [active, setActive] = useState<Set<string>>(new Set(['ema20', 'ema50', 'rsi', 'macd']))
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('none')
  const [drawings, setDrawings] = useState<Drawing[]>([])

  const { data, isLoading, isFetching, refetch } = useOhlcv(symbol, range)
  const candles = useMemo(() => data?.candles ?? [], [data])

  const summary = useMemo(() => candles.length >= 30 ? computeSignalSummary(candles) : null, [candles])
  const patterns: DetectedPattern[] = useMemo(() => candles.length >= 30 ? detectPatterns(candles) : [], [candles])

  const entry = EQUITY_CATALOG.find((e) => e.symbol === symbol)

  const toggleIndicator = (key: string) => {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        <SymbolSearch symbol={symbol} onSelect={(s) => { setSymbol(s); setDrawings([]) }} />
        {entry && <span className="text-xs text-text-muted hidden md:inline">{entry.name}</span>}

        <div className="flex items-center gap-0.5 bg-bg-elevated border border-border rounded-sm p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={clsx('px-2 py-1 rounded-sm text-[11px] font-mono font-medium transition-colors',
                range === r ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-muted hover:text-text-secondary')}
            >
              {r}
            </button>
          ))}
        </div>

        <select
          value={chartType}
          onChange={(e) => setChartType(e.target.value as ChartType)}
          className="bg-bg-secondary border border-border rounded-sm px-2 py-1.5 text-xs text-text-secondary focus:outline-hidden focus:border-accent-blue/60"
        >
          {CHART_TYPES.map(({ type, label }) => (
            <option key={type} value={type}>{label}</option>
          ))}
        </select>

        <button
          onClick={() => refetch()}
          className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-border bg-bg-elevated text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : undefined} aria-hidden /> Refresh
        </button>
      </div>

      {/* Indicators */}
      <IndicatorPicker
        indicators={ALL_INDICATORS}
        active={active}
        onToggle={toggleIndicator}
        onClearAll={() => setActive(new Set())}
      />

      {/* Drawing toolbar — its own row directly above the chart, matching the
          crypto and macro surfaces. It used to sit up in the controls row beside
          the symbol picker, so the same control lived in two different places
          depending on which asset class you were looking at. */}
      <DrawingToolbar
        active={drawingTool}
        onChange={setDrawingTool}
        drawings={drawings}
        onClear={() => setDrawings([])}
      />

      {/* Chart + sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3 rounded-card border border-border bg-bg-card p-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-[520px] gap-2 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading {symbol} history…</span>
            </div>
          ) : candles.length > 0 ? (
            // Explicit height, same as the crypto TA page: CandlestickChart's
            // root is h-full, so without this the chart only got height when
            // the xl grid row happened to be stretched by the sidebar column —
            // and collapsed to nothing in single-column layouts.
            <div className="h-[520px]">
              <CandlestickChart
                candles={candles}
                activeIndicators={active}
                chartType={chartType}
                drawingTool={drawingTool}
                drawings={drawings}
                onDrawingComplete={(d: Drawing) => { setDrawings((prev) => [...prev, d]); setDrawingTool('none') }}
                patterns={patterns}
              />
            </div>
          ) : (
            <LiveUnavailable
              reason="needs-api-key"
              className="my-12"
              message="No OHLCV source is reachable. Candles now need an API key — the keyless source was withdrawn on terms grounds. Add a Tiingo or FMP key on the Integrations page."
            />
          )}
        </div>

        {/* Sidebar: signal summary + patterns */}
        <div className="space-y-4">
          <div className="rounded-card border border-border bg-bg-card p-4">
            <h2 className="text-sm font-medium text-text-secondary mb-3">Signal Summary</h2>
            {summary ? (
              <>
                {(() => {
                  const cfg = SIGNAL_STYLES[summary.overall]
                  return (
                    <div className="flex items-center gap-2 mb-3">
                      <cfg.Icon size={18} className={cfg.color} aria-hidden />
                      <span className={clsx('text-lg font-semibold', cfg.color)}>{cfg.label}</span>
                    </div>
                  )
                })()}
                <div className="flex gap-2 text-center text-xs mb-3">
                  <div className="flex-1 rounded-sm bg-emerald-500/10 border border-emerald-500/20 py-1.5">
                    <div className="font-mono font-bold text-emerald-400">{summary.buy}</div>
                    <div className="text-text-muted text-[10px]">Buy</div>
                  </div>
                  <div className="flex-1 rounded-sm bg-slate-500/10 border border-slate-500/20 py-1.5">
                    <div className="font-mono font-bold text-slate-300">{summary.neutral}</div>
                    <div className="text-text-muted text-[10px]">Neutral</div>
                  </div>
                  <div className="flex-1 rounded-sm bg-red-500/10 border border-red-500/20 py-1.5">
                    <div className="font-mono font-bold text-red-400">{summary.sell}</div>
                    <div className="text-text-muted text-[10px]">Sell</div>
                  </div>
                </div>
                <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {summary.signals.map((sig) => {
                    const cfg = SIGNAL_STYLES[sig.signal]
                    return (
                      <li key={sig.name} className="flex items-center justify-between text-xs">
                        <span className="text-text-muted">{sig.name}</span>
                        <span className={clsx('font-medium', cfg.color)}>{cfg.label}</span>
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : (
              <p className="text-xs text-text-muted">Needs at least 30 candles of history.</p>
            )}
          </div>

          <div className="rounded-card border border-border bg-bg-card p-4">
            <h2 className="text-sm font-medium text-text-secondary mb-3">Detected Patterns</h2>
            {patterns.length > 0 ? (
              <ul className="space-y-2">
                {patterns.slice(0, 5).map((p, i) => (
                  <li key={`${p.name}-${i}`} className="text-xs">
                    <div className="flex items-center justify-between">
                      <span className={clsx('font-medium',
                        p.type === 'bullish' ? 'text-emerald-400' : p.type === 'bearish' ? 'text-red-400' : 'text-slate-300')}>
                        {p.name}
                      </span>
                      <span className="font-mono text-text-muted">{Math.round(p.confidence * 100)}%</span>
                    </div>
                    <p className="text-text-muted leading-snug mt-0.5">{p.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-text-muted">No chart patterns detected in this range.</p>
            )}
          </div>

          {entry && (
            <Link
              href={`/equities/${symbol.toLowerCase()}`}
              className="block rounded-card border border-border bg-bg-card p-4 hover:border-accent-blue/40 transition-colors"
            >
              <p className="text-xs text-text-muted">Company profile</p>
              <p className="text-sm font-medium text-text-primary mt-0.5">{entry.name} →</p>
              <p className="text-[11px] text-text-muted mt-1">{SECTOR_INFO[entry.sector].label} · {entry.industry}</p>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// The Screener tab moved to /equities/scanner on 2026-08-19 (items 6/7). It ran
// RSI and vs-SMA over 24 hardcoded symbols; the new page runs the same seven
// setup detectors the crypto scanner uses over the full curated catalog, and
// merges the AI Outlier Scan into it — one scanner for the section, not two
// half-scanners on two pages.


// ─── Page ─────────────────────────────────────────────────────────────────────

function EquityTaContent() {

  return (
    <div className="space-y-6 max-w-(--breakpoint-2xl) mx-auto">
      <PageHeader
        title="Equity Technical Analysis"
        subtitle={`Candlestick charting, ${ALL_INDICATORS.length} indicators from the shared registry, and pattern detection`}
        description="The same TA engine as the crypto module — indicator registry, signal aggregation, and pattern detection — running on daily stock candles from Tiingo (FMP fallback). Both need an API key."
        details={[
          { label: 'Signals', text: 'The summary aggregates RSI, MACD, moving-average posture, and stochastic into buy/neutral/sell counts. Informational only.' },
          { label: 'Drawings', text: 'Trendlines, rectangles, Fibonacci retracements, and the Measure tool — click two points on the chart; horizontal rays take a single click.' },
        ]}
      />

      {/* Data provenance */}
      <SourceLine id="security-ohlcv" />

      <ChartTab />
    </div>
  )
}

export default function EquityTechnicalAnalysisPage() {
  return (
    <ModuleGate module="equities">
      <EquityTaContent />
    </ModuleGate>
  )
}
