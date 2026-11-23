// Owner command for two-factor sign-in (T-088, owner decision D233).
//
//   npm run auth:2fa -- --status
//   npm run auth:2fa -- --disable --user someone@example.com
//
// --disable is the lockout-recovery path: someone lost their phone AND their recovery
// codes. There is no email provider before launch (D21), so recovery is the owner's
// hands, like password resets (auth:reset). Check it is really them first — not by
// email alone — because turning this off is exactly what an account thief would ask
// for. Afterwards their password signs them in on its own, and they can set two-step
// sign-in up again from Settings.
//
// Deletes the account's two-factor secret and recovery codes and nothing else: a
// revoked shared secret kept around is a live credential, not a record (D233; the
// no-deletion standing rule is about project files and branches).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { parseTwoFactorCommand, TWO_FACTOR_USAGE } from './lib/twoFactorCommand'
import { insertAudit } from './lib/auditInsert'

/** Same dependency-free loader as auth-reset.ts: the real environment wins over the file. */
function loadEnvLocal(): void {
  try {
    for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* no .env.local: rely on the environment */ }
}

async function main(): Promise<number> {
  const cmd = parseTwoFactorCommand(process.argv.slice(2))
  if ('error' in cmd) {
    console.error(`${cmd.error}\n\n${TWO_FACTOR_USAGE}`)
    return 1
  }
  loadEnvLocal()
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set (frontend/.env.local).')
    return 1
  }

  const sql = postgres(url, { max: 1 })
  try {
    if (cmd.kind === 'status') {
      const rows = await sql<{ email: string; confirmed: Date | null; codes: string }[]>`
        select u.email, s.confirmed_at as confirmed,
               count(c.id) filter (where c.used_at is null) as codes
        from two_factor_secrets s
        join users u on u.id = s.user_id
        left join two_factor_recovery_codes c on c.user_id = s.user_id
        group by u.email, s.confirmed_at
        order by u.email`
      if (rows.length === 0) console.log('No account has two-step sign-in on.')
      for (const r of rows) {
        console.log(r.confirmed
          ? `${r.email}  on since ${r.confirmed.toISOString().slice(0, 10)}, ${r.codes} recovery code(s) left`
          : `${r.email}  set-up begun, never confirmed (gates nothing)`)
      }
      return 0
    }

    const [user] = await sql<{ id: string; email: string }[]>`
      select id, email from users where lower(email) = ${cmd.email} limit 1`
    if (!user) {
      console.error(`No account with the email ${cmd.email}.`)
      return 1
    }
    const gone = await sql`delete from two_factor_secrets where user_id = ${user.id} returning user_id`
    await sql`delete from two_factor_recovery_codes where user_id = ${user.id}`
    if (gone.length === 0) {
      console.log(`${user.email} did not have two-step sign-in on. Nothing changed.`)
      return 0
    }
    await insertAudit(sql, { userId: user.id, event: 'two_factor_disabled', detail: 'owner recovery' })
    console.log(`Two-step sign-in is OFF for ${user.email}. Their password now signs them in on its own.`)
    console.log('If their password may be in the wrong hands too, issue a reset: npm run auth:reset -- --user ' + user.email + ' --force')
    return 0
  } catch (e) {
    const code = (e as { code?: string })?.code
    if (code === '42P01') {
      console.error('The two-factor tables are missing: run `npm run db:migrate` first (migration 0012).')
      return 1
    }
    console.error('Failed:', (e as Error)?.message ?? e)
    return 1
  } finally {
    await sql.end()
  }
}

main().then((code) => process.exit(code))
