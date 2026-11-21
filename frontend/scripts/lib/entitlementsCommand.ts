// Argument parsing for `npm run entitlements` (T-083, D234), pure so the test
// can drive it — the same split as resetCommand.ts and twoFactorCommand.ts.

export const ENTITLEMENTS_USAGE = `Usage:
  npm run entitlements -- --status                         every account's module rows
  npm run entitlements -- --grant <module> --user <email>  give an account a module (Portfolio Builder: builder)
  npm run entitlements -- --revoke <module> --user <email> take it away again

Standard modules (crypto, equities, macro, funds) are ON for everyone by default and are the
account's own toggles; granting one only overrides an account's "off" preference. The grant
that matters is the premium module, builder — a real account does not have it until granted
(D234). Billing writes these same rows later (T-084).`

// The registry's optional module ids, as a literal: importing the registry from
// a command-line script would pull lucide-react along. entitlements.test.ts
// pins this list to OPTIONAL_MODULE_IDS, so it cannot drift from the registry.
export const GRANTABLE_MODULE_IDS = ['crypto', 'equities', 'macro', 'funds', 'builder'] as const

export type EntitlementsCommand =
  | { kind: 'status' }
  | { kind: 'grant' | 'revoke'; moduleId: string; email: string }
  | { error: string }

export function parseEntitlementsCommand(argv: readonly string[]): EntitlementsCommand {
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
  const grant = valueOf('--grant')
  const revoke = valueOf('--revoke')
  const email = valueOf('--user')

  if (args.length > 0) return { error: `Unknown argument: ${args[0]}` }
  if (status && (grant || revoke || email)) return { error: '--status takes no other flags.' }
  if (status) return { kind: 'status' }
  if (grant && revoke) return { error: 'Say --grant or --revoke, not both.' }
  const moduleId = grant ?? revoke
  if (!moduleId) return { error: 'Say what to do: --status, --grant <module> --user <email>, or --revoke <module> --user <email>.' }
  if (!/^[a-z][a-z-]*$/.test(moduleId)) return { error: `"${moduleId}" is not a module id.` }
  if (!email || !email.includes('@')) return { error: `--${grant ? 'grant' : 'revoke'} needs --user <email>.` }
  return { kind: grant ? 'grant' : 'revoke', moduleId, email: email.trim().toLowerCase() }
}
