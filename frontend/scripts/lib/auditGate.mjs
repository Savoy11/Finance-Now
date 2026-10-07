// The rules behind the Security Scan's dependency audit (scripts/check-dependency-audit.mjs).
//
// Until 2026-10-03 that step was a bare `npm audit --audit-level=high`: every high or critical
// advisory failed it, with no way to record a decision about one. Then GHSA-vfj7-8cjw-p6xm
// (braces <= 3.0.3, stack exhaustion on deeply nested brace patterns) arrived with NO patched
// release. 3.0.3 is the newest braces there is, so `main` and every PR went red, and npm's only
// suggestions were breaking changes (Tailwind 4, or eslint-config-next 14) that do not clear
// both paths braces comes in by. The owner chose a dated exception (D53) over waiting for a
// patch or migrating Tailwind.
//
// An exception is narrow by construction:
//  - it names ONE advisory by its GHSA id, and the package npm reports it on;
//  - it cites an owner decision recorded as a `| Dnn |` row under docs/decisions/;
//  - it expires, at most MAX_EXCEPTION_DAYS after it was decided. Holding on longer takes a
//    new decision with a new date, never an edited expiry;
//  - it stops applying the moment npm reports a fix that needs no major upgrade, because "no
//    fix exists" is the only reason one is granted.
// Everything else at high or critical fails exactly as `npm audit --audit-level=high` did.
//
// Kept pure so every rule is unit-tested (lib/server/__tests__/auditGate.test.ts). The script
// runs npm and reads the files.

/** The severities that fail the step, as `--audit-level=high` did. */
export const GATING_SEVERITIES = new Set(['high', 'critical'])

/** The longest an exception may run, counted from the day it was decided. */
export const MAX_EXCEPTION_DAYS = 92

/** How close to its expiry an exception starts warning in the step's output. */
export const EXPIRY_WARNING_DAYS = 14

const GHSA_IN_URL = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i
const GHSA_ID = /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/
const DECISION_ID = /^D\d+$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

/** True for a real calendar date written YYYY-MM-DD (2026-02-30 is not one). */
export function isIsoDate(s) {
  if (typeof s !== 'string' || !ISO_DATE.test(s)) return false
  const t = Date.parse(`${s}T00:00:00Z`)
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s
}

/** Whole days from one YYYY-MM-DD date to another. */
export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

/** The GHSA id in an advisory URL, in its canonical form, or null. */
export function advisoryId(url) {
  const m = typeof url === 'string' ? url.match(GHSA_IN_URL) : null
  return m ? `GHSA${m[0].slice(4).toLowerCase()}` : null
}

/**
 * How npm says a package's advisory can be cleared, from its `fixAvailable` field:
 * 'available' — `npm audit fix` can do it with no major upgrade; 'breaking' — only a
 * semver-major change npm proposes; 'none' — no fix at all.
 */
export function fixState(fixAvailable) {
  if (fixAvailable === true) return 'available'
  if (fixAvailable && typeof fixAvailable === 'object') return fixAvailable.isSemVerMajor ? 'breaking' : 'available'
  return 'none'
}

/**
 * The distinct advisories in an `npm audit --json` report (version 2). Each advisory is an
 * object in some package's `via` list; a string there only names a package the entry
 * inherits from, so micromatch, chokidar and tailwindcss add nothing beyond braces' advisory.
 */
