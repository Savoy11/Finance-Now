// ─── Printable rebalance notes (T-066) ───────────────────────────────────────
//
// The drift monitor already shows, for each holding outside its band, the dollar
// amount that would bring it back to target. These notes are that same table in
// a form that prints: what was compared, at what value, and the trades the
// arithmetic implies. Nothing here is new information, and the printed note says
// so. Pure, so the copy and the totals are tested (__tests__/rebalanceNotes.test.ts).

import type { DriftReport } from './portfolioBuilder'

export interface RebalanceNotesInput {
  planName: string
  drift: DriftReport
  /** The portfolio the plan was compared against, or null for weights entered by hand. */
  portfolioName: string | null
  /** The value the trades were sized from. */
  valueUsd: number
  /** Share of the portfolio that could be valued; 100 for hand-entered weights. */
  pricedPct: number
  bandPct: number
  preparedAt: Date
}

export interface RebalanceNoteRow {
  symbol: string
  name: string
  targetPct: number
  currentPct: number
  driftPts: number
  action: 'buy' | 'sell' | 'hold'
  /** Dollars to trade back to target: positive buys, negative sells, 0 for a hold. */
  tradeUsd: number
}

export interface RebalanceNotes {
  title: string
  planName: string
  preparedAt: string
  comparedWith: string
  valueUsd: number
  pricedPct: number
  bandPct: number
  rows: RebalanceNoteRow[]
  tradeCount: number
  buysUsd: number
  sellsUsd: number
  turnoverUsd: number
  unplanned: Array<{ symbol: string; currentPct: number }>
  /** The statement printed under the table. */
  note: string
}

export function buildRebalanceNotes(input: RebalanceNotesInput): RebalanceNotes {
  const { drift } = input
  // A hold carries no trade. checkDrift still sizes one for it, because the
  // amount is the same arithmetic, but printing it beside "hold" invites
  // trading inside the band.
  const rows: RebalanceNoteRow[] = drift.items.map((i) => ({
    symbol: i.symbol,
    name: i.name,
    targetPct: i.targetPct,
    currentPct: i.currentPct,
    driftPts: i.driftPts,
    action: i.action,
    tradeUsd: i.action === 'hold' ? 0 : i.tradeUsd,
  }))
  const trades = rows.filter((r) => r.action !== 'hold')
  const buysUsd = trades.filter((r) => r.tradeUsd > 0).reduce((s, r) => s + r.tradeUsd, 0)
  const sellsUsd = trades.filter((r) => r.tradeUsd < 0).reduce((s, r) => s - r.tradeUsd, 0)

  const note = trades.length === 0
    ? `Every holding is within its ±${input.bandPct}% band, so no trade is shown. These figures restate the drift check; they are arithmetic, not a recommendation to buy or sell anything.`
    : `These figures restate the drift check. For each holding outside its ±${input.bandPct}% band, the trade column shows the dollar amount that would bring it back to its target weight at the values above. They are arithmetic, not a recommendation to buy or sell anything. Prices move, and trading can carry costs and tax consequences that these figures leave out.`

  return {
    title: 'Rebalance notes',
    planName: input.planName,
    preparedAt: input.preparedAt.toISOString(),
    comparedWith: input.portfolioName ? `Portfolio “${input.portfolioName}”` : 'Weights entered by hand',
    valueUsd: input.valueUsd,
    pricedPct: input.pricedPct,
    bandPct: input.bandPct,
    rows,
    tradeCount: trades.length,
    buysUsd,
    sellsUsd,
    turnoverUsd: drift.turnoverUsd,
    unplanned: drift.unplanned,
    note,
  }
}
