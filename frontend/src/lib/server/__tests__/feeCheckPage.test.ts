import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EXCHANGES, COIN_INFO, NETWORKS, SPOT_TRADING_FEES } from '@/lib/data/transferFees'
import { WITHDRAW_FEE_SOURCES } from '@/lib/server/withdrawFeeAdapters'
import { hostOf, matchTermsEntry } from '@/lib/server/sourceTerms'
import { feeRows, byImpact, CORE_N, FEE_PAGES } from '../../../../scripts/lib/transferFeeRows'
import { buildFeeCheckData, feeLeads, namesExchange, FEE_CHECK_SERVES, type LedgerItem } from '../../../../scripts/lib/feeCheckData'
import { buildFeeCheckPage, dataJson, FEE_CHECK_CAPABILITIES, FEE_CHECK_TITLE } from '../../../../scripts/lib/feeCheckPage.mjs'

/**
 * The Transfer Fee Check page (T-031, owner decision D52, 2026-10-01).
 *
 * The owner reads exchange fee pages and records an answer per table row; the answers live
 * in the published page's database and reach the table only through a pull request, a
 * changed fee by way of fee-apply's guards. These tests RUN the page's core
 * (scripts/lib/feeCheck.core.js) against fake stores, so they fail when behaviour breaks,
 * not only when source text moves. What they hold: nothing is ever deleted; blank is
 * unknown and "Matches" is never a default; an answer given against older figures is never
 * applied; a decimal comma is never read as a thousands separator; and the page and the
 * CSV worksheet come from one row list, so they cannot count or rank the job differently.
 */
const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const coreSrc = read('scripts/lib/feeCheck.core.js')
const clientSrc = read('scripts/lib/feeCheck.client.js')

type Row = { key: string; exchange: string; coin: string; network: string; fee: number; min: number }
type Check = { key: string; result: string; fee: number | null; min: number | null; note: string; comparedFee: number | null; comparedMin: number | null; at: string; by: string | null }
type Plan = {
  csv: string
  feeChanges: Array<{ key: string; from: number; to: number }>
  minChanges: Array<{ key: string; from: number; to: number }>
  notOffered: string[]; confirmed: string[]; cantSee: string[]; stale: string[]; applied: string[]
  notes: Array<{ key: string; note: string }>
}
type Saved = { error: string | null; doc: Record<string, unknown> | null }
type Core = {
  APPLY_COLUMNS: string[]
  ROW_RESULTS: Record<string, string>
  parseAmount(v: unknown): number | null
  normRowCheck(id: string, x: unknown): Check
  normTradingCheck(id: string, x: unknown): { result: string; maker: number | null; taker: number | null }
  checkRowAnswer(row: Row, input: Record<string, unknown>): string | null
  checkTradingAnswer(t: { makerPct: number; takerPct: number } | null, input: Record<string, unknown>): string | null
  rowDoc(row: Row, input: Record<string, unknown>, me: string | null, now: number): Record<string, unknown>
  answerState(row: Row, c: Check | undefined): string
  tally(rows: Row[], checks: Record<string, Check>): Record<string, number>
  applyPlan(rows: Row[], checks: Record<string, Check>): Plan
  tradingPlan(ex: Array<{ id: string; trading: unknown }>, checks: Record<string, unknown>): { changes: unknown[]; confirmed: string[]; stale: string[] }
  dbMessage(e: unknown): string
  makeStore(o: { db: unknown; me: string | null; now?: () => number; wait?: () => Promise<void> }): {
    saveRow(row: Row, input: Record<string, unknown>): Promise<Saved>
    clearRow(row: Row): Promise<Saved>
    saveTrading(ex: { id: string; trading: unknown }, input: Record<string, unknown>): Promise<Saved>
    saveExchangeNote(id: string, text: string): Promise<Saved>
  }
}
const core = new Function(`${coreSrc}\nreturn FeeCheckCore`)() as Core

const T0 = Date.UTC(2026, 9, 1, 12)
const noWait = async () => {}
const row = (over: Partial<Row> = {}): Row => ({ key: 'binance:usdt:trc20', exchange: 'Binance', coin: 'USDT', network: 'TRC-20', fee: 1, min: 10, ...over })
const check = (r: Row, input: Record<string, unknown>): Check => core.normRowCheck(r.key, core.rowDoc(r, input, 'u_owner', T0))

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

