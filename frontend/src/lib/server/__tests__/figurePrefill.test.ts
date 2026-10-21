import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FUND_CATALOG } from '@/lib/data/fundCatalog'
import { figuresFor, type FundFigure } from '../../../../scripts/lib/fundFiguresData'
import {
  answerFromResponse, buildFiguresPrompt, checkAnswer, dataLines, dayIn, figuresFormat, FIGURES_SYSTEM, MAX_PAGE_TEXT, pageTextOf, parseFiguresAnswer, parsePrefillArgs,
  pickPages, prefillFunds, PREFILL_MAX_DOLLARS, type FigureAnswer, type FiguresCore, type PrefillFund,
} from '../../../../scripts/lib/figurePrefill'

/**
 * The Fund Figures Check pre-fill (D140, step 2): software reads the fund pages on the sites
 * the owner ruled Allowed and suggests their figures. These hold what stands between an
 * agent's answer and the owner: only Allowed sites are read; the agent never sees the
 * catalog's figure; a figure is kept only when its quote is in the page text and holds it;
 * a date only when it is written in what was quoted; and the check page's own rules decide
 * whether the figure is one it would take. All invented pages; nothing reaches a network.
 */
const ROOT = process.cwd()
const core = new Function(`${readFileSync(join(ROOT, 'scripts/lib/fundFigures.core.js'), 'utf8')}\nreturn FundFiguresCore`)() as FiguresCore

const fund = (over: Partial<PrefillFund> = {}): PrefillFund => ({
  symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', issuer: 'State Street', type: 'etf', url: 'https://www.ssga.com/spy', site: 'ssga.com',
  shareClass: false, figures: [{ id: 'SPY:yield', symbol: 'SPY', figure: 'yield', catalog: 1.2345 }], ...over,
})
const yieldFig: FundFigure = { id: 'SPY:yield', symbol: 'SPY', figure: 'yield', catalog: 1.2 }
const assetsFig: FundFigure = { id: 'VOO:assets', symbol: 'VOO', figure: 'assets', catalog: 700 }

// Laid out as State Street's pages lay it out (2026-10-21): each label, its explanation, then its figure.
const ssgaText = 'Index Statistics as of Oct 20 2026 Yields as of Oct 19 2026 30 Day SEC Yield An annualized yield that is calculated by dividing the net investment income earned by the fund over the most recent 30-day period. 0.96% Fund Distribution Yield The sum of the distributions within the past 365 days divided by Net Asset Value per share, expressed as a percentage. 0.99% Index Dividend Yield The weighted average of the underlyings\' indicated annual dividend. 1.10% '.repeat(3)
const answer = (over: Partial<FigureAnswer> = {}): FigureAnswer => ({
  figure: 'yield', found: true, shown: '0.99%', label: 'Fund Distribution Yield', kind: 'trailing', asOf: '2026-10-19',
  quote: 'Fund Distribution Yield The sum of the distributions within the past 365 days divided by Net Asset Value per share, expressed as a percentage. 0.99%',
  dateQuote: 'Yields as of Oct 19 2026', others: '30 Day SEC Yield 0.96%', why: '', ...over,
})
const NOW = Date.UTC(2026, 9, 21)

describe('which pages', () => {
  const allowed = new Set(['vanguard.com', 'ssga.com', 'sectorspdrs.com', 'proshares.com'])
  const funds = prefillFunds(FUND_CATALOG, figuresFor, allowed)

  it('reads only funds on a site ruled Allowed, and only those with a figure to re-read', () => {
    expect(funds.length).toBeGreaterThan(0)
    for (const f of funds) {
      expect(allowed.has(f.site)).toBe(true)
      expect(f.figures.length).toBeGreaterThan(0)
    }
    expect(funds.some((f) => f.symbol === 'IVV')).toBe(false)
    expect(prefillFunds(FUND_CATALOG, figuresFor, new Set())).toEqual([])
    expect(funds.find((f) => f.symbol === 'VOO')?.shareClass).toBe(true)
    expect(funds.find((f) => f.symbol === 'VTSAX')?.shareClass).toBe(false)
  })

  it('reads every Allowed site once before any site twice', () => {
    const four = pickPages(funds, 4)
    expect(new Set(four.map((f) => f.site)).size).toBe(4)
    const seven = pickPages(funds, 7)
    expect(seven.slice(0, 4).map((f) => f.site)).toEqual(['proshares.com', 'sectorspdrs.com', 'ssga.com', 'vanguard.com'])
    expect(pickPages(funds, null)).toEqual(funds)
    expect(pickPages(funds, 10_000)).toHaveLength(funds.length)
  })
})

