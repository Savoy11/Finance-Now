/* Transfer Fee Check — CORE (no DOM).
 *
 * The owner's check page for the hand pass over the transfer-fee table (T-031, D52).
 * Every decision the page makes, and every write it makes, lives here, so the tests can
 * run it for real (lib/server/__tests__/feeCheckPage.test.ts loads this file with
 * `new Function`), and so the session that applies the answers reads them through the
 * same rules the page saved them under (scripts/fee-check-plan.ts loads it the same way).
 * feeCheck.client.js draws the page and calls into this; the page builder inlines both
 * inside one wrapper, so `FeeCheckCore` never becomes a page global.
 *
 * What it keeps true:
 *  · NOTHING IS DELETED. A newer answer replaces an older one, and "Clear" stores
 *    `unchecked`. The store has no delete path (the owner's standing rule, 2026-09-12).
 *  · BLANK MEANS UNKNOWN. A row counts only once someone picked an answer. "Matches" is a
 *    choice, never a default, and "Different" carrying the table's own figures is refused:
 *    it would record a change that is not one.
 *  · AN ANSWER REMEMBERS WHAT IT WAS COMPARED AGAINST. When the table moves after an
 *    answer was given, the answer reads as out of date and applyPlan() leaves it out, so a
 *    stale answer can never overwrite newer data. A table that moved TO the answer means
 *    the answer was applied.
 *  · A COMMA IS NEVER GUESSED AT. "0,0005" is a decimal comma on many fee pages and a
 *    thousands separator in "1,000"; stripping commas would read the first as 5, a
 *    10,000× error. Only thousands grouping is accepted; anything else is refused.
 *  · applyPlan() writes `fee-apply`'s own worksheet columns, so a changed fee goes through
 *    the same three guards as a hand-filled worksheet (scripts/apply-fee-updates.ts).
 */
