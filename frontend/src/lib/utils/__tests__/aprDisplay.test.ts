import { describe, it, expect } from 'vitest'
import { aprBasis, aprBasisText, aprDisplay, basisCounts, rateDay, rateSummary, resolveLiveAprKey } from '../aprDisplay'
import { DEFAULT_LIVE_APR_KEY, type StakingProvider, type StakingCoinId } from '@/lib/data/stakingProviders'

type Asset = StakingProvider['assets'][StakingCoinId]

const provider = (category: StakingProvider['category']) =>
  ({ category } as StakingProvider)

const asset = (liveAprKey?: string) => ({ liveAprKey } as Asset)

describe('aprDisplay', () => {
  it('shows the static APR, unlabelled, when the row has no live key at all', () => {
    // No key is its own reason — a hand-maintained catalog figure, NOT a failed
    // fetch. Most CeFi desks publish only on a marketing page.
    expect(aprDisplay(4.2, undefined, { lido_eth: 3.1 }, { lido_eth: 'live' }))
      .toEqual({ apr: 4.2, live: false, gap: 'curated-estimate' })
  })

  it('shows the live rate with the live badge when its own key resolves as live', () => {
    expect(aprDisplay(4.2, 'lido_eth', { lido_eth: 3.1 }, { lido_eth: 'live' }))
      .toEqual({ apr: 3.1, live: true })
  })

  it('carries no gap reason at all when the row IS live', () => {
    // Absent, not present-and-null: a marker keyed off `gap` must not render for
    // a live row, and `gap: undefined` in an object is easy to truthy-test wrong.
    const out = aprDisplay(4.2, 'lido_eth', { lido_eth: 3.1 }, { lido_eth: 'live' })
    expect(out.gap).toBeUndefined()
  })

  it('shows a resolved rate WITHOUT the live badge when the feed marks it an estimate', () => {
    expect(aprDisplay(4.2, 'lido_eth', { lido_eth: 3.1 }, { lido_eth: 'estimate' }))
      .toEqual({ apr: 3.1, live: false, gap: 'upstream-failed' })
  })

  it('prefers the reason the ROUTE reported over the generic default', () => {
    // The route knows which upstream owns a key; the UI must not overrule it.
    expect(
      aprDisplay(4.2, 'native_ada', {}, { native_ada: 'estimate' }, { native_ada: 'no-upstream' }),
    ).toEqual({ apr: 4.2, live: false, gap: 'no-upstream' })
  })

  it('defaults to upstream-failed when a fetched key has no reported reason', () => {
    // Deliberately the pessimistic default: over-reporting work is recoverable,
    // writing a regression off as a known limitation is not.
    expect(aprDisplay(4.2, 'lido_eth', {}, {}, {}))
      .toEqual({ apr: 4.2, live: false, gap: 'upstream-failed' })
  })

  it('falls back to the static APR, unlabelled, when the key has no rate in the feed', () => {
    expect(aprDisplay(4.2, 'coinbase_eth', {}, {}))
      .toEqual({ apr: 4.2, live: false, gap: 'upstream-failed' })
  })

  it('treats a 0% live rate as a real rate, not a miss', () => {
    expect(aprDisplay(4.2, 'native_sol', { native_sol: 0 }, { native_sol: 'live' }))
      .toEqual({ apr: 0, live: true })
  })
})

describe('resolveLiveAprKey', () => {
  it('always honors an explicit per-asset key, regardless of category', () => {
    expect(resolveLiveAprKey(provider('cefi'), 'eth', asset('coinbase_eth'))).toBe('coinbase_eth')
    expect(resolveLiveAprKey(provider('wallet'), 'sol', asset('custom_sol'))).toBe('custom_sol')
  })

  it('gives wallets the network base-rate key for non-ETH coins', () => {
    expect(resolveLiveAprKey(provider('wallet'), 'sol', asset())).toBe(DEFAULT_LIVE_APR_KEY.sol)
    expect(resolveLiveAprKey(provider('wallet'), 'atom', asset())).toBe(DEFAULT_LIVE_APR_KEY.atom)
  })

  it('never defaults wallet ETH — one LST rate is not "the" wallet ETH rate', () => {
    expect(resolveLiveAprKey(provider('wallet'), 'eth', asset())).toBeUndefined()
  })

  it('never defaults CeFi or liquid providers — their rates are not the raw network rate', () => {
    expect(resolveLiveAprKey(provider('cefi'), 'sol', asset())).toBeUndefined()
    expect(resolveLiveAprKey(provider('liquid'), 'sol', asset())).toBeUndefined()
  })

  it('returns undefined for an undefined asset row', () => {
    expect(resolveLiveAprKey(provider('cefi'), 'sol', undefined)).toBeUndefined()
  })
})