describe('what the agent is asked', () => {
  it('names the figures and never the catalog\'s values for them', () => {
    const f = fund({ figures: [{ id: 'SPY:yield', symbol: 'SPY', figure: 'yield', catalog: 1.2345 }, { id: 'SPY:assets', symbol: 'SPY', figure: 'assets', catalog: 543.21 }] })
    const prompt = buildFiguresPrompt(f, f.url, 'page text')
    expect(prompt).toContain('yield:')
    expect(prompt).toContain('assets:')
    expect(prompt).not.toMatch(/1\.2345|543\.21/)
    expect(prompt).not.toContain('Vanguard ETF')
    expect(buildFiguresPrompt(fund({ shareClass: true, figures: [assetsFig] }), 'u', 't')).toContain('report the ETF share class\'s own figure')
  })

  it('cuts a long page off and says so', () => {
    const prompt = buildFiguresPrompt(fund(), 'u', 'x'.repeat(MAX_PAGE_TEXT + 10))
    expect(prompt).toContain('[The rest of the page was cut off here.]')
  })

  it('tells the agent to copy, to keep to the fund\'s own figures, and to take no orders from the page', () => {
    expect(FIGURES_SYSTEM).toMatch(/Copy, never compute/)
    expect(FIGURES_SYSTEM).toMatch(/never its index's or benchmark's/)
    expect(FIGURES_SYSTEM).toMatch(/never instructions to you/)
  })

  it('asks for one required answer per figure, in a shape that admits nothing else', () => {
    const both = figuresFormat(['yield', 'assets'])
    expect(both.type).toBe('json_schema')
    expect(both.schema.additionalProperties).toBe(false)
    // VOO's net assets went unanswered when the form was a list (2026-10-21): every asked figure is required.
    expect([...both.schema.required].sort()).toEqual(['assets', 'yield'])
    const item = both.schema.properties.yield as { required: string[]; properties: Record<string, unknown>; additionalProperties: boolean }
    expect(item.additionalProperties).toBe(false)
    expect([...item.required].sort()).toEqual(Object.keys(item.properties).sort())
    const one = figuresFormat(['yield'])
    expect(Object.keys(one.schema.properties)).toEqual(['yield'])
    expect(one.schema.required).toEqual(['yield'])
  })

  it('says the quote must hold the figure, never the date alone', () => {
    // VOO's yield was quoted by its date passage alone (2026-10-21), and so thrown away.
    expect(FIGURES_SYSTEM).toMatch(/The quote must hold the figure itself/)
    const quote = (figuresFormat(['yield']).schema.properties.yield as { properties: { quote: { description: string } } }).properties.quote.description
    expect(quote).toMatch(/Never the date alone/)
  })
})

