'use client'

import { useId, useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { Receipt } from 'lucide-react'
import { FUND_FEES_LAST_VERIFIED } from '@/lib/data/fundCatalog'
import { feeCostDisplay } from '@/lib/data/feeImpact'
import {
  COST_BENCHMARK_ER_PCT, COST_HORIZON_YEARS, COST_RETURN_PCT, PER_WHAT_IF_USD,
  portfolioFundCosts, type CostPosition,
} from '@/lib/data/portfolioCosts'

// What a portfolio's funds cost each year (T-448, D197). Figures only: no threshold, no
// verdict, nothing rated. The arithmetic is lib/data/portfolioCosts.ts, which shares the fund
// pages' fee engine; this file only lays it out.

const usd = (n: number) => {
  if (n === 0) return '$0'
  const decimals = Math.abs(n) < 100 ? 2 : 0
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/** An expense ratio as the fund pages show it: up to three decimals, no trailing zeros. */
const pct = (n: number) => `${Number(n.toFixed(3))}%`

const list = (xs: string[]) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

export function PortfolioCostsCard({ positions, basis }: {
  positions: CostPosition[]
  /** 'tracked': live values. 'what-if': shares of PER_WHAT_IF_USD by target allocation. */
  basis: 'tracked' | 'what-if'
}) {
  const uid = useId()
  const costs = useMemo(() => portfolioFundCosts(positions), [positions])
  const fundCount = costs.funds.length
  const perWhatIf = basis === 'what-if'
  const horizon = feeCostDisplay(costs.horizonCostUsd)
  const unverified = costs.funds.filter((f) => f.unverifiedLoad).map((f) => f.symbol)
  const withLoad = costs.funds.filter((f) => f.includesLoad).map((f) => f.symbol)

  return (
    <section className="bg-bg-card border border-border rounded-xl p-5 space-y-4" aria-labelledby={`${uid}-costs`}>
      <h4 id={`${uid}-costs`} className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <Receipt size={14} className="text-accent-blue" aria-hidden /> What your funds cost
      </h4>

      {fundCount === 0 ? (
        <p className="text-xs text-text-muted leading-relaxed">
          {costs.unpricedFunds.length > 0
            ? `No live price right now for ${list(costs.unpricedFunds)}, so there is no cost to work out yet.`
            : 'This portfolio holds no funds from the app’s fund list, so there are no fund fees to show. Stocks and coins held directly carry no expense ratio.'}
        </p>
      ) : (
        <>
          {/* One column on a phone: a dollar figure is never cut short. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label="Expense ratio, weighted" value={costs.weightedExpenseRatioPct == null ? '—' : pct(costs.weightedExpenseRatioPct)}>
              Across {fundCount === 1 ? 'the 1 fund' : `the ${fundCount} funds`} held, by {perWhatIf ? 'allocation' : 'value'}
            </Stat>
            <Stat label="Cost a year" value={usd(costs.annualCostUsd)}>
              {perWhatIf
                ? `Per ${usd(PER_WHAT_IF_USD)} invested in this mix (funds are ${Math.round((costs.fundValueUsd / PER_WHAT_IF_USD) * 100)}% of it)`
                : `On ${usd(costs.fundValueUsd)} in funds, at today’s values`}
            </Stat>
            <Stat label={`Over ${COST_HORIZON_YEARS} years`} value={horizon.kind === 'none' ? usd(0) : usd(horizon.abs)}>
              {horizon.kind === 'saving'
                ? `Less in fees than a ${COST_BENCHMARK_ER_PCT}% index fund`
                : horizon.kind === 'none'
                  ? `About the same as a ${COST_BENCHMARK_ER_PCT}% index fund`
                  : `More in fees than a ${COST_BENCHMARK_ER_PCT}% index fund`}
              , at {COST_RETURN_PCT}% a year before fees{withLoad.length > 0 ? ', sales charges included' : ''}
            </Stat>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted text-left border-b border-border">
                  <th scope="col" className="py-1.5 pr-3 font-medium">Fund</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium text-right">{perWhatIf ? `Of ${usd(PER_WHAT_IF_USD)}` : 'Value'}</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium text-right">Expense ratio</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium text-right">A year</th>
                  <th scope="col" className="py-1.5 font-medium text-right">{COST_HORIZON_YEARS} years vs index</th>
                </tr>
              </thead>
              <tbody>
                {costs.funds.map((f) => {
                  const h = feeCostDisplay(f.horizonCostUsd)
                  return (
                    <tr key={f.symbol} className="border-b border-border/50 last:border-0">
                      <td className="py-1.5 pr-3">
                        <Link href={`/funds/${f.symbol.toLowerCase()}`} className="font-semibold text-text-primary hover:text-accent-blue">{f.symbol}</Link>
                        <span className="text-text-muted ml-1.5 hidden sm:inline">{f.name}</span>
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono text-text-secondary">{usd(f.valueUsd)}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-text-secondary">{pct(f.expenseRatioPct)}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-text-primary">{usd(f.annualCostUsd)}</td>
                      <td className="py-1.5 text-right font-mono text-text-secondary">
                        {h.kind === 'none' ? usd(0) : `${h.kind === 'saving' ? 'saves ' : ''}${usd(h.abs)}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="space-y-1.5 text-[11px] text-text-muted leading-relaxed">
        {withLoad.length > 0 && (
          <p>The {COST_HORIZON_YEARS}-year figure for {list(withLoad)} includes {withLoad.length === 1 ? 'its' : 'their'} sales charge, paid once at purchase, as the fund page counts it. The yearly cost is the expense ratio alone.</p>
        )}
        {unverified.length > 0 && (
          <p className="text-amber-400">{list(unverified)} {unverified.length === 1 ? 'carries a sales charge' : 'carry sales charges'} whose rate is not verified, so it is left out and these figures understate the cost. The fund page links the prospectus.</p>
        )}
        {fundCount > 0 && costs.unpricedFunds.length > 0 && (
          <p>No live price right now for {list(costs.unpricedFunds)}, so {costs.unpricedFunds.length === 1 ? 'it is' : 'they are'} left out of these figures. A holding is never valued at its cost.</p>
        )}
        {costs.feeNotOnFile.length > 0 && (
          <p>{list(costs.feeNotOnFile)} {costs.feeNotOnFile.length === 1 ? 'is' : 'are'} not in the app’s fund or stock lists. If {costs.feeNotOnFile.length === 1 ? 'it is a fund, its' : 'any is a fund, its'} fee is not on file and is not counted.</p>
        )}
        <p>
          Expense ratios are checked against each fund’s own SEC filings; the oldest check still standing is from {FUND_FEES_LAST_VERIFIED}.
          {' '}How these figures are worked out: <Link href="/about/data-methods#fund-costs" className="text-accent-blue hover:underline">fund costs</Link>.
        </p>
      </div>
    </section>
  )
}

function Stat({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="bg-bg-elevated rounded-xl p-3 border border-border">
      <div className="text-[11px] text-text-muted">{label}</div>
      <div className="text-lg font-bold font-mono text-text-primary mt-0.5">{value}</div>
      <div className="text-[10px] text-text-muted mt-0.5 leading-snug">{children}</div>
    </div>
  )
}
