/**
 * Prior bitcoin market cycles — hand-maintained reference data for the Cycle
 * Context tab on /assets (scope: docs/assessments/cycle-gauge-scope.md).
 *
 * HISTORY, NOT PREDICTION. Each row records what a completed (or, for the
 * current cycle, still-open) cycle actually did. The tab renders these beside
 * live figures so the reader can compare — it never extrapolates them, and no
 * code in this module produces a forecast, a score, or a phase verdict.
 *
 * Figures are approximate by nature: different venues printed different
 * extremes (the 2013 peak varies by hundreds of dollars across sources), so
 * values carry the precision the underlying record supports and no more.
 */

export interface CycleRecord {
  /** Halving that opened the cycle, or 'genesis' for the pre-halving era. */
  halving: string
  halvingDate: string | null   // ISO date, null for genesis
  peakLabel: string            // e.g. "Nov 2013 · ~$1,150"
  troughLabel: string
  /** Peak-to-trough drawdown, percent, negative. */
  maxDrawdownPct: number
  /** Months from halving to cycle peak, null where not applicable/known. */
  halvingToPeakMonths: number | null
  /** True while the cycle's trough cannot yet be declared final. */
  open?: boolean
  note: string
}

export const CYCLE_HISTORY: CycleRecord[] = [
  {
    halving: 'genesis', halvingDate: null,
    peakLabel: 'Jun 2011 · ~$32', troughLabel: 'Nov 2011 · ~$2',
    maxDrawdownPct: -93, halvingToPeakMonths: null,
    note: 'Pre-halving era; a single small venue (Mt. Gox) set the price.',
  },
  {
    halving: '2012', halvingDate: '2012-11-28',
    peakLabel: 'Nov 2013 · ~$1,150', troughLabel: 'Jan 2015 · ~$170',
    maxDrawdownPct: -86, halvingToPeakMonths: 12,
    note: 'First halving cycle; retail mania, then the Mt. Gox collapse.',
  },
  {
    halving: '2016', halvingDate: '2016-07-09',
    peakLabel: 'Dec 2017 · ~$19,700', troughLabel: 'Dec 2018 · ~$3,200',
    maxDrawdownPct: -84, halvingToPeakMonths: 17,
    note: 'ICO boom and bust; the textbook altseason closed this cycle.',
  },
  {
    halving: '2020', halvingDate: '2020-05-11',
    peakLabel: 'Nov 2021 · ~$69,000', troughLabel: 'Nov 2022 · ~$15,500',
    maxDrawdownPct: -77, halvingToPeakMonths: 18,
    note: 'Leverage and credit contagion (Luna, FTX) drove the unwind.',
  },
  // Open row. Its "so far" low was re-checked on 2026-10-04 (D61) and moved from
  // 'Jun 2026 · ~$59,000', −53%: FMP's daily BTCUSD low on 1 Jul 2026 (UTC) was
  // $57,718, and Crypto.com's candles give $57,737 for July against $58,015 for
  // June. The 2026-08-29 compile used press reports of a ~$59k low on 30 June.
  // The peak is an intraday high (FMP: $126,296, 6 Oct 2025), so the trough is
  // an intraday low. The row closes when BTC trades above that peak or at the
  // 2028 halving, whichever comes first (D61, T-393). One re-checked row does
  // not re-date the table, so CYCLE_HISTORY_LAST_VERIFIED is unchanged.
  {
    halving: '2024', halvingDate: '2024-04-20',
    peakLabel: 'Oct 2025 · ~$126,200', troughLabel: 'Jul 2026 · ~$57,700 (so far)',
    maxDrawdownPct: -54, halvingToPeakMonths: 18, open: true,
    note: 'ETF era. Shallowest drawdown on record; the classic top indicators did not fire before the peak.',
  },
]

// ─── Provenance ───────────────────────────────────────────────────────────────
// House pattern (see CLAUDE.md "Data Files Reference"): dated by when the table
// was compiled AS A WHOLE, injectable `now` so staleness is testable, and a
// provenance object any surface rendering these figures must show.

export const CYCLE_HISTORY_LAST_VERIFIED = '2026-08-29'
/**
 * Generous window on purpose: closed cycles never change. What goes stale is
 * the OPEN row — its "(so far)" trough and drawdown — and the possibility that
 * a new trough resets it. 180 days bounds how old that row may quietly get.
 */
export const CYCLE_HISTORY_STALE_AFTER_DAYS = 180

export function cycleHistoryAgeDays(now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(`${CYCLE_HISTORY_LAST_VERIFIED}T00:00:00Z`).getTime()) / 86_400_000)
}
export function cycleHistoryIsStale(now: Date = new Date()): boolean {
  return cycleHistoryAgeDays(now) > CYCLE_HISTORY_STALE_AFTER_DAYS
}
export function getCycleHistoryProvenance(now: Date = new Date()) {
  return {
    source: 'Hand-compiled from public price records (exchange histories, CoinGecko research); values approximate by nature',
    verifiedAt: CYCLE_HISTORY_LAST_VERIFIED,
    ageDays: cycleHistoryAgeDays(now),
    stale: cycleHistoryIsStale(now),
    confidence: 'reference' as const,
  }
}
