import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { STAKING_PROVIDERS, STAKING_COIN_INFO } from '@/lib/data/stakingProviders'
import { stakingFactRows, LLAMA_SLUG, LOCKUP_LEADS, type FactRow } from '../../../../scripts/lib/stakingFactRows'
import { buildStakingFactsData, CATEGORY_ORDER, STAKING_FACTS_SERVES } from '../../../../scripts/lib/stakingFactsData'
import { buildStakingFactsPage, STAKING_FACTS_CAPABILITIES, STAKING_FACTS_TITLE } from '../../../../scripts/lib/stakingFactsPage.mjs'

/**
 * The Staking Facts Check page (T-394, owner's choice 2026-10-17: a check page like the
 * Transfer Fee Check, for the staking catalog's factual fields).
 *
 * These tests RUN the page's core (scripts/lib/stakingFacts.core.js) against fake stores,
 * so they fail when behaviour breaks, not only when source text moves. What they hold:
 * nothing is ever deleted; blank is unknown and "Matches" is never a default; an answer
 * given against older figures is never planned; a decimal comma and a missing unit are
 * never guessed; the rows are derived from the catalog, and the page and the plan read
 * the same list.
 */
const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const coreSrc = read('scripts/lib/stakingFacts.core.js')
const clientSrc = read('scripts/lib/stakingFacts.client.js')

type Check = { key: string; result: string; values: Record<string, unknown>; note: string; compared: Record<string, unknown>; at: string; by: string | null }
type Change = { key: string; field: string; from: unknown; to: unknown }
type Plan = {
  changes: Change[]; notOffered: string[]; confirmed: string[]; cantSee: string[]; stale: string[]; applied: string[]; unread: string[]
  notes: Array<{ key: string; note: string }>; complete: boolean; lastAnswered: string | null
}
type Saved = { error: string | null; doc: Record<string, unknown> | null }
type Core = {
  RESULTS: Record<string, string>
  KIND_RESULTS: Record<string, string[]>
  parseField(type: string, v: unknown, nowYear: number): unknown
  normCheck(id: string, x: unknown): Check
  checkAnswer(row: FactRow, input: Record<string, unknown>, nowMs: number): string | null
  answerDoc(row: FactRow, input: Record<string, unknown>, me: string | null, nowMs: number): Record<string, unknown>
  answerState(row: FactRow, c: Check | undefined): string
  tally(rows: FactRow[], checks: Record<string, Check>): Record<string, number>
  factPlan(rows: FactRow[], checks: Record<string, Check>): Plan
  dbMessage(e: unknown): string
  fieldText(field: unknown, value: unknown): string
  providerGuidance(p: unknown): { link: { href: string | null; label: string; hint: string }; notes: Array<{ tone: string; text: string }> }
  makeStore(o: { db: unknown; me: string | null; now?: () => number; wait?: () => Promise<void> }): {
    saveAnswer(row: FactRow, input: Record<string, unknown>): Promise<Saved>
    clearAnswer(row: FactRow): Promise<Saved>
    saveProviderNote(id: string, text: string): Promise<Saved>
  }
}
const core = new Function(`${coreSrc}\nreturn StakingFactsCore`)() as Core