describe('aprDisplay — an expired measurement shows no number', () => {
  // Owner decision 2026-09-18: a measured fallback older than 14 days is
  // withheld by /live-data/staking-rates rather than served. These cover the
  // display half, and the trap in it.

  it('returns null rather than falling back to the catalog estimate', () => {
    // The trap: staticApr is the LESS dated of the two values, so falling back
    // to it would defeat the expiry while looking like a graceful degrade.
    expect(aprDisplay(4.2, 'lido_eth', {}, {}, { lido_eth: 'estimate-expired' }))
      .toEqual({ apr: null, live: false, gap: 'estimate-expired' })
  })

  it('returns null even if a value is somehow still present in rates', () => {
    // Defence in depth. The route deletes the rate, but the reason is what
    // carries the decision — a consumer that got both must honour the reason.
    expect(aprDisplay(4.2, 'lido_eth', { lido_eth: 3.1 }, { lido_eth: 'estimate' }, { lido_eth: 'estimate-expired' }))
      .toEqual({ apr: null, live: false, gap: 'estimate-expired' })
  })

  it('never expires a live reading', () => {
    // An expiry that could swallow a live number would be far worse than the
    // staleness it prevents.
    expect(aprDisplay(4.2, 'lido_eth', { lido_eth: 3.1 }, { lido_eth: 'live' }, { lido_eth: 'estimate-expired' }))
      .toEqual({ apr: 3.1, live: true })
  })

  it('leaves the undated hand-maintained estimates alone', () => {
    // The 24 unmeasured keys are out of scope by owner decision: gating a date
    // they have never had would blank half the catalog.
    expect(aprDisplay(4.2, undefined, {}, {}, {}))
      .toEqual({ apr: 4.2, live: false, gap: 'curated-estimate' })
  })
})

describe('aprBasis — where a shown rate came from, and how old it is (T-465, D224)', () => {
  const dates = { lido_eth: '2026-11-05', native_atom: null }
  const basis = (key: string | undefined, rates: Record<string, number>, sources: Record<string, 'live' | 'estimate'>, gaps = {}) =>
    aprBasis(aprDisplay(4.2, key, rates, sources, gaps), key, rates, dates)

  it('a live reading is live', () => {
    expect(basis('lido_eth', { lido_eth: 3.1 }, { lido_eth: 'live' })).toEqual({ kind: 'live' })
  })

  it('a backup figure carries its measured date, or null when it was never measured', () => {
    expect(basis('lido_eth', { lido_eth: 2.25 }, { lido_eth: 'estimate' })).toEqual({ kind: 'backup', measuredOn: '2026-11-05' })
    expect(basis('native_atom', { native_atom: 13 }, { native_atom: 'estimate' }, { native_atom: 'no-upstream' }))
      .toEqual({ kind: 'backup', measuredOn: null })
  })

  it('a non-live figure the table does not hold was worked out from a live reading', () => {
    expect(basis('coinbase_eth', { coinbase_eth: 2.5 }, { coinbase_eth: 'estimate' }, { coinbase_eth: 'derived-estimate' }))
      .toEqual({ kind: 'derived' })
  })

  it('a withheld figure keeps the date it was measured', () => {
    expect(basis('lido_eth', {}, {}, { lido_eth: 'estimate-expired' })).toEqual({ kind: 'withheld', measuredOn: '2026-11-05' })
  })

  it('the catalog’s own figure, with no live key or none from the collector, is the catalog’s', () => {
    // Mutation: read the catalog date for a backup figure, as the page did before T-465.
    expect(basis(undefined, { lido_eth: 3.1 }, { lido_eth: 'live' })).toEqual({ kind: 'catalog' })
    expect(basis('coinbase_eth', {}, {})).toEqual({ kind: 'catalog' })
  })
})

