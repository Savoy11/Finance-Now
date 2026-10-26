import { secFilingsUrl } from './equityCatalog'
import { latestShares, outsideShareBand, shareCountChange, type SharesFact } from './stockShares'

/**
 * A stock's P/E and dividend yield, worked out from its SEC annual report (owner, 2026-10-25,
 * D167): "Work out from SEC filings", with the link beside each figure opening "The company's
 * SEC filings".
 *
 *   P/E            = price ÷ earnings per share for the latest fiscal year (diluted, else basic)
 *   dividend yield = dividends per share for that same fiscal year ÷ price
 *
 * Both per-share figures come from the SEC's structured data for the company's annual report
 * (lib/server/stockPerShare.ts reads them); the arithmetic is here, pure, so the Stock Registry,
 * Compare, portfolio income, the AI tools and the tests all apply one rule. The catalog's
 * hand-typed `peRatio` and `dividendYieldPct` (2026-07-07, no source) stay in equityCatalog.ts
 * as a record and are shown nowhere.
 *
 * Two guards, each from a measured case (2026-10-25):
 * - A dividend counts only when it is for the same fiscal year as the earnings. Intel stopped
 *   paying in 2024: its last dividend figure is for FY2024 while its earnings are for FY2025,
 *   and a 2024 dividend over today's price would be a yield it no longer pays.
 * - No earnings figure means no dividend figure either. Visa's EPS is reported per share class,
 *   which the bulk data drops, and the one dividend figure left is a single quarter's ($0.59 of
 *   $2.36): without the earnings year to check it against, it cannot be trusted.
 *
 * A third since D170 (2026-10-25): no figure against a price when the share count has changed by
 * a split's worth since that fiscal year. Booking split 25-for-1 and Honeywell 1-for-2 after
 * their FY2025 reports, so FY2025 earnings per old share over a price per new share gave Booking
 * a P/E of 1.4. Both are withheld until the next annual report restates the figures in new
 * shares (lib/data/stockShares.ts), and never adjusted by a guessed ratio. Prices are only ever
 * live since D170: the reference price is used nowhere.
 */

export interface PerShareFact {
  val: number
  /** The fiscal period's end date, YYYY-MM-DD. */
  end: string
}

/** What the SEC's annual data gives for one company, before the rules are applied. */
export interface PerShareFacts {
  epsDiluted?: PerShareFact
  epsBasic?: PerShareFact
  dpsDeclared?: PerShareFact
  dpsPaid?: PerShareFact
}

/**
 * - `paid`: a dividend per share for the latest fiscal year.
 * - `none`: no dividend for that year (a zero, a dividend reported only for earlier years, or
 *   no figure from a company the catalog lists as not paying one).
 * - `unknown`: the SEC data has no usable figure (no earnings figure, or no dividend figure from
 *   a company that may pay one). Never shown as "none".
 */
export type DividendState = 'paid' | 'none' | 'unknown'

export interface StockPerShare {
  eps: (PerShareFact & { basis: 'diluted' | 'basic' }) | null
  /** Dividends per share for the same fiscal year as `eps`, when `dividend` is 'paid'. */
  dps: PerShareFact | null
  dividend: DividendState
  /** The fiscal year end the figures are for (the earnings figure's), or null. */
  asOf: string | null
  /** Shares outstanding on the latest SEC cover page (D170), or null. */
  shares: SharesFact | null
  /**
   * Latest share count ÷ the count on the first cover after `asOf`. Outside
   * SHARE_CHANGE_BAND the stock split (or reorganised) since its annual report, and the
   * per-share figures are not set against a price.
   */
  shareChange: number | null
}

const latest = (...facts: Array<PerShareFact | undefined>): PerShareFact | undefined =>
  facts.filter((f): f is PerShareFact => !!f && Number.isFinite(f.val)).sort((a, b) => b.end.localeCompare(a.end))[0]

/**
 * Applies the two guards. `knownNonPayer` is the catalog's own record that the company pays no
 * dividend (its `dividendYieldPct` is null): used only to tell `none` from `unknown` when the
 * SEC data has no dividend figure at all, never as a figure.
 */
export function perShareFrom(facts: PerShareFacts, knownNonPayer = false, covers: readonly SharesFact[] = []): StockPerShare {
  const shares = latestShares(covers)
  const ps = perShareRules(facts, knownNonPayer)
  return { ...ps, shares, shareChange: ps.asOf ? shareCountChange(covers, ps.asOf) : null }
}

function perShareRules(facts: PerShareFacts, knownNonPayer: boolean): Omit<StockPerShare, 'shares' | 'shareChange'> {
  // Diluted is the conservative figure and the one a P/E uses; basic only where diluted is
  // missing for the latest year.
  const diluted = facts.epsDiluted && Number.isFinite(facts.epsDiluted.val) ? facts.epsDiluted : undefined
  const basic = facts.epsBasic && Number.isFinite(facts.epsBasic.val) ? facts.epsBasic : undefined
  const epsFact = diluted && (!basic || diluted.end >= basic.end) ? { ...diluted, basis: 'diluted' as const }
    : basic ? { ...basic, basis: 'basic' as const } : null
  if (!epsFact) return { eps: null, dps: null, dividend: 'unknown', asOf: null }

  const dps = latest(facts.dpsDeclared, facts.dpsPaid)
  if (dps && dps.end === epsFact.end) {
    return dps.val > 0
      ? { eps: epsFact, dps, dividend: 'paid', asOf: epsFact.end }
      : { eps: epsFact, dps: null, dividend: 'none', asOf: epsFact.end }
  }
  // A dividend only for earlier years: none for the latest one.
  if (dps && dps.end < epsFact.end) return { eps: epsFact, dps: null, dividend: 'none', asOf: epsFact.end }
  return { eps: epsFact, dps: null, dividend: knownNonPayer && !dps ? 'none' : 'unknown', asOf: epsFact.end }
}

