import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { contentToWrite } from '../../../../scripts/lib/generatedDate.mjs'

const DATE = /^_Last generated: \*\*\d{4}-\d{2}-\d{2}\*\*_$/m
const doc = (date: string, body = 'row') => `# Inventory\n\n_Last generated: **${date}**_\n\n| ${body} |\n`

describe('contentToWrite', () => {
  it('writes a new file', () => {
    expect(contentToWrite(null, doc('2026-11-06'), DATE)).toBe(doc('2026-11-06'))
  })

  it('leaves a file alone when only its date would change', () => {
    // The 2026-11-05 audit's finding: --verify rewrote the date with nothing else
    // changed, leaving the tree dirty. Mutation: return `next` here and this fails.
    expect(contentToWrite(doc('2026-10-26'), doc('2026-11-06'), DATE)).toBeNull()
    expect(contentToWrite(doc('2026-11-06'), doc('2026-11-06'), DATE)).toBeNull()
  })

  it('writes, with the new date, when the contents changed', () => {
    expect(contentToWrite(doc('2026-10-26'), doc('2026-11-06', 'new row'), DATE)).toBe(doc('2026-11-06', 'new row'))
  })
})

describe('gen-data-sources uses it', () => {
  const script = readFileSync(join(__dirname, '../../../../scripts/gen-data-sources.ts'), 'utf8')
  const doc = readFileSync(join(__dirname, '../../../../../DATA-SOURCES.md'), 'utf8')

  it('writes DATA-SOURCES.md only through contentToWrite', () => {
    expect(script).toMatch(/contentToWrite\(previous, md, LAST_GENERATED_LINE\)/)
    expect(script).not.toMatch(/writeFileSync\(outFile, md\)/)
  })

  it("matches the real file's date line, so an unchanged run is recognised", () => {
    // If the rendered line and this pattern ever drift apart, every run would
    // rewrite the file again. Read the pattern from the script itself.
    const source = script.match(/const LAST_GENERATED_LINE = \/(.+)\/m$/m)
    expect(source).not.toBeNull()
    const pattern = new RegExp(source![1], 'm')
    expect(doc.match(new RegExp(source![1], 'gm'))).toHaveLength(1)
    expect(pattern.test(doc)).toBe(true)
  })
})
