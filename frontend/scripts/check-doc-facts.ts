/**
 * Documentation fact check — `npm run docs:check`.
 *
 * WHY THIS EXISTS. CLAUDE.md's own rule is "if code can compute a number, the string
 * must not contain it" — but that rule can only be *followed* in code, where the count
 * is interpolated at render time. Markdown has no render step, so the numbers get typed,
 * and typed numbers are correct exactly once: the day they are written.
 *
 * The 2026-09-19 accuracy sweep measured the cost. Of 66 corrections across 18 working
 * documents, roughly ten were stale counts that had each been true when written:
 *
 *     CLAUDE.md   "59 routes"                 → 58
 *     CLAUDE.md   "54 of 56 ... seeded"       → 38 of 56 (ratification took verified 4 → 18)
 *     README.md   "30 exchanges"              → 29 (Poloniex removed on TERMS)
 *     ROADMAP.md  "46 macro instruments"      → 45 (DXY counted twice)
 *     dataSources "18 parallel upstreams"     → 7
 *
 * None of those were caught by a test, a lint or CI. They were caught by a 21-agent
 * sweep, months after the fact, and only because someone went looking.
 *
 * WHAT THIS DOES. Each FACT below names a number the tree can compute and the places a
 * document asserts it. The check recomputes from the tree and compares. This is the same
 * shape as the DATA-SOURCES.md gate already in ci.yml — the only document currently under
 * mechanical enforcement — extended to counts that live in prose rather than in a
 * generated table.
 *
 * ⚠ ANTI-VACUITY IS THE WHOLE DESIGN. A guard keyed on a regex fails open the moment
 * someone rewords the sentence: the pattern stops matching, nothing compares, and the
 * check goes green while the claim rots. So a pattern that matches ZERO times is a
 * FAILURE here, not a pass. If you reword a sentence this file watches, you must update
 * the pattern — that is the point, not an inconvenience. `--list` prints what is watched.
 *
 * WHAT IS DELIBERATELY NOT WATCHED. Counts that move on every PR — test totals, lint
 * warning counts — are baselines to re-measure, not invariants to gate. Gating on them
 * would make the first action after any change be to edit this file, which trains people
 * to treat it as noise. docs/agents/code-checker.md carries those, dated, by hand.
 */

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { SOURCE_TERMS } from '../src/lib/server/sourceTerms'
import { EXCHANGES, COIN_INFO, NETWORKS } from '../src/lib/data/transferFees'
import { FUND_CATALOG } from '../src/lib/data/fundCatalog'
import { EQUITY_CATALOG } from '../src/lib/data/equityCatalog'
import { STAKING_PROVIDERS } from '../src/lib/data/stakingProviders'
import { OPTIONAL_MODULES } from '../src/lib/modules/registry'
import { COMMODITY_CATALOG } from '../src/lib/data/commodityCatalog'
import { CURRENCY_CATALOG } from '../src/lib/data/currencyCatalog'
import { RATES_CATALOG } from '../src/lib/data/ratesCatalog'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(here, '..')
const repoRoot = path.resolve(frontendDir, '..')

const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8')

