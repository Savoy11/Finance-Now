'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { ASSET_PAGE_RATINGS_SHOWN } from '@/lib/risk/visibility'
import { METHODOLOGY_V1 as M } from '@/lib/risk/methodology/v1'
import { SourceLine } from '@/components/ui/SourceLine'
import { describeRaw, formatValue, wholePercent } from '@/lib/risk/ratingFormat'
import {
  CLASS_COUNT, CRYPTO_VOLUME_CAVEAT, METHODOLOGY_PATH, NOT_ADVICE_LINE, NOT_ASSESSED_SENTENCE, NOT_RATED_HEADING,
  RATING_DISCLOSURES, cappedSentence, heldSentence, ratingHeading, recentVolatilitySentence, scoreSentence,
} from '@/lib/risk/ratingCopy'
import type { DimensionResult, RatedAssetKind, RatingClassNumber } from '@/lib/risk/assetRating'
import type { AssetRatingResponse } from '@/lib/risk/ratingResponse'

/**
 * The measured-risk rating on a coin's or a stock's own page (T-420 item 5; D92).
 *
 * Renders NOTHING while ASSET_PAGE_RATINGS_SHOWN is false, and checks the switch before
 * anything else mounts, so no request is made either: the same component-boundary
 * pattern as <ModuleGate>. lib/risk/__tests__/assetRatingsHidden.test.ts holds that this
 * is the only component that reads a rating, and that it checks the switch first.
 */
export function AssetRatingPanel({ kind, id }: { kind: RatedAssetKind; id: string }) {
  if (!ASSET_PAGE_RATINGS_SHOWN) return null
  return <AssetRatingLoader kind={kind} id={id} />
}

const HOUR = 60 * 60 * 1000

function AssetRatingLoader({ kind, id }: { kind: RatedAssetKind; id: string }) {
  const url = kind === 'crypto'
    ? `/live-data/coin-rating?id=${encodeURIComponent(id)}`
    : `/live-data/stock-rating?symbol=${encodeURIComponent(id)}`
  const { data, isLoading } = useQuery<AssetRatingResponse>({
    queryKey: ['asset-rating', kind, id],
    queryFn: async () => {
      try {
        const res = await fetch(url)
        const body = await res.json() as Partial<AssetRatingResponse> & { error?: string }
        // A refusal from the access guard is not in the rating's shape; say so rather than guess.
        if (typeof body.ok !== 'boolean') return unavailable(kind, id, body.error ?? `HTTP ${res.status}`)
        return body as AssetRatingResponse
      } catch (e) {
        return unavailable(kind, id, e instanceof Error ? e.message : String(e))
      }
    },
    // Worked out once a day; there is nothing new to fetch within the hour.
    staleTime: HOUR,
    retry: 1,
  })

  if (isLoading || !data) {
    return (
      <section className="rounded-card border border-border bg-bg-card p-4">
        <p className="text-sm text-text-muted">{M.heading}: loading…</p>
      </section>
    )
  }
  return <AssetRatingView kind={kind} data={data} />
}

function unavailable(kind: RatedAssetKind, id: string, error: string): AssetRatingResponse {
  return { ok: false, kind, id, error, methodologyVersion: M.version, computedAt: new Date().toISOString() }
}

// ── the view (pure: props in, markup out; rendered in tests) ─────────────────

const PRICE_SOURCE_NAMES: Record<string, string> = { tiingo: 'Tiingo', fmp: 'FMP' }

/** The 1–7 row with the shown class marked, as on the EU's risk indicator. Neutral colour: it measures, it does not warn. */
function ClassScale({ shown }: { shown: RatingClassNumber }) {
  return (
    <div className="space-y-1">
      <ol className="flex gap-1" aria-label={`Class ${shown} on a scale of 1 to ${CLASS_COUNT}`}>
        {M.classes.map((c) => (
          <li
            key={c.cls}
            aria-current={c.cls === shown ? 'true' : undefined}
            className={clsx(
              'flex size-7 items-center justify-center rounded-sm border text-xs font-semibold tabular-nums',
              c.cls === shown ? 'border-accent-blue bg-accent-blue/15 text-accent-blue' : 'border-border text-text-muted',
            )}
          >
            {c.cls}
          </li>
        ))}
      </ol>
      <p className="flex justify-between text-[10px] text-text-muted" style={{ width: `${CLASS_COUNT * 2}rem` }}>
        <span>Lower measured risk</span><span>Higher</span>
      </p>
    </div>
  )
}

