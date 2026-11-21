import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCurveFile } from '../treasuryCurve'
import { LOOKBACK_YEARS, fetchSpreadHistory } from '../treasurySpreadHistory'
import { dailySpreads, invertedStretches } from '@/lib/data/curveSpreads'
import { GET } from '@/app/live-data/treasury-spread-history/route'

// T-464: the gaps' history from the Treasury's yearly curve files, and how far back the start of
// a stretch still below zero is looked for.

afterEach(() => { vi.unstubAllGlobals() })

describe('on the Treasury’s own files', () => {
  // An excerpt of the 2022 and 2024 files (public domain): the 2s10s gap went below zero on
  // 6 July 2022 and was last below zero, after two years, on 26 August 2024 (then two single
  // days in September). The two years between are not in the excerpt, so the runs break there.
  const xml = readFileSync(join(__dirname, 'fixtures/treasury-par-2022-2024-excerpt.xml'), 'utf8')
  const daily = dailySpreads(parseCurveFile(xml))

  it('dates the July 2022 turn below zero from the published curve', () => {
    const july = daily.filter((p) => p.date >= '2022-07-01' && p.date <= '2022-07-08')
    expect(july.find((p) => p.date === '2022-07-05')!.spread2s10s).toBeGreaterThanOrEqual(0)
    expect(july.find((p) => p.date === '2022-07-06')!.spread2s10s).toBeLessThan(0)
    const s = invertedStretches(daily, 'spread2s10s')
    expect(s[0]).toMatchObject({ start: '2022-07-06', startKnown: true, end: '2022-07-08', endKnown: false })
  })

  it('dates the August 2024 end, and the single days after it', () => {
    const s = invertedStretches(daily, 'spread2s10s')
    expect(s.slice(1).map((x) => [x.start, x.end, x.startKnown])).toEqual([
      ['2024-08-21', '2024-08-26', false],
      ['2024-09-03', '2024-09-03', true],
      ['2024-09-05', '2024-09-05', true],
    ])
  })
})

/** A par curve file entry, with the 13 maturities the parser needs. */
const entry = (date: string, y2: number, y10: number, m3 = 4) => {
  const f = { BC_1MONTH: 4, BC_2MONTH: 4, BC_3MONTH: m3, BC_4MONTH: 4, BC_6MONTH: 4, BC_1YEAR: 4, BC_2YEAR: y2, BC_3YEAR: 4, BC_5YEAR: 4, BC_7YEAR: 4, BC_10YEAR: y10, BC_20YEAR: 4.6, BC_30YEAR: 4.7 }
  return `<entry><content><m:properties><d:NEW_DATE m:type="Edm.DateTime">${date}T00:00:00</d:NEW_DATE>${
    Object.entries(f).map(([k, v]) => `<d:${k} m:type="Edm.Double">${v}</d:${k}>`).join('')}</m:properties></content></entry>`
}

/** One file per year: a reading every weekday, both gaps below zero from `invertedFrom` to `invertedUntil`. */
function yearFile(year: number, invertedFrom: string, until = `${year}-12-31`, invertedUntil = '9999-12-31') {
  const out: string[] = []
  for (let t = Date.UTC(year, 0, 1); t <= Date.parse(`${until}T00:00:00Z`) && t < Date.UTC(year + 1, 0, 1); t += 86_400_000) {
    const d = new Date(t)
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue
    const date = d.toISOString().slice(0, 10)
    // Both gaps below zero together (the 3-month above the 10-year as well), or both above.
    out.push(date >= invertedFrom && date <= invertedUntil ? entry(date, 4.5, 4.2, 4.6) : entry(date, 4.0, 4.4))
  }
  return `<feed>${out.join('')}</feed>`
}

