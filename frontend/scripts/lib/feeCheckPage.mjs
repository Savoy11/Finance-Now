// The Transfer Fee Check page (T-031, D52): the owner's check list for the hand pass over
// the transfer-fee table, published as a claude.ai artifact.
//
// The page is REGENERATED from transferFees.ts (npm run fee-check-page), never
// hand-edited, so the owner's answers cannot live in its HTML. They live in the
// artifact's own runtime storage, which survives every republish:
//
//   db  checks/<exchange:coin:network>  one answer per table row: result, fee, min, note,
//                                       comparedFee, comparedMin, at, by
//   db  trading/<exchangeId>            one answer per exchange's entry-tier trading fee
//   db  notes/<exchangeId>              a free note about the exchange (link moved, login…)
//   user                                who answered (ids only are stored)
//
// Publish it with FEE_CHECK_CAPABILITIES. An answer changes nothing in the table: Claude
// reads the collections (ArtifactData list), runs npm run fee-check-plan over them, and
// applies the result in a pull request.
//
// The browser half is two files inlined into one wrapper: feeCheck.core.js (every
// decision and every write, no DOM, run for real by the tests) and feeCheck.client.js
// (drawing and wiring). Everything here is a pure string builder.
import fs from 'node:fs'

/**
 * Pass as `capabilities` when publishing. The db rule raises writes to `admin` (Editor,
 * Owner): the answers are the owner's readings, and a viewer the page is shared with to
 * look at must not be able to change them. Reads stay at the default.
 */
export const FEE_CHECK_CAPABILITIES = {
  db: { rules: [{ path: '', write: 'admin' }] },
  user: {},
}

export const FEE_CHECK_TITLE = 'Transfer Fee Check'

function inlineSource(name) {
  const src = fs.readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')
  if (/<\/script/i.test(src)) throw new Error(`${name} must not contain a closing script tag`)
  return src
}

