// ─────────────────────────────────────────────────────────────────────────────
// FORM 13F AGGREGATION RULES (T-471, owner request, 2026-11-24).
//
// The SEC's quarterly Form 13F data sets (www.sec.gov, the same structured-data
// family as the Risk/Return sets `build-fund-fees.mjs` reads) carry every
// institutional manager's reported holdings. These rules turn one quarter's
// tables into per-stock institutional ownership: total shares reported, how
// many managers, and the largest holders. Pure — the build script streams the
// files through them; the tests drive them on synthetic rows.
//
// The rules, each from the forms' own semantics (and each a classic way to get
// 13F numbers wrong):
//  - COUNT ONLY SHARES: SSHPRNAMTTYPE 'SH'. 'PRN' rows are bond principal.
//  - EXCLUDE OPTIONS: a row with PUTCALL set is an option position on the
//    shares, not the shares.
//  - ONE EFFECTIVE FILING PER MANAGER AND QUARTER: managers amend. Per the
//    form's amendment semantics, a RESTATEMENT replaces everything the manager
//    filed for the period; a NEW HOLDINGS amendment adds to it. So the
//    effective set is: the latest restatement (else the latest original), plus
//    every "new holdings" amendment filed after it. An amendment whose
//    coverpage is missing or unlabelled is treated as a restatement — the
//    safer error is undercounting one manager, not counting them twice.
//  - ONE PERIOD PER BUILD: a set also carries late filings for older quarters;
//    only the target period's filings count.
//
// VALUE is whole dollars: the set's own metadata — "Starting on January 3,
// 2023, market value is reported rounded to the nearest dollar."
//
// Known limit, stated rather than hidden (the methods page carries it): totals
// are AS FILED. A parent and its subsidiary can each report the same shares,
// and managers holding a stock through another manager's report are handled by
// the form's own other-manager conventions; nothing here second-guesses them.
// ─────────────────────────────────────────────────────────────────────────────

export interface SubmissionRow {
  accession: string
  filedAt: string // ISO yyyy-mm-dd
  type: string // 13F-HR | 13F-HR/A | 13F-NT | …
  cik: string
  period: string // ISO yyyy-mm-dd
}

export interface CoverRow {
  accession: string
  isAmendment: boolean
  /** 'restatement' | 'add' | null — normalized from AMENDMENTTYPE. */
  amendmentKind: 'restatement' | 'add' | null
  managerName: string
}

export interface InfoRow {
  accession: string
  cusip: string
  shares: number
  sharesType: string // SH | PRN
  putCall: string // '' when the row is the shares themselves
}

export interface HolderTotal {
  name: string
  cik: string
  shares: number
  valueUsd: number
}

export interface CusipAggregate {
  totalShares: number
  holderCount: number
  topHolders: HolderTotal[]
}

/** "31-JUL-2026" (the sets' date spelling) → "2026-07-31". */
export function isoFromSetDate(d: string): string {
  const m = /^(\d{2})-([A-Z]{3})-(\d{4})$/.exec(d.trim().toUpperCase())
  if (!m) return d
  const months: Record<string, string> = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' }
  const mm = months[m[2]]
  return mm ? `${m[3]}-${mm}-${m[1]}` : d
}

export function normalizeAmendmentKind(raw: string | undefined): 'restatement' | 'add' | null {
  if (!raw) return null
  if (/RESTAT/i.test(raw)) return 'restatement'
  if (/NEW/i.test(raw)) return 'add'
  return null
}

/**
 * The target period: the reporting quarter most managers in the set filed for
 * (the set spans a filing window, so stragglers for older quarters ride along).
 */
export function dominantPeriod(submissions: readonly SubmissionRow[]): string | null {
  const counts = new Map<string, number>()
  for (const s of submissions) {
    if (!s.type.startsWith('13F-HR')) continue
    counts.set(s.period, (counts.get(s.period) ?? 0) + 1)
  }
  let best: string | null = null
  for (const [p, n] of counts) if (best === null || n > (counts.get(best) ?? 0)) best = p
  return best
}

/**
 * The accessions that count, per manager, for one period — the amendment rule
 * above. Returns accession → manager CIK for every effective filing.
 */
export function effectiveFilings(
  submissions: readonly SubmissionRow[],
  covers: ReadonlyMap<string, CoverRow>,
  period: string,
): Map<string, string> {
  const byCik = new Map<string, SubmissionRow[]>()
  for (const s of submissions) {
    if (s.period !== period || !s.type.startsWith('13F-HR')) continue
    const list = byCik.get(s.cik) ?? []
    list.push(s)
    byCik.set(s.cik, list)
  }

  const effective = new Map<string, string>()
  for (const [cik, list] of byCik) {
    const sorted = [...list].sort((a, b) => (a.filedAt < b.filedAt ? -1 : a.filedAt > b.filedAt ? 1 : a.accession < b.accession ? -1 : 1))
    const isRestating = (s: SubmissionRow): boolean => {
      if (!s.type.includes('/A')) return true // an original (a refiled original replaces the earlier one)
      return (covers.get(s.accession)?.amendmentKind ?? 'restatement') === 'restatement'
    }
    let baseIndex = -1
    for (let i = 0; i < sorted.length; i++) if (isRestating(sorted[i])) baseIndex = i
    if (baseIndex === -1) baseIndex = 0 // only "add" amendments: count them all
    for (let i = baseIndex; i < sorted.length; i++) {
      const s = sorted[i]
      if (i === baseIndex || !isRestating(s)) effective.set(s.accession, cik)
    }
  }
  return effective
}

/**
 * Fold one holdings row into the per-CUSIP, per-manager totals. The caller
 * streams millions of rows through this with a pre-filtered CUSIP set; a row
 * that is not plain shares of an effective filing folds to nothing.
 */
export function foldInfoRow(
  totals: Map<string, Map<string, { shares: number; valueUsd: number }>>,
  row: InfoRow & { valueUsd?: number },
  effective: ReadonlyMap<string, string>,
): void {
  if (row.sharesType !== 'SH') return
  if (row.putCall.trim() !== '') return
  if (!Number.isFinite(row.shares) || row.shares <= 0) return
  const cik = effective.get(row.accession)
  if (!cik) return
  let byManager = totals.get(row.cusip)
  if (!byManager) { byManager = new Map(); totals.set(row.cusip, byManager) }
  const t = byManager.get(cik) ?? { shares: 0, valueUsd: 0 }
  t.shares += row.shares
  t.valueUsd += Number.isFinite(row.valueUsd) ? (row.valueUsd as number) : 0
  byManager.set(cik, t)
}

/** Per-CUSIP totals, the largest `topN` managers first. */
export function aggregate(
  totals: ReadonlyMap<string, ReadonlyMap<string, { shares: number; valueUsd: number }>>,
  managerNames: ReadonlyMap<string, string>,
  topN = 10,
): Map<string, CusipAggregate> {
  const out = new Map<string, CusipAggregate>()
  for (const [cusip, byManager] of totals) {
    let totalShares = 0
    const holders: HolderTotal[] = []
    for (const [cik, t] of byManager) {
      totalShares += t.shares
      holders.push({ cik, name: managerNames.get(cik) ?? `CIK ${cik}`, shares: t.shares, valueUsd: t.valueUsd })
    }
    holders.sort((a, b) => b.shares - a.shares || (a.name < b.name ? -1 : 1))
    out.set(cusip, { totalShares, holderCount: byManager.size, topHolders: holders.slice(0, topN) })
  }
  return out
}
