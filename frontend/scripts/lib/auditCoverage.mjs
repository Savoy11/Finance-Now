// Which routes the live-data audit calls, and the ones it skips on purpose.
//
// test-live-data.mjs said it "hits every /live-data/*, /api/v1/* and agent route". Measured
// 2026-10-14, it called 50 of the 60 /live-data routes and 8 of the 13 /api/v1 routes.
// Among those never called were the four /api/v1 routes the MCP server reads. A run that
// reports 0 failing says nothing about the routes it never asked, so every route is now
// either called by the audit or named below with the reason it is not.
// auditCoverage.test.ts holds both directions, and the audit prints this list on every run.

import fs from 'node:fs'
import path from 'node:path'
import { listRoutes } from './routeHosts.mjs'
import { stripComments } from './stripComments.mjs'

const BILLED =
  'POST only, and every call runs an AI model on the owner’s key. `npm run agent-eval` runs the Pump Report agents on purpose, with --run'
const RATING =
  'hidden while ASSET_PAGE_RATINGS_SHOWN is false, and every call writes a weekly reading to the database. Its inputs are routes the audit already checks; `npm run ratings:validate` exercises the engine'

/** Routes the audit deliberately does not call, by path, each with the reason. */
export const NOT_AUDITED = {
  '/live-data/pump-report/scan': BILLED,
  '/live-data/pump-report/investigate': BILLED,
  '/live-data/pump-report/chat': BILLED,
  '/live-data/coin-rating': `${RATING} (CoinGecko’s daily chart, as /live-data/chart reads it)`,
  '/live-data/stock-rating': `${RATING} (security-ohlcv and company-facts)`,
}

/**
 * Every route path under the app's /live-data and /api/v1 folders, nested ones included.
 *
 * @param {string} appDir the Next.js `src/app` folder
 * @returns {string[]}
 */
export function appRoutes(appDir) {
  const live = listRoutes(path.join(appDir, 'live-data')).map((id) => `/live-data/${id}`)
  const v1Dir = path.join(appDir, 'api', 'v1')
  const v1 = listRoutes(v1Dir).map((id) => `/api/v1/${id}`)
  // listRoutes walks sub-folders only; the discovery document is v1's own route.ts.
  if (fs.existsSync(path.join(v1Dir, 'route.ts'))) v1.unshift('/api/v1')
  return [...live, ...v1]
}

/**
 * Whether the audit's code requests this route: the path written as the start of a string,
 * followed by a query, the string's end, a trailing slash, or a template expression. A
 * longer path (`/live-data/fx-rates-extended`) does not count as `/live-data/fx-rates`.
 *
 * @param {string} code the audit's source with comments stripped
 * @param {string} routePath
 */
export function auditCalls(code, routePath) {
  const esc = routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`['\`]${esc}(?:/?[?'\`]|\\$\\{)`).test(code)
}

/**
 * What is wrong with the audit's coverage, one line per problem: a route it neither calls
 * nor names in NOT_AUDITED, a route it calls and also names, and a NOT_AUDITED entry that
 * is no route at all. Empty when coverage is complete.
 *
 * @param {string} auditSource test-live-data.mjs as read from disk
 * @param {string[]} routes from appRoutes()
 * @param {Record<string, string>} [notAudited]
 * @returns {string[]}
 */
export function coverageGaps(auditSource, routes, notAudited = NOT_AUDITED) {
  const code = stripComments(auditSource)
  const items = []
  for (const r of routes) {
    const called = auditCalls(code, r)
    if (!called && !(r in notAudited)) items.push(`${r}: never called by the audit, and not named in NOT_AUDITED`)
    if (called && r in notAudited) items.push(`${r}: called by the audit and also named in NOT_AUDITED; drop one`)
  }
  for (const r of Object.keys(notAudited)) {
    if (!routes.includes(r)) items.push(`NOT_AUDITED names ${r}, which is not a route`)
  }
  return items
}
