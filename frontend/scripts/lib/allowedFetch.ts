/**
 * Reading a page from this machine for a pre-fill (D140 step 2), only where the owner allows it.
 * Shared by the Fund Figures pre-fill and the Staking Facts pre-fill, so both keep one rule:
 *
 *  · every hop, redirects included, must be on a site ruled Allowed, or the read stops there;
 *  · every hop must be one its robots.txt lets FinanceNow read; a robots.txt that is missing
 *    (404, 410) disallows nothing, and one that cannot be read stops it: no answer is no permission;
 *  · it sends no cookies and keeps none (D147), and it calls nothing but the address asked for.
 *
 * Moved here from fund-figures-prefill.ts on 2026-10-22, unchanged, when the staking pre-fill
 * needed the same gate.
 */
import { pinnedFetch } from '@/lib/server/pinnedFetch'
import { isPathAllowedByRobots, parseRobotsTxt } from '@/lib/server/termsProbe'
import { siteOf } from './siteTerms'

const FETCH_TIMEOUT_MS = 15_000
const MAX_BYTES = 2_000_000
const MAX_REDIRECTS = 5

export type PageOutcome = 'read' | 'not-allowed' | 'robots' | 'unreadable'

export interface GatedPage {
  outcome: PageOutcome
  why: string
  /** Where the page really was, after any redirects. */
  finalUrl: string | null
  html: string | null
}

interface Fetched { status: number | null; text: string | null; url: string; why: string; refused: string | null }

/** One fetcher per run: it remembers each site's robots.txt for the run, and nothing else. */
export function allowedFetcher(userAgent: string, allowed: ReadonlySet<string>) {
  /**
   * One address, following redirects here one hop at a time, so every hop passes `hop`, which
   * returns why it may not be read, or null. pinnedFetch pins each connection to the address its
   * own host resolved to, so it cannot follow a redirect to another host itself.
   */
  async function fetchFollowing(url: string, hop: (at: string, n: number) => Promise<string | null>): Promise<Fetched> {
    let at = url
    for (let n = 0; n <= MAX_REDIRECTS; n++) {
      const refused = await hop(at, n)
      if (refused) return { status: null, text: null, url: at, why: refused, refused }
      try {
        const res = await pinnedFetch(at, {
          headers: { 'User-Agent': userAgent, Accept: 'text/html,text/plain,*/*' },
          redirect: 'manual',
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
        const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
        if (next) {
          at = new URL(next, at).toString()
          continue
        }
        if (!res.ok) return { status: res.status, text: null, url: at, why: `HTTP ${res.status}`, refused: null }
        return { status: res.status, text: (await res.text()).slice(0, MAX_BYTES), url: at, why: '', refused: null }
      } catch (e) {
        return { status: null, text: null, url: at, why: e instanceof Error ? e.message : String(e), refused: null }
      }
    }
    return { status: null, text: null, url: at, why: `more than ${MAX_REDIRECTS} redirects`, refused: null }
  }

  const onAllowedSite = async (at: string, n: number) => {
    const site = siteOf(at)
    return site && allowed.has(site) ? null : `${n === 0 ? 'The address is' : `It redirected to ${at}, which is`} not on a site ruled Allowed.`
  }

  const robotsCache = new Map<string, Promise<Fetched>>()
  const robotsFor = (origin: string) => {
    if (!robotsCache.has(origin)) robotsCache.set(origin, fetchFollowing(`${origin}/robots.txt`, onAllowedSite))
    return robotsCache.get(origin)!
  }

  /** The page. Every hop must be on an Allowed site and let FinanceNow read it. */
  return async function fetchPage(url: string): Promise<GatedPage> {
    let robotsRefused = false
    const got = await fetchFollowing(url, async (at, n) => {
      const notAllowed = await onAllowedSite(at, n)
      if (notAllowed) return notAllowed
      const u = new URL(at)
      const robots = await robotsFor(u.origin)
      if (robots.text !== null) {
        if (isPathAllowedByRobots(parseRobotsTxt(robots.text), `${u.pathname}${u.search}`)) return null
        robotsRefused = true
        return `${u.origin}/robots.txt does not let FinanceNow read ${u.pathname}.`
      }
      if (robots.status === 404 || robots.status === 410) return null
      robotsRefused = true
      return `${u.origin}/robots.txt could not be read (${robots.why}), and no answer is no permission.`
    })
    if (got.refused) return { outcome: robotsRefused ? 'robots' : 'not-allowed', why: got.refused, finalUrl: got.url, html: null }
    if (got.text === null) return { outcome: 'unreadable', why: got.why, finalUrl: got.url, html: null }
    return { outcome: 'read', why: '', finalUrl: got.url, html: got.text }
  }
}
