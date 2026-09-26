import { describe, it, expect } from 'vitest'
import { selectQuarters, mergeFirstHit } from '../../../../scripts/lib/rrQuarters.mjs'

/**
 * T-411 (2026-09-26). A fund appears in the SEC Risk/Return dataset only in the
 * quarter it filed, so a reconcile that reads the newest archive alone is green and
 * stale at once — six Select Sector SPDRs sat at 0.09 for months while 0.08 was in
 * the 2026q1 archive. These pin the two rules that fix it: read the newest N quarters,
 * and let the newest quarter carrying a fund win.
 */
const links = [
  { key: '2025q4', href: '/files/2025q4_rr1.zip' },
  { key: '2026q2', href: '/files/2026q2_rr1.zip' },
  { key: '2026q1', href: '/files/2026q1_rr1.zip' },
  { key: '2025q3', href: '/files/2025q3_rr1.zip' },
  { key: '2025q2', href: '/files/2025q2_rr1.zip' },
  { key: '2026q2', href: '/files/2026q2_rr1.zip' }, // a duplicate link on the index page
]

describe('selectQuarters', () => {
  it('reads the newest four by default, newest first, regardless of page order', () => {
    expect(selectQuarters(links).map((l) => l.key)).toEqual(['2026q2', '2026q1', '2025q4', '2025q3'])
  })

  it('honours a limit and never returns a duplicate quarter', () => {
    expect(selectQuarters(links, { limit: 2 }).map((l) => l.key)).toEqual(['2026q2', '2026q1'])
    expect(selectQuarters(links, { limit: 99 }).map((l) => l.key)).toEqual(['2026q2', '2026q1', '2025q4', '2025q3', '2025q2'])
  })

  it('a pin reads exactly that quarter', () => {
    expect(selectQuarters(links, { pinned: '2025Q4' }).map((l) => l.key)).toEqual(['2025q4'])
  })

  it('a pin that is not published fails loudly and names what is', () => {
    expect(() => selectQuarters(links, { pinned: '2024q1' })).toThrow(/RR_QUARTER=2024q1 is not published\. Available: 2026q2, 2026q1/)
  })

  it('refuses an empty index and a nonsense limit rather than reading nothing quietly', () => {
    expect(() => selectQuarters([])).toThrow(/no RR dataset links/)
    expect(() => selectQuarters(links, { limit: 0 })).toThrow(/limit must be a positive integer/)
    expect(() => selectQuarters(links, { limit: Number.NaN })).toThrow(/limit must be a positive integer/)
  })

  it('ignores links whose key is not a quarter', () => {
    expect(selectQuarters([...links, { key: 'readme', href: '/x' }]).map((l) => l.key)).toEqual(['2026q2', '2026q1', '2025q4', '2025q3'])
  })
})

describe('mergeFirstHit', () => {
  const q = (key: string, entries: Record<string, unknown>) => ({ key, hits: new Map(Object.entries(entries)) })

  it('the newest quarter carrying a ticker wins, and the quarter is recorded', () => {
    const merged = mergeFirstHit([
      q('2026q2', { VCSH: { adsh: 'new' } }),
      q('2025q4', { VCSH: { adsh: 'old' }, BKLN: { adsh: 'bkln' } }),
    ])
    expect(merged.get('VCSH')).toEqual({ adsh: 'new', quarter: '2026q2' })
    expect(merged.get('BKLN')).toEqual({ adsh: 'bkln', quarter: '2025q4' })
  })

  it('a ticker missing from the newest quarter is still found in the one it filed in — the T-411 case', () => {
    const merged = mergeFirstHit([
      q('2026q2', {}),
      q('2026q1', { XLK: { raw: { netExpenseRatio: 0.0008 } } }),
    ])
    expect(merged.get('XLK')?.quarter).toBe('2026q1')
    expect(merged.size).toBe(1)
  })

  it('is empty when nothing matched anywhere, never a fabricated hit', () => {
    expect(mergeFirstHit([q('2026q2', {}), q('2026q1', {})]).size).toBe(0)
  })
})