function treasury(invertedFrom: string, opts: { failYears?: number[]; until: string; invertedUntil?: string }) {
  const asked: number[] = []
  const fetchFn = vi.fn(async (url: string | URL) => {
    const year = Number(/field_tdr_date_value=(\d{4})/.exec(String(url))![1])
    asked.push(year)
    if (opts.failYears?.includes(year)) return new Response('no', { status: 503 })
    return new Response(yearFile(year, invertedFrom, opts.until, opts.invertedUntil), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchFn)
  return asked
}

describe('fetchSpreadHistory', () => {
  const now = new Date('2026-06-15T12:00:00Z')

  it('reads earlier years until it finds when a stretch still below zero began', () => {
    // Mutation: drop the look-back and a one-month view says it began on 1 January 2026.
    const asked = treasury('2024-03-01', { until: '2026-06-12' })
    return fetchSpreadHistory('1mo', now).then((h) => {
      expect(h.now.spread2s10s).toMatchObject({ inverted: true, stretch: { start: '2024-03-01', startKnown: true, ongoing: true } })
      expect(asked).toEqual([2026, 2025, 2024])
      // The chart is the month; the stretch is the whole of it.
      expect(h.points[0].date >= '2026-05-15').toBe(true)
      expect(h.stretches.spread2s10s).toHaveLength(1)
      expect(h.interval).toBe('daily')
    })
  })

  it('stops looking ten years back, and says the start is not known', async () => {
    const asked = treasury('2000-01-01', { until: '2026-06-12' })
    const h = await fetchSpreadHistory('1mo', now)
    expect(Math.min(...asked)).toBe(now.getUTCFullYear() - LOOKBACK_YEARS)
    expect(h.now.spread2s10s).toMatchObject({ inverted: true, stretch: { startKnown: false } })
  })

  it('reads back to the last stretch below zero when the gap is above zero now', async () => {
    // Below zero from March to May 2025 only: a one-month view still says when it last was.
    const asked = treasury('2025-03-03', { until: '2026-06-12', invertedUntil: '2025-05-30' })
    const h = await fetchSpreadHistory('1mo', now)
    expect(asked).toEqual([2026, 2025])
    expect(h.now.spread2s10s).toMatchObject({ inverted: false, value: 0.4, stretch: { start: '2025-03-03', end: '2025-05-30', startKnown: true } })
  })

  it('reads ten years back for a gap never below zero, and says from when', async () => {
    const asked = treasury('2099-01-01', { until: '2026-06-12' })
    const h = await fetchSpreadHistory('1mo', now)
    expect(Math.min(...asked)).toBe(now.getUTCFullYear() - LOOKBACK_YEARS)
    expect(h.now.spread2s10s).toEqual({ date: '2026-06-12', value: 0.4, inverted: false })
    expect(h.readFrom).toBe('2016-01-01')
  })

  it('lists only the stretches that reach into the range, while still naming the last one', async () => {
    // Below zero in February only; the range is the month to 15 June.
    treasury('2026-02-02', { until: '2026-06-12', invertedUntil: '2026-02-27' })
    const h = await fetchSpreadHistory('1mo', now)
    expect(h.stretches.spread2s10s).toEqual([])
    expect(h.now.spread2s10s).toMatchObject({ inverted: false, stretch: { start: '2026-02-02', end: '2026-02-27' } })
  })

  it('names a year it could not read, and keeps the rest', async () => {
    treasury('2026-03-02', { failYears: [2025], until: '2026-06-12', invertedUntil: '2026-03-31' })
    const h = await fetchSpreadHistory('1y', now)
    expect(h.missingYears).toEqual([2025])
    expect(h.points.length).toBeGreaterThan(50)
  })

  it('keeps each week’s last reading over five years, and works the stretches out from every day', async () => {
    treasury('2026-06-09', { until: '2026-06-12' })
    const h = await fetchSpreadHistory('5y', now)
    expect(h.interval).toBe('weekly')
    // Four days below zero, inside one week: the stretch is still found and dated by day.
    expect(h.stretches.spread2s10s).toEqual([expect.objectContaining({ start: '2026-06-09', end: '2026-06-12', readings: 4 })])
  })
})

describe('/live-data/treasury-spread-history', () => {
  it('refuses a range it does not serve', async () => {
    const res = await GET(new Request('http://x/live-data/treasury-spread-history?range=2y'))
    expect(res.status).toBe(400)
  })

  it('says why when the Treasury cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })))
    const body = await (await GET(new Request('http://x/live-data/treasury-spread-history?range=1mo'))).json()
    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/could not be read/)
  })
})

describe('Bonds & Rates shows it', () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

  it('draws the card, shading each stretch from the route’s own stretches', () => {
    expect(read('src/app/(dashboard)/macro/rates/RatesClient.tsx')).toContain('<YieldGapHistoryCard />')
    const card = read('src/components/markets/YieldGapHistoryCard.tsx')
    expect(card).toContain('/live-data/treasury-spread-history?range=')
    expect(card).toMatch(/shadeRanges\(points\.map\(\(p\) => p\.date\), stretches\)/)
    expect(card).toContain('referenceAreas={areas}')
    // Facts only (the ledger entry): no odds, signal or forecast in the card's words.
    const words = card.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(words).not.toMatch(/recession|probabilit|odds|signal|predict|forecast/i)
  })
})
