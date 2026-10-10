import { describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AssetRatingPanel, AssetRatingView } from '@/components/markets/AssetRatingPanel'
import { RatingMethodology } from '@/components/legal/RatingMethodology'
import RiskRatingsMethodologyPage from '@/app/(legal)/about/risk-ratings/page'
import { rateAsset, type AssetRating, type AssetRatingInputs } from '../assetRating'
import { METHODOLOGY_V1 as M } from '../methodology/v1'
import { classRanges, curveRows, wholePercent } from '../ratingFormat'
import {
  CRYPTO_VOLUME_CAVEAT, METHODOLOGY_PATH, NOT_ADVICE_LINE, NOT_RATED_HEADING, RATING_DISCLOSURES, heldSentence, ratingHeading,
} from '../ratingCopy'
import type { AssetRatingResponse } from '../ratingResponse'
import { SUITABILITY_WORDS } from './suitabilityWords'

// The rating panel's view and the methodology page, rendered to HTML with ratings the real
// engine produced (T-420 item 5). Text is compared after decoding the entities React writes.

const NOW = new Date('2026-10-10T12:00:00Z')
type Rated = Extract<AssetRating, { rated: true }>

const html = (el: ReactElement) =>
  renderToStaticMarkup(el).replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
/** Visible text only, so attribute values and class names are not mistaken for copy. */
const text = (el: ReactElement) => html(el).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

function zigzag(n: number, swing: number, drift = 0): number[] {
  return Array.from({ length: n }, (_, i) => 100 * Math.exp(drift * i / (n - 1)) * (1 + swing * (i % 2 ? -1 : 1)))
}

function rated(inputs: AssetRatingInputs): Rated {
  const r = rateAsset(inputs, NOW)
  if (!r.rated) throw new Error(`fixture not rated: ${r.reason}`)
  return r
}

const CALM_COIN = rated({ kind: 'crypto', closes: zigzag(365, 0.01), dollarVolumes: Array(365).fill(3e10), marketCapUsd: 1e12 })
// Price falls ~85% with wide swings, but trades deeply and is large: the cap rule binds.
const CAPPED_COIN = rated({ kind: 'crypto', closes: zigzag(365, 0.08, -1.9), dollarVolumes: Array(365).fill(3e10), marketCapUsd: 1e12 })
const STOCK = rated({
  kind: 'stock', closes: zigzag(260, 0.005), volumes: Array(260).fill(5e7), marketCapUsd: 3e12, sector: 'technology',
  fundamentals: { longTermDebt: 8e10, shareholdersEquity: 6e10, netIncome: 1e11, revenue: 4e11, periodEnd: '2025-09-27' },
})

function response(kind: 'crypto' | 'stock', rating: Rated, shown: { cls?: number; held?: boolean } = {}): AssetRatingResponse {
  const cls = (shown.cls ?? rating.cls) as Rated['cls']
  return {
    ok: true, rated: true, kind, id: kind === 'crypto' ? 'btc' : 'AAPL', methodologyVersion: M.version,
    computedAt: NOW.toISOString(), asOf: '2026-10-09',
    shown: { cls, label: M.classes.find((c) => c.cls === cls)!.label, currentCls: rating.cls, held: shown.held ?? false, weeksInRun: 3 },
    rating,
    sources: kind === 'crypto'
      ? { prices: { source: 'CoinGecko daily history', asOf: '2026-10-09' }, marketCap: { source: 'CoinGecko', asOf: '2026-10-09' } }
      : {
          prices: { source: 'tiingo', asOf: '2026-10-09' },
          marketCap: { source: 'Catalog reference figure', asOf: '2026-07-07' },
          fundamentals: { source: 'SEC EDGAR (XBRL company facts)', periodEnd: '2025-09-27', balanceSheetAsOf: '2026-06-28' },
        },
  }
}

const withoutNotAdvice = (s: string) => s.replace(NOT_ADVICE_LINE, '')

