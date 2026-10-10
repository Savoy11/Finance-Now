import { describe, expect, it } from 'vitest'
import * as copy from '../ratingCopy'
import { classRanges, curveRows, describeRaw, formatValue, wholePercent } from '../ratingFormat'
import { METHODOLOGY_V1 as M } from '../methodology/v1'
import { EQUITY_CATALOG } from '@/lib/data/equityCatalog'
import { SUITABILITY_WORDS } from './suitabilityWords'

/** Every string the copy module produces, its functions called with sample values. */
function allCopy(): string[] {
  const out: string[] = []
  for (const [name, v] of Object.entries(copy)) {
    if (name === 'NOT_ADVICE_LINE') continue // the one sentence that must say "not a recommendation"
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) out.push(...v)
    else if (typeof v === 'function') out.push(String((v as (...a: unknown[]) => unknown)(4, 5, 3)))
    else if (v && typeof v === 'object') out.push(...Object.values(v).filter((x): x is string => typeof x === 'string'))
  }
  return out
}

describe('the rating’s copy', () => {
  it('uses no suitability words, except to say it is not a recommendation', () => {
    const offenders = allCopy().filter((s) => SUITABILITY_WORDS.test(s))
    expect(offenders).toEqual([])
    expect(copy.NOT_ADVICE_LINE).toMatch(/not a recommendation to buy, sell or hold/)
  })

  it('nor do the methodology’s labels and descriptions', () => {
    const texts = [
      M.heading,
      ...M.classes.map((c) => c.label),
      ...[...M.crypto.dimensions, ...M.stock.dimensions].flatMap((d) => [d.label, d.description, d.window, d.source]),
    ]
    expect(texts.filter((s) => SUITABILITY_WORDS.test(s))).toEqual([])
  })

  it('guards the guard: the pattern catches each word', () => {
    for (const w of ['Conservative', 'aggressive', 'suitable', 'unsuitable for', 'safe', 'unsafe', 'safer', 'safety', 'recommended', 'not recommend']) {
      expect(SUITABILITY_WORDS.test(`a ${w} choice`), w).toBe(true)
    }
    expect(SUITABILITY_WORDS.test('the lowest class does not mean risk free')).toBe(false)
  })

  it('says the heading, the scale and the stability rule in the decided form (D95, §5)', () => {
    expect(copy.ratingHeading(4)).toBe(`Measured risk: Class 4 of ${M.classes.length}`)
    expect(copy.CLASS_COUNT).toBe(7)
    expect(copy.heldSentence(4, 5)).toBe('Class held at 4 by the stability rule; today’s score alone would be class 5.')
    expect(copy.RATING_DISCLOSURES[0]).toContain(`1 (lowest) to ${M.classes.length} (highest)`)
    expect(copy.RATING_DISCLOSURES).toContain('The lowest class does not mean risk free.')
  })

  it('reads every number from the methodology, so the copy follows a change there', () => {
    expect(copy.UNIVERSE.crypto).toContain(`${M.crypto.minHistoryDays} days`)
    expect(copy.UNIVERSE.stock).toContain(`${EQUITY_CATALOG.length} stocks`)
    expect(copy.UNIVERSE.stock).toContain(`${M.stock.minHistoryDays} trading days`)
    const steps = copy.HOW_IT_BECOMES_A_CLASS.join(' ')
    expect(steps).toContain(wholePercent(M.coverageFloor))
    expect(steps).toContain(`${M.stabilityWeeks} weeks`)
    expect(copy.recentVolatilitySentence('40%')).toContain(`${M.recentVolatilityDays} days`)
  })

  it('names everything the rating does not assess, in one sentence', () => {
    for (const item of copy.NOT_ASSESSED) expect(copy.NOT_ASSESSED_SENTENCE).toContain(item)
    expect(copy.NOT_ASSESSED_SENTENCE).toMatch(/, or future prices\.$/)
  })

  it('leaves the holdings policy to the owner (D95 parked it)', () => {
    expect(copy.HOLDINGS_POLICY).toBeNull()
  })
})

describe('how the numbers read', () => {
  it('formats percentages, dollar amounts and ratios to three figures', () => {
    expect(formatValue(0.45678, 'percent')).toBe('45.7%')
    expect(formatValue(0.0005, 'percent')).toBe('0.05%')
    expect(formatValue(1.2, 'percent')).toBe('120%')
    expect(formatValue(-0.3, 'percent')).toBe('−30%')
    expect(formatValue(1e7, 'usd')).toBe('$10M')
    expect(formatValue(5e8, 'usd')).toBe('$500M')
    expect(formatValue(1.2345e12, 'usd')).toBe('$1.23T')
    expect(formatValue(1.5432, 'ratio')).toBe('1.54×')
    expect(formatValue(Number.NaN, 'ratio')).toBe('—')
  })

  it('labels each raw figure the engine reports, and says when one is missing', () => {
    expect(describeRaw('volatility', 0.4)).toBe('Annualised volatility 40%')
    expect(describeRaw('medianDollarVolume', 2.5e9)).toBe('Median daily volume $2.5B')
    expect(describeRaw('debtToEquity', null)).toBe('Long-term debt ÷ equity not available')
  })

  it('lists every curve with its points in order', () => {
    const crypto = curveRows('crypto')
    expect(crypto.map((r) => r.key)).toEqual(Object.keys(M.crypto.curves))
    expect(crypto.find((r) => r.key === 'volatility')!.points[0]).toBe('30% → 90')
    expect(curveRows('stock').find((r) => r.key === 'debtToEquity')!.points[0]).toBe('0.25× → 92')
  })

  it('the class ranges cover 0–100 with no gap or overlap', () => {
    const ranges = classRanges()
    expect(ranges[0]).toMatchObject({ cls: 1, max: 100 })
    expect(ranges[ranges.length - 1]).toMatchObject({ min: 0 })
    for (let i = 1; i < ranges.length; i++) expect(ranges[i].max).toBe(ranges[i - 1].min - 1)
  })
})
