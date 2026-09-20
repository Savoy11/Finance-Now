/**
 * Curated-data staleness horizon — `npm run staleness:check`.
 *
 * WHY THIS EXISTS. Every hand-maintained table in this repo carries provenance: a
 * `*_LAST_VERIFIED`-style anchor, a `*_STALE_AFTER_DAYS` window, and a `get…Provenance()`
 * that turns the two into a confidence the UI renders. That machinery is good at telling
 * a READER the data is old. It has no way of telling a MAINTAINER that a clock is about
 * to fire, because nothing reads these dates except the page that displays them.
 *
 * The cost was measured on 2026-09-20, when this was written:
 *
 *     transferFees   verified 2025-06-01, 120-day window   →  STALE FOR 355 DAYS
 *
 * Nobody had decided to let that happen. Nobody had noticed. The only reason the staking
 * catalog's own clock — 7 days out on that date — was caught at all is that someone
 * happened to read the file. That is not a process.
 *
 * ⚠ WHY IT DOES NOT SIMPLY FAIL ON "STALE". A guard that goes red the moment a table
 * passes its window would, on the day it fires, present whoever is on shift with two
 * options: do a full re-verification, or bump the date. Bumping the date takes four
 * seconds and turns CI green, and it is EXACTLY the fabricated freshness every one of
 * these provenance blocks exists to prevent — CLAUDE.md: "Date the table by when it was
 * compiled as a whole, never by its most recent partial edit."
 *
 * So staleness alone is not a failure. Staleness NOBODY DECIDED ON is the failure.
 * Letting a notice fire is a legitimate, often correct choice — `transferFees` is stale
 * because its page is held out of the rollout, which is a decision, not an oversight.
 * The bug is that the decision was never written down, so it was indistinguishable from
 * having been missed.
 *
 * ⚠ THE ACKNOWLEDGEMENT LIVES BESIDE THE CONSTANT, NOT IN A LEDGER. A separate registry
 * file drifts from the thing it describes — the two are edited by different people at
 * different times, and the ledger is always the one that rots. A comment above the
 * anchor shows up in that file's own diff and blame, and the same scan that discovers
 * the clock discovers its acknowledgement. Format:
 *
 *     // STALENESS-ACK: 2026-09-20 — let the notice fire; page is held out of rollout (D#).
 *     export const TRANSFER_FEES_LAST_VERIFIED = '2025-06-01'
 *
 * The ack date must be on or after the anchor date, so an acknowledgement cannot be
 * inherited from a previous compile of the table. Re-verifying and bumping the anchor
 * past the ack invalidates it, which is correct: the new table has not been decided on.
 *
 * ⚠ ANTI-VACUITY. Clocks are DISCOVERED from the tree, never listed here — a typed list
 * silently stops covering a table the day someone adds one. Discovery failing is itself
 * a failure: zero clocks found, or a window whose anchor cannot be resolved, exits 1
 * rather than reporting a clean sweep of nothing. A guard that cannot find its subject
 * has not verified that the subject is fine.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(here, '..')
const srcDir = path.join(frontendDir, 'src')

/** Days before a clock fires that we start saying so. Warning only — never a failure. */
const HORIZON_DAYS = 21

const DAY_MS = 86_400_000

export interface Clock {
  file: string
  prefix: string
  anchorName: string
  anchorDate: string
  windowDays: number
  ack: { date: string; note: string } | null
}

/** One source file's text, so discovery can be exercised on fixtures as well as the tree. */
export interface Source {
  rel: string
  text: string
}

// ─── discovery ───────────────────────────────────────────────────────────────

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue
      walk(full, out)
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

/**
 * Find every `*_STALE_AFTER_DAYS` window and pair it with the dated anchor that shares
 * its prefix. The prefix is the window name minus the suffix, which is the convention
 * every table in the repo already follows (STAKING_DATA_*, FALLBACK_*, META_*, …).
 */
