// Owner command for password resets without email (T-435, owner decision D123, 2026-10-15).
//
//   npm run auth:reset -- --user someone@example.com [--force]
//   npm run auth:reset -- --all --force
//   npm run auth:reset -- --status
//
// --user prints a one-time reset link to hand to that person directly; there is no email
// provider before launch (D21). --force refuses that account's sign-in until it resets.
// --all --force does that for every account, the lever after a breach. Pair it with
// rotating AUTH_SECRET, which signs everyone out of the sessions they already have; this
// command cannot end a session, only refuse the next sign-in.
//
// The printed link is the ONE place a token is ever shown. It is not stored (only its
// SHA-256 is) and not logged. Treat the terminal output like the password it replaces.
// Changes nothing that exists except password_states and new rows in password_reset_tokens;
// deletes nothing.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { generateResetToken, resetLink, resetTokenExpiry, RESET_TOKEN_TTL_MINUTES } from '../src/lib/auth/passwordReset'
import { parseResetCommand, RESET_USAGE } from './lib/resetCommand'

/** Same dependency-free loader as drizzle.config.ts: the real environment wins over the file. */
function loadEnvLocal(): void {
  try {
    for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* no .env.local: rely on the environment */ }
}

async function main(): Promise<number> {
  const cmd = parseResetCommand(process.argv.slice(2))
  if ('error' in cmd) {
    console.error(`${cmd.error}\n\n${RESET_USAGE}`)
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
      const rows = await sql<{ email: string; since: Date | null }[]>`
        select u.email, s.must_reset_since as since
        from password_states s join users u on u.id = s.user_id
        where s.must_reset order by s.must_reset_since`
      if (rows.length === 0) console.log('No account is waiting on a forced reset.')
      for (const r of rows) console.log(`${r.email}  must reset since ${r.since?.toISOString() ?? '(unknown)'}`)
      return 0
    }

    const now = new Date()
    if (cmd.kind === 'all') {
      const rows = await sql`
        insert into password_states (user_id, must_reset, must_reset_since, updated_at)
        select id, true, ${now}, ${now} from users where password_hash is not null
        on conflict (user_id) do update set must_reset = true, must_reset_since = ${now}, updated_at = ${now}
        returning user_id`
      console.log(`${rows.length} account(s) must now reset their password before signing in.`)
      console.log('Next: rotate AUTH_SECRET to end existing sessions, then issue each person a link with --user <email>.')
      return 0
    }

    const [user] = await sql<{ id: string; email: string }[]>`
      select id, email from users where lower(email) = ${cmd.email} limit 1`
    if (!user) {
      console.error(`No account with the email ${cmd.email}.`)
      return 1
    }
    if (cmd.force) {
      await sql`
        insert into password_states (user_id, must_reset, must_reset_since, updated_at)
        values (${user.id}, true, ${now}, ${now})
        on conflict (user_id) do update set must_reset = true, must_reset_since = ${now}, updated_at = ${now}`
    }
    const { token, tokenHash } = generateResetToken()
    await sql`
      insert into password_reset_tokens (user_id, token_hash, issued_by, expires_at)
      values (${user.id}, ${tokenHash}, 'owner-command', ${resetTokenExpiry(now)})`
    const base = process.env.FN_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    console.log(`Reset link for ${user.email}, valid for ${RESET_TOKEN_TTL_MINUTES} minutes and one use:`)
    console.log(`\n  ${resetLink(base, token)}\n`)
    console.log(cmd.force
      ? 'Its sign-in is refused until the password is reset.'
      : 'Its current password still works until a new one is set.')
    console.log('Hand it over directly. It is not stored or logged anywhere else.')
    return 0
  } catch (e) {
    const code = (e as { code?: string })?.code
    if (code === '42P01') {
      console.error('The password reset tables are missing: run `npm run db:migrate` first (migration 0008).')
      return 1
    }
    console.error('Failed:', (e as Error)?.message ?? e)
    return 1
  } finally {
    await sql.end()
  }
}

main().then((code) => process.exit(code))
