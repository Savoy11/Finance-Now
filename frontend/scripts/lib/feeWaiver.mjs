// Pure helpers for telling a waived fee from a plain total in the SEC Risk/Return data,
// and for checking that the catalog states the full fee wherever a waiver applies.
//
// The RR taxonomy carries TWO expense lines: ExpensesOverAssets is "Total Annual Fund
// Operating Expenses" (every fund has it) and NetExpensesOverAssets is the total AFTER a
// fee waiver (only funds with a waiver line). build-fund-fees.mjs takes net where it
// exists and the total otherwise — the fee an investor pays today, which is D36's first
// half (owner ruling, 2026-09-30). Until 2026-09-30 it then dropped the other figure, so
// a run could not say WHICH it had taken, and D36's second half — a waived row's
// description states the full fee — could not be checked for any fund it read. T-412
// applied sixteen of its figures without knowing whether any was a waiver. These keep
// both figures and say.
//
// Kept pure and separate from the script so the rules are unit-tested; the script itself
// needs sec.gov and a multi-hundred-MB extraction to run.

/** Half a basis point — the reconcile's own materiality line (the UI shows two decimals). */
export const WAIVER_EPSILON_PCT = 0.005

/**
 * The catalog's phrasing for a waived fee, e.g. "net of a contractual waiver (0.31% gross)".
 * The SAME pattern fundCatalog.test.ts enforces on every row that mentions a waiver, so a
 * row the test accepts is a row this recognises. No closing bracket is required after
 * "gross": HEFA's reads "(0.70% gross, 0.32 of it the underlying fund fee …)".
 */
export const STATED_GROSS = /net of a (?:contractual |fee )?waiver \((\d+(?:\.\d+)?)% gross/i

/**
 * Which figure a fund's fee is, and whether a waiver is in effect.
 *
 * @param {{ netPct?: number | null, grossPct?: number | null }} [figures]  in percent
 * @returns {{ chosenPct: number | null, line: 'net' | 'total' | null, netPct: number | null,
 *   grossPct: number | null, waiver: boolean | null, note: string | null }}
 *   `chosenPct` is net where a net line exists, else the total — the figure the catalog
 *   records. `waiver` is true when the net sits at least half a basis point under the
 *   total; false when there is no net line or it equals the total; null when the data
 *   cannot say — a net line with no total to compare it with, or a net ABOVE its total —
 *   and `note` names which, so the report sends a human to the filing instead of guessing.
 */
export function classifyExpense({ netPct = null, grossPct = null } = {}) {
  const net = typeof netPct === 'number' && Number.isFinite(netPct) ? netPct : null
  const gross = typeof grossPct === 'number' && Number.isFinite(grossPct) ? grossPct : null
  if (net == null && gross == null) {
    return { chosenPct: null, line: null, netPct: null, grossPct: null, waiver: null, note: null }
  }
  if (net == null) {
    return { chosenPct: gross, line: 'total', netPct: null, grossPct: gross, waiver: false, note: null }
  }
  if (gross == null) {
    return { chosenPct: net, line: 'net', netPct: net, grossPct: null, waiver: null, note: 'net-without-total' }
  }
  const gap = gross - net
  if (gap <= -WAIVER_EPSILON_PCT) {
    return { chosenPct: net, line: 'net', netPct: net, grossPct: gross, waiver: null, note: 'net-above-total' }
  }
  return { chosenPct: net, line: 'net', netPct: net, grossPct: gross, waiver: gap >= WAIVER_EPSILON_PCT, note: null }
}

/**
 * D36's second half for one waived row: does its catalog description state the full fee?
 *
 * @param {string | null | undefined} description  the row's description; null or undefined
 *   when the catalog parse did not find one
 * @param {number | null} [secGrossPct]  the filing's total, when known
 * @returns {'stated' | 'not-stated' | 'stated-differs' | 'unknown'}  'unknown' only when
 *   there is no description to read — a parse miss must never read as "not stated"
 */
export function grossStatement(description, secGrossPct = null) {
  if (description == null) return 'unknown'
  const m = STATED_GROSS.exec(description)
  if (!m) return 'not-stated'
  if (typeof secGrossPct !== 'number' || !Number.isFinite(secGrossPct)) return 'stated'
  return Math.abs(Number(m[1]) - secGrossPct) < WAIVER_EPSILON_PCT ? 'stated' : 'stated-differs'
}

/**
 * Every catalog row's description, read from fundCatalog.ts source (the script is plain
 * .mjs and cannot import the TypeScript). One row per line is the catalog's shape; a row
 * this misses is absent from the map, and grossStatement() answers 'unknown' for it.
 *
 * @param {string} catalogSrc  the text of src/lib/data/fundCatalog.ts
 * @returns {Map<string, string>}  symbol → description, with \' and \\ unescaped
 */
export function catalogDescriptions(catalogSrc) {
  const out = new Map()
  for (const m of catalogSrc.matchAll(/\{\s*symbol:\s*'([A-Z0-9.\-]+)'[^\n]*?description:\s*'((?:[^'\\\n]|\\.)*)'/g)) {
    out.set(m[1], m[2].replace(/\\(['\\])/g, '$1'))
  }
  return out
}
