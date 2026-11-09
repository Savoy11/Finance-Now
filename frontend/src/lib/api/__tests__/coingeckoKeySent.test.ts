import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { stripComments } from '../../../../scripts/lib/stripComments.mjs'

/**
 * Every CoinGecko request carries the CoinGecko key, when one is saved (found 2026-11-09).
 *
 * The owner saved a Demo key on 2026-10-15 (T-105), and six routes sent it. Eleven call sites
 * did not: Coin Discovery, the coin list, the tokenized-security and stablecoin category reads,
 * coin search, the "About this project" panel, portfolio prices and history, the network fees'
 * prices, the v1 price API and the market-dominance figures. Each wrote CoinGecko's address by
 * hand with a bare Accept header, so each spent the keyless allowance shared by everything on
 * the machine's address. The owner's audit that day showed the cost: Coin Discovery's category
 * reads were refused with a 429, as on 2026-10-26, when it was taken for a one-off.
 *
 * So three rules, read from code with comments removed:
 *   1. CoinGecko's address appears in one file, lib/api/live/coingecko.ts. Everything else asks
 *      coingeckoBase(), so COINGECKO_BASE_URL reaches every call too.
 *   2. A file that builds a CoinGecko address also sends coingeckoHeaders(), or hands the
 *      address to fetchCoinGeckoPages(), which sends them (coingeckoPages.test.ts holds that).
 *   3. Each request does, not just each file (code audit 2026-11-09, D214): taking the key off one
 *      of ohlcv's two CoinGecko requests passed rule 2, since the file still named the helper. Every
 *      fetch whose address comes from coingeckoBase() (directly, or through a variable declared
 *      from it) must pass coingeckoHeaders, or a name declared from it, as its headers.
 */

const SRC = path.join(process.cwd(), 'src')
const rel = (f: string) => path.relative(SRC, f).split(path.sep).join('/')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== '__tests__') walk(p, out) }
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

const files = walk(SRC).map((f) => ({ rel: rel(f), code: stripComments(fs.readFileSync(f, 'utf8')) as string }))

const ADDRESS = /https?:\/\/(?:pro-)?api\.coingecko\.com\/api/
const HOME = 'lib/api/live/coingecko.ts'

/**
 * Builds a CoinGecko address but rightly sends no saved key, with the reason.
 */
const NO_SAVED_KEY: Record<string, string> = {
  // The Integrations "Test" button checks the key typed into the form, which it sends itself.
  'app/live-data/config/route.ts': 'tests the key the person typed, not the saved one',
}

describe('every CoinGecko request carries the key', () => {
  it('finds the CoinGecko call sites at all (guards the walker)', () => {
    expect(files.filter((f) => /\bcoingeckoBase\(/.test(f.code)).length).toBeGreaterThan(15)
  })

  it("writes CoinGecko's address in one file only", () => {
    const offenders = files.filter((f) => f.rel !== HOME && ADDRESS.test(f.code)).map((f) => f.rel)
    expect(offenders, 'use `${coingeckoBase()}/…` from lib/api/live/coingecko.ts').toEqual([])
  })

  it('sends coingeckoHeaders() wherever it builds a CoinGecko address', () => {
    const offenders = files
      .filter((f) => f.rel !== HOME && /\bcoingeckoBase\(/.test(f.code))
      .filter((f) => !/\bcoingeckoHeaders\b/.test(f.code) && !/\bfetchCoinGeckoPages\b/.test(f.code))
      .filter((f) => !(f.rel in NO_SAVED_KEY))
      .map((f) => f.rel)
    expect(offenders, 'send `headers: coingeckoHeaders()` so a saved CoinGecko key is used').toEqual([])
  })

  it('keeps its list of exceptions true', () => {
    for (const f of Object.keys(NO_SAVED_KEY)) {
      const found = files.find((x) => x.rel === f)
      expect(found, `${f} is listed but missing`).toBeDefined()
      expect(found!.code, `${f} is listed but builds no CoinGecko address`).toMatch(/\bcoingeckoBase\(/)
    }
  })

  it('sends the key on each CoinGecko request, not just somewhere in the file', () => {
    const offenders: string[] = []
    let requests = 0
    for (const f of files.filter((x) => x.rel !== HOME && !(x.rel in NO_SAVED_KEY) && /\bcoingeckoBase\(/.test(x.code))) {
      const cgNames = [...f.code.matchAll(/(?:const|let)\s+(\w+)\s*=\s*[^\n]*?\bcoingeckoBase\(/g)].map((m) => m[1])
      const headerNames = [...f.code.matchAll(/(?:const|let)\s+(\w+)\s*=\s*coingeckoHeaders\b/g)].map((m) => m[1])
      for (const call of fetchCalls(f.code)) {
        const toCoinGecko = /\bcoingeckoBase\(/.test(call.text) || cgNames.some((n) => new RegExp(`\\b${n}\\b`).test(call.text))
        if (!toCoinGecko) continue
        requests += 1
        const carriesKey = /\bcoingeckoHeaders\b/.test(call.text)
          || headerNames.some((h) => new RegExp(`\\bheaders\\s*:\\s*${h}\\b`).test(call.text)
            || (h === 'headers' && /[{,]\s*headers\s*[,}]/.test(call.text)))
        if (!carriesKey) offenders.push(`${f.rel}:${call.line}`)
      }
    }
    // Guards the call finder: a finder that matched nothing would pass vacuously.
    expect(requests).toBeGreaterThanOrEqual(12)
    expect(offenders, 'each CoinGecko request sends `headers: coingeckoHeaders()`').toEqual([])
  })
})

/** Every fetch-like call in a file, with its full argument text and line, by balancing parentheses. */
function fetchCalls(code: string): Array<{ text: string; line: number }> {
  const out: Array<{ text: string; line: number }> = []
  for (const m of code.matchAll(/\b(?:fetch|termsGatedFetch|pinnedFetch)\(/g)) {
    const open = (m.index ?? 0) + m[0].length - 1
    let depth = 0, end = open
    for (let i = open; i < code.length; i++) {
      if (code[i] === '(') depth += 1
      else if (code[i] === ')') { depth -= 1; if (depth === 0) { end = i; break } }
    }
    out.push({ text: code.slice(open, end + 1), line: code.slice(0, open).split('\n').length })
  }
  return out
}
