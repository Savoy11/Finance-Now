'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { ExternalLink } from 'lucide-react'
import { SourceLine } from '@/components/ui/SourceLine'
import { STALE_TIME_SHORT } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils/format'
import type { CommodityEntry } from '@/lib/data/commodityCatalog'
import { FUND_PRICE_NOTE, NO_FUND_PRICES_NOTE, commodityFunds } from '@/lib/data/commodityFunds'
import { liveQuotesFor, type SecurityQuotesLike } from '@/lib/data/liveQuotes'

// The funds that hold a commodity, on its page (T-462): each with its own live price and change
// since the previous close, under the fund's name. Never in the commodity's price slot, and never
// a reference price. One quote request for all of them.

const signedPct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%`

export function CommodityFundsCard({ entry }: { entry: CommodityEntry }) {
  const funds = commodityFunds(entry)
  const symbols = funds.map((f) => f.symbol)
  const { data, isLoading } = useQuery<SecurityQuotesLike>({
    queryKey: ['commodity-fund-quotes', symbols.join(',')],
    queryFn: () => fetch(`/live-data/security-quotes?symbols=${symbols.map(encodeURIComponent).join(',')}`).then((r) => r.json()),
    staleTime: STALE_TIME_SHORT,
    refetchInterval: 1000 * 60 * 2,
    enabled: symbols.length > 0,
  })
  const live = liveQuotesFor(data, symbols)
  const anyLive = symbols.some((s) => live[s])

  return (
    <div className="rounded-card border border-border bg-bg-card p-4" data-testid="commodity-funds">
      <h2 className="text-sm font-medium text-text-secondary mb-3">ETF Proxies</h2>
      {funds.length > 0 ? (
        <>
          <div className="space-y-2">
            {funds.map(({ symbol, fund }) => {
              const q = live[symbol]
              return (
                <Link key={symbol} href={`/funds/${symbol.toLowerCase()}`} className="flex items-center gap-2 text-xs group">
                  <span className="font-mono font-semibold text-text-primary group-hover:text-accent-blue transition-colors w-12 shrink-0">{symbol}</span>
                  <span className="text-text-muted flex-1 min-w-0 truncate">{fund.name}</span>
                  <span className="shrink-0 text-right font-mono tabular-nums" data-testid={`fund-price-${symbol}`}>
                    {q ? (
                      <>
                        <span className="text-text-primary">{formatCurrency(q.price)}</span>
                        {q.changePercent != null && (
                          <span className={clsx('ml-1.5', q.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400')}
                            title="Change since the previous close">
                            {signedPct(q.changePercent)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-text-muted" title={isLoading ? 'Fetching the fund’s price' : 'No live price for this fund'}>—</span>
                    )}
                  </span>
                  <ExternalLink size={11} className="shrink-0 text-text-muted group-hover:text-accent-blue transition-colors" aria-hidden />
                </Link>
              )
            })}
          </div>
          {!isLoading && data && !anyLive && (
            <p className="mt-3 text-[11px] text-text-muted leading-relaxed" data-testid="no-fund-prices">{NO_FUND_PRICES_NOTE}</p>
          )}
          <p className="mt-3 pt-3 border-t border-border/60 text-[11px] text-text-muted leading-relaxed">{FUND_PRICE_NOTE}</p>
          {anyLive && <SourceLine id="security-quotes" className="mt-2" />}
        </>
      ) : (
        <>
          <p className="text-xs text-text-muted leading-relaxed">
            No fund in the catalog tracks this contract directly. Exposure requires a futures account or a broad-basket commodity ETF.
          </p>
          <p className="mt-3 pt-3 border-t border-border/60 text-[11px] text-text-muted leading-relaxed">
            ETFs track futures with roll costs and tracking error — a proxy, not the contract itself.
          </p>
        </>
      )}
    </div>
  )
}
