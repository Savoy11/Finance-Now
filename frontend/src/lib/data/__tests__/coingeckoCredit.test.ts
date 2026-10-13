import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { stripComments } from '../../../../scripts/lib/stripComments.mjs'
import { getSource, requiredAttributions, attributionText, sourceForRoute, COINGECKO_ATTRIBUTION } from '../dataSources'
import { priceAlertMessage } from '@/hooks/usePriceAlertMonitor'
import { runToolWithCredits } from '@/lib/agents/tools'
import { GET as v1Prices } from '@/app/api/v1/prices/route'
import type { PriceAlert } from '@/store/usePriceAlertStore'

/**
 * T-424 (D91): "Powered by CoinGecko" appears wherever CoinGecko data does.
 *
 * CoinGecko's API Terms clause 4 prescribes the message and a size of at least 10
 * (attribution.test.ts holds the wording and the size). What nothing checked before this
 * file is the other half: that a surface showing CoinGecko data renders the credit at all.
 * Two gaps went unseen because of it, both found by the first run of this check:
 *
 *   · /live-data/pump-report/metrics fetched CoinGecko with no registry entry. It reaches
 *     CoinGecko through coingeckoBase(), so no URL appears in its source, and it sits one
 *     folder down, where the drift check (scripts/gen-data-sources.ts --verify) did not look
 *     until T-432 (2026-10-13). It reads nested folders now, but still only URL literals.
 *   · Shell surfaces outside every page carried no credit: the Live Prices and Market
 *     Overview pop-outs, and the price-alert toast, which shows a coin's price on any page.
 *
 * So this follows IMPORTS, not URLs. A route counts as CoinGecko-backed when anything it
 * imports fetches CoinGecko; a surface counts as showing CoinGecko data when anything it
 * imports reads such a route; and a surface passes when something it imports renders a
 * SourceLine whose source carries the credit, or calls attributionText() for one.
 *
 * What it cannot see, by construction: WHERE on a page the credit sits. A SourceLine inside
 * one tab passes this check while the other tabs show CoinGecko data bare. The rule, read by
 * hand when this was written (2026-10-12): every tabbed page that shows CoinGecko data keeps
 * its SourceLine above the tab bar (/assets, /assets/[id], /portfolios).
 */

const SRC = path.join(process.cwd(), 'src')
const APP = path.join(SRC, 'app')
const CREDIT = 'Powered by CoinGecko'
const rel = (f: string) => path.relative(SRC, f).split(path.sep).join('/')

// ── import graph ───────────────────────────────────────────────────────────────

const sources = new Map<string, string>()
function read(f: string): string {
  let s = sources.get(f)
  if (s === undefined) { s = stripComments(fs.readFileSync(f, 'utf8')) as string; sources.set(f, s) }
  return s
}

function resolve(from: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec)
  else return null // a package: outside this app's data paths
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
  }
  return null
}

/** Value imports and re-exports only: `import type` brings no code, so no fetch and no render. */
function importsOf(f: string): string[] {
  const s = read(f)
  const specs: string[] = []
  for (const m of s.matchAll(/\b(?:import|export)\s+(type\s+)?(?:[\w*{}\s,]+?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    if (!m[1]) specs.push(m[2])
  }
  for (const m of s.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.push(m[1])
  return specs.map((x) => resolve(f, x)).filter((x): x is string => x !== null)
}

function closure(entry: string): string[] {
  const seen = new Set([entry])
  const stack = [entry]
  while (stack.length) {
    for (const g of importsOf(stack.pop()!)) if (!seen.has(g)) { seen.add(g); stack.push(g) }
  }
  return [...seen]
}

function walk(dir: string, name: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== '__tests__') walk(p, name, out) }
    else if (e.name === name) out.push(p)
  }
  return out
}

// ── what counts as fetching, reading and crediting ─────────────────────────────

/** A module that calls CoinGecko: its URL written out, or the shared base helper called.
 *  The helper's own file defines the base and is not, by itself, a fetch. */
