import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// T-466 (D242): the launch rehearsal is a REPORT-ONLY harness that runs the
// built-dark account stack end to end against an explicit scratch database.
// These pins hold the properties that make it safe to run and honest when it
// fails — the same source-scan idiom as the other script guards, because the
// failure mode for a harness like this is someone "simplifying" away a guard
// that only matters the day it would have fired.

const src = readFileSync(join(__dirname, '../../../../scripts/launch-rehearse.ts'), 'utf8')
const pkg = JSON.parse(readFileSync(join(__dirname, '../../../../package.json'), 'utf8')) as { scripts: Record<string, string> }

describe('the launch rehearsal harness', () => {
  it('is wired as npm run launch:rehearse', () => {
    expect(pkg.scripts['launch:rehearse']).toBe('tsx scripts/launch-rehearse.ts')
  })

  it('takes an EXPLICIT scratch database and refuses the ambient one', () => {
    expect(src).toContain("flag('--db')")
    expect(src).toContain('process.env.DATABASE_URL === DB')
    expect(src).toMatch(/only ever runs against a scratch database/)
  })

  it('deletes nothing: no drop, truncate or file removal anywhere in it', () => {
    expect(src).not.toMatch(/dropdb|DROP\s+(TABLE|DATABASE|SCHEMA)|truncate|rmSync|unlink/i)
    expect(src).toContain('left in place')
  })

  it('boots the launch environment as launch would have it', () => {
    // D232's recipe, plus the two the rehearsal itself established are needed:
    // AUTH_TRUST_HOST on any non-Vercel host, and FN_ALLOW_LOCAL_USER=false so
    // dev mode cannot quietly hand the walk the shared local user.
    expect(src).toContain("FN_REQUIRE_AUTH: 'true'")
    expect(src).toContain("FN_SITE_OPEN: 'true'")
    expect(src).toMatch(/AUTH_SECRET: randomBytes\(32\)/)
    expect(src).toContain("FN_ALLOW_LOCAL_USER: 'false'")
    expect(src).toContain("AUTH_TRUST_HOST: 'true'")
  })

  it('follows the probe convention: exit 2 is inconclusive, never a verdict', () => {
    expect(src).toContain('process.exit(2)')
    expect(src).toMatch(/proves nothing about the launch recipe/)
  })

  it('spawns Node on resolved entrypoints, never an npx/npm shim — the owner runs this from PowerShell', () => {
    // On Windows those shims are .cmd files Node's spawn refuses without a
    // shell, so a bare spawn('npx', …) dies before the recipe is reached and
    // exits 1, "the recipe is broken" (audit 2026-11-24, finding 2).
    expect(src).toContain("requireHere.resolve('next/dist/bin/next')")
    expect(src).toContain("requireHere.resolve('tsx/cli')")
    expect(src).not.toMatch(/spawn\(\s*'np[mx]/)
    // Process groups are POSIX-only: Windows fells the tree with taskkill,
    // and detached there would open a console window instead.
    expect(src).toMatch(/detached: process\.platform !== 'win32'/)
    expect(src).toContain("'taskkill'")
    // A spawn failure surfaces as inconclusive (the environment), not exit 1.
    expect(src).toContain('the app process could not start')
  })

  it('the site-lock pass sets FN_ADMIN_TOKEN, so the lock binds on localhost (D193)', () => {
    expect(src).toMatch(/FN_ADMIN_TOKEN: randomBytes\(24\)/)
    expect(src).toMatch(/delete \(lockedEnv as Record<string, string \| undefined>\)\.FN_SITE_OPEN/)
  })

  it('checks the stack the walk exists to prove, by name', () => {
    for (const step of [
      "'wall'", "'signup-consent-gate'", "'signin'", "'totp-enroll'", "'totp-replay-guard'",
      "'recovery-code'", "'entitlements-grant'", "'export'", "'audit-worm'",
    ]) {
      expect(src, step).toContain(step)
    }
    // The WORM check tries both forbidden writes and requires the row intact.
    expect(src).toMatch(/update audit_log/i)
    expect(src).toMatch(/delete from audit_log/i)
  })
})
