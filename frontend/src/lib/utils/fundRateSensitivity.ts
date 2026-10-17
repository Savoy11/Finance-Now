// How much a fund's value moves with interest rates, worked out from what the
// fund itself reports to the SEC (T-420 item 2, D92: "duration for bond funds",
// a fact from the fund's own documents in place of the switched-off Risk
// Profile label).
//
// N-PORT Item B.3.a reports, per currency and maturity bucket, the change in the
// fund's value in dollars for a 1 basis point move in rates (DV01). Divided by
// net assets it is arithmetic, not an estimate of ours:
//
//   duration (years)  ≈  |Σ DV01| / net assets × 10,000
//
// i.e. roughly the percent the fund's value moves, the other way, for each
// 1-point move in rates.
//
// Checked 2026-10-17 against iShares' own published effective durations (as of
// 2026-10-15, from filings as of 2026-05-31): IEF 6.99 against 6.85, TLT 15.14
// against 14.85, SHY 1.88 against 1.81.
//
// ⚠ The DV100 the same item reports is deliberately NOT used. Filers disagree on
// the sign (iShares positive, Vanguard negative), and the size suggests the sign
// carries the direction of the move (the form does not say which to report): TLT's |DV100| is 16.6% of net assets, above
// its 15.1-year straight line (a fall, where long bonds gain more), while BND's
// is below it (a rise). So "a 1-point rise lowers it by X%" read from DV100
// would be a rise for one filer and a fall for another, wrong by 1.5 points on a
// long fund. At 1 basis point that curvature is negligible, which is why DV01
// gives the same duration under either convention.
//
// The buckets are summed with their signs, which nets a hedge correctly under
// either convention, and only the size of the total is used.
//
// Pure and client-safe: no fetch, no clock.

/** One currency's DV01, already summed across maturity buckets. */
export interface RateRiskInput {
  currency: string
  dv01: number
}

export interface FundRateSensitivity {
  /** Years: roughly the percent change in value for each 1-point move in rates. */
  durationYears: number
  /** The currencies the filing reports, in filing order. */
  currencies: string[]
  /** The filing's report date (YYYY-MM-DD). */
  asOf: string | null
}

/**
 * Below this the fund holds too little interest-rate exposure for a duration
 * to describe it: a stock fund keeping some Treasury bills for cash would read
 * as "0.0 years", which is true and tells a reader nothing about the fund.
 */
export const MIN_DURATION_YEARS = 0.1

export function fundRateSensitivity(
  rateRisk: RateRiskInput[],
  netAssets: number | null,
  asOf: string | null,
): FundRateSensitivity | null {
  if (rateRisk.length === 0) return null
  if (netAssets == null || !Number.isFinite(netAssets) || netAssets <= 0) return null
  const dv01 = Math.abs(rateRisk.reduce((s, r) => s + r.dv01, 0))
  if (!Number.isFinite(dv01)) return null
  const durationYears = (dv01 / netAssets) * 10_000
  if (durationYears < MIN_DURATION_YEARS) return null
  return {
    durationYears,
    currencies: rateRisk.map((r) => r.currency).filter(Boolean),
    asOf,
  }
}

/**
 * The words the fund page shows, kept here so a test can hold them to facts:
 * this card stands where the Risk Profile label stood, and must not drift back
 * into that label's vocabulary.
 */
export function describeRateSensitivity(s: FundRateSensitivity): { headline: string; method: string } {
  const years = s.durationYears.toFixed(1)
  const foreign = s.currencies.filter((c) => c !== 'USD')
  return {
    headline:
      `Duration about ${years} years: roughly ${years}% off the fund’s value for each 1-point rise in `
      + `interest rates, and about as much gained for each 1-point fall.`,
    method:
      `Arithmetic on the fund’s own SEC N-PORT filing${s.asOf ? ` as of ${s.asOf}` : ''}, not a forecast: `
      + `the dollar change it reports for a 0.01-point move in rates, divided by its net assets. `
      + (foreign.length > 0 ? `It includes the fund’s holdings priced in ${foreign.join(', ')}. ` : '')
      + `Filings are quarterly and about two months behind, so the issuer’s current figure can differ a little.`,
  }
}
