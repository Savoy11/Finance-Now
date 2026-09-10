import { describe, it, expect } from 'vitest'
import {
  GAP_REASONS,
  GAP_REASON_IDS,
  gapReason,
  isActionable,
  type GapFixability,
} from '../dataGaps'

/**
 * The registry's value is that a gap can be TRIAGED, so the tests are mostly
 * about the difference between reasons rather than their wording: a reason whose
 * fixability is wrong sends someone after work that does not exist, or buries
 * work that does.
 */

const ACTIONABLE: GapFixability[] = ['add-a-key', 'needs-work']
const INERT: GapFixability[] = ['no-source', 'by-design', 'transient']

describe('GAP_REASONS', () => {
  it('keys every entry by its own id', () => {
    // A mismatch here silently makes gapReason() return a reason describing
    // something else, which is worse than returning nothing.
    for (const id of GAP_REASON_IDS) expect(GAP_REASONS[id].id).toBe(id)
  })

  it('gives every reason a chip, a label and a why', () => {
    for (const id of GAP_REASON_IDS) {
      const r = GAP_REASONS[id]
      expect(r.chip.length, `${id} chip`).toBeGreaterThan(0)
      expect(r.chip.length, `${id} chip is too long for a table cell`).toBeLessThanOrEqual(5)
      expect(r.label.length, `${id} label`).toBeGreaterThan(0)
      // The `why` is the whole point of the component. A one-word why would pass
      // a non-empty check and still explain nothing.
      expect(r.why.length, `${id} why is too short to explain anything`).toBeGreaterThan(60)
    }
  })

  it('names a fix for everything that HAS one, and stays silent where none exists', () => {
    for (const id of GAP_REASON_IDS) {
      const r = GAP_REASONS[id]
      if (ACTIONABLE.includes(r.fixability)) {
        // Actionable without a stated fix is the dead end LiveUnavailable's
        // showIntegrationsLink note describes: helpful copy, nothing to do.
        expect(r.fix, `${id} is actionable but names no fix`).toBeTruthy()
      }
    }
    // `no-source` must never promise a fix — that is what makes it different from
    // `needs-work`, and the reason a permanent limitation stops being re-opened.
    expect(GAP_REASONS['no-upstream'].fix).toBeUndefined()
    expect(GAP_REASONS['terms-prohibited'].fix).toBeUndefined()
    expect(GAP_REASONS['geo-blocked'].fix).toBeUndefined()
    expect(GAP_REASONS['not-filed'].fix).toBeUndefined()
  })

  it('uses only the four documented fixability values', () => {
    const allowed = new Set<GapFixability>([...ACTIONABLE, ...INERT])
    for (const id of GAP_REASON_IDS) {
      expect(allowed.has(GAP_REASONS[id].fixability), `${id}`).toBe(true)
    }
  })
})

describe('isActionable', () => {
  it('flags a missing key and real work, and nothing else', () => {
    expect(isActionable('needs-api-key')).toBe(true)
    expect(isActionable('upstream-failed')).toBe(true)
    expect(isActionable('paid-plan-only')).toBe(true)
    expect(isActionable('robots-gated')).toBe(true)
  })

  it('does NOT flag a settled limitation', () => {
    // Flagging these is how a permanent limitation gets re-investigated every
    // quarter, and how the marker that matters gets ignored.
    expect(isActionable('no-upstream')).toBe(false)
    expect(isActionable('terms-prohibited')).toBe(false)
    expect(isActionable('geo-blocked')).toBe(false)
    expect(isActionable('not-filed')).toBe(false)
  })

  it('does NOT flag something deliberate or self-resolving', () => {
    expect(isActionable('derived-estimate')).toBe(false)
    expect(isActionable('curated-estimate')).toBe(false)
    // A rate limit fixes itself on the next refresh. It still explains itself
    // when asked; it just never becomes a task.
    expect(isActionable('rate-limited')).toBe(false)
  })

  it('accepts a reason object as well as an id', () => {
    expect(isActionable(GAP_REASONS['upstream-failed'])).toBe(true)
    expect(isActionable(GAP_REASONS['no-upstream'])).toBe(false)
  })
})

describe('gapReason', () => {
  it('resolves a known id', () => {
    expect(gapReason('rate-limited')?.label).toBe('Source is rate-limiting us')
  })

  it('returns null for absent or unknown input rather than a stand-in', () => {
    // A marker that opens to say nothing reads as "explained" while explaining
    // nothing — the exact failure this registry exists to fix. So an unknown id
    // must be falsy, letting the component render no marker at all.
    expect(gapReason(undefined)).toBeNull()
    expect(gapReason(null)).toBeNull()
    expect(gapReason('')).toBeNull()
    expect(gapReason('not-a-real-reason')).toBeNull()
  })
})

describe('the transient category exists for a reason', () => {
  it('is neither a fault nor a permanent limitation', () => {
    // The owner's 2026-09-10 call on the CoinGecko cap: stop trying to pin the
    // allowance down (the API states no number) and explain the refusal instead.
    // That needs its own category — `needs-work` sends someone after a bug that
    // is not there, and `no-source` claims a figure is unobtainable when it
    // arrived a minute ago.
    const r = GAP_REASONS['rate-limited']
    expect(r.fixability).toBe('transient')
    expect(isActionable(r)).toBe(false)
    expect(r.fix, 'a transient gap should still say what happens next').toBeTruthy()
  })
})
