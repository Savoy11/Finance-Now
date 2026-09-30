import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  WORKSPACE_CAPABILITIES, itemsJson, workspaceItemSlot, workspaceScripts, workspaceSection,
  addedSection, itemsAddedSince,
} from '../../../../scripts/lib/ledgerWorkspace.mjs'

/**
 * The shared workspace on the published Finance Now Ledger page (2026-09-27).
 *
 * The ledger page is regenerated from the repository JSON, so uploads and confirmations
 * live in the artifact's runtime storage (db + assets) rather than in the HTML. Every
 * decision the page makes, and every write, is in ledgerWorkspace.core.js, which these
 * tests RUN against fake stores — a pre-merge review found the first version's tests only
 * pattern-matched source text and could not fail when behaviour broke. The owner's rules
 * they hold: nothing is ever deleted, other people's text never reaches the page as
 * markup, and one bad row cannot blank the workspace for everyone.
 */
const lib = join(process.cwd(), 'scripts/lib')
const coreSrc = readFileSync(join(lib, 'ledgerWorkspace.core.js'), 'utf8')
const clientSrc = readFileSync(join(lib, 'ledgerWorkspace.client.js'), 'utf8')
const generator = readFileSync(join(process.cwd(), 'scripts/check-queue-ledger.mjs'), 'utf8')

type Row = Record<string, unknown>
type Entry = { id: string; itemId: string; kind: string; text: string; docIds: string[]; by: string | null; at: string; ord: number | null }
type Doc = { id: string; name: string; contentType: string; sizeBytes: number | null; kind: string; itemIds: string[]; note: string; uploadedBy: string | null; uploadedAt: string; archived: boolean }
type FakeFile = { name: string; size: number; type: string }
type Upload = { ids: string[]; error: string | null; refused?: boolean }
type Added = {
  id: string; title: string; detail: string; role: string; source: string; by: string | null; at: string; ord: number | null
  state: string; filedAs: string; stateNote: string; stateBy: string | null; stateAt: string
}
type Store = {
  uploadFiles(files: FakeFile[], meta: Row, onProgress?: (name: string) => void): Promise<Upload>
  addLog(itemId: string, kind: string, text: string, docIds: unknown, seen: Entry[]): Promise<Entry>
  setArchived(id: string, archived: boolean): Promise<void>
  addItem(fields: Row, seen: Added[]): Promise<{ row: Row | null; error: string | null }>
  setItemState(id: string, state: string, filedAs: string, note: string): Promise<{ error: string | null }>
}
type Core = {
  MB: number
  TYPE_BY_EXT: Record<string, string>
  normDoc(id: string, x: unknown): Doc
  normLog(id: string, x: unknown): Entry
  orderOf(e: Entry): number
  nextOrd(seen: Entry[], now: number): number
  stateOf(entries: Entry[]): Entry | null
  awaitingLedger(item: { status: string }, state: Entry | null): boolean
  chipText(item: { status: string }, state: Entry | null, nDocs: number): string
  typeFor(name: string, type: string): string | null
  checkFiles(files: FakeFile[]): { ok: boolean; error?: string }
  dbMessage(e: unknown): string
  makeStore(opts: { db: unknown; assets: unknown; me: string | null; now?: () => number; wait?: () => Promise<void> }): Store
  normAdded(id: string, x: unknown): Added
  checkNewItem(f: unknown): string | null
  checkStateChange(state: string, filedAs: string, note: string): string | null
}
const core = new Function(`${coreSrc}\nreturn LedgerWorkspaceCore`)() as Core