describe('what a person types as an amount', () => {
  it('reads plain decimals and thousands grouping', () => {
    expect(core.parseAmount('0.0005')).toBe(0.0005)
    expect(core.parseAmount(' 2.5 ')).toBe(2.5)
    expect(core.parseAmount('.5')).toBe(0.5)
    expect(core.parseAmount('1,000')).toBe(1000)
    expect(core.parseAmount('50,000,000')).toBe(50_000_000)
    expect(core.parseAmount('')).toBeNull()
  })

  it('never reads a decimal comma as a thousands separator — "0,0005" is not 5', () => {
    expect(core.parseAmount('0,0005')).toBeNaN()
    expect(core.parseAmount('1.000,5')).toBeNaN()
    expect(core.parseAmount('12,50')).toBeNaN()
    expect(core.checkRowAnswer(row(), { result: 'changed', fee: '0,8' })).toMatch(/dot for decimals/)
  })

  it('refuses negatives, exponents and words', () => {
    for (const v of ['-1', '1e-4', 'abc', '1.2.3', '$1']) expect(core.parseAmount(v)).toBeNaN()
  })
})

describe('an answer for a row', () => {
  it('needs an answer to be picked', () => {
    expect(core.checkRowAnswer(row(), {})).toBe('Pick an answer.')
    expect(core.checkRowAnswer(row(), { result: 'unchecked' })).toBe('Pick an answer.')
    expect(core.checkRowAnswer(row(), { result: 'ok' })).toBeNull()
  })

  it('refuses "Different" carrying the table’s own figures — that is a Matches', () => {
    expect(core.checkRowAnswer(row(), { result: 'changed', fee: '1' })).toMatch(/Choose Matches/)
    expect(core.checkRowAnswer(row(), { result: 'changed', fee: '1', min: '10' })).toMatch(/Choose Matches/)
    expect(core.checkRowAnswer(row(), { result: 'changed' })).toMatch(/Type the fee/)
    expect(core.checkRowAnswer(row(), { result: 'changed', fee: '0.8' })).toBeNull()
    expect(core.checkRowAnswer(row(), { result: 'changed', min: '20' })).toBeNull()
  })

  it('records a blank figure as the table’s own value, and what it compared against', () => {
    const doc = core.rowDoc(row(), { result: 'changed', fee: '0.8', note: ' saw 0.8 ' }, 'u_owner', T0)
    expect(doc).toEqual({ result: 'changed', fee: 0.8, min: 10, note: 'saw 0.8', comparedFee: 1, comparedMin: 10, at: new Date(T0).toISOString(), by: 'u_owner' })
    expect(core.rowDoc(row(), { result: 'ok' }, null, T0)).toMatchObject({ result: 'ok', fee: null, min: null, comparedFee: 1, comparedMin: 10 })
  })

  it('normalizes whatever a writer stored, without throwing', () => {
    expect(core.normRowCheck('k', null)).toMatchObject({ key: 'k', result: 'unchecked', fee: null, min: null, note: '' })
    expect(core.normRowCheck('k', { result: 'approved', fee: '1', note: 7 })).toMatchObject({ result: 'unchecked', fee: null, note: '' })
    expect(core.normRowCheck('k', { result: 'toString' }).result).toBe('unchecked') // own properties only
  })
})

describe('an answer read against the table as it is now', () => {
  it('is current while the table still says what it was compared against', () => {
    expect(core.answerState(row(), check(row(), { result: 'ok' }))).toBe('current')
    expect(core.answerState(row(), undefined)).toBe('unchecked')
  })

  it('is out of date once the table moves anywhere but to the answer', () => {
    const c = check(row(), { result: 'ok' })
    expect(core.answerState(row({ fee: 0.5 }), c)).toBe('stale')
    expect(core.answerState(row({ min: 5 }), c)).toBe('stale')
  })

  it('reads as applied when the table moved TO the answer', () => {
    const c = check(row(), { result: 'changed', fee: '0.8' })
    expect(core.answerState(row({ fee: 0.8 }), c)).toBe('applied')
    expect(core.answerState(row({ fee: 0.7 }), c)).toBe('stale')
  })

  it('counts "can’t see it" as answered but never as settling the row', () => {
    const rows = [row({ key: 'a' }), row({ key: 'b' }), row({ key: 'c' }), row({ key: 'd', fee: 2 })]
    const checks = {
      a: check(rows[0], { result: 'ok' }),
      b: check(rows[1], { result: 'cant-see' }),
      d: check(row({ key: 'd' }), { result: 'ok' }), // compared against fee 1; the table now says 2
    }
    expect(core.tally(rows, checks)).toMatchObject({ total: 4, answered: 2, settled: 1, stale: 1, ok: 1, 'cant-see': 1 })
  })
})

