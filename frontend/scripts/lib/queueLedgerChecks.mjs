// Integrity checks over the task-queue ledger (docs/audits/task-queue-2026-09-07.json).
// Pure: takes the parsed ledger, the source-terms registry SOURCE, and an injectable
// `exists`, so the checks are testable against fixtures and can be shown to go red.
//
// Why this exists. Three times in September 2026 work was finished and the ledger never
// learned: a closure review verified 62 items and recommended approving all 62 with no
// write; a decision pass nulled two blockers and left their statuses `blocked`; sixteen
// terms items described readings finished days earlier. Verification, approval and the
// write are separate acts, and nothing connected them. Two of those shapes are
// mechanical — C6 and C8 below — and every one of the others is a header count that
// nobody recomputed. This file is the connection.
//
// Severities. `fail` exits the CLI non-zero and is for facts the ledger states about
// itself that are simply false (a count, a total, a missing block). `warn` is real but
// needs a human (a blocker whose cited item has closed may be only half-satisfied).
// `review` is a prompt, never a verdict: C8 flags an open item citing a verified host,
// and T-243 legitimately wants MORE than its entry has.

export const STATUSES = ['open', 'blocked', 'unclear', 'parked', 'closed']
export const ROLES = ['owner-decision', 'owner-machine', 'either', 'remote-dev']

/** Older closures record evidence as a bare string; normalise for reading. */
export const evidenceOf = (closure) =>
  closure?.evidence == null ? [] : Array.isArray(closure.evidence) ? closure.evidence : [closure.evidence]

/** host → { review, verdict, reviewedAt } from sourceTerms.ts source text. */
export function parseRegistry(src) {
  const hosts = new Map()
  const doms = [...src.matchAll(/domain: '([^']+)'/g)].map((m) => ({ d: m[1], i: m.index }))
  doms.forEach((x, k) => {
    const blk = src.slice(x.i, doms[k + 1] ? doms[k + 1].i : src.length)
    const pick = (re) => (blk.match(re) || [, '?'])[1]
    hosts.set(x.d, { review: pick(/review: '([a-z]+)'/), verdict: pick(/verdict: '([a-z]+)'/), reviewedAt: pick(/reviewedAt: '([0-9-]+)'/) })
  })
  return hosts
}

// A bare repo-relative file path, as opposed to a description that merely mentions one.
const PATH_RE = /^[\w.-]+(\/[\w.\-\[\]()]+)+\.[a-z]+$/i

/**
 * @param {{ outstanding: any[], counts?: Record<string, any> }} ledger  parsed task-queue JSON
 * @param {{ registrySource?: string, exists?: (repoRelativePath: string) => boolean }} [opts]
 *   `registrySource` is the text of sourceTerms.ts (C8 is silent without it);
 *   `exists` answers whether a repo-relative path is on disk (C9), injectable for tests.
 */
