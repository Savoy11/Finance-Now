// How much a Treasury bond's price moves when its yield moves (T-420, D92).
//
// D92 chose facts, not ratings, for interest rates and bonds, and named
// duration shown as arithmetic as the useful number: roughly how much a
// holding's price changes for a 1-point change in rates. This file is that
// arithmetic and nothing more. It prices a hypothetical Treasury at one point
// on the official par curve, so its inputs are the maturity and the published
// par yield, and its output is a formula's result, not an opinion.
//
// Conventions, stated because they change the third digit:
//   • A maturity of one year or less is a Treasury bill: one payment at
//     maturity, no coupons.
//   • A longer maturity is a note or bond priced AT PAR: its coupon equals the
//     par yield (that is what "par yield" means), paid twice a year.
//   • Yields compound twice a year, as Treasury par yields are quoted.
//   • The repricing is exact for those assumptions. "Duration" alone is the
//     straight-line estimate; the exact repricing shows the curve (convexity),
//     which is why a rise and a fall are not quite the same size.

const PAR = 100

/** Price of a Treasury with the given coupon, maturity and yield (all % per year). */
export function treasuryPrice(years: number, couponPct: number, yieldPct: number): number {
  if (!(years > 0)) throw new Error('maturity must be positive')
  const y = yieldPct / 100
  if (years <= 1) {
    // A bill: a single payment of par at maturity.
    return PAR / Math.pow(1 + y / 2, 2 * years)
  }
  const n = Math.round(years * 2)
  const c = (couponPct / 100) * PAR / 2
  const r = y / 2
  let price = 0
  for (let k = 1; k <= n; k++) price += c / Math.pow(1 + r, k)
  return price + PAR / Math.pow(1 + r, n)
}

/** The price a par-yield Treasury at this point on the curve starts from. */
export function parStartPrice(years: number, parYieldPct: number): number {
  return treasuryPrice(years, years <= 1 ? 0 : parYieldPct, parYieldPct)
}

/**
 * Modified duration in years: the percent change in price for a 1-point
 * change in yield, as a straight-line estimate.
 */
export function modifiedDuration(years: number, parYieldPct: number): number {
  if (!(years > 0)) throw new Error('maturity must be positive')
  const y = parYieldPct / 100
  if (years <= 1) return years / (1 + y / 2)
  if (Math.abs(y) < 1e-9) return Math.round(years * 2) / 2
  // Closed form for a bond priced at par, coupons twice a year.
  return (1 - Math.pow(1 + y / 2, -Math.round(years * 2))) / y
}

export interface RateMoveEffect {
  /** Modified duration in years: about this many % of price per 1-point move. */
  durationYears: number
  /** Exact repricing, % of price, if the yield rises by `movePct`. */
  ifRisesPct: number
  /** Exact repricing, % of price, if the yield falls by `fallMovePct`. */
  ifFallsPct: number
  /** The yield move used for a rise, in percentage points. */
  movePct: number
  /** The fall actually used: smaller than `movePct` when the yield is below it. */
  fallMovePct: number
}

/**
 * The effect of a yield move on a Treasury at this maturity and par yield.
 * A fall is floored at a zero yield, since the arithmetic below zero describes
 * nothing the published curve offers.
 */
export function rateMoveEffect(years: number, parYieldPct: number, movePct = 1): RateMoveEffect {
  const coupon = years <= 1 ? 0 : parYieldPct
  const start = treasuryPrice(years, coupon, parYieldPct)
  const up = treasuryPrice(years, coupon, parYieldPct + movePct)
  const fallMovePct = Math.min(movePct, Math.max(0, parYieldPct))
  const down = treasuryPrice(years, coupon, parYieldPct - fallMovePct)
  return {
    durationYears: modifiedDuration(years, parYieldPct),
    ifRisesPct: (up / start - 1) * 100,
    ifFallsPct: (down / start - 1) * 100,
    movePct,
    fallMovePct,
  }
}