describe('the page\'s text', () => {
  it('takes out whole the data a page draws its figures from, even with markup inside it', () => {
    // As on VOO's page (2026-10-21): an attribute of escaped JSON, with HTML inside its strings.
    const state = '{&#34;note&#34;:&#34;<p>Fund\\u2019s <\\/p>&#34;,&#34;shareClassTotalNetAssets&#34;:&#34;$1.0 trillion&#34;,&#34;shareClassTotalNetAssetsDate&#34;:&#34;09/30/2026&#34;}'
    const html = `<script>var x = 1</script><div class="a" data-vgn-funds-profile="${state}">Total net assets</div><p data-n="7">Fees &amp; minimums</p>`
    const text = pageTextOf(html)
    expect(text).toContain('Total net assets Fees & minimums')
    expect(text).toContain('Data the page draws its figures from:\nnote: <p>Fund’s </p>\nshareClassTotalNetAssets: $1.0 trillion\nshareClassTotalNetAssetsDate: 09/30/2026')
    expect(text).not.toContain('var x')
    expect(pageTextOf('<p>No data here</p>')).toBe('No data here')
  })

  it('lays page data out one value a line, sorted, so a figure sits beside its date', () => {
    // As VOO's data was laid out (2026-10-21): the date first, other figures between, the figure last.
    const data = JSON.stringify({
      dashboard: { secYieldAsOfDate: '09/30/2026', '52WeekDiffPct': '23.28%', navPrice: '$706.55', ticker: 'VOO', secYield: '1.00%', yieldNote: [{ secDay: '30' }] },
      content: { firmAdvisor: `<p>${'Launched in 1975. '.repeat(20)}</p>` },
      empty: '', missing: null,
    })
    const lines = dataLines(data)!.split('\n')
    const at = lines.indexOf('dashboard.secYield: 1.00%')
    expect(at).toBeGreaterThan(-1)
    expect(lines[at + 1]).toBe('dashboard.secYieldAsOfDate: 09/30/2026')
    expect(lines).toContain('dashboard.yieldNote[0].secDay: 30')
    // Prose is never a figure, and an empty value is not a line.
    expect(lines.join('\n')).not.toContain('Launched in 1975')
    expect(lines.some((l) => l.startsWith('empty') || l.startsWith('missing'))).toBe(false)
    expect([...lines].sort()).toEqual(lines)
    expect(dataLines('{not json')).toBeNull()
    // A block that is not JSON still reaches the agent, as it was.
    const odd = `{ figures: secYield 1.00% ${'x'.repeat(60)} }`
    expect(pageTextOf(`<div data-x="${odd}"></div>`)).toContain(odd)
  })

  it('finds a day however the page writes it', () => {
    for (const p of ['Yields as of Oct 19 2026', 'as of 10/19/2026', 'October 19, 2026', '19 Oct 2026', 'as of 2026-10-19']) expect(dayIn(p, '2026-10-19'), p).toBe(true)
    expect(dayIn('as of 10/18/2026', '2026-10-19')).toBe(false)
    expect(dayIn('anything', 'not a day')).toBe(false)
  })
})

