import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  OPTIONAL_MODULE_IDS, PREMIUM_MODULE_IDS, buildEntitlementsResponse, canUserToggle,
  effectiveEntitlements, grantLockedModules, importableRows, isModuleId, rowActive,
  toggleRefusalReason, type EntitlementRowLike,
} from '../entitlements'
import { MODULES, OPTIONAL_MODULES } from '../registry'
import { GRANTABLE_MODULE_IDS, parseEntitlementsCommand } from '../../../../scripts/lib/entitlementsCommand'

// T-083 / D234 (2026-11-21): database-backed entitlements, on the owner's posture —
// standard modules on for everyone as account toggles; a premium module (builder)
// held by a real account only with a grant row. Local mode (sign-in off, today)
// behaves exactly as before, so everything here is dark until launch.

const NOW = new Date('2026-11-21T12:00:00Z')
const row = (moduleId: string, enabled: boolean, expiresAt: Date | null = null): EntitlementRowLike =>
  ({ moduleId, enabled, expiresAt })

describe('the registry’s premium flag', () => {
  it('marks exactly the Portfolio Builder', () => {
    expect(PREMIUM_MODULE_IDS).toEqual(['builder'])
    expect(MODULES.find((m) => m.id === 'builder')?.optional).toBe(true)
  })
  it('and the owner command’s literal list cannot drift from the registry', () => {
    expect([...GRANTABLE_MODULE_IDS].sort()).toEqual([...OPTIONAL_MODULE_IDS].sort())
    expect(OPTIONAL_MODULE_IDS).toEqual(OPTIONAL_MODULES.map((m) => m.id))
  })
})

describe('what an account has (effectiveEntitlements)', () => {
  it('with no rows: a real account has the standard modules and not the premium one', () => {
    const effective = effectiveEntitlements([], 'session', NOW)
    expect(effective.core).toBe(true)
    expect(effective.crypto).toBe(true)
    expect(effective.equities).toBe(true)
    expect(effective.macro).toBe(true)
    expect(effective.funds).toBe(true)
    expect(effective.builder).toBe(false)
  })
  it('with no rows in local mode: everything is on, exactly as before launch', () => {
    const effective = effectiveEntitlements([], 'local', NOW)
    for (const mod of MODULES) expect(effective[mod.id], mod.id).toBe(true)
  })
  it('a standard module’s row records the account’s off switch', () => {
    expect(effectiveEntitlements([row('equities', false)], 'session', NOW).equities).toBe(false)
    expect(effectiveEntitlements([row('equities', false)], 'local', NOW).equities).toBe(false)
    expect(effectiveEntitlements([row('equities', true)], 'session', NOW).equities).toBe(true)
  })
  it('a grant row turns the premium module on for a session; a revoked one does not', () => {
    expect(effectiveEntitlements([row('builder', true)], 'session', NOW).builder).toBe(true)
    expect(effectiveEntitlements([row('builder', false)], 'session', NOW).builder).toBe(false)
  })
  it('a grant past its term reads as not granted (billing may set terms, T-084)', () => {
    const past = new Date(NOW.getTime() - 1)
    const future = new Date(NOW.getTime() + 86_400_000)
    expect(rowActive(row('builder', true, past), NOW)).toBe(false)
    expect(effectiveEntitlements([row('builder', true, past)], 'session', NOW).builder).toBe(false)
    expect(effectiveEntitlements([row('builder', true, future)], 'session', NOW).builder).toBe(true)
  })
})

describe('who may toggle what', () => {
  it('core is never togglable; standard modules always are', () => {
    expect(canUserToggle('core', 'session')).toBe(false)
    expect(canUserToggle('core', 'local')).toBe(false)
    expect(canUserToggle('equities', 'session')).toBe(true)
    expect(canUserToggle('equities', 'local')).toBe(true)
  })
  it('a session can never toggle the premium module — no account self-grants it', () => {
    expect(canUserToggle('builder', 'session')).toBe(false)
    expect(canUserToggle('builder', 'local')).toBe(true) // before launch, as today
    expect(toggleRefusalReason('builder')).toMatch(/granted per account/)
  })
  it('grant-locked names the ungranted premium modules, and only for sessions', () => {
    expect(grantLockedModules([], 'session', NOW)).toEqual(['builder'])
    expect(grantLockedModules([row('builder', true)], 'session', NOW)).toEqual([])
    expect(grantLockedModules([], 'local', NOW)).toEqual([])
  })
})

