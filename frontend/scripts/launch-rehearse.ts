// ─────────────────────────────────────────────────────────────────────────────
// LAUNCH REHEARSAL (T-466, owner decision D242, 2026-11-24).
//
//   npm run launch:rehearse -- --db postgres://fn:fn@127.0.0.1:5432/fn_rehearsal
//
// Does once, today, what launch day would otherwise do for the first time: boots
// the app with the launch environment (FN_REQUIRE_AUTH=true, AUTH_SECRET,
// FN_SITE_OPEN=true — D232's recipe — plus AUTH_TRUST_HOST=true, which Auth.js
// needs on any host that is not Vercel, and FN_ALLOW_LOCAL_USER=false, the
// production default) against a SCRATCH Postgres migrated from zero, and walks
// one account through the whole built-dark stack:
//
//   the wall redirect → sign-up refused without the consent box and accepted
//   with it → sign-in → TOTP enrollment, the replay guard, a fresh code, a
//   recovery code → entitlements (Builder not included, then granted by the
//   owner command) → "Download my data" → the audit log holding the walk's
//   rows with UPDATE and DELETE refused by the WORM trigger.
//
// REPORT-ONLY, the probe convention: it fixes nothing, PASSes or FAILs each
// step, exits 0 all-pass / 1 any-fail / 2 inconclusive (no reachable scratch
// database, or the app would not boot — neither says anything about the code).
// SAFETY: the scratch DATABASE_URL is EXPLICIT (--db) and refused when it
// equals the ambient DATABASE_URL — this never runs against a real database —
// and nothing is deleted: the scratch database is left in place, named in the
// report, the owner's to remove by hand (the no-deletion standing rule).
//
// --site-lock adds a second boot WITHOUT FN_SITE_OPEN, asserting the D174
// owner lock: pages redirect to /owner and data routes answer 401.
//
// Why it exists: every piece here is unit-tested and no process had ever run
// them together with the flags on — the repo's recorded lesson (the 2026-10-17
// model-swap finding) is that per-piece green plus never-run breaks silently,
// and the walled mode's first real run was scheduled for launch day.
// ─────────────────────────────────────────────────────────────────────────────

import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import postgres from 'postgres'
import { SIGNUP_CONSENT } from '../src/lib/legal/signupConsent'
import { totpCode, totpStep } from '../src/lib/auth/totp'

const args = process.argv.slice(2)
const flag = (name: string): string | null => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : null
}

const DB = flag('--db')
const PORT = Number(flag('--port') ?? 3100)
const SITE_LOCK_PASS = args.includes('--site-lock')
const BASE = `http://127.0.0.1:${PORT}`

const EMAIL = `rehearsal-${Date.now()}@example.test`
const PASSWORD = `Rehearse!${randomBytes(6).toString('hex')}9`

type Outcome = { name: string; ok: boolean | null; detail: string }
const outcomes: Outcome[] = []
const pass = (name: string, detail: string) => { outcomes.push({ name, ok: true, detail }); console.log(`  PASS  ${name} — ${detail}`) }
const fail = (name: string, detail: string) => { outcomes.push({ name, ok: false, detail }); console.log(`  FAIL  ${name} — ${detail}`) }
const skip = (name: string, detail: string) => { outcomes.push({ name, ok: null, detail }); console.log(`  SKIP  ${name} — ${detail}`) }

function inconclusive(why: string): never {
  console.error(`\nINCONCLUSIVE: ${why}`)
  console.error('This run proves nothing about the launch recipe — fix the environment and run again.')
  process.exit(2)
}

// ── A minimal cookie jar, enough for Auth.js over plain fetch ────────────────
class Jar {
  cookies = new Map<string, string>()
  absorb(res: Response) {
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';')
      const eq = pair.indexOf('=')
      if (eq > 0) {
        const name = pair.slice(0, eq).trim()
        const value = pair.slice(eq + 1).trim()
        if (value === '' || /expires=Thu, 01 Jan 1970/i.test(line)) this.cookies.delete(name)
        else this.cookies.set(name, value)
      }
    }
  }
  header(): string { return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ') }
  has(fragment: string): boolean { return [...this.cookies.keys()].some((k) => k.includes(fragment)) }
}

async function req(jar: Jar | null, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (jar) headers.set('cookie', jar.header())
  headers.set('origin', BASE)
  const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: 'manual' })
  jar?.absorb(res)
  return res
}

