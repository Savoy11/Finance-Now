import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
// Plain ESM script module; tsc types it from its JSDoc, so no declaration file is needed.
import { runChecks, parseRegistry, STATUSES, ROLES } from '../../../../scripts/lib/queueLedgerChecks.mjs'

/**
 * `npm run queue:check` (scripts/check-queue-ledger.mjs) exists because three times
 * in one month finished work never reached the ledger. A guard that has only ever
 * been seen green proves nothing — see verify-guards-by-mutating-the-source — so
 * every check here is driven RED by a named mutation of a clean fixture, and the
 * clean fixture itself is asserted fully green first. The real ledger then runs as
 * an integration case: zero `fail` findings on main is the contract CI enforces.
 */

type Item = Record<string, any>
type Ledger = { counts: Record<string, any>; outstanding: Item[] }

const REGISTRY = `
  {
    domain: 'verified.example',
    verdict: 'conditional',
    reviewedAt: '2026-09-14',
    review: 'verified',
  },
  {
    domain: 'seeded.example',
    verdict: 'conditional',
    reviewedAt: '2026-08-06',
    review: 'seeded',
  },
`

function item(id: string, status: string, extra: Item = {}): Item {
  return {
    id, status, title: `${id} title`, owner_role: 'remote-dev', category: 'process', effort: 'small',
    summary: 'summary', next_action: 'next', related_ids: [], sources: [], blocking_decision: null,
    ...extra,
  }
}
const closure = (extra: Item = {}) => ({ closed_on: '2026-09-19', verdict: 'close', basis: 'verified-here', reason: 'done', evidence: ['docs/present.md'], ...extra })

/** A ledger every check passes on. Counts are derived so the fixture cannot drift. */
function clean(): Ledger {
  const outstanding = [
    item('T-001', 'open'),
    item('T-002', 'blocked', { blocking_decision: 'Owner: something', owner_role: 'owner-decision' }),
    item('T-003', 'closed', { closure: closure() }),
    item('T-004', 'parked'),
    item('T-005', 'unclear'),
    item('T-006', 'closed', { closure: closure({ evidence: ['docs/present.md — the section'] }), related_ids: ['T-001'] }),
  ]
  const by = (k: string) => outstanding.reduce((t: Record<string, number>, i) => ((t[i[k]] = (t[i[k]] ?? 0) + 1), t), {})
  return {
    counts: { by_status: by('status'), by_owner_role: by('owner_role'), total: outstanding.length, outstanding: outstanding.length, closed_by_annotation: 2 },
    outstanding,
  }
}
const exists = (p: string) => p === 'docs/present.md'
const run = (l: Ledger) => runChecks(l, { registrySource: REGISTRY, exists })
const findings = (l: Ledger, id: string) => run(l).checks.find((c: any) => c.id === id)!.findings as string[]

