// Argument parsing for `npm run auth:2fa` (T-088, D233), pure so the test can
// drive it — the same split as resetCommand.ts.

export const TWO_FACTOR_USAGE = `Usage:
  npm run auth:2fa -- --status                    list accounts with two-step sign-in on
  npm run auth:2fa -- --disable --user <email>    turn it off for one account (lockout recovery)

--disable is for someone who lost both their phone and their recovery codes. Check it is
really them first (not by email alone); afterwards their password signs them in on its own,
and they can set two-step sign-in up again from Settings.`

export type TwoFactorCommand =
  | { kind: 'status' }
  | { kind: 'disable'; email: string }
  | { error: string }

export function parseTwoFactorCommand(argv: readonly string[]): TwoFactorCommand {
  const args = [...argv]
  const has = (flag: string): boolean => {
    const i = args.indexOf(flag)
    if (i === -1) return false
    args.splice(i, 1)
    return true
  }
  const valueOf = (flag: string): string | null => {
    const i = args.indexOf(flag)
    if (i === -1 || i + 1 >= args.length) return null
    const v = args[i + 1]
    if (v.startsWith('--')) return null
    args.splice(i, 2)
    return v
  }

  const status = has('--status')
  const disable = has('--disable')
  const email = valueOf('--user')

  if (args.length > 0) return { error: `Unknown argument: ${args[0]}` }
  if (status && (disable || email)) return { error: '--status takes no other flags.' }
  if (status) return { kind: 'status' }
  if (disable) {
    if (!email || !email.includes('@')) return { error: '--disable needs --user <email>.' }
    return { kind: 'disable', email: email.trim().toLowerCase() }
  }
  return { error: 'Say what to do: --status, or --disable --user <email>.' }
}
