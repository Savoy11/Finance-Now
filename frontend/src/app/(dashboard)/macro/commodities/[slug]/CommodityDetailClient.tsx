'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { ArrowLeft } from 'lucide-react'
import { PriceChartCard } from '@/components/markets/PriceChartCard'
import { TermStructureCard } from '@/components/markets/TermStructureCard'
import { SourceLine } from '@/components/ui/SourceLine'
import { AssetActions } from '@/components/markets/AssetActions'
import { InstrumentNewsCard } from '@/components/markets/InstrumentNewsCard'
import { CommodityFundsCard } from '@/components/markets/CommodityFundsCard'
import {
  COMMODITY_CATEGORY_INFO, getCommodity, formatCommodityPrice,
} from '@/lib/data/commodityCatalog'
import { STALE_TIME_SHORT } from '@/lib/constants'

// Commodity contract detail — live quote, price history (shared markets
// shell), contract facts, and the funds that hold it, each with its own live
// price (T-462).

interface Quote { price: number | null; change: number | null; changePercent: number | null; previousClose: number | null }
interface QuotesResponse { ok: boolean; quotes?: Record<string, Quote> }

export function CommodityDetailClient({ slug }: { slug: string }) {
  // Slug validity is guaranteed by the server wrapper (notFound otherwise).
  const entry = getCommodity(slug)!
  const info = COMMODITY_CATEGORY_INFO[entry.category]

  const { data: quote, isLoading } = useQuery<Quote | null>({
    queryKey: ['commodity-quote', entry.symbol],
    queryFn: async () => {
      const res = await fetch(`/live-data/security-quotes?symbols=${encodeURIComponent(entry.symbol)}`)
      const json: QuotesResponse = await res.json()
      return json.quotes?.[entry.symbol] ?? null
    },
    staleTime: STALE_TIME_SHORT,
    refetchInterval: 1000 * 60 * 2,
  })

  const up = (quote?.changePercent ?? 0) >= 0

  return (
    <div className="space-y-6 max-w-(--breakpoint-xl) mx-auto">
      <div><Link href="/macro/commodities" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors">
        <ArrowLeft size={13} aria-hidden /> Commodities
      </Link></div>

      {/* Header + live quote */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-text-primary">{entry.name}</h1>
            <span className="font-mono text-sm text-text-muted">{entry.symbol}</span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border border-border text-text-secondary">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: info.color }} aria-hidden />
              {info.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">{entry.exchange} · front-month continuous contract</p>
        </div>
        <div className="text-right">
          {quote?.price != null ? (
            <>
              <p className="text-2xl font-mono tabular-nums font-semibold text-text-primary">
                {formatCommodityPrice(entry, quote.price)}
              </p>
              {quote.changePercent != null && (
                <p className={clsx('text-sm font-mono tabular-nums', up ? 'text-emerald-400' : 'text-red-400')}>
                  {up ? '+' : ''}{quote.changePercent.toFixed(2)}% today
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-text-muted">{isLoading ? 'Fetching live quote…' : 'Live quote unavailable'}</p>
          )}
        </div>
      </div>

      {/* Provenance for the live quote above. Detail pages carried no
          SourceLine while every registry page did, so the page with the most
          specific numbers was the one with no attribution. */}
      <SourceLine id="macro-quotes" />

      {/* Watch it, compare it, ask the AI (T-454). No price alert: macro quotes are
          mostly unserved, and their units are not dollars. */}
      <AssetActions asset={{ kind: 'macro', symbol: entry.symbol, name: entry.name, key: `sec:${entry.symbol}` }} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          {/* Cents-quoted contracts (grains, softs, livestock) chart as bare
              numbers — a $-prefixed axis would mislabel 472¢ corn as $472. */}
          <PriceChartCard symbol={entry.symbol} valueFormat={entry.quoteBasis === 'cents' ? 'plain' : 'usd'} />

          {/* The forward curve is what the ETF-proxy caveat below is actually
              about: contango IS the roll cost that makes a futures-backed fund
              lag spot. Sits under the price chart so the two read together. */}
          <div className="mt-4">
            <TermStructureCard slug={slug} />
          </div>
        </div>

        <div className="space-y-4">
          {/* Contract facts */}
          <div className="rounded-card border border-border bg-bg-card p-4">
            <h2 className="text-sm font-medium text-text-secondary mb-3">Contract</h2>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between"><dt className="text-text-muted">Exchange</dt><dd className="text-text-primary">{entry.exchange}</dd></div>
              <div className="flex justify-between"><dt className="text-text-muted">Quoted in</dt><dd className="text-text-primary font-mono">{entry.quoteBasis === 'cents' ? '¢' : '$'} per {entry.unit}</dd></div>
              <div className="flex justify-between"><dt className="text-text-muted">Category</dt><dd className="text-text-primary">{info.label}</dd></div>
              {quote?.previousClose != null && (
                <div className="flex justify-between"><dt className="text-text-muted">Previous close</dt><dd className="text-text-primary font-mono tabular-nums">{formatCommodityPrice(entry, quote.previousClose)}</dd></div>
              )}
            </dl>
            <p className="mt-3 pt-3 border-t border-border/60 text-xs text-text-muted leading-relaxed">{entry.description}</p>
          </div>

          {/* The funds that hold it, each with its own live price (T-462). */}
          <CommodityFundsCard entry={entry} />
        </div>
      </div>

      {/* The macro stories that name this instrument (T-456 b). */}
      <InstrumentNewsCard href={`/macro/commodities/${slug}`} name={entry.name} />
    </div>
  )
}
