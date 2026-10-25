'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { ArrowLeft, Calculator, Clock, ExternalLink, TrendingDown, TrendingUp } from 'lucide-react'
import { ModuleGate } from '@/components/layout/ModuleGate'
import { FundHoldingsHistory } from './FundHoldingsHistory'
import { FundHoldingsSection } from './FundHoldingsSection'
import { FundRateSensitivityCard } from './FundRateSensitivityCard'
import { ExplainedLabel } from '@/components/ui/ExplainedLabel'
import { SourceLine } from '@/components/ui/SourceLine'
import { ProvenanceNotice } from '@/components/ui/ProvenanceNotice'
import { PriceChartCard, FiftyTwoWeekBar } from '@/components/markets/PriceChartCard'
import { MarketNewsList } from '@/components/markets/MarketNewsList'
import {
  computeFeeDrag, fundSalesCharge, FUND_CATEGORY_INFO, FUND_RISK_INFO, FUND_STRATEGY_INFO,
  fundAssetsFact, fundShownYield, fundYieldFact, fundYieldLink, fundRiskLevel, fundStrategy, fundTradingRestriction, getFund,
  getFundFeeProvenance, getFundFiguresProvenance,
} from '@/lib/data/fundCatalog'
import type { SalesCharge } from '@/lib/data/fundCatalog'
import { TaxEquivalentYieldCard } from '@/components/markets/TaxEquivalentYieldCard'
import { SECTOR_INFO } from '@/lib/data/equityCatalog'
import { formatCompact, formatCurrency, formatPercent } from '@/lib/utils/format'
import { STALE_TIME_LONG, STALE_TIME_SHORT } from '@/lib/constants'
import type { SecurityQuotesResponse } from '@/app/live-data/security-quotes/route'
import type { FundUniverseResponse } from '@/app/live-data/fund-universe/route'
import { RISK_RATINGS_SHOWN } from '@/lib/risk/visibility'
import { fundStructureFacts } from '@/lib/data/fundStructure'
import { FeatureNotice } from '@/components/legal/FeatureNotice'
import { FundProspectusLink, useFundProspectus } from './FundProspectusLink'

// ─── Fee drag analyzer ────────────────────────────────────────────────────────
// Projects what this fund's expense ratio costs versus a 0.03% benchmark fund
// at an assumed gross return — the compounding cost most fund pages hide.

const HORIZONS = [10, 20, 30] as const

/**
 * Federally tax-exempt funds in the catalog. A list, not a name-match on
 * "muni": a fund is exempt because of what it holds, and guessing from a
 * string would eventually attach a tax claim to the wrong fund.
 */
const MUNI_FUNDS = new Set(['MUB', 'VTEB', 'TFI'])
const isMuniFund = (symbol: string) => MUNI_FUNDS.has(symbol.toUpperCase())

