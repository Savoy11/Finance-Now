import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fetchLiveReserves, normalisePegMechanism, toReserveRows } from '../reserves'
import { COMPOSITION_MAP } from '@/lib/data/stablecoinMeta'
import { RESERVE_UNNAMED_COLOR, reserveSliceColor } from '@/lib/utils/chart'
import type { LiveReserveAsset } from '@/app/live-data/reserves/route'

// The reserve UI existed in three hand-maintained copies until 2026-07-29, and
// the accuracy fixes only ever landed on one of them — the standalone page,
// which was also the one nothing linked to. These tests pin the two pieces of
// logic that were wrong on the surfaces users actually reach, so a future
// re-divergence fails here instead of shipping.

describe('normalisePegMechanism', () => {
  it('accepts the hyphenated form DefiLlama actually emits', () => {
    expect(normalisePegMechanism('fiat-backed')).toBe('fiat-backed')
    expect(normalisePegMechanism('crypto-backed')).toBe('crypto-backed')
  })

  it('accepts the underscored form too — the copy inside /assets keyed on this', () => {
    // The bug: the badge lookup table used underscore keys while the feed sent
    // hyphens, so 8 of the 9 monitored coins fell through to the default style
    // and printed the raw string. 'algorithmic' has no separator, which is why
    // it matched either way and made the badge look like it worked.
    expect(normalisePegMechanism('fiat_backed')).toBe('fiat-backed')
    expect(normalisePegMechanism('crypto_backed')).toBe('crypto-backed')
  })

  it('replaces every separator, not just the first', () => {
    // `.replace('_', '-')` — the coin detail page's old version — is not global.
    expect(normalisePegMechanism('a_b_c')).toBe('a-b-c')
  })

  it('lower-cases so casing cannot split one mechanism into two', () => {
    expect(normalisePegMechanism('Fiat_Backed')).toBe('fiat-backed')
  })

  it('passes through algorithmic unchanged', () => {
    expect(normalisePegMechanism('algorithmic')).toBe('algorithmic')
  })
})

const asset = (over: Partial<LiveReserveAsset> = {}): LiveReserveAsset => ({
  id: 'usdc',
  symbol: 'USDC',
  name: 'USD Coin',
  attester: 'Deloitte',
  lastAttestedDate: '2026-06-30',
  attestationUrl: 'https://example.test/report',
  circulatingUsd: 1_000,
  collateralizationRatio: 1.02,
  chains: ['Ethereum'],
  composition: [],
  pegMechanism: 'fiat-backed',
  ...over,
} as LiveReserveAsset)

describe('toReserveRows', () => {
  it('reports a disclosed ratio as disclosed, not as verified', () => {
    // The field was named `verified` and surfaced as "Verified Attestations …
    // by third-party auditor". Nothing is independently verified — it only
    // means the issuer published a number.
    const [row] = toReserveRows([asset({ collateralizationRatio: 1.02 })])
    expect(row.hasDisclosedRatio).toBe(true)
  })

  it('treats a null ratio as undisclosed rather than as zero', () => {
    const [row] = toReserveRows([asset({ collateralizationRatio: null })])
    expect(row.hasDisclosedRatio).toBe(false)
    // Must stay null: coercing to 0 would render a 0% collateralization bar,
    // which reads as "catastrophically under-collateralized" rather than
    // "the issuer does not publish this".
    expect(row.collateralizationRatio).toBeNull()
  })

  it('substitutes an explicit Undisclosed slice when composition is empty', () => {
    const [row] = toReserveRows([asset({ composition: [], circulatingUsd: 500 })])
    expect(row.composition).toHaveLength(1)
    expect(row.composition[0]).toMatchObject({
      category: 'Undisclosed',
      amount: 500,
      percentage: 100,
    })
  })

  it('preserves a real composition breakdown', () => {
    const [row] = toReserveRows([asset({
      composition: [{ category: 'T-Bills', amount: 800, percentage: 80 }],
    } as Partial<LiveReserveAsset>)])
    expect(row.composition[0].category).toBe('T-Bills')
    expect(row.composition[0].percentage).toBe(80)
  })

  it('returns an empty list rather than throwing when there is no data', () => {
    expect(toReserveRows(undefined)).toEqual([])
  })
})

// Audit 2026-11-05: a failed DefiLlama read was shown as fresh live data, a coin that could not be
// found was dropped without a word, and every donut slice was the same grey.
describe('fetchLiveReserves', () => {
  const reply = (body: unknown, status = 200) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

  it('treats a failure the route reports with a 200 as an error, not as live data', async () => {
    await expect(fetchLiveReserves(reply({ ok: false, assets: [], error: 'DefiLlama HTTP 503', updatedAt: 'x' })))
      .rejects.toThrow('DefiLlama HTTP 503')
  })

  it('passes a good answer through, with the coins it could not find', async () => {
    const data = await fetchLiveReserves(reply({ ok: true, assets: [], notFound: [{ key: 'GUSD', reason: 'gone' }], updatedAt: 'x' }))
    expect(data.notFound).toEqual([{ key: 'GUSD', reason: 'gone' }])
  })

  it('still errors on a failed HTTP status', async () => {
    await expect(fetchLiveReserves(reply({}, 500))).rejects.toThrow()
  })
})

describe('the Reserve Monitor panel', () => {
  const src = readFileSync(join(__dirname, '../reserves.tsx'), 'utf8')
  it('names the coins it could not find', () => {
    expect(src).toMatch(/data\?\.notFound/)
  })
})

describe('reserve donut colours', () => {
  const RISK_COLOURS = ['#ef4444', '#f97316', '#f59e0b', '#10b981']

  it('gives every slice of every coin its own colour, and none of the risk-level colours', () => {
    for (const [coin, slices] of Object.entries(COMPOSITION_MAP)) {
      const colours = slices.map((s, i) => reserveSliceColor(s.category, i))
      const named = colours.filter((c, i) => !/not confirmed|undisclosed/i.test(slices[i].category))
      expect(new Set(named).size, coin).toBe(named.length)
      for (const c of colours) expect(RISK_COLOURS, `${coin} ${c}`).not.toContain(c)
    }
  })

  it('keeps a slice the sources do not name grey', () => {
    expect(reserveSliceColor('Not confirmed', 0)).toBe(RESERVE_UNNAMED_COLOR)
    expect(reserveSliceColor('Other U.S. holdings (not confirmed)', 1)).toBe(RESERVE_UNNAMED_COLOR)
    expect(reserveSliceColor('Undisclosed', 2)).toBe(RESERVE_UNNAMED_COLOR)
    expect(reserveSliceColor('Bitcoin', 0)).not.toBe(RESERVE_UNNAMED_COLOR)
  })
})