describe('the plan the session applies', () => {
  const rows = [
    row({ key: 'binance:usdt:trc20' }),
    row({ key: 'binance:usdt:erc20', network: 'ERC-20', fee: 3.5, min: 20 }),
    row({ key: 'binance:btc:bitcoin', coin: 'BTC', network: 'Bitcoin', fee: 0.0002, min: 0.001 }),
    row({ key: 'kraken:usdt:erc20', exchange: 'Kraken', network: 'ERC-20', fee: 2.5, min: 5 }),
    row({ key: 'kraken:usdc:erc20', exchange: 'Kraken', coin: 'USDC', network: 'ERC-20', fee: 2, min: 5 }),
    row({ key: 'okx:usdt:trc20', exchange: 'OKX' }),
  ]
  const at = (k: string) => rows.find((r) => r.key === k)!
  const checks: Record<string, Check> = {
    'binance:usdt:trc20': check(at('binance:usdt:trc20'), { result: 'ok', note: 'flat' }),
    'binance:usdt:erc20': check(at('binance:usdt:erc20'), { result: 'changed', fee: '1.5' }),
    'binance:btc:bitcoin': check(at('binance:btc:bitcoin'), { result: 'changed', min: '0.0005' }),
    'kraken:usdt:erc20': check(row({ key: 'kraken:usdt:erc20', fee: 3, min: 5 }), { result: 'changed', fee: '2' }), // answered against 3; table now 2.5
    'kraken:usdc:erc20': check(at('kraken:usdc:erc20'), { result: 'not-offered' }),
    'okx:usdt:trc20': check(at('okx:usdt:trc20'), { result: 'cant-see' }),
  }
  const plan = core.applyPlan(rows, checks)

  it('writes fee-apply’s worksheet columns, header first, changed fees only', () => {
    const lines = plan.csv.trim().split('\n')
    expect(lines[0]).toBe(core.APPLY_COLUMNS.map((c) => (c.includes(',') ? `"${c}"` : c)).join(','))
    expect(lines.slice(1)).toEqual(['Binance,USDT,ERC-20,3.5,1.5,changed'])
    expect(plan.feeChanges).toEqual([{ key: 'binance:usdt:erc20', from: 3.5, to: 1.5 }])
  })

  it('puts the table’s CURRENT fee in "Current fee", so fee-apply’s guard compares like with like', () => {
    expect(plan.csv).toContain(',3.5,1.5,')
  })

  it('never plans an answer given against older figures', () => {
    expect(plan.stale).toEqual(['kraken:usdt:erc20'])
    expect(plan.csv).not.toContain('Kraken')
  })

  it('lists what fee-apply cannot do for a hand edit', () => {
    expect(plan.minChanges).toEqual([{ key: 'binance:btc:bitcoin', from: 0.001, to: 0.0005 }])
    expect(plan.notOffered).toEqual(['kraken:usdc:erc20'])
    expect(plan.cantSee).toEqual(['okx:usdt:trc20'])
    expect(plan.confirmed).toEqual(['binance:usdt:trc20'])
    expect(plan.notes).toEqual([{ key: 'binance:usdt:trc20', note: 'flat' }])
  })

  it('names exactly the columns apply-fee-updates.ts looks up', () => {
    const apply = read('scripts/apply-fee-updates.ts')
    const lookup = apply.match(/\[('Exchange'[^\]]+)\]\.map\(col\)/)
    expect(lookup, 'fee-apply no longer resolves its columns by name').not.toBeNull()
    const names = [...lookup![1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(names).toEqual(core.APPLY_COLUMNS)
  })
})

describe('trading-fee answers', () => {
  it('need both rates, in percent, and are never a Matches for a fee the table lacks', () => {
    const t = { makerPct: 0.1, takerPct: 0.2 }
    expect(core.checkTradingAnswer(t, { result: 'changed', maker: '0' })).toMatch(/both/)
    expect(core.checkTradingAnswer(t, { result: 'changed', maker: '0.1', taker: '0.2' })).toMatch(/Choose Matches/)
    expect(core.checkTradingAnswer(t, { result: 'changed', maker: '25', taker: '0.1' })).toMatch(/percent/)
    expect(core.checkTradingAnswer(t, { result: 'changed', maker: '0', taker: '0' })).toBeNull()
    expect(core.checkTradingAnswer(null, { result: 'ok' })).toMatch(/no trading fee/)
  })

  it('plans only current answers', () => {
    const plan = core.tradingPlan(
      [{ id: 'bitfinex', trading: { makerPct: 0.1, takerPct: 0.2 } }, { id: 'gemini', trading: { makerPct: 0.2, takerPct: 0.4 } }],
      {
        bitfinex: core.normTradingCheck('bitfinex', { result: 'changed', maker: 0, taker: 0, comparedMaker: 0.1, comparedTaker: 0.2 }),
        gemini: core.normTradingCheck('gemini', { result: 'ok', comparedMaker: 0.25, comparedTaker: 0.4 }),
      },
    )
    expect(plan.changes).toEqual([{ exchangeId: 'bitfinex', from: { maker: 0.1, taker: 0.2 }, to: { maker: 0, taker: 0 } }])
    expect(plan.stale).toEqual(['gemini'])
  })
})

describe('the store', () => {
  it('writes one document per row and never deletes — Clear stores "unchecked"', async () => {
    const db = fakeDb()
    const store = core.makeStore({ db, me: 'u_owner', now: () => T0, wait: noWait })
    expect((await store.saveRow(row(), { result: 'ok' })).error).toBeNull()
    await store.clearRow(row())
    await store.saveTrading({ id: 'binance', trading: { makerPct: 0.1, takerPct: 0.1 } }, { result: 'ok' })
    await store.saveExchangeNote('binance', 'fee page needs a login')
    expect(db.calls).toEqual(['set checks/binance:usdt:trc20', 'set checks/binance:usdt:trc20', 'set trading/binance', 'set notes/binance'])
    expect(db.docs.get('checks/binance:usdt:trc20')).toMatchObject({ result: 'unchecked', comparedFee: 1 })
    expect(db.calls.some((c) => c.startsWith('delete'))).toBe(false)
  })

  it('writes nothing for an answer it refuses', async () => {
    const db = fakeDb()
    const store = core.makeStore({ db, me: null, now: () => T0, wait: noWait })
    expect((await store.saveRow(row(), { result: 'changed', fee: '1' })).error).toMatch(/Choose Matches/)
    expect(db.calls).toEqual([])
  })

  it('retries once on a transient failure, then gives up loudly', async () => {
    const once = fakeDb(['unavailable'])
    await core.makeStore({ db: once, me: null, now: () => T0, wait: noWait }).saveRow(row(), { result: 'ok' })
    expect(once.calls).toHaveLength(2)
    const twice = fakeDb(['unavailable', 'unavailable'])
    await expect(core.makeStore({ db: twice, me: null, now: () => T0, wait: noWait }).saveRow(row(), { result: 'ok' })).rejects.toMatchObject({ code: 'unavailable' })
    const refused = fakeDb(['invalid_argument'])
    await expect(core.makeStore({ db: refused, me: null, now: () => T0, wait: noWait }).saveRow(row(), { result: 'ok' })).rejects.toMatchObject({ code: 'invalid_argument' })
    expect(refused.calls).toHaveLength(1)
    expect(core.dbMessage({ code: 'invalid_argument' })).toMatch(/owner and editors/)
  })

  it('has no delete path anywhere in the page’s code', () => {
    for (const src of [coreSrc, clientSrc]) {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      expect(code).not.toMatch(/\.delete\s*\(/)
    }
  })
})

describe('the page’s data, from the real table', () => {
  const rows = feeRows(EXCHANGES)
  const ledger = JSON.parse(readFileSync(join(ROOT, '..', 'docs/audits/task-queue-2026-09-07.json'), 'utf8')) as { outstanding: LedgerItem[] }
  const feedIds = WITHDRAW_FEE_SOURCES.map((s) => s.exchangeId)
  const prohibitedName = (url: string) => {
    const h = hostOf(url)
    const e = h ? matchTermsEntry(h) : null
    return e && e.verdict === 'prohibited' ? e.name : null
  }
  const data = buildFeeCheckData({
    rows,
    exchanges: EXCHANGES.map((e) => ({ id: e.id, name: e.name, tier: e.tier })),
    trading: SPOT_TRADING_FEES,
    feedIds,
    prohibitedName,
    ledgerItems: ledger.outstanding,
    lastVerified: '2025-06-01',
    ageDays: 487,
    tradingCompiled: '2026-08-20',
    generatedOn: '2026-10-01',
  })
  const pageRows = data.exchanges.flatMap((e) => e.rows)

  it('carries every row of the table exactly once', () => {
    expect(pageRows).toHaveLength(rows.length)
    expect(new Set(pageRows.map((r) => r.key)).size).toBe(rows.length)
    expect(data.table.rows).toBe(rows.length)
    expect(data.exchanges.map((e) => e.id).sort()).toEqual(EXCHANGES.map((e) => e.id).sort())
  })

  it('starts with the highest-impact rows only a person can check — none on a feed exchange', () => {
    const human = rows.filter((r) => !feedIds.includes(r.exchangeId)).sort(byImpact)
    const expected = human.slice(0, CORE_N).map((r) => r.key).sort()
    expect(pageRows.filter((r) => r.core).map((r) => r.key).sort()).toEqual(expected)
    expect(data.coreCount).toBe(Math.min(CORE_N, human.length))
  })

  it('marks the feed exchanges from the adapter list and puts them last', () => {
    expect(data.exchanges.filter((e) => e.feed).map((e) => e.id).sort()).toEqual([...new Set(feedIds)].sort())
    const firstFeed = data.exchanges.findIndex((e) => e.feed)
    expect(data.exchanges.slice(firstFeed).every((e) => e.feed)).toBe(true)
  })

  it('flags an exchange whose fee-page host the source-terms register prohibits', () => {
    for (const e of data.exchanges) expect(e.prohibited).toBe(e.feePage ? prohibitedName(e.feePage) : null)
    // Guards the guard: the lookup finds one today (OKX, D40), so it is not silently matching nothing.
    expect(data.exchanges.filter((e) => e.prohibited).map((e) => e.id)).toContain('okx')
  })

  it('takes leads only from open ledger items on the fee-refresh audit, never the items it works', () => {
    const all = [...data.generalLeads, ...data.exchanges.flatMap((e) => e.leads)]
    expect(all.length).toBeGreaterThan(0)
    const byId = new Map(ledger.outstanding.map((i) => [i.id, i]))
    for (const l of all) {
      expect(byId.get(l.id)?.status).not.toBe('closed')
      expect(FEE_CHECK_SERVES as readonly string[]).not.toContain(l.id)
    }
    for (const e of data.exchanges) for (const l of e.leads) expect(namesExchange(l.title, e)).toBe(true)
  })

  it('keeps display names fee-apply can resolve back to exactly one id', () => {
    const uniq = (xs: string[]) => new Set(xs).size === xs.length
    expect(uniq(EXCHANGES.map((e) => e.name.toLowerCase()))).toBe(true)
    expect(uniq(Object.values(COIN_INFO).map((c) => c.symbol.toUpperCase()))).toBe(true)
    expect(uniq(Object.values(NETWORKS).map((n) => n.shortName.toLowerCase()))).toBe(true)
  })
})

describe('leads, from a small ledger', () => {
  const exchanges = [{ id: 'htx', name: 'HTX (Huobi)' }, { id: 'gateio', name: 'Gate.io' }, { id: 'bitget', name: 'Bitget' }, { id: 'bitfinex', name: 'Bitfinex' }]
  const src = [{ file: 'docs/audits/fee-refresh-2026-08-20.md' }]
  const items: LedgerItem[] = [
    { id: 'T-1', title: 'Re-check HTX withdrawal fees', status: 'parked', sources: src },
    { id: 'T-2', title: 'Re-check Gate.io fee section', status: 'open', sources: src },
    { id: 'T-3', title: 'Re-check Bitfinex trading fees', status: 'closed', sources: src },
    { id: 'T-4', title: 'Check MATIC→POL migration across exchange rows', status: 'parked', sources: src },
    { id: 'T-5', title: 'Re-check Bitget fees', status: 'open', sources: [{ file: 'docs/other.md' }] },
    { id: 'T-031', title: 'Manual withdrawal-fee worksheet pass', status: 'open', sources: src },
  ]
  const { byExchange, general } = feeLeads(items, exchanges)

  it('attaches by name, drops closed items, items on other audits and the items the page works', () => {
    expect(byExchange.htx?.map((l) => l.id)).toEqual(['T-1'])
    expect(byExchange.gateio?.map((l) => l.id)).toEqual(['T-2'])
    expect(byExchange.bitfinex).toBeUndefined()
    expect(byExchange.bitget).toBeUndefined()
    expect(general.map((l) => l.id)).toEqual(['T-4'])
  })

  it('matches whole names only', () => {
    expect(namesExchange('Re-check Bitget fees', { id: 'bitfinex', name: 'Bitfinex' })).toBe(false)
    expect(namesExchange('Gate.io update', { id: 'gateio', name: 'Gate.io' })).toBe(true)
    expect(namesExchange('Gateaio update', { id: 'gateio', name: 'Gate.io' })).toBe(false)
  })
})

describe('the published page', () => {
  const fixture = {
    generatedOn: '2026-10-01',
    serves: ['T-031', 'T-036'],
    table: { lastVerified: '2025-06-01', ageDays: 487, rows: 1, tradingCompiled: '2026-08-20' },
    coreCount: 1,
    generalLeads: [],
    exchanges: [{
      id: 'binance', name: 'Binance', tier: 1, feePage: FEE_PAGES.binance, feed: false, prohibited: null,
      trading: { makerPct: 0.1, takerPct: 0.1, note: '' }, leads: [],
      rows: [{ key: 'binance:usdt:trc20', coin: 'USDT', coinName: 'Tether', network: 'TRC-20', fee: 1, min: 10, withdraw: true, deposit: true, note: 'a </script><script>alert(1)</script> note', core: true, impact: 300 }],
    }],
  }
  const html = buildFeeCheckPage(fixture)

  it('declares only db, with writes raised to editors, and user', () => {
    expect(FEE_CHECK_CAPABILITIES).toEqual({ db: { rules: [{ path: '', write: 'admin' }] }, user: {} })
  })

  it('is named, and loads no script from anywhere', () => {
    expect(html.startsWith(`<title>${FEE_CHECK_TITLE}</title>`)).toBe(true)
    expect(html).not.toMatch(/<script[^>]+src=/)
  })

  it('embeds the data so no row text can close the script element', () => {
    const block = html.slice(html.indexOf('id="fc-data">'), html.indexOf('</script>', html.indexOf('id="fc-data">')))
    expect(block).not.toContain('<')
    const json = block.slice('id="fc-data">'.length)
    expect(JSON.parse(json).exchanges[0].rows[0].note).toBe(fixture.exchanges[0].rows[0].note)
    expect(dataJson({ s: ' ' })).toBe('{"s":"\\u2028"}')
  })

  it('never builds markup from text, and reads nothing off window.claude but use()', () => {
    const code = clientSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/)
    expect(code).toMatch(/var runtime = window\.claude\b/)
    const members = [...code.matchAll(/\bruntime\.(\w+)/g)].map((m) => m[1])
    expect(new Set(members)).toEqual(new Set(['use']))
    expect(code).not.toMatch(/window\.claude\.\w+/)
  })
})

describe('the two outputs of one row list', () => {
  it('the CSV worksheet takes its rows, ranking, links and core cut from the shared module', () => {
    const ws = read('scripts/gen-transfer-fee-worksheet.ts')
    expect(ws).toMatch(/from '\.\/lib\/transferFeeRows'/)
    expect(ws).not.toMatch(/const FEE_PAGES|function impactScore|const CORE_N|COIN_WEIGHT/)
  })

  it('neither the page generator nor the plan writes anything but its own output', () => {
    for (const f of ['scripts/gen-fee-check-page.ts', 'scripts/fee-check-plan.ts']) {
      const src = read(f)
      const writes = [...src.matchAll(/writeFileSync\(([^,]+),/g)].map((m) => m[1].trim())
      expect(writes.length, f).toBeGreaterThan(0)
      for (const w of writes) expect(w, f).toMatch(/^resolve\((out|csvOut)\)$/)
      expect(src, f).not.toMatch(/TRANSFER_FEES_LAST_VERIFIED\s*=/)
    }
  })
})
