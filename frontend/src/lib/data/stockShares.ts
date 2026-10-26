/**
 * A stock's shares outstanding, from the cover page of its SEC filings, and what follows from it
 * (owner, 2026-10-25, D170):
 *
 *   market cap = shares outstanding (the latest filing's cover) × the LIVE price
 *
 * No live price, no market cap: the catalog's hand-typed reference prices (2026-07-07) are used
 * nowhere since D170. They had gone stale in the way that does the most damage: Netflix and
 * ServiceNow split their shares, so a pre-split $1,100 over post-split earnings made a P/E of 435.
 *
 * The cover figure is `dei:EntityCommonStockSharesOutstanding`, which every 10-Q and 10-K states
 * "as of" a recent date. lib/server/stockPerShare.ts reads it for every filer from the SEC's
 * quarterly "frames"; the rules are here, pure. A company with more than one class of common
 * stock (Alphabet, Meta, Berkshire, Visa…) reports a count per class, which the bulk data drops,
 * so it has no figure here and no market cap: a total would need each class's price.
 *
 * The share count also catches a split after the annual report. Earnings per share are for the
 * latest fiscal year; a company that split since then (Honeywell's 1-for-2 in 2026, Booking's)
 * has a price in new shares and earnings in old ones, and the P/E between them is wrong by the
 * split ratio. `shareCountChange` compares the count on the first cover after that fiscal year
 * with the latest one: buybacks and issuance move it by a few percent a year, a split by a whole
 * ratio. Outside `SHARE_CHANGE_BAND` the per-share figures are withheld until the next annual
 * report, never adjusted by a guessed ratio.
 */

export interface SharesFact {
  /** Shares outstanding on the cover page. */
  val: number
  /** The "as of" date the cover states, YYYY-MM-DD. */
  end: string
  /** The filing's accession number. */
  accn: string
}

/**
 * A change in the share count beyond this, between the annual report and the latest cover, is
 * taken for a split or a reorganisation. The narrowest split is 3-for-2 (×1.5) or 2-for-3; the
 * band sits just inside both, and buybacks or issuance in a year stay far within it (Apple's
 * count fell 2.6% over 2025).
 */
export const SHARE_CHANGE_BAND = { below: 0.7, above: 1.4 } as const

/** The quarterly instant frames to read, newest first: the current quarter and the nine before. */
export function recentInstantFrames(now: Date = new Date(), count = 10): string[] {
  let year = now.getUTCFullYear()
  let q = Math.floor(now.getUTCMonth() / 3) + 1
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(`CY${year}Q${q}I`)
    q -= 1
    if (q === 0) { q = 4; year -= 1 }
  }
  return out
}

/** A company's cover figures, oldest first, with one per date (the latest filing wins a tie). */
export function sharesHistory(facts: readonly SharesFact[]): SharesFact[] {
  const byDate = new Map<string, SharesFact>()
  for (const f of facts) {
    if (!Number.isFinite(f.val) || f.val <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(f.end)) continue
    const prev = byDate.get(f.end)
    if (!prev || f.accn > prev.accn) byDate.set(f.end, f)
  }
  return [...byDate.values()].sort((a, b) => a.end.localeCompare(b.end))
}

export const latestShares = (history: readonly SharesFact[]): SharesFact | null =>
  history.length ? history[history.length - 1] : null

/**
 * Latest count ÷ the count on the first cover dated after `fiscalYearEnd`, or null when there is
 * no cover after it to compare with (then nothing is withheld: no evidence of a split).
 */
export function shareCountChange(history: readonly SharesFact[], fiscalYearEnd: string): number | null {
  const after = history.find((f) => f.end > fiscalYearEnd)
  if (!after) return null
  return latestShares(history)!.val / after.val
}

export const outsideShareBand = (ratio: number | null): boolean =>
  ratio != null && (ratio < SHARE_CHANGE_BAND.below || ratio > SHARE_CHANGE_BAND.above)

/** Market cap in US dollars, or null without a cover figure or a live price. */
export function marketCapUsd(shares: SharesFact | null | undefined, livePrice: number | null | undefined): number | null {
  if (!shares || livePrice == null || !Number.isFinite(livePrice) || livePrice <= 0) return null
  const v = shares.val * livePrice
  return Number.isFinite(v) ? v : null
}

/** Words for a market-cap cell and its hover text. */
export function marketCapText(shares: SharesFact | null | undefined, livePrice: number | null | undefined): { value: string; explain: string } {
  const cap = marketCapUsd(shares, livePrice)
  if (cap != null && shares) {
    const b = cap / 1e9
    const value = b >= 1000 ? `$${(b / 1000).toFixed(2)}T` : b >= 1 ? `$${b.toFixed(b >= 100 ? 0 : 1)}B` : `$${(cap / 1e6).toFixed(0)}M`
    return { value, explain: `${shares.val.toLocaleString('en-US')} shares outstanding as of ${shares.end}, from the cover of the company’s latest SEC filing, × the live price.` }
  }
  if (!shares) return { value: '—', explain: 'The SEC’s structured data has no single share count for this company, as for a company with more than one class of stock, so no market cap is worked out.' }
  return { value: '—', explain: 'No live price, so no market cap: it is worked out only against a live price.' }
}