describe('checking an answer', () => {
  it('keeps a figure whose quote is on the page and holds it, with its date', () => {
    expect(checkAnswer(yieldFig, answer(), ssgaText, core, NOW)).toMatchObject({ status: 'suggested', value: 0.99, asOf: '2026-10-19', kind: 'trailing', why: '' })
  })

  it('throws away a figure whose quote is not on the page, or does not hold it', () => {
    expect(checkAnswer(yieldFig, answer({ shown: '1.05%', quote: 'Fund Distribution Yield 1.05%' }), ssgaText, core, NOW).status).toBe('not-checked')
    expect(checkAnswer(yieldFig, answer({ shown: '1.10%' }), ssgaText, core, NOW)).toMatchObject({ status: 'not-checked', why: expect.stringContaining('not in the passage') })
    expect(checkAnswer(yieldFig, answer({ quote: '' }), ssgaText, core, NOW).status).toBe('not-checked')
    expect(checkAnswer(yieldFig, answer({ kind: 'own' }), ssgaText, core, NOW).status).toBe('not-checked')
  })

  it('keeps the figure but drops a date not written in what was quoted', () => {
    const noDate = checkAnswer(yieldFig, answer({ dateQuote: '' }), ssgaText, core, NOW)
    expect(noDate).toMatchObject({ status: 'suggested', asOf: null })
    expect(noDate.why).toContain('read the date from the page')
    // A date quote that is not on the page proves nothing.
    expect(checkAnswer(yieldFig, answer({ dateQuote: 'Yields as of Oct 19 2026 (made up)' }), ssgaText, core, NOW).asOf).toBeNull()
    expect(checkAnswer(yieldFig, answer({ asOf: '' }), ssgaText, core, NOW)).toMatchObject({ status: 'suggested', asOf: null })
  })

  it('refuses what the check page itself would refuse', () => {
    const big = `${ssgaText} Fund Distribution Yield 45.00%`
    expect(checkAnswer(yieldFig, answer({ shown: '45.00%', quote: 'Fund Distribution Yield 45.00%' }), big, core, NOW).status).toBe('refused')
    // A bare net-asset figure could be billions or millions: never guessed.
    const page = `${ssgaText} Net Assets 45.1 as of 10/19/2026`
    expect(checkAnswer(assetsFig, answer({ figure: 'assets', kind: 'own', shown: '45.1', quote: 'Net Assets 45.1 as of 10/19/2026', dateQuote: '' }), page, core, NOW).status).toBe('refused')
    const ok = `${ssgaText} Net Assets $45,123.4 M as of 10/19/2026`
    expect(checkAnswer(assetsFig, answer({ figure: 'assets', kind: 'own', shown: '$45,123.4 M', quote: 'Net Assets $45,123.4 M as of 10/19/2026', dateQuote: '' }), ok, core, NOW)).toMatchObject({ status: 'suggested', asOf: '2026-10-19' })
  })

  it('throws away the yield of one payment, which is not a 12-month or SEC yield', () => {
    // VBTLX, VCSH and VTEB were each answered "trailing" from this line on the full run (2026-10-21).
    const lines = 'dashboard.secYield: 5.11%\ndashboard.secYieldAsOfDate: 10/19/2026\ndistributions.incomeCapitalGains[0].distributionYields: 4.27%\ndistributions.incomeCapitalGains[0].recordDate: 09/30/2026\n'.repeat(20)
    const one = answer({ shown: '4.27%', label: '', quote: 'distributions.incomeCapitalGains[0].distributionYields: 4.27%', asOf: '2026-09-30', dateQuote: 'distributions.incomeCapitalGains[0].recordDate: 09/30/2026' })
    expect(checkAnswer(yieldFig, one, lines, core, NOW)).toMatchObject({ status: 'not-checked', why: expect.stringContaining('one payment') })
    const sec = answer({ shown: '5.11%', kind: 'sec', label: '', quote: 'dashboard.secYield: 5.11%', asOf: '2026-10-19', dateQuote: 'dashboard.secYieldAsOfDate: 10/19/2026' })
    expect(checkAnswer(yieldFig, sec, lines, core, NOW)).toMatchObject({ status: 'suggested', value: 5.11, asOf: '2026-10-19' })
    // State Street's distribution yield is over 365 days and in prose, not a list entry: still kept.
    expect(checkAnswer(yieldFig, answer(), ssgaText, core, NOW).status).toBe('suggested')
    expect(buildFiguresPrompt(fund(), 'u', 't')).toContain('that payment\'s yield, not a 12-month one')
  })

  it('says why when there is nothing to suggest', () => {
    expect(checkAnswer(yieldFig, undefined, ssgaText, core, NOW).status).toBe('no-answer')
    expect(checkAnswer(yieldFig, answer({ found: false, why: 'Only the index\'s dividend yield is shown.' }), ssgaText, core, NOW)).toMatchObject({ status: 'not-found', why: 'Only the index\'s dividend yield is shown.' })
  })

  it('reads the answer strictly, each figure from the slot named for it', () => {
    const { figure: _, ...slot } = answer()
    expect(parseFiguresAnswer({ yield: slot })).toEqual({ ok: true, figures: [{ ...answer() }] })
    const both = parseFiguresAnswer({ assets: { ...slot, shown: '$1.0 trillion' }, yield: slot })
    expect(both.ok && both.figures.map((x) => [x.figure, x.shown])).toEqual([['yield', '0.99%'], ['assets', '$1.0 trillion']])
    // A figure with no slot is left out, so its check says the agent gave no answer.
    expect(parseFiguresAnswer({})).toEqual({ ok: true, figures: [] })
    const assetsOnly = parseFiguresAnswer({ assets: { ...slot, shown: '$1.0 trillion' } })
    expect(assetsOnly.ok && assetsOnly.figures.map((x) => x.figure)).toEqual(['assets'])
    expect(parseFiguresAnswer({ yield: { shown: '1%' } })).toMatchObject({ ok: false })
    expect(parseFiguresAnswer({ figures: [answer()] })).toEqual({ ok: true, figures: [] })
    expect(parseFiguresAnswer([answer()])).toMatchObject({ ok: false })
    expect(parseFiguresAnswer(null)).toMatchObject({ ok: false })
  })

  it('takes the answer from the response\'s text, and nothing from one cut off or declined', () => {
    const text = (t: string, stop = 'end_turn') => ({ stop_reason: stop, content: [{ type: 'text', text: t }] })
    const json = JSON.stringify({ yield: answer() })
    expect(answerFromResponse(text(json))).toMatchObject({ ok: true, figures: [{ figure: 'yield', shown: '0.99%' }] })
    // Split across text blocks, as a response may be: joined without anything between them.
    const half = Math.floor(json.length / 2)
    expect(answerFromResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: json.slice(0, half) }, { type: 'text', text: json.slice(half) }] })).toMatchObject({ ok: true })
    expect(answerFromResponse(text(json, 'refusal'))).toEqual({ ok: false, error: 'the model declined to answer' })
    expect(answerFromResponse(text(json.slice(0, 40), 'max_tokens'))).toEqual({ ok: false, error: 'the answer was cut off at its length limit' })
    expect(answerFromResponse(text('Here are the figures.'))).toEqual({ ok: false, error: 'the answer was not the JSON asked for' })
    expect(answerFromResponse({ stop_reason: 'end_turn', content: [{ type: 'thinking' }] })).toEqual({ ok: false, error: 'the model sent no answer' })
    expect(answerFromResponse(text('{"yield":{"shown":"1%"}}'))).toMatchObject({ ok: false })
  })
})

