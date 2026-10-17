import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FUND_CATALOG, FUND_CATEGORY_INFO, FUND_FIGURES_COMPILED_ON, FUND_FIGURES_STALE_AFTER_DAYS } from '@/lib/data/fundCatalog'
import { buildFundFiguresData, figuresFor, parseFundOrder, FUND_FIGURES_SERVES, type FundFigure } from '../../../../scripts/lib/fundFiguresData'
import { buildFundFiguresPage, FUND_FIGURES_CAPABILITIES, FUND_FIGURES_TITLE, staleFrom } from '../../../../scripts/lib/fundFiguresPage.mjs'
import { FEE_CHECK_CSS } from '../../../../scripts/lib/feeCheckPage.mjs'

/**
 * The Fund Figures Check page (T-440, owner's choice 2026-10-17: the owner reads each
 * figure from the issuer's own page, ordered by a check against an outside figure).
 *
 * These tests RUN the page's core (scripts/lib/fundFigures.core.js) against fake stores,
 * so they fail when behaviour breaks, not only when source text moves. What they hold:
 * nothing is ever deleted; a reading needs the date the page states; a unit is never
 * guessed and a decimal comma never read as a thousands separator; a reading taken
 * against an older catalog figure is never planned; the figures to read are derived from
 * the catalog, never listed; and no outside figure reaches the page.
 */
const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const coreSrc = read('scripts/lib/fundFigures.core.js')
const clientSrc = read('scripts/lib/fundFigures.client.js')

type Reading = { id: string; symbol: string; figure: string | null; result: string; value: number | null; typed: string; asOf: string | null; kind: string | null; note: string; compared: number | null; at: string; by: string | null }
type Item = { id: string; from: number; to: number; asOf: string; kind: string }
type Plan = {
  differ: Item[]; same: Item[]; otherKind: Item[]
  cantSee: string[]; stale: string[]; applied: string[]; unread: string[]
  notes: Array<{ id: string; note: string }>
  oldestAsOf: string | null; complete: boolean
}
type Saved = { error: string | null; doc: Record<string, unknown> | null }
type Core = {
  RESULTS: Record<string, string>
  YIELD_KINDS: Record<string, string>
  ASSET_KINDS: Record<string, string>
  parsePercent(v: unknown): number | null
  parseAssets(v: unknown): number | null
  isoDay(v: unknown): string | null
  normReading(id: string, x: unknown): Reading
  normFundNote(id: string, x: unknown): { symbol: string; text: string }
  checkReading(fig: FundFigure, input: Record<string, unknown>, nowMs: number): string | null
  readingDoc(fig: FundFigure, input: Record<string, unknown>, me: string | null, nowMs: number): Record<string, unknown>
  sameAtCatalogPrecision(catalog: number, value: number): boolean
  readingState(fig: FundFigure, r: Reading | undefined): string
  tally(figs: FundFigure[], readings: Record<string, Reading>): Record<string, number>
  figurePlan(figs: FundFigure[], readings: Record<string, Reading>): Plan
  dbMessage(e: unknown): string
  longDay(iso: unknown): string
  figureText(figure: string, value: unknown): string
  figureGuidance(fund: unknown, fig: { figure: string }): string
  fundGuidance(fund: unknown): { href: string | null; label: string; hint: string }
  makeStore(o: { db: unknown; me: string | null; now?: () => number; wait?: () => Promise<void> }): {
    saveReading(fig: FundFigure, input: Record<string, unknown>): Promise<Saved>
    clearReading(fig: FundFigure): Promise<Saved>
    saveFundNote(symbol: string, text: string): Promise<Saved>
  }
}
const core = new Function(`${coreSrc}\nreturn FundFiguresCore`)() as Core

const T0 = Date.UTC(2026, 9, 17, 12)
const noWait = async () => {}
const yieldFig = (over: Partial<FundFigure> = {}): FundFigure => ({ id: 'VOO:yield', symbol: 'VOO', figure: 'yield', catalog: 1.2, ...over })
const assetFig = (over: Partial<FundFigure> = {}): FundFigure => ({ id: 'VOO:assets', symbol: 'VOO', figure: 'assets', catalog: 720, ...over })
const good = { result: 'read', value: '1.13', asOf: '2026-10-16', kind: 'trailing' }
const reading = (fig: FundFigure, input: Record<string, unknown>): Reading => core.normReading(fig.id, core.readingDoc(fig, input, 'u_owner', T0))

