/* Finance Now Ledger — shared workspace (browser side: drawing and wiring).
 *
 * Inlined into the published ledger page by scripts/lib/ledgerWorkspace.mjs, right after
 * ledgerWorkspace.core.js and inside the same wrapper, so `LedgerWorkspaceCore` is in
 * scope here. It runs in the claude.ai artifact viewer and reaches three runtime
 * capabilities through `claude.use(name)`: `db` (the document store: `docs`, `log`, and
 * `added` — new work items recorded on the page before they have a number),
 * `assets` (the file store) and `user` (who did what). Every one can resolve null — a
 * reader view, a copy opened outside claude.ai — and the page must still render the ledger.
 *
 * Rules this file keeps, pinned by lib/server/__tests__/ledgerWorkspace.test.ts:
 *   · It NEVER deletes. Every write goes through the core's store, which has no delete
 *     path; a mistaken upload is archived (a flag) — the owner's standing rule,
 *     2026-09-12: no deletion of project material, archiving is the substitute.
 *   · It never writes markup built from text: every name, note and title goes in
 *     through textContent, because uploads and notes are other people's input.
 *   · It renders only normalized rows (core.normDoc / core.normLog), each in its own
 *     try/catch, so one malformed row cannot blank the workspace for everyone.
 *   · It records, it does not decide. A "Confirm complete" here marks an item for the
 *     ledger; the ledger's status changes only when the repository JSON does.
 */