describe('the one-time localStorage import', () => {
  it('writes rows only for modules the saved map turned OFF', () => {
    expect(importableRows({}, 'local')).toEqual([])
    expect(importableRows({ equities: true, macro: false }, 'local'))
      .toEqual([{ moduleId: 'equities', enabled: false }])
  })
  it('drops a saved "builder off" on a real account rather than touch grant rows', () => {
    expect(importableRows({ builder: true, funds: true }, 'session'))
      .toEqual([{ moduleId: 'funds', enabled: false }])
    expect(importableRows({ builder: true }, 'local'))
      .toEqual([{ moduleId: 'builder', enabled: false }])
  })
})

describe('the response the route and store share', () => {
  it('carries mode, the effective map, togglables and grant locks', () => {
    const res = buildEntitlementsResponse([], 'session', NOW)
    expect(res.mode).toBe('session')
    expect(res.effective.builder).toBe(false)
    expect(res.togglable).toEqual(['crypto', 'equities', 'macro', 'funds'])
    expect(res.grantLocked).toEqual(['builder'])
    expect(buildEntitlementsResponse([], 'local', NOW).togglable).toEqual(OPTIONAL_MODULE_IDS)
  })
  it('isModuleId takes only real module ids', () => {
    expect(isModuleId('builder')).toBe(true)
    expect(isModuleId('budget')).toBe(false) // removed 2026-08-20; stale flags are ignored
    expect(isModuleId(42)).toBe(false)
  })
})

// ─── Wiring contracts ────────────────────────────────────────────────────────

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('the route, store and gate honour the posture', () => {
  it('the route resolves the session first, and refuses non-togglable modules through the shared rule', () => {
    const route = read('../../../app/api/user/entitlements/route.ts')
    expect(route).toMatch(/getSessionUserId/)
    expect(route).toMatch(/canUserToggle\(moduleId, account\.mode\)/)
    expect(route).toMatch(/export const dynamic = 'force-dynamic'/)
    expect(route).not.toMatch(/\.delete\(/) // rows are upserted, never deleted
  })
  it('the store keeps its hydration contract and offers no toggle the server refuses', () => {
    const store = read('../../../store/useEntitlementStore.ts')
    expect(store).toMatch(/skipHydration: true/)
    expect(store).toMatch(/partialize/)
    expect(store).toMatch(/!get\(\)\.isTogglable\(id\)\) return/)
    expect(store).toMatch(/importableRows/)
  })
  it('providers hydrate the server truth after the persisted map', () => {
    expect(read('../../../app/providers.tsx')).toMatch(/rehydrate\(\)\)\.then\(\(\) => hydrateEntitlements\(\)\)/)
  })
  it('the gate tells a grant lock from a preference, without a dead settings link', () => {
    const gate = read('../../../components/layout/ModuleGate.tsx')
    expect(gate).toMatch(/grantLocked\(\)\.includes\(module\)/)
    expect(gate).toMatch(/isn’t included with this account/)
    expect(gate).toMatch(/\{!grantLocked && \(/)
  })
  it('npm run entitlements is wired to the script', () => {
    const pkg = JSON.parse(read('../../../../package.json'))
    expect(pkg.scripts.entitlements).toBe('tsx scripts/entitlements.ts')
  })
})

describe('npm run entitlements arguments', () => {
  it('parses each form', () => {
    expect(parseEntitlementsCommand(['--status'])).toEqual({ kind: 'status' })
    expect(parseEntitlementsCommand(['--grant', 'builder', '--user', 'Someone@X.com']))
      .toEqual({ kind: 'grant', moduleId: 'builder', email: 'someone@x.com' })
    expect(parseEntitlementsCommand(['--revoke', 'builder', '--user', 'a@b.c']))
      .toEqual({ kind: 'revoke', moduleId: 'builder', email: 'a@b.c' })
  })
  it('refuses what it cannot mean', () => {
    for (const argv of [[], ['--grant'], ['--grant', 'builder'], ['--grant', 'builder', '--user'],
      ['--grant', 'builder', '--user', 'nobody'], ['--grant', 'b', '--revoke', 'b', '--user', 'a@b.c'],
      ['--status', '--grant', 'builder'], ['--grant', 'Builder!', '--user', 'a@b.c'], ['--wat']]) {
      expect(parseEntitlementsCommand(argv), argv.join(' ')).toHaveProperty('error')
    }
  })
})