const T0 = Date.UTC(2026, 9, 17, 12)
const noWait = async () => {}
const terms = (over: { min?: number; lockup?: number } = {}): FactRow => ({
  key: 'lido:eth:terms', providerId: 'lido', kind: 'terms', coin: 'eth',
  fields: [{ name: 'min', type: 'amount', catalog: over.min ?? 0.01, unit: 'ETH' }, { name: 'lockup', type: 'days', catalog: over.lockup ?? 0 }],
})
const one = (kind: FactRow['kind'], type: string, catalog: number | string | null, name = type): FactRow => ({
  key: `lido:${kind}`, providerId: 'lido', kind, fields: [{ name, type: type as never, catalog }],
})
const founded = (y: number | null = 2020) => one('founded', 'year', y)
const audits = (n: number | null = 12) => one('audits', 'count', n)
const assets = (b = 2.1) => one('assets', 'billions', b)
const site = (u = 'https://stake.lido.fi') => one('site', 'url', u)
const answer = (r: FactRow, input: Record<string, unknown>): Check => core.normCheck(r.key, core.answerDoc(r, input, 'u_owner', T0))

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
  it('reads amounts and days with a dot for decimals and commas only between thousands', () => {
    expect(core.parseField('amount', '0.01', 2026)).toBe(0.01)
    expect(core.parseField('amount', '1,000', 2026)).toBe(1000)
    expect(core.parseField('amount', '0', 2026)).toBe(0)
    expect(core.parseField('days', '21', 2026)).toBe(21)
    expect(core.parseField('amount', '', 2026)).toBeNull()
    for (const v of ['0,01', '1.000,5', '-1', '1e-3', 'abc']) expect(core.parseField('amount', v, 2026)).toBeNaN()
    expect(core.parseField('days', '4000', 2026)).toBeNaN()
  })

  it('reads a founding year within reason, and an audit count as a whole number', () => {
    expect(core.parseField('year', '2018', 2026)).toBe(2018)
    for (const v of ['1989', '2027', '18', '2018.5']) expect(core.parseField('year', v, 2026)).toBeNaN()
    expect(core.parseField('count', '4', 2026)).toBe(4)
    for (const v of ['4.5', '-1', '9999']) expect(core.parseField('count', v, 2026)).toBeNaN()
  })

  it('reads an assets figure only with its unit, into billions', () => {
    expect(core.parseField('billions', '$2.4B', 2026)).toBeCloseTo(2.4)
    expect(core.parseField('billions', '850 million', 2026)).toBeCloseTo(0.85)
    expect(core.parseField('billions', '2.4', 2026)).toBeNaN()
    expect(core.parseField('billions', '2,4B', 2026)).toBeNaN()
  })

  it('reads a website only as a full https address, kept as typed', () => {
    expect(core.parseField('url', ' https://stake.lido.fi ', 2026)).toBe('https://stake.lido.fi')
    for (const v of ['http://lido.fi', 'stake.lido.fi', 'https://localhost', 'https://a b.fi', 'javascript:alert(1)']) expect(core.parseField('url', v, 2026)).toBeNaN()
  })
})

describe('an answer for a row', () => {
  it('needs an answer the row offers: only a coin can be "not offered"', () => {
    expect(core.checkAnswer(terms(), {}, T0)).toBe('Pick an answer.')
    expect(core.checkAnswer(terms(), { result: 'not-offered' }, T0)).toBeNull()
    expect(core.checkAnswer(founded(), { result: 'not-offered' }, T0)).toBe('Pick an answer.')
    expect(core.checkAnswer(site(), { result: 'ok' }, T0)).toBeNull()
  })

  it('refuses "Matches" where the catalog has no figure yet', () => {
    expect(core.checkAnswer(audits(null), { result: 'ok' }, T0)).toMatch(/no figure here yet/)
    expect(core.checkAnswer(audits(null), { result: 'changed', values: { count: '3' } }, T0)).toBeNull()
  })

  it('refuses "Different" carrying the catalog’s own figures, or nothing at all', () => {
    expect(core.checkAnswer(terms(), { result: 'changed', values: { min: '0.01' } }, T0)).toMatch(/Choose Matches/)
    expect(core.checkAnswer(terms(), { result: 'changed', values: { min: '0.01', lockup: '0' } }, T0)).toMatch(/Choose Matches/)
    expect(core.checkAnswer(terms(), { result: 'changed', values: {} }, T0)).toMatch(/at least one figure/)
    expect(core.checkAnswer(site(), { result: 'changed', values: { url: 'https://stake.lido.fi' } }, T0)).toMatch(/already has/)
    expect(core.checkAnswer(terms(), { result: 'changed', values: { lockup: '3' } }, T0)).toBeNull()
  })

  it('names the problem with what was typed', () => {
    expect(core.checkAnswer(terms(), { result: 'changed', values: { min: '0,5' } }, T0)).toMatch(/dot for decimals/)
    expect(core.checkAnswer(assets(), { result: 'changed', values: { billions: '2.4' } }, T0)).toMatch(/Add the unit/)
    expect(core.checkAnswer(founded(), { result: 'changed', values: { year: '2030' } }, T0)).toMatch(/year founded/)
    expect(core.checkAnswer(site(), { result: 'changed', values: { url: 'stake.lido.fi' } }, T0)).toMatch(/https/)
  })

  it('records a blank figure as the catalog’s own value, and what it compared against', () => {
    expect(core.answerDoc(terms(), { result: 'changed', values: { lockup: '3' }, note: ' 1–5 days ' }, 'u_owner', T0)).toEqual({
      result: 'changed', values: { min: 0.01, lockup: 3 }, note: '1–5 days', compared: { min: 0.01, lockup: 0 }, at: new Date(T0).toISOString(), by: 'u_owner',
    })
    expect(core.answerDoc(founded(), { result: 'ok' }, null, T0)).toMatchObject({ result: 'ok', values: {}, compared: { year: 2020 } })
  })

  it('normalizes whatever a writer stored, without throwing', () => {
    expect(core.normCheck('k', null)).toMatchObject({ key: 'k', result: 'unchecked', values: {}, compared: {}, note: '' })
    expect(core.normCheck('k', { result: 'approved', values: { min: { evil: 1 } } })).toMatchObject({ result: 'unchecked', values: {} })
    expect(core.normCheck('k', { result: 'toString' }).result).toBe('unchecked') // own properties only
  })
})

