/* Transfer Fee Check — browser side (drawing and wiring).
 *
 * Inlined into the page by scripts/lib/feeCheckPage.mjs, right after feeCheck.core.js and
 * inside the same wrapper, so `FeeCheckCore` is in scope here. It draws the whole check
 * list synchronously from the embedded table data, then lights up answers when the
 * claude.ai viewer hands it two runtime capabilities through `claude.use(name)`: `db`
 * (collections `checks`, `trading`, `notes`) and `user` (who answered). Either can resolve
 * null — a reader view, a copy opened outside claude.ai — and the list must still render.
 *
 * Rules this file keeps, pinned by lib/server/__tests__/feeCheckPage.test.ts:
 *   · It NEVER deletes. Every write goes through the core's store, which has no delete path.
 *   · It never writes markup built from text: every value goes in through textContent.
 *   · It renders only normalized rows (core.normRowCheck and friends), each in its own
 *     try/catch, so one malformed row cannot blank the list.
 *   · It records, it does not decide. An answer here changes nothing in the table until
 *     Claude applies it in a pull request and the owner merges it.
 */
(function (C) {
  'use strict'

  var DATA = {}
  try { DATA = JSON.parse(document.getElementById('fc-data').textContent || '{}') } catch (e) { DATA = {} }
  var EXS = Array.isArray(DATA.exchanges) ? DATA.exchanges : []
  var ROWS = [], ROW = {}, EX = {}
  EXS.forEach(function (ex) {
    EX[ex.id] = ex
    ex.rows = Array.isArray(ex.rows) ? ex.rows : []
    ex.leads = Array.isArray(ex.leads) ? ex.leads : []
    ex.rows.forEach(function (r) { r.exchange = ex.name; r.exchangeId = ex.id; ROWS.push(r); ROW[r.key] = r })
  })
  var HUMAN_ROWS = ROWS.filter(function (r) { return !EX[r.exchangeId].feed })
  var CORE_ROWS = ROWS.filter(function (r) { return r.core })

  // ── runtime state ────────────────────────────────────────────────────────────
  var store = null
  var canWrite = false        // set at start; a refused write turns it off for the visit
  var checks = {}, trading = {}, notes = {}
  var rowEls = {}, exEls = {}
  var view = { mode: 'core', hideDone: false }
  try {
    var saved = JSON.parse(localStorage.getItem('fc-view') || 'null')
    if (saved && (saved.mode === 'core' || saved.mode === 'all')) view.mode = saved.mode
    if (saved && saved.hideDone === true) view.hideDone = true
  } catch (e) { /* per-viewer convenience only */ }

  // ── tiny DOM helpers (textContent only) ──────────────────────────────────────
  function $(id) { return document.getElementById(id) }
  function el(tag, cls, text) {
    var e = document.createElement(tag)
    if (cls) e.className = cls
    if (text !== undefined && text !== null) e.textContent = String(text)
    return e
  }
  function button(text, cls, type) {
    var b = el('button', 'btn' + (cls ? ' ' + cls : ''), text)
    b.type = type || 'button'
    return b
  }
  function fmt(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—'
    return n.toLocaleString('en-US', { maximumFractionDigits: 12 })
  }
  function amount(n, unit) { return typeof n === 'number' && isFinite(n) ? fmt(n) + ' ' + unit : '—' }
  function pct(n) { return typeof n === 'number' && isFinite(n) ? fmt(n) + '%' : '—' }
  function day(iso) {
    var d = new Date(iso)
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  function safeId(s) { return String(s).replace(/[^A-Za-z0-9_-]/g, '-') }
  function field(id, label, placeholder, kind) {
    var wrap = el('div', 'field')
    var l = el('label', null, label)
    l.htmlFor = id
    var i = el(kind === 'area' ? 'textarea' : 'input')
    i.id = id
    if (kind !== 'area') { i.type = 'text'; i.inputMode = 'decimal'; i.autocomplete = 'off' } else { i.rows = 2 }
    if (placeholder) i.placeholder = placeholder
    wrap.appendChild(l)
    wrap.appendChild(i)
    return { wrap: wrap, input: i }
  }
  function setStatus(node, text, kind) {
    if (!node) return
    node.textContent = text || ''
    node.className = 'status' + (kind ? ' ' + kind : '')
    node.hidden = !text
  }

  // ── rows ─────────────────────────────────────────────────────────────────────
  var ROW_ANSWERS = ['ok', 'changed', 'not-offered', 'cant-see']

  function buildRow(r) {
    var root = el('div', 'row')
    root.dataset.key = r.key
    var what = el('div', 'what')
    what.appendChild(el('span', 'coin', r.coin))
    what.appendChild(el('span', 'net', r.network))
    if (r.core) what.appendChild(el('span', 'core-tag', 'Start here'))
    root.appendChild(what)

    var vals = el('dl', 'vals')
    ;[['Fee', amount(r.fee, r.coin)], ['Minimum', amount(r.min, r.coin)]].forEach(function (p) {
      var d = el('div')
      d.appendChild(el('dt', null, p[0]))
      d.appendChild(el('dd', 'mono', p[1]))
      vals.appendChild(d)
    })
    root.appendChild(vals)

    var flags = []
    if (r.withdraw === false) flags.push('The table says withdrawals are off')
    if (r.deposit === false) flags.push('The table says deposits are off')
    if (flags.length) root.appendChild(el('p', 'flags', flags.join(' · ')))
    if (r.note) root.appendChild(el('p', 'tnote', r.note))

    var ans = el('div', 'answer')
    var btns = el('div', 'btns')
    btns.setAttribute('role', 'group')
    btns.setAttribute('aria-label', 'Your answer for ' + r.exchange + ' ' + r.coin + ' on ' + r.network)
    var byAnswer = {}
    ROW_ANSWERS.forEach(function (a) {
      var b = button(a === 'changed' ? 'Different…' : C.ROW_RESULTS[a], 'ans a-' + a)
      b.setAttribute('aria-pressed', 'false')
      b.addEventListener('click', function () { onRowAnswer(r, a) })
      byAnswer[a] = b
      btns.appendChild(b)
    })
    ans.appendChild(btns)

    var state = el('div', 'state')
    state.setAttribute('aria-live', 'polite')
    ans.appendChild(state)

    var form = buildRowForm(r)
    ans.appendChild(form.root)
    root.appendChild(ans)
    rowEls[r.key] = { root: root, btns: byAnswer, state: state, form: form, busy: false }
    return root
  }

  function buildRowForm(r) {
    var f = el('form', 'diff')
    f.hidden = true
    f.noValidate = true
    var base = 'fc-' + safeId(r.key)
    var fee = field(base + '-fee', 'Fee it shows now (' + r.coin + ')', 'table: ' + fmt(r.fee))
    var min = field(base + '-min', 'Minimum it shows now (' + r.coin + ')', 'table: ' + fmt(r.min))
    var note = field(base + '-note', 'Note (optional)', 'For example: changes with network costs, saw 0.8 to 1.2', 'area')
    var nums = el('div', 'nums')
    nums.appendChild(fee.wrap)
    nums.appendChild(min.wrap)
    f.appendChild(nums)
    f.appendChild(note.wrap)
    var hint = el('p', 'hint', 'Leave a box empty if that figure has not changed.')
    f.appendChild(hint)
    var err = el('p', 'err')
    err.setAttribute('role', 'alert')
    err.hidden = true
    f.appendChild(err)
    var actions = el('div', 'actions')
    var save = button('Save', 'primary', 'submit')
    var cancel = button('Cancel', 'quiet')
    actions.appendChild(save)
    actions.appendChild(cancel)
    f.appendChild(actions)
    var form = { root: f, fee: fee, min: min, note: note, hint: hint, err: err, save: save, mode: 'changed' }
    cancel.addEventListener('click', function () { closeForm(form) })
    f.addEventListener('submit', function (e) {
      e.preventDefault()
      submitRowForm(r, form)
    })
    return form
  }

  function openRowForm(r, mode) {
    var els = rowEls[r.key]
    var form = els.form
    var c = checks[r.key]
    form.mode = mode
    form.fee.wrap.hidden = mode !== 'changed'
    form.min.wrap.hidden = mode !== 'changed'
    form.hint.hidden = mode !== 'changed'
    // Never pre-fill the table's own figures: blank means "not changed", and a copied
    // value would read as something the person saw.
    var mine = c && c.result === 'changed'
    form.fee.input.value = mine && c.fee !== null && c.fee !== r.fee ? String(c.fee) : ''
    form.min.input.value = mine && c.min !== null && c.min !== r.min ? String(c.min) : ''
    form.note.input.value = c ? c.note : ''
    form.err.hidden = true
    form.save.textContent = mode === 'changed' ? 'Save answer' : 'Save note'
    form.root.hidden = false
    ;(mode === 'changed' ? form.fee.input : form.note.input).focus()
  }

  function closeForm(form) { form.root.hidden = true; form.err.hidden = true }

  async function saveRowAnswer(r, input, form) {
    var els = rowEls[r.key]
    if (!store || !canWrite || els.busy) return
    els.busy = true
    paintRow(r, 'Saving…')
    try {
      var res = await store.saveRow(r, input)
      if (res.error) {
        if (form) { form.err.textContent = res.error; form.err.hidden = false }
        else paintRow(r, res.error)
        return
      }
      checks[r.key] = C.normRowCheck(r.key, res.doc)
      if (form) closeForm(form)
      paintRow(r)
      paintCounts()
    } catch (e) {
      if (e && e.code === 'invalid_argument') { canWrite = false; applyWriteGate() }
      var msg = C.dbMessage(e)
      if (form) { form.err.textContent = msg; form.err.hidden = false }
      paintRow(r, msg)
    } finally {
      els.busy = false
    }
  }

  function onRowAnswer(r, a) {
    if (a === 'changed') { openRowForm(r, 'changed'); return }
    var c = checks[r.key]
    saveRowAnswer(r, { result: a, note: c ? c.note : '' }, null)
  }

  function submitRowForm(r, form) {
    var c = checks[r.key]
    if (form.mode === 'note') {
      if (!c || C.answerState(r, c) !== 'current') { closeForm(form); return }
      var input = { result: c.result, note: form.note.input.value }
      if (c.result === 'changed') { input.fee = c.fee === null ? '' : String(c.fee); input.min = c.min === null ? '' : String(c.min) }
      saveRowAnswer(r, input, form)
      return
    }
    saveRowAnswer(r, { result: 'changed', fee: form.fee.input.value, min: form.min.input.value, note: form.note.input.value }, form)
  }

  async function clearRowAnswer(r) {
    var els = rowEls[r.key]
    if (!store || !canWrite || els.busy) return
    els.busy = true
    try {
      var res = await store.clearRow(r)
      checks[r.key] = C.normRowCheck(r.key, res.doc)
      closeForm(els.form)
      paintRow(r)
      paintCounts()
    } catch (e) {
      if (e && e.code === 'invalid_argument') { canWrite = false; applyWriteGate() }
      paintRow(r, C.dbMessage(e))
    } finally {
      els.busy = false
    }
  }

  function describe(r, c, s) {
    if (s === 'stale') {
      return 'Out of date: you answered when the table said ' + amount(c.comparedFee, r.coin) + ' (minimum ' + amount(c.comparedMin, r.coin) +
        '). It now says ' + amount(r.fee, r.coin) + ' (minimum ' + amount(r.min, r.coin) + '). Check it again.'
    }
    if (s === 'applied') return 'Your answer is in the table now · ' + day(c.at)
    if (c.result === 'changed') {
      var parts = []
      if (c.fee !== null && c.fee !== r.fee) parts.push('fee ' + amount(c.fee, r.coin) + ' (table ' + amount(r.fee, r.coin) + ')')
      if (c.min !== null && c.min !== r.min) parts.push('minimum ' + amount(c.min, r.coin) + ' (table ' + amount(r.min, r.coin) + ')')
      return 'Different: ' + (parts.join(', ') || 'see note') + ' · ' + day(c.at)
    }
    return C.ROW_RESULTS[c.result] + ' · ' + day(c.at)
  }

  function paintRow(r, message) {
    var els = rowEls[r.key]
    if (!els) return
    var c = checks[r.key]
    var s = C.answerState(r, c)
    var cls = 'row'
    if (s === 'stale') cls += ' is-stale'
    else if (s === 'applied') cls += ' is-applied'
    else if (s === 'current') cls += ' is-' + c.result
    if (r.core) cls += ' is-core'
    els.root.className = cls
    ROW_ANSWERS.forEach(function (a) {
      var b = els.btns[a]
      b.setAttribute('aria-pressed', String(s === 'current' && c.result === a))
      b.disabled = !canWrite || els.busy
    })
    applyVisibility(r)
    var st = els.state
    st.textContent = ''
    if (message) { st.appendChild(el('span', 'msg', message)); return }
    if (s === 'unchecked') return
    st.appendChild(el('span', 'said', describe(r, c, s)))
    if (s === 'current' && c.note) st.appendChild(el('span', 'note', 'Note: ' + c.note))
    if (canWrite && s === 'current') {
      var nb = button(c.note ? 'Edit note' : 'Add a note', 'link')
      nb.addEventListener('click', function () { openRowForm(r, 'note') })
      st.appendChild(nb)
    }
    if (canWrite && s !== 'applied') {
      var cb = button('Clear', 'link')
      cb.addEventListener('click', function () { clearRowAnswer(r) })
      st.appendChild(cb)
    }
  }

  function rowDone(r) {
    var s = C.answerState(r, checks[r.key])
    return s === 'current' || s === 'applied'
  }

  function applyVisibility(r) {
    var els = rowEls[r.key]
    if (!els) return
    var hide = (view.mode === 'core' && !r.core) || (view.hideDone && rowDone(r) && els.form.root.hidden)
    els.root.hidden = hide
  }

  // ── trading fee, one per exchange ───────────────────────────────────────────
  function buildTrading(ex) {
    var root = el('div', 'row trading')
    var what = el('div', 'what')
    what.appendChild(el('span', 'coin', 'Trading fee'))
    what.appendChild(el('span', 'net', 'spot, entry tier'))
    root.appendChild(what)
    var vals = el('dl', 'vals')
    var t = ex.trading
    ;[['Maker', t ? pct(t.makerPct) : 'not in the table'], ['Taker', t ? pct(t.takerPct) : 'not in the table']].forEach(function (p) {
      var d = el('div')
      d.appendChild(el('dt', null, p[0]))
      d.appendChild(el('dd', 'mono', p[1]))
      vals.appendChild(d)
    })
    root.appendChild(vals)
    if (t && t.note) root.appendChild(el('p', 'tnote', t.note))

    var ans = el('div', 'answer')
    var btns = el('div', 'btns')
    btns.setAttribute('role', 'group')
    btns.setAttribute('aria-label', 'Your answer for ' + ex.name + "'s trading fee")
    var byAnswer = {}
    ;['ok', 'changed', 'cant-see'].forEach(function (a) {
      var b = button(a === 'changed' ? 'Different…' : C.TRADING_RESULTS[a], 'ans a-' + a)
      b.setAttribute('aria-pressed', 'false')
      b.addEventListener('click', function () { onTradingAnswer(ex, a) })
      byAnswer[a] = b
      btns.appendChild(b)
    })
    ans.appendChild(btns)
    var state = el('div', 'state')
    state.setAttribute('aria-live', 'polite')
    ans.appendChild(state)

    var f = el('form', 'diff')
    f.hidden = true
    f.noValidate = true
    var base = 'fc-t-' + safeId(ex.id)
    var maker = field(base + '-maker', 'Maker fee (%)', t ? 'table: ' + fmt(t.makerPct) : 'for example 0.1')
    var taker = field(base + '-taker', 'Taker fee (%)', t ? 'table: ' + fmt(t.takerPct) : 'for example 0.1')
    var note = field(base + '-note', 'Note (optional)', 'For example: which account tier the page shows', 'area')
    var nums = el('div', 'nums')
    nums.appendChild(maker.wrap)
    nums.appendChild(taker.wrap)
    f.appendChild(nums)
    f.appendChild(note.wrap)
    var err = el('p', 'err')
    err.setAttribute('role', 'alert')
    err.hidden = true
    f.appendChild(err)
    var actions = el('div', 'actions')
    var save = button('Save answer', 'primary', 'submit')
    var cancel = button('Cancel', 'quiet')
    actions.appendChild(save)
    actions.appendChild(cancel)
    f.appendChild(actions)
    ans.appendChild(f)
    root.appendChild(ans)
    var form = { root: f, maker: maker, taker: taker, note: note, err: err }
    cancel.addEventListener('click', function () { closeForm(form) })
    f.addEventListener('submit', function (e) {
      e.preventDefault()
      saveTradingAnswer(ex, { result: 'changed', maker: maker.input.value, taker: taker.input.value, note: note.input.value }, form)
    })
    exEls[ex.id].trading = { root: root, btns: byAnswer, state: state, form: form, busy: false }
    return root
  }

  function onTradingAnswer(ex, a) {
    var els = exEls[ex.id].trading
    if (a === 'changed') {
      var c = trading[ex.id]
      var mine = c && c.result === 'changed'
      els.form.maker.input.value = mine && c.maker !== null ? String(c.maker) : ''
      els.form.taker.input.value = mine && c.taker !== null ? String(c.taker) : ''
      els.form.note.input.value = c ? c.note : ''
      els.form.err.hidden = true
      els.form.root.hidden = false
      els.form.maker.input.focus()
      return
    }
    var cur = trading[ex.id]
    saveTradingAnswer(ex, { result: a, note: cur ? cur.note : '' }, null)
  }

  async function saveTradingAnswer(ex, input, form) {
    var els = exEls[ex.id].trading
    if (!store || !canWrite || els.busy) return
    els.busy = true
    paintTrading(ex, 'Saving…')
    try {
      var res = input.result === 'unchecked' ? await store.clearTrading(ex) : await store.saveTrading(ex, input)
      if (res.error) {
        if (form) { form.err.textContent = res.error; form.err.hidden = false }
        paintTrading(ex, form ? null : res.error)
        return
      }
      trading[ex.id] = C.normTradingCheck(ex.id, res.doc)
      if (form) closeForm(form)
      paintTrading(ex)
      paintCounts()
    } catch (e) {
      if (e && e.code === 'invalid_argument') { canWrite = false; applyWriteGate() }
      var msg = C.dbMessage(e)
      if (form) { form.err.textContent = msg; form.err.hidden = false }
      paintTrading(ex, msg)
    } finally {
      els.busy = false
    }
  }

  function paintTrading(ex, message) {
    var els = exEls[ex.id] && exEls[ex.id].trading
    if (!els) return
    var c = trading[ex.id]
    var s = C.tradingState(ex.trading, c)
    var cls = 'row trading'
    if (s === 'stale') cls += ' is-stale'
    else if (s === 'applied') cls += ' is-applied'
    else if (s === 'current') cls += ' is-' + c.result
    els.root.className = cls
    ;['ok', 'changed', 'cant-see'].forEach(function (a) {
      els.btns[a].setAttribute('aria-pressed', String(s === 'current' && c.result === a))
      els.btns[a].disabled = !canWrite || els.busy
    })
    var st = els.state
    st.textContent = ''
    if (message) { st.appendChild(el('span', 'msg', message)); return }
    if (s === 'unchecked') return
    var text
    if (s === 'stale') text = 'Out of date: you answered when the table said maker ' + pct(c.comparedMaker) + ', taker ' + pct(c.comparedTaker) + '. Check it again.'
    else if (s === 'applied') text = 'Your answer is in the table now · ' + day(c.at)
    else if (c.result === 'changed') text = 'Different: maker ' + pct(c.maker) + ', taker ' + pct(c.taker) + ' · ' + day(c.at)
    else text = C.TRADING_RESULTS[c.result] + ' · ' + day(c.at)
    st.appendChild(el('span', 'said', text))
    if (s === 'current' && c.note) st.appendChild(el('span', 'note', 'Note: ' + c.note))
    if (canWrite && s !== 'applied') {
      var cb = button('Clear', 'link')
      cb.addEventListener('click', function () { saveTradingAnswer(ex, { result: 'unchecked' }, null) })
      st.appendChild(cb)
    }
  }

  // ── a note about the exchange (wrong link, login wall, region block) ─────────
  function buildExchangeNote(ex) {
    var d = el('details', 'exnote')
    var sum = el('summary', null, 'Note about ' + ex.name)
    d.appendChild(sum)
    var f = el('form')
    f.noValidate = true
    var area = field('fc-n-' + safeId(ex.id), 'For example: the fee page moved, it needs a login, or it is blocked where you are', '', 'area')
    f.appendChild(area.wrap)
    var actions = el('div', 'actions')
    var save = button('Save note', 'primary', 'submit')
    actions.appendChild(save)
    var st = el('span', 'status')
    st.hidden = true
    actions.appendChild(st)
    f.appendChild(actions)
    d.appendChild(f)
    var els = { root: d, summary: sum, input: area.input, save: save, status: st, busy: false }
    exEls[ex.id].note = els
    f.addEventListener('submit', async function (e) {
      e.preventDefault()
      if (!store || !canWrite || els.busy) return
      els.busy = true
      setStatus(st, 'Saving…')
      try {
        var res = await store.saveExchangeNote(ex.id, area.input.value)
        if (res.error) { setStatus(st, res.error, 'err'); return }
        notes[ex.id] = C.normExchangeNote(ex.id, res.doc)
        setStatus(st, 'Saved')
        paintExchangeNote(ex)
      } catch (err) {
        if (err && err.code === 'invalid_argument') { canWrite = false; applyWriteGate() }
        setStatus(st, C.dbMessage(err), 'err')
      } finally {
        els.busy = false
      }
    })
    return d
  }

  function paintExchangeNote(ex) {
    var els = exEls[ex.id] && exEls[ex.id].note
    if (!els) return
    var n = notes[ex.id]
    els.summary.textContent = n && n.text ? 'Note about ' + ex.name + ': ' + (n.text.length > 70 ? n.text.slice(0, 70) + '…' : n.text) : 'Note about ' + ex.name
    if (document.activeElement !== els.input) els.input.value = n ? n.text : ''
    els.save.disabled = !canWrite
    els.input.readOnly = !canWrite
  }

  // ── exchanges ────────────────────────────────────────────────────────────────
  function buildExchange(ex) {
    var sec = el('section', 'ex')
    sec.id = 'ex-' + safeId(ex.id)
    exEls[ex.id] = { root: sec }
    var head = el('div', 'ex-head')
    var h = el('h3', 'ex-name', ex.name)
    head.appendChild(h)
    head.appendChild(el('span', 'tier', ex.tier === 1 ? 'Tier 1' : 'Tier 2'))
    var count = el('span', 'ex-count')
    head.appendChild(count)
    exEls[ex.id].count = count
    sec.appendChild(head)

    var links = el('p', 'ex-link')
    if (ex.feePage) {
      var a = el('a', 'feepage', 'Open ' + ex.name + '’s fee page')
      a.href = ex.feePage
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      links.appendChild(a)
      links.appendChild(el('span', 'hint', ' If the link has moved, search “' + ex.name + ' withdrawal fees”.'))
    } else {
      links.appendChild(el('span', 'hint', 'No fee page on file. Search “' + ex.name + ' withdrawal fees”.'))
    }
    sec.appendChild(links)

    if (ex.feed) {
      sec.appendChild(el('p', 'callout',
        ex.name + ' publishes its withdrawal fees in a public feed, so npm run fee-reconcile on your computer checks most of these rows in one run. ' +
        'Leave them for that; its trading fee still needs a look.'))
    }
    if (ex.prohibited) {
      sec.appendChild(el('p', 'callout warn',
        'The app’s source-terms register marks ' + ex.prohibited + ' prohibited, so the app never contacts it. ' +
        'These rows were typed in by hand from its public fee page. Ask Claude before spending long on them.'))
    }
    if (ex.leads.length) {
      var box = el('div', 'leads')
      box.appendChild(el('p', 'leads-h', 'Things to look for here'))
      var ul = el('ul')
      ex.leads.forEach(function (l) {
        var li = el('li')
        li.appendChild(el('b', 'lead-id mono', l.id))
        li.appendChild(document.createTextNode(' ' + l.title))
        if (l.summary) li.appendChild(el('span', 'lead-sum', l.summary))
        ul.appendChild(li)
      })
      box.appendChild(ul)
      sec.appendChild(box)
    }
    var list = el('div', 'rows')
    ex.rows.forEach(function (r) { list.appendChild(buildRow(r)) })
    sec.appendChild(list)
    sec.appendChild(buildTrading(ex))
    sec.appendChild(buildExchangeNote(ex))
    return sec
  }

  function exchangeVisible(ex) {
    if (view.mode === 'all') return true
    return ex.rows.some(function (r) { return r.core }) || ex.leads.length > 0
  }

  function paintExchange(ex) {
    var e = exEls[ex.id]
    if (!e) return
    var t = C.tally(ex.rows, checks)
    e.count.textContent = t.answered + ' of ' + t.total + ' answered' + (t.stale ? ' · ' + t.stale + ' out of date' : '')
    e.root.hidden = !exchangeVisible(ex)
  }

  // ── page-level ───────────────────────────────────────────────────────────────
  function paintCounts() {
    var human = C.tally(HUMAN_ROWS, checks)
    var core = C.tally(CORE_ROWS, checks)
    var tradingDone = EXS.filter(function (ex) {
      var s = C.tradingState(ex.trading, trading[ex.id])
      return s === 'current' || s === 'applied'
    }).length
    var p = $('fc-progress')
    if (p) {
      p.textContent = ''
      ;[
        [core.answered, core.total, 'Start here'],
        [human.answered, human.total, 'rows to check by hand'],
        [tradingDone, EXS.length, 'trading fees'],
      ].forEach(function (x) {
        var d = el('div', 'meter')
        var n = el('p', 'meter-n mono')
        n.appendChild(el('b', null, String(x[0])))
        n.appendChild(document.createTextNode(' of ' + x[1]))
        d.appendChild(n)
        d.appendChild(el('p', 'meter-l', x[2]))
        var bar = el('div', 'bar')
        var fill = el('span')
        fill.style.width = (x[1] ? Math.round((100 * x[0]) / x[1]) : 0) + '%'
        bar.appendChild(fill)
        d.appendChild(bar)
        p.appendChild(d)
      })
    }
    var stale = C.tally(ROWS, checks).stale
    setStatus($('fc-stale'), stale ? stale + (stale === 1 ? ' answer was' : ' answers were') + ' given before the table changed. Those rows say “Out of date”; check them again.' : '', 'warn')
    EXS.forEach(paintExchange)
  }

  function paintAll() {
    ROWS.forEach(function (r) { try { paintRow(r) } catch (e) { /* one bad row must not blank the list */ } })
    EXS.forEach(function (ex) {
      try { paintTrading(ex) } catch (e) { /* skipped */ }
      try { paintExchangeNote(ex) } catch (e) { /* skipped */ }
    })
    paintCounts()
  }

  function applyView() {
    $('fc-mode-core').setAttribute('aria-pressed', String(view.mode === 'core'))
    $('fc-mode-all').setAttribute('aria-pressed', String(view.mode === 'all'))
    $('fc-hide').checked = view.hideDone
    ROWS.forEach(applyVisibility)
    EXS.forEach(paintExchange)
    try { localStorage.setItem('fc-view', JSON.stringify(view)) } catch (e) { /* convenience only */ }
  }

  function applyWriteGate() {
    ROWS.forEach(function (r) { try { paintRow(r) } catch (e) { /* skipped */ } })
    EXS.forEach(function (ex) { try { paintTrading(ex); paintExchangeNote(ex) } catch (e) { /* skipped */ } })
    if (!canWrite && store) setStatus($('fc-conn'), 'You can read the answers here. Only the page owner and editors can record them.', 'warn')
  }

  function buildLeads() {
    var host = $('fc-leads')
    if (!host) return
    var all = []
    EXS.forEach(function (ex) { ex.leads.forEach(function (l) { all.push({ lead: l, ex: ex }) }) })
    var general = Array.isArray(DATA.generalLeads) ? DATA.generalLeads : []
    if (!all.length && !general.length) { host.hidden = true; return }
    var ul = el('ul')
    general.forEach(function (l) {
      var li = el('li')
      li.appendChild(el('b', 'lead-id mono', l.id))
      li.appendChild(document.createTextNode(' ' + l.title + ' '))
      li.appendChild(el('span', 'lead-where', 'every exchange'))
      if (l.summary) li.appendChild(el('span', 'lead-sum', l.summary))
      ul.appendChild(li)
    })
    all.forEach(function (x) {
      var li = el('li')
      li.appendChild(el('b', 'lead-id mono', x.lead.id))
      li.appendChild(document.createTextNode(' ' + x.lead.title + ' '))
      var a = el('a', 'lead-where', x.ex.name)
      a.href = '#ex-' + safeId(x.ex.id)
      li.appendChild(a)
      ul.appendChild(li)
    })
    host.appendChild(ul)
  }

  function build() {
    var host = $('fc-exchanges')
    EXS.forEach(function (ex) {
      try { host.appendChild(buildExchange(ex)) } catch (e) { /* one bad exchange must not blank the list */ }
    })
    buildLeads()
    $('fc-mode-core').addEventListener('click', function () { view.mode = 'core'; applyView() })
    $('fc-mode-all').addEventListener('click', function () { view.mode = 'all'; applyView() })
    $('fc-hide').addEventListener('change', function (e) { view.hideDone = !!e.target.checked; applyView() })
    paintAll()
    applyView()
  }

  // ── start ────────────────────────────────────────────────────────────────────
  async function start() {
    var conn = $('fc-conn')
    var runtime = window.claude
    if (!runtime || typeof runtime.use !== 'function') {
      setStatus(conn, 'This copy of the page cannot save answers. Open the published page on claude.ai to record them.', 'err')
      return
    }
    setStatus(conn, 'Connecting…')
    var got = await Promise.all([runtime.use('db'), runtime.use('user')])
    var db = got[0], user = got[1]
    if (!db) {
      setStatus(conn, 'Answers are not available in this view. Sign in to claude.ai and open the page there.', 'err')
      return
    }
    var me = null, editor = null
    if (user) {
      try { me = await user.id() } catch (e) { me = null }
      try { editor = await user.canEdit() } catch (e) { editor = null }
    }
    // The page's db rule reserves writes for editors (admin). When the platform says
    // nothing, keep the controls and let a refused write decide.
    canWrite = editor !== false
    store = C.makeStore({ db: db, me: me })
    setStatus(conn, canWrite ? 'Your answers save to this page as you go.' : '', canWrite ? 'ok' : '')
    applyWriteGate()

    db.collection('checks').onSnapshot(function (snap) {
      var next = {}
      snap.docs.forEach(function (d) {
        try { next[d.id] = C.normRowCheck(d.id, d.data()) } catch (e) { /* unreadable row: skipped */ }
      })
      checks = next
      paintAll()
    }, function (e) { setStatus($('fc-conn'), 'Answers stopped updating (' + ((e && e.code) || 'error') + '). Reload to reconnect.', 'err') })

    db.collection('trading').onSnapshot(function (snap) {
      var next = {}
      snap.docs.forEach(function (d) {
        try { next[d.id] = C.normTradingCheck(d.id, d.data()) } catch (e) { /* skipped */ }
      })
      trading = next
      EXS.forEach(function (ex) { try { paintTrading(ex) } catch (e) { /* skipped */ } })
      paintCounts()
    }, function (e) { setStatus($('fc-conn'), 'Trading-fee answers stopped updating (' + ((e && e.code) || 'error') + '). Reload to reconnect.', 'err') })

    db.collection('notes').onSnapshot(function (snap) {
      var next = {}
      snap.docs.forEach(function (d) {
        try { next[d.id] = C.normExchangeNote(d.id, d.data()) } catch (e) { /* skipped */ }
      })
      notes = next
      EXS.forEach(function (ex) { try { paintExchangeNote(ex) } catch (e) { /* skipped */ } })
    }, function (e) { setStatus($('fc-conn'), 'Exchange notes stopped updating (' + ((e && e.code) || 'error') + '). Reload to reconnect.', 'err') })
  }

  build()
  start()
})(FeeCheckCore)
