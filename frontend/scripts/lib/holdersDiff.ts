// ─────────────────────────────────────────────────────────────────────────────
// QUARTER-OVER-QUARTER 13F CHANGES, per CUSIP (T-472, D245).
//
// The build already folds every effective filing's per-manager share totals
// for the current quarter (scripts/lib/form13f.ts foldInfoRow); this module
// compares one CUSIP's map against the PRIOR quarter's and keeps only what
// the card shows: the prior totals and the largest moves in each direction.
//
// Rules, each from a named hazard (the 2026-11-25 proposal):
//   · A CUSIP with no prior-quarter map gets NULL, never an empty prior —
//     "every holder is new" would be an artefact of a retired or renumbered
//     identifier (the BlackRock/Linde case D244 measured), not a fact about
//     buying. The page says so in words.
//   · Directions are ranked by the SIZE OF THE MOVE in shares (an increase by
//     added shares, a reduction by shares shed, entries and exits by the
//     stake), and capped — the full maps would put every manager in the file.
//   · No percent, no "accumulation", no rank across stocks: facts with both
//     quarter-end dates, the item-4 line (ranking vs explanation).
// The split hazard is handled where the figures render: the card withholds
// the whole change section on D170's share-count band, exactly as it
// withholds the ownership percent.
// ─────────────────────────────────────────────────────────────────────────────

/** How many managers each direction lists — enough to read, not a leaderboard. */
export const TOP_CHANGES = 5

export interface QuarterChange {
  totalSharesPrior: number
  holderCountPrior: number
  /** [cik, sharesNow, sharesPrior], largest added shares first. */
  increases: Array<[string, number, number]>
  /** [cik, sharesNow, sharesPrior], largest shed shares first. */
  reductions: Array<[string, number, number]>
  /** [cik, sharesNow] — stakes with no prior row, largest first. */
  newStakes: Array<[string, number]>
  /** [cik, sharesPrior] — prior stakes with no current row, largest first. */
  exits: Array<[string, number]>
}

export function diffQuarter(
  current: ReadonlyMap<string, { shares: number }>,
  prior: ReadonlyMap<string, { shares: number }> | undefined,
  top: number = TOP_CHANGES,
): QuarterChange | null {
  if (!prior || prior.size === 0) return null
  let totalSharesPrior = 0
  const increases: Array<[string, number, number]> = []
  const reductions: Array<[string, number, number]> = []
  const newStakes: Array<[string, number]> = []
  const exits: Array<[string, number]> = []

  for (const [cik, p] of prior) {
    totalSharesPrior += p.shares
    const c = current.get(cik)
    if (!c) {
      exits.push([cik, p.shares])
    } else if (c.shares > p.shares) {
      increases.push([cik, c.shares, p.shares])
    } else if (c.shares < p.shares) {
      reductions.push([cik, c.shares, p.shares])
    }
  }
  for (const [cik, c] of current) {
    if (!prior.has(cik)) newStakes.push([cik, c.shares])
  }

  increases.sort((a, b) => (b[1] - b[2]) - (a[1] - a[2]) || a[0].localeCompare(b[0]))
  reductions.sort((a, b) => (b[2] - b[1]) - (a[2] - a[1]) || a[0].localeCompare(b[0]))
  newStakes.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  exits.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  return {
    totalSharesPrior,
    holderCountPrior: prior.size,
    increases: increases.slice(0, top),
    reductions: reductions.slice(0, top),
    newStakes: newStakes.slice(0, top),
    exits: exits.slice(0, top),
  }
}

/**
 * The quarter a set should be compared against: the one exactly three months
 * earlier. Written as a check, not an assumption — passing the same set twice,
 * or sets a year apart, must refuse rather than publish a wrong "quarter
 * before" (the misuse a --prior-set-dir flag invites).
 */
export function isPriorQuarter(currentPeriod: string, priorPeriod: string): boolean {
  const [cy, cm] = currentPeriod.split('-').map(Number)
  const [py, pm] = priorPeriod.split('-').map(Number)
  if (!cy || !cm || !py || !pm) return false
  return cy * 12 + cm - (py * 12 + pm) === 3
}
