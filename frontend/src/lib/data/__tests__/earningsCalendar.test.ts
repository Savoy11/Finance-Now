import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  EARNINGS_SOON_DAYS, cleanSymbols, daysUntil, earningsTimeLabel, isEarningsSoon, marketToday, mergeEarnings,
  nextEarningsBySymbol, parseAlphaVantageEarnings, parseFmpEarnings, type UpcomingEarnings,
} from '../earningsCalendar'
import { fitRow, splitCsvLine } from '../alphaVantageCsv'

// T-458 (D213). The two bodies below are Alpha Vantage's EARNINGS_CALENDAR answers exactly as the
// owner's Alpha Vantage connection returned them on 2026-11-08 (symbol=NVDA and symbol=IBM,
// horizon=3month): copied, not composed.
const NVDA_BODY = 'symbol,name,reportDate,fiscalDateEnding,estimate,currency,timeOfTheDay\r\nNVDA,NVIDIA CORPORATION,2026-11-17,2026-10-31,2.49,USD,post-market\r\n'
const IBM_BODY = 'symbol,name,reportDate,fiscalDateEnding,estimate,currency,timeOfTheDay\r\n'
const HEADER = 'symbol,name,reportDate,fiscalDateEnding,estimate,currency,timeOfTheDay'

const ev = (symbol: string, date: string, source: UpcomingEarnings['source'] = 'fmp'): UpcomingEarnings =>
  ({ symbol, name: symbol, date, fiscalPeriodEnd: null, time: null, epsEstimate: null, source })

describe('parseAlphaVantageEarnings', () => {
  it('reads the real feed', () => {
    const r = parseAlphaVantageEarnings(NVDA_BODY)
    expect(r).toEqual({ ok: true, events: [{
      symbol: 'NVDA', name: 'NVIDIA CORPORATION', date: '2026-11-17', fiscalPeriodEnd: '2026-10-31',
      time: 'post-market', epsEstimate: 2.49, source: 'alpha-vantage',
    }] })
  })

  it('reads a company with no date listed as no rows, not as a failure', () => {
    expect(parseAlphaVantageEarnings(IBM_BODY)).toEqual({ ok: true, events: [] })
  })

  it('keeps a name with a comma in it whole, quoted or not, and reads the later columns from the right places', () => {
    const quoted = parseAlphaVantageEarnings(`${HEADER}\nACME,"Acme, Inc.",2026-12-01,2026-10-31,,USD,pre-market\n`)
    const bare = parseAlphaVantageEarnings(`${HEADER}\nACME,Acme, Inc.,2026-12-01,2026-10-31,,USD,pre-market\n`)
    for (const r of [quoted, bare]) {
      if (!r.ok) throw new Error('expected ok')
      expect(r.events[0]).toMatchObject({ name: 'Acme, Inc.', date: '2026-12-01', time: 'pre-market', epsEstimate: null })
    }
  })

  it('skips a row with no symbol or no real date, and never invents one', () => {
    const r = parseAlphaVantageEarnings(`${HEADER}\n,Nameless,2026-12-01,,,USD,\nBAD,Bad Date,soon,,,USD,\nGOOD,Good Co,2026-12-02,,,USD,\n`)
    if (!r.ok) throw new Error('expected ok')
    expect(r.events.map((e) => e.symbol)).toEqual(['GOOD'])
    expect(r.events[0].time).toBeNull()
  })

  it('reports the throttle note as rate-limited, never as an empty calendar', () => {
    const r = parseAlphaVantageEarnings(JSON.stringify({ Information: 'Our standard API rate limit is 25 requests per day.' }))
    expect(r).toMatchObject({ ok: false, reason: 'rate-limited' })
  })

  it('fails loudly when a needed column is renamed', () => {
    const r = parseAlphaVantageEarnings('symbol,name,date\nNVDA,NVIDIA,2026-11-17\n')
    expect(r).toMatchObject({ ok: false, reason: 'unparseable' })
    if (!r.ok) expect(r.detail).toMatch(/reportDate/)
  })
})

describe('the shared CSV reader', () => {
  it('honours quotes and doubled quotes', () => {
    expect(splitCsvLine('A,"B, C","say ""hi""", D ')).toEqual(['A', 'B, C', 'say "hi"', 'D'])
  })
  it('joins a free-text column’s surplus back together', () => {
    expect(fitRow(['X', 'Jones Energy', 'Inc.', '2026-09-03'], 3, 1)).toEqual(['X', 'Jones Energy, Inc.', '2026-09-03'])
    expect(fitRow(['X', 'Y', 'Z'], 3, 1)).toEqual(['X', 'Y', 'Z'])
  })
})

describe('parseFmpEarnings', () => {
  it('reads dated rows and skips the rest', () => {
    expect(parseFmpEarnings([
      { symbol: 'aapl', date: '2027-01-29', epsEstimated: 2.6 },
      { symbol: 'MSFT', date: 'later' },
      { date: '2027-01-29' },
    ])).toEqual([{ symbol: 'AAPL', name: 'AAPL', date: '2027-01-29', fiscalPeriodEnd: null, time: null, epsEstimate: 2.6, source: 'fmp' }])
    expect(parseFmpEarnings({ error: 'nope' })).toEqual([])
  })
})

describe('mergeEarnings', () => {
  it('keeps FMP’s dates for a company FMP lists, and takes Alpha Vantage’s only for the others', () => {
    const merged = mergeEarnings(
      [ev('NVDA', '2026-11-19')],
      [ev('NVDA', '2026-11-17', 'alpha-vantage'), ev('WMT', '2026-11-18', 'alpha-vantage')],
    )
    expect(merged.map((e) => [e.symbol, e.date, e.source])).toEqual([
      ['WMT', '2026-11-18', 'alpha-vantage'],
      ['NVDA', '2026-11-19', 'fmp'],
    ])
  })
  it('falls back to Alpha Vantage entirely when FMP gives nothing', () => {
    expect(mergeEarnings([], [ev('NVDA', '2026-11-17', 'alpha-vantage')]).map((e) => e.source)).toEqual(['alpha-vantage'])
  })
})

