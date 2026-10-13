// The registry ↔ code drift check behind `npm run data-sources -- --verify`, as pure
// functions so the walk can be tested (src/lib/server/__tests__/dataSourcesDrift.test.ts).
//
// Why it moved out of gen-data-sources.ts (T-432, 2026-10-13). The check read only
// `live-data/<id>/route.ts`, one folder deep. Ten routes sit a folder further down, among
// them the five /live-data/wallet/* routes, which fetch twenty hosts: thirteen had no
// source-terms entry and nothing ever said so. sourceTerms.test.ts can only check a host
// the data-source registry names, and this check is what makes the registry name it, so a
// folder it never opened was a folder neither guard could see. coingeckoCredit.test.ts had
// already met the same blind spot (pump-report/metrics) and worked around it.
//
// Two smaller fixes rode along: a host is compared without its port (the XRP route calls
// s1.ripple.com:51234), and comments are stripped before scanning, as they already were.

import fs from 'node:fs'
import path from 'node:path'
import { stripComments } from './stripComments.mjs'

/**
 * Every route under `liveDataDir`, nested ones included, as its folder path with forward
 * slashes: `markets`, `wallet/btc`, `pump-report/metrics`.
 *
 * @param {string} liveDataDir
 * @returns {string[]}
 */
export function listRoutes(liveDataDir) {
  const out = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue
      const sub = path.join(dir, e.name)
      if (fs.existsSync(path.join(sub, 'route.ts'))) out.push(path.relative(liveDataDir, sub).split(path.sep).join('/'))
      walk(sub)
    }
  }
  walk(liveDataDir)
  return out.sort()
}

/**
 * Hostnames written as URL literals in a route's code, ports dropped, comments ignored.
 * Template-literal hosts (`https://${host}/…`) are skipped: they are not a fixed host.
 *
 * @param {string} src
 * @returns {Set<string>}
 */