describe('an answer read against the catalog as it is now', () => {
  it('is current while the catalog still says what it was compared against', () => {
    expect(core.answerState(terms(), answer(terms(), { result: 'ok' }))).toBe('current')
    expect(core.answerState(terms(), undefined)).toBe('unchecked')
  })

  it('is applied once the catalog carries it, and stale when the catalog moved elsewhere', () => {
    const c = answer(terms(), { result: 'changed', values: { lockup: '3' } })
    expect(core.answerState(terms({ lockup: 3 }), c)).toBe('applied')
    expect(core.answerState(terms({ lockup: 7 }), c)).toBe('stale')
    expect(core.answerState(terms({ lockup: 7 }), answer(terms(), { result: 'ok' }))).toBe('stale')
  })
})

describe('the plan the session reads', () => {
  const rows = [terms(), founded(), audits(null), assets(), site(), { ...terms(), key: 'lido:matic:terms', coin: 'matic' as const }]
  const checks = {
    'lido:eth:terms': answer(rows[0], { result: 'changed', values: { lockup: '3' }, note: '1–5 days' }),
    'lido:founded': answer(rows[1], { result: 'ok' }),
    'lido:audits': answer(rows[2], { result: 'changed', values: { count: '9' } }),
    'lido:assets': answer(rows[3], { result: 'cant-see' }),
    'lido:matic:terms': answer(rows[5], { result: 'not-offered' }),
  }
  const plan = core.factPlan(rows, checks)

  it('lists only the figures that differ, each with its old and new value', () => {
    expect(plan.changes.map((c) => [c.key, c.field, c.from, c.to])).toEqual([
      ['lido:eth:terms', 'lockup', 0, 3],
      ['lido:audits', 'count', null, 9],
    ])
    expect(plan.notOffered).toEqual(['lido:matic:terms'])
    expect(plan.confirmed).toEqual(['lido:founded'])
    expect(plan.cantSee).toEqual(['lido:assets'])
    expect(plan.unread).toEqual(['lido:site'])
    expect(plan.notes).toEqual([{ key: 'lido:eth:terms', note: '1–5 days' }])
  })

  it('leaves out an answer given against older figures', () => {
    const moved = core.factPlan([terms({ lockup: 7 })], { 'lido:eth:terms': checks['lido:eth:terms'] })
    expect(moved.stale).toEqual(['lido:eth:terms'])
    expect(moved.changes).toEqual([])
  })

  it('is complete only when every row is settled; "can’t see it" settles nothing', () => {
    expect(plan.complete).toBe(false)
    const two = [founded(), site()]
    expect(core.factPlan(two, { 'lido:founded': answer(two[0], { result: 'ok' }), 'lido:site': answer(two[1], { result: 'cant-see' }) }).complete).toBe(false)
    const done = core.factPlan(two, { 'lido:founded': answer(two[0], { result: 'ok' }), 'lido:site': answer(two[1], { result: 'ok' }) })
    expect(done.complete).toBe(true)
    expect(done.lastAnswered).toBe(new Date(T0).toISOString())
    expect(core.factPlan([], {}).complete).toBe(false)
  })

  it('counts answered and settled apart', () => {
    expect(core.tally(rows, checks)).toMatchObject({ total: 6, answered: 5, settled: 4, 'cant-see': 1, stale: 0 })
  })
})

