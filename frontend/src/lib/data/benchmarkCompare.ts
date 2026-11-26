// ─────────────────────────────────────────────────────────────────────────────
// A TRACKED PORTFOLIO BESIDE "THE SAME MONEY IN ONE INDEX FUND" (T-473, D245).
//
// The question every tracker is opened to answer — "how did I actually do
// against just buying the index" — computed honestly: the portfolio's OWN
// dated cash flows (lib/data/trackedPortfolioViews.ts moneyFlows — the same
// flows the return tile uses) replayed against one broad index fund's
// dividend-adjusted daily closes. Each amount put in buys at the fund's
// closing price on or after its date; each amount taken out sells the same
// way; what remains is valued at the newest close, and the same
// money-weighted-rate solver prices the path.
//
// What this module deliberately is NOT (D245, counsel question A16):
//   · no verdict word and no colour on the gap — two figures side by side
//     and the method, nothing more (a wording test scans both files);
//   · no figure where the inputs cannot carry one — a flow with no date, a
//     flow before the benchmark history starts (never guessed backwards),
//     closes that are not dividend-adjusted (a fund path without its payouts
//     understates it — the StockBetaCard family of refusals, D170/T-441), or
//     a withdrawal larger than the replayed path would have held that day
//     (the counterfactual is impossible, not approximate).
// The portfolio's own withholdings come first: the card renders only when the
// portfolio's return tile shows a figure at all (transfer-out and unpriced
// holdings already withhold that).
// ─────────────────────────────────────────────────────────────────────────────

import { moneyWeightedRate, type MoneyFlow } from './trackedPortfolioViews'

const DAY_MS = 86_400_000

/**
 * The reader's choices: broad index funds, all in the app's catalog and all
 * carried by the chart ladder's first (dividend-adjusted) rungs. A short fixed
 * list on purpose — a search box would invite "which benchmark should I use",
 * which is not this card's question.
 */
export const BENCHMARK_CHOICES = [
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF' },
] as const

export type BenchmarkSymbol = (typeof BENCHMARK_CHOICES)[number]['symbol']

export interface BenchmarkClose {
  /** ISO date, YYYY-MM-DD. */
  date: string
  close: number
}

export type BenchmarkBasis = 'splits-and-dividends' | 'splits' | 'unadjusted'

export type BenchmarkReplay =
  | {
      kind: 'ok'
      symbol: string
      /** What the same deposits and withdrawals would be worth now, at the newest close. */
      valueUsd: number
      /** The path's money-weighted yearly rate (percent), or null when none fits. */
      ratePct: number | null
      /** (value + taken out − put in) ÷ put in, percent. */
      totalPct: number
      investedUsd: number
      takenOutUsd: number
      /** The newest close the value stands on. */
      asOf: string
      /** The first flow's date. */
      since: string
    }
  | { kind: 'none'; why: 'no-flows' | 'undated-flow' | 'basis'; basis?: BenchmarkBasis }
  | { kind: 'none'; why: 'no-closes' }
  | { kind: 'none'; why: 'history-short'; historyStart: string; firstFlow: string }
  | { kind: 'none'; why: 'withdrawal-exceeds'; onDate: string }

/** The first close on or after the date, else the newest (a flow after the last close). */
function closeOnOrAfter(sorted: readonly BenchmarkClose[], date: string): BenchmarkClose {
  for (const c of sorted) if (c.date >= date) return c
  return sorted[sorted.length - 1]
}