export function discoverFrom(sources: Source[]): { clocks: Clock[]; problems: string[] } {
  const clocks: Clock[] = []
  const problems: string[] = []

  for (const { rel, text } of sources) {
    const windows = [...text.matchAll(/^\s*(?:export\s+)?const\s+([A-Z0-9_]+)_STALE_AFTER_DAYS\s*=\s*(\d+)/gm)]
    if (windows.length === 0) continue

    for (const w of windows) {
      const prefix = w[1]
      const windowDays = Number(w[2])

      const anchorRe = new RegExp(
        `^[^\\n]*?(?:export\\s+)?const\\s+(${prefix}_[A-Z0-9_]+)\\s*=\\s*'(\\d{4}-\\d{2}-\\d{2})'`,
        'gm',
      )
      const anchors = [...text.matchAll(anchorRe)]

      if (anchors.length === 0) {
        // The window exists but its date does not, so nothing can be computed. Reporting
        // "no clocks near firing" here would be a lie by omission.
        problems.push(
          `${rel}: ${prefix}_STALE_AFTER_DAYS has no dated anchor named ${prefix}_* — ` +
            `the window cannot be evaluated, so this table is unwatched. Rename the date ` +
            `constant to share the prefix, or this guard is blind to it.`,
        )
        continue
      }
      if (anchors.length > 1) {
        problems.push(
          `${rel}: ${prefix}_STALE_AFTER_DAYS matches ${anchors.length} dated anchors ` +
            `(${anchors.map((a) => a[1]).join(', ')}) — ambiguous, so the guard refuses to guess.`,
        )
        continue
      }

      const [, anchorName, anchorDate] = anchors[0]

      // Look for an acknowledgement in the comment block immediately above the anchor.
      const anchorIdx = text.indexOf(anchors[0][0])
      const preceding = text.slice(Math.max(0, anchorIdx - 1200), anchorIdx)
      const ackMatch = [...preceding.matchAll(/STALENESS-ACK:\s*(\d{4}-\d{2}-\d{2})\s*[—-]\s*([^\n]*)/g)].pop()

      clocks.push({
        file: rel,
        prefix,
        anchorName,
        anchorDate,
        windowDays,
        ack: ackMatch ? { date: ackMatch[1], note: ackMatch[2].trim() } : null,
      })
    }
  }

  return { clocks, problems }
}

/** Real-tree discovery: read every non-test .ts/.tsx under src/ and scan it. */
function discover(): { clocks: Clock[]; problems: string[] } {
  return discoverFrom(
    walk(srcDir).map((full) => ({
      rel: path.relative(frontendDir, full).replace(/\\/g, '/'),
      text: fs.readFileSync(full, 'utf8'),
    })),
  )
}

// ─── evaluation ──────────────────────────────────────────────────────────────

export const utc = (d: string) => Date.parse(`${d}T00:00:00Z`)

/**
 * First day the table reads as stale. Every module in the repo compares with strict `>`
 * (`ageDays > WINDOW`), verified across all seven on 2026-09-20, so the window's own
 * last day is still fresh and firing happens on anchor + window + 1.
 */
export const firstStaleDay = (c: Clock) => utc(c.anchorDate) + (c.windowDays + 1) * DAY_MS

export interface Row {
  c: Clock
  fires: string
  days: number
  /** An ack predating the anchor was written about a PREVIOUS compile of the table. */
  ackValid: boolean
  status: 'ok' | 'imminent' | 'stale'
}

/** Pure classification, so every branch can be exercised without touching the tree. */
export function evaluate(clocks: Clock[], nowMs: number): Row[] {
  const now = Math.floor(nowMs / DAY_MS) * DAY_MS
  return clocks
    .map((c): Row => {
      const fires = firstStaleDay(c)
      const days = Math.round((fires - now) / DAY_MS)
      return {
        c,
        fires: new Date(fires).toISOString().slice(0, 10),
        days,
        ackValid: c.ack != null && utc(c.ack.date) >= utc(c.anchorDate),
        status: days <= 0 ? 'stale' : days <= HORIZON_DAYS ? 'imminent' : 'ok',
      }
    })
    .sort((a, b) => a.days - b.days)
}

