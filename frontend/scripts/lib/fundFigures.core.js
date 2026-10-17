/* Fund Figures Check — CORE (no DOM).
 *
 * The owner's check page for re-reading the fund catalog's approximate figures (T-440):
 * every yield, and every asset figure no SEC filing dates. Every decision the page makes,
 * and every write it makes, lives here, so the tests can run it for real
 * (lib/server/__tests__/fundFiguresPage.test.ts loads this file with `new Function`), and
 * so the session that reads the answers reads them through the same rules the page saved
 * them under (scripts/fund-figures-plan.ts loads it the same way). fundFigures.client.js
 * draws the page and calls into this; the page builder inlines both inside one wrapper,
 * so `FundFiguresCore` never becomes a page global.
 *
 * What it keeps true:
 *  · NOTHING IS DELETED. A newer reading replaces an older one, and "Clear" stores
 *    `unchecked`. The store has no delete path (the owner's standing rule, 2026-09-12).
 *  · A READING IS WHAT THE PAGE SHOWS, WITH THE DATE THE PAGE STATES. There is no
 *    "Matches" button: the point of the pass is a dated figure for every row, so a reading
 *    without its date is refused, and nothing is pre-filled from the catalog.
 *  · A READING REMEMBERS WHAT IT WAS COMPARED AGAINST. When the catalog moves after a
 *    reading was taken, the reading reads as out of date and the plan leaves it out. A
 *    catalog that moved TO the reading means the reading was applied.
 *  · A COMMA IS NEVER GUESSED AT, and neither is a unit. "0,5" is refused (a decimal comma
 *    or a typo), and an asset figure needs the unit the page shows: "45.1" alone could be
 *    billions or millions, a thousandfold error either way.
 *  · IT REPORTS, IT NEVER WRITES THE CATALOG. figurePlan() lists the readings; Claude
 *    brings the differences to the owner before anything changes, in a pull request.
 */
