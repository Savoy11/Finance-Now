import { describe, it, expect, vi, afterEach } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { stripComments } from '../../../../scripts/lib/stripComments.mjs'
import { termsGatedFetch } from '../termsGatedFetch'
import { RobotsDisallowedError, SourceTermsError, hostOf, matchTermsEntry } from '../sourceTerms'

/**
 * 2026-10-13. The robots gate and the prohibited-host block sat in pinnedFetch only, and
 * CLAUDE.md said a new call site "inherits" them. 4 of 60 /live-data routes call
 * pinnedFetch. The Integrations page's Test button for Reddit Finance used the platform
 * fetch and read reddit.com on every click, though robots.txt disallows this app's agent.
 */

afterEach(() => vi.unstubAllGlobals())

const ok = () => new Response('{}', { status: 200 })
// A ProcessEnv with only the named variables, as robotsGate.test.ts builds it.
const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv

describe('termsGatedFetch', () => {
  it('refuses a robots-disallowed host before opening anything', async () => {
    const fetchMock = vi.fn(ok)
    vi.stubGlobal('fetch', fetchMock)
    await expect(termsGatedFetch('https://www.reddit.com/r/stocks/hot.json', undefined, env({}))).rejects.toBeInstanceOf(RobotsDisallowedError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lets the same host through once its lifting credential is configured', async () => {
    const fetchMock = vi.fn(ok)
    vi.stubGlobal('fetch', fetchMock)
    await termsGatedFetch('https://www.reddit.com/r/stocks/hot.json', undefined, env({ REDDIT_CLIENT_ID: 'x' }))
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('refuses a prohibited host before opening anything', async () => {
    const fetchMock = vi.fn(ok)
    vi.stubGlobal('fetch', fetchMock)
    await expect(termsGatedFetch('https://query1.finance.yahoo.com/v8/finance/chart/AAPL', undefined, env({}))).rejects.toBeInstanceOf(SourceTermsError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('passes a permitted request through with its options, Next cache settings included', async () => {
    const fetchMock = vi.fn(ok)
    vi.stubGlobal('fetch', fetchMock)
    const init = { headers: { Accept: 'application/json' }, next: { revalidate: 0 } } as RequestInit
    await termsGatedFetch('https://api.coingecko.com/api/v3/ping', init, env({}))
    expect(fetchMock).toHaveBeenCalledWith('https://api.coingecko.com/api/v3/ping', init)
  })
})

const SRC = join(__dirname, '..', '..', '..')
const rel = (f: string) => relative(SRC, f).split(sep).join('/')
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : walk(p)
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}
const code = (f: string) => stripComments(readFileSync(f, 'utf8')) as string

describe('the Integrations page’s provider tests', () => {
  it('fetch nothing except through termsGatedFetch or pinnedFetch', () => {
    const route = code(join(SRC, 'app', 'live-data', 'config', 'route.ts'))
    const bare = route.split('\n').filter((l) => /(?<![A-Za-z.])fetch\(/.test(l)).map((l) => l.trim())
    expect(bare).toEqual([])
  })
})

describe('every file that names a robots-disallowed host in a URL checks robots first', () => {
  // Files that write such a URL without fetching it, and why.
  const NOT_FETCHED: Record<string, string> = {
    'lib/api/live/providers.ts': 'keyUrl links shown on the Integrations page',
    'lib/server/sourceTerms.ts': 'the registry itself',
    'lib/data/dataSources.ts': 'the data-source registry',
  }
  const disallowedIn = (src: string) =>
    [...src.matchAll(/https?:\/\/[^'"`\s)]+/g)].some(([url]) => {
      const host = hostOf(url)
      return host !== null && !!matchTermsEntry(host)?.robotsDisallowed
    })
  const files = walk(SRC).filter((f) => !(rel(f) in NOT_FETCHED) && disallowedIn(code(f)))

  it('finds the files that read such a host (guards against the scan silently emptying)', () => {
    expect(files.map(rel).sort()).toEqual([
      'app/live-data/config/route.ts',
      'app/live-data/social/route.ts',
      'app/live-data/stock-social/route.ts',
    ])
  })

  it.each(files.map(rel))('%s checks robots before fetching', (file) => {
    expect(code(join(SRC, file))).toMatch(/\b(robotsPermits|assertRobotsPermits|termsGatedFetch|pinnedFetch)\(/)
  })
})
