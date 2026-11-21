import { isBondCategory } from './assetMix'

// ─── Where a fund invests (T-455, D212) ──────────────────────────────────────
//
// Countries and currencies for every fund, and for a bond fund the kind of borrower and when
// the bonds are repaid, all from the fund's own N-PORT filing: the one /live-data/fund-holdings
// already downloads for the holdings table. Pure and tested, like assetMix.ts beside it, because
// these are percentages a reader takes as their exposure.
//
// The rules the page states:
// - A holding's country is its issuer's, as the fund reports it: where a company is based, not
//   where it sells.
// - A field the filer left blank (or wrote "N/A", as swaps do) is never guessed. It lowers the
//   split's coverage, which is shown beside it.
// - Nothing is rescaled to 100%. Figures are shares of the fund's net assets, as the filing
//   gives them, the rule the asset mix and the look-through follow.
// - N-PORT carries no credit ratings, so there is no "quality" split, and none is implied.

export interface ExposureHolding {
  pctVal: number | null
  assetCat: string | null
  country: string | null
  currency: string | null
  issuerCat: string | null
  maturity: string | null
}

export interface ExposureSlice {
  code: string
  label: string
  /** Percent of the fund's net assets (or, in a portfolio, of the portfolio). */
  pct: number
}

export interface ExposureSplit {
  /** Largest first; the maturity split keeps its own order, shortest first. */
  slices: ExposureSlice[]
  /** Percent of net assets in holdings whose filing states the field. */
  statedPct: number
  /** Percent of net assets the holdings considered add up to. */
  listedPct: number
  /** Holdings considered that state no usable value. */
  unstatedCount: number
}

export interface BondProfile {
  /** Percent of net assets in bonds, by the asset mix's own categories. */
  bondsPct: number
  /** Who borrowed: the issuer kind of each bond. */
  borrowers: ExposureSplit
  /** When the bonds are repaid, counted from the filing's report date. */
  maturities: ExposureSplit
}

export interface FundExposure {
  /** The filing's report date; maturities are counted from it. */
  asOf: string | null
  countries: ExposureSplit
  currencies: ExposureSplit
  /** Only when bonds are at least BOND_PROFILE_MIN_PCT of net assets. */
  bonds: BondProfile | null
}

/**
 * Bonds must be at least this share of net assets for the borrower and maturity splits to show.
 * The form's own line: N-PORT asks for interest-rate risk (Item B.3) only from a fund whose debt
 * is 25% or more of its net assets, and the duration card shows for those funds alone.
 */
export const BOND_PROFILE_MIN_PCT = 25

/** Issuer kinds (Form N-PORT, Item C.5), in plain words. An unknown code is shown as Other. */
export const ISSUER_KIND_LABELS: Record<string, string> = {
  UST: 'US Treasury',
  USGA: 'US government agencies',
  USGSE: 'US government-sponsored companies',
  MUN: 'Cities and states',
  NUSS: 'Foreign governments',
  CORP: 'Companies',
  RF: 'Other funds',
  PF: 'Private funds',
  OTHER: 'Other',
}

export const MATURITY_BUCKETS: ReadonlyArray<{ code: string; label: string; underYears: number }> = [
  { code: 'lt1', label: 'Under 1 year', underYears: 1 },
  { code: '1-3', label: '1 to 3 years', underYears: 3 },
  { code: '3-5', label: '3 to 5 years', underYears: 5 },
  { code: '5-10', label: '5 to 10 years', underYears: 10 },
  { code: '10-20', label: '10 to 20 years', underYears: 20 },
  { code: 'gt20', label: 'Over 20 years', underYears: Infinity },
]

const round2 = (n: number) => Math.round(n * 100) / 100

function displayName(type: 'region' | 'currency', code: string): string {
  try {
    const name = new Intl.DisplayNames(['en'], { type }).of(code)
    return name && name !== code ? name : code
  } catch {
    return code
  }
}

/** "IE" → "Ireland"; a code with no English name stays as the code. */
export const countryName = (code: string) => displayName('region', code)
/** "EUR" → "Euro". */
export const currencyName = (code: string) => displayName('currency', code)