function fetchesCoinGecko(f: string): boolean {
  if (rel(f) === 'lib/api/live/coingecko.ts') return false
  const s = read(f)
  return /https?:\/\/(?:pro-)?api\.coingecko\.com/.test(s) || /\bcoingeckoBase\(/.test(s)
}

/** The registry names every route in its `route` field; those strings are labels, not reads. */
const LABELS_ONLY = new Set(['lib/data/dataSources.ts'])

/** /live-data routes a module reads, written either way the app writes them. */
function routesReadBy(f: string): string[] {
  if (LABELS_ONLY.has(rel(f))) return []
  const out: string[] = []
  for (const m of read(f).matchAll(/(?:\/live-data|\$\{LIVE_DATA_BASE\})\/([a-z0-9-]+(?:\/[a-z0-9-]+)*)/g)) out.push(m[1])
  return out
}

const carriesCredit = (id: string) => {
  const e = getSource(id)
  return !!e && requiredAttributions(e).some((a) => a.text === CREDIT)
}

/** The ids an expression can evaluate to: a lone literal, or the branches of a conditional.
 *  In `kind === 'crypto' ? 'coin-rating' : 'stock-rating'`, 'crypto' is compared, not passed. */
function idsOf(expr: string): string[] {
  return [...expr.matchAll(/(?:^|[?:])\s*['"]([a-z0-9-]+)['"]/g)].map((m) => m[1])
}

/** Every source id a module names to SourceLine or attributionText, conditional ids included. */
function creditIdsIn(f: string): string[] {
  const s = read(f)
  const ids: string[] = []
  for (const m of s.matchAll(/<SourceLine\b[^>]*?\bid=(?:"([a-z0-9-]+)"|\{([^}]*)\})/g)) {
    ids.push(...(m[1] ? [m[1]] : idsOf(m[2].trim())))
  }
  for (const m of s.matchAll(/\battributionText\(([^)]*)\)/g)) ids.push(...idsOf(m[1].trim()))
  return ids
}

// ── routes ─────────────────────────────────────────────────────────────────────

const routeFiles = walk(path.join(APP, 'live-data'), 'route.ts')
const routePath = (f: string) => rel(path.dirname(f)).replace(/^app\/live-data\//, '')

const cgRoutes = new Map<string, string[]>() // route path → the modules that fetch
for (const f of routeFiles) {
  const fetchers = closure(f).filter(fetchesCoinGecko).map(rel)
  if (fetchers.length) cgRoutes.set(routePath(f), fetchers)
}

/** CoinGecko-reaching routes that serve no CoinGecko data to show, each with why. */
const NOT_DATA: Record<string, string> = {
  config: 'Integrations health check: it pings CoinGecko’s /ping and returns up or down, no CoinGecko figure.',
}

/** The same lookup the agent tools use to find a route's credits (D101). */
const ownerOf = (route: string) => sourceForRoute(`/live-data/${route}`)

describe('sourceForRoute finds a route’s owner as fetched', () => {
  it('by id, by covers, and by the route string, ignoring the query', () => {
    expect(sourceForRoute('/live-data/markets?ids=bitcoin')?.id).toBe('markets')
    expect(sourceForRoute('/live-data/coin-search?query=sol')?.id).toBe('coin-list')
    expect(sourceForRoute('/live-data/pump-report/metrics')?.id).toBe('pump-report-metrics')
  })

  it('owns nothing outside /live-data, and no prefix of a longer route', () => {
    expect(sourceForRoute('/api/v1/prices')).toBeUndefined()
    expect(sourceForRoute('/live-data/pump-report')).toBeUndefined()
  })
})

describe('every route that fetches CoinGecko is registered with the credit', () => {
  it('finds the CoinGecko routes at all (a check that sees none proves nothing)', () => {
    expect(cgRoutes.has('markets')).toBe(true)
    expect(cgRoutes.has('pump-report/metrics'), 'nested routes and helper-built URLs are both seen').toBe(true)
  })

  it.each([...cgRoutes.keys()].filter((r) => !(r in NOT_DATA)))('%s', (route) => {
    const entry = ownerOf(route)
    expect(entry, `/live-data/${route} fetches CoinGecko (via ${cgRoutes.get(route)!.join(', ')}) and has no registry entry`).toBeDefined()
    expect(
      carriesCredit(entry!.id),
      `/live-data/${route} fetches CoinGecko, but its entry "${entry!.id}" does not name CoinGecko, so no SourceLine for it can show "${CREDIT}"`,
    ).toBe(true)
  })

  it('keeps each exemption live: an exempt route still reaches CoinGecko', () => {
    for (const r of Object.keys(NOT_DATA)) expect(cgRoutes.has(r), `${r} no longer reaches CoinGecko; drop its exemption`).toBe(true)
  })
})

// ── the agent API and the MCP server (D100) ────────────────────────────────────
//
// The agent API answers scripts, agents and the MCP server, not a page. The owner ruled on
// 2026-10-12 (D100, "Yes credit should be shown") that the credit travels with the data:
// each response serving CoinGecko figures carries `attributions`, and the MCP server hands
// them on with its answer.

// /api/v1 only: the agent routes (/api/agents/*) reach CoinGecko through the agent tools,
// and their answers are held to D101 below.
const apiRoutes = walk(path.join(APP, 'api', 'v1'), 'route.ts')
  .filter((f) => closure(f).some(fetchesCoinGecko))
  .map((f) => ({ file: f, path: rel(path.dirname(f)).replace(/^app\/api\/v1/, '') }))

describe('every agent API route serving CoinGecko data carries the credit (D100)', () => {
  it('finds them (a check that sees none proves nothing)', () => {
    expect(apiRoutes.map((r) => r.path)).toContain('/prices')
  })

  it.each(apiRoutes.map((r) => r.path))('%s puts `attributions` in its JSON', (p) => {
    const src = read(apiRoutes.find((r) => r.path === p)!.file)
    expect(src, `${p} serves CoinGecko data and sends no attributions`).toMatch(/\battributions:\s*(?:\[COINGECKO_ATTRIBUTION\]|requiredAttributions\()/)
  })

  describe('/api/v1/prices, run', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('answers with CoinGecko’s credit, verbatim', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ bitcoin: { usd: 101.5 } }), { status: 200 })))
      const res = await v1Prices(new NextRequest('http://localhost/api/v1/prices?coins=btc'))
      const body = await res.json()
      expect(body.prices.btc).toBe(101.5)
      expect(body.attributions).toEqual([COINGECKO_ATTRIBUTION])
    })
  })
})