describe('the next date, and what counts as soon', () => {
  it('takes each company’s first report on or after today', () => {
    const next = nextEarningsBySymbol([ev('A', '2026-11-01'), ev('A', '2027-02-01'), ev('A', '2026-11-20'), ev('B', '2026-11-08')], '2026-11-08')
    expect(next.get('A')?.date).toBe('2026-11-20')
    expect(next.get('B')?.date).toBe('2026-11-08')
  })

  it(`marks a report from today through ${EARNINGS_SOON_DAYS} days ahead`, () => {
    const today = '2026-11-08'
    expect(isEarningsSoon({ date: '2026-11-08' }, today)).toBe(true)
    expect(isEarningsSoon({ date: '2026-11-22' }, today)).toBe(true)
    expect(isEarningsSoon({ date: '2026-11-23' }, today)).toBe(false)
    expect(isEarningsSoon({ date: '2026-11-07' }, today)).toBe(false)
    expect(daysUntil('2026-11-17', today)).toBe(9)
  })

  it('counts today in New York, where the market is, not in UTC', () => {
    // 9 pm Eastern on Nov 8 is already Nov 9 in UTC: a company reporting that evening is still "today".
    expect(marketToday(new Date('2026-11-09T02:00:00Z'))).toBe('2026-11-08')
    expect(marketToday(new Date('2026-11-09T06:00:00Z'))).toBe('2026-11-09')
  })

  it('says when in the day, and only when the source says', () => {
    expect(earningsTimeLabel('pre-market')).toBe('before the market opens')
    expect(earningsTimeLabel('post-market')).toBe('after the market closes')
    expect(earningsTimeLabel(null)).toBeNull()
  })

  it('accepts only ticker-shaped symbols, once each, up to a limit', () => {
    expect(cleanSymbols(' aapl,BRK-B,AAPL,<x>,,msft ', 10)).toEqual(['AAPL', 'BRK-B', 'MSFT'])
    expect(cleanSymbols('A,B,C', 2)).toEqual(['A', 'B'])
  })
})

// ── The collector: FMP first, Alpha Vantage behind it ──────────────────────────────────────────

const keys: Record<string, string | undefined> = {}
vi.mock('@/lib/api/live/providers', () => ({ getProviderKey: (id: string) => keys[id] }))

describe('upcomingEarnings (lib/server/earningsCalendar.ts)', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
  const text = (body: string, status = 200) => new Response(body, { status })
  let calls: string[] = []
  const stub = (fmp: () => Response, av: () => Response) => vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(String(url))
    return String(url).includes('financialmodelingprep') ? fmp() : av()
  }))
  let now = Date.parse('2026-11-08T15:00:00Z')

  beforeEach(() => { calls = []; keys.fmp = 'f'; keys['alpha-vantage'] = 'a'; now += 3_600_000 })
  afterEach(() => { vi.unstubAllGlobals() })

  it('fills in from Alpha Vantage what FMP does not list, inside the range asked', async () => {
    const { upcomingEarnings } = await import('@/lib/server/earningsCalendar')
    stub(() => json([{ symbol: 'NVDA', date: '2026-11-19' }]),
      () => text(`${HEADER}\nNVDA,NVIDIA,2026-11-17,,,USD,post-market\nWMT,Walmart,2026-11-18,,,USD,pre-market\nLATE,Late Co,2027-03-01,,,USD,\n`))
    const r = await upcomingEarnings('2026-11-08', '2026-12-08', now)
    expect(r.configured).toBe(true)
    expect(r.events.map((e) => [e.symbol, e.source])).toEqual([['WMT', 'alpha-vantage'], ['NVDA', 'fmp']])
    expect(r.sources['alpha-vantage']).toMatchObject({ ok: true, count: 2 })
  })

  it('keeps earnings when FMP fails, and says why FMP gave none', async () => {
    const { upcomingEarnings } = await import('@/lib/server/earningsCalendar')
    stub(() => json({ error: 'limit' }, 429), () => text(NVDA_BODY))
    const r = await upcomingEarnings('2026-11-08', '2026-12-08', now)
    expect(r.events.map((e) => e.symbol)).toEqual(['NVDA'])
    expect(r.sources.fmp).toMatchObject({ ok: false, detail: 'FMP HTTP 429' })
  })

  it('asks nobody without keys, and says it is not configured', async () => {
    const { upcomingEarnings } = await import('@/lib/server/earningsCalendar')
    keys.fmp = undefined; keys['alpha-vantage'] = undefined
    stub(() => json([]), () => text(IBM_BODY))
    const r = await upcomingEarnings('2026-11-08', '2026-12-08', now)
    expect(r).toMatchObject({ configured: false, events: [] })
    expect(calls).toEqual([])
  })

  it('asks Alpha Vantage at one address with no dates in it, cached a day, so it costs one request a day', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/server/earningsCalendar.ts'), 'utf8')
    const url = src.match(/https:\/\/www\.alphavantage\.co\/query\?[^`]*/)?.[0] ?? ''
    expect(url).toContain('function=EARNINGS_CALENDAR')
    expect(url).not.toMatch(/from|to=|date|symbol/)
    expect(src).toMatch(/ALPHA_VANTAGE_REVALIDATE_SECONDS = 86_400/)
  })
})
