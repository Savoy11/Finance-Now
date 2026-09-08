'use client'

import { clsx } from 'clsx'
import { Landmark, AlertTriangle } from 'lucide-react'
import {
  FUND_CATEGORY_INFO, FUND_STRATEGY_INFO, fundStrategy, fundSalesCharge, getFund,
  type FundEntry,
} from '@/lib/data/fundCatalog'
import { feeImpact, feeCostDisplay, DEFAULT_FEE_IMPACT_PARAMS, FEE_IMPACT_BENCHMARK_ER_PCT } from '@/lib/data/feeImpact'
import { formatCompact, formatCurrency } from '@/lib/utils/format'

// ─── Side-by-side fund facts (S6, T-069) ──────────────────────────────────────
//
// /compare's reference table is equity-shaped — Type, Sector, Market cap, P/E,
// Dividend yield, Beta, Expense ratio. For a fund, five of those seven rows are
// a dash, and the fields that actually distinguish two funds (issuer, AUM,
// inception, tracked index, strategy, load, and what the fees COST) never
// appear at all. This is that table.
//
// It renders only when two or more selections are catalogued funds, beside the
// holdings-overlap section: overlap answers "are these the same bet?", this
// answers "and what do they cost and hold?".
//
// ⚠ On bond duration and credit quality, deliberately: `FundEntry` carries
// NEITHER. Every bond fund here is simply `category: 'bond'`; the maturity
// mandate lives in the `indexTracked` string ("ICE US Treasury 1-3 Year",
// "20+ Year") and in prose. So this table shows the tracked index verbatim and
// says outright that no duration figure or credit tier exists in the catalog.
// Deriving one from a fund name would be a fabricated number on a page whose
// whole job is comparison — the reader would rank on it.

const FEE_HORIZON = DEFAULT_FEE_IMPACT_PARAMS

interface Row {
  label: string
  /** Renders one cell. Returning null prints an em dash. */
  cell: (f: FundEntry) => React.ReactNode
  hint?: string
}

const ROWS: Row[] = [
  { label: 'Type', cell: (f) => (f.type === 'etf' ? 'ETF' : 'Mutual fund') },
  { label: 'Issuer', cell: (f) => f.issuer },
  { label: 'Category', cell: (f) => {
    const base = FUND_CATEGORY_INFO[f.category].label
    return f.focusIndustry ? `${base} · ${f.focusIndustry}` : base
  } },
  {
    label: 'Strategy',
    hint: 'Index funds track a published benchmark; active funds are manager discretion. Leveraged and inverse funds reset daily and are not buy-and-hold instruments.',
    cell: (f) => {
      const s = fundStrategy(f)
      const risky = s === 'leveraged' || s === 'inverse'
      return (
        <span className={risky ? 'text-orange-400 font-semibold' : undefined}>
          {FUND_STRATEGY_INFO[s].label}
        </span>
      )
    },
  },
  {
    label: 'Tracks',
    hint: 'The published benchmark, verbatim from the catalog. For bond funds this is where the maturity mandate lives — the catalog carries no separate duration or credit-rating field.',
    cell: (f) => f.indexTracked ?? <span className="text-text-muted">Active — no index</span>,
  },
  {
    label: 'Expense ratio',
    hint: 'Annual cost as a percent of assets. Curated catalog data, not a live filing read.',
    cell: (f) => (
      <span className={clsx('font-mono', f.expenseRatioPct <= 0.1 ? 'text-emerald-400' : f.expenseRatioPct <= 0.35 ? 'text-amber-400' : 'text-orange-400')}>
        {f.expenseRatioPct}%
      </span>
    ),
  },
  {
    label: 'Sales charge',
    hint: 'A load is deducted at purchase, so only the remainder compounds. Where the catalog records that a charge exists but not its rate, that is stated rather than guessed — an unverified rate is excluded from the cost figures below.',
    cell: (f) => {
      const charge = fundSalesCharge(f)
      if (!charge) return <span className="text-emerald-400">None</span>
      if (charge.maxPct == null) {
        return (
          <span className="text-orange-400">
            {charge.kind} load — <span className="font-semibold">rate not verified</span>
          </span>
        )
      }
      return <span className="text-orange-400 font-mono">{charge.maxPct}% {charge.kind}</span>
    },
  },
  {
    label: `Fee cost over ${FEE_HORIZON.years}y`,
    hint: `Dollars lost to fees on ${formatCurrency(FEE_HORIZON.principal)} at ${FEE_HORIZON.annualReturnPct}% gross, against a ${FEE_IMPACT_BENCHMARK_ER_PCT}% benchmark — the same engine and assumptions as the fund detail page's Fee Drag Analyzer, so the two agree by construction.`,
    cell: (f) => {
      const impact = feeImpact(f, FEE_HORIZON)
      if (!impact) return null
      const cost = feeCostDisplay(impact.costUsd, 2)
      return (
        <span className="inline-flex flex-col">
          <span className={clsx('font-mono font-semibold',
            cost.kind === 'saving' ? 'text-emerald-400' : cost.kind === 'none' ? 'text-text-secondary' : 'text-orange-400')}>
            {cost.sign}{formatCurrency(cost.abs)}
          </span>
          {impact.unverifiedLoad && (
            <span className="text-[10px] leading-tight text-orange-400">+load — true cost is higher</span>
          )}
          {impact.includesLoad && (
            <span className="text-[10px] leading-tight text-text-muted">incl. load</span>
          )}
        </span>
      )
    },
  },
  { label: 'Yield (TTM)', cell: (f) => (f.yieldPct != null ? <span className="font-mono">{f.yieldPct}%</span> : <span className="text-text-muted">Negligible</span>) },
  { label: 'AUM', cell: (f) => <span className="font-mono">{formatCompact(f.aumB * 1e9)}</span> },
  {
    label: 'Inception',
    hint: 'A longer record is more history to judge, not evidence of a better fund.',
    cell: (f) => <span className="font-mono">{f.inceptionYear}</span>,
  },
  {
    label: 'Trading restriction',
    cell: (f) => (f.tradingRestriction
      ? <span className="text-amber-300/90 text-[11px] leading-tight">{f.tradingRestriction}</span>
      : <span className="text-emerald-400">None noted</span>),
  },
]

