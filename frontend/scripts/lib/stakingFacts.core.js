/* Staking Facts Check — CORE (no DOM).
 *
 * The owner's check page for T-394, the re-check of the staking catalog's factual fields
 * against each provider's own pages: its website, year founded, audit count, staking
 * assets where DefiLlama cannot see them, and, per coin, the minimum stake and lock-up.
 * Every decision the page makes, and every write it makes, lives here, so the tests can
 * run it for real (lib/server/__tests__/stakingFactsPage.test.ts loads this file with
 * `new Function`), and so the session that reads the answers reads them through the same
 * rules the page saved them under (scripts/staking-facts-plan.ts loads it the same way).
 * stakingFacts.client.js draws the page and calls into this; the page builder inlines
 * both inside one wrapper, so `StakingFactsCore` never becomes a page global.
 *
 * What it keeps true (the Transfer Fee Check's rules, on these fields):
 *  · NOTHING IS DELETED. A newer answer replaces an older one, and "Clear" stores
 *    `unchecked`. The store has no delete path (the owner's standing rule, 2026-09-12).
 *  · BLANK MEANS UNKNOWN. A row counts only once someone picked an answer. "Matches" is a
 *    choice, never a default, and "Different" carrying the catalog's own figures is
 *    refused: it would record a change that is not one.
 *  · AN ANSWER REMEMBERS WHAT IT WAS COMPARED AGAINST. When the catalog moves after an
 *    answer was given, the answer reads as out of date and the plan leaves it out. A
 *    catalog that moved TO the answer means the answer was applied.
 *  · A COMMA IS NEVER GUESSED AT, and neither is a unit: "0,5" is refused, and an assets
 *    figure needs the unit the page shows.
 *  · IT REPORTS, IT NEVER WRITES THE CATALOG. factPlan() lists the answers; the catalog
 *    changes only by hand, in a pull request the owner merges.
 */