/** git-tracked, so an empty leftover directory (cbdc-data) is not counted. */
const trackedLiveDataRoutes = () =>
  execSync('git ls-files "frontend/src/app/live-data/**/route.ts"', { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').filter(Boolean).length

interface Assertion { file: string; pattern: RegExp; note?: string }
interface Fact { id: string; value: () => number; source: string; asserts: Assertion[] }

const FACTS: Fact[] = [
  {
    id: 'live-data-routes',
    value: trackedLiveDataRoutes,
    source: 'git ls-files frontend/src/app/live-data/**/route.ts',
    asserts: [
      { file: 'CLAUDE.md', pattern: /no API keys exposed\) — (\d+) routes/ },
      { file: 'DATA-AVAILABILITY.md', pattern: /all \*\*(\d+)\*\* route files comply/ },
    ],
  },
  {
    id: 'source-terms-total',
    value: () => SOURCE_TERMS.length,
    source: 'SOURCE_TERMS.length (lib/server/sourceTerms.ts)',
    asserts: [
      { file: 'CLAUDE.md', pattern: /\d+ of (\d+) registry entries are `seeded`/ },
      { file: 'docs/architecture/source-terms.md', pattern: /\*\*\d+ of (\d+) entries\*\*/ },
    ],
  },
  {
    id: 'source-terms-seeded',
    value: () => SOURCE_TERMS.filter((e) => e.review === 'seeded').length,
    source: "SOURCE_TERMS where review === 'seeded'",
    asserts: [
      { file: 'CLAUDE.md', pattern: /\*\*(\d+) of \d+ registry entries are `seeded`/ },
      { file: 'docs/architecture/source-terms.md', pattern: /\*\*(\d+) of \d+ entries\*\* are still starting positions/ },
    ],
  },
  {
    id: 'source-terms-verified',
    value: () => SOURCE_TERMS.filter((e) => e.review === 'verified').length,
    source: "SOURCE_TERMS where review === 'verified'",
    asserts: [
      { file: 'docs/architecture/source-terms.md', pattern: /\*\*(\d+) are `verified`\*\*/ },
    ],
  },
  {
    id: 'exchanges',
    value: () => EXCHANGES.length,
    source: 'EXCHANGES.length (lib/data/transferFees.ts)',
    asserts: [
      { file: 'CLAUDE.md', pattern: /\*\*`EXCHANGES`\*\* array — (\d+) exchanges/ },
      { file: 'README.md', pattern: /(\d+) exchanges × \d+ coins × \d+ networks/ },
    ],
  },
  {
    id: 'transfer-coins',
    value: () => Object.keys(COIN_INFO).length,
    source: 'Object.keys(COIN_INFO).length',
    asserts: [{ file: 'README.md', pattern: /\d+ exchanges × (\d+) coins × \d+ networks/ }],
  },
  {
    id: 'transfer-networks',
    value: () => Object.keys(NETWORKS).length,
    source: 'Object.keys(NETWORKS).length',
    asserts: [{ file: 'README.md', pattern: /\d+ exchanges × \d+ coins × (\d+) networks/ }],
  },
  {
    id: 'fund-catalog',
    value: () => FUND_CATALOG.length,
    source: 'FUND_CATALOG.length',
    asserts: [{ file: 'CLAUDE.md', pattern: /\*\*`FUND_CATALOG`\*\* — (\d+) funds/ }],
  },
  {
    id: 'equity-catalog',
    value: () => EQUITY_CATALOG.length,
    source: 'EQUITY_CATALOG.length',
    asserts: [{ file: 'CLAUDE.md', pattern: /\*\*`EQUITY_CATALOG`\*\* — (\d+) large-cap/ }],
  },
  {
    id: 'staking-providers',
    value: () => STAKING_PROVIDERS.length,
    source: 'STAKING_PROVIDERS.length',
    asserts: [{ file: 'CLAUDE.md', pattern: /\*\*`STAKING_PROVIDERS`\*\* array — (\d+) providers/ }],
  },
  {
    id: 'optional-modules',
    value: () => OPTIONAL_MODULES.length,
    source: 'OPTIONAL_MODULES.length (lib/modules/registry.ts)',
    asserts: [{ file: 'CLAUDE.md', pattern: /plus \*\*(\w+)\*\* optional modules/, note: 'spelled as a word' }],
  },
  {
    id: 'macro-instruments',
    value: () => COMMODITY_CATALOG.length + CURRENCY_CATALOG.length + RATES_CATALOG.length,
    source: 'COMMODITY + CURRENCY + RATES catalogs',
    asserts: [{ file: 'CLAUDE.md', pattern: /all (\d+) macro instruments/ }],
  },
]

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
const toNumber = (s: string) => (s in WORDS ? WORDS[s] : Number(s))

// ─── Fact check ──────────────────────────────────────────────────────────────

function checkFacts(): string[] {
  const problems: string[] = []
  for (const fact of FACTS) {
    const actual = fact.value()
    for (const a of fact.asserts) {
      let text: string
      try { text = read(a.file) } catch { problems.push(`${fact.id}: cannot read ${a.file}`); continue }

      const matches = [...text.matchAll(new RegExp(a.pattern, 'g'))]
      if (matches.length === 0) {
        // ANTI-VACUITY. A silent no-match is how this whole class of guard dies.
        problems.push(
          `${fact.id}: pattern no longer matches anything in ${a.file}\n` +
          `      pattern: ${a.pattern}\n` +
          `      The sentence was reworded or removed. Update the pattern in\n` +
          `      frontend/scripts/check-doc-facts.ts — do NOT delete the fact.`,
        )
        continue
      }
      for (const m of matches) {
        const claimed = toNumber(m[1])
        if (claimed !== actual) {
          problems.push(
            `${fact.id}: ${a.file} says ${m[1]}, tree says ${actual}\n` +
            `      source of truth: ${fact.source}\n` +
            `      context: …${m[0].slice(0, 70)}…`,
          )
        }
      }
    }
  }
  return problems
}

// ─── CLAUDE.md directory-tree check ──────────────────────────────────────────
//
// The tree is a claim about what exists RIGHT NOW, which makes it checkable with
// almost no false positives — unlike prose, which legitimately names deleted files
// (`exchangeCredentials.ts`, `riskScores.ts`) precisely to record their removal.
// A file listed in the tree and absent from disk is simply wrong: that is how
// `staking-discovery/page.tsx` survived in it for a month after the page was merged away.

function checkTree(): string[] {
  const text = read('CLAUDE.md')
  const block = text.match(/## Directory Structure\s*\n+```[a-z]*\n([\s\S]*?)```/)
  if (!block) return ['directory tree: the fenced block under "## Directory Structure" was not found — the tree check is now vacuous']

  const problems: string[] = []
  const stack: string[] = []
  let checked = 0

  for (const raw of block[1].split('\n')) {
    const line = raw.replace(/\r$/, '')
    const m = line.match(/^([│\s]*)(?:├──|└──)\s*(\S+)/)
    if (!m) continue
    const depth = Math.floor(m[1].length / 4)
    let name = m[2]
    if (name.startsWith('#')) continue            // a comment row, not an entry

    const isDir = name.endsWith('/')
    name = name.replace(/\/$/, '')
    stack.length = depth
    stack[depth] = name

    if (isDir || !/\.[a-z]+$/i.test(name)) continue   // only leaf FILES are checked
    const rel = path.join('frontend/src', ...stack.slice(0, depth), name)
    checked++
    if (!fs.existsSync(path.join(repoRoot, rel))) problems.push(`directory tree: CLAUDE.md lists ${rel} — no such file`)
  }

  if (checked === 0) problems.push('directory tree: parsed 0 file entries — the parser no longer understands the tree, so this check proves nothing')
  return problems
}

// ─── main ────────────────────────────────────────────────────────────────────

if (process.argv.includes('--list')) {
  console.log('Facts under guard:\n')
  for (const f of FACTS) {
    console.log(`  ${f.id.padEnd(22)} = ${f.value()}   ← ${f.source}`)
    for (const a of f.asserts) console.log(`      asserted in ${a.file}`)
  }
  process.exit(0)
}

const problems = [...checkFacts(), ...checkTree()]

if (problems.length === 0) {
  const n = FACTS.reduce((acc, f) => acc + f.asserts.length, 0)
  console.log(`✓ docs:check — ${n} documented counts match the tree, and every file in CLAUDE.md's directory tree exists.`)
  process.exit(0)
}

console.error(`\n✗ docs:check found ${problems.length} problem(s):\n`)
for (const p of problems) console.error(`  • ${p}\n`)
console.error('These are claims in working documents that the tree contradicts.')
console.error('Fix the document, or — if the document is right and this script is stale — fix the fact.\n')
process.exit(1)
