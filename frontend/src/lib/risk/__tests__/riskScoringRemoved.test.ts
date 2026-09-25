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
      'src/lib/risk/profiles/stakingAdapter.ts', // D26, 2026-09-25
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
      // stakingAdapter.ts was retained under D14 and DELETED under D26 (2026-09-25)
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

describe('D14 — no composite staking risk score is published anywhere', () => {
  /**
   * Owner decision, 2026-09-14 (D14): remove risk comparisons that could read as
   * a recommendation. The line the owner drew: "Risk metrics that use traditional
   * financial formulas can stay and should be visible where appropriate" — so
   * Sharpe, Sortino, volatility, drawdown and beta are arithmetic and stay, while
   * this app's own weighted 1–10 / 0–100 staking composite is a judgment and goes.
   *
   * WHAT STAYS, and why this file must not over-reach: the six curated risk
   * DIMENSIONS remain on every surface that carried them. A composite is one
   * number that ranks providers against each other; the dimensions are the
   * inputs. Cards describing the dimensions WITHOUT a composite are the decided
   * state (RP-3, 2026-08-17), not a half-built feature.
   *
   * ⚠ The D14 ruling asserted the public API was `computeOverallRisk`'s only
   * consumer. It was not — `live-data/staking-discovery` imported it too, with
   * its own `max_risk` filter. Both are covered here, because leaving one would
   * have made the ruling's own instruction (delete the helpers) impossible.
   */

  const mcp = () =>
    fs.readFileSync(path.join(process.cwd(), '..', 'mcp-server', 'src', 'index.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

  /**
   * True if `key` appears as an object property / shorthand on a line of its own.
   *
   * Deliberately line-based rather than a RegExp: the `note` field on the v1
   * route is a long STRING that names every removed field on purpose, and the
   * comment stripper cannot touch a string. A bare `toContain('safetyScore')`
   * would therefore fail on documentation while a badly-escaped RegExp would
   * pass on anything. This matches the one thing that means the field is really
   * being served — a property in the response literal.
   */
  const servesKey = (src: string, key: string) =>
    src.split(/\r?\n/).some((line) => {
      const t = line.trim()
      return t.startsWith(`${key}:`) || t.startsWith(`${key},`) || t === key
    })

  it('the legacy helpers are gone from stakingProviders.ts', () => {
    // They survived only because /api/v1 served their output (R2 §5.3). With the
    // published fields gone they had no consumer left.
    const src = read('src/lib/data/stakingProviders.ts')
    expect(src).not.toMatch(/export function computeOverallRisk/)
    expect(src).not.toMatch(/export function getRiskLevel/)
    // mergedRisks went with the six dimensions on 2026-09-25 (D26).
    expect(src).not.toMatch(/export function mergedRisks/)
  })

  it('the public API serves no composite and offers no risk filter', () => {
    const src = read('src/app/api/v1/staking/opportunities/route.ts')
    // Response keys, anchored to line starts so the `note` prose — which names
    // the removed fields on purpose, and is a string the stripper cannot touch —
    // does not mask a real regression.
    for (const key of ['safetyScore', 'riskScore', 'riskLevel', 'band']) {
      expect(servesKey(src, key), `${key} is back on the v1 response`).toBe(false)
    }
    expect(src).not.toContain('computeOverallRisk')
    expect(src).not.toContain('scoreStakingProvider')
    // The filters, read from the query string rather than merely documented.
    for (const param of ['max_risk', 'min_safety', 'max_safety']) {
      expect(src, `${param} filter is back`).not.toContain(`searchParams.get('${param}')`)
    }
    // Under D14 the six dimensions were the half that stayed; D26 (2026-09-25)
    // removed them too. riskDimensionsRemoved.test.ts owns that guard.
    expect(servesKey(src, 'riskBreakdown'), 'riskBreakdown is back on the v1 response').toBe(false)
  })

  it('staking-discovery serves no composite and offers no risk filter', () => {
    // The consumer the D14 ruling did not name.
    const src = read('src/app/live-data/staking-discovery/route.ts')
    for (const key of ['riskScore', 'riskLevel', 'riskCanonical', 'band']) {
      expect(servesKey(src, key), `${key} is back on the discovery response`).toBe(false)
    }
    expect(src).not.toContain('computeOverallRisk')
    expect(src).not.toContain('scoreStakingProvider')
    expect(src).not.toContain("searchParams.get('max_risk')")
    // The derived dimensions went under D26 as well.
    expect(src).not.toMatch(/risks:\s+RiskProfile/)
  })

  it('the MCP server exposes no risk comparison tool', () => {
    const src = mcp()
    // RP-3's rejected surface reached the same reader through MCP.
    expect(src).not.toContain("'compare_staking_risk'")
    expect(src).not.toContain('safetyScore')
    expect(src).not.toContain('riskLevel')
    // get_staking_opportunities survives, without risk filters.
    expect(src).toContain("'get_staking_opportunities'")
    expect(src).not.toContain("params.set('max_risk'")
    expect(src).not.toContain("params.set('min_safety'")
    expect(src).not.toContain('riskBreakdown') // D26
  })

  it('the /staking page ranks nothing in prose', () => {
    // D14's note: "The list does not sort by risk; only the prose ranks." It did
    // not sort by rate either — filteredProviders is a filter with no .sort().
    const src = read('src/app/(dashboard)/staking/page.tsx')
    for (const claim of [
      'highest counterparty risk',
      'lowest custody risk',
      'Ordering here is by risk',
    ]) {
      expect(src, `ranking copy is back: "${claim}"`).not.toContain(claim)
    }
    // The affiliate-neutrality promise must survive the rewrite — it is a
    // disclosure obligation, not decoration.
    expect(src).toContain('never')
    expect(src).toMatch(/whether we are paid/)
  })

  it('guards the guard: the stripper leaves code but removes the tombstones', () => {
    // Every tombstone above is a comment naming what it removed. If the stripper
    // broke, the assertions would match those notes and fail for the right
    // reason — but this pins the direction explicitly.
    const src = read('src/lib/data/stakingProviders.ts')
    expect(src).not.toContain('DELETED on 2026-09-14')
    expect(src).toContain('export const STAKING_PROVIDERS')
    expect(mcp()).not.toContain('REMOVED 2026-09-14')
  })
})
