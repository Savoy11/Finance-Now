import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  CARRIED_HOSTS,
  MAJOR_OUTLETS,
  DISCOVERY_MODULES,
  blockedDomainsFor,
  isBlocked,
  parseDiscovered,
  extractJsonArray,
  type DiscoveryModule,
} from '../newsDiscovery'

/**
 * News discovery surfaces outlets the app does NOT carry. Two things can quietly ruin
 * that: the "already carried" list drifting from the real feed rosters (so discovery
 * proudly returns a feed you already read), and the parser inventing a field it did not
 * receive (so a news list shows a fabricated date, which people believe).
 */

const routes = join(__dirname, '..', '..', '..', 'app', 'live-data')

/** Hosts of every http(s) URL literal in a route file — the feeds it actually reads. */
function feedHosts(routeDir: string): string[] {
  const src = readFileSync(join(routes, routeDir, 'route.ts'), 'utf8')
  // Only URLs on lines that assign a feed `url:` — avoids picking up documentation
  // links from the comment blocks, which are plentiful in these files.
  const urls = [...src.matchAll(/url:\s*'(https?:\/\/[^']+)'/g)].map((m) => m[1])
  return [
    ...new Set(
      urls
        .map((u) => {
          try {
            return new URL(u).hostname.replace(/^www\./, '').toLowerCase()
          } catch {
            return ''
          }
        })
        .filter(Boolean),
    ),
  ]
}

describe('the excluded-domain lists', () => {
  it('are non-empty — anti-vacuity, since empty lists would exclude nothing', () => {
    expect(MAJOR_OUTLETS.length).toBeGreaterThan(10)
    for (const m of DISCOVERY_MODULES) expect(CARRIED_HOSTS[m].length).toBeGreaterThan(0)
  })

  it('combine carried feeds and majors, deduped', () => {
    const blocked = blockedDomainsFor('crypto')
    expect(blocked).toEqual([...new Set(blocked)])
    expect(blocked).toContain('coindesk.com') // carried
    expect(blocked).toContain('reuters.com') // major
  })

  it('blocks subdomains and the www form, not just an exact string match', () => {
    expect(isBlocked('reuters.com', ['reuters.com'])).toBe(true)
    expect(isBlocked('www.reuters.com', ['reuters.com'])).toBe(true)
    expect(isBlocked('uk.reuters.com', ['reuters.com'])).toBe(true)
    // ⚠ Must NOT match on a label boundary it does not own — the same trap the
    //   source-terms matcher documents. "notreuters.com" is a different company.
    expect(isBlocked('notreuters.com', ['reuters.com'])).toBe(false)
  })
})

// ⚠ THE MIRROR. CARRIED_HOSTS is a copy of what the routes fetch, and a copy is only
//    useful while it matches. Same guard stakingUpstreamProbe.test.ts puts on its own
//    copy of the staking upstream list. If this fails, a feed was added or removed and
//    discovery will either re-surface a feed you already read, or exclude one you don't.
describe('CARRIED_HOSTS mirrors the real feed rosters', () => {
  const ROSTERS: Array<{ module: DiscoveryModule; dir: string }> = [
    { module: 'crypto', dir: 'news' },
    { module: 'equities', dir: 'market-news' },
    { module: 'macro', dir: 'macro-news' },
  ]

  // ⚠ COVERING, NOT EQUAL, and the difference is a real distinction rather than a
  //    loosened assertion. A feed HOST is not an OUTLET: macro-news reads CNBC from
  //    `search.cnbc.com`, but the thing to exclude from discovery is the outlet
  //    `cnbc.com`. Requiring exact equality would force a CDN hostname into the block
  //    list, where it would fail to exclude cnbc.com articles — the opposite of the
  //    intent. So the rule is: every feed host must be COVERED by a carried outlet,
  //    and every carried outlet must cover at least one feed host. Both directions,
  //    so an addition and a removal are each caught.
  it.each(ROSTERS)('$module covers every host $dir/route.ts fetches', ({ module, dir }) => {
    const hosts = feedHosts(dir)
    expect(hosts.length, `${dir}: found no feed URLs — the extractor has drifted`).toBeGreaterThan(0)

    const uncovered = hosts.filter((h) => !isBlocked(h, CARRIED_HOSTS[module]))
    expect(uncovered, `${dir} fetches hosts no carried outlet covers — discovery would re-surface them`).toEqual([])
  })

  it.each(ROSTERS)('$module lists no outlet $dir/route.ts has stopped fetching', ({ module, dir }) => {
    const hosts = feedHosts(dir)
    const unused = CARRIED_HOSTS[module].filter((outlet) => !hosts.some((h) => isBlocked(h, [outlet])))
    expect(unused, `${dir} no longer fetches these — discovery is excluding outlets it should now surface`).toEqual([])
  })
})