describe('aprBasisText', () => {
  const CATALOG = '2026-06-28'
  it('dates each kind of figure by its own date, and never a backup figure by the catalog’s', () => {
    expect(aprBasisText({ kind: 'backup', measuredOn: '2026-11-05' }, CATALOG)).toBe('Backup rate, measured Nov 5, 2026, shown because there is no live reading.')
    expect(aprBasisText({ kind: 'backup', measuredOn: null }, CATALOG)).toBe('Backup rate with no measured date, shown because there is no live reading.')
    expect(aprBasisText({ kind: 'withheld', measuredOn: '2026-11-05' }, CATALOG)).toBe('Last measured Nov 5, 2026, too long ago to show.')
    expect(aprBasisText({ kind: 'catalog' }, CATALOG)).toBe('Catalog figure, compiled Jun 28, 2026.')
    expect(aprBasisText({ kind: 'derived' }, CATALOG)).toMatch(/Worked out from a live reading/)
    for (const b of [{ kind: 'backup', measuredOn: null }, { kind: 'backup', measuredOn: '2026-11-05' }, { kind: 'withheld', measuredOn: null }] as const) {
      expect(aprBasisText(b, CATALOG)).not.toMatch(/Jun 28/)
    }
  })

  it('reads a date as a calendar day, whatever the reader’s time zone', () => {
    // new Date('2026-06-28').toLocaleDateString() read June 27 west of Greenwich, which is how
    // the page's notice gave the catalog's date until T-465.
    const tz = process.env.TZ
    try {
      process.env.TZ = 'America/Los_Angeles'
      expect(new Date('2026-06-28').toLocaleDateString('en-US')).toBe('6/27/2026') // the old reading
      expect(rateDay('2026-06-28')).toBe('Jun 28, 2026')
      expect(rateDay('2026-01-01')).toBe('Jan 1, 2026')
      expect(rateDay('nonsense')).toBe('nonsense')
    } finally {
      if (tz === undefined) delete process.env.TZ
      else process.env.TZ = tz
    }
  })
})

describe('basisCounts and rateSummary', () => {
  it('counts each kind over the rows given, never the collector’s keys', () => {
    const c = basisCounts([
      { kind: 'live' }, { kind: 'live' }, { kind: 'derived' },
      { kind: 'backup', measuredOn: '2026-11-05' }, { kind: 'backup', measuredOn: '2026-11-03' },
      { kind: 'backup', measuredOn: null }, { kind: 'withheld', measuredOn: '2026-09-01' }, { kind: 'catalog' },
    ])
    expect(c).toEqual({ rows: 8, live: 2, derived: 1, measured: 2, measuredOn: '2026-11-03', measuredLatest: '2026-11-05', undated: 1, withheld: 1, catalog: 1 })
    expect(rateSummary(c)).toBe(
      'Of the 8 rates shown, 2 are live, 1 is worked out from a live reading taken just now, 2 are backup rates measured between ' +
      'Nov 3, 2026 and Nov 5, 2026, shown because there is no live reading, 1 is a backup rate with no measured date, 1 is withheld, ' +
      'last measured too long ago and 1 is the catalog’s own figure.')
    expect(basisCounts([])).toEqual({ rows: 0, live: 0, derived: 0, measured: 0, measuredOn: null, measuredLatest: null, undated: 0, withheld: 0, catalog: 0 })
    expect(rateSummary(basisCounts([]))).toBe('')
    expect(rateSummary(basisCounts([{ kind: 'backup', measuredOn: '2026-11-05' }]))).toBe(
      'Of the 1 rate shown, 1 is a backup rate measured Nov 5, 2026, shown because there is no live reading.')
  })
})