export function hostsInSource(src) {
  const hosts = new Set()
  for (const m of stripComments(src).matchAll(/https?:\/\/[^'"`\s)]+/g)) {
    try {
      const url = new URL(m[0])
      if (url.host.includes('$') || url.host.includes('{')) continue
      hosts.add(url.hostname)
    } catch { /* not a real url literal */ }
  }
  return hosts
}

/**
 * Which registry entry owns a route. In order: an entry naming this exact route; an entry
 * whose route ends in `/*` above it (`/live-data/wallet/*` owns `wallet/btc`); then the old
 * rules for a top-level folder, own id, then `covers`, then an id mentioned in `route`.
 *
 * @template {{ id: string, route?: string, covers?: string[] }} E
 * @param {string} routeId
 * @param {E[]} entries
 * @returns {E | undefined}
 */
export function ownerOfRoute(routeId, entries) {
  const full = `/live-data/${routeId}`
  const exact = entries.find((e) => e.route === full)
  if (exact) return exact
  const wildcard = entries.find((e) => e.route?.endsWith('/*') && full.startsWith(e.route.slice(0, -1)))
  if (wildcard) return wildcard
  if (routeId.includes('/')) return undefined
  return (
    entries.find((e) => e.id === routeId) ??
    entries.find((e) => e.covers?.includes(routeId)) ??
    entries.find((e) =>
      [...(e.route ?? '').matchAll(/[a-z0-9-]+/g)].some(([id]) => id === routeId && (id.includes('-') || id.length > 3)),
    )
  )
}

/** A registry host covers a fetched host sharing its last two labels ("Cosmostation / Subscan"
 *  style entries summarise sibling hosts under one name). */
function isBundled(host, registered) {
  const sld = host.split('.').slice(-2).join('.')
  return [...registered].some((h) => h.endsWith(sld))
}

/**
 * URL literals a route writes but never fetches, by route, with the reason. Every one is
 * checked to still be in its route, so the list cannot outlive the code it excuses.
 */
export const NOT_FETCHED = {
  news: {
    'github.com': 'the contact link inside the route’s User-Agent string',
    'www.congress.gov': 'links to bills the route builds for articles; shown, never fetched',
  },
}

/**
 * Hosts a route fetches that are not data sources, and so are kept out of the source-terms
 * registry on purpose. D104 (2026-10-13), owner: "no on the AI providers". The Integrations
 * Test button calls each to check a saved key; an LLM provider processes the user's prompts
 * under the user's own key rather than supplying data the app shows.
 */
export const NOT_DATA_SOURCES = Object.fromEntries(
  [
    'api.anthropic.com', 'api.openai.com', 'generativelanguage.googleapis.com', 'api.groq.com',
    'api.x.ai', 'api.deepseek.com', 'api.mistral.ai', 'api.together.xyz', 'api.cohere.com',
  ].map((host) => [host, 'LLM provider, checked only to test a saved key (D104)']),
)

/**
 * Entries whose route checks OTHER entries' providers: the Integrations connectivity test.
 * Each host it calls must be named by some entry, so the terms check sees it; naming them
 * all again under this entry would only duplicate the registry.
 */
const ROSTER_ENTRIES = new Set(['config'])

/**
 * Drift items: a route fetching a host with no owning entry, a host its entry does not name,
 * or an exemption that no longer matches the code.
 *
 * Until T-433 (2026-10-13) an entry with any hostless provider was skipped outright, and so
 * were the config and news entries: 23 of 56 entries, which kept newsapi.org, gnews.io and
 * the LLM key-test hosts from ever reaching the terms check. A hostless provider is now just
 * a description; every literal host is checked, and the exceptions are the two named lists
 * above, each with its reason.
 *
 * @param {{ id: string, route?: string, covers?: string[], providers: { host?: string }[] }[]} entries
 * @param {{ id: string, hosts: Set<string> }[]} routes
 * @returns {string[]}
 */
export function driftItems(entries, routes) {
  const items = []
  const everyNamedHost = new Set(entries.flatMap((e) => e.providers.map((p) => p.host).filter(Boolean)))
  for (const { id, hosts } of routes) {
    for (const host of Object.keys(NOT_FETCHED[id] ?? {})) {
      if (!hosts.has(host)) items.push(`NOT_FETCHED excuses ${host} in "${id}", which no longer writes it`)
    }
    const entry = ownerOfRoute(id, entries)
    const fetched = [...hosts].filter((h) => !(h in (NOT_FETCHED[id] ?? {})) && !(h in NOT_DATA_SOURCES))
    if (!entry) {
      if (fetched.length) items.push(`route "${id}" has no registry entry (hosts: ${fetched.join(', ')})`)
      continue
    }
    const roster = ROSTER_ENTRIES.has(entry.id)
    const named = roster ? everyNamedHost : new Set(entry.providers.map((p) => p.host).filter(Boolean))
    const missing = fetched.filter((h) => !named.has(h) && !isBundled(h, named))
    if (missing.length) {
      items.push(roster
        ? `"${id}" checks ${missing.join(', ')}, which no registry entry names`
        : `"${id}" fetches ${missing.join(', ')} not named in "${entry.id}"`)
    }
  }
  const allHosts = new Set(routes.flatMap((r) => [...r.hosts]))
  for (const host of Object.keys(NOT_DATA_SOURCES)) {
    if (!allHosts.has(host)) items.push(`NOT_DATA_SOURCES excuses ${host}, which no route fetches`)
  }
  return items
}

/**
 * Reads every route under `liveDataDir` and returns its hosts, ready for driftItems().
 *
 * @param {string} liveDataDir
 * @returns {{ id: string, hosts: Set<string> }[]}
 */
export function readRoutes(liveDataDir) {
  return listRoutes(liveDataDir).map((id) => ({
    id,
    hosts: hostsInSource(fs.readFileSync(path.join(liveDataDir, id, 'route.ts'), 'utf8')),
  }))
}
