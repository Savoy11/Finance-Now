'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Users } from 'lucide-react'
import { EQUITY_CATALOG, SECTOR_INFO, type SectorId } from '@/lib/data/equityCatalog'
import { formatCompact, formatCurrency, formatPercent } from '@/lib/utils/format'
import { STALE_TIME_SHORT } from '@/lib/constants'
import { marketCapText, marketCapUsd } from '@/lib/data/stockShares'
import type { SecurityQuotesResponse } from '@/app/live-data/security-quotes/route'
import type { StockUniverseResponse } from '@/app/live-data/stock-universe/route'

// Same-sector peers from the equity catalog with live quotes, so a stock's
// page shows where it sits among comparable names. Rows link to each peer.
//
// Ranked by market cap against live prices (D170): SEC cover-page shares × the live quote,
// for every catalog stock in the sector (a dozen at most), then the largest eight. Without a
// quote the ranking falls back to the catalog's order, and the cells show a dash.

const MAX_PEERS = 8

export function SectorPeers({ symbol, sector }: { symbol: string; sector: SectorId }) {
  const candidates = EQUITY_CATALOG.filter(e => e.sector === sector && e.symbol !== symbol)
  const symbols = candidates.map(p => p.symbol)
  const { data } = useQuery<SecurityQuotesResponse>({
    queryKey: ['security-quotes', 'peers', symbols.join(',')],
    queryFn: () => fetch(`/live-data/security-quotes?symbols=${encodeURIComponent(symbols.join(','))}`).then(r => r.json()),
    staleTime: STALE_TIME_SHORT,
    refetchInterval: 120_000,
    enabled: symbols.length > 0,
  })
  const { data: sec } = useQuery<StockUniverseResponse>({
    queryKey: ['stock-universe', 'peers', symbols.join(',')],
    queryFn: () => fetch(`/live-data/stock-universe?symbols=${encodeURIComponent(symbols.join(','))}`).then(r => r.json()),
    staleTime: 1000 * 60 * 60,
    enabled: symbols.length > 0,
  })
  const sharesBy = new Map((sec?.entries ?? []).map(e => [e.symbol, e.shares]))
  const peers = candidates.map(peer => {
    const q = data?.quotes?.[peer.symbol]
    const price = q && !q.reference && q.price != null && q.price > 0 ? q.price : null
    const shares = sharesBy.get(peer.symbol) ?? null
    return { peer, price, change: price != null ? q?.changePercent ?? null : null, shares, mcap: marketCapUsd(shares, price) }
  })
    .sort((a, b) => (b.mcap ?? -1) - (a.mcap ?? -1))
    .slice(0, MAX_PEERS)

  if (peers.length === 0) return null
  const sectorMeta = SECTOR_INFO[sector]

  return (
    <section className="rounded-card border border-border bg-bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-text-secondary flex items-center gap-2">
          <Users size={14} className="text-text-muted" aria-hidden />
          Sector Peers
        </h2>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: sectorMeta.color }} aria-hidden />
          {sectorMeta.label}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-text-muted border-b border-border/60">
              <th className="pb-2 pr-4 font-medium">Symbol</th>
              <th className="pb-2 pr-4 font-medium">Company</th>
              <th className="pb-2 pr-4 font-medium text-right">Price</th>
              <th className="pb-2 pr-4 font-medium text-right">Today</th>
              <th className="pb-2 font-medium text-right">Market Cap</th>
            </tr>
          </thead>
          <tbody>
            {peers.map(({ peer, price, change, shares, mcap }) => {
              return (
                <tr key={peer.symbol} className="border-b border-border/30 last:border-0 hover:bg-bg-elevated/50 transition-colors">
                  <td className="py-2 pr-4">
                    <Link href={`/equities/${peer.symbol.toLowerCase()}`} className="font-mono font-medium text-accent-blue hover:underline">
                      {peer.symbol}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-text-secondary truncate max-w-[220px]">{peer.name}</td>
                  <td className={clsx('py-2 pr-4 text-right font-mono tabular-nums', price == null ? 'text-text-muted' : 'text-text-primary')}>
                    {price == null ? '—' : formatCurrency(price)}
                  </td>
                  <td className={clsx('py-2 pr-4 text-right font-mono tabular-nums',
                    change == null ? 'text-text-muted' : change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {change == null ? '—' : formatPercent(change, 2)}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-text-secondary" title={marketCapText(shares, price).explain}>
                    {mcap == null ? '—' : formatCompact(mcap)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