describe('the store', () => {
  it('writes one document per row, and never deletes — not even on Clear', async () => {
    const db = fakeDb()
    const store = core.makeStore({ db, me: 'u_owner', now: () => T0, wait: noWait })
    await store.saveAnswer(terms(), { result: 'ok' })
    await store.clearAnswer(terms())
    await store.saveProviderNote('lido', 'docs moved')
    expect(db.calls).toEqual(['set checks/lido:eth:terms', 'set checks/lido:eth:terms', 'set notes/lido'])
    expect(db.docs.get('checks/lido:eth:terms')).toMatchObject({ result: 'unchecked', compared: { min: 0.01, lockup: 0 } })
    expect(coreSrc).not.toMatch(/\.delete\(|\.remove\(/)
  })

  it('writes nothing when the answer is refused, and checks a year against its own clock', async () => {
    const db = fakeDb()
    const store = core.makeStore({ db, me: null, now: () => Date.UTC(2017, 0, 1), wait: noWait })
    expect((await store.saveAnswer(founded(), { result: 'changed', values: { year: '2018' } })).error).toMatch(/year founded/)
    expect(db.calls).toEqual([])
  })

  it('retries once on unavailable, and throws anything else', async () => {
    const db = fakeDb(['unavailable'])
    await core.makeStore({ db, me: null, now: () => T0, wait: noWait }).saveAnswer(terms(), { result: 'ok' })
    expect(db.calls).toEqual(['set checks/lido:eth:terms', 'set checks/lido:eth:terms'])
    const refused = fakeDb(['invalid_argument'])
    await expect(core.makeStore({ db: refused, me: null, now: () => T0, wait: noWait }).saveAnswer(terms(), { result: 'ok' })).rejects.toMatchObject({ code: 'invalid_argument' })
    expect(core.dbMessage({ code: 'quota_exceeded' })).toMatch(/Nothing was removed/)
  })
})

describe('what a card says', () => {
  it('names each figure in words', () => {
    expect(core.fieldText({ type: 'amount', unit: 'ETH' }, 0.01)).toBe('0.01 ETH')
    expect(core.fieldText({ type: 'amount', unit: 'ETH' }, 0)).toBe('None')
    expect(core.fieldText({ type: 'days' }, 21)).toBe('21 days')
    expect(core.fieldText({ type: 'days' }, 1)).toBe('1 day')
    expect(core.fieldText({ type: 'billions' }, 0.85)).toBe('$850 million')
    expect(core.fieldText({ type: 'count' }, null)).toBe('none recorded')
  })

  it('tells an exchange card that terms may need a sign-in, and no other', () => {
    expect(core.providerGuidance({ name: 'Kraken', category: 'cefi', website: 'https://kraken.com' }).notes[0].text).toMatch(/sign in/)
    expect(core.providerGuidance({ name: 'Lido', category: 'liquid', website: 'https://stake.lido.fi' }).notes).toEqual([])
    expect(core.providerGuidance({ name: 'X', category: 'wallet' }).link.href).toBeNull()
    for (const bad of [null, undefined, 42]) expect(() => core.providerGuidance(bad)).not.toThrow()
  })
})

describe('the rows, from the real catalog', () => {
  const symbols = Object.fromEntries(Object.entries(STAKING_COIN_INFO).map(([id, c]) => [id, c.symbol]))
  const rows = stakingFactRows(STAKING_PROVIDERS, symbols)
  const live = STAKING_PROVIDERS.filter((p) => !p.defunct)

  it('checks every live provider’s page and founding year, and leaves the defunct out', () => {
    for (const p of live) {
      expect(rows.some((r) => r.key === `${p.id}:site`), p.id).toBe(true)
      expect(rows.some((r) => r.key === `${p.id}:founded`), p.id).toBe(true)
    }
    for (const p of STAKING_PROVIDERS.filter((x) => x.defunct)) expect(rows.some((r) => r.providerId === p.id), p.id).toBe(false)
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length)
  })

  it('checks a minimum and lock-up for every coin a live provider stakes', () => {
    const expected = live.flatMap((p) => Object.keys(p.assets).map((c) => `${p.id}:${c}:terms`)).sort()
    expect(rows.filter((r) => r.kind === 'terms').map((r) => r.key).sort()).toEqual(expected)
    for (const r of rows.filter((x) => x.kind === 'terms')) {
      const a = STAKING_PROVIDERS.find((p) => p.id === r.providerId)!.assets[r.coin!]!
      expect(r.fields.map((f) => f.catalog)).toEqual([a.minStakeNative, a.lockupDays])
      expect(r.fields[0].unit).toBe(STAKING_COIN_INFO[r.coin!].symbol)
    }
  })

  it('asks for an assets figure only where the catalog shows one DefiLlama does not supply', () => {
    const expected = live.filter((p) => p.tvlBillions != null && !LLAMA_SLUG[p.id]).map((p) => p.id).sort()
    expect(rows.filter((r) => r.kind === 'assets').map((r) => r.providerId).sort()).toEqual(expected)
    expect(expected.length).toBeGreaterThan(0)
  })

  it('asks for audits where the catalog has a count, and for every liquid protocol', () => {
    const expected = live.filter((p) => p.auditCount != null || p.category === 'liquid').map((p) => p.id).sort()
    expect(rows.filter((r) => r.kind === 'audits').map((r) => r.providerId).sort()).toEqual(expected)
  })

  it('names in its lock-up leads only rows that exist', () => {
    // A mistyped key would never show, and nothing else would say so.
    const keys = new Set(rows.filter((r) => r.kind === 'terms').map((r) => r.key))
    for (const k of Object.keys(LOCKUP_LEADS)) expect(keys.has(k), k).toBe(true)
  })

  it('marks Start here exactly the lead rows whose catalog figure and note are still the ones questioned', () => {
    for (const r of rows) {
      const lead = LOCKUP_LEADS[r.key]
      const a = r.kind === 'terms' ? STAKING_PROVIDERS.find((p) => p.id === r.providerId)!.assets[r.coin!]! : undefined
      const holds = lead !== undefined && a !== undefined && a.lockupDays === lead.days && (a.lockupNote ?? null) === lead.note
      expect(r.lead, r.key).toBe(holds ? lead.ask : undefined)
    }
  })

  it('puts its ETH lead only on exchange rows, as the audit counted them', () => {
    for (const k of Object.keys(LOCKUP_LEADS).filter((x) => x.includes(':eth:'))) {
      expect(STAKING_PROVIDERS.find((p) => p.id === k.split(':')[0])!.category, k).toBe('cefi')
    }
  })

  it('drops a lead once its row is corrected or gains a note', () => {
    const p = STAKING_PROVIDERS.find((x) => x.id === 'kraken')!
    const sol = p.assets.sol!
    const leadsFor = (asset: typeof sol) => stakingFactRows([{ ...p, assets: { sol: asset } }], symbols).filter((r) => r.lead).map((r) => r.key)
    expect(leadsFor({ ...sol, lockupDays: 5, lockupNote: undefined })).toEqual(['kraken:sol:terms'])
    expect(leadsFor({ ...sol, lockupDays: 3, lockupNote: undefined })).toEqual([])
    expect(leadsFor({ ...sol, lockupDays: 5, lockupNote: 'Kraken holds unstaked SOL for 5 days' })).toEqual([])
  })

  it('orders the cards liquid, then wallets, then exchanges, in catalog order within each', () => {
    const data = buildStakingFactsData({ providers: STAKING_PROVIDERS, symbols, lastVerified: '2026-06-28', ageDays: 111, staleAfterDays: 90, generatedOn: '2026-10-17' })
    const cats = data.providers.map((p) => p.category)
    const ranks = cats.map((c) => CATEGORY_ORDER.indexOf(c))
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(data.counts.rows).toBe(rows.length)
    expect(data.serves).toEqual([...STAKING_FACTS_SERVES])
    expect(data.catalog.defunct).toBe(STAKING_PROVIDERS.filter((p) => p.defunct).length)
    expect(data.counts.leads).toBe(rows.filter((r) => r.lead).length)
  })
})

describe('the published page', () => {
  const fixture = {
    generatedOn: '2026-10-17', serves: ['T-394'],
    catalog: { lastVerified: '2026-06-28', ageDays: 111, staleAfterDays: 90, providers: 2, defunct: 1 },
    counts: { rows: 1, terms: 1, providers: 1, leads: 0 },
    providers: [{ id: 'lido', name: 'Lido </script><script>alert(1)</script>', category: 'liquid', website: 'https://stake.lido.fi', rows: [terms()] }],
  }
  const html = buildStakingFactsPage(fixture)

  it('offers a Start here filter only when a row carries a lead', () => {
    expect(html).not.toContain('id="sf-group-start"')
    const led = buildStakingFactsPage({ ...fixture, counts: { ...fixture.counts, leads: 1 }, providers: [{ ...fixture.providers[0], rows: [{ ...terms(), lead: 'Check this one.' }] }] })
    expect(led).toContain('id="sf-group-start"')
    expect(led).toMatch(/1 lock-up on 1 provider is marked <b>Start here<\/b>/)
    expect(clientSrc).toMatch(/'Start here: ' \+ r\.lead/)
  })

  it('declares only db, with writes raised to editors, and user', () => {
    expect(STAKING_FACTS_CAPABILITIES).toEqual({ db: { rules: [{ path: '', write: 'admin' }] }, user: {} })
  })

  it('is named, loads no script from anywhere, and keeps hidden things hidden', () => {
    expect(html.startsWith(`<title>${STAKING_FACTS_TITLE}</title>`)).toBe(true)
    expect(html).not.toMatch(/<script[^>]+src=/)
    expect(html).toContain('[hidden]{display:none!important}')
  })

  it('embeds the data so no text can close the script element', () => {
    const block = html.slice(html.indexOf('id="sf-data">'), html.indexOf('</script>', html.indexOf('id="sf-data">')))
    expect(block).not.toContain('<')
    expect(JSON.parse(block.slice('id="sf-data">'.length)).providers[0].name).toBe(fixture.providers[0].name)
  })

  it('never builds markup from text, never pre-fills from the catalog, and reads nothing off window.claude but use()', () => {
    const code = clientSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/)
    expect(code).not.toMatch(/input\.value\s*=\s*[^;]*fd\.catalog\s*[;)]/)
    expect(code).toMatch(/var runtime = window\.claude\b/)
    expect(new Set([...code.matchAll(/\bruntime\.(\w+)/g)].map((m) => m[1]))).toEqual(new Set(['use']))
  })

  it('re-enables a row’s buttons when its save finishes', () => {
    const finallies = [...clientSrc.matchAll(/\n {4}\} finally \{\n {6}els\.busy = false\n([^\n]*)/g)].map((m) => m[1].trim())
    expect(finallies.length).toBeGreaterThanOrEqual(2)
    for (const l of finallies) expect(l).toBe('enableButtons(els.btns)')
  })
})

describe('the scripts around the page', () => {
  it('neither the generator nor the plan writes the catalog or moves its date', () => {
    const gen = read('scripts/gen-staking-facts-page.ts')
    expect([...gen.matchAll(/writeFileSync\(([^,]+),/g)].map((m) => m[1].trim())).toEqual(['resolve(out)'])
    const plan = read('scripts/staking-facts-plan.ts')
    expect(plan).not.toMatch(/writeFileSync/)
    for (const src of [gen, plan]) expect(src).not.toMatch(/STAKING_DATA_LAST_VERIFIED\s*=/)
  })

  it('read the same row list, and are wired as npm scripts', () => {
    for (const f of ['scripts/lib/stakingFactsData.ts', 'scripts/staking-facts-plan.ts']) expect(read(f)).toMatch(/stakingFactRows/)
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    expect(pkg.scripts['staking-facts-page']).toBe('tsx scripts/gen-staking-facts-page.ts')
    expect(pkg.scripts['staking-facts-plan']).toBe('tsx scripts/staking-facts-plan.ts')
  })
})
