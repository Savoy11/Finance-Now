// Runs the ledger integrity checks (scripts/lib/queueLedgerChecks.mjs) against
// docs/audits/task-queue-2026-09-07.json, and optionally renders the ledger as a
// self-contained HTML page for publishing.
//
//   npm run queue:check                              # CI: exit 1 on any `fail` finding
//   node scripts/check-queue-ledger.mjs --html out.html   # also write the page
//
// REPORTS, NEVER WRITES to the ledger — same split as the fee and probe scripts. If a
// check is red, fix the JSON and re-run; do not teach the check to look away.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runChecks, evidenceOf, STATUSES, ROLES } from './lib/queueLedgerChecks.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '../..')
const QUEUE = path.join(ROOT, 'docs/audits/task-queue-2026-09-07.json')
const REG = path.join(ROOT, 'frontend/src/lib/server/sourceTerms.ts')

const args = process.argv.slice(2)
const htmlOut = args.includes('--html') ? args[args.indexOf('--html') + 1] : null
if (args.includes('--html') && !htmlOut) { console.error('--html needs a path'); process.exit(2) }

const ledger = JSON.parse(fs.readFileSync(QUEUE, 'utf8'))
const registrySource = fs.readFileSync(REG, 'utf8')
// Local calendar date, not UTC — a late-evening run on the owner's machine should not
// stamp the page with tomorrow's date.
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
const result = runChecks(ledger, { registrySource, exists: (p) => fs.existsSync(path.join(ROOT, p)) })

// ── report ─────────────────────────────────────────────────────────────────
for (const c of result.checks) {
  const n = c.findings.length
  console.log(`  ${c.id.padEnd(4)} ${(n ? c.severity : 'pass').padEnd(7)} ${c.name}${n ? ` — ${n}` : ''}`)
  if (n && n <= 10) for (const f of c.findings) console.log(`         ${f}`)
  else if (n) console.log(`         (${n} findings — first: ${c.findings[0]})`)
}
console.log(`\n${result.fails ? '✗' : '✓'} queue:check — ${result.fails} failing, ${result.warns} warning, ${result.reviews} to review, over ${ledger.outstanding.length} items`)

// ── html ───────────────────────────────────────────────────────────────────
if (htmlOut) {
  fs.writeFileSync(path.resolve(htmlOut), renderHtml(ledger, result, today), 'utf8')
  console.log(`wrote ${path.resolve(htmlOut)}`)
}
process.exit(result.fails ? 1 : 0)

