// The Staking Facts Check page (T-394): the owner's check list for re-reading the staking
// catalog's factual fields from each provider's own pages, published as a claude.ai
// artifact.
//
// The page is REGENERATED from stakingProviders.ts (npm run staking-facts-page), never
// hand-edited, so the owner's answers cannot live in its HTML. They live in the
// artifact's own runtime storage, which survives every republish:
//
//   db  checks/<provider:kind> or <provider:coin:terms>   one answer per row: result,
//                                                        values, note, compared, at, by
//   db  notes/<providerId>                               a free note about the provider
//   user                                                 who answered (ids only are stored)
//
// Publish it with STAKING_FACTS_CAPABILITIES. An answer changes nothing in the catalog:
// Claude reads the collections (ArtifactData list), runs npm run staking-facts-plan over
// them, and makes the changes by hand in a pull request.
//
// It shares the Transfer Fee Check's look (FEE_CHECK_CSS) and its safe data embed. The
// browser half is two files inlined into one wrapper: stakingFacts.core.js (every decision
// and every write, no DOM, run for real by the tests) and stakingFacts.client.js (drawing
// and wiring). Everything here is a pure string builder.
import fs from 'node:fs'
import { dataJson, FEE_CHECK_CSS } from './feeCheckPage.mjs'

/**
 * Pass as `capabilities` when publishing. The db rule raises writes to `admin` (Editor,
 * Owner): the answers are the owner's readings, and a viewer the page is shared with to
 * look at must not be able to change them. Reads stay at the default.
 */
export const STAKING_FACTS_CAPABILITIES = {
  db: { rules: [{ path: '', write: 'admin' }] },
  user: {},
}

export const STAKING_FACTS_TITLE = 'Staking Facts Check'

