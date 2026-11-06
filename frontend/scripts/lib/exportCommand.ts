// Arguments for `npm run user:export` (T-452, D199). Pure, so every combination is tested.

export interface ExportCommand {
  email: string
  /** Folder to write into, or null for the default (user-export-<date> in this folder). */
  out: string | null
}

export const EXPORT_USAGE = `Usage:
  npm run user:export -- --user <email>                 write that account's data to ./user-export-<date>/
  npm run user:export -- --user <email> --out <folder>  write it to <folder> instead

It writes three files: everything stored for the account (JSON), its trades and its portfolio
holdings (CSV, which a spreadsheet opens). It reads only, and deletes nothing.`

export function parseExportCommand(argv: string[]): ExportCommand | { error: string } {
  let email: string | null = null
  let out: string | null = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (a === '--user') {
      if (!next || next.startsWith('--')) return { error: '--user needs an email address.' }
      email = next.trim().toLowerCase()
      i++
    } else if (a === '--out') {
      if (!next || next.startsWith('--')) return { error: '--out needs a folder.' }
      out = next
      i++
    } else {
      return { error: `Unknown argument: ${a}` }
    }
  }
  if (!email || !email.includes('@')) return { error: 'Say whose data: --user <email>.' }
  return { email, out }
}

/** The default folder: "user-export-2026-11-06". */
export function defaultExportFolder(now: Date): string {
  return `user-export-${now.toISOString().slice(0, 10)}`
}