var FundFiguresCore = (function () {
  'use strict'

  var RESULTS = { read: 'Read it', 'cant-see': "Can't find it", unchecked: 'Not checked' }
  var FIGURES = { yield: 'Yield', assets: 'Net assets' }
  var YIELD_KINDS = {
    trailing: '12-month trailing or distribution yield',
    sec: '30-day SEC yield',
    other: 'Another kind of yield (say which in the note)',
  }
  var ASSET_KINDS = {
    own: 'This fund’s own net assets (for a Vanguard ETF, the ETF share class)',
    whole: 'The whole fund, every share class together',
  }
  var MAX_NOTE = 1000
  /** A reading dated before this is a typo, not an old page: the catalog was compiled in 2026. */
  var EARLIEST_DAY = '2024-01-01'
  var MAX_YIELD_PCT = 30
  var MAX_ASSETS_B = 5000

  function own(o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k) }
  function str(v) { return typeof v === 'string' ? v : '' }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null }

  var NUMBER = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+\\.?\\d*|\\.\\d+)'

  function plainNumber(s) {
    if (s.indexOf(',') !== -1) {
      if (!/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return NaN
      s = s.replace(/,/g, '')
    }
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return NaN
    var n = Number(s)
    return isFinite(n) ? n : NaN
  }

  /**
   * A yield as typed, in percent. "" → null; "1.2", "1.2%", " 0.85 % " → the number;
   * anything else → NaN. Refuses "0,5", "-1", "1e-2".
   */
  function parsePercent(v) {
    if (typeof v === 'number') return isFinite(v) && v >= 0 ? v : NaN
    var s = str(v).trim().replace(/\s*%$/, '')
    if (!s) return null
    return plainNumber(s)
  }

  var UNITS = {
    t: 1000, tn: 1000, trillion: 1000,
    b: 1, bn: 1, bil: 1, billion: 1,
    m: 0.001, mm: 0.001, mn: 0.001, mil: 0.001, million: 0.001,
    k: 0.000001, thousand: 0.000001,
  }

  /**
   * An asset figure as typed, in BILLIONS of dollars. "" → null. Takes the figure the way
   * the page shows it: "$45.1B", "45.1 billion", "45,123 million", "$1.2 trillion",
   * "$45,123,456,789". A small number with no unit is NaN: it could be billions or
   * millions. Anything else is NaN.
   */
  function parseAssets(v) {
    var s = str(v).trim().replace(/^US\s*/i, '').replace(/^\$\s*/, '').replace(/\s*(USD)$/i, '')
    if (!s) return null
    var m = new RegExp('^' + NUMBER + '\\s*([A-Za-z]+)?$').exec(s)
    if (!m) return NaN
    var n = plainNumber(m[1])
    if (n !== n) return NaN
    var unit = (m[2] || '').toLowerCase()
    if (!unit) return n >= 1e6 ? n / 1e9 : NaN
    if (!own(UNITS, unit)) return NaN
    return n * UNITS[unit]
  }

  function percentProblem(typed) {
    if (/,/.test(str(typed))) return 'Use a dot for decimals, like 1.25. A comma is not allowed in a yield.'
    return 'Type the yield in percent, like 1.25.'
  }

  function assetsProblem(typed) {
    var s = str(typed).trim().replace(/^\$\s*/, '')
    var bare = plainNumber(s)
    if (bare === bare) return 'Add the unit the page shows, like 45.1B or 45,123 million. A number on its own could be billions or millions.'
    if (/,/.test(s)) return 'Use a dot for decimals, like 45.1B. A comma is only allowed between thousands, like 45,123 million.'
    return 'Type the figure the way the page shows it, like $45.1B or 45,123 million.'
  }

  /** "2026-10-16" (a real day) → that string; anything else → null. */
  function isoDay(v) {
    var s = str(v).trim()
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    if (!m) return null
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? s : null
  }

  function dayOf(ms) { return new Date(ms).toISOString().slice(0, 10) }

  // ── stored rows, whatever a writer stored (db.d.ts: no schema) ────────────────
  function normReading(id, x) {
    x = x && typeof x === 'object' ? x : {}
    var parts = String(id).split(':')
    var figure = own(FIGURES, parts[1]) ? parts[1] : null
    var kinds = figure === 'assets' ? ASSET_KINDS : YIELD_KINDS
    var result = own(RESULTS, x.result) ? x.result : 'unchecked'
    return {
      id: String(id),
      symbol: parts[0] || '',
      figure: figure,
      result: result,
      value: result === 'read' ? num(x.value) : null,
      typed: str(x.typed).slice(0, 80),
      asOf: result === 'read' ? isoDay(x.asOf) : null,
      kind: result === 'read' && own(kinds, x.kind) ? x.kind : null,
      note: str(x.note).slice(0, MAX_NOTE),
      compared: num(x.compared),
      at: str(x.at),
      by: str(x.by) || null,
    }
  }

  function normFundNote(id, x) {
    x = x && typeof x === 'object' ? x : {}
    return { symbol: String(id), text: str(x.text).slice(0, MAX_NOTE), at: str(x.at), by: str(x.by) || null }
  }

  // ── validation ────────────────────────────────────────────────────────────────
  /**
   * Why a reading cannot be saved yet, or null. `fig` is { id, figure, catalog };
   * `input` carries result, value, asOf, kind and note as typed.
   */
  function checkReading(fig, input, nowMs) {
    input = input || {}
    if (!own(RESULTS, input.result) || input.result === 'unchecked') return 'Pick an answer.'
    if (str(input.note).trim().length > MAX_NOTE) return 'Keep the note under 1,000 characters.'
    if (input.result !== 'read') return null
    var isYield = fig.figure === 'yield'
    var value = isYield ? parsePercent(input.value) : parseAssets(input.value)
    if (value === null) return isYield ? 'Type the yield the page shows.' : 'Type the net assets the page shows.'
    if (value !== value) return isYield ? percentProblem(input.value) : assetsProblem(input.value)
    if (isYield && value > MAX_YIELD_PCT) return 'Yields are typed in percent, like 1.25 for 1.25%. That looks too high.'
    if (!isYield && (value <= 0 || value > MAX_ASSETS_B)) return 'That does not look like a fund’s net assets. Type it the way the page shows it, like $45.1B.'
    var day = isoDay(input.asOf)
    if (!str(input.asOf).trim()) return 'Type the date the page gives for this figure (“as of …”).'
    if (!day) return 'Type the date as year-month-day, like 2026-10-16.'
    if (day < EARLIEST_DAY) return 'That date is before 2024. Type the date the page states for this figure.'
    // A day's grace: the owner's evening is already tomorrow in UTC.
    if (day > dayOf((nowMs || Date.now()) + 86400000)) return 'That date is in the future. Type the date the page states for this figure.'
    var kinds = isYield ? YIELD_KINDS : ASSET_KINDS
    if (!own(kinds, input.kind)) return isYield ? 'Say which kind of yield the page shows.' : 'Say whether the figure is this fund’s own or the whole fund’s.'
    return null
  }

  // ── what is stored ────────────────────────────────────────────────────────────
  function stamp(nowMs) { return new Date(nowMs).toISOString() }

  function readingDoc(fig, input, me, nowMs) {
    var read = input.result === 'read'
    var isYield = fig.figure === 'yield'
    return {
      result: input.result,
      value: read ? (isYield ? parsePercent(input.value) : parseAssets(input.value)) : null,
      // The assets figure as it was typed, unit and all, so a misread unit can be seen later.
      typed: read && !isYield ? str(input.value).trim().slice(0, 80) : '',
      asOf: read ? isoDay(input.asOf) : null,
      kind: read ? input.kind : null,
      note: str(input.note).trim().slice(0, MAX_NOTE),
      compared: fig.catalog,
      at: stamp(nowMs),
      by: me || null,
    }
  }

  function clearedDoc(fig, me, nowMs) {
    return { result: 'unchecked', value: null, typed: '', asOf: null, kind: null, note: '', compared: fig.catalog, at: stamp(nowMs), by: me || null }
  }

  // ── reading answers against the catalog as it is now ──────────────────────────
  function decimals(n) {
    var s = String(n)
    var i = s.indexOf('.')
    return i === -1 ? 0 : s.length - i - 1
  }

  /** Whether `value` is `catalog` at the catalog's own precision (1.23 is 1.2; 1.26 is not). */
  function sameAtCatalogPrecision(catalog, value) {
    if (typeof catalog !== 'number' || typeof value !== 'number') return false
    var p = Math.pow(10, decimals(catalog))
    return Math.round(value * p) === Math.round(catalog * p)
  }

  /** 'unchecked' | 'current' | 'stale' | 'applied'. `fig` is the catalog now. */
  function readingState(fig, reading) {
    if (!reading || reading.result === 'unchecked') return 'unchecked'
    if (reading.compared === fig.catalog) return 'current'
    if (reading.result === 'read' && sameAtCatalogPrecision(fig.catalog, reading.value)) return 'applied'
    return 'stale'
  }

  /** Counts for a set of figures. `read` is a current dated reading; `cantSee` is answered but unread. */
  function tally(figs, readingsById) {
    var t = { total: 0, answered: 0, read: 0, cantSee: 0, stale: 0 }
    ;(figs || []).forEach(function (f) {
      t.total++
      var r = readingsById[f.id]
      var s = readingState(f, r)
      if (s === 'unchecked') return
      if (s === 'stale') { t.stale++; return }
      t.answered++
      if (s === 'applied' || r.result === 'read') t.read++
      else if (r.result === 'cant-see') t.cantSee++
    })
    return t
  }

  /**
   * What the readings say, against the catalog as it is NOW. Nothing here changes the
   * catalog: Claude brings `differ` (and anything in `otherKind`) to the owner first.
   *   differ     — { id, symbol, figure, from, to, asOf, kind, note } read, and not the
   *                catalog's figure at its own precision
   *   same       — the same shape, where the reading is the catalog's figure at its precision
   *   otherKind  — readings of a different kind of figure than the catalog holds (a 30-day
   *                SEC yield, a whole-fund total for an ETF): never a like-for-like change
   *   cantSee    — ids answered "Can't find it"
   *   stale      — ids read against a catalog figure that has since changed (left out)
   *   applied    — ids whose reading the catalog already carries
   *   unread     — ids with no answer yet
   *   notes      — { id, note } for every current answer with a note
   *   oldestAsOf — the oldest date among current and applied readings, or null
   *   complete   — every figure has a current dated reading, so the catalog's compiled
   *                date could move to `oldestAsOf`. Until then it must not move at all.
   */
  function figurePlan(figs, readingsById) {
    var plan = { differ: [], same: [], otherKind: [], cantSee: [], stale: [], applied: [], unread: [], notes: [], oldestAsOf: null, complete: false }
    var list = figs || [], read = 0
    list.forEach(function (f) {
      var r = readingsById[f.id]
      var s = readingState(f, r)
      if (s === 'unchecked') { plan.unread.push(f.id); return }
      if (s === 'stale') { plan.stale.push(f.id); return }
      if (r.result === 'read') {
        // An applied reading still dates its figure: it counts toward `complete`.
        read++
        if (r.asOf && (plan.oldestAsOf === null || r.asOf < plan.oldestAsOf)) plan.oldestAsOf = r.asOf
      }
      if (s === 'applied') { plan.applied.push(f.id); return }
      if (r.note) plan.notes.push({ id: f.id, note: r.note })
      if (r.result === 'cant-see') { plan.cantSee.push(f.id); return }
      var item = { id: f.id, symbol: f.symbol, figure: f.figure, from: f.catalog, to: r.value, asOf: r.asOf, kind: r.kind, note: r.note }
      var likeForLike = f.figure === 'yield' ? r.kind === 'trailing' : r.kind === 'own'
      if (!likeForLike) plan.otherKind.push(item)
      else if (sameAtCatalogPrecision(f.catalog, r.value)) plan.same.push(item)
      else plan.differ.push(item)
    })
    plan.complete = list.length > 0 && read === list.length
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
    if (code === 'invalid_argument') return 'Your answer was refused. Only the page owner and editors can record readings.'
    if (code === 'quota_exceeded') return 'The page has reached its storage limit. Nothing was removed. Tell Claude.'
    return 'The reading could not be saved (' + (code || 'error') + '). Try again.'
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

    async function saveReading(fig, input) {
      var t = now()
      var problem = checkReading(fig, input, t)
      if (problem) return { error: problem, doc: null }
      var doc = readingDoc(fig, input, me, t)
      await write('readings', fig.id, doc)
      return { error: null, doc: doc }
    }

    async function clearReading(fig) {
      var doc = clearedDoc(fig, me, now())
      await write('readings', fig.id, doc)
      return { error: null, doc: doc }
    }

    async function saveFundNote(symbol, text) {
      var t = str(text).trim()
      if (t.length > MAX_NOTE) return { error: 'Keep the note under 1,000 characters.', doc: null }
      var doc = { text: t, at: stamp(now()), by: me }
      await write('notes', symbol, doc)
      return { error: null, doc: doc }
    }

    return { saveReading: saveReading, clearReading: clearReading, saveFundNote: saveFundNote }
  }

  // ── wording, decided here so the tests read what the page says ────────────────
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  /** "2026-09-15" → "September 15, 2026"; anything else comes back as given. */
  function longDay(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(iso))
    if (!m || +m[2] < 1 || +m[2] > 12) return str(iso)
    return MONTHS[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1]
  }

  function trim(n) { return String(Math.round(n * 1000) / 1000) }

  /** A catalog or read value in words: "1.2%", "$720 billion", "$850 million". */
  function figureText(figure, value) {
    if (typeof value !== 'number' || !isFinite(value)) return '—'
    if (figure === 'yield') return trim(value) + '%'
    return value >= 1 ? '$' + trim(value) + ' billion' : '$' + trim(value * 1000) + ' million'
  }

  /** What the catalog's figure is, and how to read the page's, for one figure row. */
  function figureGuidance(fund, fig) {
    var f = fund && typeof fund === 'object' ? fund : {}
    if (fig.figure === 'yield') {
      return 'The catalog holds a 12-month trailing distribution yield, compiled by hand and undated. ' +
        'If the page shows several yields, read that one. If it shows only a 30-day SEC yield, read that and say so.'
    }
    if (f.shareClass) {
      return 'Vanguard’s ETFs are share classes of larger funds, and the catalog holds the ETF’s own net assets. ' +
        'Read the ETF share class’s figure, not the whole fund’s.'
    }
    return 'The catalog holds this fund’s own net assets, compiled by hand and undated.'
  }

  /** Where a fund's card sends the owner. */
  function fundGuidance(fund) {
    var f = fund && typeof fund === 'object' ? fund : {}
    var site = str(f.website)
    var symbol = str(f.symbol), issuer = str(f.issuer)
    return site
      ? { href: site, label: 'Open ' + issuer + '’s page for ' + symbol, hint: ' If the link has moved, search “' + symbol + ' ' + issuer + '”.' }
      : { href: null, label: '', hint: 'No page on file. Search “' + symbol + ' ' + issuer + '”.' }
  }

  return {
    RESULTS: RESULTS, FIGURES: FIGURES, YIELD_KINDS: YIELD_KINDS, ASSET_KINDS: ASSET_KINDS, MAX_NOTE: MAX_NOTE, EARLIEST_DAY: EARLIEST_DAY,
    own: own, parsePercent: parsePercent, parseAssets: parseAssets, isoDay: isoDay,
    normReading: normReading, normFundNote: normFundNote,
    checkReading: checkReading, readingDoc: readingDoc,
    sameAtCatalogPrecision: sameAtCatalogPrecision, readingState: readingState, tally: tally, figurePlan: figurePlan,
    withRetry: withRetry, dbMessage: dbMessage, makeStore: makeStore,
    longDay: longDay, figureText: figureText, figureGuidance: figureGuidance, fundGuidance: fundGuidance,
  }
})(); // the semicolon matters: the client, inlined next, opens with "(" (see buildFundFiguresPage)