function inlineSource(name) {
  const src = fs.readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')
  if (/<\/script/i.test(src)) throw new Error(`${name} must not contain a closing script tag`)
  return src
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function longDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const STAKING_FACTS_CSS = `
.row{grid-template-columns:minmax(0,8rem) minmax(0,14rem) minmax(0,1fr)}
.row .tnote{grid-column:1/3}
.row .tnote.hint{color:var(--mute)}
.vals dd.url{font-size:12.5px;word-break:break-all}
@media (max-width:720px){.row .tnote{grid-column:1}}
.sugg{grid-column:1/3;font-size:13.5px;background:var(--accent-bg);border-radius:6px;padding:7px 10px;display:flex;flex-direction:column;gap:4px;min-width:0;overflow-wrap:anywhere}
.sugg.none{background:var(--bg3);color:var(--ink2)}
.sugg p{margin:0}
.sugg-l{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);margin-right:8px}
.sugg-why{color:var(--diff)}
.sugg details summary{cursor:pointer;color:var(--ink2);font-size:13px}
.sugg details p{margin-top:4px;color:var(--ink2)}
.sugg details p.mono{font-size:12.5px}
@media (max-width:720px){.sugg{grid-column:1}}
.seg button{white-space:nowrap}
@media (max-width:560px){.seg{display:flex;flex-wrap:wrap}.seg button{flex:1 1 auto;border-bottom:1px solid var(--line2);margin-bottom:-1px}}
`

/**
 * What raised the Start here rows, as the end of the opening's sentence: ": 24 that the
 * September 26 lock-up audit found …; and 2 that …". Empty when no source is listed.
 */
function leadSourcesText(sources) {
  const parts = (Array.isArray(sources) ? sources : []).filter((s) => s && s.rows > 0).map((s) => `${esc(String(s.rows))} that ${esc(s.by)} ${esc(s.found)}`)
  if (!parts.length) return ''
  return ': ' + (parts.length === 1 ? parts[0] : parts.slice(0, -1).join('; ') + '; and ' + parts[parts.length - 1])
}

/** The whole page, as published. `data` comes from buildStakingFactsData (stakingFactsData.ts). */
export function buildStakingFactsPage(data) {
  const core = inlineSource('stakingFacts.core.js')
  const client = inlineSource('stakingFacts.client.js')
  const c = data.catalog
  const n = data.counts
  const count = (cat) => data.providers.filter((p) => p.category === cat).length
  const leadCards = data.providers.filter((p) => p.rows.some((r) => r.lead)).length
  const sg = data.suggestions
  const suggestionsLine = sg
    ? `<p class="lede">${esc(String(sg.suggested))} figures carry a <b>suggestion</b>: what the pre-fill copied from the provider’s own pages on ${esc(longDate(sg.savedAt.slice(0, 10)))}, with the passage it came from. It is a hint, not an answer: check it on the page, then answer from what the page shows. ${esc(String(sg.none))} more say why there is none.</p>`
    : ''
  return `<title>${esc(STAKING_FACTS_TITLE)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${FEE_CHECK_CSS}${STAKING_FACTS_CSS}</style>
<div class="wrap">
  <header>
    <p class="eyebrow">Finance Now · ${esc(data.serves.join(' and '))}</p>
    <h1>${esc(STAKING_FACTS_TITLE)}</h1>
  </header>
  <p class="lede">The staking catalog was last fully checked on <b>${esc(longDate(c.lastVerified))}</b>, ${esc(String(c.ageDays))} days ago. Go through each provider’s own pages and say whether each fact still matches: its staking page, the year it was founded, its audits, its staking assets where no data service shows them, and the minimum stake and lock-up for every coin. That is <b>${esc(String(n.rows))} facts</b> on ${esc(String(n.providers))} providers; the ${esc(String(c.defunct))} defunct ones are left out. Your answers save here as you go, and Claude applies them to the catalog in a pull request.</p>
  <p class="lede"><b>Quick facts</b> shows only the ${esc(String(n.quick))} rows answered at a glance, each provider’s website and the year it was founded, so you can clear them in one sitting first. Liquid-staking protocols come first, because their documentation is public. Wallets follow, then exchanges, which often show their terms only after you sign in.${n.leads ? ` ${esc(String(n.leads))} ${n.leads === 1 ? 'row' : 'rows'} on ${esc(String(leadCards))} ${leadCards === 1 ? 'provider' : 'providers'} ${n.leads === 1 ? 'is' : 'are'} marked <b>Start here</b>${leadSourcesText(data.leadSources)}.` : ''}</p>
  ${suggestionsLine}
  <p id="sf-conn" class="status" hidden></p>
  <div id="sf-progress" class="meters" aria-label="Progress"></div>
  <p id="sf-stale" class="status warn" hidden></p>
  <div class="controls">
    <div class="seg" role="group" aria-label="Which providers to show">
      <button type="button" id="sf-group-all" aria-pressed="true">All · ${esc(String(n.providers))}</button>
      <button type="button" id="sf-group-quick" aria-pressed="false" title="Only each provider’s website and the year it was founded, so they can be cleared in one sitting">Quick facts · ${esc(String(n.quick))}</button>
${leadCards ? `      <button type="button" id="sf-group-start" aria-pressed="false">Start here · ${esc(String(leadCards))}</button>
` : ''}      <button type="button" id="sf-group-liquid" aria-pressed="false">Liquid · ${esc(String(count('liquid')))}</button>
      <button type="button" id="sf-group-wallet" aria-pressed="false">Wallets · ${esc(String(count('wallet')))}</button>
      <button type="button" id="sf-group-cefi" aria-pressed="false">Exchanges · ${esc(String(count('cefi')))}</button>
    </div>
    <label class="toggle" for="sf-hide"><input type="checkbox" id="sf-hide"> Hide providers I’ve finished</label>
  </div>
  <div id="sf-providers" class="exs"></div>
  <section class="how" aria-labelledby="sf-how-h">
    <h2 id="sf-how-h">How to answer</h2>
    <ol>
      <li><b>Work one provider at a time.</b> Open its staking page once and go down its rows. Its documentation or help pages often carry the minimums and lock-ups.</li>
      <li><b>Matches</b> means the page says the same. <b>Different</b> means you type what it says; leave a box empty if that figure has not changed. <b>Not offered</b> means the provider no longer stakes that coin. <b>Can’t see it</b> means the page hides it or you could not find it.</li>
      <li>A lock-up is the days before you can withdraw after you ask to; type 0 if you can leave at once. If the page gives a range, type the longest and put the range in the note.</li>
      <li>Never choose Matches for a fact you did not see. A blank is honest; a wrong Matches is not.</li>
      <li>Nothing changes in the app until Claude turns your answers into a pull request and you merge it. The catalog’s “last checked” date moves only when every fact has an answer that settles it.</li>
    </ol>
  </section>
  <p class="hint">Built ${esc(longDate(data.generatedOn))} from <code>stakingProviders.ts</code> by <code>npm run staking-facts-page</code>. The catalog’s notice says “may be out of date” after ${esc(String(c.staleAfterDays))} days; on September 20 you chose to let that notice show rather than rush this check.</p>
</div>
<script type="application/json" id="sf-data">${dataJson(data)}</script>
<script>
(function () {
${core}
;
${client}
})();
</script>
`
}