/** A db whose every verb is recorded, `delete` included, with scripted failures for `set`. */
function fakeDb(failures: string[] = []) {
  const calls: string[] = []
  const docs = new Map<string, unknown>()
  const ref = (path: string) => ({
    set: async (data: unknown) => {
      calls.push(`set ${path}`)
      const code = failures.shift()
      if (code) throw { code, message: code }
      docs.set(path, data)
    },
    update: async () => { calls.push(`update ${path}`) },
    delete: async () => { calls.push(`delete ${path}`) },
  })
  return { calls, docs, collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }) }
}

describe('what a person types', () => {
  it('reads a yield in percent, with or without the sign', () => {
    expect(core.parsePercent('1.25')).toBe(1.25)
    expect(core.parsePercent(' 1.25 % ')).toBe(1.25)
    expect(core.parsePercent('0')).toBe(0)
    expect(core.parsePercent('')).toBeNull()
    for (const v of ['1,25', '-1', '1e-2', 'abc', '1.2.3']) expect(core.parsePercent(v)).toBeNaN()
  })

  it('reads net assets the way a page shows them, into billions', () => {
    expect(core.parseAssets('$45.1B')).toBeCloseTo(45.1)
    expect(core.parseAssets('45.1 billion')).toBeCloseTo(45.1)
    expect(core.parseAssets('45,123 million')).toBeCloseTo(45.123)
    expect(core.parseAssets('$850M')).toBeCloseTo(0.85)
    expect(core.parseAssets('$1.2 trillion')).toBeCloseTo(1200)
    expect(core.parseAssets('$45,123,456,789')).toBeCloseTo(45.123456789)
    expect(core.parseAssets('US$ 45.1 bn')).toBeCloseTo(45.1)
    expect(core.parseAssets('')).toBeNull()
  })

  it('never guesses a unit: a small bare number could be billions or millions', () => {
    expect(core.parseAssets('45.1')).toBeNaN()
    expect(core.parseAssets('45,123')).toBeNaN()
    expect(core.checkReading(assetFig(), { ...good, value: '45.1', kind: 'own' }, T0)).toMatch(/Add the unit/)
  })

  it('never reads a decimal comma as a thousands separator', () => {
    expect(core.parseAssets('45,1B')).toBeNaN()
    expect(core.parseAssets('1.000,5 million')).toBeNaN()
    expect(core.parseAssets('45.1 furlongs')).toBeNaN()
    expect(core.checkReading(assetFig(), { ...good, value: '45,1B', kind: 'own' }, T0)).toMatch(/dot for decimals/)
    expect(core.checkReading(yieldFig(), { ...good, value: '1,13' }, T0)).toMatch(/dot for decimals/)
  })

  it('takes a date only as a real year-month-day', () => {
    expect(core.isoDay('2026-10-16')).toBe('2026-10-16')
    for (const v of ['2026-02-30', '16/10/2026', '2026-13-01', '', 20261016]) expect(core.isoDay(v)).toBeNull()
  })
})