describe('every MCP tool relaying CoinGecko data passes the credit on (D100)', () => {
  const mcp = stripComments(fs.readFileSync(path.join(process.cwd(), '..', 'mcp-server', 'src', 'index.ts'), 'utf8')) as string
  const tools = mcp.split(/\bserver\.tool\(/).slice(1)
  const readersOf = (p: string) =>
    tools.filter((t) => new RegExp(`get<[\\s\\S]*?>\\(\\s*[\`'"]${p.replace(/[/]/g, '\\/')}(?![a-z0-9/-])`).test(t))

  it('finds the tools and the readers (a check that sees none proves nothing)', () => {
    expect(tools.length).toBeGreaterThan(5)
    expect(readersOf('/prices').length, 'get_coin_prices should read /prices').toBe(1)
    expect(readersOf('/network-fees').length, 'get_network_fees should read /network-fees').toBe(1)
  })

  it.each(apiRoutes.map((r) => r.path))('a tool reading %s calls creditNote', (p) => {
    // A switched-off tool is commented out and stripped above, so it has no reader here.
    for (const t of readersOf(p)) {
      const name = t.match(/^\s*'([a-z_]+)'/)?.[1]
      expect(t, `MCP tool ${name} relays ${p} without its credit`).toMatch(/\bcreditNote\(data\)/)
    }
  })
})

// ── surfaces ───────────────────────────────────────────────────────────────────

/** Pages, and the parts each layout puts around them, which no page's SourceLine covers. */
const pages = walk(APP, 'page.tsx')
const shellParts = [...new Set(walk(APP, 'layout.tsx').flatMap(importsOf))]

/** Surfaces that read a CoinGecko route without showing a CoinGecko figure, each with why. */
const SHOWS_NO_FIGURE: Record<string, string> = {
  'components/layout/DataStatusBanner.tsx': 'Reads the markets response only to name the provider that served it ("prices via CoinGecko") and how long ago; it shows no price.',
}

function cgRoutesReadBy(unit: string): string[] {
  return [...new Set(closure(unit).flatMap(routesReadBy))].filter((r) => cgRoutes.has(r) && !(r in NOT_DATA))
}

describe('every surface showing CoinGecko data renders the credit', () => {
  const units = [...pages, ...shellParts].filter((u) => !(rel(u) in SHOWS_NO_FIGURE))

  it('finds surfaces that read CoinGecko routes (a check that sees none proves nothing)', () => {
    expect(units.filter((u) => cgRoutesReadBy(u).length > 0).length).toBeGreaterThan(10)
  })

  it.each(units.map(rel))('%s', (unitRel) => {
    const unit = path.join(SRC, unitRel)
    const reads = cgRoutesReadBy(unit)
    if (reads.length === 0) return
    const credited = closure(unit).flatMap(creditIdsIn).filter(carriesCredit)
    expect(
      credited.length,
      `${unitRel} reads ${reads.map((r) => `/live-data/${r}`).join(', ')} (CoinGecko data) and renders no "${CREDIT}": `
        + 'add a SourceLine whose source names CoinGecko, or attributionText() where no component can render',
    ).toBeGreaterThan(0)
  })

  it('keeps each exemption live: an exempt surface still reads a CoinGecko route', () => {
    for (const f of Object.keys(SHOWS_NO_FIGURE)) {
      expect(cgRoutesReadBy(path.join(SRC, f)).length, `${f} no longer reads CoinGecko; drop its exemption`).toBeGreaterThan(0)
    }
  })
})

// ── AI answers (D101) ──────────────────────────────────────────────────────────
//
// The owner ruled on 2026-10-12 (D101, "Still show credit") that an AI answer quoting
// CoinGecko figures shows the credit too. The agent tools gather it from every response
// they read (runToolWithCredits), the runner returns it with the answer, the agent routes
// send it, and every surface showing an answer renders it under the answer.

describe('agent tools gather the credits their data requires (D101)', () => {
  afterEach(() => vi.unstubAllGlobals())

  const respond = (bodies: Record<string, unknown>) =>
    vi.fn(async (url: string) => {
      const key = Object.keys(bodies).find((k) => url.includes(k))
      return new Response(JSON.stringify(key ? bodies[key] : {}), { status: 200 })
    })

  it('takes the agent API’s own attributions', async () => {
    vi.stubGlobal('fetch', respond({ '/api/v1/prices': { prices: { btc: 1 }, attributions: [COINGECKO_ATTRIBUTION] } }))
    const out = await runToolWithCredits('get_prices', { coins: ['btc'] }, 'http://x')
    expect(out.credits.map((c) => c.text)).toEqual([CREDIT])
  })

  it('reads a /live-data route’s from the registry, as its SourceLine does', async () => {
    vi.stubGlobal('fetch', respond({ '/live-data/markets': { ok: true, quotes: {} } }))
    const out = await runToolWithCredits('get_market_overview', {}, 'http://x')
    expect(out.credits).toEqual(requiredAttributions(getSource('markets')!))
    expect(out.credits.map((c) => c.text)).toContain(CREDIT)
  })

  it('adds none for a source whose licence asks for none', async () => {
    vi.stubGlobal('fetch', respond({ '/live-data/security-quotes': { quotes: {} } }))
    const out = await runToolWithCredits('get_stock_quote', { symbols: 'AAPL' }, 'http://x')
    expect(out.credits).toEqual([])
  })

  it('adds none when the route reported failure and supplied no data', async () => {
    vi.stubGlobal('fetch', respond({ '/live-data/markets': { ok: false, error: 'upstream down' } }))
    const out = await runToolWithCredits('get_market_overview', {}, 'http://x')
    expect(out.credits).toEqual([])
  })
})

describe('the agent routes send the credits with the answer (D101)', () => {
  it.each(['research', 'chat'])('/api/agents/%s', (r) => {
    expect(read(path.join(APP, 'api', 'agents', r, 'route.ts'))).toMatch(/\bcredits:\s*result\.credits\b/)
  })
})

describe('every surface showing an AI answer renders its credits (D101)', () => {
  const callsAgents = (unit: string) =>
    closure(unit).some((f) => !LABELS_ONLY.has(rel(f)) && /['"`]\/api\/agents\/(?:research|chat)['"`]/.test(read(f)))
  const units = [...pages, ...shellParts].filter(callsAgents)

  it('finds them (a check that sees none proves nothing)', () => {
    const names = units.map(rel)
    for (const u of ['app/(dashboard)/brief/page.tsx', 'app/(dashboard)/research/page.tsx', 'components/agents/AssistantWidget.tsx']) {
      expect(names).toContain(u)
    }
  })

  it.each(units.map(rel))('%s', (unitRel) => {
    // SourceLine renders RequiredCredits for a page's own source; that is not the answer's.
    const rendered = closure(path.join(SRC, unitRel))
      .some((f) => rel(f) !== 'components/ui/SourceLine.tsx' && /<RequiredCredits\s+credits=\{/.test(read(f)))
    expect(rendered, `${unitRel} shows an AI answer and renders no <RequiredCredits credits={…}>`).toBe(true)
  })
})

describe('the credit ids the app names all resolve', () => {
  // SourceLine renders nothing in production for an unknown id and attributionText returns
  // '', so one mistyped id removes a credit with no error anywhere. Read from the code, not
  // listed by hand, so a new call site is covered the day it is written.
  const files: string[] = []
  const gather = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { if (e.name !== '__tests__') gather(p) }
      else if (/\.tsx?$/.test(e.name)) files.push(p)
    }
  }
  gather(SRC)

  it('finds call sites (a check that sees none proves nothing)', () => {
    expect(files.flatMap(creditIdsIn).length).toBeGreaterThan(30)
  })

  it.each(files.filter((f) => creditIdsIn(f).length > 0).map(rel))('%s', (f) => {
    for (const id of creditIdsIn(path.join(SRC, f))) {
      expect(getSource(id), `${f} names source id "${id}", which the registry does not have`).toBeDefined()
    }
  })
})

// ── the three surfaces credited by T-424 ───────────────────────────────────────

describe('the price-alert message carries the credit of the source that priced it', () => {
  const alert = (kind: PriceAlert['kind']): PriceAlert => ({
    id: 'a', kind, target: kind === 'crypto' ? 'bitcoin' : 'AAPL', label: kind === 'crypto' ? 'BTC' : 'AAPL',
    condition: 'above', price: 100, createdAt: '2026-10-12T00:00:00Z', triggeredAt: null, triggeredPrice: null,
  } as PriceAlert)

  it('ends a coin alert with CoinGecko’s credit, verbatim', () => {
    const msg = priceAlertMessage(alert('crypto'), 101.5)
    expect(msg.startsWith('BTC rose above $100 (now $101.5)')).toBe(true)
    expect(msg.endsWith(`· ${CREDIT}`)).toBe(true)
  })

  it('adds to a stock alert only what its own source requires', () => {
    expect(priceAlertMessage(alert('security'), 101.5)).toBe(
      ['AAPL rose above $100 (now $101.5)', attributionText('security-quotes')].filter(Boolean).join(' · '),
    )
  })
})

describe('the pump signal says it is our computation from CoinGecko', () => {
  it('registers the route as derived, naming CoinGecko', () => {
    const e = getSource('pump-report-metrics')!
    expect(e.status).toBe('derived')
    expect(carriesCredit(e.id)).toBe(true)
  })

  it('renders that source under the signal block', () => {
    expect(creditIdsIn(path.join(SRC, 'components/pump-report/PumpReportTab.tsx'))).toContain('pump-report-metrics')
  })
})
