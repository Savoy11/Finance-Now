// The shared workspace panel for the published Finance Now Ledger page.
//
// The ledger page is REGENERATED from the repository JSON (check-queue-ledger.mjs
// --html), never hand-edited — so anything people add to it cannot live in the HTML,
// or the next regeneration would erase it. Uploads and confirmations live in the
// artifact's own runtime storage instead, which survives every republish:
//
//   assets        the uploaded files themselves
//   db  docs/<assetId>   one row per file: name, type, size, kind, itemIds, note,
//                        uploadedBy, uploadedAt, archived
//   db  log/<id>         one row per action: itemId, kind (progress | confirmed |
//                        reopened | note), text, docIds, by, at, ord (ordering)
//   user          who uploaded or confirmed (ids only are stored; names resolve per view)
//
// The page must be published with WORKSPACE_CAPABILITIES. A confirmation recorded here
// does not change the ledger: Claude reads `log` (ArtifactData list) and applies it to
// the JSON in a pull request, and the page shows "ledger pending" until then.
//
// The browser half is two files inlined into one wrapper: ledgerWorkspace.core.js (every
// decision and every write, no DOM, run for real by the tests) and
// ledgerWorkspace.client.js (drawing and wiring). The builders here are pure strings, so
// the generator stays a single template (lib/server/__tests__/ledgerWorkspace.test.ts).
import fs from 'node:fs'

/**
 * Pass as `capabilities` when publishing the ledger page. The db rule raises writes to
 * `admin` (Editor, Owner, project members), the level that also gets `assets`, so the
 * people who can confirm an item are exactly the people who can upload its evidence.
 * Reads stay at the default (`view`): everyone the page is shared with sees the work.
 */
export const WORKSPACE_CAPABILITIES = {
  db: { rules: [{ path: '', write: 'admin' }] },
  assets: {},
  user: { scopes: ['profile'] },
}

function inlineSource(name) {
  const src = fs.readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')
  if (/<\/script/i.test(src)) throw new Error(`${name} must not contain a closing script tag`)
  return src
}
const CORE = inlineSource('ledgerWorkspace.core.js')
const CLIENT = inlineSource('ledgerWorkspace.client.js')

/** The item list the browser half needs, safe to embed inside a <script> element. */
export function itemsJson(items) {
  return JSON.stringify(items.map((i) => ({ id: i.id, title: i.title, status: i.status })))
    .replace(/</g, '\\u003c')
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), '\\u2029')
}

/** Empty per-item slot; the browser half fills it the first time the item is opened. */
export function workspaceItemSlot(id) {
  return `<div class="ws-slot" data-ws-item="${String(id).replace(/[^A-Za-z0-9-]/g, '')}" hidden></div>`
}

/**
 * The item list, then ONE script holding the core and the client inside a wrapper, so
 * `LedgerWorkspaceCore` never becomes a page global. The `;` between the two files is
 * load-bearing: the client opens with "(", and without it the core's closing "})()"
 * and the client parse as one call expression and the page throws on load.
 */
export function workspaceScripts(items) {
  return `<script type="application/json" id="ws-items">${itemsJson(items)}</script>\n<script>\n(function () {\n${CORE}\n;\n${CLIENT}\n})();\n</script>`
}

// ── "Added since the ledger began" (2026-09-30) ────────────────────────────────
// The owner asked for new work to be visible as new, not mixed into the status groups
// where an item filed last week looks like one from the first sweep. Two halves:
//   · FILED — items in the repository JSON numbered after the ledger's first version
//     (`baseline.through`), or carrying an `opened` block. Rendered here, from the JSON,
//     so they regenerate with everything else.
//   · WAITING — items recorded on the page itself (db collection `added`) before anyone
//     gives them a number. The browser half draws these; the page can add, file, drop
//     and restore them, and never removes one.

const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const STATUS_LABEL = { open: 'Open', blocked: 'Blocked', unclear: 'Unclear', parked: 'Parked', closed: 'Closed' }
const ROLE_NAMES = { 'owner-decision': 'Owner decision', 'owner-machine': "Owner's machine", either: 'Either', 'remote-dev': 'Dev' }

/** "T-398" -> { prefix: 'T', n: 398 }, or null. */
function splitId(id) {
  const m = /^([A-Z]{1,4})-(\d+)$/.exec(String(id ?? ''))
  return m ? { prefix: m[1], n: Number(m[2]) } : null
}

/**
 * The items that arrived after the ledger was made, newest first. `baseline` is
 * `{ through: 'T-398', on: '2026-09-16' }` (from the JSON, or the --baseline flag); without
 * one, only items carrying an `opened` block count as new.
 */
