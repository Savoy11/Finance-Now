/**
 * The quarterly accuracy check (owner, 2026-10-25, D166): `npm run accuracy-check`.
 *
 * Owner: "For any fund where the yield is posted we need to build some kind of quarterly check
 * that reconfirms the accuracy of the yield; this can extend to other values that are being
 * posted to ensure overall accuracy within the app."
 *
 * Every figure the app posts from a hand-kept source is listed here with the date it was read,
 * when its re-read falls due, and the command that re-reads it:
 *
 * - each shown fund yield, a quarter after the date its page gave (YIELD_CHECK_AFTER_DAYS),
 *   and no longer shown a month after that (YIELD_SHOWN_FOR_DAYS), so a missed check leaves
 *   the link beside it and no old figure;
 * - each fund asset figure read from the fund's own page, a quarter after its date;
 * - each fund asset figure from an SEC filing, once a newer quarter's filing is due out;
 * - every provenance clock `npm run staleness:check` discovers (staking facts, the fee table,
 *   stablecoin issuers, FOMC dates, site terms…), on the date it fires;
 * - with `--sec` (D167), each catalog stock's P/E and yield: worked out daily from its SEC
 *   annual report, so nothing is re-read by hand, but a stock whose latest annual figures are
 *   older than a year and a quarter, or missing, is listed so a stale or absent figure is seen.
 *
 * It reads no website and changes nothing. Pure: the catalog, the clocks and `now` are
 * parameters, so the tests run it on fixtures. It never fails on a figure being due: being
 * due is the reminder, and withholding is the fund page's job, not this report's.
 */

import type { StockPerShare } from '../../src/lib/data/stockPerShare'
import { fundShownYield, YIELD_CHECK_AFTER_DAYS, YIELD_SHOWN_FOR_DAYS, type FundEntry } from '../../src/lib/data/fundCatalog'

const DAY_MS = 86_400_000
/** Days ahead of a due date that the report starts listing a figure as coming due. */
export const ACCURACY_HORIZON_DAYS = 21
/**
 * A filed asset figure is the period end of a quarterly N-PORT (or a trust's 10-Q). The next
 * quarter's is made public about 60 days after that quarter closes, so the figure falls due
 * a quarter plus 60 days after its own period end.
 */
export const FILED_FIGURE_DUE_DAYS = 92 + 60
/**
 * A stock's figures are for its latest fiscal year. The next annual report's figures reach the
 * SEC's data within about 75 days of the next year end (large filers file in 60), so they fall
 * due a year and 75 days after the current ones' period end.
 */
export const STOCK_FIGURES_DUE_DAYS = 365 + 75

export type AccuracyStatus = 'ok' | 'soon' | 'due' | 'withheld'

export interface AccuracyRow {
  /** Which group of figures: one per re-read command. */
  group: 'fund-yield' | 'fund-assets-page' | 'fund-assets-filed' | 'stock-per-share' | 'clock'
  /** What is posted: a fund symbol, or a clock's table. */
  item: string
  /** The date the figure was read, or the clock's anchor. */
  asOf: string
  /** The first day it is due for its re-read. */
  dueOn: string
  /** For a yield: the first day it is no longer shown. */
  withheldOn?: string
  status: AccuracyStatus
  /** Days until due (negative once past). */
  days: number
  /** A recorded decision about it: a clock's STALENESS-ACK, when valid for its anchor. */
  note?: string
}

const utc = (d: string) => Date.parse(`${d}T00:00:00Z`)
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const addDays = (d: string, n: number) => iso(utc(d) + n * DAY_MS)
const floorDay = (ms: number) => Math.floor(ms / DAY_MS) * DAY_MS

function statusOf(dueOn: string, nowMs: number, withheldOn?: string): { status: AccuracyStatus; days: number } {
  const days = Math.round((utc(dueOn) - floorDay(nowMs)) / DAY_MS)
  if (withheldOn && utc(withheldOn) <= floorDay(nowMs)) return { status: 'withheld', days }
  if (days <= 0) return { status: 'due', days }
  if (days <= ACCURACY_HORIZON_DAYS) return { status: 'soon', days }
  return { status: 'ok', days }
}

type CatalogFund = Pick<FundEntry, 'symbol' | 'website' | 'yieldPct' | 'yieldRead' | 'aumAsOf' | 'aumRead'>

