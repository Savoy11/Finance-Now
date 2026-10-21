import { describe, it, expect } from 'vitest'
import { buildReviewPage, parseSuggestions, reviewCounts, SUGGESTIONS_FORMAT, type ReviewFund, type ReviewPage, type ReviewSuggestion } from '../../../../scripts/lib/fundFiguresReview'

/**
 * The page that lays the pre-fill's suggestions out for the owner (D140 step 2). It holds
 * what the owner needs beside each figure (its kind, date, the catalog's figure and the
 * passage it came from), puts every figure not suggested under "read by hand" with its
 * reason, and never lets text copied from a fund page run as markup.
 */
const fig = (over: Partial<ReviewSuggestion>): ReviewSuggestion => ({
  id: 'VOO:yield', figure: 'yield', status: 'suggested', shown: '1.00%', value: 1, asOf: '2026-10-19', kind: 'sec',
  label: 'dashboard.secYield', quote: 'dashboard.secYield: 1.00%', dateQuote: 'dashboard.secYieldAsOfDate: 10/19/2026', others: '', why: '', ...over,
})
const page = (over: Partial<ReviewPage>): ReviewPage => ({
  symbol: 'VOO', url: 'https://investor.vanguard.com/voo', finalUrl: null, readAt: '2026-10-21T00:00:00Z', outcome: 'read', why: '', figures: [fig({})], ...over,
})
const funds = new Map<string, ReviewFund>([
  ['VOO', { name: 'Vanguard S&P 500 ETF', issuer: 'Vanguard', catalog: { 'VOO:yield': 1.3 } }],
  ['VT', { name: 'Vanguard Total World Stock ETF', issuer: 'Vanguard', catalog: { 'VT:yield': 1.9 } }],
])
const kindLabel = (_f: string, k: string) => (k === 'sec' ? '30-day SEC yield' : k)
const build = (pages: ReviewPage[]) => buildReviewPage({ savedAt: '2026-10-21T18:00:00Z', pages, funds, kindLabel })
const section = (html: string, heading: string) => html.split('<h2>').find((s) => s.startsWith(heading)) ?? ''

describe('fund figures review page', () => {
  it('shows a suggestion with its kind, date, the catalog figure and its passage', () => {
    const html = section(build([page({})]), 'To compare')
    expect(html).toContain('1.00%')
    expect(html).toContain('30-day SEC yield')
    expect(html).toContain('2026-10-19')
    expect(html).toContain('1.3%')
    expect(html).toContain('dashboard.secYield: 1.00%')
    expect(html).toContain('href="https://investor.vanguard.com/voo"')
  })

  it('puts a figure not suggested under read by hand, with its reason', () => {
    const html = build([page({ symbol: 'VT', figures: [fig({ id: 'VT:yield', status: 'not-found', shown: '', why: 'The page shows no fund yield.' })] })])
    expect(section(html, 'To compare')).not.toContain('VT')
    const hand = section(html, 'To read by hand')
    expect(hand).toContain('VT')
    expect(hand).toContain('The page shows no fund yield.')
    expect(hand).toContain('1.9%')
  })

  it('lists a page that was not read under read by hand', () => {
    const hand = section(build([page({ outcome: 'error', why: 'Could not resolve host', figures: [] })]), 'To read by hand')
    expect(hand).toContain('Could not resolve host')
  })

  it('never lets copied text run as markup, nor links anything but a web address', () => {
    const html = build([page({ url: 'javascript:alert(1)', figures: [fig({ quote: '<script>alert(1)</script>', others: '<img src=x onerror=alert(1)>' })] })])
    expect(html).not.toContain('<script>alert')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('href="javascript:')
  })

  it('counts and refuses a file it did not write', () => {
    expect(reviewCounts([page({}), page({ symbol: 'VT', figures: [fig({ status: 'not-found' })] })])).toEqual({ pages: 2, read: 2, suggested: 1, byHand: 1 })
    expect(() => parseSuggestions({ format: 'something-else', pages: [] })).toThrow(/not a suggestions file/)
    expect(parseSuggestions({ format: SUGGESTIONS_FORMAT, savedAt: 'x', pages: [] }).pages).toEqual([])
  })
})
