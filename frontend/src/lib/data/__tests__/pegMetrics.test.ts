import { describe, it, expect } from 'vitest'
import { ASSET_CATALOG } from '../assetCatalog'
import { getPegDeviationColorClass, PEG_LOOSE_BPS } from '@/lib/utils/pegFormat'

/**
 * A peg metric only means something for an asset that HAS a peg.
 *
 * USDY — Ondo US Dollar Yield — is a tokenised short-term US Treasury note. Yield
 * accrues into the token price, so trading above $1.00 and rising is the product
 * working as designed. Until 2026-09-22 the catalog gave it `pegTarget: 1.0` and
 * `pegDeviationBps: 282.0`, which is past PEG_LOOSE_BPS, so it rendered in the
 * danger colour on the Coin Registry's peg column, its asset card and its detail
 * page. A correctly functioning instrument was shown as severely broken — and the
 * more yield it accrued, the worse it looked.
 *
 * Found by a tokenized-securities assessment
 * (docs/assessments/tokenized-securities-2026-09-21.md) and confirmed end to end
 * before being fixed.
 *
 * ⚠ THE TEMPTING GENERAL VERSION OF THIS TEST IS FALSE. "No active asset sits
 * past PEG_LOOSE_BPS" looks like the real invariant and is not: three catalog
 * entries legitimately exceed it.
 *   · `lusd`  —  88 bps, active. Liquity's redemption mechanism genuinely holds
 *                it slightly above $1; that drift is real and worth showing.
 *   · `busd`  — -255 bps, isActive: false. A real depeg on an asset being wound
 *                down. Recording it is the point.
 *   · `ampl`  — 1800 bps, active. Ampleforth REBASES: price is meant to move and
 *                supply adjusts to follow. The deviation is the signal, not a bug.
 * So the rule is not "peg deviation must be small". It is "an asset whose price is
 * designed to rise must not be measured against a fixed peg at all".
 */

const byId = (id: string) => ASSET_CATALOG.find((a) => a.id === id)

describe('peg metrics belong only to assets that have a peg', () => {
  it('USDY carries no peg target and no peg deviation', () => {
    const usdy = byId('usdy')
    expect(usdy, 'usdy is missing from the catalog').toBeTruthy()
    expect(usdy!.pegTarget, 'a Treasury note has no peg target').toBeUndefined()
    expect(usdy!.pegDeviationBps, 'a Treasury note cannot deviate from a peg').toBeFalsy()
    expect(usdy!.pegDeviation).toBeNull()
  })

  it('USDY therefore renders muted, not red', () => {
    const usdy = byId('usdy')!
    const shown = usdy.pegDeviationBps ?? usdy.pegDeviation
    expect(getPegDeviationColorClass(shown as number | null)).toBe('text-text-muted')
  })

  it('the old value would have rendered in the danger colour — so this can fail', () => {
    // Anti-vacuity: proves the assertion above is doing work rather than passing
    // because everything returns muted. 282 was the recorded value.
    expect(282).toBeGreaterThan(PEG_LOOSE_BPS)
    expect(getPegDeviationColorClass(282)).toBe('text-red-400')
  })

})

/**
 * ⚠ NO STRUCTURAL INVARIANT CATCHES THE USDY CLASS OF BUG, AND THAT IS THE POINT.
 *
 * The obvious guard is "an asset with a pegTarget must have a pegDeviation, and
 * vice versa". It was written, it failed on 60 entries, and it was wrong — most of
 * the catalog uses `pegDeviation: 0` with no `pegTarget` as a not-applicable
 * sentinel, which is a convention rather than a defect. BTC is not claiming a
 * perfect peg; it is claiming the field does not apply.
 *
 * But the deeper reason it could never have worked: USDY's SHAPE was perfectly
 * consistent. It had a target AND a deviation AND a reserve ratio, all
 * well-formed and internally coherent. What was wrong was SEMANTIC — a yield
 * accruing instrument does not have a peg to deviate from, and no amount of
 * checking field co-presence can know that.
 *
 * So this file pins the specific fact rather than pretending to a general rule.
 * Deciding whether an asset has a peg is a judgement about the instrument, and it
 * belongs in review — §7B of docs/assessments/tokenized-securities-2026-09-21.md
 * is where the broader classification question sits.
 */
