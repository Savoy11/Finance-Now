'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQueries } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Activity, Loader2, RefreshCw } from 'lucide-react'
import { ModuleGate } from '@/components/layout/ModuleGate'
import { PageHeader } from '@/components/ui/PageHeader'
import { SourceLine } from '@/components/ui/SourceLine'
import { rsi, sma, computeSignalSummary, type Signal } from '@/lib/utils/indicators'
import { SignalBadge } from '@/components/charts/SignalBadge'
import { AgentScanPanel } from '@/components/markets/AgentScanPanel'
import { MACRO_MOVERS_SCAN } from '@/components/markets/agentScans'
import {
  MACRO_INSTRUMENTS, SCANNER_INSTRUMENTS, CURVE_YIELD_INSTRUMENTS, GROUPS, fmtLevel,
  type MacroGroup, type MacroInstrument,
} from '../macroInstruments'
import type { SecurityOhlcvResponse } from '@/app/live-data/security-ohlcv/route'

// ─── Macro Scanner ────────────────────────────────────────────────────────────
//
// Was the "Scanner" tab on /macro/technical-analysis until 2026-08-19 (items
// 6/7: one scanner per section, promoted to nav).
//
// Universe is the LIQUID subset of the macro instruments. The delisted-ETF
// commodities and the EM/cross FX pairs gap enough that a ranked RSI beside a
// liquid contract would read as comparable when it is not. The four Treasury
// yields left too on 2026-10-24 (T-129 D): no provider sends their history (D3).
// Every instrument still charts on the TA page; the exclusions are stated
// on-page, not silently applied.

// ─── Scanner tab ──────────────────────────────────────────────────────────────

interface ScannerRow {
  symbol: string
  name: string
  group: MacroGroup
  detailPath: string
  entry: MacroInstrument
  level: number | null
  rsi14: number | null
  vsSma50Pct: number | null
  overall: Signal | null
}

