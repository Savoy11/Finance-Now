/* Finance Now Ledger — shared workspace CORE (no DOM).
 *
 * Everything the workspace decides, and every write it makes, lives here so it can be
 * exercised for real by lib/server/__tests__/ledgerWorkspace.test.ts (the file is run
 * in a Node vm there). ledgerWorkspace.client.js does the drawing and calls into this.
 * The page builder inlines this file and the client inside one wrapper function, so
 * `LedgerWorkspaceCore` is not a page global.
 *
 * Why each piece exists, from the pre-merge review of 2026-09-27:
 *   · normDoc / normLog — rows are whatever a writer stored (db.d.ts: no schema). One
 *     row with `itemIds: "T-069"` used to throw inside the render and blank the library,
 *     the pending list, activity and every chip for every viewer, until someone fixed
 *     the row by hand. Rows are now coerced once, on arrival, and only the copies render.
 *   · stateOf — a decision (confirmed / reopened) is only ever replaced by a later
 *     decision, never by a progress note; order comes from `ord`, which each writer sets
 *     above everything it has seen, so a row dated in the future or a skewed device
 *     clock cannot pin an item's state. Kind lookups are own-property only.
 *   · checkFiles — every file is checked before ANY is uploaded, so a bad third file
 *     no longer leaves the first two stored with no log entry.
 *   · withRetry — the one retry each contract allows: `store_unavailable` for assets,
 *     `unavailable` for db writes. Creates use a pre-minted id, so a retried create
 *     leaves at most one document.
 *   · makeStore — the ONLY writers. It has no delete path at all: a mistaken upload is
 *     archived (the owner's standing rule, 2026-09-12: nothing is deleted).
 */
