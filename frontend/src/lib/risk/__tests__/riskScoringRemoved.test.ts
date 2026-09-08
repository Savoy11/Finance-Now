import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Owner decision, 2026-08-29 (RP-6, final): NO per-coin risk score is published
 * anywhere. Publishing a risk figure for an asset the reader is looking at may
 * be seen as a recommendation, and that is a regulated activity.
 *
 * The removal happened in two steps on the same day — first the bare ratings
 * (header gauge, band pill, search badge) with the explanatory panel kept and
 * documented, then the panel itself. This file guards the end state.
 *
 * IT DELIBERATELY DOES NOT GUARD lib/risk ITSELF. That framework is general and
 * its other consumers were each decided separately and remain live: the options
 * Trade Risk Scorer, curated staking-provider risk, and the macro/equity
 * profiles. A test that banned the engine would misread the decision.
 */

const repo = (rel: string) => path.join(process.cwd(), rel)

/** Source with comments stripped — removal notes necessarily name what they removed. */
const read = (rel: string) =>
  fs.readFileSync(repo(rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

describe('per-coin risk scoring is gone from the crypto surfaces', () => {
  it('the deleted modules stay deleted', () => {
    for (const f of [
      'src/app/live-data/risk-scores/route.ts',
      'src/lib/api/live/riskScores.ts',
      'src/components/assets/RiskScoreBadge.tsx',
      'src/hooks/useRiskScores.ts',
      'src/lib/api/risk-scores.ts',
      'src/components/analytics/HistoricalScoreChart.tsx',
    ]) {
      expect(fs.existsSync(repo(f)), `${f} is back`).toBe(false)
    }
  })

  it('the coin detail page renders no score, band or composite panel', () => {
    const src = read('src/app/(dashboard)/assets/[id]/page.tsx')
    for (const needle of ['Safety Score', 'RiskScoreBadge', 'RiskBandPill', 'Composite Risk', 'LiveRiskPanel', 'Pillar Breakdown']) {
      expect(src, `"${needle}" is back on the coin detail page`).not.toContain(needle)
    }
  })

  it('search results carry no risk score', () => {
    expect(read('src/components/ui/SearchInput.tsx')).not.toContain('riskScore')
  })

  it('the Asset type carries no risk fields for a surface to render', () => {
    // Removing the fields is what stops this coming back by accident: with no
    // riskScore on Asset, a new surface cannot quietly render "N/A" as though a
    // score were merely missing rather than deliberately not computed.
    const src = read('src/types/asset.ts')
    expect(src).not.toMatch(/^\s*riskScore:/m)
    expect(src).not.toMatch(/^\s*riskScore\?:/m)
  })

  it('no crypto surface fetches a risk-score route', () => {
    const src = read('src/hooks/useAssets.ts') + read('src/lib/api/assets.ts')
    expect(src).not.toContain('applyRiskComposite')
    expect(src).not.toContain('risk-scores')
  })

  it('guards the guard: the comment stripper works', () => {
    // Every assertion above scans stripped source. If the stripper broke, they
    // would match documentation instead of code and pass for the wrong reason.
    const src = read('src/app/(dashboard)/assets/[id]/page.tsx')
    expect(src).not.toContain('TO RESTORE')
    expect(src).toContain('export default function')
  })
})

describe('lib/risk survives for its other, separately-decided consumers', () => {
  it('the engine and the still-used profiles are intact', () => {
    for (const f of [
      'src/lib/risk/engine.ts',
      'src/lib/risk/profiles/optionsTrade.ts',   // /equities/options
      'src/lib/risk/profiles/stakingAdapter.ts', // staking provider risk
      'src/lib/risk/profiles/equity.ts',
      'src/lib/risk/profiles/commodity.ts',
    ]) {
      expect(fs.existsSync(repo(f)), `${f} was removed — that is a different decision`).toBe(true)
    }
  })
})

describe('no permanently-null risk field renders as a missing one', () => {
  // The failure this catches is subtler than a surviving score, and it is the
  // one RP-6 named when it chose to DELETE the Asset fields rather than null
  // them: a field that is always null still reaches a surface, which renders
  // "N/A" — and a reader takes that as "we could not fetch it" rather than "we
  // do not publish it". Withholding a number and failing to get one must not
  // look the same.
  //
  // Found live on 2026-09-08: the market-overview popout showed
  // "Avg Safety Score — N/A" and "High / Critical — N/A" off two fields
  // hardcoded null since the RP-6 removal.

  it('getMarketOverview returns no risk aggregate at all', () => {
    const src = read('src/lib/api/market-data.ts')
    expect(src).not.toMatch(/avgRiskScore\s*[:?]/)
    expect(src).not.toMatch(/criticalHighCount\s*[:?]/)
  })

  it('the market-overview popout shows no risk row', () => {
    const src = read('src/components/ui/PopoutContent.tsx')
    expect(src).not.toContain("label: 'Avg Safety Score'")
    expect(src).not.toContain("label: 'High / Critical'")
  })
})
