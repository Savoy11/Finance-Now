import { describe, it, expect } from 'vitest'
import { stripComments } from '../../../../scripts/lib/stripComments.mjs'

/**
 * T-399 follow-up (2026-09-26). The registry↔code drift checker in
 * gen-data-sources.ts scans each route for fetched hosts. When the Yearn rung was
 * removed, the tombstone comment recording the dead endpoint still contained
 * `https://api.yearn.finance/...`, so the checker reported a route fetching an
 * unregistered host — a defect that did not exist. The guard has to read code, not
 * prose, which is the same lesson the D26 risk guard recorded.
 *
 * These pin the two failure modes a regex stripper has and this scanner must not.
 */
describe('stripComments', () => {
  it('removes a line comment', () => {
    expect(stripComments('const a = 1 // note\nconst b = 2')).toBe('const a = 1  \nconst b = 2')
  })

  it('removes a block comment, including a multi-line one', () => {
    expect(stripComments('a /* one\n two */ b')).toBe('a   b')
  })

  it('does NOT eat a URL — the whole reason this exists', () => {
    const src = "const u = 'https://api.yearn.finance/v1/vaults'"
    expect(stripComments(src)).toBe(src)
  })

  it('removes a comment that mentions a URL, leaving no host behind', () => {
    const src = "// dropped: https://api.yearn.finance/v1/vaults\nconst live = 'https://yields.llama.fi/pools'"
    const out = stripComments(src)
    expect(out).not.toMatch(/yearn/)
    expect(out).toMatch(/yields\.llama\.fi/)
  })

  it('leaves // inside a string alone', () => {
    for (const src of ["const a = 'x//y'", 'const a = "x//y"', 'const a = `x//y`']) {
      expect(stripComments(src)).toBe(src)
    }
  })

  it('leaves a comment marker inside a template literal alone, interpolation included', () => {
    const src = 'const u = `https://${host}/path` // trailing'
    expect(stripComments(src)).toBe('const u = `https://${host}/path`  ')
  })

  it('honours escapes, so an escaped quote does not end the string early', () => {
    const src = "const a = 'it\\'s // not a comment'"
    expect(stripComments(src)).toBe(src)
  })

  it('handles an unterminated string without hanging or throwing', () => {
    expect(() => stripComments("const a = 'oops")).not.toThrow()
  })

  it('guards the guard: the naive regex stripper mangles a URL and this does not', () => {
    const src = "const u = 'https://host/x'"
    expect(src.replace(/\/\/.*$/gm, '')).toBe("const u = 'https:")
    expect(stripComments(src)).toBe(src)
  })
})
