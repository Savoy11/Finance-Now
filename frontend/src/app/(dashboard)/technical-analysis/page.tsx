'use client'

import { ModuleGate } from '@/components/layout/ModuleGate'
import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown,
  Activity, Filter,
  CandlestickChart as CandlestickIcon, AreaChart, BarChart2,
  LineChart, GitBranch, Layers,
  PenLine, Trash2,
  Compass, Gauge, Waves, Target, ShieldAlert,
  CircleDollarSign, Scale, FlaskConical, MinusCircle, Thermometer, Pickaxe,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { ChartType, DrawingTool, Drawing } from '@/components/charts/CandlestickChart'
import { ALL_INDICATORS, type IndicatorKey } from '@/components/charts/indicatorRegistry'
import { IndicatorPicker } from '@/components/charts/IndicatorPicker'
import { DrawingToolbar } from '@/components/charts/DrawingToolbar'
import type { LucideIcon } from 'lucide-react'
import { runBacktest, STRATEGIES, type StrategyCategory } from '@/lib/utils/backtest'
import {
  ema, fibRetracement, computeSignalSummary, detectPatterns,
  buildTechnicalRead, detectSupportResistance, patternProjection,
  type OhlcvCandle, type Signal, type SignalSummary, type DetectedPattern,
} from '@/lib/utils/indicators'
import { detectSetups, type SetupKey, type DetectedSetup } from '@/lib/utils/scanSetups'
import { DataBadge } from '@/components/ui/DataBadge'
import { confluenceLabel } from '@/lib/utils/confluence'
import { ohlcvSourceLabel } from '@/lib/utils/ohlcvSource'
import { PageHeader } from '@/components/ui/PageHeader'
import { SignalBadge } from '@/components/charts/SignalBadge'
import { formatAdaptivePrice } from '@/lib/utils/format'
import { SourceLine } from '@/components/ui/SourceLine'
import { useThesisStore, computeRiskReward } from '@/store/useThesisStore'
import { COINGECKO_IDS } from '@/lib/api/live/coingeckoIds'
import type { CoinListResponse } from '@/lib/types/coinList'
import type { FearGreedData } from '@/app/live-data/fear-greed/route'
import type { DefiTvlData } from '@/app/live-data/defi-tvl/route'
import type { BtcStatsData } from '@/app/live-data/btc-stats/route'

const CandlestickChart = dynamic(() => import('@/components/charts/CandlestickChart'), { ssr: false })

// ─── Constants ────────────────────────────────────────────────────────────────

// All OHLCV-supported coin IDs (keyed by internal id, e.g. "btc", "eth")
const SUPPORTED_IDS = Object.keys(COINGECKO_IDS)

