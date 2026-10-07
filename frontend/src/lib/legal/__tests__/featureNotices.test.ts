import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FEATURE_NOTICES, FEATURE_NOTICES_SOURCE, type FeatureNoticeId } from '../featureNotices'
import { DISCLOSURE_SOURCE, allPublishedText } from '../disclosures'
import { MODULES, type ModuleId } from '@/lib/modules/registry'
import { ModuleGate } from '@/components/layout/ModuleGate'
import { useEntitlementStore } from '@/store/useEntitlementStore'

// T-293: the disclosure draft's short not-advice lines, beside the features
// they qualify. These tests hold the placement, the words and the source.

const ROOT = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

/**
 * Where each line is rendered. The draft's "Where" column names the feature;
 * these are the files that show it. Moving a line means moving it here too.
 * The crypto line is not here: the registry carries it (see below).
 */
const PLACEMENTS: Record<FeatureNoticeId, string[]> = {
  portfolioBuilder: ['src/app/(dashboard)/portfolio-builder/page.tsx'],
  calculators: [
    'src/app/(dashboard)/equities/options/page.tsx', // Trade Risk Scorer — switched off (D64), kept for its return
    'src/app/(dashboard)/funds/[symbol]/page.tsx', // Fee Drag Analyzer
    'src/components/markets/TaxEquivalentYieldCard.tsx',
  ],
  aiAnswers: [
    'src/components/agents/AssistantWidget.tsx',
    'src/app/(dashboard)/research/page.tsx',
    'src/app/(dashboard)/brief/page.tsx',
    'src/components/markets/AgentScanPanel.tsx', // the AI scans on the stock and macro scanners
  ],
  pumpReport: [
    'src/app/(dashboard)/pump-report/page.tsx',
    'src/app/(dashboard)/assets/[id]/page.tsx', // the coin page's Pump Report tab
  ],
  crypto: [],
  videoAnswers: ['src/components/videos/VideoAskDialog.tsx'],
}

/** Every .ts/.tsx file under src, tests excluded. */
function sourceFiles(dir = path.join(ROOT, 'src')): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name !== '__tests__') out.push(...sourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      out.push(full)
    }
  }
  return out
}