export function itemsAddedSince(items, baseline) {
  const base = splitId(baseline?.through)
  const isNew = (i) => {
    if (i.opened) return true
    const s = splitId(i.id)
    return !!(base && s && s.prefix === base.prefix && s.n > base.n)
  }
  const key = (i) => [i.opened?.on ?? '', splitId(i.id)?.n ?? 0]
  return items.filter(isNew).sort((a, b) => {
    const [da, na] = key(a), [dbb, nb] = key(b)
    return da < dbb ? 1 : da > dbb ? -1 : nb - na
  })
}

/** The section: filed items from the JSON, and the page-kept list the browser half fills. */
export function addedSection(filed, baseline) {
  const b = baseline?.through ? `${escHtml(baseline.through.replace(/-\d+$/, '-001'))} to ${escHtml(baseline.through)}` : ''
  const lede = b
    ? `The ledger's first version${baseline.on ? ` (${escHtml(baseline.on)})` : ''} held ${b}. Everything here arrived after it: first the items already given a number in the ledger, then the ones recorded on this page and waiting for one.`
    : 'Items that arrived after the ledger was made: first the ones already given a number in the ledger, then the ones recorded on this page and waiting for one.'
  const row = (i) => {
    const when = i.opened?.on ? ` · filed ${escHtml(i.opened.on)}${i.opened.by ? ` by ${escHtml(i.opened.by)}` : ''}` : ''
    return `<li class="ws-pend"><button class="ws-pend-id mono" type="button" data-jump="${escHtml(i.id)}">${escHtml(i.id)}</button><div><span class="ws-pend-title">${escHtml(i.title)}</span><span class="ws-dim"><span class="chip st-${escHtml(i.status)}">${STATUS_LABEL[i.status] ?? escHtml(i.status)}</span> ${ROLE_NAMES[i.owner_role] ?? ''}${when}</span></div></li>`
  }
  return `<section class="ws ws-added" id="added" aria-labelledby="added-h">
<p class="eyebrow">New work · added after the ledger was made</p>
<h2 id="added-h">Added since the ledger began</h2>
<p class="ws-lede">${lede} Anyone with edit access can add an item below; Claude gives it a number when it files it into the repository list, and it then moves to the first list.</p>
<div class="ws-grid">
<div class="ws-card">
<h3>In the ledger <span class="mono ws-count">${filed.length}</span></h3>
<p class="ws-hint">Numbered after the first version. Select a number to open the item below.</p>
<ul class="ws-pendlist added-filed">${filed.length ? filed.map(row).join('') : '<li class="ws-empty">None yet.</li>'}</ul>
</div>
<div class="ws-card">
<h3>Waiting for a number <span class="mono ws-count" id="added-count">0</span></h3>
<p class="ws-status" id="added-conn">Connecting…</p>
<ul class="ws-pendlist" id="added-list"></ul>
<label class="ws-check" id="added-show-wrap" hidden><input type="checkbox" id="added-show-closed"> Show filed and dropped</label>
<div id="added-form" hidden>
<label class="ws-label" for="added-title">New item</label>
<input id="added-title" class="ws-input" maxlength="200" placeholder="What needs doing, in a few words">
<label class="ws-label" for="added-detail">Details</label>
<textarea id="added-detail" class="ws-input" rows="3" placeholder="Why it matters, what done looks like, where it came from…"></textarea>
<div class="ws-filerow">
<label class="ws-label" for="added-role">Who does it</label>
<select id="added-role" class="ws-input"><option value="">Not decided</option>${Object.entries(ROLE_NAMES).map(([k, v]) => `<option value="${k}">${escHtml(v)}</option>`).join('')}</select>
</div>
<label class="ws-label" for="added-source">Source (optional)</label>
<input id="added-source" class="ws-input" maxlength="300" placeholder="A doc, a chat, a decision…">
<div class="ws-btnrow"><button type="button" class="ws-btn primary" id="added-save">Add item</button><span class="ws-status" id="added-status"></span></div>
</div>
</div>
</div>
</section>`
}