function DimensionRows({ kind, dimensions }: { kind: RatedAssetKind; dimensions: DimensionResult[] }) {
  const specs = (kind === 'crypto' ? M.crypto : M.stock).dimensions
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-bg-elevated text-text-primary">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Part</th>
            <th scope="col" className="px-3 py-2 font-semibold">Measured</th>
            <th scope="col" className="px-3 py-2 font-semibold">Sub-score</th>
            <th scope="col" className="px-3 py-2 font-semibold">Weight</th>
            <th scope="col" className="px-3 py-2 font-semibold">Window</th>
            <th scope="col" className="px-3 py-2 font-semibold">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-text-secondary">
          {dimensions.map((d) => {
            const spec = specs.find((s) => s.key === d.key)
            const raws = Object.entries(d.raw)
            return (
              <tr key={d.key} className="align-top">
                <td className="px-3 py-1.5 font-medium text-text-primary">{d.label}</td>
                <td className="px-3 py-1.5">
                  {raws.length > 0 ? raws.map(([k, v]) => <div key={k}>{describeRaw(k, v)}</div>) : '—'}
                  {d.note && <div className="text-text-muted">{d.note}</div>}
                </td>
                <td className="px-3 py-1.5 tabular-nums">{d.subScore ?? '—'}</td>
                <td className="px-3 py-1.5 tabular-nums">
                  {d.weight === 0 ? 'not applied'
                    : d.effectiveWeight == null ? `${wholePercent(d.weight)} (missing)`
                    : d.effectiveWeight === d.weight ? wholePercent(d.weight)
                    : `${wholePercent(d.effectiveWeight)} (set at ${wholePercent(d.weight)})`}
                </td>
                <td className="px-3 py-1.5">{spec?.window ?? '—'}</td>
                <td className="px-3 py-1.5">{spec?.source ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function AssetRatingView({ kind, data }: { kind: RatedAssetKind; data: AssetRatingResponse }) {
  return (
    <section aria-label={M.heading} className="space-y-3 rounded-card border border-border bg-bg-card p-4">
      {!data.ok ? (
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{M.heading}</h2>
          <p className="mt-1 text-sm text-text-secondary">Not available right now.</p>
          <p className="mt-0.5 text-xs text-text-muted">{data.error}</p>
        </div>
      ) : !data.rated ? (
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{NOT_RATED_HEADING}</h2>
          <p className="mt-1 text-sm text-text-secondary">{data.reason}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-text-primary">
                {ratingHeading(data.shown.cls)} <span className="font-normal text-text-secondary">· {data.shown.label}</span>
              </h2>
              <ClassScale shown={data.shown.cls} />
              {data.shown.held && <p className="text-xs text-text-secondary">{heldSentence(data.shown.cls, data.shown.currentCls)}</p>}
              <p className="text-xs text-text-secondary">{scoreSentence(data.rating.score)}</p>
              {data.rating.capped && (
                <p className="text-xs text-text-secondary">{cappedSentence(data.rating.score, data.rating.coreScore, data.rating.coreCls)}</p>
              )}
            </div>
            <div className="text-right text-[11px] text-text-muted">
              {data.asOf && <p>Data to {data.asOf}</p>}
              <p>Methodology {data.methodologyVersion}</p>
            </div>
          </div>

          <ul className="list-disc space-y-0.5 pl-4 text-xs text-text-secondary">
            {RATING_DISCLOSURES.map((s) => <li key={s}>{s}</li>)}
          </ul>

          <DimensionRows kind={kind} dimensions={data.rating.dimensions} />

          <div className="space-y-0.5 text-[11px] text-text-muted">
            {data.rating.recentVolatility != null && (
              <p>{recentVolatilitySentence(formatValue(data.rating.recentVolatility, 'percent'))}</p>
            )}
            <p>
              Daily prices to {data.sources.prices.asOf ?? '—'} from {PRICE_SOURCE_NAMES[data.sources.prices.source] ?? data.sources.prices.source}
              {kind === 'stock' && data.sources.marketCap.asOf && <> · market cap: {data.sources.marketCap.source.toLowerCase()} as of {data.sources.marketCap.asOf}</>}
              {data.sources.fundamentals?.periodEnd && <> · filing: fiscal year ending {data.sources.fundamentals.periodEnd}</>}
              {data.sources.fundamentals?.balanceSheetAsOf && <>, balance sheet {data.sources.fundamentals.balanceSheetAsOf}</>}
            </p>
            {kind === 'crypto' && <p>{CRYPTO_VOLUME_CAVEAT}</p>}
            <p>{NOT_ASSESSED_SENTENCE}</p>
          </div>
          <SourceLine id={kind === 'crypto' ? 'coin-rating' : 'stock-rating'} />
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-[11px] text-text-muted">
        <p>{NOT_ADVICE_LINE}</p>
        <Link href={METHODOLOGY_PATH} className="text-accent-blue/80 hover:text-accent-blue">How this rating is worked out</Link>
      </div>
    </section>
  )
}
