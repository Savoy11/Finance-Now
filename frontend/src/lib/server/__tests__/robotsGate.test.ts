import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  assertRobotsPermits, robotsPermits, RobotsDisallowedError, SOURCE_TERMS,
} from '../sourceTerms'

/**
 * Reddit's robots.txt disallows our agent — observed first-hand by
 * `npm run terms:report` on the owner's machine, 2026-08-29, while the app was
 * reading reddit.com/r/*.rss on two routes. This gate is the response.
 *
 * The distinction these tests defend: a robots disallow is an INSTRUCTION, not
 * an interpretation of terms. It is enforced structurally rather than checked
 * at each call site, because a per-site check is bypassed by the next call site
 * someone adds.
 */

describe('assertRobotsPermits', () => {
  const env = (v: Record<string, string>) => v as unknown as NodeJS.ProcessEnv
  const noEnv = env({})

  it('refuses a disallowed host with no credential', () => {
    expect(() => assertRobotsPermits('https://www.reddit.com/r/x/hot.rss', noEnv)).toThrow(RobotsDisallowedError)
    expect(robotsPermits('https://www.reddit.com/r/x/hot.rss', noEnv)).toBe(false)
  })

  it('covers subdomains, not just the registrable host', () => {
    // old.reddit.com and www.reddit.com are the same instruction.
    expect(robotsPermits('https://old.reddit.com/r/x.rss', noEnv)).toBe(false)
  })

  it('lifts the block when the named credential is configured', () => {
    // OAuth moves the request off the anonymous path robots forbids.
    expect(robotsPermits('https://www.reddit.com/r/x/hot.rss', env({ REDDIT_CLIENT_ID: 'abc' }))).toBe(true)
  })

  it('treats an empty or whitespace credential as absent', () => {
    expect(robotsPermits('https://www.reddit.com/', env({ REDDIT_CLIENT_ID: '   ' }))).toBe(false)
    expect(robotsPermits('https://www.reddit.com/', env({ REDDIT_CLIENT_ID: '' }))).toBe(false)
  })

  // ⚠ HOSTS ARE DERIVED, NOT NAMED, AND THIS TEST IS WHY. It used to list literal
  // hosts as examples of "not gated". Both hand-picked ones went stale inside a
  // month: feeds.content.dowjones.io became `prohibited` on 2026-09-20, and its
  // replacement — search.cnbc.com — acquired a `robotsDisallowed` entry the SAME DAY,
  // failing this test. Any host can become gated later, so naming one asserts a fact
  // about the registry's current contents while pretending to assert a property of
  // the gate. Deriving the sample keeps the claim — "the gate is opt-in, so a host
  // with no robots observation passes" — true by construction.
  it('permits every host with no robots observation — this gate is opt-in', () => {
    const ungated = SOURCE_TERMS.filter((e) => !e.robotsDisallowed).slice(0, 5)
    expect(ungated.length, 'no ungated entries found — the sample proves nothing').toBeGreaterThan(0)

    for (const entry of ungated) {
      const url = `https://${entry.domain}/`
      expect(robotsPermits(url, noEnv), `${entry.domain} has no robots observation and should not be gated`).toBe(true)
    }
  })

  it('gates every host that DOES carry a robots observation', () => {
    // The other direction. Without it, a gate that permitted everything would satisfy
    // the test above perfectly.
    const gated = SOURCE_TERMS.filter((e) => e.robotsDisallowed)
    expect(gated.length, 'no gated entries — this gate would be untested').toBeGreaterThan(0)

    for (const entry of gated) {
      // An entry whose block is lifted by a credential is permitted once that
      // credential is present, so only the credential-free case is asserted here.
      if (entry.robotsDisallowed?.liftedBy) continue
      expect(
        robotsPermits(`https://${entry.domain}/`, noEnv),
        `${entry.domain} carries robotsDisallowed and must be gated`,
      ).toBe(false)
    }
  })

  it('ignores unparseable input rather than throwing on it', () => {
    expect(robotsPermits('not a url', noEnv)).toBe(true)
  })

  it('carries the reason, so a caller can explain the absence', () => {
    try {
      assertRobotsPermits('https://www.reddit.com/', noEnv)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(RobotsDisallowedError)
      expect((e as RobotsDisallowedError).note).toContain('robots.txt disallows')
    }
  })
})

describe('the registry records the observation as first-hand', () => {
  it('Reddit carries a dated robots reading separate from its terms review', () => {
    const reddit = SOURCE_TERMS.find((e) => e.domain === 'reddit.com')!
    expect(reddit.robotsDisallowed?.observedAt).toBe('2026-08-29')
    expect(reddit.robotsDisallowed?.liftedBy).toBe('REDDIT_CLIENT_ID')
    // The invariant is that these are TWO facts with two dates: a robots
    // observation must never launder itself into a terms review, which is the
    // failure the `seeded` state exists for.
    //
    // This used to assert `review === 'seeded'`, which expressed that while the
    // Data API Terms happened to be unread. They were read on 2026-09-14
    // (docs/audits/terms-review-apis-2026-09-14.md) and ratified 2026-09-18, so
    // that assertion had become a stale snapshot rather than the invariant.
    // Dating them separately is the part that must keep holding.
    expect(reddit.reviewedAt).not.toBe(reddit.robotsDisallowed?.observedAt)
  })
})

describe('the gate is structural, not per-call-site', () => {
  const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')

  it('pinnedFetch enforces it, so a new call site inherits the block', () => {
    expect(read('src/lib/server/pinnedFetch.ts')).toContain('assertRobotsPermits')
  })

  it('both social routes gate their Reddit rung', () => {
    for (const f of ['src/app/live-data/social/route.ts', 'src/app/live-data/stock-social/route.ts']) {
      expect(read(f), `${f} fetches Reddit without the gate`).toContain('robotsPermits')
    }
  })
})