var LedgerWorkspaceCore = (function () {
  'use strict'

  var MB = 1024 * 1024
  var MAX_ORDER = 8.64e15 // the largest valid Date value; bounds any stored `ord`

  var TYPE_BY_EXT = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm',
    csv: 'text/csv', md: 'text/markdown', markdown: 'text/markdown', json: 'application/json',
    txt: 'text/plain', log: 'text/plain',
  }
  var ACCEPTED = {}
  Object.keys(TYPE_BY_EXT).forEach(function (k) { ACCEPTED[TYPE_BY_EXT[k]] = true })

  var KINDS = [
    ['evidence', 'Evidence — shows an item is done'],
    ['research', 'Research — findings for an open item'],
    ['reference', 'Reference — background material'],
    ['decision', 'Decision record'],
    ['other', 'Other'],
  ]
  var KIND_LABEL = {}
  KINDS.forEach(function (k) { KIND_LABEL[k[0]] = k[1].split(' — ')[0] })

  var STATE_LABEL = { progress: 'In progress', confirmed: 'Confirmed complete', reopened: 'Reopened' }
  var LOG_KINDS = { progress: true, confirmed: true, reopened: true, note: true }
  var DECISIONS = { confirmed: true, reopened: true }

  function own(o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k) }
  function str(v) { return typeof v === 'string' ? v : '' }
  function strs(v) { return Array.isArray(v) ? v.filter(function (s) { return typeof s === 'string' && s.length > 0 }) : [] }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null }

  /** A `docs` row as the page may use it, whatever was stored. The snapshot id always wins. */
  function normDoc(id, x) {
    x = x && typeof x === 'object' ? x : {}
    return {
      id: String(id),
      name: str(x.name).slice(0, 200) || 'Untitled',
      contentType: str(x.contentType),
      sizeBytes: num(x.sizeBytes),
      kind: own(KIND_LABEL, x.kind) ? x.kind : 'other',
      itemIds: strs(x.itemIds),
      note: str(x.note),
      uploadedBy: str(x.uploadedBy) || null,
      uploadedAt: str(x.uploadedAt),
      archived: x.archived === true,
    }
  }

  /** A `log` row as the page may use it, whatever was stored. */
  function normLog(id, x) {
    x = x && typeof x === 'object' ? x : {}
    return {
      id: String(id),
      itemId: str(x.itemId),
      kind: own(LOG_KINDS, x.kind) ? x.kind : 'note',
      text: str(x.text),
      docIds: strs(x.docIds),
      by: str(x.by) || null,
      at: str(x.at),
      ord: num(x.ord),
    }
  }

  /** Where an entry sits in time: its `ord`, else its `at`, bounded to a valid date. */
  function orderOf(l) {
    var o = l.ord != null ? l.ord : Date.parse(l.at)
    if (!isFinite(o)) o = 0
    return Math.min(Math.max(o, 0), MAX_ORDER)
  }

  /** The `ord` for a new entry: after now, and after everything this writer has seen. */
  function nextOrd(entries, now) {
    var seen = 0
    ;(entries || []).forEach(function (l) { seen = Math.max(seen, orderOf(l)) })
    return Math.min(Math.max(now, seen + 1), MAX_ORDER)
  }

  function latest(entries, pred) {
    var best = null, bo = -1
    ;(entries || []).forEach(function (l) {
      if (!pred(l)) return
      var o = orderOf(l)
      if (o > bo || (o === bo && best && l.id > best.id)) { bo = o; best = l }
    })
    return best
  }

  /** An item's workspace state: its latest decision, else its latest progress note. */
  function stateOf(entries) {
    return latest(entries, function (l) { return own(DECISIONS, l.kind) }) ||
      latest(entries, function (l) { return l.kind === 'progress' })
  }

  /** True when the workspace and the ledger disagree about an item. */
  function awaitingLedger(item, state) {
    if (!state || !item) return false
    return (state.kind === 'confirmed' && item.status !== 'closed') ||
      (state.kind === 'reopened' && item.status === 'closed')
  }

  function chipText(item, state, nDocs) {
    var text = ''
    if (state && state.kind === 'confirmed') text = item && item.status === 'closed' ? 'Confirmed' : 'Confirmed · ledger pending'
    else if (state && state.kind === 'reopened') text = 'Reopened'
    else if (state && state.kind === 'progress') text = 'In progress'
    if (nDocs) text = (text ? text + ' · ' : '') + nDocs + (nDocs === 1 ? ' doc' : ' docs')
    return text
  }

  // ── uploads ──────────────────────────────────────────────────────────────────
  function typeFor(name, type) {
    if (own(ACCEPTED, type)) return type
    var ext = (String(name || '').split('.').pop() || '').toLowerCase()
    return own(TYPE_BY_EXT, ext) ? TYPE_BY_EXT[ext] : null
  }

  function uploadError(code, name) {
    var m = {
      too_large: name + ' is over the size limit (20 MB, or 2 MB for SVG).',
      unsupported_type: name + ' is not a supported type. Export Word or Excel files to PDF or CSV first.',
      invalid_request: name + ' could not be stored. A text file must be UTF-8; re-save it as UTF-8 and try again.',
      quota_or_state: 'The workspace cannot take more files right now (its storage is full or the page is unavailable).',
      rate_limited: 'Too many uploads at once. Wait a moment and try again.',
      upstream_auth: 'Your session could not be confirmed. Reload the page and try again.',
      not_granted: 'Uploading is not available in this view.',
      capability_disabled: 'Uploading is not available in this view.',
      capability_removed: 'Uploading is not available in this view.',
    }
    return own(m, code) ? m[code] : 'Upload of ' + name + ' failed (' + (code || 'unknown error') + ').'
  }

  /** Check every file before any is uploaded. */
  function checkFiles(files) {
    files = files || []
    if (!files.length) return { ok: false, error: 'Choose at least one file.' }
    var typed = []
    for (var i = 0; i < files.length; i++) {
      var f = files[i], name = String(f && f.name || 'file')
      if (!f || !f.size) return { ok: false, error: name + ' is empty.' }
      var type = typeFor(f.name, f.type)
      if (!type) return { ok: false, error: uploadError('unsupported_type', name) }
      var limit = type === 'image/svg+xml' ? 2 * MB : 20 * MB
      if (f.size > limit) return { ok: false, error: uploadError('too_large', name) }
      typed.push({ file: f, type: type })
    }
    return { ok: true, typed: typed }
  }

  function defaultWait() { return new Promise(function (r) { setTimeout(r, 700 + Math.floor(Math.random() * 700)) }) }

  /** Run `fn`; on exactly `retryCode`, wait and try once more. Anything else is thrown. */
  async function withRetry(fn, retryCode, wait) {
    try {
      return await fn()
    } catch (e) {
      if (!e || e.code !== retryCode) throw e
      await (wait || defaultWait)()
      return await fn()
    }
  }

  function dbMessage(e) {
    var code = e && e.code
    if (code === 'quota_exceeded') return 'The workspace has reached its storage limit (5,000 entries in all). Nothing has been removed. Tell Claude so the owner can decide what to do.'
    if (code === 'invalid_argument') return 'Your change was refused. This page is read-only for you; ask the owner for edit access.'
    return 'The change could not be saved (' + (code || 'error') + '). Try again.'
  }

  /**
   * The only code that writes. `db`, `assets`, `me` come from the page; `now` and
   * `wait` are injectable for tests. There is deliberately no delete here.
   */
  function makeStore(opts) {
    var db = opts.db, assets = opts.assets, me = opts.me || null
    var now = opts.now || function () { return Date.now() }
    var wait = opts.wait

    /** Resolves { ids, error, refused }. Files that stored before a failure stay listed. */
    async function uploadFiles(files, meta, onProgress) {
      var checked = checkFiles(files)
      if (!checked.ok) return { ids: [], error: checked.error }
      if (!assets) return { ids: [], error: 'Uploading needs edit access to this page.' }
      var ids = []
      for (var i = 0; i < checked.typed.length; i++) {
        var f = checked.typed[i].file, type = checked.typed[i].type, name = String(f.name)
        if (onProgress) onProgress(name)
        var res
        try {
          res = await withRetry(function () { return assets.upload(f, { type: type }) }, 'store_unavailable', wait)
        } catch (e) {
          return { ids: ids, error: uploadError(e && e.code, name) }
        }
        var row = {
          name: name.slice(0, 200),
          contentType: res.contentType,
          sizeBytes: res.sizeBytes,
          kind: own(KIND_LABEL, meta.kind) ? meta.kind : 'other',
          itemIds: strs(meta.itemIds),
          note: str(meta.note).slice(0, 2000),
          uploadedBy: me,
          uploadedAt: new Date(now()).toISOString(),
          archived: false,
        }
        try {
          await withRetry(function () { return db.collection('docs').doc(res.id).set(row) }, 'unavailable', wait)
        } catch (e) {
          return { ids: ids, error: name + ' was stored but could not be listed. ' + dbMessage(e), refused: !!(e && e.code === 'invalid_argument') }
        }
        ids.push(res.id)
      }
      return { ids: ids, error: null }
    }

    /** Append one log entry. `seen` is the item's current entries (for ordering). Throws the db error. */
    async function addLog(itemId, kind, text, docIds, seen) {
      var t = now()
      var entry = {
        itemId: String(itemId),
        kind: own(LOG_KINDS, kind) ? kind : 'note',
        text: str(text).slice(0, 4000),
        docIds: strs(docIds),
        by: me,
        at: new Date(t).toISOString(),
        ord: nextOrd(seen, t),
      }
      var ref = db.collection('log').doc() // minted once: a retry cannot create a second entry
      await withRetry(function () { return ref.set(entry) }, 'unavailable', wait)
      return entry
    }

    /** Hide or show a document. Never removes it. Throws the db error. */
    async function setArchived(id, archived) {
      await withRetry(function () { return db.collection('docs').doc(String(id)).update({ archived: archived === true }) }, 'unavailable', wait)
    }

    return { uploadFiles: uploadFiles, addLog: addLog, setArchived: setArchived }
  }

  return {
    MB: MB, TYPE_BY_EXT: TYPE_BY_EXT, KINDS: KINDS, KIND_LABEL: KIND_LABEL, STATE_LABEL: STATE_LABEL,
    own: own, normDoc: normDoc, normLog: normLog, orderOf: orderOf, nextOrd: nextOrd,
    stateOf: stateOf, awaitingLedger: awaitingLedger, chipText: chipText,
    typeFor: typeFor, checkFiles: checkFiles, uploadError: uploadError, withRetry: withRetry,
    dbMessage: dbMessage, makeStore: makeStore,
  }
})(); // the semicolon matters: the client, inlined next, opens with "(" (and see workspaceScripts)
