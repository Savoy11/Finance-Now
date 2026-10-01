/**
 * Structural profiles of the asset classes Compare can hold, and the
 * cross-class comparison built from them.
 *
 * WHY THIS EXISTS. Compare's numbers — growth-of-100, volatility, correlation —
 * are deliberately class-agnostic: a price series is a price series. But when
 * the things being compared are structurally different KINDS of asset, the
 * numbers alone imply a symmetry that is not there: a stock and a coin can
 * show the same 1Y return while one is a claim on cash flows and the other is
 * not a claim on anything. This module states those structural similarities
 * and differences next to the numbers.
 *
 * TWO RULES:
 *  1. FACTS, NOT ADVICE. Every cell describes what an asset class IS — what
 *     you own, where income comes from, what anchors valuation, when it
 *     trades, what governs supply. Nothing here scores, ranks, or recommends;
 *     that is the line the owner drew (see rejected-proposals RP-3).
 *  2. CLASS-LEVEL ONLY. These are properties of the class, not the instrument.
 *     Per-instrument facts (this fund's expense ratio, this coin's supply cap)
 *     live in the catalogs and render in the existing stats table.
 */

import type { InstrumentClass } from '@/lib/data/instruments'
import { hoursLabel, tradesOnWeekends, type TradingVenue } from '@/lib/utils/marketHours'

export interface ClassProfile {
  label: string
  /** One-line answer to "what is this thing?" — shown as the panel's header row. */
  whatItIs: string
  /**
   * Where and when it trades. The "When it trades" answer is computed from this by
   * `lib/utils/marketHours.ts` rather than typed here, because one of those answers has a
   * date on it (Nasdaq's overnight session) — read every answer through `classAnswer()`.
   */
  venue: TradingVenue
  dimensions: Record<StaticDimensionId, string>
}

export type DimensionId = 'ownership' | 'income' | 'valuation' | 'hours' | 'supply'
/** The dimensions whose answers never change with the date. */
export type StaticDimensionId = Exclude<DimensionId, 'hours'>

export const DIMENSION_LABELS: Record<DimensionId, string> = {
  ownership: 'What you own',
  income:    'Income while held',
  valuation: 'What anchors the price',
  hours:     'When it trades',
  supply:    'What governs supply',
}

export const CLASS_PROFILES: Record<InstrumentClass, ClassProfile> = {
  equity: {
    label: 'Stock',
    whatItIs: 'A share of one company.',
    venue: 'us-exchange',
    dimensions: {
      ownership: 'A residual claim on the company’s assets and future cash flows.',
      income:    'Dividends, if and when the company declares them.',
      valuation: 'Expected earnings and cash flows (P/E, discounted cash flow).',
      supply:    'The company — share issuance dilutes, buybacks retire.',
    },
  },
  etf: {
    label: 'ETF',
    whatItIs: 'An exchange-traded share of a pooled portfolio.',
    venue: 'us-exchange',
    dimensions: {
      ownership: 'A proportional claim on a basket of underlying holdings.',
      income:    'Distributions passed through from the holdings.',
      valuation: 'Net asset value of the holdings, held close by arbitrage.',
      supply:    'Shares are created and redeemed to meet demand.',
    },
  },
  mutual: {
    label: 'Mutual fund',
    whatItIs: 'A fund share priced once daily at NAV.',
    venue: 'fund-nav',
    dimensions: {
      ownership: 'A proportional claim on a basket of underlying holdings.',
      income:    'Distributions passed through from the holdings.',
      valuation: 'Net asset value, struck once per trading day.',
      supply:    'Shares are created and redeemed to meet demand.',
    },
  },
  crypto: {
    label: 'Crypto',
    whatItIs: 'A protocol token.',
    venue: 'crypto',
    dimensions: {
      ownership: 'The token itself — no claim on any company’s cash flows or assets.',
      income:    'None from holding. Staking exists for some coins, as a separate act with its own risks.',
      valuation: 'Supply and demand for the token — there is no cash-flow anchor.',
      supply:    'Protocol rules — fixed caps, issuance schedules, or none, per coin.',
    },
  },
  commodity: {
    label: 'Commodity',
    whatItIs: 'The front-month futures price of a physical good.',
    venue: 'futures',
    dimensions: {
      ownership: 'Exposure to a price, via futures — not the physical good itself.',
      income:    'None — rolling futures contracts can add to or subtract from returns.',
      valuation: 'Physical supply and demand: production, storage, seasons, geopolitics.',
      supply:    'Producers and consumers of the physical good.',
    },
  },
  currency: {
    label: 'Currency',
    whatItIs: 'One sovereign currency priced in another.',
    venue: 'fx',
    dimensions: {
      ownership: 'A rate between two monies — holding one is being short the other.',
      income:    'The interest-rate differential — not captured by the spot rate shown here.',
      valuation: 'Relative interest rates, trade flows, and purchasing power.',
      supply:    'Central-bank policy on each side of the pair.',
    },
  },
  rate: {
    label: 'Rate',
    whatItIs: 'A yield index — a level, not an ownable asset.',
    venue: 'us-rates',
    dimensions: {
      ownership: 'Nothing — an index level cannot be held; funds tracking the maturity band can.',
      income:    'The yield IS the number displayed; earning it requires holding actual bonds.',
      valuation: 'Bond-market pricing of expected policy rates and inflation.',
      supply:    'Not applicable — an index has no supply.',
    },
  },
}

