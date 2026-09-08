import { describe, expect, it } from 'vitest'
import { confluenceLabel, CONFLUENCE_MIN_LOADED } from '../confluence'

describe('confluenceLabel — proportional thresholds', () => {
  it('returns null below the minimum number of loaded timeframes', () => {
    expect(confluenceLabel(0, 0, 0)).toBeNull()
    expect(confluenceLabel(CONFLUENCE_MIN_LOADED - 1, 2, 0)).toBeNull()
  })

  it('calls a unanimous 3/3 strong — the case absolute counts could never reach', () => {
    const out = confluenceLabel(3, 3, 0)
    expect(out?.band).toBe('strong')
    expect(out?.text).toContain('3/3 timeframes bullish')
  })

  it('ranks a unanimous 3/3 at least as strong as 4/6', () => {
    expect(confluenceLabel(3, 3, 0)?.band).toBe('strong')
    expect(confluenceLabel(6, 4, 0)?.band).toBe('moderate') // 67% — the old code called this strong
  })

  it('bands by share of the timeframes that answered', () => {
    expect(confluenceLabel(4, 3, 0)?.band).toBe('strong')    // 75%
    expect(confluenceLabel(5, 3, 0)?.band).toBe('moderate')  // 60%
    expect(confluenceLabel(5, 2, 0)?.band).toBe('mixed')     // 40%
  })

  it('reads the bearish side on the same thresholds', () => {
    expect(confluenceLabel(4, 0, 4)?.band).toBe('strong')
    expect(confluenceLabel(4, 0, 4)?.text).toContain('bearish')
    expect(confluenceLabel(5, 0, 3)?.band).toBe('moderate')
  })

  it('reports mixed when neither side reaches the moderate share', () => {
    const out = confluenceLabel(5, 2, 2)
    expect(out?.band).toBe('mixed')
    expect(out?.text).toContain('Mixed signals')
  })

  it('prefers the bullish reading when both sides somehow qualify', () => {
    // Not reachable from real inputs (a timeframe is bullish or bearish, not
    // both), but the ordering should be deterministic rather than accidental.
    expect(confluenceLabel(4, 4, 4)?.text).toContain('bullish')
  })
})
