// Owner command for module entitlements (T-083, owner decision D234, 2026-11-21).
//
//   npm run entitlements -- --status
//   npm run entitlements -- --grant builder --user someone@example.com
//   npm run entitlements -- --revoke builder --user someone@example.com
//
// The posture (D234): standard modules are on for everyone and are the account's
// own toggles; Portfolio Builder (`builder`) is a premium module a real account
// holds only with a grant row, which an account's own toggle can never write.
// Until billing exists (T-084), this command is how a grant happens. It upserts
// one row per (account, module) and deletes nothing; a revoke sets enabled to
// false, keeping the row as the record.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { parseEntitlementsCommand, ENTITLEMENTS_USAGE, GRANTABLE_MODULE_IDS } from './lib/entitlementsCommand'

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
  const cmd = parseEntitlementsCommand(process.argv.slice(2))
  if ('error' in cmd) {
    console.error(`${cmd.error}\n\n${ENTITLEMENTS_USAGE}`)
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
      const rows = await sql<{ email: string; module_id: string; enabled: boolean; expires_at: Date | null; updated_at: Date }[]>`
        select u.email, e.module_id, e.enabled, e.expires_at, e.updated_at
        from entitlements e join users u on u.id = e.user_id
        order by u.email, e.module_id`
      console.log('Defaults: standard modules on for everyone; builder (Portfolio Builder) off for a real account until granted.')
      if (rows.length === 0) console.log('No account has a row — every account is on the defaults.')
      for (const r of rows) {
        const term = r.expires_at ? ` until ${r.expires_at.toISOString().slice(0, 10)}` : ''
        console.log(`${r.email}  ${r.module_id}: ${r.enabled ? 'on' : 'off'}${term}  (set ${r.updated_at.toISOString().slice(0, 10)})`)
      }
      return 0
    }

    if (!(GRANTABLE_MODULE_IDS as readonly string[]).includes(cmd.moduleId)) {
      console.error(`"${cmd.moduleId}" is not an optional module. They are: ${GRANTABLE_MODULE_IDS.join(', ')}.`)
      return 1
    }
    const [user] = await sql<{ id: string; email: string }[]>`
      select id, email from users where lower(email) = ${cmd.email} limit 1`
    if (!user) {
      console.error(`No account with the email ${cmd.email}.`)
      return 1
    }
    const enabled = cmd.kind === 'grant'
    const now = new Date()
    await sql`
      insert into entitlements (user_id, module_id, enabled, expires_at, created_at, updated_at)
      values (${user.id}, ${cmd.moduleId}, ${enabled}, null, ${now}, ${now})
      on conflict (user_id, module_id)
      do update set enabled = ${enabled}, expires_at = null, updated_at = ${now}`
    console.log(enabled
      ? `${cmd.moduleId} is ON for ${user.email} (no end date). Billing will own these rows later (T-084).`
      : `${cmd.moduleId} is OFF for ${user.email}. The row stays as the record.`)
    return 0
  } catch (e) {
    const code = (e as { code?: string })?.code
    if (code === '42P01') {
      console.error('The entitlements table is missing: run `npm run db:migrate` first.')
      return 1
    }
    console.error('Failed:', (e as Error)?.message ?? e)
    return 1
  } finally {
    await sql.end()
  }
}

main().then((code) => process.exit(code))