describe('a reading', () => {
  it('needs an answer to be picked', () => {
    expect(core.checkReading(yieldFig(), {}, T0)).toBe('Pick an answer.')
    expect(core.checkReading(yieldFig(), { result: 'unchecked' }, T0)).toBe('Pick an answer.')
    expect(core.checkReading(yieldFig(), { result: 'cant-see' }, T0)).toBeNull()
    expect(core.checkReading(yieldFig(), good, T0)).toBeNull()
  })

  it('is refused without the figure, the date the page states, or which kind it is', () => {
    expect(core.checkReading(yieldFig(), { ...good, value: '' }, T0)).toMatch(/Type the yield/)
    expect(core.checkReading(yieldFig(), { ...good, asOf: '' }, T0)).toMatch(/date the page gives/)
    expect(core.checkReading(yieldFig(), { ...good, asOf: '10/16/2026' }, T0)).toMatch(/year-month-day/)
    expect(core.checkReading(yieldFig(), { ...good, kind: '' }, T0)).toMatch(/which kind of yield/)
    expect(core.checkReading(yieldFig(), { ...good, kind: 'own' }, T0)).toMatch(/which kind of yield/)
    expect(core.checkReading(assetFig(), { ...good, value: '$45B', kind: 'trailing' }, T0)).toMatch(/whole fund/)
  })

  it('is refused with a date in the future or before 2024, allowing a day for time zones', () => {
    expect(core.checkReading(yieldFig(), { ...good, asOf: '2026-10-18' }, T0)).toBeNull()
    expect(core.checkReading(yieldFig(), { ...good, asOf: '2026-10-19' }, T0)).toMatch(/future/)
    expect(core.checkReading(yieldFig(), { ...good, asOf: '2023-12-31' }, T0)).toMatch(/before 2024/)
  })

  it('is refused when the figure cannot be what the box asks for', () => {
    expect(core.checkReading(yieldFig(), { ...good, value: '113' }, T0)).toMatch(/too high/)
    expect(core.checkReading(assetFig(), { ...good, value: '$0B', kind: 'own' }, T0)).toMatch(/does not look like/)
    expect(core.checkReading(assetFig(), { ...good, value: '$9 trillion', kind: 'own' }, T0)).toMatch(/does not look like/)
  })

  it('records what it was compared against, the date read, and an asset figure as typed', () => {
    expect(core.readingDoc(yieldFig(), { ...good, note: ' also shows SEC 1.1 ' }, 'u_owner', T0)).toEqual({
      result: 'read', value: 1.13, typed: '', asOf: '2026-10-16', kind: 'trailing', note: 'also shows SEC 1.1',
      compared: 1.2, at: new Date(T0).toISOString(), by: 'u_owner',
    })
    expect(core.readingDoc(assetFig(), { ...good, value: ' $701.2B ', kind: 'own' }, null, T0)).toMatchObject({ value: 701.2, typed: '$701.2B', compared: 720 })
    expect(core.readingDoc(yieldFig(), { result: 'cant-see', value: '9', asOf: '2026-10-16', kind: 'trailing' }, null, T0))
      .toMatchObject({ result: 'cant-see', value: null, asOf: null, kind: null, compared: 1.2 })
  })

  it('normalizes whatever a writer stored, without throwing', () => {
    expect(core.normReading('VOO:yield', null)).toMatchObject({ symbol: 'VOO', figure: 'yield', result: 'unchecked', value: null, asOf: null })
    expect(core.normReading('VOO:yield', { result: 'approved', value: '1' })).toMatchObject({ result: 'unchecked', value: null })
    expect(core.normReading('VOO:yield', { result: 'toString' }).result).toBe('unchecked') // own properties only
    expect(core.normReading('VOO:yield', { result: 'read', value: 1.1, asOf: '2026-02-30', kind: 'own' })).toMatchObject({ asOf: null, kind: null })
    expect(core.normReading('VOO:bogus', { result: 'read' }).figure).toBeNull()
  })
})

describe('a reading against the catalog as it is now', () => {
  it('is current while the catalog still holds what it was compared against', () => {
    expect(core.readingState(yieldFig(), reading(yieldFig(), good))).toBe('current')
    expect(core.readingState(yieldFig(), undefined)).toBe('unchecked')
  })

  it('is applied once the catalog carries it at its own precision, and stale otherwise', () => {
    const r = reading(yieldFig(), good) // read 1.13 against 1.2
    expect(core.readingState(yieldFig({ catalog: 1.1 }), r)).toBe('applied')
    expect(core.readingState(yieldFig({ catalog: 1.13 }), r)).toBe('applied')
    expect(core.readingState(yieldFig({ catalog: 1.4 }), r)).toBe('stale')
    expect(core.readingState(yieldFig({ catalog: 1.1 }), reading(yieldFig(), { result: 'cant-see' }))).toBe('stale')
  })

  it('compares at the catalog’s own precision', () => {
    expect(core.sameAtCatalogPrecision(1.2, 1.23)).toBe(true)
    expect(core.sameAtCatalogPrecision(1.2, 1.26)).toBe(false)
    expect(core.sameAtCatalogPrecision(720, 719.6)).toBe(true)
    expect(core.sameAtCatalogPrecision(0.15, 0.154)).toBe(true)
  })

  it('counts only current or applied readings as read', () => {
    const figs = [yieldFig(), assetFig(), yieldFig({ id: 'DIA:yield', symbol: 'DIA', catalog: 1.6 })]
    const t = core.tally(figs, {
      'VOO:yield': reading(yieldFig(), good),
      'VOO:assets': reading(assetFig(), { result: 'cant-see' }),
      'DIA:yield': reading(yieldFig({ id: 'DIA:yield', symbol: 'DIA', catalog: 1.5 }), good), // catalog has moved since
    })
    expect(t).toMatchObject({ total: 3, answered: 2, read: 1, cantSee: 1, stale: 1 })
  })
})

