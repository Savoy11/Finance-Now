import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PEG_HISTORY_DAYS, PEG_OFF_THRESHOLD_PCT,
  formatDevPct, pegHistoryFor, windowRows, type PegPriceRow,
} from '../pegHistory'
import { DEFILLAMA_STABLECOINS } from '../stablecoinMeta'

// T-467 (D242): peg history is arithmetic on DefiLlama's published daily
// readings against $1 — the kind of figure D14 kept — joined per coin by the
// geckoId the hand-kept table records (D190). The fixture is a dated excerpt
// of the REAL /stablecoinprices response (the Monitor's own host, read
// 2026-11-24 from this environment), so the join and the window are held
// against what the feed actually serves.

const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/llama-stablecoinprices-2026-11-24.json'), 'utf8')) as {
  readOn: string
  rows: PegPriceRow[]
}

const NOW = new Date('2026-11-24T12:00:00Z')
const day = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 1000)
const row = (iso: string, prices: Record<string, number>): PegPriceRow => ({ date: day(iso), prices })

describe('windowRows', () => {
  it('keeps only the window, oldest first, and drops the feed’s junk date-0 row', () => {
    const rows = windowRows([
      { date: 0, prices: { x: 1 } },
      row('2026-11-23', { x: 1 }),
      row('2026-08-01', { x: 1 }), // older than 90 days before NOW
      row('2026-09-10', { x: 1 }),
    ], NOW)
    expect(rows.map((r) => r.date)).toEqual([day('2026-09-10'), day('2026-11-23')])
  })

  it('keeps one row per day', () => {
    const rows = windowRows([row('2026-11-20', { x: 1 }), { date: day('2026-11-20') + 60, prices: { x: 2 } }], NOW)
    expect(rows).toHaveLength(1)
  })
})

describe('pegHistoryFor', () => {
  it('finds the largest move with its date and counts the days past the threshold', () => {
    const rows = windowRows([
      row('2026-11-01', { usdx: 1.001 }),
      row('2026-11-02', { usdx: 0.9915 }), // −0.85%: the largest, and past 0.5%
      row('2026-11-03', { usdx: 1.006 }),  // +0.6%: past 0.5%
      row('2026-11-04', { usdx: 0.999 }),
    ], NOW)
    const h = pegHistoryFor('usdx', rows)!
    expect(h.maxDevPct).toBeCloseTo(-0.85, 6)
    expect(h.maxDevDate).toBe('2026-11-02')
    expect(h.daysOffHalfPct).toBe(2)
    expect(h.daysCovered).toBe(4)
    expect(h.readings.map((r) => r.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'])
  })

  it('a day with no reading is left out and counted out — never read as $1', () => {
    const rows = windowRows([
      row('2026-11-01', { usdx: 1.002 }),
      row('2026-11-02', { other: 1 }), // no usdx reading that day
      row('2026-11-03', { usdx: 0.998 }),
    ], NOW)
    const h = pegHistoryFor('usdx', rows)!
    expect(h.daysCovered).toBe(2)
    expect(h.readings).toHaveLength(2)
  })

  it('a coin with no readings in the window is null, not an empty history', () => {
    expect(pegHistoryFor('absent', windowRows([row('2026-11-01', { usdx: 1 })], NOW))).toBeNull()
  })

  it('formats the move signed, two places', () => {
    expect(formatDevPct(-0.853)).toBe('-0.85%')
    expect(formatDevPct(0.6)).toBe('+0.60%')
    expect(formatDevPct(0.0001)).toBe('0.00%')
  })
})

describe('against the real feed (fixture read 2026-11-24)', () => {
  const windowed = windowRows(fixture.rows, NOW)

  it('every monitored coin’s geckoId finds daily readings in the window', () => {
    for (const [symbol, { geckoId }] of Object.entries(DEFILLAMA_STABLECOINS)) {
      const h = pegHistoryFor(geckoId, windowed)
      expect(h, `${symbol} (${geckoId})`).not.toBeNull()
      expect(h!.daysCovered, symbol).toBeGreaterThan(80)
    }
  })

  it('USDT’s window reads as the checkable fact the surface exists to state', () => {
    // Measured when the fixture was cut: largest move −0.218% on 2026-11-20,
    // zero days more than 0.5% off. The fixture pins the measurement.
    const h = pegHistoryFor('tether', windowed)!
    expect(h.maxDevPct).toBeCloseTo(-0.218, 2)
    expect(h.maxDevDate).toBe('2026-11-20')
    expect(h.daysOffHalfPct).toBe(0)
  })

  it('the euro-pegged control shows why non-dollar coins are excluded: its dollar price sits far from $1', () => {
    const h = pegHistoryFor('stasis-eurs', windowed)!
    // Not a depeg — the euro. The route excludes non-peggedUSD coins for
    // exactly this reason; this documents the wrong figure the rule prevents.
    expect(Math.abs(h.maxDevPct)).toBeGreaterThan(5)
  })

  it('the window constant matches what the surfaces say', () => {
    expect(PEG_HISTORY_DAYS).toBe(90)
    expect(PEG_OFF_THRESHOLD_PCT).toBe(0.5)
  })
})

describe('the wiring', () => {
  const read = (p: string) => readFileSync(join(__dirname, p), 'utf8')

  it('the route serves ?history=1 with the pegType exclusion, leaving the Monitor’s response alone', () => {
    const route = read('../../../app/live-data/reserves/route.ts')
    expect(route).toContain("searchParams.get('history')")
    expect(route).toContain("pegType !== 'peggedUSD'")
    expect(route).toContain('pegHistoryFor(')
  })

  it('both surfaces mount the panel, which renders nothing without a history', () => {
    const shared = read('../../../components/analytics/reserves.tsx')
    expect(shared).toContain('<PegHistoryPanel coinId={selected.assetId} />')
    expect(shared).toMatch(/if \(!history\) return null/)
    const page = read('../../../app/(dashboard)/assets/[id]/page.tsx')
    expect(page).toContain('<PegHistoryPanel coinId={liveAsset.id} />')
  })

  it('the figures stay figures: the panel’s copy carries no grade word', () => {
    const shared = read('../../../components/analytics/reserves.tsx')
    const panel = shared.slice(shared.indexOf('function PegSparkline'), shared.indexOf('export function ReserveMonitorPanel'))
    expect(panel).not.toMatch(/\b(safe|risky|healthy|unstable|grade|score)\b/i)
  })
})
