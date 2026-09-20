import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import {
  discoverFrom,
  evaluate,
  firstStaleDay,
  utc,
  type Clock,
  type Source,
} from '../../../../scripts/check-staleness-horizon'

/**
 * `npm run staleness:check` reports which curated tables are about to pass their review
 * window, and fails on one that went stale with no recorded decision.
 *
 * ⚠ WHY THESE TESTS ARE SHAPED AS THEY ARE. The guard's whole value is its ability to
 * FAIL. A guard that cannot fail still prints a clean sweep, and the clean sweep is what
 * people read — which is exactly how `transferFees` sat 355 days past its window with a
 * green repo. So every test below that asserts "this is fine" is paired with one that
 * mutates the input and asserts the guard NOTICES. Assertions on the happy path alone
 * would pass against a `discoverFrom` that returned `{clocks: [], problems: []}`.
 *
 * The two boundary rules under test are easy to get wrong by one day, and one of them
 * was got wrong by one day while this was being written:
 *   • firing is anchor + window + 1, because every module compares with strict `>`
 *   • an ack dated BEFORE the anchor is void — it was written about a previous compile
 */

const frontend = join(__dirname, '..', '..', '..', '..')

const src = (rel: string, text: string): Source => ({ rel, text })

const clock = (over: Partial<Clock> = {}): Clock => ({
  file: 'src/lib/data/thing.ts',
  prefix: 'THING',
  anchorName: 'THING_LAST_VERIFIED',
  anchorDate: '2026-01-01',
  windowDays: 90,
  ack: null,
  ...over,
})

// ─── discovery ───────────────────────────────────────────────────────────────

describe('discovery', () => {
  it('pairs a window with the dated anchor sharing its prefix', () => {
    const { clocks, problems } = discoverFrom([
      src(
        'a.ts',
        `export const THING_LAST_VERIFIED = '2026-06-28'\nexport const THING_STALE_AFTER_DAYS = 90\n`,
      ),
    ])
    expect(problems).toEqual([])
    expect(clocks).toHaveLength(1)
    expect(clocks[0]).toMatchObject({
      prefix: 'THING',
      anchorName: 'THING_LAST_VERIFIED',
      anchorDate: '2026-06-28',
      windowDays: 90,
      ack: null,
    })
  })

  it('accepts the repo’s other anchor spellings, not just LAST_VERIFIED', () => {
    // FALLBACK_MEASURED_ON, META_AS_OF and TAX_GUIDANCE_COMPILED are all real.
    const { clocks, problems } = discoverFrom([
      src('a.ts', `const FALLBACK_MEASURED_ON = '2026-09-18'\nconst FALLBACK_STALE_AFTER_DAYS = 14\n`),
      src('b.ts', `export const META_AS_OF = '2026-07-28'\nexport const META_STALE_AFTER_DAYS = 120\n`),
    ])
    expect(problems).toEqual([])
    expect(clocks.map((c) => c.anchorName)).toEqual(['FALLBACK_MEASURED_ON', 'META_AS_OF'])
  })

  // ── MUTATION: remove the anchor. A guard that reported "nothing to see" here would
  //    leave the table silently unwatched, which is the failure mode being prevented.
  it('FAILS when a window has no anchor, rather than skipping the table', () => {
    const { clocks, problems } = discoverFrom([
      src('a.ts', `export const THING_STALE_AFTER_DAYS = 90\n`),
    ])
    expect(clocks).toEqual([])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/no dated anchor/)
  })

  // ── MUTATION: two candidate anchors. Guessing would silently pick one and date the
  //    table from a constant that may describe something else entirely.
  it('FAILS on an ambiguous anchor rather than guessing', () => {
    const { clocks, problems } = discoverFrom([
      src(
        'a.ts',
        `const THING_LAST_VERIFIED = '2026-06-28'\nconst THING_RECHECKED_ON = '2026-08-01'\nconst THING_STALE_AFTER_DAYS = 90\n`,
      ),
    ])
    expect(clocks).toEqual([])
    expect(problems[0]).toMatch(/ambiguous/)
  })

  it('reads a STALENESS-ACK comment above the anchor', () => {
    const { clocks } = discoverFrom([
      src(
        'a.ts',
        `// STALENESS-ACK: 2026-09-20 — held out of rollout, no reader sees the notice.\nexport const THING_LAST_VERIFIED = '2026-06-28'\nexport const THING_STALE_AFTER_DAYS = 90\n`,
      ),
    ])
    expect(clocks[0].ack).toEqual({
      date: '2026-09-20',
      note: 'held out of rollout, no reader sees the notice.',
    })
  })

  // ── MUTATION: an ack far above the anchor, past the lookback, must NOT be picked up,
  //    or an unrelated comment elsewhere in a long file could silence a real clock.
  it('does not attach an ack that is nowhere near the anchor', () => {
    const { clocks } = discoverFrom([
      src(
        'a.ts',
        `// STALENESS-ACK: 2026-09-20 — about something else entirely.\n${'// filler\n'.repeat(200)}export const THING_LAST_VERIFIED = '2026-06-28'\nexport const THING_STALE_AFTER_DAYS = 90\n`,
      ),
    ])
    expect(clocks[0].ack).toBeNull()
  })
})

