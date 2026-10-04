import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  evaluateAudit, listAdvisories, validateExceptions, fixState, isIsoDate, MAX_EXCEPTION_DAYS,
} from '../../../../scripts/lib/auditGate.mjs'

/**
 * D53 (2026-10-03). The Security Scan's dependency audit fails on every high or critical
 * advisory, except one an owner decision allows for a dated window in audit-exceptions.json.
 * GHSA-vfj7-8cjw-p6xm (braces <= 3.0.3) has no patched release and turned main and every PR
 * red; these pin how narrow the way out is.
 */

const frontend = join(__dirname, '../../../..')
const repo = join(frontend, '..')

const BRACES_URL = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm'
const BREAKING = { name: 'tailwindcss', version: '4.3.3', isSemVerMajor: true }

/** An `npm audit --json` report shaped like the real one: braces, with micromatch inheriting. */
function bracesReport(fixAvailable: unknown = BREAKING, severity = 'high') {
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      braces: {
        name: 'braces', severity, isDirect: false, range: '*', fixAvailable,
        via: [{ source: 1240992, name: 'braces', dependency: 'braces', title: 'braces stack exhaustion', url: BRACES_URL, severity, range: '<=3.0.3' }],
      },
      micromatch: { name: 'micromatch', severity, isDirect: false, range: '>=0.2.0', fixAvailable: BREAKING, via: ['braces'] },
    },
    metadata: { vulnerabilities: { high: 2, total: 2 } },
  }
}

/** One more advisory on its own package, at any severity. */
function withAdvisory(report: ReturnType<typeof bracesReport>, pkg: string, ghsa: string, severity: string) {
  return {
    ...report,
    vulnerabilities: {
      ...report.vulnerabilities,
      [pkg]: {
        name: pkg, severity, isDirect: false, range: '*', fixAvailable: false,
        via: [{ source: 1, name: pkg, dependency: pkg, title: `${pkg} advisory`, url: `https://github.com/advisories/${ghsa}`, severity, range: '*' }],
      },
    },
  }
}

const DECISIONS = new Set(['D53'])
const EXCEPTION = {
  advisory: 'GHSA-vfj7-8cjw-p6xm', package: 'braces', decision: 'D53', decided: '2026-10-03', expires: '2026-11-03',
  reason: 'No patched braces release exists, and it only sees glob patterns written in this repo.',
}
const file = (...exceptions: unknown[]) => ({ exceptions })
const judge = (report: unknown, f: unknown, today = '2026-10-10') => evaluateAudit(report, f, { today, knownDecisions: DECISIONS })

describe('reading an npm audit report', () => {
  it('lists each advisory once, from the package it is on, not from the packages inheriting it', () => {
    const list = listAdvisories(bracesReport())
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: 'GHSA-vfj7-8cjw-p6xm', package: 'braces', severity: 'high', fix: 'breaking' })
  })

  it('reads the fix npm offers: none, a major upgrade only, or a plain `npm audit fix`', () => {
    expect(fixState(false)).toBe('none')
    expect(fixState(BREAKING)).toBe('breaking')
    expect(fixState(true)).toBe('available')
    expect(fixState({ name: 'braces', version: '3.0.4', isSemVerMajor: false })).toBe('available')
  })

  it('accepts only real calendar dates', () => {
    expect(isIsoDate('2026-11-03')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('3 Nov 2026')).toBe(false)
  })
})

describe('what blocks, exactly as `npm audit --audit-level=high` did', () => {
  it('passes a clean report', () => {
    expect(judge({ auditReportVersion: 2, vulnerabilities: {} }, file())).toMatchObject({ ok: true, blocking: [] })
  })

  it('blocks a high or critical advisory with no exception', () => {
    expect(judge(bracesReport(), file()).ok).toBe(false)
    expect(judge(bracesReport(BREAKING, 'critical'), file()).ok).toBe(false)
  })

  it('never blocks on low or moderate, the same threshold as before', () => {
    const report = withAdvisory(withAdvisory({ auditReportVersion: 2, vulnerabilities: {}, metadata: {} } as never, 'esbuild', 'GHSA-67mh-4wv8-2f99', 'moderate'), 'x', 'GHSA-aaaa-bbbb-cccc', 'low')
    expect(judge(report, file())).toMatchObject({ ok: true, blocking: [] })
  })

  it('is never a pass when npm produced no report', () => {
    for (const report of [null, {}, { error: { code: 'ENOTFOUND', summary: 'getaddrinfo ENOTFOUND registry.npmjs.org' } }]) {
      expect(judge(report, file(EXCEPTION))).toMatchObject({ ok: false, inconclusive: true })
    }
  })
})

