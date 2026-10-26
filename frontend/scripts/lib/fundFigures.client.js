/* Fund Figures Check — browser side (drawing and wiring).
 *
 * Inlined into the page by scripts/lib/fundFiguresPage.mjs, right after
 * fundFigures.core.js and inside the same wrapper, so `FundFiguresCore` is in scope here.
 * It draws every card synchronously from the embedded catalog data, then lights up the
 * readings when the claude.ai viewer hands it two runtime capabilities through
 * `claude.use(name)`: `db` (collections `readings`, `notes`) and `user` (who read it).
 * Either can resolve null — a reader view, a copy opened outside claude.ai — and the list
 * must still render.
 *
 * Rules this file keeps, pinned by lib/server/__tests__/fundFiguresPage.test.ts:
 *   · It NEVER deletes. Every write goes through the core's store, which has no delete path.
 *   · It never writes markup built from text: every value goes in through textContent.
 *   · It never pre-fills a reading from the catalog: what is typed is what the page showed.
 *   · It renders only normalized rows (core.normReading and friends), each in its own
 *     try/catch, so one malformed row cannot blank the list.
 *   · It records, it does not decide. A reading changes nothing in the catalog until Claude
 *     brings the differences to the owner and a pull request is merged.
 */
(function (C) {
  'use strict'

  var DATA = {}
  try { DATA = JSON.parse(document.getElementById('ff-data').textContent || '{}') } catch (e) { DATA = {} }
  var FUNDS = Array.isArray(DATA.funds) ? DATA.funds : []
  var FIGS = [], FUND = {}
  FUNDS.forEach(function (f) {
    FUND[f.symbol] = f
    f.figures = Array.isArray(f.figures) ? f.figures : []
    f.figures.forEach(function (g) { FIGS.push(g) })
  })
  var START_FIGS = FIGS.filter(function (g) { return FUND[g.symbol] && FUND[g.symbol].startHere })
  var HAS_START = START_FIGS.length > 0

  // ── runtime state ────────────────────────────────────────────────────────────
  var store = null
  var canWrite = false        // set at start; a refused write turns it off for the visit
  var readings = {}, notes = {}
  var figEls = {}, fundEls = {}
  var lastDay = ''            // the last "as of" date saved this visit, offered as a shortcut
  var view = { mode: HAS_START ? 'start' : 'all', hideDone: false }
  try {
    var saved = JSON.parse(localStorage.getItem('ff-view') || 'null')
    if (saved && (saved.mode === 'start' || saved.mode === 'all') && (HAS_START || saved.mode === 'all')) view.mode = saved.mode
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
  function day(iso) {
    var d = new Date(iso)
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  function safeId(s) { return String(s).replace(/[^A-Za-z0-9_-]/g, '-') }
  function field(id, label, placeholder, kind) {
    var wrap = el('div', 'field')
    var l = el('label', null, label)
    l.htmlFor = id
    var i
    if (kind === 'area') { i = el('textarea'); i.rows = 2 }
    else if (kind === 'date') { i = el('input'); i.type = 'date' }
    else { i = el('input'); i.type = 'text'; i.inputMode = kind === 'decimal' ? 'decimal' : 'text'; i.autocomplete = 'off' }
    i.id = id
    if (placeholder) i.placeholder = placeholder
    wrap.appendChild(l)
    wrap.appendChild(i)
    return { wrap: wrap, input: i }
  }
  function select(id, label, options) {
    var wrap = el('div', 'field')
    var l = el('label', null, label)
    l.htmlFor = id
    var s = el('select')
    s.id = id
    var blank = el('option', null, 'Choose one')
    blank.value = ''
    s.appendChild(blank)
    Object.keys(options).forEach(function (k) {
      var o = el('option', null, options[k])
      o.value = k
      s.appendChild(o)
    })
    wrap.appendChild(l)
    wrap.appendChild(s)
    return { wrap: wrap, input: s }
  }
  function setStatus(node, text, kind) {
    if (!node) return
    node.textContent = text || ''
    node.className = 'status' + (kind ? ' ' + kind : '')
    node.hidden = !text
  }

  // A save paints while busy (the store's own snapshot can arrive mid-write), so its
  // buttons are re-enabled once it finishes; otherwise they stay greyed until the next one.
  function enableButtons(btns) { Object.keys(btns).forEach(function (a) { btns[a].disabled = !canWrite }) }

  // ── one figure row ───────────────────────────────────────────────────────────
  var ANSWERS = ['read', 'cant-see']

  function buildFigure(fund, g) {
    var root = el('div', 'row')
    root.dataset.id = g.id
    var what = el('div', 'what')
    what.appendChild(el('span', 'coin', C.FIGURES[g.figure] || g.figure))
    root.appendChild(what)

    var vals = el('dl', 'vals')
    var d = el('div')
    d.appendChild(el('dt', null, 'Catalog'))
    // "≈" marks an undated figure only; one read from the page carries the page's date instead.
    var asOf = C.isoDay(g.catalogAsOf)
    d.appendChild(el('dd', 'mono', (g.figure === 'assets' && !asOf ? '≈ ' : '') + C.figureText(g.figure, g.catalog)))
    vals.appendChild(d)
    if (asOf) {
      var dd = el('div')
      dd.appendChild(el('dt', null, 'As of'))
      dd.appendChild(el('dd', 'mono', C.longDay(asOf)))
      vals.appendChild(dd)
    }
    root.appendChild(vals)
    root.appendChild(el('p', 'tnote', C.figureGuidance(fund, g)))
    if (g.suggestion) root.appendChild(buildSuggestion(g))

    var ans = el('div', 'answer')
    var btns = el('div', 'btns')
    btns.setAttribute('role', 'group')
    btns.setAttribute('aria-label', 'Your answer for ' + fund.symbol + ' ' + (C.FIGURES[g.figure] || g.figure).toLowerCase())
    var byAnswer = {}
    ANSWERS.forEach(function (a) {
      var b = button(a === 'read' ? 'I read it…' : C.RESULTS[a], 'ans a-' + (a === 'read' ? 'ok' : a))
      b.setAttribute('aria-pressed', 'false')
      b.addEventListener('click', function () { onAnswer(g, a) })
      byAnswer[a] = b
      btns.appendChild(b)
    })
    ans.appendChild(btns)

    var state = el('div', 'state')
    state.setAttribute('aria-live', 'polite')
    ans.appendChild(state)

    var form = buildForm(g)
    ans.appendChild(form.root)
    root.appendChild(ans)
    figEls[g.id] = { root: root, btns: byAnswer, state: state, form: form, busy: false }
    return root
  }

  // What the pre-fill copied from the issuer's page. A hint to check against the page, shown
  // beside the row and never put into the reading box: what is saved is what was typed.
  function buildSuggestion(g) {
    var s = g.suggestion
    var box = el('div', 'sugg' + (s.status === 'suggested' ? '' : ' none'))
    if (s.status !== 'suggested') {
      box.appendChild(el('p', null, 'No suggestion from the page' + (s.readOn ? ' (read ' + C.longDay(s.readOn) + ')' : '') + ': ' + (s.why || 'no reason was kept.')))
      return box
    }
    var kinds = g.figure === 'assets' ? C.ASSET_KINDS : C.YIELD_KINDS
    var line = el('p')
    line.appendChild(el('span', 'sugg-l', 'Suggested'))
    line.appendChild(el('b', 'mono', s.shown))
    var parts = []
    if (s.kind) parts.push(kinds[s.kind] || s.kind)
    parts.push(s.asOf ? 'as of ' + C.longDay(s.asOf) : 'no date beside it')
    line.appendChild(el('span', null, ' · ' + parts.join(' · ')))
    box.appendChild(line)
    if (s.why) box.appendChild(el('p', 'sugg-why', s.why))
    var more = el('details')
    more.appendChild(el('summary', null, 'Where it was copied from'))
    more.appendChild(el('p', 'mono', s.quote))
    if (s.dateQuote) more.appendChild(el('p', 'mono', s.dateQuote))
    more.appendChild(el('p', null, 'Read from the page' + (s.readOn ? ' on ' + C.longDay(s.readOn) : '') + '. Check it there before you type it.'))
    box.appendChild(more)
    return box
  }

  function buildForm(g) {
    var f = el('form', 'diff')
    f.hidden = true
    f.noValidate = true
    var base = 'ff-' + safeId(g.id)
    var isYield = g.figure === 'yield'
    var value = field(base + '-value', isYield ? 'Yield the page shows (%)' : 'Net assets the page shows', isYield ? 'for example 1.25' : 'for example $45.1B', isYield ? 'decimal' : 'text')
    var asOf = field(base + '-asof', 'As of (the date the page gives)', '', 'date')
    var kind = select(base + '-kind', isYield ? 'Which yield is it?' : 'Whose net assets?', isYield ? C.YIELD_KINDS : C.ASSET_KINDS)
    var note = field(base + '-note', 'Note (optional)', isYield ? 'For example: the page also shows a 30-day SEC yield of 1.1%' : 'For example: the page calls it “share class net assets”', 'area')
    var nums = el('div', 'nums')
    nums.appendChild(value.wrap)
    nums.appendChild(asOf.wrap)
    f.appendChild(nums)
    var same = button('', 'link')
    same.hidden = true
    same.addEventListener('click', function () { asOf.input.value = lastDay })
    f.appendChild(same)
    f.appendChild(kind.wrap)
    f.appendChild(note.wrap)
    var err = el('p', 'err')
    err.setAttribute('role', 'alert')
    err.hidden = true
    f.appendChild(err)
    var actions = el('div', 'actions')
    var save = button('Save reading', 'primary', 'submit')
    var cancel = button('Cancel', 'quiet')
    actions.appendChild(save)
    actions.appendChild(cancel)
    f.appendChild(actions)
    var form = { root: f, value: value, asOf: asOf, kind: kind, note: note, same: same, err: err, save: save, mode: 'read' }
    cancel.addEventListener('click', function () { closeForm(form) })
    f.addEventListener('submit', function (e) {
      e.preventDefault()
      submitForm(g, form)
    })
    return form
  }

  function openForm(g, mode) {
    var els = figEls[g.id]
    var form = els.form
    var r = readings[g.id]
    form.mode = mode
    var reading = mode === 'read'
    form.value.wrap.hidden = !reading
    form.asOf.wrap.hidden = !reading
    form.kind.wrap.hidden = !reading
    // Only the person's own earlier reading is shown again, never the catalog's figure.
    var mine = r && r.result === 'read' && C.readingState(g, r) === 'current'
    form.value.input.value = mine ? (g.figure === 'assets' && r.typed ? r.typed : String(r.value)) : ''
    form.asOf.input.value = mine && r.asOf ? r.asOf : ''
    form.kind.input.value = mine && r.kind ? r.kind : ''
    form.note.input.value = r ? r.note : ''
    form.same.hidden = !reading || !lastDay
    form.same.textContent = lastDay ? 'Use ' + C.longDay(lastDay) : ''
    form.err.hidden = true
    form.save.textContent = reading ? 'Save reading' : 'Save'
    form.root.hidden = false
    ;(reading ? form.value.input : form.note.input).focus()
  }

  function closeForm(form) { form.root.hidden = true; form.err.hidden = true }

  async function saveAnswer(g, input, form) {
    var els = figEls[g.id]
    if (!store || !canWrite || els.busy) return
    els.busy = true
    paintFigure(g, 'Saving…')
    try {
      var res = await store.saveReading(g, input)
      if (res.error) {
        if (form) { form.err.textContent = res.error; form.err.hidden = false }
        paintFigure(g, form ? null : res.error)
        return
      }
      readings[g.id] = C.normReading(g.id, res.doc)
      if (res.doc.asOf) lastDay = res.doc.asOf
      if (form) closeForm(form)
      paintFigure(g)
      paintCounts()
    } catch (e) {
      if (e && e.code === 'invalid_argument') { canWrite = false; applyWriteGate() }
      var msg = C.dbMessage(e)
      if (form) { form.err.textContent = msg; form.err.hidden = false }
      paintFigure(g, msg)
    } finally {
      els.busy = false
      enableButtons(els.btns)
    }
  }

  function onAnswer(g, a) {
    if (a === 'read') { openForm(g, 'read'); return }
    var r = readings[g.id]
    saveAnswer(g, { result: a, note: r ? r.note : '' }, null)
  }

  function submitForm(g, form) {
    if (form.mode === 'note') {
      var r = readings[g.id]
      if (!r || C.readingState(g, r) !== 'current') { closeForm(form); return }
      var input = { result: r.result, note: form.note.input.value }
      if (r.result === 'read') {
        input.value = g.figure === 'assets' && r.typed ? r.typed : String(r.value)
        input.asOf = r.asOf
        input.kind = r.kind
      }
      saveAnswer(g, input, form)
      return
    }
    saveAnswer(g, { result: 'read', value: form.value.input.value, asOf: form.asOf.input.value, kind: form.kind.input.value, note: form.note.input.value }, form)
  }

  async function clearAnswer(g) {
    var els = figEls[g.id]
    if (!store || !canWrite || els.busy) return
    els.busy = true
    try {
      var res = await store.clearReading(g)
      readings[g.id] = C.normReading(g.id, res.doc)
      closeForm(els.form)
      paintFigure(g)
      paintCounts()
    } catch (e) {
      if (e && e.code === 'invalid_argument') { canWrite = false; applyWriteGate() }
      paintFigure(g, C.dbMessage(e))
    } finally {
      els.busy = false
      enableButtons(els.btns)
    }
  }

  function describe(g, r, s) {
    if (s === 'stale') {
      return 'Out of date: you read this when the catalog said ' + C.figureText(g.figure, r.compared) +
        '. It now says ' + C.figureText(g.figure, g.catalog) + '. Read it again.'
    }
    if (s === 'applied') return 'Your reading is in the catalog now · ' + day(r.at)
    if (r.result === 'read') {
      var kinds = g.figure === 'yield' ? C.YIELD_KINDS : C.ASSET_KINDS
      return 'Read ' + C.figureText(g.figure, r.value) + ' as of ' + C.longDay(r.asOf) +
        (r.kind && kinds[r.kind] ? ' · ' + kinds[r.kind] : '') + ' · saved ' + day(r.at)
    }
    return C.RESULTS[r.result] + ' · ' + day(r.at)
  }

  function paintFigure(g, message) {
    var els = figEls[g.id]
    if (!els) return
    var r = readings[g.id]
    var s = C.readingState(g, r)
    var cls = 'row'
    if (s === 'stale') cls += ' is-stale'
    else if (s === 'applied') cls += ' is-applied'
    else if (s === 'current') cls += r.result === 'read' ? ' is-ok' : ' is-cant-see'
    els.root.className = cls
    ANSWERS.forEach(function (a) {
      var b = els.btns[a]
      b.setAttribute('aria-pressed', String(s === 'current' && r.result === a))
      b.disabled = !canWrite || els.busy
    })
    applyVisibility(g)
    var st = els.state
    st.textContent = ''
    if (message) { st.appendChild(el('span', 'msg', message)); return }
    if (s === 'unchecked') return
    st.appendChild(el('span', 'said', describe(g, r, s)))
    if (s === 'current' && r.note) st.appendChild(el('span', 'note', 'Note: ' + r.note))
    if (canWrite && s === 'current') {
      var nb = button(r.note ? 'Edit note' : 'Add a note', 'link')
      nb.addEventListener('click', function () { openForm(g, 'note') })
      st.appendChild(nb)
    }
    if (canWrite && s !== 'applied') {
      var cb = button('Clear', 'link')
      cb.addEventListener('click', function () { clearAnswer(g) })
      st.appendChild(cb)
    }
  }

  function figureDone(g) {
    var s = C.readingState(g, readings[g.id])
    return s === 'current' || s === 'applied'
  }

  function fundVisible(fund) {
    if (view.mode === 'start' && !fund.startHere) return false
    if (!view.hideDone) return true
    return !fund.figures.every(function (g) { return figureDone(g) && figEls[g.id] && figEls[g.id].form.root.hidden })
  }

  function applyVisibility(g) {
    var fund = FUND[g.symbol]
    var e = fund && fundEls[fund.symbol]
    if (e) e.root.hidden = !fundVisible(fund)
  }

  // ── a note about the fund's page (link moved, figure hidden, page differs) ────
  function buildFundNote(fund) {
    var d = el('details', 'exnote')
    var sum = el('summary', null, 'Note about ' + fund.symbol + '’s page')
    d.appendChild(sum)
    var f = el('form')
    f.noValidate = true
    var area = field('ff-n-' + safeId(fund.symbol), 'For example: the link moved, or the page shows the figures only in a PDF fact sheet', '', 'area')
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
    fundEls[fund.symbol].note = els
    f.addEventListener('submit', async function (e) {
      e.preventDefault()
      if (!store || !canWrite || els.busy) return
      els.busy = true
      setStatus(st, 'Saving…')
      try {
        var res = await store.saveFundNote(fund.symbol, area.input.value)
        if (res.error) { setStatus(st, res.error, 'err'); return }
        notes[fund.symbol] = C.normFundNote(fund.symbol, res.doc)
        setStatus(st, 'Saved')
        paintFundNote(fund)
      } catch (err) {
        if (err && err.code === 'invalid_argument') { canWrite = false; applyWriteGate() }
        setStatus(st, C.dbMessage(err), 'err')
      } finally {
        els.busy = false
      }
    })
    return d
  }

  function paintFundNote(fund) {
    var els = fundEls[fund.symbol] && fundEls[fund.symbol].note
    if (!els) return
    var n = notes[fund.symbol]
    var base = 'Note about ' + fund.symbol + '’s page'
    els.summary.textContent = n && n.text ? base + ': ' + (n.text.length > 70 ? n.text.slice(0, 70) + '…' : n.text) : base
    if (document.activeElement !== els.input) els.input.value = n ? n.text : ''
    els.save.disabled = !canWrite
    els.input.readOnly = !canWrite
  }

  // ── fund cards ───────────────────────────────────────────────────────────────
  function buildFund(fund) {
    var sec = el('section', 'ex')
    sec.id = 'fund-' + safeId(fund.symbol)
    fundEls[fund.symbol] = { root: sec }
    var head = el('div', 'ex-head')
    head.appendChild(el('h3', 'ex-name', fund.symbol))
    head.appendChild(el('span', 'fund-name', fund.name))
    var count = el('span', 'ex-count')
    head.appendChild(count)
    fundEls[fund.symbol].count = count
    sec.appendChild(head)
    sec.appendChild(el('p', 'tier', fund.issuer + ' · ' + (fund.type === 'mutual' ? 'Mutual fund' : 'ETF') + ' · ' + fund.category))

    var guide = C.fundGuidance(fund)
    var links = el('p', 'ex-link')
    if (guide.href) {
      var a = el('a', 'feepage', guide.label)
      a.href = guide.href
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      links.appendChild(a)
    }
    links.appendChild(el('span', 'hint', guide.hint))
    sec.appendChild(links)
    // What we already know the page leaves out (the catalog's pageNote, D168), so a figure the
    // page does not print is answered "Can't find it" without a search for it.
    if (typeof fund.pageNote === 'string' && fund.pageNote) sec.appendChild(el('p', 'callout', fund.pageNote))
    if (fund.startHere) sec.appendChild(el('p', 'callout warn', 'Start here: the yield a data service works out from today’s price and the past year’s payouts differs from the catalog’s.'))

    var list = el('div', 'rows')
    fund.figures.forEach(function (g) {
      try { list.appendChild(buildFigure(fund, g)) } catch (e) { /* one bad figure must not blank the card */ }
    })
    sec.appendChild(list)
    sec.appendChild(buildFundNote(fund))
    return sec
  }

  function paintFund(fund) {
    var e = fundEls[fund.symbol]
    if (!e) return
    var t = C.tally(fund.figures, readings)
    e.count.textContent = t.answered + ' of ' + t.total + ' answered' + (t.stale ? ' · ' + t.stale + ' out of date' : '')
    e.root.hidden = !fundVisible(fund)
  }

  // ── page-level ───────────────────────────────────────────────────────────────
  function paintCounts() {
    var yields = FIGS.filter(function (g) { return g.figure === 'yield' })
    var assets = FIGS.filter(function (g) { return g.figure === 'assets' })
    var p = $('ff-progress')
    if (p) {
      p.textContent = ''
      var meters = [
        [C.tally(yields, readings).read, yields.length, 'yields read'],
        [C.tally(assets, readings).read, assets.length, 'asset figures read'],
      ]
      if (HAS_START) meters.unshift([C.tally(START_FIGS, readings).read, START_FIGS.length, 'Start here figures read'])
      else meters.push([C.tally(FIGS, readings).read, FIGS.length, 'figures read'])
      meters.forEach(function (x) {
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
    var stale = C.tally(FIGS, readings).stale
    setStatus($('ff-stale'), stale ? stale + (stale === 1 ? ' reading was' : ' readings were') + ' taken before the catalog changed. Those rows say “Out of date”; read them again.' : '', 'warn')
    FUNDS.forEach(paintFund)
  }

  function paintAll() {
    FIGS.forEach(function (g) { try { paintFigure(g) } catch (e) { /* one bad row must not blank the list */ } })
    FUNDS.forEach(function (f) { try { paintFundNote(f) } catch (e) { /* skipped */ } })
    paintCounts()
  }

  function applyView() {
    var startBtn = $('ff-mode-start')
    if (startBtn) startBtn.setAttribute('aria-pressed', String(view.mode === 'start'))
    $('ff-mode-all').setAttribute('aria-pressed', String(view.mode === 'all'))
    $('ff-hide').checked = view.hideDone
    FUNDS.forEach(paintFund)
    try { localStorage.setItem('ff-view', JSON.stringify(view)) } catch (e) { /* convenience only */ }
  }

  function applyWriteGate() {
    FIGS.forEach(function (g) { try { paintFigure(g) } catch (e) { /* skipped */ } })
    FUNDS.forEach(function (f) { try { paintFundNote(f) } catch (e) { /* skipped */ } })
    if (!canWrite && store) setStatus($('ff-conn'), 'You can read the answers here. Only the page owner and editors can record them.', 'warn')
  }

  function build() {
    var host = $('ff-funds')
    FUNDS.forEach(function (f) {
      try { host.appendChild(buildFund(f)) } catch (e) { /* one bad card must not blank the list */ }
    })
    var startBtn = $('ff-mode-start')
    if (startBtn) startBtn.addEventListener('click', function () { view.mode = 'start'; applyView() })
    $('ff-mode-all').addEventListener('click', function () { view.mode = 'all'; applyView() })
    $('ff-hide').addEventListener('change', function (e) { view.hideDone = !!e.target.checked; applyView() })
    paintAll()
    applyView()
  }

  // ── start ────────────────────────────────────────────────────────────────────
  async function start() {
    var conn = $('ff-conn')
    var runtime = window.claude
    if (!runtime || typeof runtime.use !== 'function') {
      setStatus(conn, 'This copy of the page cannot save readings. Open the published page on claude.ai to record them.', 'err')
      return
    }
    setStatus(conn, 'Connecting…')
    var got = await Promise.all([runtime.use('db'), runtime.use('user')])
    var db = got[0], user = got[1]
    if (!db) {
      setStatus(conn, 'Readings are not available in this view. Sign in to claude.ai and open the page there.', 'err')
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
    setStatus(conn, canWrite ? 'Your readings save to this page as you go.' : '', canWrite ? 'ok' : '')
    applyWriteGate()

    db.collection('readings').onSnapshot(function (snap) {
      var next = {}
      snap.docs.forEach(function (d) {
        try { next[d.id] = C.normReading(d.id, d.data()) } catch (e) { /* unreadable row: skipped */ }
      })
      readings = next
      paintAll()
    }, function (e) { setStatus($('ff-conn'), 'Readings stopped updating (' + ((e && e.code) || 'error') + '). Reload to reconnect.', 'err') })

    db.collection('notes').onSnapshot(function (snap) {
      var next = {}
      snap.docs.forEach(function (d) {
        try { next[d.id] = C.normFundNote(d.id, d.data()) } catch (e) { /* skipped */ }
      })
      notes = next
      FUNDS.forEach(function (f) { try { paintFundNote(f) } catch (e) { /* skipped */ } })
    }, function (e) { setStatus($('ff-conn'), 'Fund notes stopped updating (' + ((e && e.code) || 'error') + '). Reload to reconnect.', 'err') })
  }

  build()
  start()
})(FundFiguresCore)