/** One row per posted fund figure that carries a date. */
export function fundRows(catalog: readonly CatalogFund[], nowMs: number): AccuracyRow[] {
  const now = new Date(floorDay(nowMs))
  const rows: AccuracyRow[] = []
  for (const f of catalog) {
    // A shown yield, or one withheld only for age: both are this check's to re-read. A
    // yield on a site that does not allow it is never posted, so it is not listed.
    const y = fundShownYield(f, now)
    if (y.shown || (!y.shown && y.reason === 'too-old')) {
      const asOf = f.yieldRead!.asOf
      // fundShownYield shows a yield through YIELD_SHOWN_FOR_DAYS days old, so it is
      // withheld the day after; due falls the day after YIELD_CHECK_AFTER_DAYS likewise.
      const dueOn = addDays(asOf, YIELD_CHECK_AFTER_DAYS + 1)
      const withheldOn = addDays(asOf, YIELD_SHOWN_FOR_DAYS + 1)
      rows.push({ group: 'fund-yield', item: f.symbol, asOf, dueOn, withheldOn, ...statusOf(dueOn, nowMs, withheldOn) })
    }
    if (f.aumRead) {
      const dueOn = addDays(f.aumRead.asOf, YIELD_CHECK_AFTER_DAYS + 1)
      rows.push({ group: 'fund-assets-page', item: f.symbol, asOf: f.aumRead.asOf, dueOn, ...statusOf(dueOn, nowMs) })
    }
    if (f.aumAsOf) {
      const dueOn = addDays(f.aumAsOf, FILED_FIGURE_DUE_DAYS)
      rows.push({ group: 'fund-assets-filed', item: f.symbol, asOf: f.aumAsOf, dueOn, ...statusOf(dueOn, nowMs) })
    }
  }
  return rows
}

/**
 * One row per catalog stock (D167): due when its SEC figures should have moved to a newer
 * fiscal year. A stock with no usable earnings figure is listed as due, with a note, since
 * every page shows a dash for it; one whose dividend is not in the data says so too.
 */
export function stockRows(perShare: ReadonlyMap<string, StockPerShare>, nowMs: number): AccuracyRow[] {
  const today = iso(floorDay(nowMs))
  return [...perShare].map(([symbol, ps]) => {
    if (!ps.asOf) {
      return { group: 'stock-per-share' as const, item: symbol, asOf: 'none', dueOn: today, status: 'due' as const, days: 0,
        note: 'no usable earnings figure in the SEC data: P/E and yield show a dash' }
    }
    const dueOn = addDays(ps.asOf, STOCK_FIGURES_DUE_DAYS)
    return {
      group: 'stock-per-share' as const, item: symbol, asOf: ps.asOf, dueOn, ...statusOf(dueOn, nowMs),
      ...(ps.dividend === 'unknown' ? { note: 'dividend not in the SEC data: yield shows a dash' } : {}),
    }
  })
}

/** A provenance clock, as `staleness:check` discovers it. */
export interface ClockInput {
  file: string
  anchorName: string
  anchorDate: string
  windowDays: number
  ack: { date: string; note: string } | null
}

/** One row per clock, due on the day it fires (anchor + window + 1, as staleness:check counts). */
export function clockRows(clocks: readonly ClockInput[], nowMs: number): AccuracyRow[] {
  return clocks.map((c) => {
    const dueOn = addDays(c.anchorDate, c.windowDays + 1)
    // An ack dated before its anchor was about an earlier compile, so it does not count
    // (the rule staleness:check applies).
    const acked = c.ack != null && utc(c.ack.date) >= utc(c.anchorDate)
    return {
      group: 'clock' as const, item: `${c.anchorName} (${c.file.replace(/^src\/lib\//, '')})`, asOf: c.anchorDate, dueOn,
      ...statusOf(dueOn, nowMs), ...(acked ? { note: `owner chose to let it fire (${c.ack!.date})` } : {}),
    }
  })
}

/** How each group is re-read. Printed beside the group, so the report says what to run. */
export const REREAD_STEPS: Record<AccuracyRow['group'], string[]> = {
  'fund-yield': [
    'On the owner’s machine: npm run fund-figures-prefill -- --only <the symbols below>   (plans and gives a cost estimate; spends nothing)',
    'Then, with the owner’s go-ahead on that estimate: the same command with --run.',
    'Rebuild the Fund Figures Check with --suggestions; the owner confirms each figure there (or reads it by hand).',
    'The session runs npm run fund-figures-plan over the page’s answers and brings every change to the owner before applying it by PR.',
  ],
  'fund-assets-page': [
    'Read with the yields above: the same pre-fill, check page and plan.',
  ],
  'fund-assets-filed': [
    'npm run fund-facts on the owner’s machine (SEC filings, keyless; reports, never writes), then apply the newer period by PR.',
  ],
  'stock-per-share': [
    'Worked out each day from the company’s SEC annual report: nothing to re-read by hand.',
    'A row due means the SEC data has no newer annual report for that company yet (late filing, or a changed tag): open its filings, linked beside its figures, and say whether to look closer.',
  ],
  clock: [
    'Re-verify the table as a whole and move its date, or record a STALENESS-ACK; npm run staleness:check gives the detail.',
  ],
}

