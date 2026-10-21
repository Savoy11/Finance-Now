/**
 * The pre-fill's suggestions as one page to read beside the Fund Figures Check (D140 step 2).
 *
 * fund-figures-prefill writes fund-figures-suggestions.json: per fund page, each figure the
 * model copied out, the passage it was copied from, and why any figure was not suggested.
 * That file is for scripts. This page is for the owner, who compares each suggestion with
 * the fund's own page and types the reading into the check page. Nothing here is a reading,
 * and the page says so: it changes nothing and stores nothing.
 *
 * Pure: the suggestions, the catalog's figures and the kind labels are parameters, so the
 * tests run it against fixtures. scripts/fund-figures-review.ts passes the real ones.
 */

export const SUGGESTIONS_FORMAT = 'fund-figures-suggestions-v1'
export const REVIEW_TITLE = 'Fund Figures Suggestions'

export interface ReviewSuggestion {
  id: string
  figure: 'yield' | 'assets'
  status: string
  shown: string
  value: number | null
  asOf: string | null
  kind: string | null
  label: string
  quote: string
  dateQuote: string
  others: string
  why: string
}

export interface ReviewPage {
  symbol: string
  url: string
  finalUrl: string | null
  readAt: string
  outcome: string
  why: string
  figures: ReviewSuggestion[]
}

export interface ReviewFund {
  name: string
  issuer: string
  /** The catalog's figures now, keyed `<SYMBOL>:yield` / `<SYMBOL>:assets`: percent, or billions. */
  catalog: Record<string, number>
}

export interface ReviewInput {
  savedAt: string
  pages: ReviewPage[]
  funds: ReadonlyMap<string, ReviewFund>
  kindLabel: (figure: string, kind: string) => string
}

/** Reads the suggestions file, refusing one this pipeline did not write. */
export function parseSuggestions(json: unknown): { savedAt: string; pages: ReviewPage[] } {
  const o = json as { format?: unknown; savedAt?: unknown; pages?: unknown }
  if (!o || typeof o !== 'object' || o.format !== SUGGESTIONS_FORMAT) {
    throw new Error(`not a suggestions file from npm run fund-figures-prefill (format ${String(o && (o as { format?: unknown }).format)})`)
  }
  if (!Array.isArray(o.pages)) throw new Error('suggestions file: expected a list of pages')
  return { savedAt: typeof o.savedAt === 'string' ? o.savedAt : '', pages: o.pages as ReviewPage[] }
}

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A link only for a web address: anything else is printed, never made clickable. */
function link(url: string | null | undefined, text: string): string {
  return url && /^https?:\/\//i.test(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text)
}

const FIGURE_NAMES: Record<string, string> = { yield: 'Yield', assets: 'Net assets' }

function catalogText(figure: string, v: number | undefined): string {
  if (v === undefined) return '—'
  return figure === 'yield' ? `${v}%` : `$${v} billion`
}

function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

export interface ReviewCounts { pages: number; read: number; suggested: number; byHand: number }

export function reviewCounts(pages: readonly ReviewPage[]): ReviewCounts {
  let suggested = 0, byHand = 0, read = 0
  for (const p of pages) {
    if (p.outcome === 'read') read++
    for (const f of p.figures ?? []) (f.status === 'suggested' ? suggested++ : byHand++)
  }
  return { pages: pages.length, read, suggested, byHand }
}

const CSS = `
:root{--bg:#fbfaf7;--card:#fff;--ink:#1d1d1b;--ink2:#4a4a46;--mute:#77776f;--line:#e4e2db;--accent:#1f5fae;--warn:#9a5b00;--warnbg:#fff6e5;--mono:ui-monospace,Consolas,monospace;--serif:Georgia,serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#161615;--card:#1f1f1d;--ink:#ecebe6;--ink2:#c4c3bc;--mute:#94938b;--line:#34332f;--accent:#7fb0f0;--warn:#f0b45a;--warnbg:#2c2414}}
:root[data-theme="dark"]{--bg:#161615;--card:#1f1f1d;--ink:#ecebe6;--ink2:#c4c3bc;--mute:#94938b;--line:#34332f;--accent:#7fb0f0;--warn:#f0b45a;--warnbg:#2c2414}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:920px;margin:0 auto;padding:24px 16px 64px}
h1{font-family:var(--serif);font-weight:normal;font-size:28px;margin:0 0 6px}
h2{font-family:var(--serif);font-weight:normal;font-size:21px;margin:36px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
p.lede{color:var(--ink2);margin:6px 0}
.notice{background:var(--warnbg);color:var(--ink);border-left:3px solid var(--warn);padding:10px 12px;border-radius:4px;margin:14px 0}
.fund{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px 16px;margin:12px 0}
.fund h3{margin:0;font-size:17px}
.fund h3 .sym{font-family:var(--mono)}
.fund .name{color:var(--ink2);font-weight:normal}
.fund .site{font-size:13px;color:var(--mute);margin:2px 0 8px}
a{color:var(--accent);overflow-wrap:anywhere}
.fig{border-top:1px solid var(--line);padding:10px 0 4px}
.fig:first-of-type{border-top:0}
.fig .head{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline}
.fig .what{font-weight:600;min-width:6.5rem}
.fig .val{font-family:var(--mono);font-size:16px}
.fig .meta{color:var(--ink2);font-size:14px}
dl{display:grid;grid-template-columns:minmax(0,9rem) minmax(0,1fr);gap:3px 12px;margin:6px 0 0;font-size:14px}
dt{color:var(--mute)}
dd{margin:0;overflow-wrap:anywhere}
dd.q{font-family:var(--mono);font-size:13px}
.why{color:var(--warn);font-size:14px;margin:4px 0 0}
@media (max-width:560px){dl{grid-template-columns:1fr}dt{margin-top:4px}}
`

