// Owner command for the agreement to email notices given at sign-up (T-436; owner decisions
// D124 and D127, 2026-10-17).
//
//   npm run auth:consent -- --status
//   npm run auth:consent -- --withdraw --user someone@example.com
//
// --status lists every account and whether a notice may go to it by email: the list a breach
// notice starts from (T-426's plan). --withdraw records a withdrawal someone sent you by email,
// as the Terms of Use's section 6 offers. That section also says withdrawing closes the account;
// the command does not do that. Close it yourself once you have told them.
//
// Changes nothing but communication_consents.withdrawn_at; deletes nothing.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { consentStandings, mayEmailNotices, type ConsentRow } from '../src/lib/auth/electronicConsent'
import { parseConsentCommand, CONSENT_USAGE } from './lib/consentCommand'

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
  const cmd = parseConsentCommand(process.argv.slice(2))
  if ('error' in cmd) {
    console.error(`${cmd.error}\n\n${CONSENT_USAGE}`)
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
      const rows = await sql<ConsentRow[]>`
        select u.email, c.agreed_at as "agreedAt", c.withdrawn_at as "withdrawnAt", c.wording_version as "wordingVersion"
        from users u left join communication_consents c on c.user_id = u.id`
      const standings = consentStandings(rows)
      if (standings.length === 0) console.log('No accounts.')
      for (const s of standings) {
        if (s.state === 'agreed') console.log(`${s.email}  agreed ${s.since.toISOString()} (wording ${s.wordingVersion})`)
        else if (s.state === 'withdrawn') console.log(`${s.email}  WITHDRAWN ${s.since.toISOString()}: no notices by email`)
        else console.log(`${s.email}  no agreement recorded: no notices by email`)
      }
      const emailable = standings.filter(mayEmailNotices).length
      console.log(`\n${emailable} of ${standings.length} account(s) may be sent notices by email.`)
      return 0
    }

    const [user] = await sql<{ id: string; email: string }[]>`
      select id, email from users where lower(email) = ${cmd.email} limit 1`
    if (!user) {
      console.error(`No account with the email ${cmd.email}.`)
      return 1
    }
    const marked = await sql`
      update communication_consents set withdrawn_at = ${new Date()}
      where user_id = ${user.id} and withdrawn_at is null
      returning id`
    if (marked.length === 0) {
      console.log(`${user.email} holds no agreement to withdraw.`)
      return 0
    }
    console.log(`Recorded: ${user.email} withdrew their agreement to email notices.`)
    console.log('Section 6 of the Terms of Use says withdrawing closes the account. Close it once you have told them.')
    return 0
  } catch (e) {
    const code = (e as { code?: string })?.code
    if (code === '42P01') {
      console.error('The communication_consents table is missing: run `npm run db:migrate` first (migration 0009).')
      return 1
    }
    console.error('Failed:', (e as Error)?.message ?? e)
    return 1
  } finally {
    await sql.end()
  }
}

main().then((code) => process.exit(code))
