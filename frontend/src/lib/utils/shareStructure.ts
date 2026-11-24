// ─────────────────────────────────────────────────────────────────────────────
// SHARE STRUCTURE — issued, treasury, outstanding (T-471, owner request,
// 2026-11-24). Who holds a stock starts with the company's own split: shares
// ISSUED = shares OUTSTANDING (in the market) + TREASURY shares (bought back
// and held by the company itself). All three come from the company's SEC XBRL
// facts, which the company-facts route already fetches.
//
// Measured against real filings before writing (2026-11-24):
//  - `TreasuryStockCommonShares` is the CURRENT tag (fresh through 2026-09/10
//    on KO, PG and JPM); `TreasuryStockShares` is its pre-2023 name and goes
//    stale (KO's last row 2023-03-31). Prefer the current tag; fall back to
//    the legacy one only when it is the newer of the two.
//  - A company with NO treasury tag at all is a real case, not a gap: Apple
//    retires repurchased shares, reports issued = outstanding =
//    14,532,259,000 (FY2026 10-K), and files no Treasury* share tag. The
//    surface says "no treasury shares reported", never a dash that reads as
//    unknown, and never a fabricated 0 for a company whose filing simply
//    was not read.
//  - The three figures can carry different as-of dates (JPM's gaap
//    outstanding lags its cover-page count by months), so each figure keeps
//    its own date and the arithmetic check tolerates drift rather than
//    forcing a pie that pretends one date.
//  - A multi-class filer tags its per-class counts with member axes, which
//    the companyfacts file DROPS — so Meta has no untagged share instant at
//    all (measured: zero rows), while Berkshire and Nike carry one ancient
//    stray each (2011 and 2015) that would otherwise be served as current.
//    Hence the age bound: an instant older than MAX_SHARE_FIGURE_AGE_DAYS is
//    a stray, not the company's state, and is never used. Alphabet is the
//    other shape: one fresh COMBINED count across its three classes, which is
//    a true company-wide figure and is served as such (the ownership card
//    says "all classes combined" for catalog multi-class symbols).
// ─────────────────────────────────────────────────────────────────────────────

interface FactRow {
  val: number
  end: string
  form?: string
  start?: string
  fy?: number
}

type ConceptMap = Record<string, { units?: Record<string, FactRow[]> }>

export interface ShareFigure {
  shares: number
  /** The filing instant the figure is as of (ISO date). */
  asOf: string
}

export interface ShareStructure {
  /** Total shares the company has issued. */
  issued: ShareFigure | null
  /**
   * Shares the company holds in its own treasury. Null with
   * `treasuryReported: false` means the filings carry no treasury tag — which
   * for share-retiring companies is the true state, not missing data.
   */
  treasury: ShareFigure | null
  treasuryReported: boolean
  /** Shares outstanding (the cover-page count the app already shows). */
  outstanding: ShareFigure | null
  /** Treasury as a share of issued, percent. */
  treasuryPctOfIssued: number | null
  /**
   * Whether issued − treasury ≈ outstanding (within 2% of issued). False
   * usually means the figures are from different filing dates; the card then
   * shows each with its date instead of one reconciled picture.
   */
  reconciles: boolean | null
}

/**
 * A share instant older than this is a stray from a filer that has since
 * moved to per-class tagging (Berkshire's newest untagged cover count is from
 * 2011, Nike's from 2015 — both measured), never the company's current state.
 * 18 months covers a late annual report with room to spare.
 */
export const MAX_SHARE_FIGURE_AGE_DAYS = 550

/** Newest fresh share-unit instant from 10-K/10-Q rows, with its date. */
function newestInstant(map: ConceptMap, concept: string, now: Date): ShareFigure | null {
  const rows = map[concept]?.units?.shares
  if (!rows) return null
  const oldest = new Date(now.getTime() - MAX_SHARE_FIGURE_AGE_DAYS * 86_400_000).toISOString().slice(0, 10)
  let best: FactRow | null = null
  for (const f of rows) {
    if (f.start || !(f.form?.startsWith('10-K') || f.form?.startsWith('10-Q'))) continue
    if (!Number.isFinite(f.val) || f.end < oldest) continue
    if (!best || f.end > best.end) best = f
  }
  if (!best) return null
  // Insurance: two materially different values on the one chosen date would
  // mean per-class rows survived untagged — ambiguous, so refuse.
  for (const f of rows) {
    if (f.start || f.end !== best.end || !Number.isFinite(f.val)) continue
    if (!(f.form?.startsWith('10-K') || f.form?.startsWith('10-Q'))) continue
    if (Math.abs(f.val - best.val) > best.val * 0.005) return null
  }
  return { shares: best.val, asOf: best.end }
}

export function computeShareStructure(gaap: ConceptMap, dei: ConceptMap, now: Date = new Date()): ShareStructure {
  const issued = newestInstant(gaap, 'CommonStockSharesIssued', now)

  const current = newestInstant(gaap, 'TreasuryStockCommonShares', now)
  const legacy = newestInstant(gaap, 'TreasuryStockShares', now)
  const treasuryReported = current !== null || legacy !== null
  const treasury = current && legacy
    ? (current.asOf >= legacy.asOf ? current : legacy)
    : current ?? legacy

  const outstanding = newestInstant(dei, 'EntityCommonStockSharesOutstanding', now)
    ?? newestInstant(gaap, 'CommonStockSharesOutstanding', now)

  const treasuryPctOfIssued = issued && treasury && issued.shares > 0
    ? (treasury.shares / issued.shares) * 100
    : null

  // With no treasury tag reported, issued should simply equal outstanding.
  const impliedOutstanding = issued ? issued.shares - (treasury?.shares ?? 0) : null
  const reconciles = issued && outstanding && impliedOutstanding !== null
    ? Math.abs(impliedOutstanding - outstanding.shares) <= issued.shares * 0.02
    : null

  return { issued, treasury, treasuryReported, outstanding, treasuryPctOfIssued, reconciles }
}
