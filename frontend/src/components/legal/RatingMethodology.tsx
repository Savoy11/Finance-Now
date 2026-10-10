import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { LEGAL_PATHS } from '@/lib/legal/links'
import { METHODOLOGY_V1 as M, type DimensionSpec } from '@/lib/risk/methodology/v1'
import { classRanges, curveRows, formatValue, wholePercent } from '@/lib/risk/ratingFormat'
import {
  CRYPTO_VOLUME_CAVEAT, HOLDINGS_POLICY, HOW_IT_BECOMES_A_CLASS, NOT_ADVICE_LINE, NOT_ASSESSED_SENTENCE,
  PROVISIONAL_SENTENCE, RATING_DISCLOSURES, TRACK_RECORD_SENTENCE, UNIVERSE, WHAT_IT_IS,
} from '@/lib/risk/ratingCopy'
import type { RatedAssetKind } from '@/lib/risk/assetRating'

/**
 * The public methodology for the measured-risk rating (T-420 item 5; the memo's §6 item 1).
 * Rendered from methodology/v1.ts and lib/risk/ratingCopy.ts only, so it can never describe
 * a number the engine does not use. Shown at /about/risk-ratings, which answers 404 while
 * ASSET_PAGE_RATINGS_SHOWN is false.
 */

function DimensionTable({ dimensions }: { dimensions: readonly DimensionSpec[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-bg-elevated text-text-primary">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Part</th>
            <th scope="col" className="px-3 py-2 font-semibold">Weight</th>
            <th scope="col" className="px-3 py-2 font-semibold">What it measures</th>
            <th scope="col" className="px-3 py-2 font-semibold">Window</th>
            <th scope="col" className="px-3 py-2 font-semibold">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-text-secondary">
          {dimensions.map((d) => (
            <tr key={d.key} className="align-top">
              <td className="px-3 py-1.5 font-medium text-text-primary">{d.label}</td>
              <td className="px-3 py-1.5 tabular-nums">{wholePercent(d.weight)}</td>
              <td className="px-3 py-1.5">{d.description}</td>
              <td className="px-3 py-1.5">{d.window}</td>
              <td className="px-3 py-1.5">{d.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CurveTable({ kind }: { kind: RatedAssetKind }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-bg-elevated text-text-primary">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Figure</th>
            <th scope="col" className="px-3 py-2 font-semibold">Value → sub-score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-text-secondary">
          {curveRows(kind).map((row) => (
            <tr key={row.key}>
              <td className="px-3 py-1.5 font-medium text-text-primary">{row.label}</td>
              <td className="px-3 py-1.5 tabular-nums">{row.points.join(' · ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const P = ({ children }: { children: ReactNode }) => <p className="text-sm leading-relaxed text-text-secondary">{children}</p>
const H2 = ({ children }: { children: ReactNode }) => <h2 className="text-base font-semibold text-text-primary">{children}</h2>

export function RatingMethodology() {
  return (
    <article className="space-y-6">
      <div className="space-y-2">
        <div><Link href={LEGAL_PATHS.about} className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-accent-blue">
          <ArrowLeft size={12} aria-hidden /> About &amp; Legal
        </Link></div>
        <h1 className="text-2xl font-semibold text-text-primary">How the measured-risk rating works</h1>
        <p className="text-xs text-text-muted">Methodology {M.version}</p>
      </div>

      <section className="space-y-2">
        <P>{WHAT_IT_IS}</P>
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-text-secondary">
          {RATING_DISCLOSURES.map((s) => <li key={s}>{s}</li>)}
          <li>{NOT_ADVICE_LINE}</li>
        </ul>
        <P>{NOT_ASSESSED_SENTENCE}</P>
        {M.provisional && <P>{PROVISIONAL_SENTENCE}</P>}
      </section>

      <section className="space-y-2">
        <H2>The scale</H2>
        <P>
          The headline is a class from 1 to {M.classes.length}, under the heading &ldquo;{M.heading}&rdquo;. Underneath it is a
          score from 0 to 100, where a higher score means lower measured risk, and every part that produced it. Coins and stocks
          share one scale, so a class means the same thing on every page. Most coins sit in the higher classes because their
          prices move far more than most stocks&rsquo;: that is the measurement.
        </P>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg-elevated text-text-primary">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Score</th>
                <th scope="col" className="px-3 py-2 font-semibold">Class</th>
                <th scope="col" className="px-3 py-2 font-semibold">Label</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-text-secondary">
              {classRanges().map((c) => (
                <tr key={c.cls}>
                  <td className="px-3 py-1.5 tabular-nums">{c.min}–{c.max}</td>
                  <td className="px-3 py-1.5 tabular-nums">{c.cls}</td>
                  <td className="px-3 py-1.5">{c.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <H2>Crypto coins</H2>
        <P>{UNIVERSE.crypto}</P>
        <DimensionTable dimensions={M.crypto.dimensions} />
        <CurveTable kind="crypto" />
        <P>
          Straight lines between the points; flat beyond the ends. Liquidity is capped at {M.cryptoThinVolumeCap} when median daily
          volume is under {formatValue(M.cryptoThinVolumeFloorUsd, 'usd')}. Medians, not means, so one spike cannot dominate.{' '}
          {CRYPTO_VOLUME_CAVEAT}
        </P>
      </section>

      <section className="space-y-2">
        <H2>Stocks</H2>
        <P>{UNIVERSE.stock}</P>
        <DimensionTable dimensions={M.stock.dimensions} />
        <CurveTable kind="stock" />
        <P>
          Fundamentals are left out for financial companies, because debt ÷ equity does not describe a lender&rsquo;s balance
          sheet; the other parts carry the weight. Negative shareholders&rsquo; equity makes debt ÷ equity meaningless, so that half
          scores {M.negativeEquityScore}. With no annual filing in the last {M.fundamentalsMaxAgeMonths} months, the part is missing.
          These are two components of standard financial-strength models, not a validated model themselves.
        </P>
      </section>

      <section className="space-y-2">
        <H2>How the score becomes a class</H2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-text-secondary">
          {HOW_IT_BECOMES_A_CLASS.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <P>
          Volatility over the last {M.recentVolatilityDays} days is shown beside the rating for context, because it reacts faster than
          the one-year figure. It never changes the class.
        </P>
      </section>

      <section className="space-y-2">
        <H2>Track record</H2>
        <P>{TRACK_RECORD_SENTENCE}</P>
      </section>

      <section className="space-y-2">
        <H2>Holdings policy</H2>
        <P>{HOLDINGS_POLICY ?? 'Not yet written. Ratings are not shown until it is.'}</P>
      </section>
    </article>
  )
}