export function listAdvisories(report) {
  const vulns = report?.vulnerabilities ?? {}
  const byId = new Map()
  for (const vuln of Object.values(vulns)) {
    for (const via of vuln?.via ?? []) {
      if (!via || typeof via !== 'object') continue
      const id = advisoryId(via.url) ?? `npm-${via.source}`
      if (byId.has(id)) continue
      const own = vulns[via.name] ?? vuln
      byId.set(id, {
        id,
        package: via.name,
        severity: via.severity,
        title: via.title ?? '',
        url: via.url ?? '',
        range: via.range ?? '',
        fix: fixState(own.fixAvailable),
      })
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * The usable exceptions in an audit-exceptions.json file, and what is wrong with the rest.
 * `knownDecisions` is the set of decision ids recorded under docs/decisions/; an exception
 * citing any other id is refused, so a decision cannot be cited before it is written down.
 */
export function validateExceptions(file, knownDecisions) {
  const list = Array.isArray(file?.exceptions) ? file.exceptions : null
  if (!list) return { exceptions: [], problems: ['audit-exceptions.json has no "exceptions" list'] }
  const problems = []
  const exceptions = []
  const seen = new Set()
  list.forEach((e, i) => {
    const where = `exception ${i + 1}${typeof e?.advisory === 'string' ? ` (${e.advisory})` : ''}`
    if (!e || typeof e !== 'object' || Array.isArray(e)) {
      problems.push(`${where}: not an object`)
      return
    }
    const errors = []
    if (typeof e.advisory !== 'string' || !GHSA_ID.test(e.advisory)) {
      errors.push('"advisory" must be a GHSA id, like GHSA-vfj7-8cjw-p6xm')
    } else if (seen.has(e.advisory)) {
      errors.push('this advisory is listed twice')
    } else {
      seen.add(e.advisory)
    }
    if (typeof e.package !== 'string' || !e.package.trim()) errors.push('"package" must name the package npm reports the advisory on')
    if (typeof e.decision !== 'string' || !DECISION_ID.test(e.decision)) {
      errors.push('"decision" must name an owner decision, like D53')
    } else if (knownDecisions && !knownDecisions.has(e.decision)) {
      errors.push(`decision ${e.decision} is not recorded under docs/decisions/`)
    }
    const datesOk = isIsoDate(e.decided) && isIsoDate(e.expires)
    if (!isIsoDate(e.decided)) errors.push('"decided" must be a date, YYYY-MM-DD')
    if (!isIsoDate(e.expires)) errors.push('"expires" must be a date, YYYY-MM-DD')
    if (datesOk) {
      const span = daysBetween(e.decided, e.expires)
      if (span <= 0) errors.push('"expires" must come after "decided"')
      else if (span > MAX_EXCEPTION_DAYS) {
        errors.push(`an exception lasts at most ${MAX_EXCEPTION_DAYS} days and this one runs ${span}; holding on longer is a new decision with a new date`)
      }
    }
    if (typeof e.reason !== 'string' || e.reason.trim().length < 20) errors.push('"reason" must say why the advisory cannot reach this app')
    if (errors.length) problems.push(...errors.map((m) => `${where}: ${m}`))
    else exceptions.push(e)
  })
  return { exceptions, problems }
}

/**
 * The verdict on one audit report. `today` is YYYY-MM-DD (UTC). An exception applies through
 * its `expires` date and not the day after.
 *
 * Returns { ok, inconclusive, blocking, allowed, warnings, problems }. `ok` is false when any
 * advisory blocks or the exceptions file has a problem; `inconclusive` is true when there was
 * no report to judge, which is never a pass.
 */
export function evaluateAudit(report, file, { today, knownDecisions } = {}) {
  if (!isIsoDate(today)) throw new Error('evaluateAudit needs today as YYYY-MM-DD')
  if (!report || typeof report !== 'object' || report.error || !report.vulnerabilities || typeof report.vulnerabilities !== 'object') {
    const detail = report?.error ? `: ${report.error.summary || report.error.code || 'npm reported an error'}` : ''
    return { ok: false, inconclusive: true, blocking: [], allowed: [], warnings: [], problems: [`npm audit produced no report${detail}`] }
  }
  const { exceptions, problems } = validateExceptions(file, knownDecisions)
  const byAdvisory = new Map(exceptions.map((e) => [e.advisory, e]))
  const gating = listAdvisories(report).filter((a) => GATING_SEVERITIES.has(a.severity))
  const blocking = []
  const allowed = []
  const warnings = []
  for (const a of gating) {
    const e = byAdvisory.get(a.id)
    if (!e) {
      blocking.push({ ...a, why: 'no exception covers it' })
    } else if (e.package !== a.package) {
      blocking.push({ ...a, why: `the exception names ${e.package}, but npm reports this advisory on ${a.package}` })
    } else if (today > e.expires) {
      blocking.push({ ...a, why: `the exception under ${e.decision} expired on ${e.expires}; it needs a new decision` })
    } else if (a.fix === 'available') {
      blocking.push({ ...a, why: `a fix that needs no major upgrade is available now (npm audit fix); ${e.decision} only covered the time without one` })
    } else {
      allowed.push({ ...a, decision: e.decision, expires: e.expires, reason: e.reason })
      const left = daysBetween(today, e.expires)
      if (left <= EXPIRY_WARNING_DAYS) {
        warnings.push(`${a.id} (${a.package}): the exception expires ${left === 0 ? 'today' : `in ${left} day${left === 1 ? '' : 's'}`}, on ${e.expires}`)
      }
    }
  }
  const reported = new Set(gating.map((a) => a.id))
  for (const e of exceptions) {
    if (!reported.has(e.advisory)) {
      warnings.push(`${e.advisory} (${e.package}): npm no longer reports it at high or critical, so the exception is no longer needed; remove it from audit-exceptions.json`)
    }
  }
  return { ok: blocking.length === 0 && problems.length === 0, inconclusive: false, blocking, allowed, warnings, problems }
}

/** The step's output, one finding per block, blockers first. */
export function formatResult(result) {
  const lines = []
  for (const a of result.blocking) {
    lines.push(`BLOCKS   ${a.id}  ${a.package} (${a.severity}): ${a.title}`, `         ${a.why}`, `         ${a.url}`)
  }
  for (const p of result.problems) lines.push(`PROBLEM  ${p}`)
  for (const a of result.allowed) {
    lines.push(`ALLOWED  ${a.id}  ${a.package} (${a.severity}) until ${a.expires}, under ${a.decision}: ${a.title}`)
  }
  for (const w of result.warnings) lines.push(`WARNING  ${w}`)
  return lines
}
