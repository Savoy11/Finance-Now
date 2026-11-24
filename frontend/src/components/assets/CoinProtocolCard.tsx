'use client'

// The protocol behind a DeFi token, measured (T-469, D242): value locked, its
// 24-hour and 7-day change and the protocol's kind, from the defi-tvl route's
// own feed. Renders only for a coin the hand-kept map names
// (lib/data/defiProtocols.ts) — an unmapped coin mounts nothing and fetches
// nothing — and always carries the plain line that this measures the protocol,
// not the token. Facts only: no score, grade or rank.

import { useQuery } from '@tanstack/react-query'
import { Landmark } from 'lucide-react'
import { clsx } from 'clsx'
import { formatCompact } from '@/lib/utils/format'
import { STALE_TIME_LONG } from '@/lib/constants'
import { DEFI_PROTOCOL_BY_COIN, protocolNotTokenLine } from '@/lib/data/defiProtocols'
import type { CoinProtocolResponse } from '@/app/live-data/defi-tvl/route'

function Change({ label, pct }: { label: string; pct: number | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-text-muted uppercase tracking-wider">{label}</span>
      {pct === null ? (
        <span className="text-sm font-mono text-text-muted">—</span>
      ) : (
        <span className={clsx('text-sm font-mono', pct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
        </span>
      )}
    </div>
  )
}

export function CoinProtocolCard({ assetId, symbol }: { assetId: string; symbol: string }) {
  const mapped = assetId in DEFI_PROTOCOL_BY_COIN

  const { data, isLoading } = useQuery<CoinProtocolResponse>({
    queryKey: ['coin-protocol', assetId],
    queryFn: () => fetch(`/live-data/defi-tvl?coin=${encodeURIComponent(assetId)}`).then((r) => r.json()),
    enabled: mapped,
    staleTime: STALE_TIME_LONG,
    refetchInterval: 10 * 60 * 1000,
  })

  if (!mapped) return null
  const protocol = data?.protocol ?? null

  return (
    <section aria-label="Protocol value locked" className="bg-bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Landmark size={14} className="text-accent-blue" aria-hidden />
          <h3 className="text-sm font-semibold text-text-primary">
            {protocol ? `${protocol.name} protocol` : 'Protocol value locked'}
          </h3>
        </div>
        {protocol?.category && (
          <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-medium border text-slate-400 bg-slate-400/10 border-slate-500/20">
            {protocol.category}
          </span>
        )}
      </div>

      {isLoading && <p className="text-xs text-text-muted">Reading the protocol feed…</p>}

      {!isLoading && !protocol && (
        <p className="text-xs text-text-muted">{data?.reason ?? 'No figure right now.'}</p>
      )}

      {protocol && (
        <>
          <div className="flex items-end gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-text-muted uppercase tracking-wider">Value locked</span>
              <span className="text-xl font-semibold text-text-primary font-mono">${formatCompact(protocol.tvl)}</span>
            </div>
            <Change label="24h" pct={protocol.change24hPct} />
            <Change label="7d" pct={protocol.change7dPct} />
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {protocolNotTokenLine(protocol.name, symbol)}
            {protocol.parts > 1 ? ` The figure adds the protocol’s ${protocol.parts} parts (versions and products) in DefiLlama’s feed.` : ''}
          </p>
          <p className="text-[10px] text-text-muted">Source: DefiLlama, refreshed with the feed every few minutes.</p>
        </>
      )}
    </section>
  )
}
