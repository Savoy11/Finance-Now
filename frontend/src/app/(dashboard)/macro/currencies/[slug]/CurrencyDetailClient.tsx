'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { PriceChartCard } from '@/components/markets/PriceChartCard'
import { FxHistoryCard, useFxReferencePairs } from '@/components/markets/FxHistoryCard'
import { SourceLine } from '@/components/ui/SourceLine'
import { CURRENCY_CATEGORY_INFO, formatFxRate, getCurrency } from '@/lib/data/currencyCatalog'
import { getFund } from '@/lib/data/fundCatalog'
import { ecbPairBySlug, isWorkedOut, shownPairRate } from '@/lib/data/fxReference'
import { STALE_TIME_SHORT } from '@/lib/constants'

// FX pair detail — rate, history chart, and pair facts including the inverse
// rate. Since T-445 (D203) every pair but the Dollar Index charts from the
// European Central Bank's daily reference rates, and its headline shows the
// ECB's rate for the day where there is no live quote, labelled as such.

interface Quote { price: number | null; change: number | null; changePercent: number | null; previousClose: number | null }
interface QuotesResponse { ok: boolean; quotes?: Record<string, Quote> }

export function CurrencyDetailClient({ slug }: { slug: string }) {
  // Slug validity is guaranteed by the server wrapper (notFound otherwise).
  const entry = getCurrency(slug)!
  const info = CURRENCY_CATEGORY_INFO[entry.category]
  const isIndex = entry.category === 'index'

  const { data: quote, isLoading } = useQuery<Quote | null>({
    queryKey: ['currency-quote', entry.symbol],
    queryFn: async () => {
      const res = await fetch(`/live-data/security-quotes?symbols=${encodeURIComponent(entry.symbol)}`)
      const json: QuotesResponse = await res.json()
      return json.quotes?.[entry.symbol] ?? null
    },
    staleTime: STALE_TIME_SHORT,
    refetchInterval: 1000 * 60 * 2,
  })

  // Every pair but the Dollar Index (ICE's index, which the ECB does not publish).
  const ecbPair = ecbPairBySlug(slug)
  const { data: reference, isLoading: referenceLoading } = useFxReferencePairs(ecbPair !== undefined)
  const ecbLatest = reference?.ok ? reference.pairs?.[slug] : undefined
  const shown = shownPairRate(quote, ecbLatest)
  const up = (shown?.changePct ?? 0) >= 0
  const proxies = entry.etfProxies
    .map((symbol) => ({ symbol, fund: getFund(symbol) }))
    .filter((p) => p.fund != null)

  return (
    <div className="space-y-6 max-w-(--breakpoint-xl) mx-auto">
      <div><Link href="/macro/currencies" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors">
        <ArrowLeft size={13} aria-hidden /> Currencies
      </Link></div>

      {/* Header + live rate */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-text-primary font-mono">{entry.name}</h1>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border border-border text-text-secondary">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: info.color }} aria-hidden />
              {info.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            {isIndex ? 'Basket index · ICE futures settlement' : `1 ${entry.base} in ${entry.quote} · spot`}
          </p>
        </div>
        <div className="text-right">
          {shown ? (
            <>
              <p className="text-2xl font-mono tabular-nums font-semibold text-text-primary">
                {formatFxRate(entry, shown.price)}
              </p>
              {shown.changePct != null && (
                <p className={clsx('text-sm font-mono tabular-nums', up ? 'text-emerald-400' : 'text-red-400')}>
                  {up ? '+' : ''}{shown.changePct.toFixed(2)}% {shown.basis === 'ecb' ? `since ${shown.previousDate}` : 'today'}
                </p>
              )}
              {shown.basis === 'ecb' && (
                <p className="text-[11px] text-text-muted">
                  ECB reference rate of {shown.date} · daily, not a live quote{ecbPair && isWorkedOut(ecbPair) ? ' · worked out from the Bank’s euro rates' : ''}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-text-muted">{isLoading || referenceLoading ? 'Fetching rate…' : 'Rate unavailable'}</p>
          )}
        </div>
      </div>

      {/* Provenance for the live quote above. Detail pages carried no
          SourceLine while every registry page did, so the page with the most
          specific numbers was the one with no attribution. */}
      <SourceLine id="macro-quotes" />
      {ecbPair && <SourceLine id="fx-pair-history" />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          {/* The keyed ladder has sent no pair's history on any audit since
              2026-09-09; the ECB's is official, daily and free (D203). */}
          {ecbPair ? <FxHistoryCard pair={ecbPair} /> : <PriceChartCard symbol={entry.symbol} valueFormat="plain" />}
        </div>

        <div className="space-y-4">
          <div className="rounded-card border border-border bg-bg-card p-4">
            <h2 className="text-sm font-medium text-text-secondary mb-3">{isIndex ? 'Index' : 'Pair'}</h2>
            <dl className="space-y-2 text-xs">
              {!isIndex && (
                <>
                  <div className="flex justify-between"><dt className="text-text-muted">Base</dt><dd className="text-text-primary font-mono">{entry.base}</dd></div>
                  <div className="flex justify-between"><dt className="text-text-muted">Quote</dt><dd className="text-text-primary font-mono">{entry.quote}</dd></div>
                </>
              )}
              <div className="flex justify-between"><dt className="text-text-muted">Category</dt><dd className="text-text-primary">{info.label}</dd></div>
              {shown?.basis === 'live' && quote?.previousClose != null && (
                <div className="flex justify-between"><dt className="text-text-muted">Previous close</dt><dd className="text-text-primary font-mono tabular-nums">{formatFxRate(entry, quote.previousClose)}</dd></div>
              )}
              {shown?.basis === 'ecb' && ecbLatest?.previousRate != null && (
                <div className="flex justify-between"><dt className="text-text-muted">ECB rate, {ecbLatest.previousDate}</dt><dd className="text-text-primary font-mono tabular-nums">{formatFxRate(entry, ecbLatest.previousRate)}</dd></div>
              )}
              {!isIndex && shown != null && shown.price > 0 && (
                <div className="flex justify-between">
                  <dt className="text-text-muted">Inverse</dt>
                  <dd className="text-text-primary font-mono tabular-nums">
                    1 {entry.quote} = {(1 / shown.price).toLocaleString(undefined, { maximumFractionDigits: 4 })} {entry.base}
                  </dd>
                </div>
              )}
            </dl>

            <p className="mt-3 pt-3 border-t border-border/60 text-xs text-text-muted leading-relaxed">{entry.description}</p>
            <p className="mt-3 text-[11px] text-text-muted leading-relaxed">
              A rising rate means a stronger {isIndex ? 'dollar' : entry.base} against the {isIndex ? 'basket' : entry.quote}.
            </p>
          </div>

          {/* ETF proxies */}
          <div className="rounded-card border border-border bg-bg-card p-4">
            <h2 className="text-sm font-medium text-text-secondary mb-3">ETF Proxies</h2>
            {proxies.length > 0 ? (
              <div className="space-y-2">
                {proxies.map(({ symbol, fund }) => (
                  <Link key={symbol} href={`/funds/${symbol.toLowerCase()}`}
                    className="flex items-center gap-2 text-xs group">
                    <span className="font-mono font-semibold text-text-primary group-hover:text-accent-blue transition-colors w-12">{symbol}</span>
                    <span className="text-text-muted flex-1 truncate">{fund!.name}</span>
                    <ExternalLink size={11} className="text-text-muted group-hover:text-accent-blue transition-colors" aria-hidden />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted leading-relaxed">
                No fund in the catalog gives direct exposure to this {isIndex ? 'index' : 'pair'}. {isIndex ? '' : 'Exposure requires a forex account or futures contract.'}
              </p>
            )}
            <p className="mt-3 pt-3 border-t border-border/60 text-[11px] text-text-muted leading-relaxed">
              These funds hold currency deposits (or the index futures), not the FX spot market itself — a proxy, subject to its own expense ratio and tracking error.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