describe('the words', () => {
  it('come from the revision of the Not Investment Advice tab that disclosures.ts records', () => {
    // Re-copying that tab at a new revision fails here until these lines are
    // checked against it too: a document copied in two places at two revisions
    // stops being one document.
    expect(FEATURE_NOTICES_SOURCE.document).toBe(DISCLOSURE_SOURCE.document)
    expect(FEATURE_NOTICES_SOURCE.revision).toBe(DISCLOSURE_SOURCE.revisions[FEATURE_NOTICES_SOURCE.tab])
  })

  it('are part of the published set, so the blank and working-note checks read them', () => {
    const published = allPublishedText()
    for (const line of Object.values(FEATURE_NOTICES)) expect(published).toContain(line)
  })

  it('are written out in one file only', () => {
    // A line pasted into a page instead of rendered through FeatureNotice
    // would stop following the owner's document the next time it changes.
    // disclosures.ts is the one exception: the full notice's "Data and risk"
    // paragraph contains the crypto sentence itself.
    const home = new Set(['featureNotices.ts', 'disclosures.ts'].map((f) => path.join(ROOT, 'src/lib/legal', f)))
    const copies: string[] = []
    for (const f of sourceFiles()) {
      if (home.has(f)) continue
      const text = fs.readFileSync(f, 'utf8')
      for (const line of Object.values(FEATURE_NOTICES)) {
        if (text.includes(line)) copies.push(`${path.relative(ROOT, f)}: "${line.slice(0, 40)}…"`)
      }
    }
    expect(copies).toEqual([])
  })

  it('stay browser-safe: the file imports nothing, so a page showing one ships no legal text', () => {
    expect(read('src/lib/legal/featureNotices.ts')).not.toMatch(/^import /m)
    expect(read('src/components/legal/FeatureNotice.tsx')).not.toMatch(/lib\/legal\/disclosures['"]/)
  })
})

describe('the placement', () => {
  it('puts every line beside the features its row names', () => {
    for (const [id, files] of Object.entries(PLACEMENTS)) {
      for (const f of files) expect(read(f), `${f} must show the ${id} line`).toContain(`<FeatureNotice feature="${id}"`)
    }
  })

  it('shows each line only where this file lists it', () => {
    const found: string[] = []
    for (const f of sourceFiles()) {
      // PLACEMENTS uses forward slashes; Windows paths come back with
      // backslashes, which made this test fail on the owner's machine only.
      const rel = path.relative(ROOT, f).split(path.sep).join('/')
      for (const m of fs.readFileSync(f, 'utf8').matchAll(/<FeatureNotice feature="(\w+)"/g)) {
        const listed = PLACEMENTS[m[1] as FeatureNoticeId] ?? []
        if (!listed.includes(rel)) found.push(`${rel} → ${m[1]}`)
      }
    }
    expect(found).toEqual([])
  })

  it('leaves no line unplaced', () => {
    const viaRegistry = new Set(MODULES.map((m) => m.pageNotice).filter(Boolean))
    for (const id of Object.keys(FEATURE_NOTICES) as FeatureNoticeId[]) {
      expect(PLACEMENTS[id].length > 0 || viaRegistry.has(id), `${id} is shown nowhere`).toBe(true)
    }
  })

  it('replaced the older lines that said the same thing', () => {
    // The tab: "They replace or sit alongside the lines some pages already
    // carry." Where an old line only repeated the new one, it went.
    const retired: Array<[string, string]> = [
      ['src/app/(dashboard)/portfolio-builder/page.tsx', 'Educational tooling'],
      ['src/app/(dashboard)/brief/page.tsx', 'Informational synthesis of live data'],
      // Two lines that both opened "Answered by" read as a stutter.
      ['src/components/videos/VideoAskDialog.tsx', 'Answered by {result.provider'],
    ]
    for (const [f, phrase] of retired) expect(read(f), f).not.toContain(phrase)
  })
})

type GateProps = ComponentProps<typeof ModuleGate>

describe('the crypto line, on every crypto page', () => {
  afterEach(() => useEntitlementStore.getState().setEnabled('crypto', true))

  // The props cast only satisfies createElement's typing: the children arrive
  // as its third argument, which is how the page files pass them too.
  const page = (module: ModuleId) =>
    renderToStaticMarkup(createElement(ModuleGate, { module } as GateProps, createElement('main', null, 'page')))

  it('is the crypto module’s page notice, and only the crypto module has one', () => {
    expect(MODULES.filter((m) => m.pageNotice).map((m) => [m.id, m.pageNotice])).toEqual([['crypto', 'crypto']])
  })

  it('appears under a crypto page, after its content', () => {
    const html = page('crypto')
    expect(html).toContain(FEATURE_NOTICES.crypto)
    expect(html.indexOf('page')).toBeLessThan(html.indexOf(FEATURE_NOTICES.crypto))
  })

  it('does not appear on another module’s page', () => {
    expect(page('equities')).not.toContain(FEATURE_NOTICES.crypto)
  })

  it('does not appear over the lock notice of a switched-off module', () => {
    useEntitlementStore.getState().setEnabled('crypto', false)
    const html = page('crypto')
    expect(html).toContain('module is disabled')
    expect(html).not.toContain(FEATURE_NOTICES.crypto)
  })

  it('reaches every crypto page, because every one of them is wrapped in the crypto gate', () => {
    // Guards the guard: the line arrives through ModuleGate, so a crypto page
    // rendered without it would carry no line and no lock either.
    const crypto = MODULES.find((m) => m.id === 'crypto')!
    const app = path.join(ROOT, 'src/app/(dashboard)')
    const pages = crypto.routePrefixes.flatMap((prefix) => {
      const dir = path.join(app, prefix)
      return fs.existsSync(dir) ? sourceFiles(dir).filter((f) => f.endsWith('page.tsx')) : []
    })
    expect(pages.length).toBeGreaterThan(5)
    for (const f of pages) expect(fs.readFileSync(f, 'utf8'), path.relative(ROOT, f)).toContain('<ModuleGate module="crypto">')
  })
})