export interface StockFigures {
  /** Null when there is no earnings figure, or the company lost money (no meaningful P/E). */
  pe: number | null
  /** `split`: the share count changed by a split's worth since the fiscal year (D170). */
  peState: 'shown' | 'loss' | 'split' | 'unknown'
  dividendYieldPct: number | null
  dividend: DividendState
  asOf: string | null
  epsBasis: 'diluted' | 'basic' | null
}

/** P/E and yield against the live price; none without one (D170: no reference prices). */
export function stockFigures(ps: StockPerShare | null | undefined, livePrice: number | null | undefined): StockFigures {
  const none: StockFigures = { pe: null, peState: 'unknown', dividendYieldPct: null, dividend: 'unknown', asOf: null, epsBasis: null }
  if (!ps) return none
  const price = livePrice
  const usable = price != null && Number.isFinite(price) && price > 0
  const base = { asOf: ps.asOf, epsBasis: ps.eps?.basis ?? null, dividend: ps.dividend }
  if (ps.eps && outsideShareBand(ps.shareChange ?? null)) {
    return { ...base, pe: null, peState: 'split', dividendYieldPct: null }
  }
  let pe: number | null = null
  let peState: StockFigures['peState'] = 'unknown'
  if (ps.eps && ps.eps.val <= 0) peState = 'loss'
  else if (ps.eps && usable) {
    const v = price / ps.eps.val
    // A near-zero EPS gives a meaningless multiple in the thousands.
    if (Number.isFinite(v) && v <= 10_000) { pe = Math.round(v * 100) / 100; peState = 'shown' }
  }
  const dividendYieldPct = ps.dividend === 'paid' && ps.dps && usable ? Math.round((ps.dps.val / price) * 10_000) / 100 : null
  return { ...base, pe, peState, dividendYieldPct }
}

/** The link beside every stock P/E and yield (D167): the company's annual reports on EDGAR. */
export function stockFiguresLink(symbol: string): { href: string; text: string; title: string } {
  return {
    href: secFilingsUrl(symbol, '10-K'),
    text: 'SEC filings',
    title: `${symbol}’s annual reports on the SEC’s EDGAR, where its earnings and dividends per share are filed`,
  }
}

/** Words for a P/E cell and its hover text. */
export function peText(f: StockFigures): { value: string; explain: string } {
  const year = f.asOf ? `the fiscal year ended ${f.asOf}` : 'its latest fiscal year'
  if (f.peState === 'shown') {
    return { value: `${f.pe!.toFixed(1)}`, explain: `Price ÷ ${f.epsBasis ?? ''} earnings per share for ${year}, from the company’s SEC annual report. The price moves; the earnings figure changes with the next annual report.` }
  }
  if (f.peState === 'loss') return { value: 'Loss', explain: `The company lost money in ${year}, so a P/E has no meaning.` }
  if (f.peState === 'split') return { value: '—', explain: SPLIT_EXPLAIN(year) }
  if (f.asOf) return { value: '—', explain: `No live price, so no P/E: it is worked out only against a live price, from earnings per share for ${year}.` }
  return { value: '—', explain: 'The SEC’s structured data has no earnings-per-share figure for this company’s latest annual report.' }
}

/** Words for a dividend-yield cell and its hover text. */
export function yieldText(f: StockFigures): { value: string; explain: string } {
  const year = f.asOf ? `the fiscal year ended ${f.asOf}` : 'its latest fiscal year'
  if (f.dividend === 'paid' && f.dividendYieldPct != null) {
    return { value: `${f.dividendYieldPct.toFixed(2)}%`, explain: `Dividends per share for ${year}, from the company’s SEC annual report, ÷ the price. A dividend raised or cut since then is not in it.` }
  }
  if (f.dividend === 'none') return { value: 'None', explain: `No dividend per share for ${year} in the company’s SEC data.` }
  if (f.peState === 'split') return { value: '—', explain: SPLIT_EXPLAIN(year) }
  if (f.dividend === 'paid') return { value: '—', explain: `No live price, so no yield: it is worked out only against a live price, from dividends per share for ${year}.` }
  return { value: '—', explain: 'The SEC’s structured data has no dividend-per-share figure this app can use for this company’s latest annual report. Its filings, linked here, have the dividends it paid.' }
}

const SPLIT_EXPLAIN = (year: string) =>
  `The company’s share count has changed by a split’s worth since ${year}, so its per-share figures for that year are in the old shares and the price in the new. None is worked out until its next annual report.`

/** The per-share fields a page receives from /live-data/stock-universe. */
export interface PerShareFields {
  eps: number | null
  epsBasis: 'diluted' | 'basic' | null
  dividendsPerShare: number | null
  dividendState: DividendState
  perShareAsOf: string | null
  shares?: SharesFact | null
  shareChange?: number | null
}

/**
 * Rebuilds a StockPerShare from the route's fields, split guard and share count included
 * (D170), so every page that works the figures out against its live price applies one rule.
 */
export function perShareFromFields(u: PerShareFields | null | undefined): StockPerShare | null {
  if (!u) return null
  return {
    eps: u.eps != null && u.epsBasis ? { val: u.eps, end: u.perShareAsOf ?? '', basis: u.epsBasis } : null,
    dps: u.dividendsPerShare != null ? { val: u.dividendsPerShare, end: u.perShareAsOf ?? '' } : null,
    dividend: u.dividendState ?? 'unknown',
    asOf: u.perShareAsOf ?? null,
    shares: u.shares ?? null,
    shareChange: u.shareChange ?? null,
  }
}