export interface AccuracySummary {
  rows: AccuracyRow[]
  counts: Record<AccuracyStatus, number>
  /** Symbols whose yield or page-read assets need re-reading now or within the horizon. */
  fundsToReread: string[]
}

export function summarize(rows: AccuracyRow[]): AccuracySummary {
  const counts: Record<AccuracyStatus, number> = { ok: 0, soon: 0, due: 0, withheld: 0 }
  for (const r of rows) counts[r.status]++
  const fundsToReread = [...new Set(rows
    .filter((r) => (r.group === 'fund-yield' || r.group === 'fund-assets-page') && r.status !== 'ok')
    .map((r) => r.item))].sort()
  return { rows: [...rows].sort((a, b) => a.days - b.days || a.item.localeCompare(b.item)), counts, fundsToReread }
}

const GROUP_TITLES: Record<AccuracyRow['group'], string> = {
  'fund-yield': 'Fund yields shown (read from the fund’s own page; re-read each quarter)',
  'fund-assets-page': 'Fund net assets read from the fund’s own page',
  'fund-assets-filed': 'Fund net assets from SEC filings',
  'stock-per-share': 'Stock P/E and dividend yield (from each company’s SEC annual report)',
  clock: 'Hand-kept tables with a provenance clock',
}

const STATUS_WORDS: Record<AccuracyStatus, string> = {
  ok: 'ok', soon: 'due soon', due: 'DUE', withheld: 'WITHHELD (link only)',
}

/** The report as Markdown, for the terminal and for a dated file. */
export function accuracyReport(summary: AccuracySummary, today: string, opts: { yieldSites?: string[] } = {}): string {
  const out: string[] = []
  out.push(`# Accuracy check — ${today}`, '')
  out.push('Every posted figure with a date, when its re-read falls due, and how to re-read it (D166).')
  out.push(`A shown yield falls due ${YIELD_CHECK_AFTER_DAYS} days after its date and is withheld ${YIELD_SHOWN_FOR_DAYS} days after it; "due soon" means within ${ACCURACY_HORIZON_DAYS} days.`, '')
  const c = summary.counts
  out.push(`**${summary.rows.length} figures and tables:** ${c.withheld} withheld, ${c.due} due, ${c.soon} due soon, ${c.ok} ok.`, '')
  if (summary.fundsToReread.length) {
    out.push(`**Funds to re-read now:** ${summary.fundsToReread.join(', ')}`, '')
    out.push('```', `npm run fund-figures-prefill -- --only ${summary.fundsToReread.join(',')}`, '```', '')
  }
  for (const group of Object.keys(GROUP_TITLES) as AccuracyRow['group'][]) {
    const rows = summary.rows.filter((r) => r.group === group)
    if (!rows.length) continue
    const pending = rows.filter((r) => r.status !== 'ok')
    out.push(`## ${GROUP_TITLES[group]} — ${rows.length}`, '')
    if (group === 'fund-yield' && opts.yieldSites?.length) out.push(`Only from the sites that allow it: ${opts.yieldSites.join(', ')}.`, '')
    for (const step of REREAD_STEPS[group]) out.push(`- ${step}`)
    out.push('')
    // Every row that needs attention, in full; the rest counted, so a long list of ok
    // figures does not bury the ones due.
    if (pending.length) {
      out.push('| Item | Read | Due | Status |', '|---|---|---|---|')
      for (const r of pending) {
        out.push(`| ${r.item} | ${r.asOf} | ${r.dueOn}${r.withheldOn ? ` (withheld ${r.withheldOn})` : ''} | ${STATUS_WORDS[r.status]}${r.status === 'soon' ? `, in ${r.days} day(s)` : ''}${r.note ? `; ${r.note}` : ''} |`)
      }
      out.push('')
    }
    const ok = rows.filter((r) => r.status === 'ok')
    if (ok.length) {
      const next = ok.reduce((a, b) => (a.days <= b.days ? a : b))
      out.push(`${ok.length} ok; the next falls due ${next.dueOn} (${next.item}).`, '')
    }
  }
  return out.join('\n')
}

/** The sites a yield may be shown from, sorted, for the report. */
export function yieldSiteList(sites: readonly string[]): string[] {
  return [...sites].sort()
}