describe('queue ledger checks — clean fixture', () => {
  it('passes every check', () => {
    const r = run(clean())
    expect(r.checks.map((c: any) => c.id)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12'])
    for (const c of r.checks) expect(c.findings, c.id).toEqual([])
    expect(r.fails + r.warns + r.reviews).toBe(0)
  })

  it('parses the registry into host → review state', () => {
    const h = parseRegistry(REGISTRY)
    expect(h.get('verified.example')).toEqual({ review: 'verified', verdict: 'conditional', reviewedAt: '2026-09-14' })
    expect(h.get('seeded.example')?.review).toBe('seeded')
  })
})

describe('queue ledger checks — each check goes red under its mutation', () => {
  it('C1: a recorded status count that disagrees with the items', () => {
    const l = clean(); l.counts.by_status.open = 9
    expect(findings(l, 'C1')).toEqual(['open: recorded 9, actual 1'])
  })
  it('C2: a recorded owner-role count that disagrees', () => {
    const l = clean(); l.counts.by_owner_role['remote-dev'] += 1
    expect(findings(l, 'C2')).toHaveLength(1)
  })
  it('C3: total, outstanding and closed_by_annotation each checked', () => {
    const l = clean(); l.counts.total = 99; l.counts.outstanding = 98; l.counts.closed_by_annotation = 97
    expect(findings(l, 'C3')).toHaveLength(3)
  })
  it('C4: a closed item with no closure block', () => {
    const l = clean(); delete l.outstanding[2].closure
    expect(findings(l, 'C4')).toEqual(['T-003 — T-003 title'])
  })
  it('C5: missing verdict, string evidence, and a closure on a non-closed item', () => {
    const l = clean()
    delete l.outstanding[2].closure.verdict
    l.outstanding[5].closure.evidence = 'docs/present.md'
    l.outstanding[0].closure = closure(); // open item carrying a closure
    const f = findings(l, 'C5')
    expect(f).toContain('T-003 — missing verdict')
    expect(f).toContain('T-006 — evidence is a bare string, not an array')
    expect(f).toContain("T-001 — has a closure block but status is 'open'")
  })
  it('C6: blocked with no blocker — the half-applied-pass shape', () => {
    const l = clean(); l.outstanding[1].blocking_decision = null
    expect(findings(l, 'C6')).toEqual(['T-002 — T-002 title'])
  })
  it('C7: a blocker citing an item that has closed', () => {
    const l = clean(); l.outstanding[1].blocking_decision = 'Waits on T-003 landing'
    expect(findings(l, 'C7')).toEqual(['T-002 — blocker cites T-003, now closed'])
  })
  it('C8: an open item citing a verified host is flagged; a seeded host is not', () => {
    const l = clean()
    l.outstanding[0].title = 'Read verified.example terms'
    l.outstanding[3].title = 'Read seeded.example terms'   // parked — not scanned
    l.outstanding[1].summary = 'about seeded.example'      // blocked but seeded — not flagged
    expect(findings(l, 'C8')).toEqual(['T-001 [open] — cites verified.example, verified 2026-09-14 (conditional)'])
  })
  it('C8 without a registry is silent rather than wrong', () => {
    const l = clean(); l.outstanding[0].title = 'Read verified.example terms'
    expect(runChecks(l, { exists }).checks.find((c: any) => c.id === 'C8').findings).toEqual([])
  })
  it('C9: evidence naming a file that does not exist; descriptions are not paths', () => {
    const l = clean()
    l.outstanding[2].closure.evidence = ['docs/gone.md', 'a prose description with no path']
    expect(findings(l, 'C9')).toEqual(['T-003 — docs/gone.md'])
  })
  it('C10: a related id that points nowhere', () => {
    const l = clean(); l.outstanding[0].related_ids = ['T-999']
    expect(findings(l, 'C10')).toEqual(['T-001 → T-999'])
  })
  it('C11: a duplicated id', () => {
    const l = clean(); l.outstanding.push(item('T-001', 'open'))
    expect(findings(l, 'C11')).toEqual(['T-001 × 2'])
  })
  it('C12: a status or role outside the vocabulary', () => {
    const l = clean(); l.outstanding[0].status = 'done'; l.outstanding[3].owner_role = 'someone'
    expect(findings(l, 'C12')).toHaveLength(2)
  })
  it('severity totals count findings, not checks', () => {
    const l = clean(); l.counts.total = 1; l.counts.outstanding = 1; l.outstanding[1].blocking_decision = null
    const r = run(l)
    expect(r.fails).toBe(3) // two C3 findings + one C6
    expect(r.warns).toBe(0)
  })
})

describe('queue ledger checks — the real ledger', () => {
  const ROOT = path.resolve(process.cwd(), '..')
  const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/audits/task-queue-2026-09-07.json'), 'utf8'))
  const registrySource = fs.readFileSync(path.join(process.cwd(), 'src/lib/server/sourceTerms.ts'), 'utf8')

  it('has zero failing findings — the contract CI enforces', () => {
    const r = runChecks(ledger, { registrySource, exists: (p: string) => fs.existsSync(path.join(ROOT, p)) })
    const failing = r.checks.filter((c: any) => c.severity === 'fail' && c.findings.length)
    expect(failing.map((c: any) => `${c.id}: ${c.findings.join('; ')}`)).toEqual([])
  })

  it('uses only the status and role vocabulary the page renders', () => {
    for (const i of ledger.outstanding) {
      expect(STATUSES, i.id).toContain(i.status)
      expect(ROLES, i.id).toContain(i.owner_role)
    }
  })
})
