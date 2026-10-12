import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { stripComments } from '../../../../scripts/lib/stripComments.mjs'
import { DATA_SOURCES, getSource, requiredAttributions, attributionText } from '../dataSources'
import { priceAlertMessage } from '@/hooks/usePriceAlertMonitor'
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
 *     folder down, where the drift check (scripts/gen-data-sources.ts --verify) does not look.
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

function ownerOf(route: string) {
  const own = new RegExp(`/live-data/${route.replace(/[-/]/g, (c) => `\\${c}`)}(?![a-z0-9/-])`)
  return DATA_SOURCES.find((e) => e.id === route || e.covers?.includes(route) || own.test(e.route ?? ''))
}

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

// The agent API answers scripts, agents and the MCP server, not a page, and today names no
// provider: /api/v1/prices says only `source: 'live'`. Whether CoinGecko's credit must travel
// in its JSON was put to the owner on 2026-10-12 (T-424) and is not decided here. Until it
// is, the set is pinned, so a new route serving CoinGecko data to callers is not added unseen.
describe('the agent API routes that reach CoinGecko are the known ones', () => {
  it('lists them', () => {
    const api = walk(path.join(APP, 'api'), 'route.ts')
      .filter((f) => closure(f).some(fetchesCoinGecko))
      .map((f) => rel(path.dirname(f)).replace(/^app\//, ''))
      .sort()
    expect(api).toEqual(['api/v1/network-fees', 'api/v1/prices', 'api/v1/transfer/routes'])
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
