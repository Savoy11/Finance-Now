import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stripComments } from '../../../../scripts/lib/stripComments.mjs'

// The two scanner pages must not type how many setup detectors they run.
//
// On 2026-10-13 the crypto scanner moved to closing prices (D103) and began
// running only SETUPS_FROM_CLOSES. Its own page derived the new count, but the
// Equity Scanner's description still told users it ran "the same seven setup
// detectors the crypto scanner runs", which had stopped being true that day,
// and its Setups line listed the seven by hand. A typed count is right once;
// both pages now compute theirs from the detector table. Comments may still
// carry dated history ("ran seven setup detectors … (2026-08-19)").

const DASHBOARD = join(__dirname, '..', '..', '..', 'app', '(dashboard)')
const PAGES = {
  crypto: join(DASHBOARD, 'scanner', 'page.tsx'),
  equities: join(DASHBOARD, 'equities', 'scanner', 'page.tsx'),
}
const code = (file: string) => stripComments(readFileSync(file, 'utf8')) as string

const TYPED_COUNT = /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:setup\s+)?detectors?\b/gi

describe('scanner page copy', () => {
  for (const [name, file] of Object.entries(PAGES)) {
    it(`the ${name} scanner types no detector count`, () => {
      expect(code(file).match(TYPED_COUNT) ?? []).toEqual([])
    })
  }

  it('the equity scanner does not claim to run what the crypto scanner runs', () => {
    // They differ since D103: stocks have full candles, crypto reads closes.
    const lines = code(PAGES.equities).split('\n').filter((l) => /same[^\n]*crypto scanner/i.test(l))
    expect(lines.map((l) => l.trim())).toEqual([])
  })

  it('the equity scanner derives its count and its list of setups from the detector table', () => {
    const src = code(PAGES.equities)
    expect(src).toMatch(/const SETUP_KEYS = Object\.keys\(SETUP_META\)/)
    expect(src).toMatch(/all \$\{SETUP_KEYS\.length\} setup detectors/)
    expect(src).toMatch(/SETUP_KEYS\.map\(\(k\) => SETUP_META\[k\]\.label\)/)
  })
})
