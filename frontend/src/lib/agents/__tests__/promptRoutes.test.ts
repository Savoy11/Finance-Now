import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_DEFAULTS } from '../prompts'

/**
 * T6 (2026-09-08): agent prompts must not send a user to a page that redirects.
 *
 * The app-assistant's platform context is the map it navigates by. Between
 * 2026-08-18 and 2026-08-22 four surfaces were hidden or removed and the prompt
 * was not updated, so for three weeks the assistant was offering users a Transfer
 * Fees calculator that bounces to Headlines, a Wallets page that does the same,
 * and — the serious one — "read-only exchange APIs" in an app that deliberately
 * refuses to hold an exchange key at all (RP-5).
 *
 * Every hide adds a `redirects()` entry to next.config.mjs, so that list is the
 * natural trigger. This test reads it rather than hard-coding the routes: a
 * future hide is caught without anyone remembering to extend a fixture.
 *
 * Naming a hidden route is allowed — the assistant SHOULD be able to explain why
 * a bookmark now bounces. What is not allowed is naming one without saying so.
 */

const configPath = join(process.cwd(), 'next.config.mjs')
const config = readFileSync(configPath, 'utf-8')

/** Literal page redirects only — skips the `/api/:path…` rewrite and the `/(.*)` catch-all. */
function redirectedRoutes(): string[] {
  const out: string[] = []
  const re = /\{\s*source:\s*'(\/[^']*)'\s*,\s*destination:/g
  let m: RegExpExecArray | null
  while ((m = re.exec(config)) !== null) {
    const src = m[1]
    if (src.includes('(') || src.includes(':')) continue // patterns, not literal pages
    out.push(src)
  }
  return out
}

/** Wording that shows the prompt knows the route is not reachable. */
const WITHDRAWN_MARKERS = /HIDDEN|hidden|redirects|no longer exist|REMOVED|removed|not part of the current release|deferred/

describe('agent prompts vs. the redirect list', () => {
  const routes = redirectedRoutes()

  it('finds the redirect list to check against', () => {
    // If this fails, next.config.mjs changed shape and the parser above is
    // silently matching nothing — which would make every check below vacuous.
    expect(routes.length).toBeGreaterThan(4)
    expect(routes).toContain('/transfer-fees')
    expect(routes).toContain('/wallets')
  })

  for (const agent of AGENT_DEFAULTS) {
    const prompt = agent.systemPrompt ?? ''
    const named = routes.filter((r) => new RegExp(`(^|[\\s(])${r.replace(/\//g, '\\/')}(?![\\w/-])`).test(prompt))
    if (named.length === 0) continue

    it(`${agent.id}: every withdrawn route it names is marked as withdrawn`, () => {
      for (const route of named) {
        // Check the line the route appears on, not the whole prompt — a
        // "HIDDEN" 40 lines away does not qualify the mention here.
        const line = prompt.split('\n').find((l) => l.includes(route)) ?? ''
        expect(
          WITHDRAWN_MARKERS.test(line),
          `${agent.id} names ${route}, which redirects away, without saying it is withdrawn:\n  ${line.trim()}`,
        ).toBe(true)
      }
    })
  }

  it('the app-assistant never offers exchange API-key linking (RP-5)', () => {
    // Not a routing question but the same class of drift, and the one with a
    // real cost: the prompt advertised "read-only exchange APIs" for three weeks
    // after key custody was removed on security grounds.
    const assistant = AGENT_DEFAULTS.find((a) => a.id === 'app-assistant')!
    const p = assistant.systemPrompt ?? ''
    expect(p).not.toMatch(/read-only exchange API/i)
    expect(p).toMatch(/RP-5|never tell a user they can connect an exchange/i)
  })
})