export function workspaceSection(sourceLabel = 'docs/audits/task-queue-2026-09-07.json') {
  return `<section class="ws" id="workspace" aria-labelledby="ws-h">
<p class="eyebrow">Shared workspace · documents and confirmations</p>
<h2 id="ws-h">Workspace</h2>
<p class="ws-lede">Upload research and evidence, attach it to an item, and confirm work as done. Everything here is kept with this page across every regeneration. A confirmation marks an item for the ledger; the ledger itself changes only when the repository JSON does, so a confirmed item reads <b>ledger pending</b> until Claude applies it.</p>
<p class="ws-status" id="ws-conn">Connecting to the workspace…</p>

<div id="ws-live" hidden>
<div class="ws-grid">

<div class="ws-card" id="ws-uploader" hidden>
<h3>Add documents</h3>
<label class="ws-label" for="ws-file">Files</label>
<input type="file" id="ws-file" multiple>
<p class="ws-hint">PDF, images, Markdown, plain text, CSV, JSON or video, up to 20 MB each. Word and Excel files need exporting to PDF or CSV first.</p>
<label class="ws-label" for="ws-item">Attach to item</label>
<select id="ws-item" class="ws-input"><option value="">No item — general reference</option></select>
<label class="ws-label" for="ws-kind">Kind</label>
<select id="ws-kind" class="ws-input"></select>
<label class="ws-label" for="ws-note">Note</label>
<textarea id="ws-note" class="ws-input" rows="2" placeholder="What this is and why it matters…"></textarea>
<div class="ws-btnrow"><button type="button" class="ws-btn primary" id="ws-upload">Upload</button><span class="ws-status" id="ws-upload-status"></span></div>
<p class="ws-hint mono" id="ws-usage"></p>
</div>

<div class="ws-card ws-readonly" id="ws-readonly" hidden>
<h3>View only</h3>
<p class="ws-hint">You can open every document and read the history. Uploading and confirming need edit access to this page.</p>
</div>

<div class="ws-card">
<h3>Awaiting the ledger <span class="mono ws-count" id="ws-pend-count">0</span></h3>
<p class="ws-hint">Confirmed or reopened here, not yet reflected in the repository.</p>
<ul class="ws-pendlist" id="ws-pending"></ul>
</div>

</div>

<div class="ws-card ws-wide">
<div class="ws-libhead"><h3>Library <span class="mono ws-count" id="ws-doc-count">0</span></h3>
<div class="ws-filters">
<select id="ws-filter-item" class="ws-input" aria-label="Filter by item"><option value="">All items</option></select>
<select id="ws-filter-kind" class="ws-input" aria-label="Filter by kind"><option value="">All kinds</option></select>
<label class="ws-check"><input type="checkbox" id="ws-show-archived"> Show archived</label>
</div></div>
<ul class="ws-docs" id="ws-docs"></ul>
<p class="ws-hint">Archiving hides a document from this list. Nothing uploaded here is ever deleted.</p>
</div>

<div class="ws-card ws-wide">
<h3>Recent activity</h3>
<ul class="ws-loglist" id="ws-activity"></ul>
</div>

<details class="ws-how"><summary>How Claude uses this</summary>
<p>Another Claude session given this page's link reads the workspace with the artifact data tool: the <code>docs</code> collection lists every file with the items it belongs to, the <code>log</code> collection holds every progress note, confirmation and reopen, and the <code>added</code> collection holds the items recorded above as waiting for a number. It reads an uploaded file through the artifact's asset path. A confirmation becomes a ledger closure, and an added item becomes a numbered one, only through a pull request that edits <code>${escHtml(sourceLabel)}</code>, after which this page is regenerated.</p>
</details>
</div>
</section>`
}