function figureBlock(f: ReviewSuggestion, fund: ReviewFund | undefined, kindLabel: ReviewInput['kindLabel']): string {
  const name = FIGURE_NAMES[f.figure] ?? f.figure
  const catalog = catalogText(f.figure, fund?.catalog[f.id])
  if (f.status !== 'suggested') {
    return `<div class="fig"><div class="head"><span class="what">${esc(name)}</span><span class="meta">No suggestion. Catalog now: ${esc(catalog)}</span></div>`
      + `<p class="why">${esc(f.why || 'No reason was recorded.')}</p>`
      + (f.quote ? `<dl><dt>Passage it gave</dt><dd class="q">${esc(f.quote)}</dd></dl>` : '')
      + `</div>`
  }
  const rows = [
    ['Kind', f.kind ? kindLabel(f.figure, f.kind) : '—'],
    ['As of', f.asOf ?? 'No date found beside it: read the date from the page'],
    ['Catalog now', catalog],
  ].map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
  rows.push(`<dt>Copied from</dt><dd class="q">${esc(f.quote)}</dd>`)
  if (f.dateQuote) rows.push(`<dt>Date from</dt><dd class="q">${esc(f.dateQuote)}</dd>`)
  if (f.others) rows.push(`<dt>Also on the page</dt><dd>${esc(f.others)}</dd>`)
  return `<div class="fig"><div class="head"><span class="what">${esc(name)}</span><span class="val">${esc(f.shown)}</span></div>`
    + `<dl>${rows.join('')}</dl>`
    + (f.why ? `<p class="why">${esc(f.why)}</p>` : '')
    + `</div>`
}

function fundCard(p: ReviewPage, fund: ReviewFund | undefined, figures: ReviewSuggestion[], input: ReviewInput): string {
  const url = p.finalUrl || p.url
  const title = `<h3><span class="sym">${esc(p.symbol)}</span> <span class="name">${esc(fund?.name ?? '')}</span></h3>`
  const site = `<p class="site">${link(url, `Open ${fund?.issuer ?? host(url)}’s page`)}</p>`
  const body = p.outcome === 'read'
    ? figures.map((f) => figureBlock(f, fund, input.kindLabel)).join('')
    : `<p class="why">The page was not read (${esc(p.outcome)}). ${esc(p.why)}</p>`
  return `<section class="fund" id="${esc(p.symbol)}">${title}${site}${body}</section>`
}

/** The whole page. Funds are grouped by site, then by symbol, so one sitting covers one site. */
export function buildReviewPage(input: ReviewInput): string {
  const pages = [...input.pages].sort((a, b) => host(a.url).localeCompare(host(b.url)) || a.symbol.localeCompare(b.symbol))
  const n = reviewCounts(pages)
  const toCompare = pages.filter((p) => p.outcome === 'read' && p.figures.some((f) => f.status === 'suggested'))
  const byHand = pages.filter((p) => p.outcome !== 'read' || p.figures.some((f) => f.status !== 'suggested'))
  const fund = (p: ReviewPage) => input.funds.get(p.symbol)

  const compareCards = toCompare.map((p) => fundCard(p, fund(p), p.figures.filter((f) => f.status === 'suggested'), input)).join('\n')
  const handCards = byHand.map((p) => fundCard(p, fund(p), p.figures.filter((f) => f.status !== 'suggested'), input)).join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(REVIEW_TITLE)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>${esc(REVIEW_TITLE)}</h1>
<p class="lede">What the pre-fill copied from the fund pages on the sites you ruled Allowed, saved ${esc(input.savedAt.slice(0, 10))}. ${n.read} of ${n.pages} pages read; ${n.suggested} figures suggested; ${n.byHand} to read by hand.</p>
<div class="notice">These are suggestions, not readings. Open each fund’s page, check the figure, its date and its kind there, and type what the page shows into the Fund Figures Check. Nothing on this page changes the catalog or the check page.</div>
<h2>To compare (${toCompare.length} funds)</h2>
${compareCards || '<p class="lede">None.</p>'}
<h2>To read by hand (${byHand.length} funds)</h2>
<p class="lede">No figure was suggested for these, and the reason is beside each one.</p>
${handCards || '<p class="lede">None.</p>'}
</main>
</body>
</html>
`
}