/** The page data, safe to embed inside a <script> element. */
export function dataJson(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029')
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function longDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export const FEE_CHECK_CSS = `
/* Layout: one reading column — summary, then one card per exchange, rows stacked inside. */
:root{
  --bg:#F7F8F6;--bg2:#FFFFFF;--bg3:#EEF1EE;--ink:#1C2321;--ink2:#4A5551;--mute:#6A7570;--line:#D9DED9;--line2:#C4CBC5;
  --accent:#0F6E68;--accent-ink:#FFFFFF;--accent-bg:#E3F1EF;
  --ok:#2A7D5F;--ok-bg:#E6F3EC;--diff:#B7791F;--diff-bg:#FBF3E3;--gone:#5B6B75;--gone-bg:#ECEFF1;--cant:#6B4FA0;--cant-bg:#EFEAF7;
  --stale:#B23A2E;--stale-bg:#FBEAE7;
  --serif:"IBM Plex Serif",Georgia,"Times New Roman",serif;--sans:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#161A18;--bg2:#1E2321;--bg3:#252B28;--ink:#E6EAE7;--ink2:#B5BDB8;--mute:#8A948E;--line:#2F3733;--line2:#3D4642;
  --accent:#3FB3AA;--accent-ink:#0E1513;--accent-bg:#17302D;
  --ok:#5CC191;--ok-bg:#17301F;--diff:#E0A64A;--diff-bg:#2E2617;--gone:#93A2AC;--gone-bg:#222A2E;--cant:#A78BD8;--cant-bg:#26203A;
  --stale:#E8705F;--stale-bg:#331E1B;color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#161A18;--bg2:#1E2321;--bg3:#252B28;--ink:#E6EAE7;--ink2:#B5BDB8;--mute:#8A948E;--line:#2F3733;--line2:#3D4642;
  --accent:#3FB3AA;--accent-ink:#0E1513;--accent-bg:#17302D;
  --ok:#5CC191;--ok-bg:#17301F;--diff:#E0A64A;--diff-bg:#2E2617;--gone:#93A2AC;--gone-bg:#222A2E;--cant:#A78BD8;--cant-bg:#26203A;
  --stale:#E8705F;--stale-bg:#331E1B;color-scheme:dark}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.5}
.wrap{max-width:880px;margin:0 auto;padding-inline:16px;padding-block:28px 64px;display:flex;flex-direction:column;gap:22px}
h1{font-family:var(--serif);font-weight:600;font-size:30px;line-height:1.15;margin:0;text-wrap:balance}
h2{font-family:var(--serif);font-weight:600;font-size:20px;margin:0}
p{margin:0}
a{color:var(--accent)}
a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
.eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin:0 0 6px}
.lede{color:var(--ink2);max-width:66ch}
.lede b{color:var(--ink)}
.status{font-size:13px;color:var(--ink2)}
.status.ok{color:var(--ok)}.status.warn{color:var(--diff)}.status.err{color:var(--stale)}
.meters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.meter{background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:12px 14px;min-width:0}
.meter-n{font-size:13px;color:var(--ink2)}.meter-n b{font-size:22px;color:var(--ink);font-weight:500}
.meter-l{font-size:13px;color:var(--mute);margin-top:2px}
.bar{height:6px;border-radius:3px;background:var(--bg3);margin-top:10px;overflow:hidden}
.bar span{display:block;height:100%;background:var(--accent)}
.controls{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center;position:sticky;top:env(safe-area-inset-top,0px);z-index:2;background:var(--bg);padding-block:10px;border-bottom:1px solid var(--line)}
.seg{display:inline-flex;border:1px solid var(--line2);border-radius:8px;overflow:hidden}
.seg button{border:0;border-radius:0;background:var(--bg2);color:var(--ink2);padding:7px 12px;font:inherit;font-size:14px;cursor:pointer}
.seg button+button{border-left:1px solid var(--line2)}
.seg button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink)}
.toggle{display:inline-flex;gap:8px;align-items:center;font-size:14px;color:var(--ink2)}
.leadbox{background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.leadbox ul,.leads ul{margin:8px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:6px}
.lead-id{font-weight:500;font-size:12.5px;color:var(--mute);margin-right:4px}
.lead-where{font-size:12.5px;margin-left:4px;color:var(--accent)}
span.lead-where{color:var(--mute)}
.lead-sum{display:block;font-size:13px;color:var(--mute)}
.ex{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px;scroll-margin-top:72px}
.ex-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px}
.ex-name{font-family:var(--serif);font-weight:600;font-size:19px;margin:0}
.tier{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute)}
.ex-count{margin-left:auto;font-size:13px;color:var(--ink2);font-family:var(--mono);font-variant-numeric:tabular-nums}
.ex-link{font-size:14px}
.hint{color:var(--mute);font-size:13px}
.callout{font-size:13.5px;background:var(--accent-bg);color:var(--ink2);border-radius:8px;padding:9px 12px}
.callout.warn{background:var(--diff-bg)}
.leads{font-size:14px}
.leads-h{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.rows{display:flex;flex-direction:column;gap:8px}
.row{border:1px solid var(--line);border-left:4px solid var(--line2);border-radius:8px;padding:10px 12px;display:grid;grid-template-columns:minmax(0,10rem) minmax(0,12rem) minmax(0,1fr);gap:4px 14px;align-items:start}
.row.is-ok{border-left-color:var(--ok)}.row.is-changed{border-left-color:var(--diff)}.row.is-not-offered{border-left-color:var(--gone)}
.row.is-cant-see{border-left-color:var(--cant)}.row.is-stale{border-left-color:var(--stale)}.row.is-applied{border-left-color:var(--ok)}
.row.trading{background:var(--bg3)}
.what{display:flex;flex-wrap:wrap;gap:2px 8px;align-items:baseline;min-width:0}
.coin{font-weight:600}.net{color:var(--ink2);font-size:14px}
.core-tag{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
.row.is-core .core-tag{display:none}
.vals{margin:0;display:flex;flex-wrap:wrap;gap:2px 14px;min-width:0}
.vals div{display:flex;gap:6px;align-items:baseline}
.vals dt{font-size:12px;color:var(--mute)}.vals dd{margin:0;font-size:14px}
.flags,.tnote{grid-column:1/-1;font-size:13px;color:var(--ink2)}
.flags{color:var(--diff)}
.answer{grid-column:3;grid-row:1/span 2;display:flex;flex-direction:column;gap:6px;min-width:0}
.btns{display:flex;flex-wrap:wrap;gap:6px}
.btn{font:inherit;font-size:13.5px;border:1px solid var(--line2);background:var(--bg2);color:var(--ink);border-radius:7px;padding:5px 10px;cursor:pointer;min-height:32px}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn.ans[aria-pressed="true"].a-ok{background:var(--ok-bg);border-color:var(--ok);color:var(--ok)}
.btn.ans[aria-pressed="true"].a-changed{background:var(--diff-bg);border-color:var(--diff);color:var(--diff)}
.btn.ans[aria-pressed="true"].a-not-offered{background:var(--gone-bg);border-color:var(--gone);color:var(--gone)}
.btn.ans[aria-pressed="true"].a-cant-see{background:var(--cant-bg);border-color:var(--cant);color:var(--cant)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.btn.quiet{background:transparent}
.btn.link{border:0;background:none;color:var(--accent);padding:0 4px;min-height:0;text-decoration:underline;font-size:13px}
.state{display:flex;flex-wrap:wrap;gap:2px 10px;font-size:13px;color:var(--ink2)}
.state:empty{display:none}
.state .note{flex-basis:100%;color:var(--mute)}
.row.is-stale .state .said{color:var(--stale)}
.state .msg{color:var(--stale)}
.diff{display:flex;flex-direction:column;gap:8px;background:var(--bg3);border-radius:8px;padding:10px}
.nums{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.field{display:flex;flex-direction:column;gap:3px;min-width:0}
.field label{font-size:12.5px;color:var(--ink2)}
.field input,.field textarea{font:inherit;font-size:14px;border:1px solid var(--line2);border-radius:6px;padding:6px 8px;background:var(--bg2);color:var(--ink);min-width:0;width:100%;box-sizing:border-box}
.field textarea{resize:vertical}
.err{color:var(--stale);font-size:13px}
.actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.exnote summary{cursor:pointer;font-size:13.5px;color:var(--ink2)}
.exnote form{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.how{background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:16px 18px}
.how ol{margin:10px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:8px;color:var(--ink2);max-width:70ch}
.how b{color:var(--ink)}
code{font-family:var(--mono);font-size:.92em;background:var(--bg3);border-radius:4px;padding:0 4px}
@media (max-width:720px){
  .row{grid-template-columns:minmax(0,1fr)}
  .answer{grid-column:1;grid-row:auto}
  .meters{gap:8px}
  .meter{padding:9px 10px}
  .meter-n b{font-size:18px}
  .meter-l{font-size:12px}
  .ex-count{margin-left:0;flex-basis:100%}
}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
`

/** The whole page, as published. `data` comes from buildFeeCheckData (feeCheckData.ts). */
export function buildFeeCheckPage(data) {
  const core = inlineSource('feeCheck.core.js')
  const client = inlineSource('feeCheck.client.js')
  const t = data.table
  const feedNames = data.exchanges.filter((e) => e.feed).map((e) => e.name)
  const humanRows = data.exchanges.filter((e) => !e.feed).reduce((n, e) => n + e.rows.length, 0)
  const humanExchanges = data.exchanges.filter((e) => !e.feed).length
  return `<title>${esc(FEE_CHECK_TITLE)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${FEE_CHECK_CSS}</style>
<div class="wrap">
  <header>
    <p class="eyebrow">Finance Now · ${esc(data.serves.join(' and '))}</p>
    <h1>${esc(FEE_CHECK_TITLE)}</h1>
  </header>
  <p class="lede">The transfer-fee table was last fully checked on <b>${esc(longDate(t.lastVerified))}</b>, ${esc(String(t.ageDays))} days ago. Go through each exchange’s own fee page and say whether each row still matches. Your answers save here as you go, and Claude applies them to the table in a pull request. The Transfer Fees page stays hidden while this runs.</p>
  <p id="fc-conn" class="status" hidden></p>
  <div id="fc-progress" class="meters" aria-label="Progress"></div>
  <p id="fc-stale" class="status warn" hidden></p>
  <div class="controls">
    <div class="seg" role="group" aria-label="Which rows to show">
      <button type="button" id="fc-mode-core" aria-pressed="true">Start here · ${esc(String(data.coreCount))} rows</button>
      <button type="button" id="fc-mode-all" aria-pressed="false">Every exchange · ${esc(String(t.rows))} rows</button>
    </div>
    <label class="toggle" for="fc-hide"><input type="checkbox" id="fc-hide"> Hide rows I’ve answered</label>
  </div>
  <section id="fc-leads" class="leadbox" aria-labelledby="fc-leads-h">
    <h2 id="fc-leads-h">Known leads to look at first</h2>
  </section>
  <div id="fc-exchanges" class="exs"></div>
  <section class="how" aria-labelledby="fc-how-h">
    <h2 id="fc-how-h">How to answer</h2>
    <ol>
      <li><b>Work one exchange at a time.</b> Open its fee page once and go down its rows. Log in if the page only shows fees to signed-in users.</li>
      <li><b>Matches</b> means the page shows the same fee and minimum. <b>Different</b> means you type what it shows; leave a box empty if that figure has not changed. <b>Not offered</b> means the exchange no longer lets you withdraw that coin on that network. <b>Can’t see it</b> means the page hides it or you could not find it.</li>
      <li>Some fees move with network costs. If the table’s figure is inside the range you see, choose Matches and add a note with what you saw.</li>
      <li>Never choose Matches for a row you did not see. A row left blank is honest; a wrong Matches is not.</li>
      <li>Nothing changes in the app until Claude turns your answers into a pull request and you merge it. The table’s “last checked” date moves only when every row has an answer that settles it.</li>
      <li>${esc(String(humanRows))} rows on ${esc(String(humanExchanges))} exchanges need a person. The ${esc(String(feedNames.length))} exchanges that publish a fee feed (${esc(feedNames.join(', '))}) are last: <code>npm run fee-reconcile</code> on your computer checks most of their rows in one run.</li>
    </ol>
  </section>
  <p class="hint">Built ${esc(longDate(data.generatedOn))} from <code>transferFees.ts</code> by <code>npm run fee-check-page</code>. Trading fees were compiled ${esc(longDate(t.tradingCompiled))}.</p>
</div>
<script type="application/json" id="fc-data">${dataJson(data)}</script>
<script>
(function () {
${core}
;
${client}
})();
</script>
`
}
