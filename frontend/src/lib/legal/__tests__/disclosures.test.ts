import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  ABOUT_PAGE, LEGAL_DOCUMENTS, LEGAL_PATHS, FOOTER_LINKS, KNOWN_BLANKS, HOW_WE_MAKE_MONEY_HREF,
  allPublishedText, unfilledBlanks, disclosuresInForce, providerCredits, sectionId,
  type LegalBlock, type LegalSection,
} from '../disclosures'
import { blanksIn, parseInline } from '../inline'
import { STAKING_PROVIDERS } from '@/lib/data/stakingProviders'
import { sponsoredProviders } from '@/lib/data/affiliates'

const ROOT = process.cwd()
const APP = path.join(ROOT, 'src/app')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

/** The page file for a URL path, in whichever route group it lives. */
function pageFile(urlPath: string): string | null {
  const rel = urlPath.replace(/^\//, '')
  const groups = fs.readdirSync(APP).filter((d) => /^\(.+\)$/.test(d))
  for (const dir of [APP, ...groups.map((g) => path.join(APP, g))]) {
    const f = path.join(dir, rel, 'page.tsx')
    if (fs.existsSync(f)) return f
  }
  return null
}

function blockStrings(b: LegalBlock): string[] {
  switch (b.kind) {
    case 'p': return [b.text]
    case 'list': return b.items
    case 'table': return [...b.head, ...b.rows.flat()]
    case 'more': return [`[${b.text}](${b.href})`]
  }
}

/** Every page of the set, with the section ids an anchor on it may name. */
const PAGES: Array<{ path: string; ids: string[]; strings: string[] }> = [
  {
    path: LEGAL_PATHS.about,
    ids: ABOUT_PAGE.sections.map((s) => s.id),
    strings: ABOUT_PAGE.sections.flatMap((s) => s.blocks.flatMap(blockStrings)),
  },
  ...LEGAL_DOCUMENTS.map((d) => ({
    path: d.path,
    ids: d.sections.map((s) => s.id),
    strings: [...d.intro, ...d.sections.flatMap((s: LegalSection) => s.blocks)].flatMap(blockStrings),
  })),
]

describe('the About page', () => {
  it("has the draft's ten sections, in the draft's order", () => {
    // Disclosure Set, "About page" tab: "Ten short sections, in this order."
    expect(ABOUT_PAGE.sections.map((s) => s.id)).toEqual([
      'who-we-are', 'how-we-make-money', 'not-investment-advice', 'regulatory-status',
      'where-our-data-comes-from', 'your-privacy', 'terms-of-use', 'questions-and-complaints',
      'policy-updates', 'open-source-notices',
    ])
  })

  it('credits every attribution the data-source registry requires, CoinGecko included', () => {
    const credits = providerCredits()
    expect(credits.find((c) => c.text === 'Powered by CoinGecko')?.href).toMatch(/^https:\/\/www\.coingecko\.com/)
    // …and the page actually renders them, in the data section.
    expect(read('src/app/(legal)/about/page.tsx')).toMatch(/providerCredits\(\)/)
  })

  it('says no link pays us, so no provider may carry a paid link (D49)', () => {
    const says = allPublishedText().some((t) => t.includes('No link on either site pays us'))
    expect(says).toBe(true)
    expect(sponsoredProviders(STAKING_PROVIDERS), 'a paid link exists while /about says none does').toEqual([])
  })
})

describe('blanks and the draft notice', () => {
  it('every blank in the text is one the draft defines — a typo is not a blank', () => {
    const unknown = unfilledBlanks().filter((b) => !(KNOWN_BLANKS as readonly string[]).includes(b))
    expect(unknown).toEqual([])
    // Guards the guard: a misspelt blank IS caught by the same comparison.
    expect(blanksIn('[CONTACT EMAL]').filter((b) => !(KNOWN_BLANKS as readonly string[]).includes(b))).toEqual(['[CONTACT EMAL]'])
  })

  it('finds the blanks the draft still has — the notice has something to list', () => {
    expect(unfilledBlanks()).toEqual(expect.arrayContaining(['[COMPANY LLC NAME]', '[CONTACT EMAIL]', '[EFFECTIVE DATE]']))
  })

  it('is in force only once approved AND with no blank left', () => {
    expect(disclosuresInForce()).toBe(false)                          // today: a draft with blanks
    expect(disclosuresInForce('approved', ['[CONTACT EMAIL]'])).toBe(false) // approving cannot skip a blank
    expect(disclosuresInForce('draft', [])).toBe(false)                // filling blanks is not approval
    expect(disclosuresInForce('approved', [])).toBe(true)
  })

  it('every page that carries the text shows the draft notice', () => {
    expect(read('src/app/(legal)/about/page.tsx')).toContain('<DraftNotice />')
    expect(read('src/components/legal/LegalDocumentView.tsx')).toContain('<DraftNotice />')
    for (const d of LEGAL_DOCUMENTS) {
      const file = pageFile(d.path)
      expect(file, `${d.path} has no page`).not.toBeNull()
      expect(fs.readFileSync(file!, 'utf8'), `${d.path} must render LegalDocumentView`).toContain('<LegalDocumentView')
    }
  })
})

describe('the footer (D50)', () => {
  it('links About, Terms, Privacy and the not-advice notice', () => {
    expect(FOOTER_LINKS.map((l) => l.href)).toEqual([
      LEGAL_PATHS.about, LEGAL_PATHS.terms, LEGAL_PATHS.privacy, LEGAL_PATHS.notAdvice,
    ])
  })

  it('every footer link has a page', () => {
    for (const l of FOOTER_LINKS) expect(pageFile(l.href), `${l.label} → ${l.href}`).not.toBeNull()
  })

  it('is rendered by every layout — the app, the sign-in page and About & Legal', () => {
    for (const layout of ['src/app/(dashboard)/layout.tsx', 'src/app/(auth)/layout.tsx', 'src/app/(legal)/layout.tsx']) {
      expect(read(layout), layout).toContain('<SiteFooter />')
    }
    // Guards the guard: every route group has a layout on that list.
    const groups = fs.readdirSync(APP).filter((d) => /^\(.+\)$/.test(d)).sort()
    expect(groups).toEqual(['(auth)', '(dashboard)', '(legal)'])
  })

  it('keeps the full legal text out of the code that runs in the browser', () => {
    // The footer, the paid-link tag and the staking page ship to every visitor's
    // browser; importing disclosures.ts there would ship the whole Terms and
    // Privacy Policy with them. They read lib/legal/links.ts instead.
    for (const f of [
      'src/components/layout/SiteFooter.tsx', 'src/components/ui/SponsoredLink.tsx',
      'src/app/(dashboard)/staking/page.tsx', 'src/app/(dashboard)/layout.tsx', 'src/app/(auth)/layout.tsx',
    ]) {
      expect(read(f), f).not.toMatch(/lib\/legal\/disclosures['"]/)
    }
  })

  it('leads to pages a signed-out visitor can open — outside the dashboard sign-in gate', () => {
    for (const l of FOOTER_LINKS) expect(pageFile(l.href)).toContain(`${path.sep}(legal)${path.sep}`)
    // Code only: the layout's comment explains the gate, by name, on purpose.
    const code = read('src/app/(legal)/layout.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/useSession|REQUIRE_AUTH|redirect\(/)
    // Guards the guard: the dashboard layout, which IS gated, fails the same check.
    const gated = read('src/app/(dashboard)/layout.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(gated).toMatch(/useSession|REQUIRE_AUTH/)
  })
})

describe('links inside the text', () => {
  it('every internal link reaches a page, and every anchor a section on it', () => {
    const broken: string[] = []
    for (const page of PAGES) {
      for (const s of page.strings) {
        for (const t of parseInline(s)) {
          if (t.kind !== 'link' || t.href.startsWith('http')) continue
          const [target, anchor] = t.href.split('#')
          const targetPath = target === '' ? page.path : target
          if (!pageFile(targetPath)) { broken.push(`${page.path}: ${t.href} (no page)`); continue }
          if (anchor) {
            const ids = PAGES.find((p) => p.path === targetPath)?.ids
            if (!ids?.includes(anchor)) broken.push(`${page.path}: ${t.href} (no section "${anchor}")`)
          }
        }
      }
    }
    expect(broken).toEqual([])
  })

  it('section anchors are unique on each page', () => {
    for (const page of PAGES) expect(new Set(page.ids).size, page.path).toBe(page.ids.length)
  })

  it('anchors drop the section number and keep the words', () => {
    expect(sectionId('12. No warranties')).toBe('no-warranties')
    expect(sectionId("7. What we don't do")).toBe('what-we-don-t-do')
    expect(sectionId('Questions & complaints')).toBe('questions-and-complaints')
  })
})

describe('the old How We Make Money address', () => {
  it('redirects to its section of the About page', () => {
    const config = read('next.config.mjs')
    expect(config).toContain(`{ source: '/how-we-make-money', destination: '${HOW_WE_MAKE_MONEY_HREF}', permanent: false }`)
    expect(ABOUT_PAGE.sections.map((s) => s.id)).toContain(HOW_WE_MAKE_MONEY_HREF.split('#')[1])
    expect(pageFile('/how-we-make-money'), 'the old page should be gone, not shadowing the redirect').toBeNull()
  })

  it('nothing in the app links the old address any more', () => {
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) { if (e.name !== '__tests__') walk(full); continue }
        if (!/\.(ts|tsx)$/.test(e.name)) continue
        if (/['"`]\/how-we-make-money['"`]/.test(fs.readFileSync(full, 'utf8'))) hits.push(path.relative(ROOT, full))
      }
    }
    walk(path.join(ROOT, 'src'))
    expect(hits).toEqual([])
  })
})

describe('only public text is published', () => {
  it('carries none of the working notes around the draft', () => {
    // The draft's tabs mix public text with notes for the owner and the build
    // ("Internal notes (not for publishing)", decision and item numbers). None
    // of that belongs on a page a visitor reads.
    const leaks = allPublishedText().filter((t) =>
      /\b(T-\d{3}|NC-\d{3}|D\d{1,2})\b|build chat|Read me first|not for publishing|Internal notes/i.test(t))
    expect(leaks).toEqual([])
  })
})