// Crypto carries intraday ranges (1H, 4H) that the equity and macro surfaces
// deliberately do not. Crypto trades continuously and moves far enough within a
// session for an hourly candle to carry signal; an hourly view of a yield index
// or a large-cap equity is mostly market microstructure and gaps. This is a
// considered difference between the surfaces, not drift — do not "align" the
// three range lists. (Recorded in the do-not-fix registry, docs/agents/code-checker.md.)
const RANGES = ['1H', '4H', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y', 'MAX'] as const
type Range = typeof RANGES[number]

const CHART_TYPES: { type: ChartType; label: string; desc: string; Icon: LucideIcon }[] = [
  { type: 'candlestick', label: 'Candlestick',  desc: 'Standard OHLC candles',                 Icon: CandlestickIcon },
  { type: 'hollow',      label: 'Hollow',        desc: 'Up candles outlined, down candles filled', Icon: CandlestickIcon },
  { type: 'heikin-ashi', label: 'Heikin Ashi',  desc: 'Smoothed candles that filter noise',    Icon: Activity },
  { type: 'bars',        label: 'OHLC Bars',    desc: 'Traditional open/high/low/close bars',  Icon: BarChart2 },
  { type: 'line',        label: 'Line',          desc: 'Simple close-price line',               Icon: LineChart },
  { type: 'step-line',   label: 'Step Line',     desc: 'Stepped close-price line',              Icon: GitBranch },
  { type: 'area',        label: 'Area',          desc: 'Filled area under close price',         Icon: AreaChart },
  { type: 'baseline',    label: 'Baseline',      desc: 'Green/red vs. first period close',      Icon: Layers },
]

// Indicators now live in the shared TA engine so /equities and /macro get the
// same set and the same explanations. This page was the only one that had all
// 62; the others had 18 and 16 purely because the list was declared three times.
const INDICATORS = ALL_INDICATORS


// ─── Panels ───────────────────────────────────────────────────────────────────
//
// These nine were defined inline here until 2026-09-08, when the file was 1,287
// lines and the page component itself started at line 964. They moved out
// unchanged — same props, same behaviour — to components/analytics/technical/.
// BacktestPanel moved with them but is deliberately NOT imported here: it has no
// call site while the Backtest tab is hidden, and an unused import fails lint.
// It sits at components/analytics/technical/BacktestPanel.tsx — see the tab
// union below for what restoring it takes.
import { TechnicalReadPanel } from '@/components/analytics/technical/TechnicalReadPanel'
import { SupportResistancePanel } from '@/components/analytics/technical/SupportResistancePanel'
import { SignalSummaryPanel } from '@/components/analytics/technical/SignalSummaryPanel'
import { PatternsPanel } from '@/components/analytics/technical/PatternsPanel'
import { KeyLevelsPanel } from '@/components/analytics/technical/KeyLevelsPanel'
import { MultiTimeframeGrid } from '@/components/analytics/technical/MultiTimeframeGrid'
import { ThesisBuilderPanel } from '@/components/analytics/technical/ThesisBuilderPanel'
import { MarketStructurePanel } from '@/components/analytics/technical/MarketStructurePanel'

// The Scanner moved to its own route on 2026-08-19 (/scanner, short-list item
// 6/7): a tool that sweeps the whole universe for candidates was reachable only
// after picking one asset to chart, which is backwards. This page charts the
// asset you chose; the scanner finds the asset.

// ─── Page ─────────────────────────────────────────────────────────────────────

// 'backtest' HIDDEN 2026-08-20 (owner decision, revisitable): the tab, its
// panel and lib/utils/backtest.ts are retained — restore by re-adding the tab
// to the union and the two lists below, plus the BacktestPanel import at the
// top (dropped 2026-09-08 with the panel extraction, because an import with no
// call site fails lint; the component file itself is untouched).
type Tab = 'chart' | 'patterns'

// useSearchParams() forces a CSR bailout, so the page body must sit inside a
// Suspense boundary for `next build` prerendering to succeed.
// ModuleGate sits outside Suspense so a disabled module renders the unlock
// notice without mounting TechnicalAnalysisContent — none of its queries or
// useSearchParams work runs for a user who cannot see the results.
export default function TechnicalAnalysisPage() {
  return (
    <ModuleGate module="crypto">
      <Suspense>
        <TechnicalAnalysisContent />
      </Suspense>
    </ModuleGate>
  )
}

function TechnicalAnalysisContent() {
  const searchParams = useSearchParams()

  // Fetch live coin list to enrich OHLCV-supported assets with names + ranks
  const { data: coinListData } = useQuery<CoinListResponse>({
    queryKey: ['coin-list'],
    queryFn: () => fetch('/live-data/coin-list').then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  })

  // Build chart asset list: all COINGECKO_IDS-supported ids, enriched with live names
  const chartAssets = useMemo(() => {
    const coinMap = new Map(
      (coinListData?.coins ?? []).map(c => [c.symbol.toUpperCase(), c])
    )
    return SUPPORTED_IDS.map(id => {
      const sym = id.toUpperCase()
      const live = coinMap.get(sym)
      return {
        id,
        symbol: sym,
        label: live?.name ?? sym,
        rank: live?.rank ?? 9999,
      }
    }).sort((a, b) => a.rank - b.rank)
  }, [coinListData])

  const [tab, setTab] = useState<Tab>('chart')
  const [assetId, setAssetId] = useState(() => {
    const p = searchParams.get('asset')
    return SUPPORTED_IDS.includes(p ?? '') ? p! : 'btc'
  })
  const [range, setRange] = useState<Range>('1Y')
  const [chartType, setChartType] = useState<ChartType>('candlestick')
  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorKey>>(
    new Set(['ema20', 'ema50', 'volume', 'rsi']),
  )
  const [indicatorMenuOpen, setIndicatorMenuOpen] = useState(false)
  const indicatorMenuRef = useRef<HTMLDivElement>(null)
  const [chartTypeMenuOpen, setChartTypeMenuOpen] = useState(false)
  const chartTypeMenuRef = useRef<HTMLDivElement>(null)
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('none')
  const [drawings, setDrawings] = useState<Drawing[]>([])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (indicatorMenuRef.current && !indicatorMenuRef.current.contains(e.target as Node)) {
        setIndicatorMenuOpen(false)
      }
      if (chartTypeMenuRef.current && !chartTypeMenuRef.current.contains(e.target as Node)) {
        setChartTypeMenuOpen(false)
      }
    }
    if (indicatorMenuOpen || chartTypeMenuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [indicatorMenuOpen, chartTypeMenuOpen])

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['ta-ohlcv', assetId, range],
    queryFn: async () => {
      const res = await fetch(`/live-data/ohlcv?id=${assetId}&range=${range}`)
      if (!res.ok) throw new Error('fetch failed')
      return res.json() as Promise<{ ok: boolean; candles: OhlcvCandle[]; source?: string; venue?: string; granularity?: string }>
    },
    staleTime: range === '1H' ? 60_000 : range === '4H' || range === '1M' ? 300_000 : 900_000,
  })

  const ohlcvSource = ohlcvSourceLabel(data?.source, data?.venue)

  // News-derived event markers for the chart (feature #4)
  const candles = useMemo<OhlcvCandle[]>(() => data?.candles ?? [], [data])

  const summary = useMemo(() => candles.length >= 50 ? computeSignalSummary(candles) : null, [candles])
  const patterns = useMemo(() => candles.length >= 20 ? detectPatterns(candles) : [], [candles])

  function toggleIndicator(key: IndicatorKey) {
    setActiveIndicators((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const asset = chartAssets.find((a) => a.id === assetId) ?? { id: assetId, symbol: assetId.toUpperCase(), label: assetId.toUpperCase(), rank: 9999 }

  return (
    <div className="flex flex-col gap-4 p-6 max-w-screen-2xl mx-auto w-full">
      <PageHeader
        title="Technical Analysis"
        subtitle="Professional-grade charting, indicators, and pattern recognition"
        icon={<Activity size={18} className="text-accent-blue" />}
        description={`A full TA suite combining the best of TradingView, Coinigy, and TrendSpider — candlestick charts with ${ALL_INDICATORS.length} indicators, automated pattern detection, and strategy backtests. The multi-asset scanner has its own page: Scanner in the sidebar.`}
        details={[
          { label: 'Indicators', text: 'RSI, MACD, Bollinger Bands, EMA/SMA stack, Stochastic RSI, ATR, OBV, VWAP — toggle any combination on the chart.' },
          { label: 'Signal Summary', text: 'Each indicator votes buy/sell/neutral; aggregate score produces an overall signal (Strong Buy → Strong Sell).' },
          { label: 'Pattern Recognition', text: 'Automated detection of Double Top/Bottom, Head & Shoulders, Triangles, Engulfing candles, Golden/Death Cross.' },
          { label: 'Scanner', text: 'Moved to its own page (Scanner in the sidebar) — it sweeps every tracked asset for setups rather than charting the one you picked here.' },
        ]}
      />

      {/* Data provenance */}
      <SourceLine id="ohlcv" />

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Asset selector */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="appearance-none bg-bg-secondary border border-border rounded-lg pl-3 pr-7 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-blue/60 cursor-pointer"
            >
              {chartAssets.map((a) => (
                <option key={a.id} value={a.id}>{a.symbol} — {a.label}{a.rank < 9999 ? ` (#${a.rank})` : ''}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          </div>
          {candles.length > 0 && (() => {
            const lastClose = candles[candles.length - 1].close
            const prevClose = candles[candles.length - 2]?.close
            const pct = prevClose ? ((lastClose - prevClose) / prevClose) * 100 : null
            return (
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-2xl text-text-primary">{formatAdaptivePrice(lastClose)}</span>
                {pct !== null && (
                  <span className={clsx('text-base font-semibold', pct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                  </span>
                )}
              </div>
            )
          })()}
        </div>

        {/* Range selector */}
        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={clsx('px-2.5 py-1.5 text-xs font-medium transition-colors', range === r ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated')}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Chart type dropdown */}
        <div className="relative" ref={chartTypeMenuRef}>
          {(() => {
            const current = CHART_TYPES.find((c) => c.type === chartType) ?? CHART_TYPES[0]
            return (
              <button
                onClick={() => setChartTypeMenuOpen((v) => !v)}
                className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                  chartTypeMenuOpen ? 'border-accent-blue/60 bg-accent-blue/10 text-accent-blue' : 'border-border text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                )}
              >
                <current.Icon size={12} />
                {current.label}
                <ChevronDown size={11} className={clsx('transition-transform', chartTypeMenuOpen && 'rotate-180')} />
              </button>
            )
          })()}
          {chartTypeMenuOpen && (
            <div className="absolute top-full left-0 mt-1.5 z-50 bg-bg-card border border-border rounded-xl shadow-2xl w-56 p-1.5">
              {CHART_TYPES.map(({ type, label, desc, Icon }) => (
                <button
                  key={type}
                  onClick={() => { setChartType(type); setChartTypeMenuOpen(false) }}
                  className={clsx('w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-colors',
                    chartType === type ? 'bg-accent-blue/10 text-accent-blue' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                  )}
                >
                  <Icon size={13} className="mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-medium">{label}</div>
                    <div className="text-[10px] text-text-muted leading-tight mt-0.5">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-text-secondary hover:bg-bg-elevated transition-colors disabled:opacity-50"
        >
          <RefreshCw size={11} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>

        {/* Tabs */}
        <div className="ml-auto flex items-center rounded-lg border border-border overflow-hidden">
          {([['chart', 'Chart'], ['patterns', 'Patterns']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx('px-3 py-1.5 text-xs font-medium transition-colors', tab === t ? 'bg-bg-elevated text-text-primary' : 'text-text-muted hover:text-text-secondary')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart Tab ── */}
      {tab === 'chart' && (
        <div className="flex flex-col gap-3">
          {/* Indicators — shared picker, same control on all three TA surfaces */}
          <IndicatorPicker
            indicators={INDICATORS}
            active={activeIndicators}
            onToggle={(k) => toggleIndicator(k as IndicatorKey)}
            onClearAll={() => setActiveIndicators(new Set())}
          />

          {/* Drawing toolbar — shared component; this page was its origin */}
          <DrawingToolbar
            active={drawingTool}
            onChange={setDrawingTool}
            drawings={drawings}
            onClear={() => { setDrawings([]); setDrawingTool('none') }}
          />

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
            {/* Chart */}
            <div className="rounded-xl border border-border bg-bg-card overflow-hidden" style={{ height: 520 }}>
              {isFetching && candles.length === 0 ? (
                <div className="flex items-center justify-center h-full gap-2 text-text-muted">
                  <RefreshCw size={16} className="animate-spin" />
                  <span className="text-sm">Loading {asset?.symbol} {range} data…</span>
                </div>
              ) : candles.length > 0 ? (
                <CandlestickChart
                  candles={candles}
                  activeIndicators={activeIndicators}
                  chartType={chartType}
                  drawingTool={drawingTool}
                  drawings={drawings}
                  onDrawingComplete={(d) => {
                    setDrawings(prev => [...prev, d])
                    setDrawingTool('none')
                  }}
                  patterns={patterns}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-text-muted text-sm">
                  No data available
                </div>
              )}
            </div>

            {/* Right panel */}
            <div className="flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: 520 }}>
              {/* Provenance for the price series + derived signals */}
              {candles.length > 0 && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg-card px-3 py-2">
                  <DataBadge
                    status={ohlcvSource ? 'live' : 'unavailable'}
                    source={ohlcvSource ? `${ohlcvSource} OHLCV` : undefined}
                  />
                  <span className="text-[10px] text-text-muted">
                    {candles.length} candles · indicators derived
                  </span>
                </div>
              )}
              {summary && <TechnicalReadPanel candles={candles} summary={summary} />}
              <MarketStructurePanel symbol={asset.symbol} />
              {summary && <SignalSummaryPanel summary={summary} />}
              {candles.length > 0 && <SupportResistancePanel candles={candles} />}
              {candles.length > 0 && <KeyLevelsPanel candles={candles} />}
            </div>
          </div>

          {/* Multi-timeframe confluence */}
          <MultiTimeframeGrid assetId={assetId} />

          {/* Chart notes / thesis builder */}
          <ThesisBuilderPanel
            assetId={assetId}
            symbol={asset.symbol}
            range={range}
            price={candles.length > 0 ? candles[candles.length - 1].close : null}
            signal={summary?.overall ?? null}
          />
        </div>
      )}

      {/* ── Patterns Tab ── */}
      {tab === 'patterns' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-4">
            <PatternsPanel patterns={patterns} candles={candles} />
          </div>
          <div className="flex flex-col gap-4">
            {candles.length > 0 && <SupportResistancePanel candles={candles} />}
            {candles.length > 0 && <KeyLevelsPanel candles={candles} />}
            {summary && <SignalSummaryPanel summary={summary} />}
          </div>
        </div>
      )}

      {/* ── Backtest Tab ── */}
      {/* Backtest tab hidden 2026-08-20 — panel code retained below. */}
    </div>
  )
}
