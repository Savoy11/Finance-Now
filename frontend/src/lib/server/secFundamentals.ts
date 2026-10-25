// Bulk fundamentals from the SEC's XBRL "frames" API.
//
// Since D167 (2026-10-25) the frames are read by lib/server/stockPerShare.ts, which takes
// earnings AND dividends per share for every stock, catalog ones included, and applies the
// rules in lib/data/stockPerShare.ts. This file keeps the frame calendar and the P/E guard.
//
// https://data.sec.gov/api/xbrl/frames/{taxonomy}/{concept}/{unit}/{period}.json
// returns one reported concept across EVERY filer for a period — the bulk
// counterpart to the per-company `companyfacts` endpoint the detail pages use.
//
// Why this exists: FMP's company-screener powers the Stock Registry universe but
// returns no P/E at all, so the column and its filter are blank for every name
// that isn't in the 79-entry curated catalog — even on a paid plan. Diluted EPS
// from frames plus the screener's price fills that gap for free.
//
// Coverage caveat: XBRL frames only cover US domestic filers whose reporting
// period aligns with the requested frame. Foreign private issuers (20-F), many
// ADRs, and off-calendar fiscal years fall out. This is enrichment — every
// helper degrades to "no value" rather than throwing.

/**
 * Annual frames to consult, newest first.
 *
 * Derived from the clock rather than hardcoded so this doesn't silently go
 * stale every January. Three years, the current one included: a company whose
 * fiscal year ends mid-year files its annual report inside the same calendar
 * year, so its latest figures sit in the current year's frame. Measured
 * 2026-10-25 (D167): Microsoft's FY ended 2026-06-30 was in CY2026 and nowhere
 * else, and reading only the two previous years left it a year stale, with
 * P&G, Cisco and Costco. A frame holds only completed fiscal years, and each
 * company's latest period wins, so the extra frame never replaces a newer one.
 */
export function recentAnnualFrames(now: Date = new Date()): string[] {
  const year = now.getUTCFullYear()
  return [`CY${year}`, `CY${year - 1}`, `CY${year - 2}`]
}

/**
 * Trailing P/E from a reference price and diluted EPS.
 *
 * Null for non-positive EPS: a loss-making company has no meaningful P/E, and
 * emitting a negative multiple would corrupt the registry's min/max P/E filter.
 */
export function computePeRatio(price: number, eps: number | undefined): number | null {
  if (eps == null || !Number.isFinite(eps) || eps <= 0) return null
  if (!Number.isFinite(price) || price <= 0) return null
  const pe = price / eps
  if (!Number.isFinite(pe) || pe > 10_000) return null // guard absurd micro-EPS blowups
  return parseFloat(pe.toFixed(2))
}