var StakingFactsCore = (function () {
  'use strict'

  var RESULTS = {
    ok: 'Matches',
    changed: 'Different',
    'not-offered': 'Not offered',
    'cant-see': "Can't see it",
    unchecked: 'Not checked',
  }
  /** Which answers each kind of row offers. Only a coin's terms can be "not offered". */
  var KIND_RESULTS = {
    site: ['ok', 'changed', 'cant-see'],
    founded: ['ok', 'changed', 'cant-see'],
    audits: ['ok', 'changed', 'cant-see'],
    assets: ['ok', 'changed', 'cant-see'],
    terms: ['ok', 'changed', 'not-offered', 'cant-see'],
  }
  /** Answers that settle a row: the catalog can be dated by them. "Can't see it" does not. */
  var SETTLES = { ok: true, changed: true, 'not-offered': true }
  var MAX_NOTE = 1000
  var EARLIEST_YEAR = 1990
  var MAX_DAYS = 3650
  var MAX_AUDITS = 500
  var MAX_ASSETS_B = 5000

  function own(o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k) }
  function str(v) { return typeof v === 'string' ? v : '' }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null }

  function plainNumber(s) {
    if (s.indexOf(',') !== -1) {
      if (!/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return NaN
      s = s.replace(/,/g, '')
    }
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return NaN
    var n = Number(s)
    return isFinite(n) ? n : NaN
  }

  var UNITS = {
    t: 1000, tn: 1000, trillion: 1000,
    b: 1, bn: 1, bil: 1, billion: 1,
    m: 0.001, mm: 0.001, mn: 0.001, mil: 0.001, million: 0.001,
    k: 0.000001, thousand: 0.000001,
  }

  /** An assets figure as typed, in BILLIONS of dollars; a small number with no unit is NaN. */
  function parseBillions(v) {
    var s = str(v).trim().replace(/^US\s*/i, '').replace(/^\$\s*/, '').replace(/\s*(USD)$/i, '')
    if (!s) return null
    var m = /^(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.?\d*|\.\d+)\s*([A-Za-z]+)?$/.exec(s)
    if (!m) return NaN
    var n = plainNumber(m[1])
    if (n !== n) return NaN
    var unit = (m[2] || '').toLowerCase()
    if (!unit) return n >= 1e6 ? n / 1e9 : NaN
    if (!own(UNITS, unit)) return NaN
    return n * UNITS[unit]
  }

  /** A website address as typed: an https link to a named host, or NaN. */
  function parseUrl(v) {
    var s = str(v).trim()
    if (!s) return null
    if (s.length > 500 || /\s/.test(s) || !/^https:\/\//i.test(s)) return NaN
    try {
      // Kept as typed (not URL.href, which adds a trailing slash), so the catalog's own
      // address typed back reads as the same address.
      var u = new URL(s)
      return u.protocol === 'https:' && /\./.test(u.hostname) ? s : NaN
    } catch (e) {
      return NaN
    }
  }

  /**
   * One field as typed. "" → null (nothing typed); a readable value → that value; anything
   * else → NaN. `nowYear` bounds a founding year.
   */
  function parseField(type, v, nowYear) {
    if (type === 'url') return parseUrl(v)
    if (type === 'billions') return parseBillions(v)
    var s = str(v).trim()
    if (!s) return null
    if (type === 'year') {
      if (!/^\d{4}$/.test(s)) return NaN
      var y = Number(s)
      return y >= EARLIEST_YEAR && y <= nowYear ? y : NaN
    }
    if (type === 'count') {
      if (!/^\d{1,3}$/.test(s)) return NaN
      var c = Number(s)
      return c <= MAX_AUDITS ? c : NaN
    }
    var n = plainNumber(s)
    if (n !== n) return NaN
    if (type === 'days' && n > MAX_DAYS) return NaN
    return n
  }

  function fieldProblem(field, typed) {
    var t = field.type, s = str(typed)
    if (t === 'url') return 'Paste the full address the page is at now, starting https://.'
    if (t === 'year') return 'Type the year founded, like 2018.'
    if (t === 'count') return 'Type the number of audits the page lists, like 4.'
    if (t === 'billions') {
      var bare = plainNumber(s.trim().replace(/^\$\s*/, ''))
      if (bare === bare) return 'Add the unit the page shows, like 1.3B or 1,300 million. A number on its own could be billions or millions.'
      if (/,/.test(s)) return 'Use a dot for decimals, like 1.3B. A comma is only allowed between thousands.'
      return 'Type the figure the way the page shows it, like $1.3B or 1,300 million.'
    }
    if (/,/.test(s)) return 'Use a dot for decimals, like 0.5. A comma is only allowed between thousands, like 1,000.'
    if (t === 'days') return 'Type the lock-up in days, like 21, or 0 for none.'
    return 'Type the minimum as a number of ' + (field.unit || 'coins') + ', like 0.01, or 0 for none.'
  }

  function sameValue(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-12
    return a === b
  }

  // ── stored rows, whatever a writer stored (db.d.ts: no schema) ────────────────
  function cleanValues(x) {
    var out = {}
    if (!x || typeof x !== 'object') return out
    Object.keys(x).forEach(function (k) {
      var v = x[k]
      if (typeof v === 'number' && isFinite(v)) out[k] = v
      else if (typeof v === 'string' && v.length <= 500) out[k] = v
      else if (v === null) out[k] = null
    })
    return out
  }

  function normCheck(id, x) {
    x = x && typeof x === 'object' ? x : {}
    return {
      key: String(id),
      result: own(RESULTS, x.result) ? x.result : 'unchecked',
      values: cleanValues(x.values),
      note: str(x.note).slice(0, MAX_NOTE),
      compared: cleanValues(x.compared),
      at: str(x.at),
      by: str(x.by) || null,
    }
  }

  function normProviderNote(id, x) {
    x = x && typeof x === 'object' ? x : {}
    return { providerId: String(id), text: str(x.text).slice(0, MAX_NOTE), at: str(x.at), by: str(x.by) || null }
  }

  // ── validation ────────────────────────────────────────────────────────────────
  function catalogOf(row) {
    var o = {}
    row.fields.forEach(function (f) { o[f.name] = f.catalog === undefined ? null : f.catalog })
    return o
  }

  /** Why an answer cannot be saved yet, or null. `input.values` holds each field as typed. */
  function checkAnswer(row, input, nowMs) {
    input = input || {}
    var allowed = KIND_RESULTS[row.kind] || []
    if (!own(RESULTS, input.result) || input.result === 'unchecked' || allowed.indexOf(input.result) === -1) return 'Pick an answer.'
    if (str(input.note).trim().length > MAX_NOTE) return 'Keep the note under 1,000 characters.'
    var hasCatalog = row.fields.every(function (f) { return f.catalog !== null && f.catalog !== undefined })
    if (input.result === 'ok' && !hasCatalog) {
      return 'The catalog has no figure here yet. Choose Different and type what the page shows.'
    }
    if (input.result !== 'changed') return null
    var nowYear = new Date(nowMs || Date.now()).getUTCFullYear()
    var typed = input.values || {}
    var any = false, allSame = true
    for (var i = 0; i < row.fields.length; i++) {
      var f = row.fields[i]
      var v = parseField(f.type, typed[f.name], nowYear)
      if (v !== v) return fieldProblem(f, typed[f.name])
      if (v === null) continue
      any = true
      if (!sameValue(v, f.catalog)) allSame = false
    }
    if (!any) return row.kind === 'site' ? 'Paste the address the page is at now.' : 'Type what the page shows for at least one figure.'
    if (allSame) return row.kind === 'site' ? 'That is the address the catalog already has. Choose Matches instead.' : 'That is what the catalog already says. Choose Matches instead.'
    return null
  }

  // ── what is stored ────────────────────────────────────────────────────────────
  function stamp(nowMs) { return new Date(nowMs).toISOString() }

  function answerDoc(row, input, me, nowMs) {
    var changed = input.result === 'changed'
    var nowYear = new Date(nowMs).getUTCFullYear()
    var values = {}
    if (changed) {
      // A "Different" answer records every figure as the page shows it: what was left
      // blank is the catalog's own value, which the person saw and did not change.
      row.fields.forEach(function (f) {
        var v = parseField(f.type, (input.values || {})[f.name], nowYear)
        values[f.name] = v === null ? (f.catalog === undefined ? null : f.catalog) : v
      })
    }
    return {
      result: input.result,
      values: values,
      note: str(input.note).trim().slice(0, MAX_NOTE),
      compared: catalogOf(row),
      at: stamp(nowMs),
      by: me || null,
    }
  }

  function clearedDoc(row, me, nowMs) {
    return { result: 'unchecked', values: {}, note: '', compared: catalogOf(row), at: stamp(nowMs), by: me || null }
  }

  // ── reading answers against the catalog as it is now ──────────────────────────
  function matchesCatalog(row, obj) {
    return row.fields.every(function (f) {
      var a = own(obj, f.name) ? obj[f.name] : undefined
      var b = f.catalog === undefined ? null : f.catalog
      return a === undefined ? false : sameValue(a, b)
    })
  }

  /** 'unchecked' | 'current' | 'stale' | 'applied'. `row` is the catalog now. */
  function answerState(row, check) {
    if (!check || check.result === 'unchecked') return 'unchecked'
    if (matchesCatalog(row, check.compared)) return 'current'
    if (check.result === 'changed' && matchesCatalog(row, check.values)) return 'applied'
    return 'stale'
  }

  /** Counts for a set of rows. `answered` includes "can't see it"; `settled` does not. */
  function tally(rows, checksByKey) {
    var t = { total: 0, answered: 0, settled: 0, stale: 0, ok: 0, changed: 0, 'not-offered': 0, 'cant-see': 0 }
    ;(rows || []).forEach(function (r) {
      t.total++
      var c = checksByKey[r.key]
      var s = answerState(r, c)
      if (s === 'unchecked') return
      if (s === 'stale') { t.stale++; return }
      t.answered++
      if (s === 'applied' || own(SETTLES, c.result)) t.settled++
      if (own(t, c.result)) t[c.result]++
    })
    return t
  }

  /**
   * What the answers say, against the catalog as it is NOW. Nothing here changes the
   * catalog: each change is made by hand, in a pull request.
   *   changes    — { key, providerId, kind, coin, field, from, to } for each figure that differs
   *   notOffered — keys of coins the provider no longer stakes (a row removal, by hand)
   *   confirmed  — keys answered "Matches"
   *   cantSee    — keys answered "Can't see it"
   *   stale      — keys answered against catalog figures that have since changed (left out)
   *   applied    — keys whose answer the catalog already carries
   *   unread     — keys with no answer yet
   *   notes      — { key, note } for every current answer with a note
   *   complete   — every row is settled, so STAKING_DATA_LAST_VERIFIED could move to the
   *                day the last answer was given. Until then it must not move at all.
   */
  function factPlan(rows, checksByKey) {
    var plan = { changes: [], notOffered: [], confirmed: [], cantSee: [], stale: [], applied: [], unread: [], notes: [], complete: false, lastAnswered: null }
    var settled = 0
    ;(rows || []).forEach(function (r) {
      var c = checksByKey[r.key]
      var s = answerState(r, c)
      if (s === 'unchecked') { plan.unread.push(r.key); return }
      if (s === 'stale') { plan.stale.push(r.key); return }
      if (c.at && (plan.lastAnswered === null || c.at > plan.lastAnswered)) plan.lastAnswered = c.at
      if (s === 'applied') { plan.applied.push(r.key); settled++; return }
      if (c.note) plan.notes.push({ key: r.key, note: c.note })
      if (own(SETTLES, c.result)) settled++
      if (c.result === 'ok') plan.confirmed.push(r.key)
      else if (c.result === 'not-offered') plan.notOffered.push(r.key)
      else if (c.result === 'cant-see') plan.cantSee.push(r.key)
      else if (c.result === 'changed') {
        r.fields.forEach(function (f) {
          var to = own(c.values, f.name) ? c.values[f.name] : null
          var from = f.catalog === undefined ? null : f.catalog
          if (to !== null && !sameValue(to, from)) {
            plan.changes.push({ key: r.key, providerId: r.providerId, kind: r.kind, coin: r.coin || null, field: f.name, from: from, to: to })
          }
        })
      }
    })
    plan.complete = (rows || []).length > 0 && settled === (rows || []).length
    return plan
  }

  // ── writing ───────────────────────────────────────────────────────────────────
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
    if (code === 'invalid_argument') return 'Your answer was refused. Only the page owner and editors can record answers.'
    if (code === 'quota_exceeded') return 'The page has reached its storage limit. Nothing was removed. Tell Claude.'
    return 'The answer could not be saved (' + (code || 'error') + '). Try again.'
  }

  /**
   * The only code that writes. `db` and `me` come from the page; `now` and `wait` are
   * injectable for tests. There is deliberately no delete here.
   * Each method resolves { error, doc }: a validation problem comes back as `error` and
   * nothing is written; a store error is thrown.
   */
  function makeStore(opts) {
    var db = opts.db, me = opts.me || null
    var now = opts.now || function () { return Date.now() }
    var wait = opts.wait

    function write(collection, id, doc) {
      return withRetry(function () { return db.collection(collection).doc(String(id)).set(doc) }, 'unavailable', wait)
    }

    async function saveAnswer(row, input) {
      var t = now()
      var problem = checkAnswer(row, input, t)
      if (problem) return { error: problem, doc: null }
      var doc = answerDoc(row, input, me, t)
      await write('checks', row.key, doc)
      return { error: null, doc: doc }
    }

    async function clearAnswer(row) {
      var doc = clearedDoc(row, me, now())
      await write('checks', row.key, doc)
      return { error: null, doc: doc }
    }

    async function saveProviderNote(providerId, text) {
      var t = str(text).trim()
      if (t.length > MAX_NOTE) return { error: 'Keep the note under 1,000 characters.', doc: null }
      var doc = { text: t, at: stamp(now()), by: me }
      await write('notes', providerId, doc)
      return { error: null, doc: doc }
    }

    return { saveAnswer: saveAnswer, clearAnswer: clearAnswer, saveProviderNote: saveProviderNote }
  }

  // ── wording, decided here so the tests read what the page says ────────────────
  var KIND_LABELS = { site: 'Staking page', founded: 'Founded', audits: 'Security audits', assets: 'Staking assets', terms: '' }
  var FIELD_LABELS = { url: 'Address', year: 'Year', count: 'Audits', billions: 'Assets', min: 'Minimum', lockup: 'Lock-up' }

  function trim(n) { return String(Math.round(n * 1e8) / 1e8) }

  /** A field's value in words: "0.01 ETH", "21 days", "None", "$1.3 billion". */
  function fieldText(field, value) {
    if (value === null || value === undefined) return field.type === 'count' ? 'none recorded' : '—'
    if (field.type === 'url' || field.type === 'year') return String(value)
    if (field.type === 'count') return String(value)
    if (field.type === 'billions') return value >= 1 ? '$' + trim(value) + ' billion' : '$' + trim(value * 1000) + ' million'
    if (field.type === 'days') return value === 0 ? 'None' : trim(value) + (value === 1 ? ' day' : ' days')
    return value === 0 ? 'None' : trim(value) + ' ' + (field.unit || '')
  }

  /** What a row checks, and how to read the provider's page for it. */
  function rowGuidance(provider, row) {
    var p = provider && typeof provider === 'object' ? provider : {}
    if (row.kind === 'site') return 'Does the link still open ' + str(p.name) + '’s staking page? If it moved, paste the new address.'
    if (row.kind === 'founded') return 'The year the company or protocol was founded or launched, from its own About page.'
    if (row.kind === 'audits') return 'How many security audits the protocol lists, usually on its docs or security page.'
    if (row.kind === 'assets') return 'What the provider says it holds in staking for customers. Read it only from its own pages or reports.'
    return 'The smallest amount you can stake, and how long it is locked before you can withdraw (0 if you can leave at once).'
  }

  /** Where a provider's card sends the owner, and the notes that change how it is read. */
  function providerGuidance(provider) {
    var p = provider && typeof provider === 'object' ? provider : {}
    var name = str(p.name), site = str(p.website)
    var link = site
      ? { href: site, label: 'Open ' + name + '’s staking page', hint: ' If the link has moved, search “' + name + ' staking”.' }
      : { href: null, label: '', hint: 'No page on file. Search “' + name + ' staking”.' }
    var notes = []
    if (p.category === 'cefi') {
      notes.push({ tone: 'info', text: 'Exchanges often show minimums and lock-ups only after you sign in. If you can’t see them, mark those rows “' + RESULTS['cant-see'] + '”.' })
    }
    return { link: link, notes: notes }
  }

  return {
    RESULTS: RESULTS, KIND_RESULTS: KIND_RESULTS, SETTLES: SETTLES, MAX_NOTE: MAX_NOTE, KIND_LABELS: KIND_LABELS, FIELD_LABELS: FIELD_LABELS,
    own: own, parseField: parseField, parseBillions: parseBillions, parseUrl: parseUrl,
    normCheck: normCheck, normProviderNote: normProviderNote,
    checkAnswer: checkAnswer, answerDoc: answerDoc,
    answerState: answerState, tally: tally, factPlan: factPlan,
    withRetry: withRetry, dbMessage: dbMessage, makeStore: makeStore,
    fieldText: fieldText, rowGuidance: rowGuidance, providerGuidance: providerGuidance,
  }
})(); // the semicolon matters: the client, inlined next, opens with "(" (see buildStakingFactsPage)
