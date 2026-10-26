'use client'

import { useSecurityChart } from '@/components/markets/PriceChartCard'
import { stockBetaFrom, BETA_BENCHMARK } from '@/lib/data/stockBeta'

/**
 * A stock's beta on its own page (D170, 2026-10-25): one year of daily closes against SPY,
 * worked out as Compare works its beta out (betaVsBenchmark). It replaced the catalog's
 * hand-typed beta (2026-07-07), and is shown nowhere else: a list would need a year of
 * prices for every stock at once.
 */
export function StockBetaCard({ symbol }: { symbol: string }) {
  const stock = useSecurityChart(symbol, '1y')
  const bench = useSecurityChart(BETA_BENCHMARK, '1y')
  const loading = stock.isLoading || bench.isLoading
  const result = stockBetaFrom(stock.data?.chart ?? null, bench.data?.chart ?? null)

  return (
    <div className="rounded-card border border-border bg-bg-card p-4">
      <h2 className="text-sm font-medium text-text-secondary">Beta (1 year, vs {BETA_BENCHMARK})</h2>
      {loading ? (
        <div className="mt-3 h-8 w-24 animate-shimmer bg-shimmer-gradient bg-size-[200%_100%] rounded-sm" />
      ) : result.ok ? (
        <>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-text-primary">{result.beta.toFixed(2)}</p>
          <p className="mt-1 text-[11px] text-text-muted leading-relaxed">
            On average, the stock moved {result.beta.toFixed(2)}% for each 1% move in {BETA_BENCHMARK} over
            {' '}{result.overlap} trading days. {BETA_BENCHMARK} explains {(result.rSquared * 100).toFixed(0)}% of its daily moves (R²).
            A measure of the past year, not a forecast.
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-text-muted">— {result.reason}</p>
      )}
    </div>
  )
}
