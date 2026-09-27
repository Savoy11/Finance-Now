/* Finance Now Ledger — shared workspace (browser side).
 *
 * Inlined into the published ledger page by scripts/lib/ledgerWorkspace.mjs. It runs
 * in the claude.ai artifact viewer and reaches three runtime capabilities through
 * `claude.use(name)`: `db` (the document store: `docs` and `log`), `assets` (the file
 * store) and `user` (who did what). Every one can resolve null — a reader view, a
 * copy opened outside claude.ai — and the page must still render the ledger.
 *
 * Rules this file keeps, pinned by lib/server/__tests__/ledgerWorkspace.test.ts:
 *   · It NEVER deletes. Not an asset, not a document. A mistaken upload is archived
 *     (a flag) — the owner's standing rule, 2026-09-12: no deletion of project
 *     material, archiving is the substitute.
 *   · It never writes markup built from text: every name, note and title goes in
 *     through textContent, because uploads and notes are other people's input.
 *   · It records, it does not decide. A "Confirm complete" here marks an item for the
 *     ledger; the ledger's status changes only when the repository JSON does.
 */
(function () {
  'use strict'

  var ITEMS = []
  try { ITEMS = JSON.parse(document.getElementById('ws-items').textContent || '[]') } catch (e) { ITEMS = [] }
  var BY_ID = {}
  ITEMS.forEach(function (i) { BY_ID[i.id] = i })

  // ── accepted upload types — the asset store's closed set ─────────────────────
  // Word and Excel are not in it; the page says so rather than failing late.
  var TYPE_BY_EXT = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm',
    csv: 'text/csv', md: 'text/markdown', markdown: 'text/markdown', json: 'application/json',
    txt: 'text/plain', log: 'text/plain',
  }
  var ACCEPTED = {}
  Object.keys(TYPE_BY_EXT).forEach(function (k) { ACCEPTED[TYPE_BY_EXT[k]] = true })
  var MB = 1024 * 1024

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

  // ── runtime state ────────────────────────────────────────────────────────────
  var db = null, assets = null, user = null, me = null
  var canWrite = true            // shared-document writes; a refused write turns this off
  var docsById = {}, docsList = [], logList = []
  var openSlots = {}             // itemId -> render function for an open item panel
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
    if (!n && n !== 0) return ''
    if (n < 1024) return n + ' B'
    if (n < MB) return Math.round(n / 1024) + ' KB'
    return (n / MB).toFixed(1) + ' MB'
  }
  function typeTag(ct) {
    if (!ct) return 'FILE'
    if (ct === 'application/pdf') return 'PDF'
    if (ct.indexOf('image/') === 0) return 'IMG'
    if (ct.indexOf('video/') === 0) return 'VID'
    return { 'text/csv': 'CSV', 'text/markdown': 'MD', 'application/json': 'JSON', 'text/plain': 'TXT' }[ct] || 'FILE'
  }
  function setStatus(node, msg, kind) {
    if (!node) return
    node.textContent = msg || ''
    node.className = 'ws-status' + (kind ? ' ' + kind : '')
  }

  // ── people ───────────────────────────────────────────────────────────────────
  async function names(ids) {
    var uniq = ids.filter(function (x, i, a) { return x && a.indexOf(x) === i })
    if (!user || !uniq.length) return {}
    try { return await user.profiles(uniq) } catch (e) { return {} }
  }
  function who(ps, id) {
    if (!id) return 'Someone'
    var p = ps[id]
    if (p && p.isMe) return 'You'
    return (p && p.name) || 'Someone'
  }

  // ── derived state ────────────────────────────────────────────────────────────
  function docsFor(itemId, includeArchived) {
    return docsList.filter(function (d) {
      return (includeArchived || !d.archived) && Array.isArray(d.itemIds) && d.itemIds.indexOf(itemId) > -1
    })
  }
  function logFor(itemId) { return logList.filter(function (l) { return l.itemId === itemId }) }
  /** The latest state-changing entry for an item: progress, confirmed or reopened. */
  function stateOf(itemId) {
    var entries = logFor(itemId)
    for (var i = 0; i < entries.length; i++) if (STATE_LABEL[entries[i].kind]) return entries[i]
    return null
  }

  // ── uploads ──────────────────────────────────────────────────────────────────
  function typeFor(file) {
    if (ACCEPTED[file.type]) return file.type
    var ext = (String(file.name).split('.').pop() || '').toLowerCase()
    return TYPE_BY_EXT[ext] || null
  }
  function uploadError(code, name) {
    var m = {
      too_large: name + ' is over the size limit (20 MB, or 2 MB for SVG).',
      unsupported_type: name + ' is not a supported type. Export Word or Excel files to PDF or CSV first.',
      invalid_request: name + ' could not be stored — a text file must be UTF-8; re-save it as UTF-8 and try again.',
      quota_or_state: 'The workspace cannot take more files right now (storage full or the page is unavailable).',
      rate_limited: 'Too many uploads at once — wait a moment and try again.',
      upstream_auth: 'Your session could not be confirmed — reload the page and try again.',
      not_granted: 'Uploading is not available in this view.',
      capability_disabled: 'Uploading is not available in this view.',
      capability_removed: 'Uploading is not available in this view.',
    }
    return m[code] || ('Upload of ' + name + ' failed (' + (code || 'unknown error') + ').')
  }

  /** Upload files and record each in `docs`. Resolves the stored ids; throws a message. */
  async function uploadFiles(files, meta, statusNode) {
    if (!assets) throw new Error('Uploading needs edit access to this page.')
    var ids = []
    for (var i = 0; i < files.length; i++) {
      var f = files[i], type = typeFor(f)
      if (!type) throw new Error(uploadError('unsupported_type', f.name))
      var limit = type === 'image/svg+xml' ? 2 * MB : 20 * MB
      if (f.size > limit) throw new Error(uploadError('too_large', f.name))
      setStatus(statusNode, 'Uploading ' + f.name + '…')
      var res
      try {
        res = await assets.upload(f, { type: type })
      } catch (e) {
        if (e && e.code === 'store_unavailable') {
          await new Promise(function (r) { setTimeout(r, 1200) })
          try { res = await assets.upload(f, { type: type }) } catch (e2) { throw new Error(uploadError(e2 && e2.code, f.name)) }
        } else {
          throw new Error(uploadError(e && e.code, f.name))
        }
      }
      var row = {
        name: String(f.name).slice(0, 200),
        contentType: res.contentType,
        sizeBytes: res.sizeBytes,
        kind: meta.kind || 'other',
        itemIds: meta.itemIds || [],
        note: (meta.note || '').slice(0, 2000),
        uploadedBy: me,
        uploadedAt: new Date().toISOString(),
        archived: false,
      }
      try {
        await db.collection('docs').doc(res.id).set(row)
      } catch (e) {
        handleWriteError(e)
        throw new Error(f.name + ' was stored but could not be listed (' + ((e && e.code) || 'error') + ').')
      }
      ids.push(res.id)
    }
    return ids
  }

  function handleWriteError(e) {
    if (e && e.code === 'invalid_argument') { canWrite = false; applyWriteGate() }
  }

  async function addLog(itemId, kind, text, docIds) {
    try {
      await db.collection('log').add({
        itemId: itemId, kind: kind, text: (text || '').slice(0, 4000),
        docIds: docIds || [], by: me, at: new Date().toISOString(),
      })
    } catch (e) {
      handleWriteError(e)
      if (e && e.code === 'quota_exceeded') throw new Error('The workspace database is full — tell Claude so older entries can be consolidated.')
      throw new Error('Could not save the entry (' + ((e && e.code) || 'error') + ').')
    }
  }

  async function archiveDoc(id, archived) {
    try { await db.collection('docs').doc(id).update({ archived: archived }) } catch (e) { handleWriteError(e) }
  }

  // ── rendering: documents ─────────────────────────────────────────────────────
  function docRow(d, ps, opts) {
    var row = el('li', 'ws-doc' + (d.archived ? ' archived' : ''))
    var tag = el('span', 'ws-type mono', typeTag(d.contentType))
    var main = el('div', 'ws-doc-main')
    var link = el('a', 'ws-doc-name', d.name || 'Untitled')
    link.href = '/_blob/' + d.id
    link.target = '_blank'
    link.rel = 'noopener'
    main.appendChild(link)
    var meta = el('div', 'ws-doc-meta')
    meta.appendChild(el('span', 'chip dim', KIND_LABEL[d.kind] || 'Other'))
    ;(d.itemIds || []).forEach(function (id) {
      var b = el('button', 'chip ws-itemchip mono', id)
      b.type = 'button'
      b.title = BY_ID[id] ? BY_ID[id].title : id
      b.addEventListener('click', function () { jumpTo(id) })
      meta.appendChild(b)
    })
    meta.appendChild(el('span', 'ws-dim', size(d.sizeBytes) + ' · ' + who(ps, d.uploadedBy) + ' · ' + when(d.uploadedAt)))
    main.appendChild(meta)
    if (d.note) main.appendChild(el('p', 'ws-note', d.note))
    row.appendChild(tag)
    row.appendChild(main)
    if (canWrite && db && !(opts && opts.noArchive)) {
      var a = el('button', 'ws-link', d.archived ? 'Restore' : 'Archive')
      a.type = 'button'
      a.title = d.archived ? 'Show this document again' : 'Hide from the list. Nothing is deleted.'
      a.addEventListener('click', function () { archiveDoc(d.id, !d.archived) })
      row.appendChild(a)
    }
    return row
  }

  function jumpTo(id) {
    var node = document.querySelector('.item[data-id="' + id + '"]')
    if (!node) return
    node.hidden = false
    var g = node.closest('.group'); if (g) g.hidden = false
    node.open = true
    node.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function renderLibrary() {
    var seq = ++renderSeq
    var ids = []
    docsList.forEach(function (d) { ids.push(d.uploadedBy) })
    logList.forEach(function (l) { ids.push(l.by) })
    var ps = await names(ids)
    if (seq !== renderSeq) return

    // Library
    var list = $('ws-docs'), fi = $('ws-filter-item').value, fk = $('ws-filter-kind').value
    var showArch = $('ws-show-archived').checked
    var shown = docsList.filter(function (d) {
      return (showArch || !d.archived) && (!fk || d.kind === fk) && (!fi || (d.itemIds || []).indexOf(fi) > -1)
    })
    clear(list)
    if (!shown.length) list.appendChild(el('li', 'ws-empty', docsList.length ? 'No documents match these filters.' : 'No documents yet.'))
    shown.forEach(function (d) { list.appendChild(docRow(d, ps)) })
    $('ws-doc-count').textContent = String(docsList.filter(function (d) { return !d.archived }).length)

    // Awaiting the ledger
    var pend = $('ws-pending'), pendCount = 0
    clear(pend)
    ITEMS.forEach(function (it) {
      var s = stateOf(it.id)
      if (!s) return
      var mismatch = (s.kind === 'confirmed' && it.status !== 'closed') || (s.kind === 'reopened' && it.status === 'closed')
      if (!mismatch) return
      pendCount++
      var li = el('li', 'ws-pend')
      var b = el('button', 'ws-pend-id mono', it.id); b.type = 'button'
      b.addEventListener('click', function () { jumpTo(it.id) })
      li.appendChild(b)
      var body = el('div')
      body.appendChild(el('span', 'ws-pend-title', it.title))
      body.appendChild(el('span', 'ws-dim', (s.kind === 'confirmed' ? 'Confirmed complete' : 'Reopened') + ' by ' + who(ps, s.by) + ' · ' + when(s.at) + ' · ledger says ' + it.status))
      if (s.text) body.appendChild(el('p', 'ws-note', s.text))
      li.appendChild(body)
      pend.appendChild(li)
    })
    if (!pendCount) pend.appendChild(el('li', 'ws-empty', 'Nothing waiting — every confirmation matches the ledger.'))
    $('ws-pend-count').textContent = String(pendCount)

    // Recent activity
    var act = $('ws-activity')
    clear(act)
    var recent = logList.slice(0, 15)
    if (!recent.length) act.appendChild(el('li', 'ws-empty', 'No activity yet.'))
    recent.forEach(function (l) { act.appendChild(logRow(l, ps, true)) })

    // Chips on every item summary, then any open item panels
    paintChips()
    Object.keys(openSlots).forEach(function (id) { openSlots[id](ps) })
  }

  function logRow(l, ps, withItem) {
    var li = el('li', 'ws-log k-' + l.kind)
    var head = el('div', 'ws-log-head')
    if (withItem) {
      var b = el('button', 'ws-itemchip chip mono', l.itemId); b.type = 'button'
      b.addEventListener('click', function () { jumpTo(l.itemId) })
      head.appendChild(b)
    }
    head.appendChild(el('span', 'ws-log-kind', STATE_LABEL[l.kind] || 'Note'))
    head.appendChild(el('span', 'ws-dim', who(ps, l.by) + ' · ' + when(l.at)))
    li.appendChild(head)
    if (l.text) li.appendChild(el('p', 'ws-note', l.text))
    if (l.docIds && l.docIds.length) {
      var files = el('div', 'ws-log-files')
      l.docIds.forEach(function (id) {
        var d = docsById[id]
        var a = el('a', 'ws-doc-name', d ? d.name : 'Attached file')
        a.href = '/_blob/' + id; a.target = '_blank'; a.rel = 'noopener'
        files.appendChild(a)
      })
      li.appendChild(files)
    }
    return li
  }

  function paintChips() {
    ITEMS.forEach(function (it) {
      var node = document.querySelector('.item[data-id="' + it.id + '"] .chips')
      if (!node) return
      var chip = node.querySelector('.ws-chip')
      var s = stateOf(it.id), n = docsFor(it.id).length
      var text = ''
      if (s && s.kind === 'confirmed') text = it.status === 'closed' ? 'Confirmed' : 'Confirmed · ledger pending'
      else if (s && s.kind === 'reopened') text = 'Reopened'
      else if (s && s.kind === 'progress') text = 'In progress'
      if (n) text = (text ? text + ' · ' : '') + n + (n === 1 ? ' doc' : ' docs')
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

    var form = null, status = null, reopenBtn = null
    if (db) {
      form = el('div', 'ws-itemform')
      var ta = el('textarea', 'ws-input')
      ta.id = 'ws-note-' + itemId
      ta.rows = 2
      ta.placeholder = 'What was done, what it shows, or what is still missing…'
      var lab = el('label', 'ws-label', 'Note'); lab.htmlFor = ta.id
      var file = el('input'); file.type = 'file'; file.multiple = true; file.id = 'ws-file-' + itemId
      file.accept = Object.keys(TYPE_BY_EXT).map(function (x) { return '.' + x }).join(',')
      var flab = el('label', 'ws-label', 'Attach files (optional)'); flab.htmlFor = file.id
      var kind = el('select', 'ws-input'); kind.id = 'ws-kind-' + itemId
      KINDS.forEach(function (k) { var o = el('option', null, k[1]); o.value = k[0]; kind.appendChild(o) })
      kind.setAttribute('aria-label', 'Kind of attachment')
      var row = el('div', 'ws-btnrow')
      var bProg = el('button', 'ws-btn', 'Add progress note'); bProg.type = 'button'
      var bDone = el('button', 'ws-btn primary', 'Confirm complete'); bDone.type = 'button'
      reopenBtn = el('button', 'ws-btn', 'Reopen'); reopenBtn.type = 'button'
      status = el('span', 'ws-status')
      row.appendChild(bProg); row.appendChild(bDone); row.appendChild(reopenBtn); row.appendChild(status)
      form.appendChild(lab); form.appendChild(ta)
      var frow = el('div', 'ws-filerow'); frow.appendChild(flab); frow.appendChild(file); frow.appendChild(kind)
      form.appendChild(frow)
      form.appendChild(row)
      slot.appendChild(form)

      async function submit(k) {
        var text = ta.value.trim()
        if (k === 'progress' && !text && !file.files.length) { setStatus(status, 'Add a note or a file first.', 'err'); return }
        if (k === 'reopened' && !text) { setStatus(status, 'Say why it is being reopened.', 'err'); return }
        ;[bProg, bDone, reopenBtn].forEach(function (b) { b.disabled = true })
        try {
          var ids = file.files.length
            ? await uploadFiles([].slice.call(file.files), { itemIds: [itemId], kind: k === 'confirmed' ? 'evidence' : kind.value, note: text }, status)
            : []
          await addLog(itemId, k, text, ids)
          ta.value = ''; file.value = ''
          setStatus(status, k === 'confirmed' ? 'Confirmed. The ledger updates when Claude applies it.' : 'Saved.', 'ok')
        } catch (e) {
          setStatus(status, e.message, 'err')
        } finally {
          ;[bProg, bDone, reopenBtn].forEach(function (b) { b.disabled = false })
        }
      }
      bProg.addEventListener('click', function () { submit('progress') })
      bDone.addEventListener('click', function () { submit('confirmed') })
      reopenBtn.addEventListener('click', function () { submit('reopened') })
    }
    slot.appendChild(el('p', 'ws-eyebrow', 'History'))
    slot.appendChild(logBox)

    openSlots[itemId] = function (ps) {
      var it = BY_ID[itemId] || { status: '' }
      var s = stateOf(itemId)
      clear(stateLine)
      if (s) {
        stateLine.appendChild(el('span', 'ws-badge k-' + s.kind, STATE_LABEL[s.kind]))
        stateLine.appendChild(el('span', 'ws-dim', who(ps, s.by) + ' · ' + when(s.at) +
          (s.kind === 'confirmed' && it.status !== 'closed' ? ' · the ledger still says ' + it.status : '')))
      } else {
        stateLine.appendChild(el('span', 'ws-dim', 'No workspace activity yet.'))
      }
      clear(docsBox)
      docsFor(itemId).forEach(function (d) { docsBox.appendChild(docRow(d, ps, { noArchive: false })) })
      clear(logBox)
      var entries = logFor(itemId)
      if (!entries.length) logBox.appendChild(el('li', 'ws-empty', 'Nothing recorded.'))
      entries.forEach(function (l) { logBox.appendChild(logRow(l, ps, false)) })
      if (reopenBtn) reopenBtn.hidden = !((s && s.kind === 'confirmed') || it.status === 'closed')
      if (form) form.hidden = !canWrite
    }
    var ids = []
    docsList.forEach(function (d) { ids.push(d.uploadedBy) })
    logFor(itemId).forEach(function (l) { ids.push(l.by) })
    names(ids).then(function (ps) { if (openSlots[itemId]) openSlots[itemId](ps) })
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
    KINDS.forEach(function (k) {
      var o = el('option', null, k[1]); o.value = k[0]; kind.appendChild(o)
      var o2 = el('option', null, KIND_LABEL[k[0]]); o2.value = k[0]; fk.appendChild(o2)
    })
    $('ws-file').accept = Object.keys(TYPE_BY_EXT).map(function (x) { return '.' + x }).join(',')
    ;[fsel, fk, $('ws-show-archived')].forEach(function (n) { n.addEventListener('change', renderLibrary) })

    $('ws-upload').addEventListener('click', async function () {
      var status = $('ws-upload-status'), file = $('ws-file'), btn = this
      if (!file.files.length) { setStatus(status, 'Choose at least one file.', 'err'); return }
      btn.disabled = true
      try {
        var itemId = sel.value
        var note = $('ws-note').value.trim()
        var ids = await uploadFiles([].slice.call(file.files), { itemIds: itemId ? [itemId] : [], kind: kind.value, note: note }, status)
        if (itemId) await addLog(itemId, 'note', note ? note : 'Attached ' + ids.length + (ids.length === 1 ? ' file' : ' files') + '.', ids)
        file.value = ''; $('ws-note').value = ''
        setStatus(status, 'Uploaded ' + ids.length + (ids.length === 1 ? ' file.' : ' files.'), 'ok')
        refreshUsage()
      } catch (e) {
        setStatus(status, e.message, 'err')
      } finally {
        btn.disabled = false
      }
    })
  }

  async function refreshUsage() {
    if (!assets) return
    try {
      var r = await assets.list()
      var u = r.usage
      $('ws-usage').textContent = u.files + ' files · ' + size(u.bytes) + ' of ' + size(u.maxBytes) + ' used'
    } catch (e) { /* housekeeping only */ }
  }

  function applyWriteGate() {
    $('ws-uploader').hidden = !(assets && canWrite)
    $('ws-readonly').hidden = !!(assets && canWrite)
    Object.keys(openSlots).forEach(function (id) { var f = document.querySelector('[data-ws-item="' + id + '"] .ws-itemform'); if (f) f.hidden = !canWrite })
  }

  // Build an item's panel the first time it is opened. `toggle` does not bubble,
  // so listen in the capture phase.
  document.addEventListener('toggle', function (e) {
    var t = e.target
    if (!t || !t.classList || !t.classList.contains('item') || !t.open) return
    var slot = t.querySelector('.ws-slot')
    if (!slot || !db || slot.getAttribute('data-built')) return
    slot.setAttribute('data-built', '1')
    slot.hidden = false
    buildSlot(slot)
  }, true)

  // ── start ────────────────────────────────────────────────────────────────────
  async function start() {
    var conn = $('ws-conn')
    var c = window.claude
    if (!c || typeof c.use !== 'function') {
      setStatus(conn, 'This copy of the page has no workspace storage. Open the published page on claude.ai to see uploads and confirmations.', 'err')
      return
    }
    var got = await Promise.all([c.use('db'), c.use('assets'), c.use('user')])
    db = got[0]; assets = got[1]; user = got[2]
    if (!db) {
      setStatus(conn, 'The workspace is not available in this view. The ledger below is unaffected.', 'err')
      return
    }
    if (user) {
      try { me = await user.id() } catch (e) { me = null }
      try { var cw = await user.can('data.write'); if (cw === false) canWrite = false } catch (e) { /* keep */ }
    }
    $('ws-live').hidden = false
    setStatus(conn, '')
    wireMainForm()
    applyWriteGate()
    refreshUsage()

    db.collection('docs').onSnapshot(function (snap) {
      docsById = {}
      docsList = snap.docs.map(function (d) { var x = Object.assign({ id: d.id }, d.data()); docsById[d.id] = x; return x })
      docsList.sort(function (a, b) { return String(b.uploadedAt).localeCompare(String(a.uploadedAt)) })
      renderLibrary()
    }, function (e) { setStatus($('ws-conn'), 'Documents stopped updating (' + e.code + '). Reload to reconnect.', 'err') })

    db.collection('log').orderBy('at', 'desc').onSnapshot(function (snap) {
      logList = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()) })
      renderLibrary()
    }, function (e) { setStatus($('ws-conn'), 'Activity stopped updating (' + e.code + '). Reload to reconnect.', 'err') })

    // Any item already open when the workspace connected.
    document.querySelectorAll('.item[open] .ws-slot').forEach(function (slot) {
      if (slot.getAttribute('data-built')) return
      slot.setAttribute('data-built', '1'); slot.hidden = false; buildSlot(slot)
    })
  }
  start()
})()