describe('the plan the session reads', () => {
  const figs = [
    yieldFig(),
    assetFig(),
    yieldFig({ id: 'DIA:yield', symbol: 'DIA', catalog: 1.6 }),
    yieldFig({ id: 'RSP:yield', symbol: 'RSP', catalog: 1.5 }),
    yieldFig({ id: 'EMLC:yield', symbol: 'EMLC', catalog: 6.5 }),
    yieldFig({ id: 'SPY:yield', symbol: 'SPY', catalog: 1.2 }),
  ]
  const readings = {
    'VOO:yield': reading(figs[0], { ...good, note: 'saw it' }),
    'VOO:assets': reading(figs[1], { result: 'read', value: '$2.1 trillion', asOf: '2026-09-30', kind: 'whole' }),
    'DIA:yield': reading(yieldFig({ id: 'DIA:yield', catalog: 1.5 }), good),
    'RSP:yield': reading(figs[3], { ...good, value: '1.49', asOf: '2026-10-15' }),
    'EMLC:yield': reading(figs[4], { result: 'cant-see' }),
  }
  const plan = core.figurePlan(figs, readings)

  it('lists differences, agreements and other kinds apart, and leaves out a stale reading', () => {
    expect(plan.differ.map((i) => [i.id, i.from, i.to])).toEqual([['VOO:yield', 1.2, 1.13]])
    expect(plan.same.map((i) => i.id)).toEqual(['RSP:yield'])
    expect(plan.otherKind.map((i) => [i.id, i.kind])).toEqual([['VOO:assets', 'whole']])
    expect(plan.stale).toEqual(['DIA:yield'])
    expect(plan.cantSee).toEqual(['EMLC:yield'])
    expect(plan.unread).toEqual(['SPY:yield'])
    expect(plan.notes).toEqual([{ id: 'VOO:yield', note: 'saw it' }])
  })

  it('dates nothing until every figure has a dated reading, then the oldest date read', () => {
    expect(plan.complete).toBe(false)
    expect(plan.oldestAsOf).toBe('2026-09-30')
    const two = [yieldFig(), yieldFig({ id: 'RSP:yield', symbol: 'RSP', catalog: 1.5 })]
    const r1 = reading(two[0], good)
    const r2 = reading(two[1], { ...good, value: '1.5', asOf: '2026-10-01' })
    expect(core.figurePlan(two, { 'VOO:yield': r1 }).complete).toBe(false)
    const done = core.figurePlan(two, { 'VOO:yield': r1, 'RSP:yield': r2 })
    expect(done.complete).toBe(true)
    expect(done.oldestAsOf).toBe('2026-10-01')
    // An applied reading still dates its figure; a "can't find it" never does.
    expect(core.figurePlan([yieldFig({ catalog: 1.1 })], { 'VOO:yield': r1 })).toMatchObject({ applied: ['VOO:yield'], complete: true, oldestAsOf: '2026-10-16' })
    expect(core.figurePlan([yieldFig()], { 'VOO:yield': reading(yieldFig(), { result: 'cant-see' }) }).complete).toBe(false)
    expect(core.figurePlan([], {}).complete).toBe(false)
  })
})