function ScannerTab() {
  const [group, setGroup] = useState<MacroGroup | 'All'>('All')
  // T-129 D: every row is a keyed provider request, so the sweep runs when the
  // reader asks, as on the Equity Scanner. It used to run on every visit and
  // again whenever the cache went stale, spending the free plans' quota on a
  // page merely opened.
  const [hasRun, setHasRun] = useState(false)
  const [lastScan, setLastScan] = useState<Date | null>(null)

  const queries = useQueries({
    queries: SCANNER_INSTRUMENTS.map((m) => ({
      queryKey: ['security-ohlcv', m.symbol, '6M'],
      queryFn: () => fetch(`/live-data/security-ohlcv?symbol=${encodeURIComponent(m.symbol)}&range=6M`)
        .then((r) => r.json() as Promise<SecurityOhlcvResponse>),
      staleTime: 10 * 60 * 1000,
      enabled: hasRun,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })),
  })

  const scanning = queries.some((q) => q.isFetching)
  const loading = queries.some((q) => q.isLoading)
  const done = queries.filter((q) => !q.isFetching && (q.data !== undefined || q.isError)).length
  const dataKey = queries.map((q) => q.dataUpdatedAt).join(',')

  const runScan = () => {
    if (!hasRun) setHasRun(true) // enabling the queries starts the first sweep
    else queries.forEach((q) => { void q.refetch() })
    setLastScan(new Date())
  }

  const rows: ScannerRow[] = useMemo(() => {
    return SCANNER_INSTRUMENTS.map((m, i) => {
      // Before Run scan nothing is shown, even what another page left in the
      // cache: rows from an unknown earlier hour would read as this scan's.
      const candles = hasRun ? queries[i].data?.candles ?? [] : []
      const base = {
        symbol: m.symbol, name: m.name, group: m.group, detailPath: m.detailPath, entry: m,
      }
      if (candles.length < 30) {
        return { ...base, level: null, rsi14: null, vsSma50Pct: null, overall: null }
      }
      const closes = candles.map((c) => c.close)
      const last = closes[closes.length - 1]
      const rsiVals = rsi(closes, 14)
      const smaVals = sma(closes, 50)
      const sma50 = smaVals[smaVals.length - 1]
      return {
        ...base,
        level: last,
        rsi14: rsiVals[rsiVals.length - 1],
        vsSma50Pct: sma50 ? ((last - sma50) / sma50) * 100 : null,
        overall: computeSignalSummary(candles).overall,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, hasRun])

  const visible = group === 'All' ? rows : rows.filter((r) => r.group === group)
  const skipped = MACRO_INSTRUMENTS.filter((m) => !m.liquid).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['All', ...GROUPS] as Array<MacroGroup | 'All'>).map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            className={clsx('px-2.5 py-1 rounded-sm text-xs font-medium border transition-colors',
              group === g
                ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/30'
                : 'text-text-muted border-border hover:text-text-secondary')}
          >
            {g}
          </button>
        ))}
        <button
          onClick={runScan}
          disabled={scanning}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
        >
          {scanning ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <RefreshCw size={12} aria-hidden />}
          {scanning ? `Scanning ${done}/${SCANNER_INSTRUMENTS.length}` : hasRun ? 'Rescan' : 'Run scan'}
        </button>
        {lastScan && !scanning && (
          <span className="text-[11px] text-text-muted">Scanned {lastScan.toLocaleTimeString()}</span>
        )}
      </div>

      {!hasRun && (
        <p className="rounded-card border border-border bg-bg-card p-3 text-xs text-text-muted">
          Press <strong>Run scan</strong> to sweep the list. One scan is {SCANNER_INSTRUMENTS.length} keyed
          provider requests, so it runs when you ask rather than on every visit.
        </p>
      )}

      {/* Never silently cap coverage — say what was left out and why. */}
      <p className="text-xs text-text-muted leading-relaxed">
        Scanning {SCANNER_INSTRUMENTS.length} of {MACRO_INSTRUMENTS.length} macro instruments over
        6 months of daily history. {skipped} thin {skipped === 1 ? 'market is' : 'markets are'} excluded —
        the delisted-ETF commodities (heating oil, coffee, cocoa, cotton, cattle, hogs) and the EM and
        cross FX pairs, whose series gap enough that a ranked RSI beside a liquid contract would read
        as comparable when it isn’t. All of them still chart on the Chart tab.{' '}
        {/* T-129 D: no provider serves these any history (D3); asking cost four
            keyed requests a scan that could never succeed. */}
        The {CURVE_YIELD_INSTRUMENTS.length} Treasury yields ({CURVE_YIELD_INSTRUMENTS.map((m) => m.symbol).join(', ')})
        are not scanned either: no provider sends their history, so they are read once a day off the
        official Treasury curve on <Link href="/macro/rates" className="text-accent-blue hover:underline">Bonds &amp; Rates</Link>.
      </p>

      <div className="rounded-card border border-border bg-bg-card overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-text-muted uppercase tracking-wider text-[10px]">
              <th className="px-4 py-2 text-left font-medium">Instrument</th>
              <th className="px-4 py-2 text-left font-medium">Area</th>
              <th className="px-4 py-2 text-right font-medium">Level</th>
              <th className="px-4 py-2 text-right font-medium">RSI 14</th>
              <th className="px-4 py-2 text-right font-medium">vs SMA 50</th>
              <th className="px-4 py-2 text-right font-medium">Signal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {visible.map((row) => {
              return (
                <tr key={row.symbol} className="hover:bg-bg-elevated/50 transition-colors">
                  <td className="px-4 py-2">
                    <Link href={row.detailPath} className="font-medium text-accent-blue hover:underline">
                      {row.name}
                    </Link>
                    <span className="ml-2 font-mono text-text-muted">{row.symbol}</span>
                  </td>
                  <td className="px-4 py-2 text-text-muted">{row.group}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-text-primary">
                    {fmtLevel(row.entry, row.level)}
                  </td>
                  <td className={clsx('px-4 py-2 text-right font-mono tabular-nums',
                    row.rsi14 == null ? 'text-text-muted'
                      : row.rsi14 >= 70 ? 'text-red-400'
                      : row.rsi14 <= 30 ? 'text-emerald-400'
                      : 'text-text-secondary')}>
                    {row.rsi14 == null ? '—' : row.rsi14.toFixed(1)}
                  </td>
                  <td className={clsx('px-4 py-2 text-right font-mono tabular-nums',
                    row.vsSma50Pct == null ? 'text-text-muted'
                      : row.vsSma50Pct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {row.vsSma50Pct == null ? '—' : `${row.vsSma50Pct >= 0 ? '+' : ''}${row.vsSma50Pct.toFixed(1)}%`}
                  </td>
                  {/* Same badge the crypto scanner renders — the three
                      scanners are one family now, so a signal must not look
                      different depending on which section you are in. */}
                  <td className="px-4 py-2 text-right">
                    {row.overall
                      ? <SignalBadge signal={row.overall} />
                      : <span className="text-text-muted">{!hasRun ? '—' : loading ? '…' : 'no data'}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}


function MacroScannerInner() {
  return (
    <div className="space-y-5 max-w-(--breakpoint-2xl) mx-auto">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-accent-blue" aria-hidden />
        <PageHeader
          title="Macro Scanner"
          subtitle="RSI, trend-vs-average and composite signal across the liquid macro universe"
          description="Ranks commodities, currencies and rates on the same indicator engine the crypto and equity scanners use. Levels follow each market's own convention — grains in cents per bushel, yields in percent, bond futures in points of par."
          details={[
            { label: 'Universe', text: `The liquid subset: ${SCANNER_INSTRUMENTS.length} of ${MACRO_INSTRUMENTS.length} macro instruments. Thin contracts and EM/cross FX pairs are excluded because a ranked reading beside a liquid one reads as comparable when it is not — they all still chart on Technical Analysis. The ${CURVE_YIELD_INSTRUMENTS.length} Treasury yields are left out too: no provider sends their history, and Bonds & Rates reads them off the official curve.` },
            { label: 'When it runs', text: `When you press Run scan. Each instrument is one request to a keyed provider, so opening the page spends nothing.` },
            { label: 'What it is', text: 'A discovery tool across instruments. The TA page is the other half: it charts the one instrument you picked.' },
          ]}
        />
      </div>
      <SourceLine id="macro-quotes" />
      {/* The Macro Screener agent's own run button (NT6, 2026-10-01). Same panel
          as the equities AI Outlier Scan, so a fix to one reaches both. */}
      <AgentScanPanel scan={MACRO_MOVERS_SCAN} />
      <ScannerTab />
    </div>
  )
}

export default function MacroScannerPage() {
  return (
    <ModuleGate module="macro">
      <MacroScannerInner />
    </ModuleGate>
  )
}