export interface ClassComparisonRow {
  dimension: DimensionId
  label: string
  /** class → that class's answer, for exactly the classes being compared. */
  values: Partial<Record<InstrumentClass, string>>
  /** True when every compared class gives the identical answer. */
  shared: boolean
}

export interface ClassComparison {
  classes: InstrumentClass[]
  /** Dimensions where every compared class answers identically. */
  similarities: ClassComparisonRow[]
  /** Dimensions where they answer differently — the substance of the panel. */
  differences: ClassComparisonRow[]
  /** Method caveats triggered by this specific mix — how to read the numbers above. */
  caveats: string[]
}

/**
 * One class's answer on one dimension, as of `now`. "When it trades" is computed from
 * the class's venue (see `lib/utils/marketHours.ts`); every other answer is fixed.
 */
export function classAnswer(c: InstrumentClass, dim: DimensionId, now: Date = new Date()): string {
  const profile = CLASS_PROFILES[c]
  return dim === 'hours' ? hoursLabel(profile.venue, now) : profile.dimensions[dim]
}

/**
 * Compare the structural profiles of the given classes. Deduplicates and
 * preserves first-seen order; returns null for fewer than two DISTINCT
 * classes — a single-class comparison has nothing structural to say, and
 * rendering an empty panel would imply it looked and found nothing.
 */
export function compareAssetClasses(classes: InstrumentClass[], now: Date = new Date()): ClassComparison | null {
  const distinct = Array.from(new Set(classes))
  if (distinct.length < 2) return null

  const rows: ClassComparisonRow[] = (Object.keys(DIMENSION_LABELS) as DimensionId[]).map((dim) => {
    const values: Partial<Record<InstrumentClass, string>> = {}
    for (const c of distinct) values[c] = classAnswer(c, dim, now)
    const texts = distinct.map((c) => values[c]!)
    return { dimension: dim, label: DIMENSION_LABELS[dim], values, shared: texts.every((t) => t === texts[0]) }
  })

  const caveats: string[] = []
  const has = (c: InstrumentClass) => distinct.includes(c)
  // Keyed on how each class trades, not on its name, so a class that trades seven days a
  // week gets the caveat without anyone remembering to add it here.
  const weekend = distinct.filter((c) => tradesOnWeekends(CLASS_PROFILES[c].venue))
  if (weekend.length > 0 && weekend.length < distinct.length) {
    const names = weekend.map((c) => CLASS_PROFILES[c].label.toLowerCase()).join(' and ')
    caveats.push(`Correlation and beta pair the series on dates both have a close, so ${names}’s weekend moves are folded into the next shared day’s figure (usually Monday’s) instead of counting as days of their own. Volatility and the other window stats use each series’ own trading days.`)
  }
  if (has('rate')) {
    caveats.push('A yield index is not investable: its growth-of-100 line shows how the LEVEL changed, not a return anyone could have earned. Duration-matched funds (SGOV/IEF/TLT) are the holdable equivalents.')
  }
  if (has('currency')) {
    caveats.push('FX lines show the spot rate only. The return of actually holding a currency includes the interest-rate differential (carry), which spot excludes.')
  }
  if (has('mutual')) {
    caveats.push('Mutual funds price once daily at NAV, so their series has no intraday movement by construction — slightly damping measured volatility and correlation next to exchange-traded legs.')
  }
  if (has('commodity')) {
    caveats.push('Commodity series track the front-month futures price. Holding the exposure means rolling contracts, whose cost or gain is not in this line.')
  }

  return {
    classes: distinct,
    similarities: rows.filter((r) => r.shared),
    differences: rows.filter((r) => !r.shared),
    caveats,
  }
}
