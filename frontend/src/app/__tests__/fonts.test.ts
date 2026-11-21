import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Code audit 2026-11-05: JetBrains Mono, the font of every chart axis and `font-mono`
// figure, never loaded. It came from a Google Fonts @import in globals.css, and a
// browser ignores an @import that follows other rules, which Tailwind's are. Both
// fonts now come from next/font, which serves them from the app's own build.
const css = readFileSync(join(__dirname, '../globals.css'), 'utf8')
const layout = readFileSync(join(__dirname, '../layout.tsx'), 'utf8')

describe('the app fonts', () => {
  it('loads no font through a CSS @import, which a browser would ignore after Tailwind', () => {
    // Mutation: put the Google Fonts @import back and this fails.
    expect(css).not.toMatch(/@import\s+url\(/)
    expect(css).not.toMatch(/fonts\.googleapis\.com/)
  })

  it('loads both fonts through next/font and applies them to the page', () => {
    expect(layout).toMatch(/import\s*\{[^}]*\bInter\b[^}]*\bJetBrains_Mono\b[^}]*\}\s*from\s*'next\/font\/google'/)
    expect(layout).toMatch(/JetBrains_Mono\(\{/)
    expect(layout).toMatch(/\$\{jetbrainsMono\.variable\}/)
    expect(layout).toMatch(/\$\{inter\.variable\}/)
  })

  it('asks for the fonts by the names next/font gives them', () => {
    expect(css).toMatch(/--font-sans:\s*Inter\b/)
    expect(css).toMatch(/--font-mono:\s*JetBrains Mono\b/)
  })
})