describe('the rating panel', () => {
  it('renders nothing while the switch is off, and mounts no query (no QueryClient is needed)', () => {
    expect(renderToStaticMarkup(<AssetRatingPanel kind="crypto" id="btc" />)).toBe('')
    expect(renderToStaticMarkup(<AssetRatingPanel kind="stock" id="AAPL" />)).toBe('')
  })

  it('shows the class under the decided heading, every part, the disclosures and the credit', () => {
    const t = text(<AssetRatingView kind="crypto" data={response('crypto', CALM_COIN)} />)
    expect(t).toContain(ratingHeading(CALM_COIN.cls))
    expect(t).toContain(CALM_COIN.label)
    expect(t).toContain(`Score ${CALM_COIN.score} of 100`)
    for (const d of M.crypto.dimensions) {
      expect(t, d.label).toContain(d.label)
      expect(t, d.window).toContain(d.window)
    }
    for (const s of RATING_DISCLOSURES) expect(t).toContain(s)
    expect(t).toContain(CRYPTO_VOLUME_CAVEAT)
    expect(t).toContain('Powered by CoinGecko')
    expect(t).toContain('Computed by Finance Now from')
    expect(t).toContain(NOT_ADVICE_LINE)
    expect(t).toContain('Data to 2026-10-09')
    expect(t).toContain(`Methodology ${M.version}`)
    expect(html(<AssetRatingView kind="crypto" data={response('crypto', CALM_COIN)} />)).toContain(`href="${METHODOLOGY_PATH}"`)
  })

  it('marks the shown class on the 1–7 row, and only that one', () => {
    // Two fixtures in different classes, so marking any one fixed class cannot pass both.
    for (const r of [CALM_COIN, CAPPED_COIN]) {
      const h = html(<AssetRatingView kind="crypto" data={response('crypto', r)} />)
      expect(h.match(/aria-current="true"/g)).toHaveLength(1)
      expect(h).toMatch(new RegExp(`aria-current="true"[^>]*>${r.cls}<`))
    }
    expect(CALM_COIN.cls).not.toBe(CAPPED_COIN.cls)
  })

  it('says when the stability rule is holding the class, and what today’s score alone would give', () => {
    const shownCls = CALM_COIN.cls === 7 ? 6 : CALM_COIN.cls + 1
    const t = text(<AssetRatingView kind="crypto" data={response('crypto', CALM_COIN, { cls: shownCls, held: true })} />)
    expect(t).toContain(ratingHeading(shownCls as Rated['cls']))
    expect(t).toContain(heldSentence(shownCls as Rated['cls'], CALM_COIN.cls))
  })

  it('says when the cap rule lowered the score', () => {
    expect(CAPPED_COIN.capped).toBe(true)
    const t = text(<AssetRatingView kind="crypto" data={response('crypto', CAPPED_COIN)} />)
    expect(t).toContain(`capped at ${CAPPED_COIN.score}`)
    expect(t).toContain(`Price behaviour alone scores ${CAPPED_COIN.coreScore}, class ${CAPPED_COIN.coreCls}`)
  })

  it('a stock shows its dated market cap and filing, and no crypto caveat', () => {
    const t = text(<AssetRatingView kind="stock" data={response('stock', STOCK)} />)
    for (const d of M.stock.dimensions) expect(t, d.label).toContain(d.label)
    expect(t).toContain('from Tiingo')
    expect(t).toContain('market cap: catalog reference figure as of 2026-07-07')
    expect(t).toContain('fiscal year ending 2025-09-27')
    expect(t).not.toContain(CRYPTO_VOLUME_CAVEAT)
  })

  it('not rated: says so and why, with no class', () => {
    const data: AssetRatingResponse = {
      ok: true, rated: false, kind: 'crypto', id: 'usdc', reason: 'Stablecoins are not rated. This page shows facts only.',
      asOf: null, rating: null, sources: null, methodologyVersion: M.version, computedAt: NOW.toISOString(),
    }
    const h = html(<AssetRatingView kind="crypto" data={data} />)
    expect(h).toContain(NOT_RATED_HEADING)
    expect(h).toContain('Stablecoins are not rated')
    expect(h).not.toContain('aria-current')
  })

  it('unavailable: says so plainly', () => {
    const data: AssetRatingResponse = { ok: false, kind: 'stock', id: 'AAPL', error: 'SEC company facts: HTTP 500', methodologyVersion: M.version, computedAt: '' }
    expect(text(<AssetRatingView kind="stock" data={data} />)).toContain('Not available right now. SEC company facts: HTTP 500')
  })

  it('uses no suitability words outside the not-advice line, in any state', () => {
    for (const [kind, data] of [['crypto', response('crypto', CAPPED_COIN, { held: true })], ['stock', response('stock', STOCK)]] as const) {
      expect(withoutNotAdvice(text(<AssetRatingView kind={kind} data={data} />))).not.toMatch(SUITABILITY_WORDS)
    }
  })
})

describe('the methodology page', () => {
  const t = text(<RatingMethodology />)

  it('answers 404 while the switch is off', () => {
    expect(() => RiskRatingsMethodologyPage()).toThrow()
  })

  it('shows every class, weight and curve point the engine uses', () => {
    for (const c of classRanges()) expect(t).toContain(`${c.min}–${c.max} ${c.cls} ${c.label}`)
    for (const d of [...M.crypto.dimensions, ...M.stock.dimensions]) {
      expect(t).toContain(d.description)
      expect(t).toContain(wholePercent(d.weight))
    }
    for (const row of [...curveRows('crypto'), ...curveRows('stock')]) expect(t).toContain(row.points.join(' · '))
    expect(t).toContain(`Methodology ${M.version}`)
  })

  it('carries the disclosures, the provisional notice, and an unwritten holdings policy as unwritten', () => {
    for (const s of RATING_DISCLOSURES) expect(t).toContain(s)
    expect(t).toContain(NOT_ADVICE_LINE)
    expect(t).toContain('provisional')
    expect(t).toContain('Not yet written. Ratings are not shown until it is.')
  })

  it('uses no suitability words outside the not-advice line', () => {
    expect(withoutNotAdvice(t)).not.toMatch(SUITABILITY_WORDS)
  })
})
