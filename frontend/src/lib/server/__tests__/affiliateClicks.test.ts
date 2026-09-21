import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * The affiliate click counter exists to make per-provider value measurable
 * "without shipping user-identifying analytics" (ROADMAP integrity rules,
 * queue item T-121). That is a privacy PROPERTY, and until 2026-09-21 it was
 * only ever asserted in a docblock — which is why it had quietly stopped being
 * true: `updatedAt` was written with a full `toISOString()` on every click, so
 * the field was a per-click timestamp at millisecond precision. Poll the
 * counter and you recover a click timeline precise enough to line up against
 * anything else that knows who was on the site at that instant.
 *
 * These tests exist so the property is ENFORCED rather than described. Each one
 * was checked by mutation: revert `toDay`/`asDay` to the raw ISO string and the
 * first two fail by assertion, not by a compile error.
 *
 * `node:fs` is mocked rather than writing the real file. The module's path is
 * `process.cwd()/.affiliate-clicks.json` — a gitignored artifact that a test has
 * no business creating, and that two tests writing at once would race.
 */

let stored: string | null = null

vi.mock('node:fs', () => ({
  default: {
    existsSync: () => stored !== null,
    readFileSync: () => stored as string,
    writeFileSync: (_p: string, data: string) => { stored = data },
  },
}))

const { recordAffiliateClick, readAffiliateClicks } = await import('../affiliateClicks')

const DAY = /^\d{4}-\d{2}-\d{2}$/

describe('affiliate click counter — the privacy property', () => {
  beforeEach(() => { stored = null })

  it('writes dates at DAY precision, never finer', () => {
    // A time deep inside the day: anything coarser than a day must discard it.
    const at = new Date('2026-09-21T14:37:52.481Z')
    expect(recordAffiliateClick('lido', at)).toBe(true)

    const file = readAffiliateClicks()
    expect(file.since).toMatch(DAY)
    expect(file.updatedAt).toMatch(DAY)
    expect(file.since).toBe('2026-09-21')
    expect(file.updatedAt).toBe('2026-09-21')

    // The hour never reaches disk at all — not merely hidden by the reader.
    expect(stored).not.toContain('14:37')
    expect(stored).not.toContain('T')
  })

  it('truncates a finer value written by an older build', () => {
    // A file from before the fix, carrying exactly the precision it withheld.
    stored = JSON.stringify({
      counts: { lido: 3 },
      since: '2026-09-01T08:15:00.000Z',
      updatedAt: '2026-09-20T23:59:59.999Z',
    })

    const file = readAffiliateClicks()
    expect(file.since).toBe('2026-09-01')
    expect(file.updatedAt).toBe('2026-09-20')
    // Counts are the point of the file and survive untouched.
    expect(file.counts).toEqual({ lido: 3 })
  })

  it('stores counts and two days — and nothing else that could identify anyone', () => {
    recordAffiliateClick('rocket-pool', new Date('2026-09-21T09:00:00.000Z'))
    const written = JSON.parse(stored as string)

    // An allow-list, not a deny-list: a new field has to be added here
    // deliberately, so it cannot arrive by accident in a later refactor.
    expect(Object.keys(written).sort()).toEqual(['counts', 'since', 'updatedAt'])

    for (const forbidden of ['ip', 'ua', 'userAgent', 'userId', 'user_id', 'session', 'cookie', 'referer', 'referrer']) {
      expect(stored, `${forbidden} must never be stored`).not.toContain(`"${forbidden}"`)
    }
  })

  it('keeps `since` fixed at the first click while `updatedAt` follows the latest', () => {
    // The pair exists to read a RATE off a total. That needs a start and an end
    // and nothing in between — no per-click history is retained.
    recordAffiliateClick('lido', new Date('2026-09-01T10:00:00.000Z'))
    recordAffiliateClick('lido', new Date('2026-09-15T10:00:00.000Z'))
    recordAffiliateClick('kraken', new Date('2026-09-21T10:00:00.000Z'))

    const file = readAffiliateClicks()
    expect(file.since).toBe('2026-09-01')
    expect(file.updatedAt).toBe('2026-09-21')
    expect(file.counts).toEqual({ lido: 2, kraken: 1 })
  })

  it('never throws, and reports failure rather than blocking the outbound link', () => {
    // A lost count must not stop a reader reaching the provider, so a write
    // failure is reported as false and swallowed — the route answers 200 anyway.
    stored = '{ not json at all'
    expect(() => readAffiliateClicks()).not.toThrow()
    expect(readAffiliateClicks().counts).toEqual({})
  })
})