export function runChecks(ledger, { registrySource = '', exists = (_repoRelativePath) => true } = {}) {
  const items = ledger.outstanding
  const byId = new Map(items.map((i) => [i.id, i]))
  const counts = ledger.counts ?? {}
  const hosts = parseRegistry(registrySource)
  const checks = []
  const check = (id, name, severity, why, findings) => checks.push({ id, name, severity, why, findings })
  const tally = (k) => { const t = {}; for (const i of items) t[i[k]] = (t[i[k]] ?? 0) + 1; return t }
  const diff = (recorded, actual) => {
    const f = []
    for (const k of new Set([...Object.keys(actual), ...Object.keys(recorded ?? {})]))
      if ((actual[k] ?? 0) !== (recorded?.[k] ?? 0)) f.push(`${k}: recorded ${recorded?.[k] ?? 0}, actual ${actual[k] ?? 0}`)
    return f
  }

  check('C1', 'Recorded status counts match the items', 'fail',
    'These drifted to open:159/closed:15 against an actual 134/40 once, reading as current while two weeks stale.',
    diff(counts.by_status, tally('status')))

  check('C2', 'Recorded owner-role counts match the items', 'fail',
    'Nothing recomputed this block from generation until 2026-09-23, when it summed to 338 of 348.',
    diff(counts.by_owner_role, tally('owner_role')))

  {
    const f = []
    const withClosure = items.filter((i) => i.closure).length
    if (counts.total !== items.length) f.push(`counts.total = ${counts.total}, items = ${items.length}`)
    if (counts.outstanding !== items.length) f.push(`counts.outstanding = ${counts.outstanding}, items = ${items.length}`)
    if (counts.closed_by_annotation !== withClosure) f.push(`counts.closed_by_annotation = ${counts.closed_by_annotation}, items with a closure block = ${withClosure}`)
    check('C3', 'Recorded totals match the item count', 'fail',
      'A total that disagrees with the array length means an item was added or removed without the header learning.', f)
  }

  check('C4', 'Every closed item carries a closure block', 'fail',
    'A closed status with no record of why, when or on what evidence is a status nobody can audit.',
    items.filter((i) => i.status === 'closed' && !i.closure).map((i) => `${i.id} — ${i.title}`))

  {
    const f = []
    for (const i of items.filter((i) => i.closure)) {
      const c = i.closure
      const miss = ['closed_on', 'verdict', 'evidence'].filter((k) => c[k] == null || (Array.isArray(c[k]) && !c[k].length))
      if (miss.length) f.push(`${i.id} — missing ${miss.join(', ')}`)
      if (typeof c.evidence === 'string') f.push(`${i.id} — evidence is a bare string, not an array`)
      if (i.status !== 'closed') f.push(`${i.id} — has a closure block but status is '${i.status}'`)
    }
    check('C5', 'Closure blocks are complete (closed_on, verdict, evidence)', 'warn',
      'A closure without a verdict cannot tell close from moot from superseded from already-done.', f)
  }

  check('C6', 'Every blocked item names what blocks it', 'fail',
    'Two items sat at status blocked with blocking_decision null after a half-applied decision pass on 2026-09-23.',
    items.filter((i) => i.status === 'blocked' && !i.blocking_decision).map((i) => `${i.id} — ${i.title}`))

  {
    const f = []
    for (const i of items.filter((i) => i.status === 'blocked' && i.blocking_decision)) {
      const cited = [...new Set(i.blocking_decision.match(/T-\d{3}/g) || [])].filter((id) => id !== i.id)
      const closed = cited.filter((id) => byId.get(id)?.status === 'closed')
      if (closed.length) f.push(`${i.id} — blocker cites ${closed.join(', ')}, now closed`)
    }
    check('C7', 'No blocker cites an item that has since closed', 'warn',
      'The blocker may be only partly satisfied — review, do not auto-clear. History belongs in progress, not in the blocker.', f)
  }

  {
    const f = []
    if (hosts.size) {
      const hostRe = new RegExp('\\b(' + [...hosts.keys()].map((h) => h.replace(/\./g, '\\.')).join('|') + ')\\b', 'i')
      for (const i of items.filter((i) => i.status === 'open' || i.status === 'blocked')) {
        const m = `${i.title} ${i.next_action} ${i.summary}`.match(hostRe)
        if (!m) continue
        const r = hosts.get(m[1].toLowerCase())
        if (r?.review === 'verified') f.push(`${i.id} [${i.status}] — cites ${m[1].toLowerCase()}, verified ${r.reviewedAt} (${r.verdict})`)
      }
    }
    check('C8', 'Open items citing a source-terms host whose entry is already verified', 'review',
      'Sixteen items described readings finished on 2026-09-14/20 and no ledger row learned. A hit is a prompt to read the ask, not proof it is done.', f)
  }

  {
    const f = []
    const seen = new Set()
    for (const i of items.filter((i) => i.closure)) {
      for (const e of evidenceOf(i.closure)) {
        const p = String(e).split(' — ')[0].split(' (')[0].trim()
        if (!PATH_RE.test(p) || seen.has(p)) continue
        seen.add(p)
        if (!exists(p)) f.push(`${i.id} — ${p}`)
      }
    }
    check('C9', 'Closure evidence files exist on disk', 'fail', 'A closure whose evidence file is gone is a closure on nothing.', f)
  }

  {
    const f = []
    for (const i of items) for (const r of i.related_ids || []) if (/^T-\d{3}$/.test(r) && !byId.has(r)) f.push(`${i.id} → ${r}`)
    check('C10', 'Related ids point at real items', 'warn', 'A dangling reference is usually a renumbered or never-filed item.', f)
  }

  {
    const seen = new Map()
    for (const i of items) seen.set(i.id, (seen.get(i.id) ?? 0) + 1)
    check('C11', 'Item ids are unique', 'fail', 'Three ids were nearly reused for new items on 2026-09-23; a duplicate makes both unaddressable.',
      [...seen].filter(([, n]) => n > 1).map(([id, n]) => `${id} × ${n}`))
  }

  check('C12', 'Status and owner-role values are from the known set', 'fail',
    'A misspelled status silently drops an item from every filter and count.',
    items.filter((i) => !STATUSES.includes(i.status) || !ROLES.includes(i.owner_role)).map((i) => `${i.id} — status '${i.status}', role '${i.owner_role}'`))

  const count = (sev) => checks.filter((c) => c.severity === sev).reduce((n, c) => n + c.findings.length, 0)
  return { checks, fails: count('fail'), warns: count('warn'), reviews: count('review') }
}