export function replayAgainstBenchmark(
  flows: readonly MoneyFlow[],
  closes: readonly BenchmarkClose[],
  basis: BenchmarkBasis,
  symbol: string,
  now: Date = new Date(),
): BenchmarkReplay {
  if (!flows.some((f) => f.direction === 'in')) return { kind: 'none', why: 'no-flows' }
  if (flows.some((f) => f.date === null)) return { kind: 'none', why: 'undated-flow' }
  // Without the payouts in the closes, the fund path loses its dividends and
  // the comparison understates it — refused, never approximated (T-441's
  // basis labels exist exactly so a reader of them can refuse).
  if (basis !== 'splits-and-dividends') return { kind: 'none', why: 'basis', basis }

  const sorted = [...closes]
    .filter((c) => Number.isFinite(c.close) && c.close > 0 && /^\d{4}-\d{2}-\d{2}$/.test(c.date))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length === 0) return { kind: 'none', why: 'no-closes' }

  const dated = [...flows].sort((a, b) => (a.date as string).localeCompare(b.date as string))
  const since = dated[0].date as string
  if (since < sorted[0].date) {
    return { kind: 'none', why: 'history-short', historyStart: sorted[0].date, firstFlow: since }
  }

  let units = 0
  let investedUsd = 0
  let takenOutUsd = 0
  for (const f of dated) {
    const px = closeOnOrAfter(sorted, f.date as string)
    const amount = Number(f.amountUsd)
    if (!(amount > 0)) continue
    if (f.direction === 'in') {
      units += amount / px.close
      investedUsd += amount
    } else {
      const sellUnits = amount / px.close
      // More taken out than this path would have held that day: the
      // counterfactual cannot be completed, so no figure — not a clamp.
      if (sellUnits > units * (1 + 1e-9)) return { kind: 'none', why: 'withdrawal-exceeds', onDate: f.date as string }
      units -= sellUnits
      takenOutUsd += amount
    }
  }
  if (!(investedUsd > 0)) return { kind: 'none', why: 'no-flows' }

  const last = sorted[sorted.length - 1]
  const valueUsd = units * last.close
  const totalPct = ((valueUsd + takenOutUsd - investedUsd) / investedUsd) * 100

  // The same solver, on the same dates, as the portfolio's own yearly figure.
  const years = (date: string) => Math.max(0, (now.getTime() - new Date(date).getTime()) / DAY_MS / 365)
  const ratePct = moneyWeightedRate([
    ...dated.map((f) => ({ years: years(f.date as string), amount: (f.direction === 'in' ? -1 : 1) * Number(f.amountUsd) })),
    { years: 0, amount: valueUsd },
  ])

  return { kind: 'ok', symbol, valueUsd, ratePct, totalPct, investedUsd, takenOutUsd, asOf: last.date, since }
}

/**
 * Which figure the card shows beside the return tile — the tile's OWN
 * vocabulary (D208): a per-year rate only while the tile itself shows one
 * (`earnedKind === 'yearly'`), the plain total otherwise. The tile withholds
 * its yearly figure until the first money is a year old precisely because an
 * annualized short path overstates — the 2026-11-26 audit measured +2.5% over
 * 90 days rendering as "+10.5% a year" beside a tile showing +2.5%, a 4× gap
 * on identical performance. The two sides must annualize together or not at all.
 */
export function benchmarkShownFigure(
  replay: Extract<BenchmarkReplay, { kind: 'ok' }>,
  earnedKind: 'yearly' | 'total',
): { perYear: boolean; pct: number } {
  if (earnedKind === 'yearly' && replay.ratePct != null) return { perYear: true, pct: replay.ratePct }
  return { perYear: false, pct: replay.totalPct }
}

/** The method, said where the figures show — every rule a reader needs to weigh them. */
export function benchmarkMethodNote(symbol: string, asOf: string): string {
  return `Each amount you put in or took out is applied at ${symbol}’s daily closing price on or after its date, `
    + `with the fund’s payouts reinvested (dividend-adjusted closes), through ${asOf}. `
    + 'Arithmetic on your own dates and amounts — it does not say what you should have done.'
}

/** Why there is no figure, in plain words. */
export function benchmarkWithheldWords(r: Exclude<BenchmarkReplay, { kind: 'ok' }>): string {
  switch (r.why) {
    case 'no-flows':
      return 'Nothing dated has been put in yet, so there is nothing to replay.'
    case 'undated-flow':
      return 'A starting position or trade has no date, so its money cannot be placed on the fund’s history. Add the date to see this.'
    case 'basis':
      return 'The fund history available right now does not include its payouts, so a replay would understate the fund. No figure is shown.'
    case 'no-closes':
      return 'No fund price history is available right now, so there is nothing to replay against.'
    case 'history-short':
      return `The fund history available starts ${r.historyStart}, after your first money went in (${r.firstFlow}). Nothing is guessed backwards, so no figure is shown.`
    case 'withdrawal-exceeds':
      return `On ${r.onDate} you took out more than this fund path would have held, so the replay cannot be completed and no figure is shown.`
  }
}