describe('parseDiscovered', () => {
  const blocked = ['reuters.com']

  it('keeps a well-formed article and records its host', () => {
    const out = parseDiscovered(
      [{ title: 'A small outlet reports', url: 'https://thedefiant.io/x', sourceName: 'The Defiant', publishedAt: '2026-09-20T10:00:00Z', snippet: 'Something happened.' }],
      blocked,
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ sourceHost: 'thedefiant.io', sourceName: 'The Defiant', registered: false })
    expect(out[0].publishedAt).toBe('2026-09-20T10:00:00.000Z')
  })

  // ⚠ The rule that matters most in a news list: an absent field stays absent.
  it('NEVER invents a date — an unparseable or missing one is null', () => {
    const out = parseDiscovered(
      [
        { title: 'no date', url: 'https://a.example/1' },
        { title: 'bad date', url: 'https://a.example/2', publishedAt: 'last Tuesday' },
      ],
      blocked,
    )
    expect(out.map((a) => a.publishedAt)).toEqual([null, null])
  })

  it('drops rows with no url or no title rather than filling them in', () => {
    const out = parseDiscovered(
      [
        { title: 'no url' },
        { url: 'https://a.example/x' },
        { title: 'bad url', url: 'not a url' },
        { title: 'fine', url: 'https://b.example/y' },
      ],
      blocked,
    )
    expect(out.map((a) => a.title)).toEqual(['fine'])
  })

  // ⚠ Belt and braces over the tool's own blocked_domains. If a major slipped through,
  //   showing it would make this feature a worse copy of the feed beside it.
  it('re-applies the block list even though the search tool already enforces it', () => {
    const out = parseDiscovered(
      [
        { title: 'major', url: 'https://www.reuters.com/a' },
        { title: 'major subdomain', url: 'https://uk.reuters.com/b' },
        { title: 'small', url: 'https://smallpaper.example/c' },
      ],
      blocked,
    )
    expect(out.map((a) => a.sourceHost)).toEqual(['smallpaper.example'])
  })

  it('dedupes by url and falls back to the host when no outlet name is given', () => {
    const out = parseDiscovered(
      [
        { title: 'one', url: 'https://x.example/a' },
        { title: 'one again', url: 'https://x.example/a' },
      ],
      blocked,
    )
    expect(out).toHaveLength(1)
    expect(out[0].sourceName).toBe('x.example')
  })

  it('returns nothing for a non-array, rather than throwing', () => {
    expect(parseDiscovered(null, blocked)).toEqual([])
    expect(parseDiscovered({ title: 'x' }, blocked)).toEqual([])
  })
})

// ⚠ THE COST GUARD, and it is a SOURCE SCAN for the same reason fetchTimeouts is: the
//    constraint is a property of how the request is WRITTEN, and a mocked client would
//    exercise whatever budget the mock invents rather than the one that reaches
//    Anthropic.
//
//    The bug this pins was found on the first live run and cost real money.
//    `max_uses` is enforced PER REQUEST. discoverArticles loops on pause_turn/tool_use,
//    so every iteration arrived with a fresh budget: a nominal cap of 4 billed 9
//    searches and could have billed 24. The fix carries the spend across iterations and
//    passes what is LEFT. Anyone "simplifying" that back to the constant reintroduces
//    an uncapped bill, silently, because nothing else would fail.
describe('the search budget is carried across retries, not reset per request', () => {
  const src = readFileSync(join(__dirname, '..', 'newsDiscovery.ts'), 'utf8')

  it('passes the REMAINING budget to each request, never the raw cap', () => {
    expect(src).toMatch(/const remaining = maxUses - searchesUsed/)
    expect(src).toMatch(/max_uses:\s*remaining/)
  })

  it('stops looping once the budget is spent', () => {
    expect(src).toMatch(/if \(remaining <= 0\) break/)
  })

  it('keeps working while the model is still working, rather than returning empty', () => {
    // Returning on `tool_use` yielded zero articles after a full round of billed
    // searches on the first live run.
    expect(src).toMatch(/lastStop === 'pause_turn' \|\| lastStop === 'tool_use'/)
  })
})

describe('extractJsonArray', () => {
  it('reads a bare array', () => {
    expect(extractJsonArray('[{"a":1}]')).toEqual([{ a: 1 }])
  })

  it('reads an array inside a code fence', () => {
    expect(extractJsonArray('Here you go:\n```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }])
  })

  it('reads an array wrapped in prose the model added anyway', () => {
    expect(extractJsonArray('I found these: [{"a":1}] — hope that helps')).toEqual([{ a: 1 }])
  })

  it('returns null on malformed JSON instead of throwing', () => {
    expect(extractJsonArray('[{"a":')).toBeNull()
    expect(extractJsonArray('no array here')).toBeNull()
  })
})