// ── fakes ──────────────────────────────────────────────────────────────────────
/** A db whose every verb is recorded, `delete` included, with scripted failures per verb. */
function fakeDb() {
  const calls: string[] = []
  const rows = new Map<string, Row>()
  const fail: Record<string, string[]> = {}
  let minted = 0
  const trip = (verb: string) => { const code = fail[verb]?.shift(); if (code) throw { code, message: code } }
  const ref = (path: string) => ({
    set: async (data: Row) => { calls.push(`set ${path}`); trip('set'); rows.set(path, data) },
    update: async (data: Row) => {
      calls.push(`update ${path}`); trip('update')
      if (!rows.has(path)) throw { code: 'invalid_argument', message: 'no such document' }
      rows.set(path, { ...rows.get(path), ...data })
    },
    delete: async () => { calls.push(`delete ${path}`) },
  })
  return {
    calls, rows, fail,
    collection: (name: string) => ({
      doc: (id?: string) => ref(`${name}/${id ?? `auto${++minted}`}`),
      add: async (data: Row) => { calls.push(`add ${name}`); rows.set(`${name}/auto${++minted}`, data) },
      delete: async () => { calls.push(`delete ${name}`) },
    }),
  }
}
function fakeAssets(codes: (string | null)[] = []) {
  const calls: string[] = []
  let n = 0
  return {
    calls,
    upload: async (f: FakeFile, o: { type: string }) => {
      calls.push(`upload ${f.name}`)
      const code = codes.shift()
      if (code) throw { code, message: code }
      n++
      return { id: `a${n}`, url: `/_blob/a${n}`, sizeBytes: f.size, contentType: o.type }
    },
    delete: async (id: string) => { calls.push(`delete ${id}`) },
  }
}
const noWait = async () => {}
const T0 = Date.UTC(2026, 8, 27, 12)
function storeWith(db = fakeDb(), assets = fakeAssets(), me: string | null = 'user_7f3a') {
  return { db, assets, store: core.makeStore({ db, assets, me, now: () => T0, wait: noWait }) }
}
const pdf = (name = 'evidence.pdf', size = 2048): FakeFile => ({ name, size, type: 'application/pdf' })
const entry = (over: Partial<Entry>): Entry => core.normLog(over.id ?? 'e', { itemId: 'T-1', ...over })

