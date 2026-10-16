// Arguments for `npm run auth:reset` (T-435, D123). Pure, so every combination is tested.

export type ResetCommand =
  | { kind: 'status' }
  | { kind: 'user'; email: string; force: boolean }
  | { kind: 'all' }

export const RESET_USAGE = `Usage:
  npm run auth:reset -- --user <email>           issue a one-time reset link for that account
  npm run auth:reset -- --user <email> --force   also refuse its sign-in until it resets
  npm run auth:reset -- --all --force            refuse every account's sign-in until each resets (after a breach)
  npm run auth:reset -- --status                 list the accounts that must reset`

export function parseResetCommand(argv: string[]): ResetCommand | { error: string } {
  const flags = new Set<string>()
  let email: string | null = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--user') {
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) return { error: '--user needs an email address.' }
      email = next.trim().toLowerCase()
      i++
    } else if (a === '--force' || a === '--all' || a === '--status') {
      flags.add(a)
    } else {
      return { error: `Unknown argument: ${a}` }
    }
  }

  const modes = [email !== null, flags.has('--all'), flags.has('--status')].filter(Boolean).length
  if (modes === 0) return { error: 'Say what to do: --user <email>, --all --force or --status.' }
  if (modes > 1) return { error: 'Use one of --user, --all and --status at a time.' }

  if (flags.has('--status')) {
    return flags.has('--force') ? { error: '--status changes nothing, so --force does not apply.' } : { kind: 'status' }
  }
  if (flags.has('--all')) {
    // Every account at once is the breach lever; it must be asked for explicitly.
    return flags.has('--force') ? { kind: 'all' } : { error: '--all refuses every sign-in until each account resets; add --force to mean it.' }
  }
  if (!email || !email.includes('@')) return { error: '--user needs an email address.' }
  return { kind: 'user', email, force: flags.has('--force') }
}