(function (C) {
  'use strict'

  var ITEMS = []
  try { ITEMS = JSON.parse(document.getElementById('ws-items').textContent || '[]') } catch (e) { ITEMS = [] }
  var BY_ID = {}
  ITEMS.forEach(function (i) { BY_ID[i.id] = i })
  var ACCEPT = Object.keys(C.TYPE_BY_EXT).map(function (x) { return '.' + x }).join(',')

  // ── runtime state ────────────────────────────────────────────────────────────
  var db = null, assets = null, user = null, store = null
  var canWrite = false           // set at start; a refused write turns it off for the visit
  var docsById = {}, docsList = [], logList = [], addedList = []
  var openSlots = {}             // itemId -> render function for an open item panel
  var slotForms = {}             // itemId -> that panel's form
  var itemEls = null             // itemId -> the item's <details>, built on first use
  var renderSeq = 0

  // ── tiny DOM helpers (textContent only) ──────────────────────────────────────
  function el(tag, cls, text) {
    var n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild) }
  function $(id) { return document.getElementById(id) }
  function when(iso) {
    if (!iso) return ''
    var d = new Date(iso)
    if (isNaN(d)) return ''
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  }
  function size(n) {
    if (n == null) return ''
    if (n < 1024) return n + ' B'
    if (n < C.MB) return Math.round(n / 1024) + ' KB'
    return (n / C.MB).toFixed(1) + ' MB'
  }
  function typeTag(ct) {
    if (ct === 'application/pdf') return 'PDF'
    if (ct.indexOf('image/') === 0) return 'IMG'
    if (ct.indexOf('video/') === 0) return 'VID'
    var t = { 'text/csv': 'CSV', 'text/markdown': 'MD', 'application/json': 'JSON', 'text/plain': 'TXT' }
    return C.own(t, ct) ? t[ct] : 'FILE'
  }
  function setStatus(node, msg, kind) {
    if (!node) return
    node.textContent = msg || ''
    node.className = 'ws-status' + (kind ? ' ' + kind : '')
  }
  function plural(n, one) { return n + ' ' + one + (n === 1 ? '' : 's') }
  function setDisabled(nodes, off) { nodes.forEach(function (n) { if (n) n.disabled = off }) }
  /** Map rows to DOM nodes, skipping (and logging) any row that fails to draw. */
  function eachRow(rows, draw) {
    rows.forEach(function (r) {
      try { draw(r) } catch (e) { if (window.console) console.warn('workspace: skipped a row that could not be drawn', r && r.id, e) }
    })
  }

  function itemEl(id) {
    if (!itemEls) {
      itemEls = {}
      document.querySelectorAll('.item[data-id]').forEach(function (n) { itemEls[n.getAttribute('data-id')] = n })
    }
    return C.own(itemEls, id) ? itemEls[id] : null
  }

  // ── people ───────────────────────────────────────────────────────────────────
  async function names(ids) {
    var uniq = ids.filter(function (x, i, a) { return x && a.indexOf(x) === i })
    if (!user || !uniq.length) return {}
    try { return (await user.profiles(uniq)) || {} } catch (e) { return {} }
  }
  function who(ps, id) {
    if (!id || !C.own(ps, id)) return 'Someone'
    var p = ps[id]
    if (p && p.isMe) return 'You'
    return (p && p.name) || 'Someone'
  }

  // ── derived state ────────────────────────────────────────────────────────────
  function docsFor(itemId, includeArchived) {
    return docsList.filter(function (d) { return (includeArchived || !d.archived) && d.itemIds.indexOf(itemId) > -1 })
  }
  /** An item's entries, newest first (logList is kept in that order). */
  function logFor(itemId) { return logList.filter(function (l) { return l.itemId === itemId }) }
  function stateOf(itemId) { return C.stateOf(logFor(itemId)) }

  // ── writes: all through the core's store; this half only reports ────────────
  /** A write came back refused: this viewer cannot change the workspace. Say so once, where it stays visible. */
  function refuse() {
    if (!canWrite) return
    canWrite = false
    applyWriteGate()
    setStatus($('ws-conn'), 'Your changes are being refused, so editing is off for this visit. Uploading and confirming need edit access to this page.', 'err')
  }
  function noteDbError(e) { if (e && e.code === 'invalid_argument') refuse() }

  // ── rendering: documents ─────────────────────────────────────────────────────
  function docRow(d, ps) {
    var row = el('li', 'ws-doc' + (d.archived ? ' archived' : ''))
    var tag = el('span', 'ws-type mono', typeTag(d.contentType))
    var main = el('div', 'ws-doc-main')
    var link = el('a', 'ws-doc-name', d.name)
    link.href = '/_blob/' + encodeURIComponent(d.id)
    link.target = '_blank'
    link.rel = 'noopener'
    main.appendChild(link)
    var meta = el('div', 'ws-doc-meta')
    meta.appendChild(el('span', 'chip dim', C.KIND_LABEL[d.kind]))
    d.itemIds.forEach(function (id) {
      var b = el('button', 'chip ws-itemchip mono', id)
      b.type = 'button'
      b.title = C.own(BY_ID, id) ? BY_ID[id].title : id
      b.addEventListener('click', function () { jumpTo(id) })
      meta.appendChild(b)
    })
    meta.appendChild(el('span', 'ws-dim', [size(d.sizeBytes), who(ps, d.uploadedBy), when(d.uploadedAt)].filter(Boolean).join(' · ')))
    main.appendChild(meta)
    if (d.note) main.appendChild(el('p', 'ws-note', d.note))
    row.appendChild(tag)
    row.appendChild(main)
    if (canWrite) {
      var a = el('button', 'ws-link', d.archived ? 'Restore' : 'Archive')
      a.type = 'button'
      a.title = d.archived ? 'Show this document again' : 'Hide from the list. Nothing is deleted.'
      var err = el('span', 'ws-status err')
      a.addEventListener('click', async function () {
        a.disabled = true
        setStatus(err, '')
        try {
          await store.setArchived(d.id, !d.archived)
        } catch (e) {
          noteDbError(e)
          setStatus(err, C.dbMessage(e), 'err')
          a.disabled = false
        }
      })
      var side = el('div', 'ws-doc-side')
      side.appendChild(a)
      side.appendChild(err)
      row.appendChild(side)
    }
    return row
  }

  function jumpTo(id) {
    var node = itemEl(id)
    if (!node) return
    node.hidden = false
    var g = node.closest('.group'); if (g) g.hidden = false
    node.open = true
    node.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function peopleIds() {
    var ids = []
    docsList.forEach(function (d) { ids.push(d.uploadedBy) })
    logList.forEach(function (l) { ids.push(l.by) })
    addedList.forEach(function (a) { ids.push(a.by); ids.push(a.stateBy) })
    return ids
  }

  // ── rendering: items added after the ledger was made (db `added`) ────────────
  function addedRow(a, ps) {
    var li = el('li', 'ws-pend ws-added-row' + (a.state === 'waiting' ? '' : ' done'))
    if (a.state === 'filed' && a.filedAs) {
      var b = el('button', 'ws-pend-id mono', a.filedAs); b.type = 'button'
      b.title = C.own(BY_ID, a.filedAs) ? BY_ID[a.filedAs].title : 'Not in this version of the ledger yet'
      b.addEventListener('click', function () { jumpTo(a.filedAs) })
      li.appendChild(b)
    } else {
      li.appendChild(el('span', 'chip dim', a.state === 'dropped' ? 'Dropped' : 'New'))
    }
    var body = el('div')
    body.appendChild(el('span', 'ws-pend-title', a.title))
    var meta = [C.own(C.ROLE_LABEL, a.role) ? C.ROLE_LABEL[a.role] : '', 'added by ' + who(ps, a.by), when(a.at), a.source].filter(Boolean)
    body.appendChild(el('span', 'ws-dim', meta.join(' · ')))
    if (a.detail) body.appendChild(el('p', 'ws-note', a.detail))
    if (a.state !== 'waiting') {
      var line = (a.state === 'filed' ? 'Filed' + (a.filedAs ? ' as ' + a.filedAs : '') : 'Dropped') + ' by ' + who(ps, a.stateBy) + (a.stateAt ? ' · ' + when(a.stateAt) : '')
      body.appendChild(el('span', 'ws-dim', line))
      if (a.stateNote) body.appendChild(el('p', 'ws-note', a.stateNote))
    }
    if (canWrite) body.appendChild(addedActions(a))
    li.appendChild(body)
    return li
  }

  /** Filed-as / Drop for a waiting item; Put back for a filed or dropped one. Never a delete. */
  function addedActions(a) {
    var box = el('div', 'ws-added-acts')
    var status = el('span', 'ws-status')
    function run(state, input) {
      return async function () {
        var v = input ? input.value.trim() : ''
        var problem = C.checkStateChange(state, state === 'filed' ? v : '', state === 'dropped' ? v : '')
        if (problem) { setStatus(status, problem, 'err'); return }
        setDisabled([].slice.call(box.querySelectorAll('button,input')), true)
        try {
          var r = await store.setItemState(a.id, state, state === 'filed' ? v : '', state === 'dropped' ? v : '')
          if (r.error) setStatus(status, r.error, 'err')
        } catch (e) {
          noteDbError(e)
          setStatus(status, C.dbMessage(e), 'err')
        } finally {
          setDisabled([].slice.call(box.querySelectorAll('button,input')), false)
        }
      }
    }
    if (a.state === 'waiting') {
      var num = el('input', 'ws-input mono'); num.placeholder = 'Filed as, e.g. T-417'; num.setAttribute('aria-label', 'Number it was filed as')
      var bFile = el('button', 'ws-link', 'Mark filed'); bFile.type = 'button'
      bFile.addEventListener('click', run('filed', num))
      var why = el('input', 'ws-input'); why.placeholder = 'Why drop it?'; why.setAttribute('aria-label', 'Reason for dropping')
      var bDrop = el('button', 'ws-link', 'Drop'); bDrop.type = 'button'
      bDrop.title = 'Moves it out of the waiting list. Nothing is deleted.'
      bDrop.addEventListener('click', run('dropped', why))
      box.appendChild(num); box.appendChild(bFile); box.appendChild(why); box.appendChild(bDrop)
    } else {
      var back = el('button', 'ws-link', 'Put back to waiting'); back.type = 'button'
      back.addEventListener('click', run('waiting', null))
      box.appendChild(back)
    }
    box.appendChild(status)
    return box
  }

  function renderAdded(ps) {
    var list = $('added-list')
    if (!list) return
    var showAll = $('added-show-closed').checked
    var waiting = addedList.filter(function (a) { return a.state === 'waiting' })
    var shown = showAll ? addedList : waiting
    clear(list)
    if (!shown.length) list.appendChild(el('li', 'ws-empty', addedList.length ? 'Nothing waiting. Every added item has been filed or dropped.' : 'Nothing added yet.'))
    eachRow(shown, function (a) { list.appendChild(addedRow(a, ps)) })
    $('added-count').textContent = String(waiting.length)
    $('added-show-wrap').hidden = addedList.length === waiting.length
  }

  function wireAddedForm() {
    var title = $('added-title'), detail = $('added-detail'), role = $('added-role'), source = $('added-source')
    var btn = $('added-save'), status = $('added-status')
    var controls = [title, detail, role, source, btn]
    $('added-show-closed').addEventListener('change', renderLibrary)
    btn.addEventListener('click', async function () {
      var fields = { title: title.value, detail: detail.value, role: role.value, source: source.value }
      var problem = C.checkNewItem(fields)
      if (problem) { setStatus(status, problem, 'err'); return }
      setDisabled(controls, true)
      try {
        var r = await store.addItem(fields, addedList)
        if (r.error) { setStatus(status, r.error, 'err'); return }
        title.value = ''; detail.value = ''; role.value = ''; source.value = ''
        setStatus(status, 'Added. Claude gives it a number when it files it into the ledger.', 'ok')
      } catch (e) {
        noteDbError(e)
        setStatus(status, C.dbMessage(e), 'err')
      } finally {
        setDisabled(controls, false)
      }
    })
  }

  async function renderLibrary() {
    var seq = ++renderSeq
    var ps = await names(peopleIds())
    if (seq !== renderSeq) return

    // Library
    var list = $('ws-docs'), fi = $('ws-filter-item').value, fk = $('ws-filter-kind').value
    var showArch = $('ws-show-archived').checked
    var shown = docsList.filter(function (d) {
      return (showArch || !d.archived) && (!fk || d.kind === fk) && (!fi || d.itemIds.indexOf(fi) > -1)
    })
    clear(list)
    if (!shown.length) list.appendChild(el('li', 'ws-empty', docsList.length ? 'No documents match these filters.' : 'No documents yet.'))
    eachRow(shown, function (d) { list.appendChild(docRow(d, ps)) })
    $('ws-doc-count').textContent = String(docsList.filter(function (d) { return !d.archived }).length)

    // Awaiting the ledger
    var pend = $('ws-pending'), pendCount = 0
    clear(pend)
    eachRow(ITEMS, function (it) {
      var s = stateOf(it.id)
      if (!C.awaitingLedger(it, s)) return
      pendCount++
      var li = el('li', 'ws-pend')
      var b = el('button', 'ws-pend-id mono', it.id); b.type = 'button'
      b.addEventListener('click', function () { jumpTo(it.id) })
      li.appendChild(b)
      var body = el('div')
      body.appendChild(el('span', 'ws-pend-title', it.title))
      body.appendChild(el('span', 'ws-dim', C.STATE_LABEL[s.kind] + ' by ' + who(ps, s.by) + ' · ' + when(s.at) + ' · ledger says ' + it.status))
      if (s.text) body.appendChild(el('p', 'ws-note', s.text))
      li.appendChild(body)
      pend.appendChild(li)
    })
    if (!pendCount) pend.appendChild(el('li', 'ws-empty', 'Nothing waiting. Every confirmation matches the ledger.'))
    $('ws-pend-count').textContent = String(pendCount)

    // Recent activity
    var act = $('ws-activity')
    clear(act)
    var recent = logList.slice(0, 15)
    if (!recent.length) act.appendChild(el('li', 'ws-empty', 'No activity yet.'))
    eachRow(recent, function (l) { act.appendChild(logRow(l, ps, true)) })

    // Items added on the page, waiting for a number
    try { renderAdded(ps) } catch (e) { if (window.console) console.warn('workspace: added list failed to draw', e) }

    // Chips on every item summary, then any open item panels
    paintChips()
    Object.keys(openSlots).forEach(function (id) {
      try { openSlots[id](ps) } catch (e) { if (window.console) console.warn('workspace: item panel failed to draw', id, e) }
    })
  }

  function logRow(l, ps, withItem) {
    var li = el('li', 'ws-log k-' + l.kind)
    var head = el('div', 'ws-log-head')
    if (withItem && l.itemId) {
      var b = el('button', 'ws-itemchip chip mono', l.itemId); b.type = 'button'
      b.addEventListener('click', function () { jumpTo(l.itemId) })
      head.appendChild(b)
    }
    head.appendChild(el('span', 'ws-log-kind', C.own(C.STATE_LABEL, l.kind) ? C.STATE_LABEL[l.kind] : 'Note'))
    head.appendChild(el('span', 'ws-dim', who(ps, l.by) + (l.at ? ' · ' + when(l.at) : '')))
    li.appendChild(head)
    if (l.text) li.appendChild(el('p', 'ws-note', l.text))
    if (l.docIds.length) {
      var files = el('div', 'ws-log-files')
      l.docIds.forEach(function (id) {
        var d = C.own(docsById, id) ? docsById[id] : null
        var a = el('a', 'ws-doc-name', d ? d.name : 'Attached file')
        a.href = '/_blob/' + encodeURIComponent(id); a.target = '_blank'; a.rel = 'noopener'
        files.appendChild(a)
      })
      li.appendChild(files)
    }
    return li
  }

  function paintChips() {
    eachRow(ITEMS, function (it) {
      var item = itemEl(it.id)
      var node = item && item.querySelector('.chips')
      if (!node) return
      var chip = node.querySelector('.ws-chip')
      var s = stateOf(it.id)
      var text = C.chipText(it, s, docsFor(it.id).length)
      if (!text) { if (chip) chip.remove(); return }
      if (!chip) { chip = el('span', 'chip ws-chip'); node.appendChild(chip) }
      chip.textContent = text
      chip.dataset.state = s ? s.kind : 'docs'
    })
  }

  // ── rendering: one item's panel (built when the item is opened) ──────────────
  function buildSlot(slot) {
    var itemId = slot.getAttribute('data-ws-item')
    slot.appendChild(el('p', 'ws-eyebrow', 'Workspace'))
    var stateLine = el('div', 'ws-state')
    var docsBox = el('ul', 'ws-docs ws-docs-item')
    var logBox = el('ul', 'ws-loglist')
    slot.appendChild(stateLine)
    slot.appendChild(docsBox)

    var form = el('div', 'ws-itemform')
    form.hidden = !canWrite
    var ta = el('textarea', 'ws-input')
    ta.id = 'ws-note-' + itemId
    ta.rows = 2
    ta.placeholder = 'What was done, what it shows, or what is still missing…'
    var lab = el('label', 'ws-label', 'Note'); lab.htmlFor = ta.id
    form.appendChild(lab); form.appendChild(ta)

    // Files only where this view can store them; notes and confirmations need db alone.
    var file = null, kind = null
    if (assets) {
      file = el('input'); file.type = 'file'; file.multiple = true; file.id = 'ws-file-' + itemId
      file.accept = ACCEPT
      var flab = el('label', 'ws-label', 'Attach files (optional)'); flab.htmlFor = file.id
      kind = el('select', 'ws-input'); kind.id = 'ws-kind-' + itemId
      C.KINDS.forEach(function (k) { var o = el('option', null, k[1]); o.value = k[0]; kind.appendChild(o) })
      kind.setAttribute('aria-label', 'Kind of attachment')
      var frow = el('div', 'ws-filerow'); frow.appendChild(flab); frow.appendChild(file); frow.appendChild(kind)
      form.appendChild(frow)
    }

    var row = el('div', 'ws-btnrow')
    var bProg = el('button', 'ws-btn', 'Add progress note'); bProg.type = 'button'
    var bDone = el('button', 'ws-btn primary', 'Confirm complete'); bDone.type = 'button'
    var reopenBtn = el('button', 'ws-btn', 'Reopen'); reopenBtn.type = 'button'
    var status = el('span', 'ws-status')
    row.appendChild(bProg); row.appendChild(bDone); row.appendChild(reopenBtn); row.appendChild(status)
    form.appendChild(row)
    slot.appendChild(form)
    slotForms[itemId] = form
    var controls = [ta, file, kind, bProg, bDone, reopenBtn]

    var ACTION = { confirmed: 'confirmation', reopened: 'reopen', progress: 'progress note' }
    async function submit(k) {
      var text = ta.value.trim()
      var files = file ? [].slice.call(file.files) : []
      if (k === 'progress' && !text && !files.length) { setStatus(status, 'Add a note or a file first.', 'err'); return }
      if (k === 'reopened' && !text) { setStatus(status, 'Say why it is being reopened.', 'err'); return }
      setDisabled(controls, true)
      try {
        var ids = []
        if (files.length) {
          var r = await store.uploadFiles(files, { itemIds: [itemId], kind: k === 'confirmed' ? 'evidence' : kind.value, note: text },
            function (name) { setStatus(status, 'Uploading ' + name + '…') })
          if (r.refused) refuse()
          if (r.error) {
            // Whatever did store stays traceable to this item; the action itself is not recorded.
            var tail = ''
            if (r.ids.length) {
              file.value = ''
              try {
                await store.addLog(itemId, 'note', 'Attached ' + plural(r.ids.length, 'file') + ' before an upload failed.', r.ids, logFor(itemId))
                tail = ' ' + plural(r.ids.length, 'file') + ' did store and are listed on this item.'
              } catch (e) { noteDbError(e) }
            }
            setStatus(status, r.error + tail + ' The ' + ACTION[k] + ' was not recorded.', 'err')
            return
          }
          ids = r.ids
        }
        await store.addLog(itemId, k, text, ids, logFor(itemId))
        ta.value = ''; if (file) file.value = ''
        setStatus(status, k === 'confirmed' ? 'Confirmed. The ledger updates when Claude applies it.' : 'Saved.', 'ok')
      } catch (e) {
        noteDbError(e)
        setStatus(status, C.dbMessage(e), 'err')
      } finally {
        setDisabled(controls, false)
      }
    }
    bProg.addEventListener('click', function () { submit('progress') })
    bDone.addEventListener('click', function () { submit('confirmed') })
    reopenBtn.addEventListener('click', function () { submit('reopened') })

    slot.appendChild(el('p', 'ws-eyebrow', 'History'))
    slot.appendChild(logBox)

    openSlots[itemId] = function (ps) {
      var it = C.own(BY_ID, itemId) ? BY_ID[itemId] : { status: '' }
      var s = stateOf(itemId)
      clear(stateLine)
      if (s) {
        stateLine.appendChild(el('span', 'ws-badge k-' + s.kind, C.STATE_LABEL[s.kind]))
        stateLine.appendChild(el('span', 'ws-dim', who(ps, s.by) + ' · ' + when(s.at) +
          (C.awaitingLedger(it, s) ? ' · the ledger still says ' + it.status : '')))
      } else {
        stateLine.appendChild(el('span', 'ws-dim', 'No workspace activity yet.'))
      }
      clear(docsBox)
      eachRow(docsFor(itemId), function (d) { docsBox.appendChild(docRow(d, ps)) })
      clear(logBox)
      var entries = logFor(itemId)
      if (!entries.length) logBox.appendChild(el('li', 'ws-empty', 'Nothing recorded.'))
      eachRow(entries, function (l) { logBox.appendChild(logRow(l, ps, false)) })
      reopenBtn.hidden = !((s && s.kind === 'confirmed') || it.status === 'closed')
      form.hidden = !canWrite
    }
    names(peopleIds()).then(function (ps) { if (openSlots[itemId]) openSlots[itemId](ps) })
  }

  // ── main upload form ─────────────────────────────────────────────────────────
  function wireMainForm() {
    var sel = $('ws-item'), fsel = $('ws-filter-item')
    ITEMS.forEach(function (it) {
      var label = it.id + ' — ' + it.title
      var o = el('option', null, label.length > 90 ? label.slice(0, 89) + '…' : label); o.value = it.id
      sel.appendChild(o)
      var o2 = el('option', null, it.id); o2.value = it.id
      fsel.appendChild(o2)
    })
    var kind = $('ws-kind'), fk = $('ws-filter-kind')
    C.KINDS.forEach(function (k) {
      var o = el('option', null, k[1]); o.value = k[0]; kind.appendChild(o)
      var o2 = el('option', null, C.KIND_LABEL[k[0]]); o2.value = k[0]; fk.appendChild(o2)
    })
    $('ws-file').accept = ACCEPT
    ;[fsel, fk, $('ws-show-archived')].forEach(function (n) { n.addEventListener('change', renderLibrary) })

    var btn = $('ws-upload'), file = $('ws-file'), note = $('ws-note'), status = $('ws-upload-status')
    var controls = [btn, file, sel, kind, note]
    btn.addEventListener('click', async function () {
      var files = [].slice.call(file.files)
      var itemId = sel.value, text = note.value.trim()
      setDisabled(controls, true)
      try {
        var r = await store.uploadFiles(files, { itemIds: itemId ? [itemId] : [], kind: kind.value, note: text },
          function (name) { setStatus(status, 'Uploading ' + name + '…') })
        if (r.refused) refuse()
        var logErr = null
        if (itemId && r.ids.length) {
          try {
            await store.addLog(itemId, 'note', text || 'Attached ' + plural(r.ids.length, 'file') + '.', r.ids, logFor(itemId))
          } catch (e) { noteDbError(e); logErr = e }
        }
        if (r.ids.length) { file.value = ''; note.value = '' }
        if (r.error) {
          setStatus(status, (r.ids.length ? 'Uploaded ' + r.ids.length + ' of ' + files.length + '; the rest were not sent. ' : '') + r.error, 'err')
        } else if (logErr) {
          setStatus(status, 'Uploaded ' + plural(r.ids.length, 'file') + ', but the note on ' + itemId + ' was not saved. ' + C.dbMessage(logErr), 'err')
        } else {
          setStatus(status, 'Uploaded ' + plural(r.ids.length, 'file') + '.', 'ok')
        }
        if (r.ids.length) refreshUsage()
      } catch (e) {
        setStatus(status, C.dbMessage(e), 'err')
      } finally {
        setDisabled(controls, false)
      }
    })
  }

  async function refreshUsage() {
    if (!assets) return
    try {
      var u = (await assets.list()).usage
      $('ws-usage').textContent = plural(u.files, 'file') + ' · ' + size(u.bytes) + ' of ' + size(u.maxBytes) + ' used'
    } catch (e) { /* housekeeping only */ }
  }

  function applyWriteGate() {
    $('ws-uploader').hidden = !(assets && canWrite)
    $('ws-readonly').hidden = canWrite
    if ($('added-form')) $('added-form').hidden = !canWrite
    Object.keys(slotForms).forEach(function (id) { slotForms[id].hidden = !canWrite })
    renderLibrary() // redraws rows with or without their Archive controls
  }

  function openSlot(slot) {
    if (!slot || !db || slot.getAttribute('data-built')) return
    slot.setAttribute('data-built', '1')
    slot.hidden = false
    buildSlot(slot)
  }

  // Build an item's panel the first time it is opened. `toggle` does not bubble,
  // so listen in the capture phase.
  document.addEventListener('toggle', function (e) {
    var t = e.target
    if (!t || !t.classList || !t.classList.contains('item') || !t.open) return
    openSlot(t.querySelector('.ws-slot'))
  }, true)

  // ── start ────────────────────────────────────────────────────────────────────
  async function start() {
    var conn = $('ws-conn')
    var c = window.claude
    var addedConn = $('added-conn')
    if (!c || typeof c.use !== 'function') {
      setStatus(conn, 'This copy of the page has no workspace storage. Open the published page on claude.ai to see uploads and confirmations.', 'err')
      setStatus(addedConn, 'Items waiting for a number are kept with the published page; open it on claude.ai to see them.', 'err')
      return
    }
    var got = await Promise.all([c.use('db'), c.use('assets'), c.use('user')])
    db = got[0]; assets = got[1]; user = got[2]
    if (!db) {
      setStatus(conn, 'The workspace is not available in this view. The ledger below is unaffected.', 'err')
      setStatus(addedConn, 'Items waiting for a number are not available in this view.', 'err')
      return
    }
    var me = null, editor = null
    if (user) {
      try { me = await user.id() } catch (e) { me = null }
      try { editor = await user.canEdit() } catch (e) { editor = null }
    }
    // The page's db rule reserves writes for editors (admin), the same level that gets
    // `assets`; when the platform says nothing, `assets` is the signal.
    canWrite = editor === null ? !!assets : editor === true
    store = C.makeStore({ db: db, assets: assets, me: me })
    $('ws-live').hidden = false
    setStatus(conn, '')
    setStatus(addedConn, '')
    wireMainForm()
    if ($('added-list')) wireAddedForm()
    applyWriteGate()
    refreshUsage()

    db.collection('docs').onSnapshot(function (snap) {
      var byId = {}, list = []
      snap.docs.forEach(function (d) {
        try { var x = C.normDoc(d.id, d.data()); byId[x.id] = x; list.push(x) } catch (e) { /* unreadable row: skipped */ }
      })
      list.sort(function (a, b) { return b.uploadedAt < a.uploadedAt ? -1 : b.uploadedAt > a.uploadedAt ? 1 : 0 })
      docsById = byId; docsList = list
      renderLibrary()
    }, function (e) { setStatus($('ws-conn'), 'Documents stopped updating (' + ((e && e.code) || 'error') + '). Reload to reconnect.', 'err') })

    db.collection('log').onSnapshot(function (snap) {
      var list = []
      snap.docs.forEach(function (d) {
        try { list.push(C.normLog(d.id, d.data())) } catch (e) { /* unreadable row: skipped */ }
      })
      list.sort(function (a, b) { return C.orderOf(b) - C.orderOf(a) || (b.id < a.id ? -1 : 1) })
      logList = list
      renderLibrary()
    }, function (e) { setStatus($('ws-conn'), 'Activity stopped updating (' + ((e && e.code) || 'error') + '). Reload to reconnect.', 'err') })

    if ($('added-list')) {
      db.collection('added').onSnapshot(function (snap) {
        var list = []
        snap.docs.forEach(function (d) {
          try { list.push(C.normAdded(d.id, d.data())) } catch (e) { /* unreadable row: skipped */ }
        })
        list.sort(function (a, b) { return C.orderOf(b) - C.orderOf(a) || (b.id < a.id ? -1 : 1) })
        addedList = list
        renderLibrary()
      }, function (e) { setStatus($('added-conn'), 'The waiting list stopped updating (' + ((e && e.code) || 'error') + '). Reload to reconnect.', 'err') })
    }

    // Any item already open when the workspace connected.
    document.querySelectorAll('.item[open] .ws-slot').forEach(openSlot)
  }
  start()
})(LedgerWorkspaceCore)