const usable = (pct: number | null): pct is number => pct != null && Number.isFinite(pct)

/** Sum each holding's share under the key it states; a holding with no key lowers the coverage. */
function split(
  rows: ExposureHolding[],
  keyOf: (h: ExposureHolding) => string | null,
  labelOf: (code: string) => string,
  order?: readonly string[],
): ExposureSplit {
  const totals = new Map<string, number>()
  let stated = 0
  let listed = 0
  let unstatedCount = 0
  for (const h of rows) {
    if (!usable(h.pctVal)) continue
    listed += h.pctVal
    const key = keyOf(h)
    if (key == null) { unstatedCount++; continue }
    stated += h.pctVal
    totals.set(key, (totals.get(key) ?? 0) + h.pctVal)
  }
  const slices = [...totals]
    .map(([code, pct]) => ({ code, label: labelOf(code), pct: round2(pct) }))
    // A slice rounding to 0.00% is noise in a list, not information (the asset mix's rule).
    .filter((s) => s.pct !== 0)
  if (order) slices.sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code))
  else slices.sort((a, b) => b.pct - a.pct || a.code.localeCompare(b.code))
  return { slices, statedPct: round2(stated), listedPct: round2(listed), unstatedCount }
}

/**
 * Which bucket a bond falls in, by calendar anniversaries of the report date: a bond due exactly
 * five years after it is in "5 to 10 years". Counting 365.25-day years instead put that bond at
 * 4.999 years. Null when either date is missing, or the maturity is already past at the report date.
 */
export function maturityBucket(maturity: string | null, asOf: string | null): string | null {
  if (!maturity || !asOf) return null
  const due = Date.parse(`${maturity}T00:00:00Z`)
  const from = new Date(`${asOf}T00:00:00Z`)
  if (!Number.isFinite(due) || Number.isNaN(from.getTime()) || due < from.getTime()) return null
  for (const b of MATURITY_BUCKETS) {
    if (!Number.isFinite(b.underYears)) return b.code
    const limit = Date.UTC(from.getUTCFullYear() + b.underYears, from.getUTCMonth(), from.getUTCDate())
    if (due < limit) return b.code
  }
  return null
}

export function computeFundExposure(holdings: ExposureHolding[], asOf: string | null): FundExposure {
  const countries = split(holdings, (h) => h.country, countryName)
  const currencies = split(holdings, (h) => h.currency, currencyName)

  const bondRows = holdings.filter((h) => isBondCategory(h.assetCat))
  const bondsPct = round2(bondRows.reduce((s, h) => s + (usable(h.pctVal) ? h.pctVal : 0), 0))
  const bonds = bondsPct >= BOND_PROFILE_MIN_PCT
    ? {
      bondsPct,
      borrowers: split(
        bondRows,
        (h) => (h.issuerCat ? (ISSUER_KIND_LABELS[h.issuerCat] ? h.issuerCat : 'OTHER') : null),
        (c) => ISSUER_KIND_LABELS[c],
      ),
      maturities: split(
        bondRows,
        (h) => maturityBucket(h.maturity, asOf),
        (c) => MATURITY_BUCKETS.find((b) => b.code === c)!.label,
        MATURITY_BUCKETS.map((b) => b.code),
      ),
    }
    : null

  return { asOf, countries, currencies, bonds }
}

/** The largest `n` slices, and what the rest add up to, for a list that would run long. */
export function topSlices(s: ExposureSplit, n: number): { shown: ExposureSlice[]; rest: { count: number; pct: number } | null } {
  if (s.slices.length <= n) return { shown: s.slices, rest: null }
  const tail = s.slices.slice(n)
  return { shown: s.slices.slice(0, n), rest: { count: tail.length, pct: round2(tail.reduce((t, x) => t + x.pct, 0)) } }
}

/** "2.7%", and "<0.1%" for a share too small to show at one decimal place, rather than "0.0%". */
export function formatShare(pct: number): string {
  if (pct !== 0 && Math.abs(pct) < 0.05) return `${pct < 0 ? '−' : ''}<0.1%`
  return `${pct.toFixed(1)}%`
}

