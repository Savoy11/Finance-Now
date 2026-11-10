// Owner command for "Download my data" (T-452, D199): answers a request for a copy of the
// personal information held about someone, which the draft Privacy Policy (§11) promises within
// 30 days. The signed-in person can also download it themselves from Settings → Your data.
//
//   npm run user:export -- --user someone@example.com
//   npm run user:export -- --user someone@example.com --out C:\some\folder
//
// Writes four files (everything as JSON; trades, what-if holdings and sales as CSV) and reads only: nothing in the database changes, nothing is deleted. The
// folder holds personal information, so hand it over and keep it out of the repository (the
// default folder name is gitignored).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import postgres from 'postgres'
import { collectUserExport, type ExportQuery } from '../src/lib/server/userExportCollect'
import { buildUserExport, exportFileName, holdingsCsv, salesCsv, tradesCsv, type Row } from '../src/lib/data/userExport'
import { EXPORT_USAGE, defaultExportFolder, parseExportCommand } from './lib/exportCommand'

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
  const cmd = parseExportCommand(process.argv.slice(2))
  if ('error' in cmd) {
    console.error(`${cmd.error}\n\n${EXPORT_USAGE}`)
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
    const [user] = await sql<{ id: string; email: string }[]>`
      select id, email from users where lower(email) = ${cmd.email} limit 1`
    if (!user) {
      console.error(`No account with the email ${cmd.email}.`)
      return 1
    }
    const query: ExportQuery = async (table, column, value) =>
      (await sql`select * from ${sql(table)} where ${sql(column)} = ${value}`) as unknown as Row[]
    const collected = await collectUserExport(query, user.id)

    const now = new Date()
    const folder = resolve(cmd.out ?? defaultExportFolder(now))
    mkdirSync(folder, { recursive: true })
    const files: [string, string][] = [
      [exportFileName('json', now), JSON.stringify(buildUserExport(collected, now), null, 2) + '\n'],
      [exportFileName('trades', now), tradesCsv(collected)],
      [exportFileName('holdings', now), holdingsCsv(collected)],
      [exportFileName('sales', now), salesCsv(collected, now)],
    ]
    for (const [name, body] of files) writeFileSync(join(folder, name), body)

    const rowCount = Object.values(collected.tables).reduce((n, rows) => n + rows.length, 0)
    console.log(`Wrote ${user.email}'s data to ${folder}:`)
    for (const [name] of files) console.log(`  ${name}`)
    console.log(`${rowCount} row(s) from ${Object.keys(collected.tables).length} table(s).`)
    if (collected.notSetUp.length > 0) {
      console.log(`Not set up on this database (run \`npm run db:migrate\`), so nothing of theirs can be in them: ${collected.notSetUp.join(', ')}.`)
    }
    console.log('It holds personal information: hand it to them directly and do not commit it.')
    return 0
  } catch (e) {
    console.error('Failed:', (e as Error)?.message ?? e)
    return 1
  } finally {
    await sql.end()
  }
}

main().then((code) => process.exit(code))
