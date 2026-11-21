import { describe, it, expect, vi, beforeEach } from 'vitest'
import { totpCode, TOTP_STEP_SECONDS } from '../totp'
import { hashRecoveryCode } from '../twoFactor'
import { twoFactorSecrets, twoFactorRecoveryCodes } from '@/lib/db/schema'
import { verifyTwoFactorSignIn, resetTwoFactorThrottle } from '../twoFactorStore'

// The store half of two-factor sign-in (D233), run against a small in-memory
// database whose WHERE clauses are REALLY evaluated — the drizzle operators are
// replaced with predicate builders below, so a conditional update only touches
// the rows its condition matches, one statement at a time, as Postgres would.
//
// What this exists to hold: the 2026-11-21 audit found two sign-ins racing the
// SAME authenticator code were both admitted — the TOTP branch recorded
// last_used_step with an unconditional UPDATE while the recovery branch beside
// it already did the conditional-update-and-check. Both one-time guards are
// conditional writes now, and these tests drive the real verifyTwoFactorSignIn
// through both races. An unconditional write makes the race tests fail.

type Row = Record<string, unknown>
type Col = { name: string }
type Pred = (row: Row) => boolean

const store = vi.hoisted(() => ({ tables: new Map<object, Record<string, unknown>[]>() }))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: (c: Col, v: unknown): Pred => (row) => row[c.name] === v,
    lt: (c: Col, v: unknown): Pred => (row) => row[c.name] !== null && (row[c.name] as number) < (v as number),
    isNull: (c: Col): Pred => (row) => row[c.name] === null,
    and: (...ps: Pred[]): Pred => (row) => ps.every((p) => p(row)),
    or: (...ps: Pred[]): Pred => (row) => ps.some((p) => p(row)),
  }
})

vi.mock('@/lib/server/auditLog', () => ({ recordAudit: vi.fn(async () => {}) }))

vi.mock('@/lib/db', () => {
  const rows = (table: object) => store.tables.get(table) ?? []
  const project = (sel: Record<string, Col>, row: Row): Row =>
    Object.fromEntries(Object.entries(sel).map(([k, c]) => [k, row[c.name]]))
  return {
    isDbConfigured: true,
    db: {
      select: (sel: Record<string, Col>) => ({
        from: (table: object) => ({
          where: (pred: Pred) => {
            const matched = () => rows(table).filter(pred).map((r) => project(sel, r))
            return {
              limit: (n: number) => Promise.resolve(matched().slice(0, n)),
              then: (res: (v: Row[]) => unknown, rej?: (e: unknown) => unknown) =>
                Promise.resolve(matched()).then(res, rej),
            }
          },
        }),
      }),
      update: (table: Record<string, unknown>) => ({
        set: (vals: Record<string, unknown>) => ({
          where: (pred: Pred) => {
            // One statement, applied atomically: the condition decides against
            // the rows AS THEY ARE at this moment, which is the whole race.
            const apply = () => {
              const hit = rows(table).filter(pred)
              for (const row of hit) {
                for (const [k, v] of Object.entries(vals)) row[(table[k] as Col).name] = v
              }
              return hit
            }
            return {
              returning: (sel: Record<string, Col>) => Promise.resolve(apply().map((r) => project(sel, r))),
              then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
                Promise.resolve(apply()).then(res, rej),
            }
          },
        }),
      }),
    },
  }
})

/** A stored row keyed by SQL column names, written from the table's own columns. */
const rowFor = (table: object, vals: Record<string, unknown>): Row =>
  Object.fromEntries(Object.entries(vals).map(([k, v]) => [((table as Record<string, Col>)[k]).name, v]))

const NOW = new Date('2026-11-21T12:00:00Z')
const SECRET = 'JBSWY3DPEHPK3PXP'
const RECOVERY = 'ABCDE-FGHJK'

beforeEach(() => {
  resetTwoFactorThrottle()
  store.tables.set(twoFactorSecrets, [
    rowFor(twoFactorSecrets, {
      userId: 'u1', secret: SECRET, confirmedAt: new Date('2026-11-20T00:00:00Z'),
      lastUsedStep: null, createdAt: new Date('2026-11-20T00:00:00Z'), updatedAt: new Date('2026-11-20T00:00:00Z'),
    }),
  ])
  store.tables.set(twoFactorRecoveryCodes, [
    rowFor(twoFactorRecoveryCodes, { id: 'c1', userId: 'u1', codeHash: hashRecoveryCode(RECOVERY), usedAt: null }),
  ])
})

describe('verifyTwoFactorSignIn, one-time guarantees under race', () => {
  it('two sign-ins racing the same authenticator code: only one gets in', async () => {
    const code = totpCode(SECRET, NOW)
    expect(code).not.toBeNull()
    // Both pass the pure check against the same read; only the conditional
    // write can tell them apart (the 2026-11-21 audit's finding 1).
    const results = await Promise.all([
      verifyTwoFactorSignIn('u1', code!, NOW),
      verifyTwoFactorSignIn('u1', code!, NOW),
    ])
    expect([...results].sort()).toEqual(['bad', 'ok'])
  })

  it('a code that signed someone in is refused again afterwards, and the next step’s code works', async () => {
    const code = totpCode(SECRET, NOW)!
    expect(await verifyTwoFactorSignIn('u1', code, NOW)).toBe('ok')
    expect(await verifyTwoFactorSignIn('u1', code, NOW)).toBe('bad')
    const later = new Date(NOW.getTime() + TOTP_STEP_SECONDS * 1000)
    expect(await verifyTwoFactorSignIn('u1', totpCode(SECRET, later)!, later)).toBe('ok')
  })

  it('two sign-ins racing the same recovery code: only the one that spent it gets in', async () => {
    const results = await Promise.all([
      verifyTwoFactorSignIn('u1', RECOVERY, NOW),
      verifyTwoFactorSignIn('u1', RECOVERY, NOW),
    ])
    expect([...results].sort()).toEqual(['bad', 'ok'])
  })

  it('an unenrolled account and a wrong code both read as bad', async () => {
    expect(await verifyTwoFactorSignIn('nobody', totpCode(SECRET, NOW)!, NOW)).toBe('bad')
    expect(await verifyTwoFactorSignIn('u1', '000000', NOW)).toBe('bad')
  })
})
