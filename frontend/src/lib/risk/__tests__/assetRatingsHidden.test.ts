import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { ASSET_PAGE_RATINGS_SHOWN } from '../visibility'
import { HOLDINGS_POLICY } from '../ratingCopy'
import { GET as coinRating } from '@/app/live-data/coin-rating/route'
import { GET as stockRating } from '@/app/live-data/stock-rating/route'

/**
 * The asset-page ratings (T-420; D92) stay hidden until counsel confirms the form (D4),
 * the owner's holdings policy is written, and the owner says so. While the switch is off,
 * the two rating routes answer only on the owner's machine, and nothing else reaches a
 * rating. If you are turning it on, this file is the list of what to decide again.
 */

const repo = (rel: string) => path.join(process.cwd(), rel)

/** Every source file under `dir`, comments stripped, so a note naming the routes is not a use of them. */
function sources(dir: string): Array<{ file: string; code: string }> {
  const out: Array<{ file: string; code: string }> = []
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name)
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '__tests__' && e.name !== 'dist') walk(full) }
      else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) {
        const code = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
        out.push({ file: path.relative(process.cwd(), full), code })
      }
    }
  }
  walk(repo(dir))
  return out
}

/** Anything that would reach a rating: the routes, the engine, the stored readings. */
const READS_A_RATING = /coin-rating|stock-rating|assetRating|rateAsset|ratingStore|ratingReadings|asset_rating_readings/

const savedEnv = { ...process.env }
beforeEach(() => {
  delete process.env.FN_ADMIN_TOKEN
  delete process.env.CAEP_ADMIN_TOKEN
})
afterEach(() => {
  vi.unstubAllGlobals()
  process.env = { ...savedEnv }
})

describe('T-420: asset-page ratings are hidden', () => {
  it('the switch is off', () => {
    expect(ASSET_PAGE_RATINGS_SHOWN).toBe(false)
  })

  it('both rating routes refuse any host but the owner’s machine, before fetching anything', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const remote = (p: string) => new NextRequest(`https://finance.example.com${p}`, { headers: { host: 'finance.example.com' } })
    expect((await coinRating(remote('/live-data/coin-rating?id=btc'))).status).toBe(403)
    expect((await stockRating(remote('/live-data/stock-rating?symbol=AAPL'))).status).toBe(403)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('with an admin token set, a request without it is refused even from localhost', async () => {
    process.env.FN_ADMIN_TOKEN = 'test-token'
    const local = new NextRequest('http://localhost:3000/live-data/coin-rating?id=btc', { headers: { host: 'localhost:3000' } })
    expect((await coinRating(local)).status).toBe(401)
  })

  it('no /api/v1 route, agent tool or MCP tool reads a rating', () => {
    const offenders = [...sources('src/app/api'), ...sources('src/lib/agents'), ...sources('../mcp-server/src')]
      .filter((s) => READS_A_RATING.test(s.code))
      .map((s) => s.file)
    expect(offenders).toEqual([])
  })

  it('one component reads a rating, and it checks the switch before anything else', () => {
    // Allowed, each for its reason: the panel reads a rating and is gated, below; the
    // methodology describes the method from v1.ts and reads no rating, and its page is gated.
    const ALLOWED = [
      path.join('src', 'components', 'markets', 'AssetRatingPanel.tsx'),
      path.join('src', 'components', 'legal', 'RatingMethodology.tsx'),
    ]
    const readers = [...sources('src/app/(dashboard)'), ...sources('src/app/(legal)'), ...sources('src/components')]
      .filter((s) => READS_A_RATING.test(s.code))
      .map((s) => s.file)
    expect(readers.sort()).toEqual([...ALLOWED].sort())

    const panel = sources('src/components/markets').find((s) => s.file.endsWith('AssetRatingPanel.tsx'))!
    expect(panel.code).toMatch(/export function AssetRatingPanel\([^)]*\)[^{]*\{\s*if \(!ASSET_PAGE_RATINGS_SHOWN\) return null/)
    const methodology = sources('src/components/legal').find((s) => s.file.endsWith('RatingMethodology.tsx'))!
    expect(methodology.code).not.toMatch(/coin-rating|stock-rating|useQuery|fetch\(/)
  })

  it('the coin and stock pages show the rating only through the gated panel', () => {
    for (const page of ['src/app/(dashboard)/assets/[id]/page.tsx', 'src/app/(dashboard)/equities/[symbol]/page.tsx']) {
      const code = fs.readFileSync(repo(page), 'utf8')
      expect(code, page).toMatch(/<AssetRatingPanel kind="(crypto|stock)"/)
    }
  })

  it('the methodology page checks the switch before rendering', () => {
    const code = fs.readFileSync(repo('src/app/(legal)/about/risk-ratings/page.tsx'), 'utf8')
    expect(code).toMatch(/if \(!ASSET_PAGE_RATINGS_SHOWN\) notFound\(\)\s*return <RatingMethodology \/>/)
  })

  it('the switch cannot be on while the owner’s holdings policy is unwritten (methodology §11)', () => {
    expect(ASSET_PAGE_RATINGS_SHOWN && HOLDINGS_POLICY === null).toBe(false)
  })

  it('guards the guard: the walkers find files, and the pattern matches a real use', () => {
    expect(sources('src/app/api').length).toBeGreaterThan(10)
    expect(sources('../mcp-server/src').length).toBeGreaterThan(0)
    expect(sources('src/components').length).toBeGreaterThan(10)
    expect(READS_A_RATING.test("fetch('/live-data/coin-rating?id=btc')")).toBe(true)
    expect(READS_A_RATING.test('// see /live-data/coin-rating')).toBe(true) // stripped before matching, above
  })
})
