import { describe, expect, it } from 'vitest'
import { describeOhlcvFailure, groupOhlcvFailures } from '../ohlcvFailures'

describe('describeOhlcvFailure', () => {
  it('puts a known status in words and keeps the number', () => {
    expect(describeOhlcvFailure('tiingo: Tiingo 429')).toBe('Tiingo: request limit reached (429)')
    expect(describeOhlcvFailure('fmp: FMP 402')).toBe('FMP: not on this plan (402)')
    expect(describeOhlcvFailure('fmp: FMP 404')).toBe('FMP: symbol not found (404)')
  })

  it('names an unknown status as HTTP, without guessing what it means', () => {
    expect(describeOhlcvFailure('tiingo: Tiingo 500')).toBe('Tiingo: HTTP 500')
  })

  it('keeps any other message, without the provider id in front', () => {
    expect(describeOhlcvFailure('tiingo: Tiingo: empty result')).toBe('Tiingo: empty result')
    expect(describeOhlcvFailure('fmp: The operation was aborted due to timeout')).toBe('The operation was aborted due to timeout')
  })
})

describe('groupOhlcvFailures', () => {
  it('groups rows by the reasons they share, most common first', () => {
    const quota = ['tiingo: Tiingo 429', 'fmp: FMP 402']
    const groups = groupOhlcvFailures([
      { failures: quota }, { failures: quota }, { failures: ['tiingo: Tiingo 404', 'fmp: FMP 404'] }, { failures: quota },
    ])
    expect(groups).toEqual([
      { reason: 'Tiingo: request limit reached (429); FMP: not on this plan (402)', count: 3 },
      { reason: 'Tiingo: symbol not found (404); FMP: symbol not found (404)', count: 1 },
    ])
  })

  it('counts a row with no reasons as "no reason given", never as another row\'s reason', () => {
    const groups = groupOhlcvFailures([{ failures: ['tiingo: Tiingo 429'] }, {}, { failures: [] }])
    expect(groups).toEqual([
      { reason: 'no reason given', count: 2 },
      { reason: 'Tiingo: request limit reached (429)', count: 1 },
    ])
  })

  it('adds up to the number of rows', () => {
    const rows = [{ failures: ['a: A 429'] }, { failures: ['b: B 402'] }, {}]
    expect(groupOhlcvFailures(rows).reduce((s, g) => s + g.count, 0)).toBe(rows.length)
  })
})
