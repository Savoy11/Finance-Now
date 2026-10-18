/* Staking Facts Check — browser side (drawing and wiring).
 *
 * Inlined into the page by scripts/lib/stakingFactsPage.mjs, right after
 * stakingFacts.core.js and inside the same wrapper, so `StakingFactsCore` is in scope
 * here. It draws every card synchronously from the embedded catalog data, then lights up
 * the answers when the claude.ai viewer hands it two runtime capabilities through
 * `claude.use(name)`: `db` (collections `checks`, `notes`) and `user` (who answered).
 * Either can resolve null — a reader view, a copy opened outside claude.ai — and the list
 * must still render.
 *
 * Rules this file keeps, pinned by lib/server/__tests__/stakingFactsPage.test.ts:
 *   · It NEVER deletes. Every write goes through the core's store, which has no delete path.
 *   · It never writes markup built from text: every value goes in through textContent.
 *   · It never pre-fills an answer from the catalog: blank means "not changed".
 *   · It renders only normalized rows (core.normCheck and friends), each in its own
 *     try/catch, so one malformed row cannot blank the list.
 *   · It records, it does not decide. An answer changes nothing in the catalog until a
 *     pull request carrying it is merged.
 */
(function (C) {
  'use strict'

  var DATA = {}
  try { DATA = JSON.parse(document.getElementById('sf-data').textContent || '{}') } catch (e) { DATA = {} }
  var CARDS = Array.isArray(DATA.providers) ? DATA.providers : []
  var ROWS = [], CARD = {}
  CARDS.forEach(function (p) {
    CARD[p.id] = p
    p.rows = Array.isArray(p.rows) ? p.rows : []
    p.rows.forEach(function (r) { r.fields = Array.isArray(r.fields) ? r.fields : []; ROWS.push(r) })
  })
  var TERMS = ROWS.filter(function (r) { return r.kind === 'terms' })
  var LEADS = ROWS.filter(function (r) { return typeof r.lead === 'string' && r.lead })
  function hasLead(card) { return card.rows.some(function (r) { return typeof r.lead === 'string' && r.lead }) }
  var CATEGORY_LABELS = { liquid: 'Liquid staking', wallet: 'Wallet', cefi: 'Exchange' }

  // ── runtime state ────────────────────────────────────────────────────────────
  var store = null
  var canWrite = false        // set at start; a refused write turns it off for the visit
  var checks = {}, notes = {}
  var rowEls = {}, cardEls = {}
  var GROUPS = ['all', 'start', 'liquid', 'wallet', 'cefi']
  var view = { group: 'all', hideDone: false }
  try {
    var saved = JSON.parse(localStorage.getItem('sf-view') || 'null')
    if (saved && GROUPS.indexOf(saved.group) !== -1 && (saved.group !== 'start' || LEADS.length)) view.group = saved.group
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
    var i = el(kind === 'area' ? 'textarea' : 'input')
    i.id = id
    if (kind === 'area') i.rows = 2
    else { i.type = 'text'; i.autocomplete = 'off'; i.inputMode = kind === 'url' ? 'url' : kind === 'billions' ? 'text' : 'decimal' }
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
  // A save paints while busy (the store's own snapshot can arrive mid-write), so its
  // buttons are re-enabled once it finishes; otherwise they stay greyed until the next one.
  function enableButtons(btns) { Object.keys(btns).forEach(function (a) { btns[a].disabled = !canWrite }) }

  // A stored figure written back into a box: an assets figure needs its unit to read again.
  function typedForm(fd, v) { return fd.type === 'billions' ? String(v) + 'B' : String(v) }

  function rowLabel(r) { return r.kind === 'terms' ? (r.fields[0] && r.fields[0].unit) || r.coin : C.KIND_LABELS[r.kind] }
  function placeholderFor(f) {
    if (f.type === 'url') return 'https://…'
    if (f.type === 'year') return 'for example 2018'
    if (f.type === 'count') return 'for example 4'
    if (f.type === 'billions') return 'for example $1.3B'
    if (f.type === 'days') return 'days, 0 if none'
    return (f.unit || 'coins') + ', 0 if none'
  }

  // ── rows ─────────────────────────────────────────────────────────────────────
  function buildRow(card, r) {
    var root = el('div', 'row')
    root.dataset.key = r.key
    var what = el('div', 'what')
    what.appendChild(el('span', 'coin', rowLabel(r)))
    root.appendChild(what)

    var vals = el('dl', 'vals')
    r.fields.forEach(function (f) {
      var d = el('div')
      d.appendChild(el('dt', null, C.FIELD_LABELS[f.name] || C.FIELD_LABELS[f.type] || f.name))
      d.appendChild(el('dd', f.type === 'url' ? 'url' : 'mono', C.fieldText(f, f.catalog)))
      vals.appendChild(d)
    })
    root.appendChild(vals)
    if (r.note) root.appendChild(el('p', 'tnote', 'Catalog note: ' + r.note))
    if (typeof r.lead === 'string' && r.lead) root.appendChild(el('p', 'tnote callout warn', 'Start here: ' + r.lead))
    root.appendChild(el('p', 'tnote hint', C.rowGuidance(card, r)))

    var ans = el('div', 'answer')
    var btns = el('div', 'btns')
    btns.setAttribute('role', 'group')
    btns.setAttribute('aria-label', 'Your answer for ' + card.name + ' ' + rowLabel(r))
    var byAnswer = {}
    ;(C.KIND_RESULTS[r.kind] || []).forEach(function (a) {
      var label = a === 'changed' ? (r.kind === 'site' ? 'Moved…' : 'Different…') : a === 'ok' && r.kind === 'site' ? 'Link works' : C.RESULTS[a]
      var b = button(label, 'ans a-' + a)
      b.setAttribute('aria-pressed', 'false')
      b.addEventListener('click', function () { onAnswer(r, a) })
      byAnswer[a] = b
      btns.appendChild(b)
    })
    ans.appendChild(btns)
    var state = el('div', 'state')
    state.setAttribute('aria-live', 'polite')
    ans.appendChild(state)
    var form = buildForm(r)
    ans.appendChild(form.root)
    root.appendChild(ans)
    rowEls[r.key] = { root: root, btns: byAnswer, state: state, form: form, busy: false }
    return root
  }

  function buildForm(r) {
    var f = el('form', 'diff')
    f.hidden = true
    f.noValidate = true
    var base = 'sf-' + safeId(r.key)
    var inputs = {}
    var nums = el('div', 'nums')
    r.fields.forEach(function (fd) {
      var label = (C.FIELD_LABELS[fd.name] || fd.name) + ' it shows now' + (fd.type === 'amount' ? ' (' + (fd.unit || 'coins') + ')' : fd.type === 'days' ? ' (days)' : '')
      var x = field(base + '-' + fd.name, label, placeholderFor(fd), fd.type === 'url' ? 'url' : fd.type)
      inputs[fd.name] = x
      nums.appendChild(x.wrap)
    })
    f.appendChild(nums)
    var note = field(base + '-note', 'Note (optional)', 'For example: the page says “unbonding takes 21–28 days”', 'area')
    f.appendChild(note.wrap)
    var hint = el('p', 'hint', r.fields.length > 1 ? 'Leave a box empty if that figure has not changed.' : '')
    hint.hidden = r.fields.length < 2
    f.appendChild(hint)
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
    var form = { root: f, inputs: inputs, nums: nums, note: note, hint: hint, err: err, save: save, mode: 'changed' }
    cancel.addEventListener('click', function () { closeForm(form) })
    f.addEventListener('submit', function (e) {
      e.preventDefault()
      submitForm(r, form)
    })
    return form
  }

  function openForm(r, mode) {
    var els = rowEls[r.key]
    var form = els.form
    var c = checks[r.key]
    form.mode = mode
    var changing = mode === 'changed'
    form.nums.hidden = !changing
    form.hint.hidden = !changing || r.fields.length < 2
    // Never pre-fill the catalog's figures: blank means "not changed", and a copied
    // value would read as something the person saw.
    var mine = c && c.result === 'changed' && C.answerState(r, c) === 'current'
    r.fields.forEach(function (fd) {
      var v = mine && C.own(c.values, fd.name) ? c.values[fd.name] : null
      form.inputs[fd.name].input.value = v !== null && v !== fd.catalog ? typedForm(fd, v) : ''
    })
    form.note.input.value = c ? c.note : ''
    form.err.hidden = true
    form.save.textContent = changing ? 'Save answer' : 'Save note'
    form.root.hidden = false
    ;(changing ? form.inputs[r.fields[0].name].input : form.note.input).focus()
  }

  function closeForm(form) { form.root.hidden = true; form.err.hidden = true }

  async function saveAnswer(r, input, form) {
    var els = rowEls[r.key]
    if (!store || !canWrite || els.busy) return
    els.busy = true
    paintRow(r, 'Saving…')
    try {
      var res = await store.saveAnswer(r, input)
      if (res.error) {
        if (form) { form.err.textContent = res.error; form.err.hidden = false }
        paintRow(r, form ? null : res.error)
        return
      }
      checks[r.key] = C.normCheck(r.key, res.doc)
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
      enableButtons(els.btns)
    }
  }

  function onAnswer(r, a) {
    if (a === 'changed') { openForm(r, 'changed'); return }
    var c = checks[r.key]
    saveAnswer(r, { result: a, note: c ? c.note : '' }, null)
  }

  function submitForm(r, form) {
    var c = checks[r.key]
    if (form.mode === 'note') {
      if (!c || C.answerState(r, c) !== 'current') { closeForm(form); return }
      var input = { result: c.result, note: form.note.input.value, values: {} }
      if (c.result === 'changed') r.fields.forEach(function (fd) { var v = c.values[fd.name]; input.values[fd.name] = v === null || v === undefined ? '' : typedForm(fd, v) })
      saveAnswer(r, input, form)
      return
    }
    var values = {}
    r.fields.forEach(function (fd) { values[fd.name] = form.inputs[fd.name].input.value })
    saveAnswer(r, { result: 'changed', values: values, note: form.note.input.value }, form)
  }

  async function clearRowAnswer(r) {
    var els = rowEls[r.key]
    if (!store || !canWrite || els.busy) return
    els.busy = true
    try {
      var res = await store.clearAnswer(r)
      checks[r.key] = C.normCheck(r.key, res.doc)
      closeForm(els.form)
      paintRow(r)
      paintCounts()
    } catch (e) {
      if (e && e.code === 'invalid_argument') { canWrite = false; applyWriteGate() }
      paintRow(r, C.dbMessage(e))
    } finally {
      els.busy = false
      enableButtons(els.btns)
    }
  }

  function describe(r, c, s) {
    if (s === 'stale') {
      var then = r.fields.map(function (fd) { return C.fieldText(fd, C.own(c.compared, fd.name) ? c.compared[fd.name] : null) }).join(', ')
      var now = r.fields.map(function (fd) { return C.fieldText(fd, fd.catalog) }).join(', ')
      return 'Out of date: you answered when the catalog said ' + then + '. It now says ' + now + '. Check it again.'
    }
    if (s === 'applied') return 'Your answer is in the catalog now · ' + day(c.at)
    if (c.result === 'changed') {
      var parts = []
      r.fields.forEach(function (fd) {
        var v = C.own(c.values, fd.name) ? c.values[fd.name] : null
        if (v !== null && v !== fd.catalog) parts.push((C.FIELD_LABELS[fd.name] || fd.name).toLowerCase() + ' ' + C.fieldText(fd, v) + ' (catalog ' + C.fieldText(fd, fd.catalog) + ')')
      })
      return (r.kind === 'site' ? 'Moved: ' : 'Different: ') + (parts.join(', ') || 'see note') + ' · ' + day(c.at)
    }
    var label = c.result === 'ok' && r.kind === 'site' ? 'Link works' : C.RESULTS[c.result]
    return label + ' · ' + day(c.at)
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
    els.root.className = cls
    Object.keys(els.btns).forEach(function (a) {
      els.btns[a].setAttribute('aria-pressed', String(s === 'current' && c.result === a))
      els.btns[a].disabled = !canWrite || els.busy
    })
    var card = CARD[r.providerId]
    if (card) paintCardVisibility(card)
    var st = els.state
    st.textContent = ''
    if (message) { st.appendChild(el('span', 'msg', message)); return }
    if (s === 'unchecked') return
    st.appendChild(el('span', 'said', describe(r, c, s)))
    if (s === 'current' && c.note) st.appendChild(el('span', 'note', 'Note: ' + c.note))
    if (canWrite && s === 'current') {
      var nb = button(c.note ? 'Edit note' : 'Add a note', 'link')
      nb.addEventListener('click', function () { openForm(r, 'note') })
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

  // ── a note about the provider (link moved, sign-in needed, region block) ──────
  function buildProviderNote(card) {
    var d = el('details', 'exnote')
    var sum = el('summary', null, 'Note about ' + card.name)
    d.appendChild(sum)
    var f = el('form')
    f.noValidate = true
    var area = field('sf-n-' + safeId(card.id), 'For example: terms show only after sign-in, or the staking page moved', '', 'area')
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
    cardEls[card.id].note = els
    f.addEventListener('submit', async function (e) {
      e.preventDefault()
      if (!store || !canWrite || els.busy) return
      els.busy = true
      setStatus(st, 'Saving…')
      try {
        var res = await store.saveProviderNote(card.id, area.input.value)
        if (res.error) { setStatus(st, res.error, 'err'); return }
        notes[card.id] = C.normProviderNote(card.id, res.doc)
        setStatus(st, 'Saved')
        paintProviderNote(card)
      } catch (err) {
        if (err && err.code === 'invalid_argument') { canWrite = false; applyWriteGate() }
        setStatus(st, C.dbMessage(err), 'err')
      } finally {
        els.busy = false
      }
    })
    return d
  }

  function paintProviderNote(card) {
    var els = cardEls[card.id] && cardEls[card.id].note
    if (!els) return
    var n = notes[card.id]
    var base = 'Note about ' + card.name
    els.summary.textContent = n && n.text ? base + ': ' + (n.text.length > 70 ? n.text.slice(0, 70) + '…' : n.text) : base
    if (document.activeElement !== els.input) els.input.value = n ? n.text : ''
    els.save.disabled = !canWrite
    els.input.readOnly = !canWrite
  }

  // ── provider cards ───────────────────────────────────────────────────────────
  function buildCard(card) {
    var sec = el('section', 'ex')
    sec.id = 'provider-' + safeId(card.id)
    cardEls[card.id] = { root: sec }
    var head = el('div', 'ex-head')
    head.appendChild(el('h3', 'ex-name', card.name))
    head.appendChild(el('span', 'tier', CATEGORY_LABELS[card.category] || card.category))
    var count = el('span', 'ex-count')
    head.appendChild(count)
    cardEls[card.id].count = count
    sec.appendChild(head)

    var guide = C.providerGuidance(card)
    var links = el('p', 'ex-link')
    if (guide.link.href) {
      var a = el('a', 'feepage', guide.link.label)
      a.href = guide.link.href
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      links.appendChild(a)
    }
    links.appendChild(el('span', 'hint', guide.link.hint))
    sec.appendChild(links)
    guide.notes.forEach(function (n) { sec.appendChild(el('p', n.tone === 'warn' ? 'callout warn' : 'callout', n.text)) })
    var led = card.rows.filter(function (r) { return typeof r.lead === 'string' && r.lead })
    if (led.length) {
      var by = []
      led.forEach(function (r) { if (typeof r.leadBy === 'string' && r.leadBy && by.indexOf(r.leadBy) === -1) by.push(r.leadBy) })
      sec.appendChild(el('p', 'callout warn', 'Start here: ' + (led.length === 1 ? 'one of this provider’s rows is' : led.length + ' of this provider’s rows are') + ' marked below' + (by.length ? ', raised by ' + by.join(' and ') : '') + '.'))
    }

    var list = el('div', 'rows')
    card.rows.forEach(function (r) {
      try { list.appendChild(buildRow(card, r)) } catch (e) { /* one bad row must not blank the card */ }
    })
    sec.appendChild(list)
    sec.appendChild(buildProviderNote(card))
    return sec
  }

  function cardVisible(card) {
    if (view.group === 'start') { if (!hasLead(card)) return false }
    else if (view.group !== 'all' && card.category !== view.group) return false
    if (!view.hideDone) return true
    return !card.rows.every(function (r) { return rowDone(r) && rowEls[r.key] && rowEls[r.key].form.root.hidden })
  }

  function paintCardVisibility(card) {
    var e = cardEls[card.id]
    if (e) e.root.hidden = !cardVisible(card)
  }

  function paintCard(card) {
    var e = cardEls[card.id]
    if (!e) return
    var t = C.tally(card.rows, checks)
    e.count.textContent = t.answered + ' of ' + t.total + ' answered' + (t.stale ? ' · ' + t.stale + ' out of date' : '')
    paintCardVisibility(card)
  }

  // ── page-level ───────────────────────────────────────────────────────────────
  function paintCounts() {
    var all = C.tally(ROWS, checks)
    var terms = C.tally(TERMS, checks)
    var finished = CARDS.filter(function (card) { return card.rows.every(rowDone) }).length
    var p = $('sf-progress')
    if (p) {
      p.textContent = ''
      ;[
        [all.answered, all.total, 'facts answered'],
        [terms.answered, terms.total, 'coin minimums and lock-ups'],
        [finished, CARDS.length, 'providers finished'],
      ].concat(LEADS.length ? [[C.tally(LEADS, checks).answered, LEADS.length, 'Start here lock-ups answered']] : []).forEach(function (x) {
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
    setStatus($('sf-stale'), all.stale ? all.stale + (all.stale === 1 ? ' answer was' : ' answers were') + ' given before the catalog changed. Those rows say “Out of date”; check them again.' : '', 'warn')
    CARDS.forEach(paintCard)
  }

  function paintAll() {
    ROWS.forEach(function (r) { try { paintRow(r) } catch (e) { /* one bad row must not blank the list */ } })
    CARDS.forEach(function (card) { try { paintProviderNote(card) } catch (e) { /* skipped */ } })
    paintCounts()
  }

  function applyView() {
    GROUPS.forEach(function (g) { var b = $('sf-group-' + g); if (b) b.setAttribute('aria-pressed', String(view.group === g)) })
    $('sf-hide').checked = view.hideDone
    CARDS.forEach(paintCard)
    try { localStorage.setItem('sf-view', JSON.stringify(view)) } catch (e) { /* convenience only */ }
  }

  function applyWriteGate() {
    ROWS.forEach(function (r) { try { paintRow(r) } catch (e) { /* skipped */ } })
    CARDS.forEach(function (card) { try { paintProviderNote(card) } catch (e) { /* skipped */ } })
    if (!canWrite && store) setStatus($('sf-conn'), 'You can read the answers here. Only the page owner and editors can record them.', 'warn')
  }

  function build() {
    var host = $('sf-providers')
    CARDS.forEach(function (card) {
      try { host.appendChild(buildCard(card)) } catch (e) { /* one bad card must not blank the list */ }
    })
    GROUPS.forEach(function (g) {
      var b = $('sf-group-' + g)
      if (b) b.addEventListener('click', function () { view.group = g; applyView() })
    })
    $('sf-hide').addEventListener('change', function (e) { view.hideDone = !!e.target.checked; applyView() })
    paintAll()
    applyView()
  }

  // ── start ────────────────────────────────────────────────────────────────────
  async function start() {
    var conn = $('sf-conn')
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
        try { next[d.id] = C.normCheck(d.id, d.data()) } catch (e) { /* unreadable row: skipped */ }
      })
      checks = next
      paintAll()
    }, function (e) { setStatus($('sf-conn'), 'Answers stopped updating (' + ((e && e.code) || 'error') + '). Reload to reconnect.', 'err') })

    db.collection('notes').onSnapshot(function (snap) {
      var next = {}
      snap.docs.forEach(function (d) {
        try { next[d.id] = C.normProviderNote(d.id, d.data()) } catch (e) { /* skipped */ }
      })
      notes = next
      CARDS.forEach(function (card) { try { paintProviderNote(card) } catch (e) { /* skipped */ } })
    }, function (e) { setStatus($('sf-conn'), 'Provider notes stopped updating (' + ((e && e.code) || 'error') + '). Reload to reconnect.', 'err') })
  }

  build()
  start()
})(StakingFactsCore)