describe('what an exception allows, and when it stops', () => {
  it('allows the advisory it names, through its expiry date', () => {
    const r = judge(bracesReport(), file(EXCEPTION), '2026-11-03')
    expect(r).toMatchObject({ ok: true, blocking: [] })
    expect(r.allowed.map((a) => a.id)).toEqual(['GHSA-vfj7-8cjw-p6xm'])
  })

  it('stops the day after it expires', () => {
    const r = judge(bracesReport(), file(EXCEPTION), '2026-11-04')
    expect(r.ok).toBe(false)
    expect(r.blocking[0].why).toMatch(/expired on 2026-11-03/)
  })

  it('stops as soon as npm offers a fix with no major upgrade, whatever the date', () => {
    for (const fix of [true, { name: 'braces', version: '3.0.4', isSemVerMajor: false }]) {
      const r = judge(bracesReport(fix), file(EXCEPTION))
      expect(r.ok).toBe(false)
      expect(r.blocking[0].why).toMatch(/npm audit fix/)
    }
  })

  it('covers only its own advisory: a second high advisory still blocks', () => {
    const r = judge(withAdvisory(bracesReport(), 'lodash', 'GHSA-1111-2222-3333', 'high'), file(EXCEPTION))
    expect(r.ok).toBe(false)
    expect(r.blocking.map((a) => a.id)).toEqual(['GHSA-1111-2222-3333'])
  })

  it('blocks when the advisory turns up on a different package than the exception names', () => {
    const r = judge(bracesReport(), file({ ...EXCEPTION, package: 'micromatch' }))
    expect(r.ok).toBe(false)
    expect(r.blocking[0].why).toMatch(/names micromatch/)
  })

  it('warns, without failing, as the expiry nears and once the advisory is gone', () => {
    expect(judge(bracesReport(), file(EXCEPTION), '2026-10-25').warnings.join(' ')).toMatch(/expires in 9 days/)
    const gone = judge({ auditReportVersion: 2, vulnerabilities: {} }, file(EXCEPTION))
    expect(gone.ok).toBe(true)
    expect(gone.warnings.join(' ')).toMatch(/no longer needed/)
  })
})

describe('an exception has to be a decision, not a convenience', () => {
  const problems = (e: unknown) => validateExceptions(file(e), DECISIONS).problems.join(' | ')

  it('cites a decision recorded under docs/decisions/', () => {
    expect(problems({ ...EXCEPTION, decision: 'D99' })).toMatch(/D99 is not recorded/)
    expect(problems({ ...EXCEPTION, decision: 'owner said so' })).toMatch(/must name an owner decision/)
  })

  it(`lasts at most ${MAX_EXCEPTION_DAYS} days from the day it was decided`, () => {
    expect(problems({ ...EXCEPTION, expires: '2027-12-31' })).toMatch(/at most 92 days/)
    expect(problems({ ...EXCEPTION, expires: '2026-10-01' })).toMatch(/must come after/)
  })

  it('names one advisory, once, with its package and a reason', () => {
    expect(problems({ ...EXCEPTION, advisory: 'braces' })).toMatch(/GHSA id/)
    expect(problems({ ...EXCEPTION, package: '' })).toMatch(/"package"/)
    expect(problems({ ...EXCEPTION, reason: 'n/a' })).toMatch(/"reason"/)
    expect(validateExceptions(file(EXCEPTION, EXCEPTION), DECISIONS).problems.join(' ')).toMatch(/listed twice/)
  })

  it('fails the whole check when the file is wrong, even with nothing to excuse', () => {
    expect(judge({ auditReportVersion: 2, vulnerabilities: {} }, file({ ...EXCEPTION, decision: 'D99' })).ok).toBe(false)
    expect(judge({ auditReportVersion: 2, vulnerabilities: {} }, {}).ok).toBe(false)
  })
})

describe('the repository as it stands', () => {
  /** Decision ids recorded as `| Dnn |` rows, the same way the script collects them. */
  const recorded = new Set<string>()
  const dir = join(repo, 'docs/decisions')
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
    for (const m of readFileSync(join(dir, name), 'utf8').matchAll(/^\|\s*(D\d+)\s*\|/gm)) recorded.add(m[1])
  }

  it('audit-exceptions.json is valid, and every entry cites a recorded decision', () => {
    const real = JSON.parse(readFileSync(join(frontend, 'audit-exceptions.json'), 'utf8'))
    expect(validateExceptions(real, recorded).problems).toEqual([])
  })

  it('CI runs the gate for frontend/ and still audits mcp-server/, with nothing that lets either fail quietly', () => {
    const ci = readFileSync(join(repo, '.github/workflows/ci.yml'), 'utf8')
    const step = ci.slice(ci.indexOf('- name: Node.js dependency audit'))
    const run = step.slice(0, step.indexOf('\n\n'))
    expect(run).toMatch(/cd frontend\n\s+node scripts\/check-dependency-audit\.mjs\n/)
    expect(run).toMatch(/cd \.\.\/mcp-server\n\s+npm audit --audit-level=high --package-lock-only/)
    expect(run).not.toMatch(/\|\|\s*true|continue-on-error/)
  })

  // Independent of what audit-exceptions.json holds today, so removing an entry when its
  // advisory is fixed (as the gate asks) does not break this test.
  it('the script exits 0 for nothing to block, 1 for a blocking advisory, 2 for no report', () => {
    const run = (report: unknown) =>
      spawnSync(process.execPath, ['scripts/check-dependency-audit.mjs', '--report=-', '--now=2026-10-10'], {
        cwd: frontend, input: JSON.stringify(report), encoding: 'utf8',
      }).status
    const clean = { auditReportVersion: 2, vulnerabilities: {} }
    expect(run(clean)).toBe(0)
    expect(run(withAdvisory(clean as never, 'lodash', 'GHSA-1111-2222-3333', 'high'))).toBe(1)
    expect(run({ error: { code: 'ENOTFOUND' } })).toBe(2)
  })
})
