// Pure helpers for reading the SEC Risk/Return Summary data sets across quarters.
//
// A fund appears in the RR dataset ONLY in the quarter it filed its prospectus, and
// most file once a year. So "read the newest archive" covers roughly a quarter of any
// catalog and says nothing about the rest — and, worse, it can be GREEN AND STALE at
// once: the Select Sector SPDRs cut their fee to 0.08% in a 485BPOS filed 2026-01-28
// (2026q1), the 2026-09-01 reconcile read 2026q2 only, found nothing for them, and
// six rows stayed at 0.09 with a clean report (T-411).
//
// Kept pure and separate from build-fund-fees.mjs so the selection and merge rules
// are unit-tested; the script itself needs sec.gov and a 500 MB extraction to run.

/**
 * Which quarterly archives to read, newest first.
 *
 * @param {Array<{key: string, href: string}>} links  every archive the index page
 *   lists, `key` like '2026q2' — order irrelevant, duplicates tolerated
 * @param {{pinned?: string, limit?: number}} opts   `pinned` reads exactly one quarter
 *   (RR_QUARTER); otherwise the newest `limit` (default 4 — an annual filer is always
 *   inside the last four quarters, so four is the smallest number that never misses one)
 * @returns {Array<{key: string, href: string}>}
 */
export function selectQuarters(links, { pinned = '', limit = 4 } = {}) {
  const seen = new Set()
  const ordered = [...links]
    .filter((l) => l && /^\d{4}q[1-4]$/.test(l.key))
    .sort((a, b) => b.key.localeCompare(a.key))
    .filter((l) => (seen.has(l.key) ? false : (seen.add(l.key), true)))
  if (ordered.length === 0) throw new Error('no RR dataset links to choose from')
  const pin = String(pinned ?? '').trim().toLowerCase()
  if (pin) {
    const hit = ordered.find((l) => l.key === pin)
    if (!hit) {
      throw new Error(
        `RR_QUARTER=${pin} is not published. Available: ` +
        `${ordered.slice(0, 8).map((l) => l.key).join(', ')}` +
        `${ordered.length > 8 ? `, +${ordered.length - 8} older` : ''}`
      )
    }
    return [hit]
  }
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`limit must be a positive integer, got ${limit}`)
  return ordered.slice(0, limit)
}

/**
 * Merge per-quarter hits so that, for each ticker, the NEWEST quarter that carries it
 * wins — a later filing supersedes an earlier one, and a fund absent from the newest
 * quarter is still found in the one it filed in.
 *
 * @param {Array<{key: string, hits: Map<string, any>}>} quarters  newest first, as
 *   selectQuarters returns them
 * @returns {Map<string, any & {quarter: string}>}  ticker → hit, tagged with the
 *   quarter it came from so the report can say where a number was read
 */
export function mergeFirstHit(quarters) {
  const out = new Map()
  for (const q of quarters) {
    for (const [ticker, hit] of q.hits) {
      if (out.has(ticker)) continue
      out.set(ticker, { ...hit, quarter: q.key })
    }
  }
  return out
}