export function FundFactsSection({ symbols }: { symbols: string[] }) {
  const funds = symbols
    .map((s) => getFund(s))
    .filter((f): f is FundEntry => !!f)

  // One fund has nothing to sit beside; zero means no funds were selected.
  if (funds.length < 2) return null

  const anyBond = funds.some((f) => f.category === 'bond')
  const anyLoad = funds.some((f) => !!fundSalesCharge(f))

  return (
    <div className="rounded-card border border-border bg-bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Landmark size={15} className="text-accent-blue" aria-hidden /> Fund facts side by side
        </h3>
        <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
          Catalog reference data for the {funds.length} selected funds — the fields the general
          reference table below cannot show. Expense ratios, AUM and yields are curated snapshots
          carrying their own provenance, not live filings.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-bg-elevated/40">
              <th className="px-4 py-2 text-left font-medium uppercase tracking-wider text-text-muted">Field</th>
              {funds.map((f) => (
                <th key={f.symbol} className="px-4 py-2 text-left font-medium">
                  <span className="font-mono font-semibold text-text-primary">{f.symbol}</span>
                  <span className="block max-w-[14rem] truncate text-[10px] font-normal text-text-muted">{f.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {ROWS.map((row) => (
              <tr key={row.label}>
                <td className="px-4 py-2 align-top text-text-muted" title={row.hint}>
                  {row.label}
                  {row.hint && <span className="ml-1 cursor-help text-text-muted/50" aria-hidden>ⓘ</span>}
                </td>
                {funds.map((f) => (
                  <td key={f.symbol} className="px-4 py-2 align-top text-text-secondary">
                    {row.cell(f) ?? <span className="text-text-muted">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1.5 border-t border-border px-4 py-2.5">
        {anyBond && (
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-text-muted">
            <AlertTriangle size={11} className="mt-0.5 shrink-0 text-amber-400" aria-hidden />
            <span>
              <strong className="text-text-secondary">Bond funds:</strong> the catalog records no
              duration figure and no credit-quality tier, so neither is shown. The “Tracks” row is
              the closest thing it holds — a benchmark name usually states the maturity band
              (“1-3 Year”, “20+ Year”). Read the issuer’s page for effective duration and average
              credit rating; a duration inferred from a fund’s name would be a number you could
              rank on, and this table will not invent one.
            </span>
          </p>
        )}
        {anyLoad && (
          <p className="text-[11px] leading-relaxed text-text-muted">
            <strong className="text-text-secondary">Where a load’s rate is unverified</strong>, the
            fee-cost figure excludes it and says so — the real cost is higher than shown. Guessing a
            rate is worse than omitting it, and omitting it silently is worse than both.
          </p>
        )}
      </div>
    </div>
  )
}