describe('the command line', () => {
  const models = ['claude-sonnet-5-5', 'claude-opus-5-5']
  it('spends nothing unless told to, and takes its options', () => {
    expect(parsePrefillArgs([], models, models[0])).toEqual({ run: false, limit: null, only: [], redo: false, maxDollars: PREFILL_MAX_DOLLARS, model: models[0], help: false })
    expect(parsePrefillArgs(['--run', '--limit', '4', '--only', 'voo, spy', '--redo', '--max-dollars', '2'], models, models[0]))
      .toEqual({ run: true, limit: 4, only: ['VOO', 'SPY'], redo: true, maxDollars: 2, model: models[0], help: false })
    for (const bad of [['--limit', '0'], ['--limit', '1.5'], ['--model', 'gpt-4o'], ['--only'], ['--spend']]) {
      expect(parsePrefillArgs(bad, models, models[0]), bad.join(' ')).toHaveProperty('error')
    }
  })
})

describe('the script', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'fund-figures-prefill.ts'), 'utf8')

  it('reads only what the owner ruled Allowed, and only where robots.txt lets FinanceNow', () => {
    expect(src).toContain('allowedSites(rulings, results.results as SiteResult[])')
    expect(src).toContain('prefillFunds(FUND_CATALOG, figuresFor, allowed)')
    expect(src).toMatch(/isPathAllowedByRobots\(parseRobotsTxt\(robots\.text\), `\$\{u\.pathname\}\$\{u\.search\}`\)/)
    expect(src).toContain("redirect: 'manual'")
    // Reading a page for its figures is consuming its data: the terms gate is never skipped.
    expect(src).not.toContain('skipTermsCheck')
  })

  it('hands the agent the page and never the catalog, and spends nothing without --run', () => {
    expect(src).toContain('buildFiguresPrompt(f, got.finalUrl ?? f.url, text)')
    expect(src).not.toMatch(/\bcatalog:\s/)
    expect(src.indexOf('if (!args.run)')).toBeLessThan(src.indexOf('new Anthropic('))
    expect(src).not.toMatch(/\btemperature\b/)
    // A forced tool is refused with a 400 by the newer models (the first trial, 2026-10-21).
    expect(src).not.toContain('tool_choice')
    expect(src).toContain("output_config: { effort: 'low', format: figuresFormat(f.figures.map((x) => x.figure)) }")
    expect(src).toContain('const parsed = answerFromResponse(res)')
    expect(src).not.toMatch(/\$\{\s*key\b/)
  })

  it('counts only a page that was read as done, so a refused or unreachable one is tried again', () => {
    expect(src).toContain("const done = (symbol: string) => pages.get(symbol)?.outcome === 'read'")
    expect(src).toContain('.filter((f) => args.redo || !done(f.symbol))')
  })

  it('writes only its own gitignored file, never the catalog or the check page', () => {
    expect(src.match(/writeFileSync\(/g)).toHaveLength(1)
    expect(src).toContain('writeFileSync(SUGGESTIONS,')
    expect(readFileSync(join(ROOT, '..', '.gitignore'), 'utf8')).toMatch(/^fund-figures-suggestions\.json$/m)
  })
})