function renderHtml(q, result, checkedOn) {
  const items = q.outstanding
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const tally = (k) => { const t = {}; for (const i of items) t[i[k]] = (t[i[k]] ?? 0) + 1; return t }
  const S = tally('status'), R = tally('owner_role')
  const LABEL = { open: 'Open', blocked: 'Blocked', unclear: 'Unclear', parked: 'Parked', closed: 'Closed' }
  const ROLE_LABEL = { 'owner-decision': 'Owner decision', 'owner-machine': "Owner's machine", either: 'Either', 'remote-dev': 'Dev' }
  const done = S.closed ?? 0, notDone = items.length - done
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

  const itemHtml = (i) => {
    const c = i.closure, p = i.progress
    const text = esc(`${i.id} ${i.title} ${i.summary} ${i.next_action} ${i.blocking_decision ?? ''} ${i.category}`.toLowerCase())
    return `<details class="item" data-status="${i.status}" data-role="${i.owner_role}" data-text="${text}">
<summary><span class="id">${esc(i.id)}</span><span class="title">${esc(i.title)}</span><span class="chips"><span class="chip st-${i.status}">${LABEL[i.status]}</span><span class="chip role">${ROLE_LABEL[i.owner_role]}</span><span class="chip dim">${esc(i.category)} · ${esc(i.effort)}</span></span></summary>
<div class="body">
${i.blocking_decision ? `<p class="kv"><b>Blocked on</b>${esc(i.blocking_decision)}</p>` : ''}
<p class="kv"><b>Summary</b>${esc(i.summary)}</p>
<p class="kv"><b>Next action</b>${esc(i.next_action)}</p>
${p?.note ? `<p class="kv note"><b>Progress · ${esc(p.noted_on)}</b>${esc(p.note)}</p>` : ''}
${c ? `<div class="closure"><p class="kv"><b>Closed ${esc(c.closed_on ?? '—')} · ${esc(c.verdict ?? 'no verdict recorded')} · ${esc(c.basis ?? '')}</b>${esc(c.reason ?? '')}</p>${evidenceOf(c).length ? `<p class="kv"><b>Evidence</b>${evidenceOf(c).map(esc).join('<br>')}</p>` : ''}${c.approved_by ? `<p class="kv"><b>Approved by</b>${esc(c.approved_by)}</p>` : ''}</div>` : ''}
${i.related_ids?.length ? `<p class="kv dimtext"><b>Related</b>${i.related_ids.map(esc).join(', ')}</p>` : ''}
</div></details>`
  }

  const sections = STATUSES.map((s) => {
    const list = items.filter((i) => i.status === s)
    return `<section class="group" data-group="${s}"><h2><span class="dot st-${s}"></span>${LABEL[s]} <span class="count mono" data-count="${s}">${list.length}</span></h2>${list.map(itemHtml).join('\n')}</section>`
  }).join('\n')

  const checkHtml = result.checks.map((c) => {
    const n = c.findings.length, state = n ? c.severity : 'pass'
    const label = n === 0 ? 'pass' : c.severity === 'review' ? `${n} to review` : plural(n, c.severity === 'warn' ? 'warning' : 'failure')
    return `<details class="check ${state}"><summary><span class="mark"></span><span class="cid mono">${c.id}</span><span class="cname">${esc(c.name)}</span><span class="cn mono">${label}</span></summary><div class="cbody"><p class="why">${esc(c.why)}</p>${n ? `<ul>${c.findings.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p class="ok">Nothing found.</p>'}</div></details>`
  }).join('\n')

  const failing = result.checks.filter((c) => c.severity === 'fail' && c.findings.length).length
  const verdictLine = result.fails ? `${plural(result.fails, 'failing finding')} across ${plural(failing, 'check')}` : 'No failing checks'

  return `<title>Finance Now Ledger</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{
  --bg:#F7F8F6;--bg2:#FFFFFF;--bg3:#EEF1EE;--ink:#1C2321;--ink2:#4A5551;--mute:#6A7570;--line:#D9DED9;--line2:#C4CBC5;
  --accent:#0F6E68;--accent-ink:#FFFFFF;
  --open:#B7791F;--blocked:#B23A2E;--closed:#2A7D5F;--parked:#5B6B75;--unclear:#6B4FA0;
  --open-bg:#FBF3E3;--blocked-bg:#FBEAE7;--closed-bg:#E6F3EC;--parked-bg:#ECEFF1;--unclear-bg:#EFEAF7;
  --pass:#2A7D5F;--fail:#B23A2E;--warn:#B7791F;--review:#0F6E68;
  --serif:"IBM Plex Serif",Georgia,"Times New Roman",serif;--sans:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#161A18;--bg2:#1E2321;--bg3:#252B28;--ink:#E6EAE7;--ink2:#B5BDB8;--mute:#8A948E;--line:#2F3733;--line2:#3D4642;
  --accent:#3FB3AA;--accent-ink:#0E1513;
  --open:#E0A64A;--blocked:#E8705F;--closed:#5CC191;--parked:#93A2AC;--unclear:#A78BD8;
  --open-bg:#2E2617;--blocked-bg:#331E1B;--closed-bg:#17301F;--parked-bg:#222A2E;--unclear-bg:#26203A;
  --pass:#5CC191;--fail:#E8705F;--warn:#E0A64A;--review:#3FB3AA;
}}
:root[data-theme="dark"]{
  --bg:#161A18;--bg2:#1E2321;--bg3:#252B28;--ink:#E6EAE7;--ink2:#B5BDB8;--mute:#8A948E;--line:#2F3733;--line2:#3D4642;
  --accent:#3FB3AA;--accent-ink:#0E1513;
  --open:#E0A64A;--blocked:#E8705F;--closed:#5CC191;--parked:#93A2AC;--unclear:#A78BD8;
  --open-bg:#2E2617;--blocked-bg:#331E1B;--closed-bg:#17301F;--parked-bg:#222A2E;--unclear-bg:#26203A;
  --pass:#5CC191;--fail:#E8705F;--warn:#E0A64A;--review:#3FB3AA;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 var(--sans);-webkit-font-smoothing:antialiased}
.wrap{max-width:1100px;margin:0 auto;padding-inline:16px;padding-block:0 48px}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
a{color:var(--accent)}
header.top{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bg);border-bottom:1px solid var(--line);padding-block:14px 12px}
header.top .wrap{padding-block:0}
h1{font:600 26px/1.15 var(--serif);margin:0;letter-spacing:-.01em;text-wrap:balance}
.sub{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:6px;color:var(--mute);font-size:12.5px}
.sub .mono{color:var(--ink2)}
.verdict{display:inline-flex;align-items:center;gap:8px;margin-top:10px;padding:6px 10px;border-radius:6px;font-weight:500;font-size:13px;background:var(--bg3);border:1px solid var(--line)}
.verdict .mark{width:9px;height:9px;border-radius:50%;background:var(--fail)}
.verdict.pass .mark{background:var(--pass)}
section{margin-top:28px}
h2{font:600 18px/1.2 var(--serif);margin:0 0 12px;display:flex;align-items:center;gap:10px;letter-spacing:-.005em}
h2 .count{font-weight:500;color:var(--mute);font-size:14px}
.dot{width:10px;height:10px;border-radius:50%;flex:none}
.st-open{color:var(--open)}.st-blocked{color:var(--blocked)}.st-closed{color:var(--closed)}.st-parked{color:var(--parked)}.st-unclear{color:var(--unclear)}
.dot.st-open{background:var(--open)}.dot.st-blocked{background:var(--blocked)}.dot.st-closed{background:var(--closed)}.dot.st-parked{background:var(--parked)}.dot.st-unclear{background:var(--unclear)}
.eyebrow{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);font-weight:600;margin:0 0 8px}
.bar{display:flex;height:14px;border-radius:4px;overflow:hidden;gap:2px;background:var(--line)}
.seg{display:block;min-width:2px}
.seg-open{background:var(--open)}.seg-blocked{background:var(--blocked)}.seg-closed{background:var(--closed)}.seg-parked{background:var(--parked)}.seg-unclear{background:var(--unclear)}
.legend{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:10px;font-size:13px}
.legend span{display:inline-flex;align-items:center;gap:7px}
.legend b{font-family:var(--mono);font-weight:500;font-variant-numeric:tabular-nums}
.done{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:14px}
.done div{background:var(--bg2);border:1px solid var(--line);border-radius:6px;padding:10px 12px}
.done .n{font:500 24px/1 var(--mono);font-variant-numeric:tabular-nums;display:block;margin-bottom:4px}
.done small{color:var(--mute);display:block;font-size:12px}
.check{border:1px solid var(--line);border-radius:6px;background:var(--bg2);margin-bottom:6px}
.check summary{display:grid;grid-template-columns:14px 34px 1fr auto;gap:10px;align-items:center;padding:9px 12px;cursor:pointer;list-style:none}
.check summary::-webkit-details-marker{display:none}
.check .mark{width:10px;height:10px;border-radius:50%;background:var(--pass)}
.check.fail .mark{background:var(--fail)}.check.warn .mark{background:var(--warn)}.check.review .mark{background:var(--review)}
.check .cid{color:var(--mute);font-size:12px}
.check .cn{font-size:12px;color:var(--mute)}
.check.fail .cn{color:var(--fail);font-weight:500}.check.warn .cn{color:var(--warn);font-weight:500}.check.review .cn{color:var(--review);font-weight:500}
.cbody{padding:0 12px 12px 58px;font-size:13px}
.cbody .why{color:var(--ink2);margin:0 0 8px}
.cbody ul{margin:0;padding-left:18px}.cbody li{margin:2px 0;font-family:var(--mono);font-size:12.5px}
.cbody .ok{color:var(--mute);margin:0}
.controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;position:sticky;top:calc(env(safe-area-inset-top,0px) + 92px);z-index:4;background:var(--bg);padding-block:10px;border-bottom:1px solid var(--line);margin-top:28px}
.controls input[type=search]{flex:1 1 220px;min-width:0;padding:7px 10px;border:1px solid var(--line2);border-radius:6px;background:var(--bg2);color:var(--ink);font:inherit}
.controls input:focus,.controls select:focus,.tog:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.controls select{padding:7px 8px;border:1px solid var(--line2);border-radius:6px;background:var(--bg2);color:var(--ink);font:inherit}
.tog{border:1px solid var(--line2);background:var(--bg2);color:var(--ink2);border-radius:999px;padding:4px 11px;font:500 12.5px var(--sans);cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.tog[aria-pressed=true]{background:var(--bg3);border-color:var(--ink2);color:var(--ink)}
.tog .dot{width:8px;height:8px}
.showing{width:100%;font-size:12.5px;color:var(--mute)}
.item{border-bottom:1px solid var(--line)}
.item summary{display:grid;grid-template-columns:52px 1fr;gap:4px 12px;padding:9px 0;cursor:pointer;list-style:none;align-items:baseline}
.item summary::-webkit-details-marker{display:none}
.item .id{font-family:var(--mono);font-size:12.5px;color:var(--mute);font-variant-numeric:tabular-nums}
.item .title{font-weight:500}
.item .chips{grid-column:2;display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid transparent;font-weight:500;white-space:nowrap}
.chip.st-open{background:var(--open-bg);border-color:var(--open)}.chip.st-blocked{background:var(--blocked-bg);border-color:var(--blocked)}.chip.st-closed{background:var(--closed-bg);border-color:var(--closed)}.chip.st-parked{background:var(--parked-bg);border-color:var(--parked)}.chip.st-unclear{background:var(--unclear-bg);border-color:var(--unclear)}
.chip.role{background:var(--bg3);color:var(--ink2);border-color:var(--line2)}
.chip.dim{color:var(--mute);border-color:var(--line)}
.item .body{padding:2px 0 14px 64px;font-size:13.5px}
.kv{margin:0 0 9px;max-width:78ch}
.kv b{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute);font-weight:600;margin-bottom:2px}
.kv.note{border-left:3px solid var(--accent);padding-left:10px}
.closure{background:var(--closed-bg);border-radius:6px;padding:10px 12px;margin:10px 0}
.closure .kv:last-child{margin-bottom:0}
.dimtext{color:var(--mute);font-size:12.5px}
.group[hidden]{display:none}
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);color:var(--mute);font-size:12.5px;max-width:78ch}
footer code{font-family:var(--mono);font-size:12px;background:var(--bg3);padding:1px 5px;border-radius:3px}
@media (max-width:640px){
  .item summary{grid-template-columns:1fr}.item .chips{grid-column:1}.item .body{padding-left:0}
  .cbody{padding-left:12px}
  .controls{top:calc(env(safe-area-inset-top,0px) + 118px)}
}
@media (prefers-reduced-motion:no-preference){.check,.item{transition:background-color .15s}}
</style>

<header class="top"><div class="wrap">
<h1>Finance Now Ledger</h1>
<div class="sub"><span>Source <span class="mono">docs/audits/task-queue-2026-09-07.json</span></span><span>Checked <span class="mono">${checkedOn}</span></span><span>main <span class="mono">${esc(String(q.main_sha).slice(0, 7))}</span> at generation, ledger since maintained by annotation</span><span><span class="mono">${items.length}</span> items</span></div>
<div class="verdict${result.fails ? '' : ' pass'}"><span class="mark"></span>${esc(verdictLine)} · ${plural(result.warns, 'warning')} · ${result.reviews} to review</div>
</div></header>

<div class="wrap">

<section>
<p class="eyebrow">Completion</p>
<div class="bar">${STATUSES.map((s) => `<span class="seg seg-${s}" style="flex:${S[s] ?? 0}" title="${LABEL[s]} ${S[s] ?? 0}"></span>`).join('')}</div>
<div class="legend">${STATUSES.map((s) => `<span><span class="dot st-${s}"></span>${LABEL[s]} <b>${S[s] ?? 0}</b></span>`).join('')}</div>
<div class="done">
<div><span class="n st-closed">${done}</span><small>closed with a recorded closure — ${Math.round((done / items.length) * 100)}% of the ledger</small></div>
<div><span class="n st-open">${notDone}</span><small>not closed: ${S.open ?? 0} open, ${S.blocked ?? 0} blocked, ${S.parked ?? 0} parked, ${S.unclear ?? 0} unclear</small></div>
<div><span class="n">${(S.open ?? 0) + (S.blocked ?? 0)}</span><small>genuinely outstanding once the ${S.parked ?? 0} deliberately parked are set aside</small></div>
<div><span class="n">${items.filter((i) => i.status !== 'closed' && i.owner_role === 'owner-decision').length}</span><small>of those need an owner decision; ${items.filter((i) => i.status !== 'closed' && i.owner_role === 'owner-machine').length} need the owner's machine</small></div>
</div>
</section>

<section>
<p class="eyebrow">Integrity checks · run ${checkedOn} by <span class="mono">npm run queue:check</span></p>
${checkHtml}
</section>

<div class="controls">
<input type="search" id="q" placeholder="Search id, title, summary, next action…" aria-label="Search items">
<select id="role" aria-label="Owner role"><option value="">Any role</option>${ROLES.map((r) => `<option value="${r}">${ROLE_LABEL[r]} (${R[r] ?? 0})</option>`).join('')}</select>
${STATUSES.map((s) => `<button class="tog" id="tog-${s}" type="button" data-status="${s}" aria-pressed="true"><span class="dot st-${s}"></span>${LABEL[s]}</button>`).join('')}
<span class="showing" id="showing"></span>
</div>

${sections}

<footer>Regenerated from the canonical JSON by <code>node scripts/check-queue-ledger.mjs --html &lt;out&gt;</code> — this page never edits it. The same checks run in CI as <code>npm run queue:check</code>. Closed items keep their full closure record so a closure can be audited from here without opening the file.</footer>
</div>

<script>
(function(){
  var q=document.getElementById('q'),role=document.getElementById('role'),togs=[].slice.call(document.querySelectorAll('.tog')),showing=document.getElementById('showing');
  var items=[].slice.call(document.querySelectorAll('.item'));
  var total=items.length;
  function apply(){
    var text=(q.value||'').trim().toLowerCase(),r=role.value,on={};
    togs.forEach(function(t){on[t.dataset.status]=t.getAttribute('aria-pressed')==='true'});
    var counts={},vis=0;
    items.forEach(function(el){
      var ok=on[el.dataset.status]&&(!r||el.dataset.role===r)&&(!text||el.dataset.text.indexOf(text)>-1);
      el.hidden=!ok; if(ok){vis++;counts[el.dataset.status]=(counts[el.dataset.status]||0)+1}
    });
    document.querySelectorAll('.group').forEach(function(g){
      var s=g.dataset.group,n=counts[s]||0;
      g.hidden=!on[s]||n===0;
      var c=g.querySelector('[data-count]'); if(c) c.textContent=n;
    });
    showing.textContent='Showing '+vis+' of '+total;
    try{localStorage.setItem('fnl.filters',JSON.stringify({q:q.value,r:r,on:on}))}catch(e){}
  }
  togs.forEach(function(t){t.addEventListener('click',function(){t.setAttribute('aria-pressed',t.getAttribute('aria-pressed')==='true'?'false':'true');apply()})});
  q.addEventListener('input',apply); role.addEventListener('change',apply);
  try{var s=JSON.parse(localStorage.getItem('fnl.filters')||'null'); if(s){q.value=s.q||'';role.value=s.r||'';togs.forEach(function(t){if(s.on&&s.on[t.dataset.status]===false)t.setAttribute('aria-pressed','false')})}}catch(e){}
  apply();
})();
</script>
`
}