describe('the store', () => {
  it('writes one document per figure, and never deletes — not even on Clear', async () => {
    const db = fakeDb()
    const store = core.makeStore({ db, me: 'u_owner', now: () => T0, wait: noWait })
    await store.saveReading(yieldFig(), good)
    await store.clearReading(yieldFig())
    await store.saveFundNote('VOO', 'link moved')
    expect(db.calls).toEqual(['set readings/VOO:yield', 'set readings/VOO:yield', 'set notes/VOO'])
    expect(db.docs.get('readings/VOO:yield')).toMatchObject({ result: 'unchecked', compared: 1.2 })
    expect(coreSrc).not.toMatch(/\.delete\(|\.remove\(/)
  })

  it('writes nothing when the reading is refused', async () => {
    const db = fakeDb()
    const res = await core.makeStore({ db, me: null, now: () => T0, wait: noWait }).saveReading(assetFig(), { ...good, value: '45.1', kind: 'own' })
    expect(res.error).toMatch(/Add the unit/)
    expect(db.calls).toEqual([])
  })

  it('checks the date against its own clock', async () => {
    const db = fakeDb()
    const res = await core.makeStore({ db, me: null, now: () => Date.UTC(2026, 9, 1), wait: noWait }).saveReading(yieldFig(), good)
    expect(res.error).toMatch(/future/)
  })

  it('retries once on unavailable, and throws anything else', async () => {
    const db = fakeDb(['unavailable'])
    await core.makeStore({ db, me: null, now: () => T0, wait: noWait }).saveReading(yieldFig(), good)
    expect(db.calls).toEqual(['set readings/VOO:yield', 'set readings/VOO:yield'])
    const refused = fakeDb(['invalid_argument'])
    await expect(core.makeStore({ db: refused, me: null, now: () => T0, wait: noWait }).saveReading(yieldFig(), good)).rejects.toMatchObject({ code: 'invalid_argument' })
    expect(core.dbMessage({ code: 'invalid_argument' })).toMatch(/Only the page owner and editors/)
    expect(core.dbMessage({ code: 'quota_exceeded' })).toMatch(/Nothing was removed/)
  })
})

describe('what a card says', () => {
  it('names each figure in words, marking nothing as precise that is not', () => {
    expect(core.figureText('yield', 1.2)).toBe('1.2%')
    expect(core.figureText('assets', 720)).toBe('$720 billion')
    expect(core.figureText('assets', 0.85)).toBe('$850 million')
    expect(core.figureText('assets', null)).toBe('—')
  })

  it('tells a Vanguard ETF card to read the share class, not the whole fund', () => {
    expect(core.figureGuidance({ shareClass: true }, { figure: 'assets' })).toMatch(/ETF share class’s figure, not the whole fund’s/)
    expect(core.figureGuidance({ shareClass: false }, { figure: 'assets' })).not.toMatch(/share class/)
    expect(core.figureGuidance({}, { figure: 'yield' })).toMatch(/30-day SEC yield/)
  })

  it('links the issuer’s page, and reads a malformed card without throwing', () => {
    expect(core.fundGuidance({ symbol: 'VOO', issuer: 'Vanguard', website: 'https://example.com/voo' })).toEqual({
      href: 'https://example.com/voo', label: 'Open Vanguard’s page for VOO', hint: ' If the link has moved, search “VOO Vanguard”.',
    })
    for (const bad of [null, undefined, 'x', 42]) expect(() => core.fundGuidance(bad)).not.toThrow()
    expect(core.longDay('2026-10-16')).toBe('October 16, 2026')
    expect(core.longDay('2026-13-01')).toBe('2026-13-01')
  })
})

describe('the page’s data, from the real catalog', () => {
  const label = (id: string) => FUND_CATEGORY_INFO[id as keyof typeof FUND_CATEGORY_INFO]?.label ?? id
  const base = { catalog: FUND_CATALOG, categoryLabel: label, compiledOn: FUND_FIGURES_COMPILED_ON, ageDays: 89, staleAfterDays: FUND_FIGURES_STALE_AFTER_DAYS, generatedOn: '2026-10-17' }
  const data = buildFundFiguresData(base)
  const figs = data.funds.flatMap((f) => f.figures)

  it('asks for every yield the catalog holds and every asset figure with no filing date, and nothing else', () => {
    const yields = FUND_CATALOG.filter((f) => f.yieldPct !== null)
    const undated = FUND_CATALOG.filter((f) => !f.aumAsOf)
    expect(figs.filter((g) => g.figure === 'yield').map((g) => g.symbol).sort()).toEqual(yields.map((f) => f.symbol).sort())
    expect(figs.filter((g) => g.figure === 'assets').map((g) => g.symbol).sort()).toEqual(undated.map((f) => f.symbol).sort())
    expect(data.counts).toEqual({ yields: yields.length, assets: undated.length, funds: new Set([...yields, ...undated].map((f) => f.symbol)).size })
    expect(new Set(figs.map((g) => g.id)).size).toBe(figs.length)
    for (const g of figs) {
      const f = FUND_CATALOG.find((x) => x.symbol === g.symbol)!
      expect(g.catalog).toBe(g.figure === 'yield' ? f.yieldPct : f.aumB)
    }
  })

  it('marks Vanguard’s ETFs, and only them, as share classes', () => {
    for (const c of data.funds) expect(c.shareClass).toBe(c.issuer === 'Vanguard' && c.type === 'etf')
    expect(data.funds.some((c) => c.shareClass)).toBe(true)
  })

  it('groups the funds by issuer when no sort order is given', () => {
    const issuers = data.funds.map((c) => c.issuer)
    const runs = issuers.filter((x, i) => i === 0 || issuers[i - 1] !== x)
    expect(new Set(runs).size).toBe(runs.length)
    expect(data.order).toEqual({ basis: null, ranked: 0, startHere: 0 })
    expect(data.funds.every((c) => !c.startHere)).toBe(true)
  })

  it('puts ranked funds first in the order given, marks those that differ, then groups the rest', () => {
    const order = { basis: 'A check.', funds: [{ symbol: 'DIA', differs: true }, { symbol: 'RSP', differs: false }, { symbol: 'VOO', differs: true }] }
    const d = buildFundFiguresData({ ...base, order })
    expect(d.funds.slice(0, 3).map((c) => [c.symbol, c.startHere])).toEqual([['DIA', true], ['RSP', false], ['VOO', true]])
    expect(d.funds.filter((c) => c.startHere).map((c) => c.symbol)).toEqual(['DIA', 'VOO'])
    expect(d.order).toEqual({ basis: 'A check.', ranked: 3, startHere: 2 })
    expect(d.funds).toHaveLength(data.funds.length)
  })

  it('refuses a sort order that names a fund twice, or one with nothing to read', () => {
    const known = new Set(data.funds.map((c) => c.symbol))
    expect(() => parseFundOrder({ basis: 'x', funds: [{ symbol: 'DIA', differs: true }, { symbol: 'DIA', differs: false }] }, known)).toThrow(/twice/)
    expect(() => parseFundOrder({ basis: 'x', funds: [{ symbol: 'GLD', differs: true }] }, known)).toThrow(/no figure/)
    expect(() => parseFundOrder({ basis: 'x', funds: [{ symbol: 'DIA', differs: 'yes' }] }, known)).toThrow(/true\/false/)
    expect(() => parseFundOrder({ funds: [] }, known)).toThrow(/basis/)
    expect(() => buildFundFiguresData({ ...base, order: { basis: 'x', funds: [{ symbol: 'NOPE', differs: true }] } })).toThrow(/no figure/)
  })

  it('carries no outside figure: a sort order holds symbols and flags only', () => {
    const d = buildFundFiguresData({ ...base, order: { basis: 'A check.', funds: [{ symbol: 'DIA', differs: true }] } })
    expect(Object.keys(d.funds[0]).sort()).toEqual(['category', 'figures', 'issuer', 'name', 'shareClass', 'startHere', 'symbol', 'type', 'website'])
    expect(Object.keys(d.funds[0].figures[0]).sort()).toEqual(['catalog', 'figure', 'id', 'symbol'])
  })

  it('serves T-440, and figuresFor skips a fund with nothing to read', () => {
    expect(data.serves).toEqual([...FUND_FIGURES_SERVES])
    expect(figuresFor({ symbol: 'X', name: 'X', type: 'etf', issuer: 'I', category: 'bond', website: '', yieldPct: null, aumB: 1, aumAsOf: '2026-06-30' })).toEqual([])
  })
})

describe('the published page', () => {
  const fixture = {
    generatedOn: '2026-10-17',
    serves: ['T-440'],
    catalog: { compiledOn: '2026-07-20', ageDays: 89, staleAfterDays: 120, funds: 140 },
    counts: { yields: 1, assets: 1, funds: 1 },
    order: { basis: 'A check </script><script>alert(1)</script>.', ranked: 1, startHere: 1 },
    funds: [{
      symbol: 'VOO', name: 'Vanguard S&P 500 ETF </script>', issuer: 'Vanguard', type: 'etf', category: 'US Broad Market',
      website: 'https://investor.vanguard.com/investment-products/etfs/profile/voo', shareClass: true, startHere: true,
      figures: [{ id: 'VOO:yield', symbol: 'VOO', figure: 'yield', catalog: 1.2 }, { id: 'VOO:assets', symbol: 'VOO', figure: 'assets', catalog: 720 }],
    }],
  }
  const html = buildFundFiguresPage(fixture)

  it('declares only db, with writes raised to editors, and user', () => {
    expect(FUND_FIGURES_CAPABILITIES).toEqual({ db: { rules: [{ path: '', write: 'admin' }] }, user: {} })
  })

  it('is named, and loads no script from anywhere', () => {
    expect(html.startsWith(`<title>${FUND_FIGURES_TITLE}</title>`)).toBe(true)
    expect(html).not.toMatch(/<script[^>]+src=/)
  })

  it('embeds the data so no text can close the script element, and escapes the order’s basis', () => {
    const block = html.slice(html.indexOf('id="ff-data">'), html.indexOf('</script>', html.indexOf('id="ff-data">')))
    expect(block).not.toContain('<')
    expect(JSON.parse(block.slice('id="ff-data">'.length)).funds[0].name).toBe(fixture.funds[0].name)
    expect(html).toContain('A check &lt;/script&gt;')
  })

  it('keeps the hidden attribute stronger than every display rule', () => {
    expect(FEE_CHECK_CSS).toContain('[hidden]{display:none!important}')
    expect(html).toContain('[hidden]{display:none!important}')
  })

  it('says when the approximate-figures notice starts', () => {
    expect(staleFrom('2026-07-20', 120)).toBe('2026-11-18') // the date the STALENESS-ACK names
    expect(html).toContain('From November 18, 2026 the fund pages say these figures may be out of date')
  })

  it('offers Start here only when a sort order marked funds', () => {
    expect(html).toContain('id="ff-mode-start"')
    const plain = buildFundFiguresPage({ ...fixture, order: { basis: null, ranked: 0, startHere: 0 }, funds: [{ ...fixture.funds[0], startHere: false }] })
    expect(plain).not.toContain('id="ff-mode-start"')
    expect(plain).toContain('grouped by issuer')
  })

  it('never builds markup from text, never pre-fills from the catalog, and reads nothing off window.claude but use()', () => {
    const code = clientSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/)
    expect(code).not.toMatch(/input\.value\s*=\s*String\(g\.catalog\)|value\.input\.value\s*=\s*[^;]*g\.catalog/)
    expect(code).toMatch(/var runtime = window\.claude\b/)
    const members = [...code.matchAll(/\bruntime\.(\w+)/g)].map((m) => m[1])
    expect(new Set(members)).toEqual(new Set(['use']))
    expect(code).not.toMatch(/window\.claude\.\w+/)
  })

  it('re-enables a figure’s buttons when its save finishes', () => {
    for (const src of [clientSrc, read('scripts/lib/feeCheck.client.js')]) {
      // Every save or clear of an answer (a function's own finally, six spaces in) ends this way.
      const finallies = [...src.matchAll(/\n {4}\} finally \{\n {6}els\.busy = false\n([^\n]*)/g)].map((m) => m[1].trim())
      expect(finallies.length).toBeGreaterThanOrEqual(2)
      for (const l of finallies) expect(l).toBe('enableButtons(els.btns)')
    }
  })
})

describe('the scripts around the page', () => {
  it('neither the page generator nor the plan writes anything but the page, nor moves the compiled date', () => {
    for (const f of ['scripts/gen-fund-figures-page.ts', 'scripts/fund-figures-plan.ts']) {
      const src = read(f)
      const writes = [...src.matchAll(/writeFileSync\(([^,]+),/g)].map((m) => m[1].trim())
      for (const w of writes) expect(w, f).toBe('resolve(out)')
      expect(src, f).not.toMatch(/FUND_FIGURES_COMPILED_ON\s*=/)
    }
    expect(read('scripts/fund-figures-plan.ts')).not.toMatch(/writeFileSync/)
  })

  it('are wired as npm scripts', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    expect(pkg.scripts['fund-figures-page']).toBe('tsx scripts/gen-fund-figures-page.ts')
    expect(pkg.scripts['fund-figures-plan']).toBe('tsx scripts/fund-figures-plan.ts')
  })
})