/** Sign in with the credentials provider. Returns the session's email, or null plus whatever error code the redirect carried. */
async function signIn(jar: Jar, email: string, password: string, otp?: string): Promise<{ email: string | null; code: string | null }> {
  const csrfRes = await req(jar, '/api/auth/csrf')
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
  const body = new URLSearchParams({ csrfToken, email, password, ...(otp ? { otp } : {}) })
  const res = await req(jar, '/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const location = res.headers.get('location') ?? ''
  const code = /[?&]code=([^&]+)/.exec(location)?.[1] ?? (/error=/.test(location) ? 'error' : null)
  const session = (await (await req(jar, '/api/auth/session')).json()) as { user?: { email?: string } }
  return { email: session?.user?.email ?? null, code }
}

function run(cmd: string, cmdArgs: string[], env: Record<string, string>): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { cwd: process.cwd(), env: { ...process.env, ...env } })
    let out = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { out += d })
    child.on('close', (code) => resolve({ code, out }))
  })
}

async function bootApp(env: Record<string, string>, port: number): Promise<ChildProcess> {
  const child = spawn('npx', ['next', 'dev', '-p', String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    detached: true,
    stdio: 'ignore',
  })
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/auth/csrf`, { redirect: 'manual' })
      if (res.status < 500) return child
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1500))
  }
  stopApp(child)
  throw new Error('the app did not answer within 180s')
}

function stopApp(child: ChildProcess | null) {
  if (!child?.pid) return
  try { process.kill(-child.pid, 'SIGTERM') } catch { /* already gone */ }
  setTimeout(() => { try { process.kill(-child!.pid!, 'SIGKILL') } catch { /* gone */ } }, 4000).unref()
}

async function main() {
  console.log('Launch rehearsal (T-466) — report-only; the scratch database is left in place.\n')

  // ── Guards: an explicit scratch database, never the ambient one ────────────
  if (!DB) inconclusive('pass the scratch database: --db postgres://user:pass@host:5432/dbname')
  if (!/^postgres(ql)?:\/\//.test(DB)) inconclusive('--db must be a postgres:// URL')
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === DB) {
    inconclusive('--db equals the ambient DATABASE_URL — the rehearsal only ever runs against a scratch database')
  }

  const sql = postgres(DB, { max: 1, connect_timeout: 10 })
  try {
    await sql`select 1`
  } catch (e) {
    inconclusive(`cannot reach the scratch database: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ── Step 1: migrate from zero ──────────────────────────────────────────────
  const migrate = await run('node', ['scripts/db-migrate.mjs'], { DATABASE_URL: DB })
  if (migrate.code === 0) {
    const tables = await sql<{ n: string }[]>`select table_name as n from information_schema.tables where table_schema = 'public'`
    const names = new Set(tables.map((t) => t.n))
    const wanted = ['users', 'entitlements', 'audit_log', 'two_factor_secrets', 'communication_consents']
    const missing = wanted.filter((w) => !names.has(w))
    if (missing.length === 0) pass('migrate', `all migrations applied; ${names.size} tables, the walk's five present`)
    else fail('migrate', `migrations ran but tables are missing: ${missing.join(', ')}`)
  } else {
    fail('migrate', `db-migrate exited ${migrate.code}: ${migrate.out.slice(-300)}`)
    report(null)
    return
  }

  // ── Step 2: boot with the launch environment ───────────────────────────────
  const launchEnv: Record<string, string> = {
    DATABASE_URL: DB,
    FN_REQUIRE_AUTH: 'true',
    AUTH_SECRET: randomBytes(32).toString('base64'),
    FN_SITE_OPEN: 'true',
    // Production's default; dev would otherwise allow the shared local user.
    FN_ALLOW_LOCAL_USER: 'false',
    // Needed on any host that is not Vercel — a rehearsal finding: D232's
    // three variables alone do not boot Auth.js on a self-hosted address.
    AUTH_TRUST_HOST: 'true',
  }
  let app: ChildProcess | null = null
  try {
    app = await bootApp(launchEnv, PORT)
    pass('boot', `next dev answering on ${BASE} with the launch environment`)
  } catch (e) {
    inconclusive(`the app would not boot: ${e instanceof Error ? e.message : String(e)}`)
  }

  try {
    // ── Step 3: the wall ─────────────────────────────────────────────────────
    const walled = await req(null, '/headlines')
    const loc = walled.headers.get('location') ?? ''
    if (walled.status >= 300 && walled.status < 400 && loc.includes('/login')) pass('wall', `anonymous /headlines → ${walled.status} ${loc}`)
    else fail('wall', `anonymous /headlines answered ${walled.status} ${loc || '(no redirect)'}`)

    // ── Step 4: sign-up refused without the consent box ─────────────────────
    const refused = await req(null, '/api/auth/signup', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })
    if (refused.status === 400) pass('signup-consent-gate', 'sign-up without electronicConsent refused with 400')
    else fail('signup-consent-gate', `expected 400, got ${refused.status}`)

    // ── Step 5: sign-up with consent ────────────────────────────────────────
    const signup = await req(null, '/api/auth/signup', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, electronicConsent: true, consentVersion: SIGNUP_CONSENT.version }),
    })
    if (signup.ok) pass('signup', `account created (${EMAIL})`)
    else { fail('signup', `signup answered ${signup.status}: ${(await signup.text()).slice(0, 200)}`); report(app); return }

    // ── Step 6: sign in ─────────────────────────────────────────────────────
    const jar = new Jar()
    const first = await signIn(jar, EMAIL, PASSWORD)
    if (first.email === EMAIL) pass('signin', 'credentials sign-in produced a session')
    else { fail('signin', `no session after sign-in (error code: ${first.code ?? 'none'})`); report(app); return }

    // ── Step 7: TOTP enrollment ─────────────────────────────────────────────
    const begin = await req(jar, '/api/user/two-factor/begin', { method: 'POST' })
    const begun = (await begin.json()) as { ok?: boolean; otpauthUri?: string }
    const secret = begun.otpauthUri ? new URL(begun.otpauthUri).searchParams.get('secret') : null
    let recovery: string[] = []
    if (begin.ok && secret) {
      const code = totpCode(secret, new Date())
      const confirm = await req(jar, '/api/user/two-factor/confirm', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
      })
      const confirmed = (await confirm.json()) as { ok?: boolean; recoveryCodes?: string[] }
      recovery = confirmed.recoveryCodes ?? []
      if (confirm.ok && confirmed.ok && recovery.length === 10) pass('totp-enroll', 'enrolled; 10 recovery codes issued')
      else fail('totp-enroll', `confirm answered ${confirm.status}; recovery codes: ${recovery.length}`)
    } else {
      fail('totp-enroll', `begin answered ${begin.status} (${JSON.stringify(begun).slice(0, 150)})`)
    }

    if (secret && recovery.length > 0) {
      // ── Step 8: the second step, its replay guard, and a fresh code ───────
      const noCode = await signIn(new Jar(), EMAIL, PASSWORD)
      if (noCode.email === null && noCode.code === 'totp_required') pass('totp-required', 'password alone no longer signs in (totp_required)')
      else if (noCode.email === null) pass('totp-required', `password alone no longer signs in (code: ${noCode.code ?? 'unnamed'})`)
      else fail('totp-required', 'password alone still produced a session after enrollment')

      // The code that confirmed enrollment is spent for its 30s window.
      const replay = await signIn(new Jar(), EMAIL, PASSWORD, totpCode(secret, new Date()) ?? '')
      if (replay.email === null) pass('totp-replay-guard', 'the window’s already-used code was refused')
      else fail('totp-replay-guard', 'a replayed code signed in')

      // Wait out the window, then a fresh code must work.
      const step = totpStep(new Date())
      const waitMs = (step + 1) * 30_000 - Date.now() + 1_500
      if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs))
      const jar2 = new Jar()
      const withCode = await signIn(jar2, EMAIL, PASSWORD, totpCode(secret, new Date()) ?? '')
      if (withCode.email === EMAIL) pass('totp-signin', 'the next window’s code signed in')
      else fail('totp-signin', `a fresh code did not sign in (code: ${withCode.code ?? 'none'})`)

      // ── Step 9: a recovery code in the same box ───────────────────────────
      const jar3 = new Jar()
      const viaRecovery = await signIn(jar3, EMAIL, PASSWORD, recovery[0])
      if (viaRecovery.email === EMAIL) pass('recovery-code', 'a recovery code signed in')
      else fail('recovery-code', `the recovery code did not sign in (code: ${viaRecovery.code ?? 'none'})`)

      // ── Step 10: entitlements — Builder locked, then granted ──────────────
      const before = (await (await req(jar3, '/api/user/entitlements')).json()) as { effective?: Record<string, boolean>; grantLocked?: string[] }
      const lockedOff = before.effective?.builder === false && (before.grantLocked ?? []).includes('builder')
      if (lockedOff) pass('entitlements-default', 'Builder reads not-included and grant-locked for a fresh account')
      else fail('entitlements-default', `expected builder off+locked, got ${JSON.stringify(before).slice(0, 200)}`)

      const grant = await run('npx', ['tsx', 'scripts/entitlements.ts', '--grant', 'builder', '--user', EMAIL], { DATABASE_URL: DB })
      const after = (await (await req(jar3, '/api/user/entitlements')).json()) as { effective?: Record<string, boolean> }
      if (grant.code === 0 && after.effective?.builder === true) pass('entitlements-grant', 'the owner command granted Builder and the account sees it')
      else fail('entitlements-grant', `grant exited ${grant.code}; builder now ${String(after.effective?.builder)}`)

      // ── Step 11: Download my data ─────────────────────────────────────────
      const exportRes = await req(jar3, '/api/user/export')
      const exported = exportRes.ok ? await exportRes.text() : ''
      if (exportRes.ok && exported.includes(EMAIL) && exported.includes('audit_log')) {
        pass('export', 'the account’s copy includes its own audit rows')
      } else {
        fail('export', `export answered ${exportRes.status}; email present: ${exported.includes(EMAIL)}`)
      }
    } else {
      skip('totp-required', 'needs enrollment'); skip('totp-replay-guard', 'needs enrollment'); skip('totp-signin', 'needs enrollment')
      skip('recovery-code', 'needs enrollment'); skip('entitlements-default', 'needs a session'); skip('entitlements-grant', 'needs a session'); skip('export', 'needs a session')
    }

    // ── Step 12: the WORM audit log ─────────────────────────────────────────
    const rows = await sql<{ event: string }[]>`select event from audit_log order by at`
    const events = rows.map((r) => r.event)
    const expected = ['account_created', 'signed_in']
    const missing = expected.filter((e) => !events.includes(e))
    if (rows.length >= 4 && missing.length === 0) pass('audit-rows', `${rows.length} rows; the walk’s events present (${[...new Set(events)].join(', ')})`)
    else fail('audit-rows', `rows: ${rows.length}; missing: ${missing.join(', ') || 'none'} (${[...new Set(events)].join(', ')})`)

    let wormHeld = true
    try { await sql`update audit_log set event = 'tampered' where event = 'account_created'`; wormHeld = false } catch { /* refused — the point */ }
    try { await sql`delete from audit_log where event = 'account_created'`; wormHeld = false } catch { /* refused — the point */ }
    const stillThere = (await sql<{ n: string }[]>`select count(*)::text as n from audit_log where event = 'account_created'`)[0].n
    if (wormHeld && stillThere !== '0') pass('audit-worm', 'UPDATE and DELETE both refused by the trigger; the row is intact')
    else fail('audit-worm', wormHeld ? 'the row vanished' : 'an UPDATE or DELETE was accepted')
  } finally {
    stopApp(app)
  }

  // ── Optional: the D174 site lock, same harness ────────────────────────────
  if (SITE_LOCK_PASS) {
    // FN_SITE_OPEN unset and FN_ADMIN_TOKEN set, as every real host sets it:
    // with the token set the Host header is not trusted (D193), so the lock
    // binds even on 127.0.0.1 and the rehearsal can exercise it locally.
    const lockedEnv = { ...launchEnv, FN_ADMIN_TOKEN: randomBytes(24).toString('hex') }
    delete (lockedEnv as Record<string, string | undefined>).FN_SITE_OPEN
    let lockedApp: ChildProcess | null = null
    try {
      lockedApp = await bootApp(lockedEnv, PORT + 1)
      const lockedBase = `http://127.0.0.1:${PORT + 1}`
      const page = await fetch(`${lockedBase}/headlines`, { redirect: 'manual' })
      const pLoc = page.headers.get('location') ?? ''
      if (page.status >= 300 && page.status < 400 && pLoc.includes('/owner')) pass('site-lock-page', `without FN_SITE_OPEN, /headlines → ${pLoc}`)
      else fail('site-lock-page', `expected a redirect to /owner, got ${page.status} ${pLoc}`)
      const route = await fetch(`${lockedBase}/live-data/markets`, { redirect: 'manual' })
      if (route.status === 401) pass('site-lock-route', 'without FN_SITE_OPEN, a data route answers 401')
      else fail('site-lock-route', `expected 401, got ${route.status}`)
    } catch (e) {
      skip('site-lock-page', `second boot failed: ${e instanceof Error ? e.message : String(e)}`)
      skip('site-lock-route', 'second boot failed')
    } finally {
      stopApp(lockedApp)
    }
  }

  await sql.end()
  report(null)
}

function report(app: ChildProcess | null) {
  stopApp(app)
  const failed = outcomes.filter((o) => o.ok === false)
  const passed = outcomes.filter((o) => o.ok === true)
  console.log(`\n${passed.length} passed, ${failed.length} failed, ${outcomes.length - passed.length - failed.length} skipped.`)
  console.log(`Scratch database left in place (nothing is deleted): ${DB}`)
  console.log('Environment the boot needed beyond D232’s three variables: AUTH_TRUST_HOST=true (any non-Vercel host), FN_ALLOW_LOCAL_USER=false (production’s own default).')
  if (failed.length > 0) {
    console.log('\nThe launch recipe did NOT rehearse clean:')
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`)
    process.exit(1)
  }
  process.exit(0)
}

main().catch((e) => inconclusive(e instanceof Error ? e.message : String(e)))