function main() {
  // Floored to UTC midnight, so "in N days" counts CALENDAR days to the firing date
  // rather than hours-until. Measuring from the current hour reports 6 for a date seven
  // calendar days out, which reads as an off-by-one next to the date printed beside it.
  const rawNow = process.env.STALENESS_NOW ? utc(process.env.STALENESS_NOW) : Date.now()
  const now = Math.floor(rawNow / DAY_MS) * DAY_MS
  const today = new Date(now).toISOString().slice(0, 10)

  const { clocks, problems } = discover()

  if (clocks.length === 0 && problems.length === 0) {
    console.error(
      '\n✗ staleness:check discovered ZERO provenance clocks under src/.\n\n' +
        '  This repo has several; finding none means the naming convention moved and this\n' +
        '  guard is now checking nothing. That is a failure, not a clean run.\n',
    )
    process.exit(1)
  }

  const rows = evaluate(clocks, now)

  console.log(`\nCurated-data staleness horizon — ${today} (${rows.length} clocks discovered)\n`)
  console.log(
    '  ' +
      'table'.padEnd(26) +
      'verified'.padEnd(13) +
      'win'.padEnd(6) +
      'first stale'.padEnd(14) +
      'in'.padStart(6) +
      '  state',
  )
  console.log('  ' + '-'.repeat(84))

  const unacked: typeof rows = []
  const imminent: typeof rows = []

  for (const r of rows) {
    let state: string
    if (r.status === 'stale') {
      state = r.ackValid ? `stale — acknowledged ${r.c.ack!.date}` : 'STALE, NOT ACKNOWLEDGED'
      if (!r.ackValid) unacked.push(r)
    } else if (r.status === 'imminent') {
      state = r.ackValid ? `fires soon — acknowledged ${r.c.ack!.date}` : 'fires within horizon'
      if (!r.ackValid) imminent.push(r)
    } else {
      state = 'ok'
    }
    console.log(
      '  ' +
        r.c.file.replace(/^src\/lib\//, '').padEnd(26) +
        r.c.anchorDate.padEnd(13) +
        String(r.c.windowDays).padEnd(6) +
        r.fires.padEnd(14) +
        String(r.days).padStart(6) +
        '  ' +
        state,
    )
  }

  if (imminent.length > 0) {
    console.log(`\n  ${imminent.length} clock(s) fire within ${HORIZON_DAYS} days:\n`)
    for (const r of imminent) {
      console.log(`    • ${r.c.anchorName} (${r.c.file}) — ${r.fires}, in ${r.days} day(s)`)
    }
    console.log(
      '\n  Not a failure. Either re-verify the table AS A WHOLE and move the anchor, or\n' +
        '  decide to let the notice fire and record that with a STALENESS-ACK line.\n' +
        '  Re-verifying part of a table does not refresh the rest, and must not move the date.',
    )
  }

  const allProblems = [
    ...problems,
    ...unacked.map(
      (r) =>
        `${r.c.anchorName} (${r.c.file}) went stale on ${r.fires}, ${Math.abs(r.days)} day(s) ago, ` +
        `with no recorded decision. Letting a notice fire is a legitimate choice — but an ` +
        `undecided one is indistinguishable from an oversight, which is the failure this ` +
        `guard exists to surface.`,
    ),
  ]

  if (allProblems.length === 0) {
    console.log(`\n✓ staleness:check — every discovered clock is fresh or has a recorded decision.\n`)
    process.exit(0)
  }

  console.error(`\n✗ staleness:check found ${allProblems.length} problem(s):\n`)
  for (const p of allProblems) console.error(`  • ${p}\n`)
  console.error(
    '  To clear a stale table, either:\n' +
      '    (a) re-verify it as a whole and move its anchor date forward, or\n' +
      '    (b) add, directly above the anchor constant:\n' +
      `          // STALENESS-ACK: <YYYY-MM-DD> — <why letting it fire is the right call>\n` +
      '  The ack date must be on or after the anchor date.\n',
  )
  process.exit(1)
}

// Only run when invoked as a script. The pure exports above are imported by
// __tests__/stalenessHorizon.test.ts, which must not trigger a process.exit.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main()
}
