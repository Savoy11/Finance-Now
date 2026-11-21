import { MODULES, OPTIONAL_MODULES, type ModuleId } from './registry'

// ─── Module entitlement rules (T-083, D234, 2026-11-21) ──────────────────────
//
// The pure half of database-backed entitlements: what an account has, given its
// rows in the `entitlements` table. The owner's posture (D234): the standard
// optional modules are ON for everyone and stay personal on/off toggles, synced
// to the account; a PREMIUM module (the registry's `premium` flag — Portfolio
// Builder) is off for a real account until a grant row says otherwise, written
// by the owner's command (`npm run entitlements`) now and by billing later
// (T-084, Phase 6).
//
// Two modes, and the split is the dark boundary (D232's pattern):
//  - 'session': a signed-in account. Premium needs a grant; no toggle can
//    self-grant it.
//  - 'local': the shared local user, while sign-in is off (today). EVERYTHING
//    behaves as it always has — every optional module on by default and
//    togglable, premium included — so nothing changes before launch. The
//    schema said this from day one: "Absence of a row means 'use the
//    default' — which in local dev is granted."
//
// No 'server-only' import: the owner's command runs this under tsx, and the
// client store shares the togglability rules.

export type EntitlementMode = 'session' | 'local'

/** A row of the entitlements table, as the rules read it. */
export interface EntitlementRowLike {
  moduleId: string
  enabled: boolean
  /** Billing may set a term (Phase 6); a past date reads as not granted. */
  expiresAt: Date | null
}

export const OPTIONAL_MODULE_IDS = OPTIONAL_MODULES.map((m) => m.id)
export const PREMIUM_MODULE_IDS = OPTIONAL_MODULES.filter((m) => m.premium).map((m) => m.id)

export function isModuleId(id: unknown): id is ModuleId {
  return typeof id === 'string' && MODULES.some((m) => m.id === id)
}

/** Whether a row grants anything at `now`: enabled, and not past its term. */
export function rowActive(row: EntitlementRowLike, now: Date): boolean {
  return row.enabled && (row.expiresAt === null || row.expiresAt.getTime() > now.getTime())
}

/**
 * Whether the account's own toggle may change this module. Core is never
 * togglable (always on); a premium module is togglable only in local mode —
 * for a session, flipping it on would be self-granting a paid module.
 */
export function canUserToggle(id: ModuleId, mode: EntitlementMode): boolean {
  const mod = MODULES.find((m) => m.id === id)
  if (!mod || !mod.optional) return false
  return mode === 'local' || !mod.premium
}

/** The one sentence a refused toggle gets. */
export function toggleRefusalReason(id: ModuleId): string {
  const mod = MODULES.find((m) => m.id === id)
  if (mod && !mod.optional) return 'The core section is always on.'
  return `${mod?.label ?? id} is granted per account, not toggled. The site owner can add it to yours.`
}

/**
 * What the account actually has, module by module. A standard module is on
 * unless its row turned it off; a premium module needs an active row in
 * session mode and defaults on in local mode.
 */
export function effectiveEntitlements(
  rows: readonly EntitlementRowLike[],
  mode: EntitlementMode,
  now: Date,
): Record<ModuleId, boolean> {
  const byId = new Map(rows.map((r) => [r.moduleId, r] as const))
  const out = {} as Record<ModuleId, boolean>
  for (const mod of MODULES) {
    if (!mod.optional) {
      out[mod.id] = true
      continue
    }
    const row = byId.get(mod.id)
    if (mod.premium && mode === 'session') {
      out[mod.id] = row ? rowActive(row, now) : false
    } else {
      out[mod.id] = row ? rowActive(row, now) : true
    }
  }
  return out
}

/**
 * The premium modules this account does not hold — locked by grant, not by
 * preference, so the gate says "not included" rather than "re-enable it".
 * Empty in local mode, where nothing is grant-locked before launch.
 */
export function grantLockedModules(
  rows: readonly EntitlementRowLike[],
  mode: EntitlementMode,
  now: Date,
): ModuleId[] {
  if (mode === 'local') return []
  const effective = effectiveEntitlements(rows, mode, now)
  return PREMIUM_MODULE_IDS.filter((id) => !effective[id])
}

/**
 * The one-time import of a browser's old localStorage toggles into the
 * account's rows: only modules the saved map had turned OFF need a row
 * (absence already means the default), and only ones this mode may toggle —
 * a saved "builder off" preference on a real account is dropped rather than
 * written over grant semantics.
 */
export function importableRows(
  disabled: Partial<Record<ModuleId, boolean>>,
  mode: EntitlementMode,
): { moduleId: ModuleId; enabled: false }[] {
  return OPTIONAL_MODULE_IDS
    .filter((id) => disabled[id] === true && canUserToggle(id, mode))
    .map((id) => ({ moduleId: id, enabled: false as const }))
}

/** The GET /api/user/entitlements response, shared with the store. */
export interface EntitlementsResponse {
  ok: true
  mode: EntitlementMode
  effective: Record<ModuleId, boolean>
  /** Modules this account's own toggle may change. */
  togglable: ModuleId[]
  /** Premium modules this account does not hold (empty in local mode). */
  grantLocked: ModuleId[]
}

export function buildEntitlementsResponse(
  rows: readonly EntitlementRowLike[],
  mode: EntitlementMode,
  now: Date,
): EntitlementsResponse {
  return {
    ok: true,
    mode,
    effective: effectiveEntitlements(rows, mode, now),
    togglable: OPTIONAL_MODULE_IDS.filter((id) => canUserToggle(id, mode)),
    grantLocked: grantLockedModules(rows, mode, now),
  }
}
