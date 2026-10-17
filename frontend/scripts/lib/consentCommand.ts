// Arguments for `npm run auth:consent` (T-436, D127). Pure, so every combination is tested.

export type ConsentCommand =
  | { kind: 'status' }
  | { kind: 'withdraw'; email: string }

export const CONSENT_USAGE = `Usage:
  npm run auth:consent -- --status                    list each account's agreement to email notices
  npm run auth:consent -- --withdraw --user <email>   record that account's withdrawal, sent to you by email`

export function parseConsentCommand(argv: string[]): ConsentCommand | { error: string } {
  const flags = new Set<string>()
  let email: string | null = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--user') {
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) return { error: '--user needs an email address.' }
      email = next.trim().toLowerCase()
      i++
    } else if (a === '--status' || a === '--withdraw') {
      flags.add(a)
    } else {
      return { error: `Unknown argument: ${a}` }
    }
  }

  if (flags.has('--status') && flags.has('--withdraw')) return { error: 'Use one of --status and --withdraw at a time.' }
  if (flags.has('--status')) {
    return email === null ? { kind: 'status' } : { error: '--status lists every account, so --user does not apply.' }
  }
  if (flags.has('--withdraw')) {
    if (!email || !email.includes('@')) return { error: '--withdraw needs --user <email>.' }
    return { kind: 'withdraw', email }
  }
  return { error: 'Say what to do: --status, or --withdraw --user <email>.' }
}