function FeeDragCard({ expenseRatioPct, symbol, salesCharge, website }: {
  expenseRatioPct: number
  symbol: string
  salesCharge: SalesCharge | null
  website: string
}) {
  // A load with a VERIFIED rate goes into the maths. One without a rate is
  // disclosed in words and left out of the projection — guessing it would be
  // worse than omitting it, and omitting it silently would be worse than both.
  const loadPct = salesCharge?.kind === 'front' ? salesCharge.maxPct : undefined
  const unverifiedLoad = salesCharge != null && salesCharge.maxPct == null
  // The notice below sends the reader to "the fund's prospectus": the filing
  // itself where EDGAR has it, else the issuer's site, which hosts it (T-420).
  const prospectusUrl = useFundProspectus(symbol)?.url ?? website
  const [principal, setPrincipal] = useState(10_000)
  const [annualReturn, setAnnualReturn] = useState(7)

  return (
    <div className="rounded-card border border-border bg-bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Calculator size={14} className="text-text-muted" aria-hidden />
        <h2 className="text-sm font-medium text-text-secondary">Fee Drag Analyzer</h2>
      </div>
      <p className="text-xs text-text-muted leading-relaxed mb-4">
        What {symbol}&rsquo;s {expenseRatioPct}% expense ratio costs versus a 0.03% index fund,
        assuming {annualReturn}% gross annual return.
      </p>

      {salesCharge && (
        <div className={clsx('mb-4 rounded-sm border px-3 py-2 text-[11px] leading-relaxed',
          unverifiedLoad ? 'border-amber-400/40 bg-amber-400/5 text-amber-200' : 'border-orange-400/40 bg-orange-400/5 text-orange-200')}>
          {loadPct != null ? (
            <>
              <strong>Includes a {loadPct}% {salesCharge.kind}-end sales load.</strong>{' '}
              On the figures below, {formatCurrency(principal * (loadPct / 100), 0)} is deducted at
              purchase and never invested — the projection starts from what is left.
              {salesCharge.source && salesCharge.verifiedAt && (
                <> Rate from {salesCharge.source}, read {salesCharge.verifiedAt}.</>
              )}
            </>
          ) : (
            <>
              <strong>This fund carries a {salesCharge.kind}-end sales load, and the figures
              below do NOT include it.</strong>{' '}
              The rate has not been verified against the prospectus, and a guessed number would be
              worse than none — so the projection shows the expense ratio only and understates the
              real cost. Check the{' '}
              <a href={prospectusUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-text-primary">
                fund&rsquo;s prospectus
              </a>{' '}
              for the current sales charge.
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <label className="block">
          <span className="text-[11px] text-text-muted uppercase tracking-wider">Investment</span>
          <div className="mt-1 flex items-center rounded-sm border border-border bg-bg-elevated px-2">
            <span className="text-xs text-text-muted">$</span>
            <input
              type="number"
              min={100}
              step={1000}
              value={principal}
              onChange={(e) => setPrincipal(Math.max(0, Number(e.target.value)))}
              className="w-full bg-transparent px-1.5 py-1.5 text-sm font-mono text-text-primary focus:outline-hidden"
            />
          </div>
        </label>
        <label className="block">
          <span className="text-[11px] text-text-muted uppercase tracking-wider">Gross Return %</span>
          <input
            type="number"
            min={0}
            max={20}
            step={0.5}
            value={annualReturn}
            onChange={(e) => setAnnualReturn(Math.min(20, Math.max(0, Number(e.target.value))))}
            className="mt-1 w-full rounded-sm border border-border bg-bg-elevated px-2.5 py-1.5 text-sm font-mono text-text-primary focus:border-accent-blue/50 focus:outline-hidden"
          />
        </label>
      </div>

      <div className="space-y-2">
        {HORIZONS.map((years) => {
          const series = computeFeeDrag(principal, expenseRatioPct, years, annualReturn, 0.03, loadPct ?? 0)
          const final = series[series.length - 1]
          if (!final) return null
          const dragPct = final.withBenchmarkFee > 0 ? (final.feesPaid / final.withBenchmarkFee) * 100 : 0
          // A handful of funds are cheaper than the 0.03% benchmark (FXAIX at
          // 0.015% today), which makes feesPaid negative. Clamping it to zero
          // and keeping the minus sign rendered "−$0 (−0.3%)" — a double
          // negative that reads as a cost when it is a saving.
          const cheaper = final.feesPaid < 0
          return (
            <div key={years} className="rounded-sm border border-border/60 bg-bg-elevated/40 px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">{years} years</span>
                <span className="font-mono tabular-nums text-text-primary">{formatCurrency(final.withFee, 0)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-text-muted">{cheaper ? 'saving vs 0.03% fund' : 'cost vs 0.03% fund'}</span>
                <span className={clsx('font-mono tabular-nums',
                  cheaper ? 'text-emerald-400' : dragPct > 5 ? 'text-orange-400' : dragPct > 1 ? 'text-amber-400' : 'text-emerald-400')}>
                  {cheaper ? '+' : '−'}{formatCurrency(Math.abs(final.feesPaid), 0)} ({Math.abs(dragPct).toFixed(1)}%)
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <FeatureNotice feature="calculators" className="mt-3" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// The gate wraps at the COMPONENT boundary, not inside the returned JSX. Placed
// inside, the inner component still mounts and its useQuery hooks still run and
// poll while the module is locked (W4-C2) — the lock notice renders over live
// fetching. CLAUDE.md's "Adding a New Page" checklist states this rule.
export default function FundDetailPage() {
  return (
    <ModuleGate module="funds">
      <FundDetailInner />
    </ModuleGate>
  )
}

function FundDetailInner() {
  const params = useParams<{ symbol: string }>()
  const symbol = (params.symbol ?? '').toUpperCase()
  const entry = getFund(symbol)

  // Non-catalog tickers (the discovered universe) resolve name/type via the
  // fund-universe directory lookup — their detail data comes live by symbol.
  const { data: uniData, isLoading: uniLoading } = useQuery<FundUniverseResponse>({
    queryKey: ['fund-universe-lookup', symbol],
    queryFn: () => fetch(`/live-data/fund-universe?symbol=${encodeURIComponent(symbol)}`).then((r) => r.json()),
    staleTime: STALE_TIME_LONG,
    enabled: !entry && symbol.length > 0,
  })
  const uniEntry = !entry ? uniData?.entries?.find((e) => e.symbol === symbol) ?? null : null

  const { data } = useQuery<SecurityQuotesResponse>({
    queryKey: ['security-quotes', symbol],
    queryFn: () => fetch(`/live-data/security-quotes?symbols=${encodeURIComponent(symbol)}`).then((r) => r.json()),
    staleTime: STALE_TIME_SHORT,
    refetchInterval: 60_000,
    enabled: !!entry || !!uniEntry,
  })

  if (!entry && uniLoading) {
    return (
      <div className="space-y-4 max-w-(--breakpoint-xl) mx-auto">
        <div className="h-16 animate-pulse rounded-card bg-bg-elevated/60" />
        <div className="h-80 animate-pulse rounded-card bg-bg-elevated/60" />
      </div>
    )
  }

  if (!entry && !uniEntry) {
    return (
      <div className="max-w-md mx-auto mt-24 rounded-card border border-border bg-bg-card p-8 text-center">
        <p className="text-sm font-medium text-text-primary">Unknown fund “{symbol}”</p>
        <p className="mt-1 text-xs text-text-muted">
          This ticker isn’t in the curated catalog or the live ETF / mutual fund directories.
        </p>
        <Link href="/funds" className="inline-block mt-4 text-xs text-accent-blue hover:underline">
          ← Back to Fund Registry
        </Link>
      </div>
    )
  }

  const name = entry?.name ?? uniEntry?.name ?? symbol
  const type = entry?.type ?? uniEntry?.type ?? 'etf'
  // Two dates since D117: the expense ratio is checked against filings, the other
  // figures are approximate.
  const feeProvenance = getFundFeeProvenance()
  const figuresProvenance = getFundFiguresProvenance()
  const quote = data?.quotes?.[symbol]
  const live = !!quote && data?.source !== 'reference' && !quote.reference
  const price = quote?.price ?? entry?.referencePrice ?? null
  const change = live ? quote?.changePercent ?? null : null
  const category = entry ? FUND_CATEGORY_INFO[entry.category] : null

  const facts: Array<{ label: string; value: string; explain: string; link?: { href: string; text: string; title: string } }> = entry ? [
    { label: 'Issuer', value: entry.issuer,
      explain: 'The fund company managing the assets. Scale matters: large issuers tend to mean tighter trading spreads, lower fees, and less risk the fund gets closed.' },
    { label: 'Type', value: entry.type === 'etf' ? 'Exchange-Traded Fund' : 'Mutual Fund',
      explain: 'ETFs trade all day on an exchange at market prices and are generally more tax-efficient; mutual funds price once daily at NAV and may carry investment minimums.' },
    { label: 'Strategy', value: FUND_STRATEGY_INFO[fundStrategy(entry)].label,
      explain: FUND_STRATEGY_INFO[fundStrategy(entry)].description },
    // Switched off with every other risk rating until the risk engine is
    // rebuilt (D64): a risk label on the page of the fund being viewed.
    ...(RISK_RATINGS_SHOWN ? [{ label: 'Risk Profile', value: FUND_RISK_INFO[fundRiskLevel(entry)].label,
      explain: 'A coarse suitability band derived from the fund’s category and strategy — leveraged/inverse and crypto funds rank Speculative, bond funds Conservative. Not a market-data risk score.' }] : []),    ...(entry.focusSector ? [{ label: 'Target Sector', value: SECTOR_INFO[entry.focusSector].label,
      explain: 'The single sector this fund concentrates in. Sector funds trade diversification for focused exposure — expect bigger swings than broad-market funds.' }] : []),
    ...(entry.focusIndustry ? [{ label: 'Industry Focus', value: entry.focusIndustry,
      explain: 'The industries within that sector where the fund’s holdings actually sit — narrower focus means the fund lives and dies with this slice of the market.' }] : []),
    { label: 'Expense Ratio', value: `${entry.expenseRatioPct}%`,
      explain: 'The annual fee skimmed from returns, visible or not. The single most reliable predictor of long-run relative performance — compounding works against you here. The Fee Drag Analyzer below shows the dollar cost.' },
    fundAssetsFact(entry, formatCompact),
    (() => { const y = fundYieldFact(entry); return { label: y.label, value: y.value, explain: y.explain, link: y.link } })(),
    { label: 'Inception', value: String(entry.inceptionYear),
      explain: 'Launch year. A longer track record shows how the fund behaved across full market cycles, not just the recent regime.' },
    { label: 'Index', value: entry.indexTracked ?? 'Actively managed',
      explain: 'The benchmark the fund replicates — cheap and predictable — versus active management, where returns depend on manager skill and fees are typically higher.' },
  ] : []

  return (
    <div className="space-y-6 max-w-(--breakpoint-xl) mx-auto">
      {/* Header */}
      <div>
        <Link href="/funds" className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors">
          <ArrowLeft size={12} aria-hidden /> Fund Registry
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-text-primary">{name}</h1>
              <span className="font-mono text-sm text-text-muted">{symbol}</span>
              <span className={clsx('px-1.5 py-0.5 rounded-sm text-[10px] font-bold border',
                type === 'etf'
                  ? 'text-accent-blue bg-accent-blue/10 border-accent-blue/20'
                  : 'text-violet-400 bg-violet-400/10 border-violet-500/20')}>
                {type === 'etf' ? 'ETF' : 'MUTUAL FUND'}
              </span>
              {category && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-medium border border-border text-text-secondary">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: category.color }} aria-hidden />
                  {category.label}
                </span>
              )}
            </div>
            {entry ? (
              <p className="mt-1 text-xs text-text-muted">
                {entry.description}
                {' · '}
                <a href={entry.website} target="_blank" rel="noopener noreferrer" className="text-accent-blue/80 hover:text-accent-blue inline-flex items-center gap-0.5">
                  {entry.website.replace(/^https?:\/\/(www\.)?/, '').split(/[/?]/)[0]} <ExternalLink size={10} aria-hidden />
                </a>
                <FundProspectusLink symbol={symbol} />
              </p>
            ) : (
              <p className="mt-1 text-xs text-text-muted">
                Discovered via the {type === 'etf' ? 'NASDAQ symbol directory' : 'SEC fund registry'} —
                quotes, chart, and holdings load live by ticker.
                <FundProspectusLink symbol={symbol} />
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="font-mono text-3xl font-bold text-text-primary tabular-nums">
              {price != null ? formatCurrency(price) : '—'}
              {!live && price != null && <span className="ml-2 text-xs text-amber-400/80 align-middle font-sans" title="Reference price — live source unreachable">ref</span>}
            </p>
            {change != null && (
              <p className={clsx('mt-0.5 flex items-center justify-end gap-1 font-mono text-sm tabular-nums',
                change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {change >= 0 ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}
                {formatPercent(change, 2)} today
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Provenance for the quote above. Detail pages carried no SourceLine
          while every registry page did, so the page with the most specific
          numbers was the one with no attribution. */}
      <SourceLine id="security-quotes" />

      {/* Trading-restriction disclaimer — minimum holding periods, frequent-trading
          policies, and daily-reset leverage warnings */}
      {(() => {
        const restriction = entry ? fundTradingRestriction(entry) : uniEntry?.tradingRestriction ?? null
        if (!restriction) return null
        return (
          <div className="flex items-start gap-3 rounded-card border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <Clock size={14} className="mt-0.5 text-amber-400/80 shrink-0" aria-hidden />
            <div>
              <p className="text-xs font-medium text-amber-400">Trading restrictions apply</p>
              <p className="mt-0.5 text-xs text-text-muted leading-relaxed">{restriction}</p>
            </div>
          </div>
        )
      })()}

      {/* Chart + facts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <PriceChartCard symbol={symbol} />
          <FiftyTwoWeekBar symbol={symbol} price={price} />
        </div>

        <div className="space-y-4">
          {entry ? (
            <>
              <div className="rounded-card border border-border bg-bg-card p-4">
                <h2 className="text-sm font-medium text-text-secondary mb-3">Fund Facts</h2>
                <dl className="space-y-2.5">
                  {facts.map(({ label, value, explain, link }) => (
                    <div key={label} className="flex items-center justify-between gap-3 text-sm">
                      <dt className="text-text-muted shrink-0">
                        <ExplainedLabel label={label} explain={explain} />
                      </dt>
                      {/* Only the yield carries a link (D166): it changes often, so the
                          fund's own page sits beside it. The other facts rely on the
                          header's link to the same page. */}
                      <dd className="font-mono tabular-nums text-text-primary text-right text-xs">
                        {value}
                        {link && (
                          <a href={link.href} target="_blank" rel="noopener noreferrer" title={link.title}
                            className="ml-2 inline-flex items-center gap-0.5 font-sans text-[11px] text-accent-blue hover:underline">
                            {link.text} <ExternalLink size={10} aria-hidden />
                          </a>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              {/* The facts above other than the expense ratio. A figure with a date
                  comes from that filing; the rest are approximate (D117). Always
                  visible, for the reason given at the fee notice below. */}
              <ProvenanceNotice
                label="Approximate figures"
                staleLabel="Approximate figures may be out of date"
                confidence={figuresProvenance.confidence}
                stale={figuresProvenance.stale}
              >
                Assets shown with a date are the fund&rsquo;s SEC filing for that date. A yield is
                shown only where the fund&rsquo;s own site allows it, with the date its page gave, and it
                may have changed since: the fund&rsquo;s page, linked beside it, has the current yield.
                The tracked index and any figure marked &asymp; are approximate: {figuresProvenance.source},
                the oldest on {figuresProvenance.compiledOn} ({figuresProvenance.ageDays}d ago). Check the
                issuer&rsquo;s fact sheet for current figures.
              </ProvenanceNotice>
              {/* What replaces the switched-off Risk Profile label (D92, T-420):
                  facts about how the fund is built, from the catalog's own
                  fields. Shown in full, not behind a hover, since they are the
                  point of the card. */}
              {(() => {
                const structure = fundStructureFacts(entry)
                if (structure.length === 0) return null
                return (
                  <div className="rounded-card border border-border bg-bg-card p-4">
                    <h2 className="text-sm font-medium text-text-secondary mb-3">How It&rsquo;s Built</h2>
                    <dl className="space-y-2.5">
                      {structure.map(({ label, text }) => (
                        <div key={label}>
                          <dt className="text-xs font-medium text-text-primary">{label}</dt>
                          <dd className="mt-0.5 text-xs text-text-muted leading-relaxed">{text}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )
              })()}
              <FundRateSensitivityCard symbol={symbol} />
              {/* Always visible, not only when stale — the fee figures above and
                  the 30-year projection below are computed on this table, and a
                  notice that only appears past a threshold teaches readers to
                  treat its absence as "live" (W4-C7). */}
              <ProvenanceNotice
                label="Expense ratio checked against SEC filings"
                staleLabel="Expense ratio may be out of date"
                confidence={feeProvenance.confidence}
                stale={feeProvenance.stale}
              >
                {feeProvenance.source}. Every fund&rsquo;s fee was checked; the oldest check was on{' '}
                {feeProvenance.verifiedAt} ({feeProvenance.ageDays}d ago). The Fee Drag projection is
                computed on this figure and is only as current as it is. Check the issuer&rsquo;s fact
                sheet before acting on a fee figure.
              </ProvenanceNotice>
              <FeeDragCard expenseRatioPct={entry.expenseRatioPct} symbol={symbol} salesCharge={fundSalesCharge(entry)} website={entry.website} />
              {/* Items 11/13: municipal funds arrived with this pass, and their
                  headline yield is not comparable to a taxable fund's. Shown
                  only for the funds it actually applies to. */}
              {isMuniFund(entry.symbol) && (() => {
                const y = fundShownYield(entry)
                return (
                  <TaxEquivalentYieldCard symbol={entry.symbol} link={fundYieldLink(entry)}
                    shownYieldPct={y.shown ? y.pct : null} shownAsOf={y.shown ? y.asOf : null} />
                )
              })()}
            </>
          ) : (
            <div className="rounded-card border border-border bg-bg-card p-4">
              <h2 className="text-sm font-medium text-text-secondary mb-2">Fund Facts</h2>
              <p className="text-xs text-text-muted leading-relaxed">
                This fund isn&rsquo;t in the curated catalog, so reference facts (expense ratio,
                AUM, yield, tracked index) aren&rsquo;t available yet. The quote, chart, holdings
                breakdown, and change history below are fetched live by ticker — holdings come
                straight from the fund&rsquo;s SEC N-PORT disclosures.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Full breakdown of underlying investments + quarter-over-quarter changes */}
      <FundHoldingsSection symbol={symbol} />
      <FundHoldingsHistory symbol={symbol} />

      {/* News — mutual funds rarely have ticker news, show general market feed */}
      <MarketNewsList symbol={type === 'etf' ? symbol : undefined} limit={8} />

      <p className="text-[11px] text-text-muted text-center">
        {entry ? 'Fund facts are reference snapshots from issuer disclosures · ' : 'Fund name from live listing directories · '}
        Quotes: {data?.source === 'reference' || !data ? 'reference prices' : `live via ${data.source}`}
      </p>
    </div>
  )
}
