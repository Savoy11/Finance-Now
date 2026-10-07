import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every screener filter written into the link must also be read back from it.
 *
 * useScreenerUrl takes three arguments: the current filter values (written to the
 * URL), their defaults, and an `apply` callback that restores values from a link
 * when the page opens. Nothing ties the third to the first two, and the stock
 * screener drifted: W3-5 added max yield, min beta, a price range and "payers
 * only" to the state it wrote, but `apply` was never extended, so a shared link
 * silently dropped all five and showed the unfiltered list. The T-282 browser
 * click-through (2026-10-07) found it; this test is what keeps it found.
 *
 * It reads source text because the three call sites are page components, not
 * pure functions, and the property in question is a correspondence between two
 * arguments of one call.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), 'src', rel), 'utf8')

/** Split the argument list of the first `useScreenerUrl(` call at its top-level commas. */
function screenerArgs(source: string): string[] {
  const start = source.search(/useScreenerUrl\(\s*\{/)
  if (start < 0) throw new Error('no useScreenerUrl( call found')
  let i = source.indexOf('(', start) + 1
  const args: string[] = []
  let depth = 0
  let current = ''
  for (; i < source.length; i++) {
    const ch = source[i]
    if ('({['.includes(ch)) depth++
    if (')}]'.includes(ch)) {
      if (depth === 0) break // the call's own closing parenthesis
      depth--
    }
    if (ch === ',' && depth === 0) {
      args.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) args.push(current.trim())
  return args
}

/** The literal keys of an object-literal argument; spreads are reported separately. */
function literalKeys(objectText: string): { keys: string[]; spreads: string[] } {
  const body = objectText.trim().replace(/^\{/, '').replace(/\}$/, '')
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of body) {
    if ('({['.includes(ch)) depth++
    if (')}]'.includes(ch)) depth--
    if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) parts.push(current.trim())
  const keys: string[] = []
  const spreads: string[] = []
  for (const p of parts.filter(Boolean)) {
    if (p.startsWith('...')) spreads.push(p)
    else keys.push(p.split(':')[0].trim().replace(/^['"]|['"]$/g, ''))
  }
  return { keys, spreads }
}

const SCREENERS = [
  { name: 'stocks', file: 'app/(dashboard)/equities/EquitiesClient.tsx' },
  { name: 'funds', file: 'app/(dashboard)/funds/FundsClient.tsx' },
  { name: 'coins', file: 'app/(dashboard)/assets/AssetRegistryClient.tsx' },
]

/** Exported shape of the check so the mutation case below can run it on old source. */
function unreadKeys(source: string): string[] {
  const [, defaults, apply] = screenerArgs(source)
  const { keys } = literalKeys(defaults)
  return keys.filter((k) => !new RegExp(`\\bp\\.${k}\\b|\\bp\\[['"]${k}['"]\\]`).test(apply))
}

describe('screener links: every written filter is read back', () => {
  for (const s of SCREENERS) {
    it(`${s.name}: apply() reads every key the link can carry`, () => {
      const source = read(s.file)
      const [state, defaults, apply] = screenerArgs(source)
      // Anti-vacuity: the parse must find the three arguments and real keys.
      expect(apply).toMatch(/^\(p\)\s*=>/)
      const { keys } = literalKeys(defaults)
      expect(keys.length).toBeGreaterThan(2)
      // Each default names a key the state writes, so a key missing from either is a drift too.
      for (const k of keys) expect(state, `${s.name}: '${k}' has a default but is never written`).toMatch(new RegExp(`\\b${k}\\b`))
      expect(unreadKeys(source), `${s.name}: written to the link but never read back`).toEqual([])
    })
  }

  it('funds: the range dimensions are written and read through one r_<key> loop', () => {
    const [, defaults, apply] = screenerArgs(read('app/(dashboard)/funds/FundsClient.tsx'))
    expect(literalKeys(defaults).spreads.join(' ')).toContain('`r_${k}`')
    expect(apply).toContain('p[`r_${k}`]')
  })

  it('the check fails on the stock screener as it was before the fix', () => {
    // The pre-fix apply() restored ten of the fifteen keys. Rebuild that by removing
    // the five lines the fix added, and the check must name exactly those five.
    const fixed = read('app/(dashboard)/equities/EquitiesClient.tsx')
    const before = fixed
      .split('\n')
      .filter((l) => !/if \(p\.(yieldMax|betaMin|priceMin|priceMax|payers)\b/.test(l))
      .join('\n')
    expect(before).not.toBe(fixed)
    expect(unreadKeys(before).sort()).toEqual(['payers', 'priceMax', 'priceMin', 'yieldMax', 'betaMin'].sort())
  })
})