// ─── firing boundary ─────────────────────────────────────────────────────────

describe('firing boundary', () => {
  it('fires on anchor + window + 1, because the modules compare with strict >', () => {
    const c = clock({ anchorDate: '2026-06-28', windowDays: 90 })
    expect(new Date(firstStaleDay(c)).toISOString().slice(0, 10)).toBe('2026-09-27')
  })

  it('treats the window’s last day as still fresh', () => {
    const c = clock({ anchorDate: '2026-06-28', windowDays: 90 })
    // 2026-09-26 is age 90, and 90 > 90 is false.
    expect(evaluate([c], utc('2026-09-26'))[0].status).not.toBe('stale')
    expect(evaluate([c], utc('2026-09-27'))[0].status).toBe('stale')
  })

  it('counts calendar days, so the figure matches the date beside it', () => {
    const c = clock({ anchorDate: '2026-06-28', windowDays: 90 })
    // Late in the day on the 20th must still report 7, not 6.
    expect(evaluate([c], utc('2026-09-20') + 23 * 3_600_000)[0].days).toBe(7)
  })

  it('classifies ok / imminent / stale across the horizon', () => {
    const c = clock({ anchorDate: '2026-06-28', windowDays: 90 })
    expect(evaluate([c], utc('2026-08-01'))[0].status).toBe('ok')
    expect(evaluate([c], utc('2026-09-20'))[0].status).toBe('imminent')
    expect(evaluate([c], utc('2026-10-20'))[0].status).toBe('stale')
  })
})

// ─── acknowledgement validity ────────────────────────────────────────────────

describe('acknowledgement', () => {
  it('accepts an ack dated on or after the anchor', () => {
    const c = clock({ anchorDate: '2026-06-28', ack: { date: '2026-06-28', note: 'x' } })
    expect(evaluate([c], utc('2026-10-20'))[0].ackValid).toBe(true)
  })

  // ── MUTATION: the inherited-ack hole. Without the date comparison, acknowledging a
  //    table once would silence it forever, including across a later re-compile.
  it('REJECTS an ack predating the anchor, which was written about a previous table', () => {
    const c = clock({ anchorDate: '2026-06-28', ack: { date: '2026-01-05', note: 'x' } })
    expect(evaluate([c], utc('2026-10-20'))[0].ackValid).toBe(false)
  })
})

// ─── the real tree ───────────────────────────────────────────────────────────

describe('the repository itself', () => {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === '__tests__' || e.name === 'node_modules') continue
        walk(full, out)
      } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) out.push(full)
    }
    return out
  }

  const sources = walk(join(frontend, 'src')).map((f) =>
    src(relative(frontend, f).replace(/\\/g, '/'), readFileSync(f, 'utf8')),
  )

  /**
   * The drift-proof invariant. Asserting a fixed count would need editing every time a
   * table is added or retired, which trains people to edit the test instead of reading
   * it. What must never happen is a window being SILENTLY DROPPED — so every file that
   * declares one has to come back as either a clock or a reported problem.
   */
  it('accounts for every *_STALE_AFTER_DAYS window in the tree', () => {
    const declaring = sources.filter((s) => /_STALE_AFTER_DAYS\s*=/.test(s.text)).map((s) => s.rel)
    expect(declaring.length).toBeGreaterThan(0) // anti-vacuity: the convention still exists

    const { clocks, problems } = discoverFrom(sources)
    const accounted = new Set([...clocks.map((c) => c.file), ...problems.map((p) => p.split(':')[0])])

    for (const rel of declaring) expect(accounted.has(rel)).toBe(true)
  })

  it('resolves every real clock unambiguously', () => {
    const { problems } = discoverFrom(sources)
    expect(problems).toEqual([])
  })
})
