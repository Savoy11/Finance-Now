'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Landmark, PieChart } from 'lucide-react'
import { STALE_TIME_LONG } from '@/lib/constants'
import { formatCompact, formatCompactNumber } from '@/lib/utils/format'
import type { CompanyFactsResponse } from '@/app/live-data/company-facts/route'
import {
  INSTITUTIONAL_AS_FILED_NOTE,
  MULTI_CLASS_COUNTS_NOTE,
  MULTI_CLASS_NO_PCT_NOTE,
  STRUCTURE_DATES_DIFFER_NOTE,
  TREASURY_NOT_REPORTED_NOTE,
  fundHoldersScopeNote,
  institutionalPctOfOutstanding,
  thirteenFPeriodNote,
  unresolvedInPlainWords,
  type StockHoldersResponse,
} from '@/lib/data/stockHolders'

// Who holds a stock (T-471, owner request, 2026-11-24). Two sections on the
// stock page: the company's own share split (issued → treasury → outstanding,
// from its SEC filings via /live-data/company-facts) with what institutional
// managers reported holding (SEC Form 13F data set, built offline), and the
// catalog funds that hold the stock (their N-PORT filings, same build).
// Figures and dates only — no grade, no ranking vocabulary beyond "largest",
// and every known limit of the data said on the card, not hidden.

const asOfDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function useStockHolders(symbol: string) {
  return useQuery<StockHoldersResponse>({
    queryKey: ['stock-holders', symbol],
    queryFn: async () => {
      const r = await fetch(`/live-data/stock-holders?symbol=${encodeURIComponent(symbol)}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() // ok:false is a real answer (unresolved), not a failure
    },
    staleTime: STALE_TIME_LONG * 6,
  })
}

function useCompanyFacts(symbol: string) {
  // Shares the ['company-facts', symbol] query with FinancialRatios,
  // FundamentalsTrend and QuarterlyResults — one SEC download per page.
  return useQuery<CompanyFactsResponse>({
    queryKey: ['company-facts', symbol],
    queryFn: async () => {
      const r = await fetch(`/live-data/company-facts?symbol=${encodeURIComponent(symbol)}`)
      const j: CompanyFactsResponse = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
      return j
    },
    staleTime: STALE_TIME_LONG * 6,
  })
}

function FigureRow({ label, shares, asOf, sub }: { label: string; shares: number; asOf: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border/60 last:border-0">
      <div>
        <span className="text-sm text-text-primary">{label}</span>
        {sub && <span className="block text-[10px] text-text-muted">{sub}</span>}
      </div>
      <div className="text-right shrink-0">
        <span className="font-mono tabular-nums text-sm text-text-primary">{formatCompactNumber(shares)}</span>
        <span className="block text-[10px] text-text-muted">as of {asOfDate(asOf)}</span>
      </div>
    </div>
  )
}

/** Card A: the company's own share split, then what institutions reported. */
export function StockOwnershipCard({ symbol }: { symbol: string }) {
  const facts = useCompanyFacts(symbol)
  const holders = useStockHolders(symbol)
  const s = facts.data?.shareStructure
  const entry = holders.data?.entry ?? null
  if (facts.isLoading && holders.isLoading) return null
  if (!s && !holders.data) return null

  const outstanding = s?.outstanding ?? null
  // A multi-class symbol's 13F total covers one class while the company's
  // counts cover them all — shares only, never a percent of them.
  const pct = entry?.institutional && outstanding && !entry.multiClass
    ? institutionalPctOfOutstanding(entry.institutional.totalShares, outstanding.shares)
    : null

  return (
    <section aria-labelledby="stock-ownership-heading" className="rounded-card border border-border bg-bg-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 id="stock-ownership-heading" className="text-sm font-medium text-text-secondary flex items-center gap-2">
          <PieChart size={14} className="text-text-muted" aria-hidden />
          Who Holds It
        </h2>
        <span className="text-[11px] text-text-muted">SEC filings{holders.data ? ` · built ${holders.data.builtOn}` : ''}</span>
      </div>

      {s && (s.issued || s.outstanding) ? (
        <div className="mb-3">
          {s.issued && <FigureRow label="Shares issued" shares={s.issued.shares} asOf={s.issued.asOf} />}
          {s.treasuryReported && s.treasury ? (
            <FigureRow
              label="Held by the company (treasury)"
              shares={s.treasury.shares}
              asOf={s.treasury.asOf}
              sub={s.treasuryPctOfIssued != null ? `${s.treasuryPctOfIssued.toFixed(1)}% of issued shares` : undefined}
            />
          ) : (
            <p className="py-1.5 text-[11px] text-text-muted border-b border-border/60">{TREASURY_NOT_REPORTED_NOTE}</p>
          )}
          {s.outstanding && <FigureRow label="In the market (outstanding)" shares={s.outstanding.shares} asOf={s.outstanding.asOf} />}
          {entry?.multiClass && (
            <p className="mt-1.5 text-[10px] text-text-muted">{MULTI_CLASS_COUNTS_NOTE}</p>
          )}
          {s.reconciles === false && (
            <p className="mt-1.5 text-[10px] text-text-muted">{STRUCTURE_DATES_DIFFER_NOTE}</p>
          )}
        </div>
      ) : facts.error ? (
        <p className="mb-3 text-xs text-text-muted">Share figures unavailable: SEC EDGAR could not be reached.</p>
      ) : null}

      {entry?.institutional ? (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-text-primary">Reported by institutional managers</span>
            <span className="font-mono tabular-nums text-sm text-text-primary shrink-0">
              {formatCompactNumber(entry.institutional.totalShares)}
            </span>
          </div>
          <p className="text-[11px] text-text-secondary mt-0.5">
            {pct != null && <>{pct.toFixed(1)}% of the shares in the market, </>}
            across {entry.institutional.holderCount.toLocaleString('en-US')} reporting managers
          </p>
          {entry.multiClass && (
            <p className="text-[10px] text-text-muted mt-0.5">{MULTI_CLASS_NO_PCT_NOTE}</p>
          )}
          <ul className="mt-2 space-y-1">
            {entry.institutional.topHolders.map((h) => (
              <li key={h.cik} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-text-secondary truncate" title={h.name}>{h.name}</span>
                <span className="font-mono tabular-nums text-text-primary shrink-0">
                  {formatCompactNumber(h.shares)}
                  <span className="text-text-muted"> · {formatCompact(h.valueUsd)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-text-muted leading-relaxed">
            {thirteenFPeriodNote(holders.data!.period)} {INSTITUTIONAL_AS_FILED_NOTE}
          </p>
        </div>
      ) : holders.data && !holders.isLoading ? (
        <p className="text-[11px] text-text-muted leading-relaxed">
          Institutional figures are not shown. {unresolvedInPlainWords(holders.data.unresolvedReason)}
        </p>
      ) : holders.error ? (
        <p className="text-[11px] text-text-muted">Institutional figures unavailable right now.</p>
      ) : null}
    </section>
  )
}

/** Card B: the catalog funds holding the stock, largest first. */
export function FundHoldersCard({ symbol }: { symbol: string }) {
  const holders = useStockHolders(symbol)
  if (holders.isLoading || holders.error) return null
  const data = holders.data
  if (!data) return null
  const funds = data.entry?.funds ?? []

  return (
    <section aria-labelledby="fund-holders-heading" className="rounded-card border border-border bg-bg-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 id="fund-holders-heading" className="text-sm font-medium text-text-secondary flex items-center gap-2">
          <Landmark size={14} className="text-text-muted" aria-hidden />
          ETFs &amp; Funds Holding {symbol}
        </h2>
        <span className="text-[11px] text-text-muted">SEC N-PORT filings</span>
      </div>

      {!data.entry ? (
        <p className="text-[11px] text-text-muted leading-relaxed">{unresolvedInPlainWords(data.unresolvedReason)}</p>
      ) : funds.length === 0 ? (
        <p className="text-[11px] text-text-muted">None of the funds this app tracks reported holding this stock.</p>
      ) : (
        <>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-text-muted">
                <th className="text-left font-medium pb-1.5">Fund</th>
                <th className="text-right font-medium pb-1.5 pl-2">Shares</th>
                <th className="text-right font-medium pb-1.5 pl-2">Value</th>
                <th className="text-right font-medium pb-1.5 pl-2">% of fund</th>
                <th className="text-right font-medium pb-1.5 pl-2">As of</th>
              </tr>
            </thead>
            <tbody>
              {funds.map((f) => (
                <tr key={f.symbol} className="border-t border-border/60">
                  <td className="py-1.5 pr-2">
                    <Link href={`/funds/${f.symbol}`} className="text-accent-blue hover:underline">{f.symbol}</Link>
                    <span className="block text-[10px] text-text-muted truncate max-w-[180px]" title={f.name}>{f.name}</span>
                  </td>
                  <td className="text-right font-mono tabular-nums py-1.5 pl-2 text-text-primary">{formatCompactNumber(f.shares)}</td>
                  <td className="text-right font-mono tabular-nums py-1.5 pl-2 text-text-primary">{f.valueUsd != null ? formatCompact(f.valueUsd) : '—'}</td>
                  <td className="text-right font-mono tabular-nums py-1.5 pl-2 text-text-secondary">{f.pctVal != null ? `${f.pctVal.toFixed(2)}%` : '—'}</td>
                  <td className="text-right font-mono tabular-nums py-1.5 pl-2 text-text-muted whitespace-nowrap">{asOfDate(f.asOf)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-text-muted leading-relaxed">{fundHoldersScopeNote(data.fundsRead)}</p>
        </>
      )}
    </section>
  )
}

/** Both sections, in the order the owner asked for them. */
export function StockOwnershipCards({ symbol }: { symbol: string }) {
  return (
    <>
      <StockOwnershipCard symbol={symbol} />
      <FundHoldersCard symbol={symbol} />
    </>
  )
}
