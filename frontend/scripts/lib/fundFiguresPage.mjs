// The Fund Figures Check page (T-440): the owner's check list for re-reading the fund
// catalog's approximate figures, every yield and every asset figure no SEC filing dates,
// published as a claude.ai artifact.
//
// The page is REGENERATED from fundCatalog.ts (npm run fund-figures-page), never
// hand-edited, so the owner's readings cannot live in its HTML. They live in the
// artifact's own runtime storage, which survives every republish:
//
//   db  readings/<SYMBOL:yield|assets>  one reading per figure: result, value, typed, asOf,
//                                       kind, note, compared, at, by
//   db  notes/<SYMBOL>                  a free note about the fund's page (link moved…)
//   user                                who read it (ids only are stored)
//
// Publish it with FUND_FIGURES_CAPABILITIES. A reading changes nothing in the catalog:
// Claude reads the collections (ArtifactData list), runs npm run fund-figures-plan over
// them, and brings the differences to the owner before any pull request.
//
// It shares the Transfer Fee Check page's look (FEE_CHECK_CSS) and its safe data embed.
// The browser half is two files inlined into one wrapper: fundFigures.core.js (every
// decision and every write, no DOM, run for real by the tests) and fundFigures.client.js
// (drawing and wiring). Everything here is a pure string builder.
import fs from 'node:fs'
import { dataJson, FEE_CHECK_CSS } from './feeCheckPage.mjs'

/**
 * Pass as `capabilities` when publishing. The db rule raises writes to `admin` (Editor,
 * Owner): the readings are the owner's, and a viewer the page is shared with to look at
 * must not be able to change them. Reads stay at the default.
 */
export const FUND_FIGURES_CAPABILITIES = {
  db: { rules: [{ path: '', write: 'admin' }] },
  user: {},
}

export const FUND_FIGURES_TITLE = 'Fund Figures Check'