/**
 * "The country is stated for holdings worth 99.9% of the fund. 12 holdings state none, so they
 * are left out rather than guessed." `items` is "holdings" for a split of the whole fund, "bonds"
 * for a split of its bonds alone, whose shares are still of the whole fund. `totals: false` leaves
 * out the lines about the whole fund's total, for a second split of the same fund that would only
 * repeat them.
 */
export function coverageNote(s: ExposureSplit, field: string, items: 'holdings' | 'bonds' = 'holdings', totals = true): string {
  const one = items === 'holdings' ? 'holding' : 'bond'
  const parts = [`The ${field} is stated for ${items} worth ${s.statedPct.toFixed(1)}% of the fund.`]
  if (s.unstatedCount > 0) {
    const n = s.unstatedCount
    parts.push(`${n} ${n === 1 ? one : items} in the filing state${n === 1 ? 's' : ''} none, so ${n === 1 ? 'it is' : 'they are'} left out rather than guessed.`)
  }
  if (items === 'holdings' && totals && s.listedPct < 99.5) {
    parts.push('The rest of the fund is cash and other items outside its holdings list. Nothing is rescaled to 100%.')
  }
  if (items === 'holdings' && totals && s.listedPct >= 100.05) {
    parts.push('The holdings add up to a little over 100% because the fund owes some money it has not yet paid (for things it has bought, fees and the like), which the holdings list does not take off.')
  }
  return parts.join(' ')
}

// ─── Across a portfolio (T-455 c) ────────────────────────────────────────────

export interface PortfolioCountryInput {
  symbol: string
  /** Share of the whole portfolio, 0–100. */
  weightPct: number
  isFund: boolean
}

export interface PortfolioCountries {
  /** Percent of the whole portfolio, by country. */
  slices: ExposureSlice[]
  /** Share of the portfolio whose country the funds' filings state. */
  countedPct: number
  /** Share inside counted funds that their filings leave without a country (cash, swaps, blanks). */
  notStatedPct: number
  /** Funds whose own filing gave no country split (no N-PORT, or it could not be read). */
  fundsWithout: Array<{ symbol: string; weightPct: number }>
  /** Share held directly, not through a fund: the app records no home country for it. */
  directPct: number
}

/**
 * Each fund's country split, weighted by its share of the portfolio and added up. Nothing is
 * rescaled: a fund whose filing states countries for 98% of it adds 98% of its weight, and the
 * rest is reported as not stated. A stock or coin held directly is left out and its share named,
 * since the app records no home country for a company outside a fund's filing.
 */
export function computePortfolioCountries(
  positions: PortfolioCountryInput[],
  countriesByFund: Record<string, ExposureSplit | undefined>,
): PortfolioCountries {
  const totals = new Map<string, { label: string; pct: number }>()
  let counted = 0
  let notStated = 0
  let direct = 0
  const fundsWithout: PortfolioCountries['fundsWithout'] = []
  for (const p of positions) {
    if (!p.isFund) { direct += p.weightPct; continue }
    const s = countriesByFund[p.symbol]
    if (!s || s.slices.length === 0) { fundsWithout.push({ symbol: p.symbol, weightPct: p.weightPct }); continue }
    for (const slice of s.slices) {
      const add = (p.weightPct * slice.pct) / 100
      const cur = totals.get(slice.code)
      totals.set(slice.code, { label: cur?.label ?? slice.label, pct: (cur?.pct ?? 0) + add })
    }
    counted += (p.weightPct * s.statedPct) / 100
    notStated += (p.weightPct * (100 - s.statedPct)) / 100
  }
  const slices = [...totals]
    .map(([code, v]) => ({ code, label: v.label, pct: round2(v.pct) }))
    .filter((s) => s.pct !== 0)
    .sort((a, b) => b.pct - a.pct || a.code.localeCompare(b.code))
  return {
    slices,
    countedPct: round2(counted),
    notStatedPct: round2(notStated),
    fundsWithout,
    directPct: round2(direct),
  }
}