var FeeCheckCore = (function () {
  'use strict'

  var ROW_RESULTS = {
    ok: 'Matches',
    changed: 'Different',
    'not-offered': 'Not offered',
    'cant-see': "Can't see it",
    unchecked: 'Not checked',
  }
  var TRADING_RESULTS = { ok: 'Matches', changed: 'Different', 'cant-see': "Can't see it", unchecked: 'Not checked' }
  /** Answers that settle a row: the table can be dated by them. "Can't see it" does not. */
  var SETTLES = { ok: true, changed: true, 'not-offered': true }
  var MAX_NOTE = 1000
  /** `fee-apply`'s worksheet columns (scripts/apply-fee-updates.ts, parseCsv). A test pins them. */
  var APPLY_COLUMNS = ['Exchange', 'Coin', 'Network', 'Current fee', 'ACTUAL fee', 'Status (ok/changed/delisted/unavailable)']

  function own(o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k) }
  function str(v) { return typeof v === 'string' ? v : '' }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null }

  /**
   * What a person typed as an amount. "" → null (nothing typed); a readable non-negative
   * number → that number; anything else → NaN. Accepts "0.0005", "2.5", "1,000",
   * "50,000,000". Refuses "0,0005", "1.000,5", "-1", "1e-4".
   */
  function parseAmount(v) {
    if (typeof v === 'number') return isFinite(v) && v >= 0 ? v : NaN
    var s = str(v).trim()
    if (!s) return null
    if (s.indexOf(',') !== -1) {
      if (!/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return NaN
      s = s.replace(/,/g, '')
    }
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return NaN
    var n = Number(s)
    return isFinite(n) && n >= 0 ? n : NaN
  }

  function amountProblem(typed, what) {
    if (/,/.test(str(typed))) return 'Use a dot for decimals, like 0.0005. A comma is only allowed between thousands, like 1,000.'
    return 'Type the ' + what + ' as a number, like 0.0005.'
  }

  // ── stored rows, whatever a writer stored (db.d.ts: no schema) ────────────────
  function normRowCheck(id, x) {
    x = x && typeof x === 'object' ? x : {}
    return {
      key: String(id),
      result: own(ROW_RESULTS, x.result) ? x.result : 'unchecked',
      fee: num(x.fee),
      min: num(x.min),
      note: str(x.note).slice(0, MAX_NOTE),
      comparedFee: num(x.comparedFee),
      comparedMin: num(x.comparedMin),
      at: str(x.at),
      by: str(x.by) || null,
    }
  }

  function normTradingCheck(id, x) {
    x = x && typeof x === 'object' ? x : {}
    return {
      exchangeId: String(id),
      result: own(TRADING_RESULTS, x.result) ? x.result : 'unchecked',
      maker: num(x.maker),
      taker: num(x.taker),
      note: str(x.note).slice(0, MAX_NOTE),
      comparedMaker: num(x.comparedMaker),
      comparedTaker: num(x.comparedTaker),
      at: str(x.at),
      by: str(x.by) || null,
    }
  }

  function normExchangeNote(id, x) {
    x = x && typeof x === 'object' ? x : {}
    return { exchangeId: String(id), text: str(x.text).slice(0, MAX_NOTE), at: str(x.at), by: str(x.by) || null }
  }

  // ── validation ────────────────────────────────────────────────────────────────
  /** Why a row answer cannot be saved yet, or null. `input.fee` / `input.min` are as typed. */
  function checkRowAnswer(row, input) {
    input = input || {}
    if (!own(ROW_RESULTS, input.result) || input.result === 'unchecked') return 'Pick an answer.'
    if (str(input.note).trim().length > MAX_NOTE) return 'Keep the note under 1,000 characters.'
    if (input.result !== 'changed') return null
    var fee = parseAmount(input.fee), min = parseAmount(input.min)
    if (fee !== fee) return amountProblem(input.fee, 'fee')
    if (min !== min) return amountProblem(input.min, 'minimum')
    if (fee === null && min === null) return 'Type the fee the exchange shows now, or its new minimum.'
    if ((fee === null || fee === row.fee) && (min === null || min === row.min)) {
      return 'That is what the table already says. Choose Matches instead.'
    }
    return null
  }

  /** Why a trading-fee answer cannot be saved yet, or null. Percent values, as typed. */
  function checkTradingAnswer(trading, input) {
    input = input || {}
    if (!own(TRADING_RESULTS, input.result) || input.result === 'unchecked') return 'Pick an answer.'
    if (str(input.note).trim().length > MAX_NOTE) return 'Keep the note under 1,000 characters.'
    if (input.result === 'ok' && !trading) return 'The table has no trading fee for this exchange yet. Choose Different and type what it shows.'
    if (input.result !== 'changed') return null
    var maker = parseAmount(input.maker), taker = parseAmount(input.taker)
    if (maker !== maker) return amountProblem(input.maker, 'maker fee')
    if (taker !== taker) return amountProblem(input.taker, 'taker fee')
    if (maker === null || taker === null) return 'Type both the maker and the taker fee, in percent.'
    if (maker > 10 || taker > 10) return 'Trading fees are typed in percent, like 0.1 for 0.1%. That looks too high.'
    if (trading && maker === trading.makerPct && taker === trading.takerPct) return 'That is what the table already says. Choose Matches instead.'
    return null
  }

  // ── what is stored ────────────────────────────────────────────────────────────
  function stamp(nowMs) { return new Date(nowMs).toISOString() }

  function rowDoc(row, input, me, nowMs) {
    var changed = input.result === 'changed'
    var fee = changed ? parseAmount(input.fee) : null
    var min = changed ? parseAmount(input.min) : null
    return {
      result: input.result,
      // A "Different" answer always records both figures as the exchange shows them: what
      // was left blank is the table's own value, which the person saw and did not change.
      fee: changed ? (fee === null ? row.fee : fee) : null,
      min: changed ? (min === null ? row.min : min) : null,
      note: str(input.note).trim().slice(0, MAX_NOTE),
      comparedFee: row.fee,
      comparedMin: row.min,
      at: stamp(nowMs),
      by: me || null,
    }
  }

  function clearedRowDoc(row, me, nowMs) {
    return { result: 'unchecked', fee: null, min: null, note: '', comparedFee: row.fee, comparedMin: row.min, at: stamp(nowMs), by: me || null }
  }

  function tradingDoc(trading, input, me, nowMs) {
    var changed = input.result === 'changed'
    return {
      result: input.result,
      maker: changed ? parseAmount(input.maker) : null,
      taker: changed ? parseAmount(input.taker) : null,
      note: str(input.note).trim().slice(0, MAX_NOTE),
      comparedMaker: trading ? trading.makerPct : null,
      comparedTaker: trading ? trading.takerPct : null,
      at: stamp(nowMs),
      by: me || null,
    }
  }

  // ── reading answers against the table as it is now ────────────────────────────
  /**
   * 'unchecked' | 'current' | 'stale' | 'applied'. `row` is the table now; `check` a
   * normalized stored answer (or undefined).
   */
  function answerState(row, check) {
    if (!check || check.result === 'unchecked') return 'unchecked'
    if (check.comparedFee === row.fee && check.comparedMin === row.min) return 'current'
    if (check.result === 'changed' && check.fee === row.fee && check.min === row.min) return 'applied'
    return 'stale'
  }

  function tradingState(trading, check) {
    if (!check || check.result === 'unchecked') return 'unchecked'
    var maker = trading ? trading.makerPct : null, taker = trading ? trading.takerPct : null
    if (check.comparedMaker === maker && check.comparedTaker === taker) return 'current'
    if (check.result === 'changed' && check.maker === maker && check.taker === taker) return 'applied'
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

  // ── the plan the session applies ──────────────────────────────────────────────
  function csvCell(v) {
    var s = v === undefined || v === null ? '' : String(v)
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }

  /**
   * What the answers ask the table to do, against the table as it is NOW.
   *   csv          — the changed fees, in `fee-apply`'s worksheet columns (header always present)
   *   feeChanges   — { key, from, to } for each of those rows
   *   minChanges   — { key, from, to }: minimums, applied by hand (fee-apply moves fees only)
   *   notOffered   — keys the exchange no longer offers (a row removal, by hand)
   *   confirmed    — keys answered "Matches"
   *   cantSee      — keys answered "Can't see it"
   *   stale        — keys whose answer was given against different table figures (left out)
   *   applied      — keys whose answer the table already carries
   *   notes        — { key, note } for every current answer with a note
   */
  function applyPlan(rows, checksByKey) {
    var plan = { csv: '', feeChanges: [], minChanges: [], notOffered: [], confirmed: [], cantSee: [], stale: [], applied: [], notes: [] }
    var lines = [APPLY_COLUMNS.map(csvCell).join(',')]
    ;(rows || []).forEach(function (r) {
      var c = checksByKey[r.key]
      var s = answerState(r, c)
      if (s === 'unchecked') return
      if (s === 'stale') { plan.stale.push(r.key); return }
      if (s === 'applied') { plan.applied.push(r.key); return }
      if (c.note) plan.notes.push({ key: r.key, note: c.note })
      if (c.result === 'ok') plan.confirmed.push(r.key)
      else if (c.result === 'not-offered') plan.notOffered.push(r.key)
      else if (c.result === 'cant-see') plan.cantSee.push(r.key)
      else if (c.result === 'changed') {
        if (c.fee !== null && c.fee !== r.fee) {
          plan.feeChanges.push({ key: r.key, from: r.fee, to: c.fee })
          lines.push([r.exchange, r.coin, r.network, r.fee, c.fee, 'changed'].map(csvCell).join(','))
        }
        if (c.min !== null && c.min !== r.min) plan.minChanges.push({ key: r.key, from: r.min, to: c.min })
      }
    })
    plan.csv = lines.join('\n') + '\n'
    return plan
  }

  /** Trading-fee answers against the table now: { changes, confirmed, cantSee, stale, notes }. */
  function tradingPlan(exchanges, checksById) {
    var out = { changes: [], confirmed: [], cantSee: [], stale: [], notes: [] }
    ;(exchanges || []).forEach(function (ex) {
      var c = checksById[ex.id]
      var s = tradingState(ex.trading, c)
      if (s === 'unchecked' || s === 'applied') return
      if (s === 'stale') { out.stale.push(ex.id); return }
      if (c.note) out.notes.push({ exchangeId: ex.id, note: c.note })
      if (c.result === 'ok') out.confirmed.push(ex.id)
      else if (c.result === 'cant-see') out.cantSee.push(ex.id)
      else if (c.result === 'changed') {
        out.changes.push({
          exchangeId: ex.id,
          from: ex.trading ? { maker: ex.trading.makerPct, taker: ex.trading.takerPct } : null,
          to: { maker: c.maker, taker: c.taker },
        })
      }
    })
    return out
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

    async function saveRow(row, input) {
      var problem = checkRowAnswer(row, input)
      if (problem) return { error: problem, doc: null }
      var doc = rowDoc(row, input, me, now())
      await write('checks', row.key, doc)
      return { error: null, doc: doc }
    }

    async function clearRow(row) {
      var doc = clearedRowDoc(row, me, now())
      await write('checks', row.key, doc)
      return { error: null, doc: doc }
    }

    async function saveTrading(exchange, input) {
      var problem = checkTradingAnswer(exchange.trading, input)
      if (problem) return { error: problem, doc: null }
      var doc = tradingDoc(exchange.trading, input, me, now())
      await write('trading', exchange.id, doc)
      return { error: null, doc: doc }
    }

    async function clearTrading(exchange) {
      var doc = tradingDoc(exchange.trading, { result: 'unchecked' }, me, now())
      await write('trading', exchange.id, doc)
      return { error: null, doc: doc }
    }

    async function saveExchangeNote(exchangeId, text) {
      var t = str(text).trim()
      if (t.length > MAX_NOTE) return { error: 'Keep the note under 1,000 characters.', doc: null }
      var doc = { text: t, at: stamp(now()), by: me }
      await write('notes', exchangeId, doc)
      return { error: null, doc: doc }
    }

    return { saveRow: saveRow, clearRow: clearRow, saveTrading: saveTrading, clearTrading: clearTrading, saveExchangeNote: saveExchangeNote }
  }

  return {
    ROW_RESULTS: ROW_RESULTS, TRADING_RESULTS: TRADING_RESULTS, SETTLES: SETTLES, MAX_NOTE: MAX_NOTE,
    APPLY_COLUMNS: APPLY_COLUMNS,
    own: own, parseAmount: parseAmount,
    normRowCheck: normRowCheck, normTradingCheck: normTradingCheck, normExchangeNote: normExchangeNote,
    checkRowAnswer: checkRowAnswer, checkTradingAnswer: checkTradingAnswer,
    rowDoc: rowDoc, tradingDoc: tradingDoc,
    answerState: answerState, tradingState: tradingState, tally: tally,
    applyPlan: applyPlan, tradingPlan: tradingPlan,
    withRetry: withRetry, dbMessage: dbMessage, makeStore: makeStore,
  }
})(); // the semicolon matters: the client, inlined next, opens with "(" (see buildFeeCheckPage)