function inlineSource(name) {
  const src = fs.readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')
  if (/<\/script/i.test(src)) throw new Error(`${name} must not contain a closing script tag`)
  return src
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The first day the catalog's notice calls the figures out of date: past the window. */
export function staleFrom(compiledOn, staleAfterDays) {
  const d = new Date(`${compiledOn}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + staleAfterDays + 1)
  return d.toISOString().slice(0, 10)
}

function longDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const FUND_FIGURES_CSS = `
.ex-name{font-family:var(--mono)}
.fund-name{font-family:var(--serif);font-size:16px;color:var(--ink2)}
p.tier{margin-top:-6px}
.row{grid-template-columns:minmax(0,7rem) minmax(0,10rem) minmax(0,1fr)}
.row .tnote{grid-column:1/3;color:var(--mute)}
.diff>.btn.link{align-self:flex-start}
.sugg{grid-column:1/3;font-size:13.5px;background:var(--accent-bg);border-radius:6px;padding:7px 10px;display:flex;flex-direction:column;gap:4px;min-width:0;overflow-wrap:anywhere}
.sugg.none{background:var(--bg3);color:var(--ink2)}
.sugg p{margin:0}
.sugg-l{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);margin-right:8px}
.sugg-why{color:var(--diff)}
.sugg details summary{cursor:pointer;color:var(--ink2);font-size:13px}
.sugg details p{margin-top:4px;color:var(--ink2)}
.sugg details p.mono{font-size:12.5px}
@media (max-width:720px){.sugg{grid-column:1}}
.field select{font:inherit;font-size:14px;border:1px solid var(--line2);border-radius:6px;padding:6px 8px;background:var(--bg2);color:var(--ink);min-width:0;width:100%;box-sizing:border-box}
@media (max-width:720px){.row .tnote{grid-column:1}}
`

/** The whole page, as published. `data` comes from buildFundFiguresData (fundFiguresData.ts). */
export function buildFundFiguresPage(data) {
  const core = inlineSource('fundFigures.core.js')
  const client = inlineSource('fundFigures.client.js')
  const c = data.catalog
  const n = data.counts
  const figures = n.yields + n.assets
  const order = data.order
  const orderLine = order.basis
    ? `The first ${esc(String(order.ranked))} funds are ordered by a check against an outside figure: ${esc(order.basis)} The ${esc(String(order.startHere))} where it differs are marked <b>Start here</b>. The page shows no outside figure: you read the issuer’s own. The other funds follow, grouped by issuer, so one sitting covers one site.`
    : 'The funds are grouped by issuer, so one sitting covers one site.'
  const sg = data.suggestions
  // The day the pages were read, never the day the file was last saved: a later save (a
  // re-read of one site, a hand note) moves savedAt without anyone reading the other pages.
  const readOn = sg && sg.readFrom
    ? (sg.readFrom === sg.readTo ? `on ${longDate(sg.readFrom)}` : `between ${longDate(sg.readFrom)} and ${longDate(sg.readTo)}`)
    : sg ? `in the file saved ${longDate(sg.savedAt.slice(0, 10))}` : ''
  const suggestionsLine = sg
    ? `<p class="lede">${esc(String(sg.suggested))} figures carry a <b>suggestion</b>: the figure the pre-fill copied from the fund’s own page ${esc(readOn)}, with the passage it came from. It is a hint, not a reading: check it on the page, then type what the page shows. ${esc(String(sg.none))} more say why there is none.</p>`
    : ''
  const pk = data.parked
  const parkedLine = pk
    ? `<p class="callout warn" id="ff-parked"><b>Parked until before launch</b> (${esc(longDate(pk.on))}, ${esc(pk.decision)}). ${esc(pk.why)}</p>`
    : ''
  const startButton = order.startHere
    ? `<button type="button" id="ff-mode-start" aria-pressed="true">Start here · ${esc(String(order.startHere))} funds</button>\n      `
    : ''
  return `<title>${esc(FUND_FIGURES_TITLE)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${FEE_CHECK_CSS}${FUND_FIGURES_CSS}</style>
<div class="wrap">
  <header>
    <p class="eyebrow">Finance Now · ${esc(data.serves.join(' and '))}</p>
    <h1>${esc(FUND_FIGURES_TITLE)}</h1>
  </header>
  ${parkedLine}
  <p class="lede">The fund catalog’s yields, and the asset figures no SEC filing dates, were compiled by hand; the oldest on <b>${esc(longDate(c.compiledOn))}</b>, ${esc(String(c.ageDays))} days ago. Read each one from the fund’s own page, with the date the page gives. That is <b>${esc(String(n.yields))} yields</b> and <b>${esc(String(n.assets))} asset figures</b> on ${esc(String(n.funds))} of the catalog’s ${esc(String(c.funds))} funds. Your readings save here as you go, and Claude brings every difference to you before anything changes.</p>
  <p class="lede">${orderLine}</p>
  ${suggestionsLine}
  <p id="ff-conn" class="status" hidden></p>
  <div id="ff-progress" class="meters" aria-label="Progress"></div>
  <p id="ff-stale" class="status warn" hidden></p>
  <div class="controls">
    <div class="seg" role="group" aria-label="Which funds to show">
      ${startButton}<button type="button" id="ff-mode-all" aria-pressed="${order.startHere ? 'false' : 'true'}">Every fund · ${esc(String(n.funds))} funds</button>
    </div>
    <label class="toggle" for="ff-hide"><input type="checkbox" id="ff-hide"> Hide funds I’ve finished</label>
  </div>
  <div id="ff-funds" class="exs"></div>
  <section class="how" aria-labelledby="ff-how-h">
    <h2 id="ff-how-h">How to answer</h2>
    <ol>
      <li><b>Work one fund at a time.</b> Open its page from the card and find the figure. It may be on another tab of the page, or only in the fund’s fact sheet.</li>
      <li><b>I read it</b> means you type the figure the page shows and the date it gives (“as of …”). Type net assets the way the page shows them, unit and all, like <code>$45.1B</code> or <code>45,123 million</code>.</li>
      <li><b>Say which figure it is.</b> The catalog holds a 12-month trailing distribution yield and the fund’s own net assets. If the page shows only a 30-day SEC yield, or only the whole fund’s assets, record what it shows and choose that kind: Claude will ask you before using it.</li>
      <li><b>Can’t find it</b> means the page does not show that figure, or you could not find it. A blank is honest; a figure you did not see is not.</li>
      <li>Nothing changes in the app until Claude shows you the differences and you merge the pull request. The catalog’s compiled date moves only when all ${esc(String(figures))} figures have a dated reading.</li>
    </ol>
  </section>
  <p class="hint">Built ${esc(longDate(data.generatedOn))} from <code>fundCatalog.ts</code> by <code>npm run fund-figures-page</code>. From ${esc(longDate(staleFrom(c.compiledOn, c.staleAfterDays)))} the fund pages say these figures may be out of date, as the owner chose to let happen (D120).</p>
</div>
<script type="application/json" id="ff-data">${dataJson(data)}</script>
<script>
(function () {
${core}
;
${client}
})();
</script>
`
}