export const WORKSPACE_CSS = `
.ws h2{margin-bottom:6px}
.ws-lede{max-width:78ch;color:var(--ink2);margin:0 0 10px}
.ws h3{font:600 15px/1.3 var(--serif);margin:0 0 8px;display:flex;align-items:center;gap:8px}
.ws-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin-top:10px}
.ws-card{background:var(--bg2);border:1px solid var(--line);border-radius:6px;padding:12px 14px;min-width:0}
.ws-wide{margin-top:12px}
.ws-label{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute);font-weight:600;margin:10px 0 4px}
.ws-input{width:100%;max-width:100%;padding:7px 9px;border:1px solid var(--line2);border-radius:6px;background:var(--bg);color:var(--ink);font:inherit}
textarea.ws-input{resize:vertical}
.ws input[type=file]{max-width:100%;font:inherit;color:var(--ink2)}
.ws-hint{font-size:12.5px;color:var(--mute);margin:6px 0 0}
.ws-btnrow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}
.ws-btn{border:1px solid var(--line2);background:var(--bg3);color:var(--ink);border-radius:6px;padding:6px 12px;font:500 13px var(--sans);cursor:pointer}
.ws-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.ws-btn:disabled{opacity:.55;cursor:progress}
.ws-btn:focus-visible,.ws-input:focus,.ws-link:focus-visible,.ws-itemchip:focus-visible,.ws-pend-id:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.ws-link{background:none;border:0;color:var(--accent);font:500 12.5px var(--sans);cursor:pointer;padding:2px 4px;white-space:nowrap}
.ws-status{font-size:12.5px;color:var(--mute);margin:0}
.ws-status.ok{color:var(--pass)}.ws-status.err{color:var(--fail)}
.ws-count{font:500 13px var(--mono);color:var(--mute)}
.ws-dim{color:var(--mute);font-size:12.5px}
.ws-note{margin:4px 0 0;font-size:13px;color:var(--ink2);white-space:pre-wrap;overflow-wrap:anywhere}
.ws-empty{color:var(--mute);font-size:13px;list-style:none;padding:6px 0}
.ws-docs,.ws-loglist,.ws-pendlist{list-style:none;margin:6px 0 0;padding:0}
.ws-doc{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:start;padding:8px 0;border-top:1px solid var(--line)}
.ws-doc:first-child{border-top:0}
.ws-doc.archived{opacity:.6}
.ws-type{font-size:10.5px;text-align:center;border:1px solid var(--line2);border-radius:4px;padding:3px 0;color:var(--ink2)}
.ws-doc-main{min-width:0}
.ws-doc-name{font-weight:500;overflow-wrap:anywhere}
.ws-doc-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:3px}
.ws-itemchip{cursor:pointer;background:var(--bg3);color:var(--ink2);border-color:var(--line2)}
.ws-libhead{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between}
.ws-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ws-filters .ws-input{width:auto;min-width:0}
.ws-check{font-size:13px;color:var(--ink2);display:inline-flex;gap:6px;align-items:center}
.ws-pend{display:grid;grid-template-columns:auto 1fr;gap:10px;padding:8px 0;border-top:1px solid var(--line)}
.ws-pend:first-child{border-top:0}
.ws-pend-id{background:none;border:0;color:var(--accent);font:500 12.5px var(--mono);cursor:pointer;padding:0}
.ws-pend-title{display:block;font-weight:500}
.ws-log{padding:7px 0;border-top:1px solid var(--line)}
.ws-log:first-child{border-top:0}
.ws-log-head{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
.ws-log-kind{font-weight:500;font-size:13px}
.ws-log.k-confirmed .ws-log-kind{color:var(--closed)}.ws-log.k-reopened .ws-log-kind{color:var(--blocked)}.ws-log.k-progress .ws-log-kind{color:var(--open)}
.ws-log-files{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:4px;font-size:13px}
.ws-how{margin-top:12px;font-size:13px;color:var(--ink2);max-width:78ch}
.ws-how summary{cursor:pointer;color:var(--accent);font-weight:500}
.ws-how code{font-family:var(--mono);font-size:12px;background:var(--bg3);padding:1px 5px;border-radius:3px}
.chip.ws-chip{background:var(--bg3);border-color:var(--line2);color:var(--ink2)}
.chip.ws-chip[data-state=confirmed]{background:var(--closed-bg);border-color:var(--closed);color:var(--ink)}
.chip.ws-chip[data-state=reopened]{background:var(--blocked-bg);border-color:var(--blocked);color:var(--ink)}
.chip.ws-chip[data-state=progress]{background:var(--open-bg);border-color:var(--open);color:var(--ink)}
.ws-slot{margin-top:12px;padding-top:10px;border-top:1px dashed var(--line2);max-width:78ch}
.ws-eyebrow{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);font-weight:600;margin:10px 0 4px}
.ws-state{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ws-badge{font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid var(--line2)}
.ws-badge.k-confirmed{background:var(--closed-bg);border-color:var(--closed)}.ws-badge.k-reopened{background:var(--blocked-bg);border-color:var(--blocked)}.ws-badge.k-progress{background:var(--open-bg);border-color:var(--open)}
.ws-itemform{margin-top:8px}
.ws-filerow{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-top:4px}
.ws-filerow .ws-label{margin:0;width:100%}
.ws-filerow .ws-input{width:auto}
.ws-doc-side{display:flex;flex-direction:column;align-items:flex-end;gap:2px;max-width:220px;text-align:right}
@media (max-width:640px){.ws-doc{grid-template-columns:36px 1fr}.ws-doc-side{grid-column:2;align-items:flex-start;text-align:left;max-width:none}}
.ws-added .ws-pend .ws-dim{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;margin-top:2px}
.ws-added .added-filed{max-height:420px;overflow:auto}
.ws-added-row.done{opacity:.65}
.ws-added-acts{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin-top:4px}
.ws-added-acts .ws-input{width:auto;min-width:0;flex:1 1 140px}
#added-form{margin-top:10px;padding-top:8px;border-top:1px dashed var(--line2)}
`
