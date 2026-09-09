'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Layers,
  Compass,
  Gauge,
  CircleDollarSign,
  Scale,
  MinusCircle,
  Thermometer,
  Pickaxe,
} from 'lucide-react'
import { clsx } from 'clsx'
import { DataBadge } from '@/components/ui/DataBadge'
import type { FearGreedData } from '@/app/live-data/fear-greed/route'
import type { DefiTvlData } from '@/app/live-data/defi-tvl/route'
import type { BtcStatsData } from '@/app/live-data/btc-stats/route'

// ─── Market Structure panel (crypto-native overlays, feature #3) ─────────────────

export function MarketStructurePanel({ symbol }: { symbol: string }) {
  const isBtc = symbol.toUpperCase() === 'BTC'

  const { data: funding } = useQuery({
    queryKey: ['ms-funding'],
    queryFn: () => fetch('/live-data/funding-rates').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
  const { data: reserves } = useQuery({
    queryKey: ['ms-reserves'],
    queryFn: () => fetch('/live-data/reserves').then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  })
  // NT11 (2026-08-18): three maintained, terms-registered routes that shipped
  // with no UI consumer at all. They are market-structure context by nature, so
  // this panel — which already carries funding, open interest and stablecoin
  // supply — is where they belong, rather than a new surface.
  const { data: fearGreed } = useQuery<FearGreedData>({
    queryKey: ['ms-fear-greed'],
    queryFn: () => fetch('/live-data/fear-greed').then(r => r.json()),
    staleTime: 30 * 60 * 1000,
  })
  const { data: defi } = useQuery<DefiTvlData>({
    queryKey: ['ms-defi-tvl'],
    queryFn: () => fetch('/live-data/defi-tvl').then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  })
  // Bitcoin-chain metrics are fetched only on BTC. Hashrate and mempool depth
  // say nothing about SOL, and rendering them beside a Solana chart would imply
  // a relationship that does not exist.
  const { data: btc } = useQuery<BtcStatsData>({
    queryKey: ['ms-btc-stats'],
    queryFn: () => fetch('/live-data/btc-stats').then(r => r.json()),
    staleTime: 10 * 60 * 1000,
    enabled: isBtc,
  })

  const row = (funding?.rates ?? []).find((r: { symbol: string }) => r.symbol?.toUpperCase() === symbol.toUpperCase())
  const stableTotal: number | null = reserves?.assets
    ? reserves.assets.reduce((a: number, s: { circulatingUsd?: number }) => a + (s.circulatingUsd ?? 0), 0)
    : null

  const fmtUsd = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${n.toLocaleString()}`

  // The fear-greed route answers a failed upstream with `ok: false` and a
  // neutral 50 so callers need no null check. That default must never render —
  // a fabricated "Neutral 50" is exactly the kind of plausible fake value the
  // live-only policy exists to prevent.
  const fg = fearGreed?.ok ? fearGreed : null
  const fgColor =
    fg == null ? 'text-text-muted'
      : fg.value <= 24 ? 'text-red-400'
      : fg.value <= 44 ? 'text-orange-400'
      : fg.value <= 55 ? 'text-text-primary'
      : fg.value <= 75 ? 'text-emerald-400'
      : 'text-amber-400'   // extreme greed is a warning, not a win
  const totalTvl = defi?.ok && defi.totalTvl > 0 ? defi.totalTvl : null

  return (
    <div className="rounded-xl border border-border bg-bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Market Structure</span>
        <DataBadge
          status={row || stableTotal || fg || totalTvl ? 'live' : 'unavailable'}
          source={`OKX · DefiLlama · Alternative.me${isBtc ? ' · mempool.space' : ''}`}
        />
      </div>

      <div className="space-y-2">
        {/* Funding rate */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-text-muted"><Gauge size={12} /> Funding (annualized)</span>
          {row ? (
            <span className={clsx('font-mono font-semibold', row.annualized >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {row.annualized >= 0 ? '+' : ''}{row.annualized.toFixed(2)}% <span className="text-text-muted font-normal">({row.exchange})</span>
            </span>
          ) : <span className="text-text-muted">n/a</span>}
        </div>
        {/* Open interest */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-text-muted"><Scale size={12} /> Open interest</span>
          {row?.openInterestUsd ? <span className="font-mono font-semibold text-text-primary">{fmtUsd(row.openInterestUsd)}</span> : <span className="text-text-muted">n/a</span>}
        </div>
        {/* Long/short ratio */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-text-muted"><Compass size={12} /> Long/short ratio</span>
          {row?.longShortRatio != null ? <span className="font-mono font-semibold text-text-primary">{row.longShortRatio.toFixed(2)}</span> : <span className="text-text-muted">n/a — not provided</span>}
        </div>
        {/* Stablecoin supply (market-wide) */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-text-muted"><CircleDollarSign size={12} /> Total stablecoin supply</span>
          {stableTotal ? <span className="font-mono font-semibold text-text-primary">{fmtUsd(stableTotal)}</span> : <span className="text-text-muted">n/a</span>}
        </div>
        {/* Fear & Greed — market-wide sentiment (NT11) */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-text-muted"><Thermometer size={12} /> Fear &amp; Greed</span>
          {fg ? (
            <span className={clsx('font-mono font-semibold', fgColor)}>
              {fg.value} <span className="font-normal">{fg.classification}</span>
              {fg.previousClose != null && (
                <span className="text-text-muted font-normal"> (prev {fg.previousClose})</span>
              )}
            </span>
          ) : <span className="text-text-muted">n/a</span>}
        </div>
        {/* DeFi TVL — market-wide capital at work (NT11) */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-text-muted"><Layers size={12} /> DeFi TVL (all chains)</span>
          {totalTvl ? (
            <span className="font-mono font-semibold text-text-primary">
              {fmtUsd(totalTvl)}
              {defi?.dexVolume24h ? <span className="text-text-muted font-normal"> · DEX {fmtUsd(defi.dexVolume24h)}/24h</span> : null}
            </span>
          ) : <span className="text-text-muted">n/a</span>}
        </div>
        {/* Bitcoin chain health — BTC only, by design (NT11) */}
        {isBtc && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-text-muted"><Pickaxe size={12} /> Hashrate · mempool</span>
            {btc?.ok && btc.hashrateTHs != null ? (
              <span className="font-mono font-semibold text-text-primary">
                {(btc.hashrateTHs / 1e6).toFixed(0)} EH/s
                {btc.mempoolTxCount != null && (
                  <span className="text-text-muted font-normal"> · {btc.mempoolTxCount.toLocaleString()} tx queued</span>
                )}
              </span>
            ) : <span className="text-text-muted">n/a</span>}
          </div>
        )}
      </div>

      {/* Honest unavailable markers — no free real-time source */}
      <div className="border-t border-border pt-2 space-y-1">
        {['Liquidation heatmap', 'Exchange in/out-flows'].map((label) => (
          <div key={label} className="flex items-center justify-between text-[10px] text-text-muted/70">
            <span className="flex items-center gap-1.5"><MinusCircle size={11} /> {label}</span>
            <span>not available (paid feed)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