// ── the page ───────────────────────────────────────────────────────────────────
describe('the page can carry the workspace', () => {
  it('declares exactly db (writes raised to editors), assets and user with profile names', () => {
    expect(WORKSPACE_CAPABILITIES).toEqual({
      db: { rules: [{ path: '', write: 'admin' }] },
      assets: {},
      user: { scopes: ['profile'] },
    })
  })

  it('reads nothing off window.claude but use()', () => {
    expect(clientSrc).toMatch(/var c = window\.claude/)
    const members = [...clientSrc.matchAll(/\bc\.(\w+)/g)].map((m) => m[1])
    expect(new Set(members)).toEqual(new Set(['use']))
    expect(clientSrc).not.toMatch(/window\.claude\.(?!use\b)\w+/)
  })

  it('the generator places the section, a slot per item, the styles and the scripts', () => {
    expect(generator).toMatch(/import \{ WORKSPACE_CSS, workspaceSection, workspaceItemSlot, workspaceScripts, addedSection, itemsAddedSince \} from '\.\/lib\/ledgerWorkspace\.mjs'/)
    // The section names the JSON a closure is filed in, which differs per ledger (FN, NC).
    expect(generator).toMatch(/\$\{workspaceSection\(sourceLabel\)\}/)
    expect(workspaceSection('docs/audits/nc-task-queue-2026-09-28.json')).toMatch(/edits <code>docs\/audits\/nc-task-queue-2026-09-28\.json<\/code>/)
    expect(workspaceSection()).toMatch(/edits <code>docs\/audits\/task-queue-2026-09-07\.json<\/code>/)
    expect(generator).toMatch(/\$\{workspaceItemSlot\(i\.id\)\}/)
    expect(generator).toMatch(/\$\{WORKSPACE_CSS\}/)
    expect(generator).toMatch(/\$\{workspaceScripts\(items\)\}/)
    expect(generator).toMatch(/data-id="\$\{esc\(i\.id\)\}"/)
  })

  it('another ledger keeps its own filters, footer and source-terms registry', () => {
    // Filters are remembered under the ledger's own key (fnl, ncl…), never a shared one.
    expect(generator).not.toMatch(/'fnl\.filters'/)
    expect(generator.match(/localStorage\.(?:set|get)Item\('\$\{STORE_KEY\}'/g)).toHaveLength(2)
    // C8 reads the registry of the repository the ledger belongs to; Finance Now's is required.
    expect(generator).toMatch(/const REG = path\.join\(ROOT, 'frontend\/src\/lib\/server\/sourceTerms\.ts'\)/)
    expect(generator).toMatch(/isDefaultQueue \|\| fs\.existsSync\(REG\) \? fs\.readFileSync\(REG, 'utf8'\) : ''/)
    expect(generator).toMatch(/<footer>\$\{footerLead\} /)
  })
})

describe('without the workspace, the ledger still renders', () => {
  /** Run the page's inlined script against a stub document and return the connection message. */
  async function connMessage(claude: unknown, edit: (body: string) => string = (b) => b) {
    const html = workspaceScripts([{ id: 'T-1', title: 't', status: 'open' }])
    const body = edit(html.slice(html.indexOf('<script>\n') + 9, html.lastIndexOf('\n</script>')))
    const nodes: Record<string, { textContent: string; className: string; hidden: boolean }> = {}
    const document = {
      getElementById: (id: string) => (nodes[id] ??= { textContent: id === 'ws-items' ? '[]' : '', className: '', hidden: true }),
      addEventListener: () => {},
      querySelectorAll: () => [],
    }
    new Function('window', 'document', body)({ claude }, document)
    await new Promise((r) => setTimeout(r, 0))
    return { conn: nodes['ws-conn'], live: nodes['ws-live'] }
  }

  it('a copy opened outside claude.ai says so and draws nothing else', async () => {
    const { conn, live } = await connMessage(undefined)
    expect(conn.textContent).toMatch(/no workspace storage/)
    expect(conn.className).toBe('ws-status err')
    expect(live).toBeUndefined()
  })

  it('a view where db resolves null says so and draws nothing else', async () => {
    const { conn, live } = await connMessage({ use: async () => null })
    expect(conn.textContent).toMatch(/not available in this view/)
    expect(live).toBeUndefined()
  })

  it('the wrapper alone keeps the two files apart (the first build threw on load without it)', async () => {
    let edited = false
    const { conn } = await connMessage(undefined, (b) => {
      const out = b.replace('})(); // the semicolon matters', '})() // the semicolon matters')
      edited = out !== b
      return out
    })
    expect(edited).toBe(true)
    expect(conn.textContent).toMatch(/no workspace storage/)
  })

  it('the inlined page keeps the core private: one wrapper, core first, no page global', () => {
    const html = workspaceScripts([])
    expect(html.indexOf(coreSrc)).toBeGreaterThan(-1)
    expect(html.indexOf(coreSrc)).toBeLessThan(html.indexOf(clientSrc))
    expect(html).toMatch(/<script>\n\(function \(\) \{\n/)
    expect(clientSrc.trimEnd().endsWith('})(LedgerWorkspaceCore)')).toBe(true)
  })
})

// ── rows ───────────────────────────────────────────────────────────────────────
describe('one malformed row cannot break the workspace', () => {
  it('a docs row with wrong types becomes a safe row; the snapshot id wins over a stored one', () => {
    const d = core.normDoc('a9', {
      id: 'forged', itemIds: 'T-069', name: { toString: 1 }, kind: 'toString', sizeBytes: '12',
      archived: 'yes', uploadedBy: 42, note: ['x'], contentType: null,
    })
    expect(d).toEqual({
      id: 'a9', name: 'Untitled', contentType: '', sizeBytes: null, kind: 'other', itemIds: [],
      note: '', uploadedBy: null, uploadedAt: '', archived: false,
    })
  })

  it('a log row with wrong types becomes a safe row', () => {
    const l = core.normLog('l1', { itemId: ['T-1'], kind: 'constructor', text: 7, docIds: 'a1', by: {}, at: 5, ord: 'NaN' })
    expect(l).toEqual({ id: 'l1', itemId: '', kind: 'note', text: '', docIds: [], by: null, at: '', ord: null })
    expect(core.normLog('l2', { ord: Infinity }).ord).toBeNull()
  })

  it('a missing body is a row, not a crash', () => {
    expect(core.normDoc('a1', undefined).name).toBe('Untitled')
    expect(core.normLog('l1', null).kind).toBe('note')
  })

  it('arrays keep only non-empty strings', () => {
    expect(core.normDoc('a1', { itemIds: ['T-1', 3, '', null, 'T-2'] }).itemIds).toEqual(['T-1', 'T-2'])
  })

  it('well-formed rows pass through unchanged', () => {
    const row = { name: 'fees.csv', contentType: 'text/csv', sizeBytes: 900, kind: 'evidence', itemIds: ['T-411'], note: 'n', uploadedBy: 'u1', uploadedAt: '2026-09-27T12:00:00.000Z', archived: true }
    expect(core.normDoc('a1', row)).toEqual({ id: 'a1', ...row })
  })
})

// ── state ──────────────────────────────────────────────────────────────────────
describe("an item's workspace state", () => {
  it('a later progress note does not un-confirm an item', () => {
    const s = core.stateOf([entry({ id: 'p', kind: 'progress', ord: 30 }), entry({ id: 'c', kind: 'confirmed', ord: 20 })])
    expect(s?.id).toBe('c')
  })

  it('a later decision replaces an earlier one, whichever way round', () => {
    expect(core.stateOf([entry({ id: 'c', kind: 'confirmed', ord: 20 }), entry({ id: 'r', kind: 'reopened', ord: 25 })])?.id).toBe('r')
    expect(core.stateOf([entry({ id: 'r', kind: 'reopened', ord: 25 }), entry({ id: 'c', kind: 'confirmed', ord: 40 })])?.id).toBe('c')
  })

  it('with no decision, the latest progress note is the state; notes never are', () => {
    expect(core.stateOf([entry({ id: 'p1', kind: 'progress', ord: 1 }), entry({ id: 'p2', kind: 'progress', ord: 2 })])?.id).toBe('p2')
    expect(core.stateOf([entry({ id: 'n', kind: 'note', ord: 9 })])).toBeNull()
    expect(core.stateOf([])).toBeNull()
  })

  it('order is independent of the order rows arrive in', () => {
    const a = entry({ id: 'c', kind: 'confirmed', ord: 20 }), b = entry({ id: 'r', kind: 'reopened', ord: 25 })
    expect(core.stateOf([a, b])?.id).toBe(core.stateOf([b, a])?.id)
  })

  it('a row dated in the future cannot pin the state: the next entry is ordered after it', () => {
    const future = entry({ id: 'c', kind: 'confirmed', at: '2099-01-01T00:00:00.000Z' })
    const ord = core.nextOrd([future], T0)
    expect(ord).toBeGreaterThan(core.orderOf(future))
    expect(core.stateOf([future, entry({ id: 'r', kind: 'reopened', ord })])?.id).toBe('r')
  })

  it('a row without ord falls back to its timestamp; an unreadable one sorts first', () => {
    expect(core.orderOf(entry({ at: '2026-09-27T12:00:00.000Z' }))).toBe(T0)
    expect(core.orderOf(entry({ at: 'not a date' }))).toBe(0)
  })

  it('the ledger-pending list is exactly the disagreements', () => {
    const c = entry({ kind: 'confirmed', ord: 1 }), r = entry({ kind: 'reopened', ord: 1 }), p = entry({ kind: 'progress', ord: 1 })
    expect(core.awaitingLedger({ status: 'open' }, c)).toBe(true)
    expect(core.awaitingLedger({ status: 'closed' }, c)).toBe(false)
    expect(core.awaitingLedger({ status: 'closed' }, r)).toBe(true)
    expect(core.awaitingLedger({ status: 'open' }, r)).toBe(false)
    expect(core.awaitingLedger({ status: 'open' }, p)).toBe(false)
    expect(core.awaitingLedger({ status: 'open' }, null)).toBe(false)
  })

  it('a confirmation records intent: the chip says the ledger is still pending until it closes', () => {
    const c = entry({ kind: 'confirmed', ord: 1 })
    expect(core.chipText({ status: 'open' }, c, 2)).toBe('Confirmed · ledger pending · 2 docs')
    expect(core.chipText({ status: 'closed' }, c, 1)).toBe('Confirmed · 1 doc')
    expect(core.chipText({ status: 'open' }, null, 0)).toBe('')
    expect(workspaceSection()).toMatch(/ledger pending/)
  })
})

// ── uploads ────────────────────────────────────────────────────────────────────
describe('uploads', () => {
  it('checks every file before sending any: one bad file means none are stored', async () => {
    const { db, assets, store } = storeWith()
    const r = await store.uploadFiles([pdf('a.pdf'), { name: 'memo.docx', size: 10, type: '' }], { itemIds: ['T-1'], kind: 'evidence' })
    expect(r.ids).toEqual([])
    expect(r.error).toMatch(/memo\.docx is not a supported type\. Export Word or Excel/)
    expect(assets.calls).toEqual([])
    expect(db.calls).toEqual([])
  })

  it('an empty file is reported as empty', () => {
    expect(core.checkFiles([{ name: 'blank.txt', size: 0, type: 'text/plain' }]).error).toBe('blank.txt is empty.')
    expect(core.checkFiles([]).error).toBe('Choose at least one file.')
  })

  it('enforces 20 MB, and 2 MB for SVG, before uploading', () => {
    const MB = core.MB
    expect(core.checkFiles([pdf('ok.pdf', 20 * MB)]).ok).toBe(true)
    expect(core.checkFiles([pdf('big.pdf', 20 * MB + 1)]).error).toMatch(/big\.pdf is over the size limit/)
    expect(core.checkFiles([{ name: 'd.svg', size: 2 * MB + 1, type: 'image/svg+xml' }]).ok).toBe(false)
    expect(core.checkFiles([{ name: 'd.svg', size: 2 * MB, type: 'image/svg+xml' }]).ok).toBe(true)
  })

  it('accepts the asset store closed set by type or extension, and not Word or Excel', () => {
    expect(core.typeFor('notes.md', '')).toBe('text/markdown')
    expect(core.typeFor('scan', 'image/png')).toBe('image/png')
    expect(core.typeFor('x.toString', '')).toBeNull()
    for (const ext of ['docx', 'xlsx', 'doc', 'xls']) expect(core.typeFor(`f.${ext}`, '')).toBeNull()
    expect(Object.keys(core.TYPE_BY_EXT).sort()).toEqual(
      ['csv', 'gif', 'jpeg', 'jpg', 'json', 'log', 'markdown', 'md', 'mp4', 'pdf', 'png', 'svg', 'txt', 'webm', 'webp'])
    expect(workspaceSection()).toMatch(/Word and Excel files need exporting to PDF or CSV first/)
  })

  it('stores one docs row per file, keyed by the asset id, naming the uploader by id only', async () => {
    const { db, store } = storeWith()
    const r = await store.uploadFiles([pdf('a.pdf', 10)], { itemIds: ['T-1', 5], kind: 'toString', note: 'n' })
    expect(r).toEqual({ ids: ['a1'], error: null })
    expect(db.rows.get('docs/a1')).toEqual({
      name: 'a.pdf', contentType: 'application/pdf', sizeBytes: 10, kind: 'other', itemIds: ['T-1'],
      note: 'n', uploadedBy: 'user_7f3a', uploadedAt: new Date(T0).toISOString(), archived: false,
    })
  })

  it('retries store_unavailable exactly once, and no other code', async () => {
    const once = storeWith(fakeDb(), fakeAssets(['store_unavailable']))
    expect((await once.store.uploadFiles([pdf()], {})).ids).toEqual(['a1'])
    expect(once.assets.calls).toHaveLength(2)

    const twice = storeWith(fakeDb(), fakeAssets(['store_unavailable', 'store_unavailable']))
    expect((await twice.store.uploadFiles([pdf()], {})).error).toMatch(/failed \(store_unavailable\)/)
    expect(twice.assets.calls).toHaveLength(2)

    const other = storeWith(fakeDb(), fakeAssets(['rate_limited']))
    expect((await other.store.uploadFiles([pdf()], {})).error).toMatch(/Too many uploads/)
    expect(other.assets.calls).toHaveLength(1)
  })

  it('a failure part-way returns the files that did store, and sends nothing after it', async () => {
    const { db, assets, store } = storeWith(fakeDb(), fakeAssets([null, 'invalid_request']))
    const r = await store.uploadFiles([pdf('1.pdf'), pdf('2.txt'), pdf('3.pdf')], { itemIds: ['T-1'] })
    expect(r.ids).toEqual(['a1'])
    expect(r.error).toMatch(/2\.txt could not be stored\. A text file must be UTF-8/)
    expect(assets.calls).toEqual(['upload 1.pdf', 'upload 2.txt'])
    expect([...db.rows.keys()]).toEqual(['docs/a1'])
  })

  it('retries a docs write once on unavailable; a refused write is flagged as refused', async () => {
    const flaky = fakeDb(); flaky.fail.set = ['unavailable']
    const a = storeWith(flaky)
    expect((await a.store.uploadFiles([pdf()], {})).ids).toEqual(['a1'])
    expect(flaky.calls).toEqual(['set docs/a1', 'set docs/a1'])

    const locked = fakeDb(); locked.fail.set = ['invalid_argument']
    const r = await storeWith(locked).store.uploadFiles([pdf()], {})
    expect(r).toMatchObject({ ids: [], refused: true })
    expect(r.error).toMatch(/was stored but could not be listed\. Your change was refused/)
  })

  it('without assets, nothing is attempted', async () => {
    const db = fakeDb()
    const store = core.makeStore({ db, assets: null, me: 'u', wait: noWait })
    expect((await store.uploadFiles([pdf()], {})).error).toMatch(/needs edit access/)
    expect(db.calls).toEqual([])
  })
})

// ── the log ────────────────────────────────────────────────────────────────────
describe('log entries', () => {
  it('records who by id, when, and an order after everything the writer has seen', async () => {
    const { db, store } = storeWith()
    const seen = [entry({ id: 'x', kind: 'confirmed', ord: T0 + 5000 })]
    const e = await store.addLog('T-1', 'reopened', ' why ', ['a1', 2], seen)
    expect(e).toEqual({ itemId: 'T-1', kind: 'reopened', text: ' why ', docIds: ['a1'], by: 'user_7f3a', at: new Date(T0).toISOString(), ord: T0 + 5001 })
    expect(db.rows.get('log/auto1')).toEqual(e)
    expect(core.stateOf([...seen, core.normLog('auto1', e)])?.kind).toBe('reopened')
  })

  it('an unknown kind is stored as a note, which never changes state', async () => {
    const { store } = storeWith()
    expect((await store.addLog('T-1', 'hasOwnProperty', '', [], [])).kind).toBe('note')
  })

  it('a retried create writes the same document, never a second one', async () => {
    const db = fakeDb(); db.fail.set = ['unavailable']
    await storeWith(db).store.addLog('T-1', 'progress', 'x', [], [])
    expect(db.calls).toEqual(['set log/auto1', 'set log/auto1'])
    expect(db.rows.size).toBe(1)
  })

  it('a full database is reported without suggesting anything be removed', async () => {
    const db = fakeDb(); db.fail.set = ['quota_exceeded']
    const err = await storeWith(db).store.addLog('T-1', 'progress', 'x', [], []).catch((e: unknown) => e)
    const msg = core.dbMessage(err)
    expect(msg).toMatch(/5,000 entries/)
    expect(msg).toMatch(/Nothing has been removed/)
    expect(msg).not.toMatch(/delet|consolidat|clean ?up|free (up )?space|older entries/i)
  })
})

// ── the owner's rules ──────────────────────────────────────────────────────────
describe("the owner's rules", () => {
  it('never deletes: a whole session of uploads, notes, failures, archive and restore issues no delete', async () => {
    const db = fakeDb(); db.fail.set = [null as unknown as string, 'unavailable']
    const assets = fakeAssets([null, 'store_unavailable', null, 'too_large'])
    const { store } = storeWith(db, assets)
    await store.uploadFiles([pdf('a.pdf'), pdf('b.pdf')], { itemIds: ['T-1'] })
    await store.uploadFiles([pdf('c.pdf')], {})
    await store.addLog('T-1', 'confirmed', 'done', ['a1'], [])
    await store.setArchived('a1', true)
    await store.setArchived('a1', false)
    await store.setArchived('missing', true).catch(() => {})
    expect([...db.calls, ...assets.calls].filter((c) => /delete/.test(c))).toEqual([])
    expect(db.rows.get('docs/a1')).toMatchObject({ archived: false })
  })

  it('the store has no delete path to call', () => {
    const { store } = storeWith()
    expect(Object.keys(store).sort()).toEqual(['addItem', 'addLog', 'setArchived', 'setItemState', 'uploadFiles'])
  })

  it('archiving only ever sets the flag to a boolean', async () => {
    const { db, store } = storeWith()
    await store.uploadFiles([pdf()], {})
    await store.setArchived('a1', 'yes' as unknown as boolean)
    expect(db.rows.get('docs/a1')).toMatchObject({ archived: false })
  })

  it('no source reaches a delete, and the page writes only through the store', () => {
    for (const src of [coreSrc, clientSrc]) {
      expect(src).not.toMatch(/\.\s*delete\s*\(|\[\s*['"`]delete['"`]\s*\]/)
    }
    // The drawing half has no write verbs of its own: set/update/add/upload live in the core.
    expect(clientSrc).not.toMatch(/\.\s*(set|update|add|upload)\s*\(|\[\s*['"`](set|update|add|upload)['"`]\s*\]/)
  })

  it('never builds markup from text: no innerHTML, insertAdjacentHTML or document.write anywhere', () => {
    for (const src of [coreSrc, clientSrc]) expect(src).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|DOMParser|createContextualFragment/)
  })

  it('the stored identity is the id from user.id(), never a profile', () => {
    expect(clientSrc).toMatch(/me = await user\.id\(\)/)
    expect(clientSrc).toMatch(/C\.makeStore\(\{ db: db, assets: assets, me: me \}\)/)
  })
})

// ── embedding ──────────────────────────────────────────────────────────────────
describe('embedding is safe', () => {
  it('a title containing a closing script tag cannot break out of the JSON block', () => {
    const json = itemsJson([{ id: 'T-1', title: '</script><img src=x onerror=alert(1)>', status: 'open' }])
    expect(json).not.toMatch(/<\/script/i)
    expect(JSON.parse(json)[0].title).toBe('</script><img src=x onerror=alert(1)>')
  })

  it('line and paragraph separators are escaped', () => {
    const json = itemsJson([{ id: 'T-1', title: `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c`, status: 'open' }])
    expect(json).not.toMatch(new RegExp(`[${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`))
    expect(JSON.parse(json)[0].title).toHaveLength(5)
  })

  it('carries only id, title and status per item: no closures, notes or evidence', () => {
    const parsed = JSON.parse(itemsJson([{ id: 'T-2', title: 't', status: 'closed', summary: 's', closure: { reason: 'r' } }]))
    expect(Object.keys(parsed[0]).sort()).toEqual(['id', 'status', 'title'])
  })

  it('an item slot keeps only id-safe characters', () => {
    expect(workspaceItemSlot('T-3"><script>')).toBe('<div class="ws-slot" data-ws-item="T-3script" hidden></div>')
  })

  it('neither inlined file contains a closing script tag, and the page carries exactly two', () => {
    expect(coreSrc).not.toMatch(/<\/script/i)
    expect(clientSrc).not.toMatch(/<\/script/i)
    expect(workspaceScripts([]).match(/<\/script>/g)?.length).toBe(2)
  })
})

// ── items added after the ledger was made (2026-09-30) ─────────────────────────
describe('items added after the ledger was made', () => {
  const ledgerItem = (id: string, over: Row = {}) => ({ id, title: `title ${id}`, status: 'open', owner_role: 'remote-dev', ...over })

  it('lists items numbered after the baseline, or carrying an opened block, newest first', () => {
    const items = [
      ledgerItem('T-397'), ledgerItem('T-398'),
      ledgerItem('T-399', { opened: { on: '2026-09-21', by: 'steward' } }),
      ledgerItem('T-400'),
      ledgerItem('T-416', { opened: { on: '2026-09-30', by: 'steward' } }),
      ledgerItem('T-012', { opened: { on: '2026-09-23', by: 'steward' } }),
    ]
    const got = itemsAddedSince(items, { through: 'T-398', on: '2026-09-16' }).map((i: { id: string }) => i.id)
    expect(got).toEqual(['T-416', 'T-012', 'T-399', 'T-400'])
  })

  it('without a baseline, only an opened block marks an item as new', () => {
    const items = [ledgerItem('NC-171'), ledgerItem('NC-172', { opened: { on: '2026-10-01' } })]
    expect(itemsAddedSince(items, null).map((i: { id: string }) => i.id)).toEqual(['NC-172'])
    expect(itemsAddedSince(items, { through: 'NC-170' }).map((i: { id: string }) => i.id)).toEqual(['NC-172', 'NC-171'])
  })

  it('a baseline for one prefix never marks another prefix as new', () => {
    expect(itemsAddedSince([ledgerItem('NC-900')], { through: 'T-398' })).toEqual([])
  })

  it('the section names the baseline range, lists filed items as jump buttons, and escapes titles', () => {
    const html = addedSection([ledgerItem('T-412', { title: '<b>fees</b>', status: 'blocked', owner_role: 'owner-decision', opened: { on: '2026-09-26', by: 'session steward' } })], { through: 'T-398', on: '2026-09-16' })
    expect(html).toMatch(/held T-001 to T-398/)
    expect(html).toMatch(/data-jump="T-412"/)
    expect(html).toMatch(/&lt;b&gt;fees&lt;\/b&gt;/)
    expect(html).not.toMatch(/<b>fees/)
    expect(html).toMatch(/filed 2026-09-26 by session steward/)
    expect(html).toMatch(/id="added-form" hidden/)
    expect(addedSection([], null)).toMatch(/None yet\./)
  })

  it('a row with wrong types becomes a safe row; an unknown state reads as waiting', () => {
    const a = core.normAdded('x1', { title: 5, role: 'constructor', state: 'toString', filedAs: 'not an id', by: {}, ord: 'NaN' })
    expect(a).toMatchObject({ id: 'x1', title: 'Untitled item', role: '', state: 'waiting', filedAs: '', by: null, ord: null })
    expect(core.normAdded('x2', { state: 'filed', filedAs: ' t-417 ' }).filedAs).toBe('T-417')
    expect(core.normAdded('x3', null).state).toBe('waiting')
  })

  it('a new item needs a title; nothing is written without one', async () => {
    const { db, store } = storeWith()
    expect(core.checkNewItem({ title: '  ' })).toMatch(/title/)
    const r = await store.addItem({ title: '' }, [])
    expect(r.error).toMatch(/title/)
    expect(db.calls).toEqual([])
  })

  it('records a waiting item with who by id, when, and an order after what the writer has seen', async () => {
    const { db, store } = storeWith()
    const seen = [core.normAdded('old', { ord: T0 + 9000 })]
    const r = await store.addItem({ title: ' Build /about ', detail: 'd', role: 'remote-dev', source: 'About page tab', extra: 'x' }, seen)
    expect(r.error).toBeNull()
    expect(db.rows.get('added/auto1')).toEqual({
      title: 'Build /about', detail: 'd', role: 'remote-dev', source: 'About page tab', by: 'user_7f3a',
      at: new Date(T0).toISOString(), ord: T0 + 9001, state: 'waiting', filedAs: '', stateNote: '', stateBy: null, stateAt: '',
    })
  })

  it('a retried create writes the same item, never a second one', async () => {
    const db = fakeDb(); db.fail.set = ['unavailable']
    await storeWith(db).store.addItem({ title: 't' }, [])
    expect(db.calls).toEqual(['set added/auto1', 'set added/auto1'])
  })

  it('filing needs a number, dropping needs a reason; either can be put back, and none deletes', async () => {
    const { db, store } = storeWith()
    await store.addItem({ title: 't' }, [])
    expect((await store.setItemState('auto1', 'filed', 'soon', '')).error).toMatch(/number/)
    expect((await store.setItemState('auto1', 'dropped', '', ' ')).error).toMatch(/why/)
    expect((await store.setItemState('auto1', 'deleted', '', '')).error).toMatch(/Unknown/)
    expect((await store.setItemState('auto1', 'filed', 'nc-171', '')).error).toBeNull()
    expect(db.rows.get('added/auto1')).toMatchObject({ state: 'filed', filedAs: 'NC-171', stateBy: 'user_7f3a' })
    await store.setItemState('auto1', 'dropped', '', 'duplicate of T-120')
    expect(db.rows.get('added/auto1')).toMatchObject({ state: 'dropped', filedAs: '', stateNote: 'duplicate of T-120' })
    await store.setItemState('auto1', 'waiting', '', '')
    expect(db.rows.get('added/auto1')).toMatchObject({ state: 'waiting', title: 't' })
    expect(db.calls.filter((c) => /delete/.test(c))).toEqual([])
  })

  it('the page reads the added collection and draws its rows as text', () => {
    expect(clientSrc).toMatch(/db\.collection\('added'\)\.onSnapshot/)
    expect(clientSrc).toMatch(/C\.normAdded\(d\.id, d\.data\(\)\)/)
    expect(generator).toMatch(/\$\{addedSection\(itemsAddedSince\(items, baseline\), baseline\)\}/)
  })
})
