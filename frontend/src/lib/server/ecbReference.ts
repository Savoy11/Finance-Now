import 'server-only'

import { recordProviderFetch } from '@/lib/api/live/providers'
import { rangeStart, type HistoryRange } from '@/lib/data/dailyHistory'
import {
  ECB_PAIRS, buildPairHistory, currenciesFor, latestPairRate,
  type EuroRatesDay, type LatestPairRate, type PairHistoryPoint,
} from '@/lib/data/fxReference'
import type { CurrencyEntry } from '@/lib/data/currencyCatalog'

// ─── The ECB's daily reference rates, as currency pairs (T-445, D203) ────────
// Shared by /live-data/fx-reference-pairs (every pair's newest rate),
// /live-data/fx-pair-history (one pair's history) and the macro agent's tools,
// so all of them read one source. Frankfurter (api.frankfurter.dev, keyless,
// verified 2026-10-04) republishes the ECB's rates with the euro as base, which
// is how the Bank publishes them; the pair arithmetic is ours and pure, in
// lib/data/fxReference.ts. The ECB's terms are registered under ecb.europa.eu
// in lib/server/sourceTerms.ts.
//
// One request per question: a range is one time-series request for the pair's
// two legs. The ECB publishes once a working day, so a cache of an hour (six for
// a span of years) is generous, and the start date moves daily, so each range
// is one cached request per pair per day.

const FRANKFURTER = 'https://api.frankfurter.dev/v1'

interface FrankfurterSeries {
  rates?: Record<string, Record<string, number>>
}

/** Every day the ECB published from `from` on, for these currencies against the euro. */
export async function fetchEuroRatesSince(from: string, currencies: readonly string[], revalidate: number): Promise<EuroRatesDay[]> {
  try {
    const url = `${FRANKFURTER}/${from}..?base=EUR&symbols=${currencies.join(',')}`
    const res = await fetch(url, { next: { revalidate }, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`frankfurter ${res.status}`)
    const data: FrankfurterSeries = await res.json()
    if (!data.rates || typeof data.rates !== 'object') throw new Error('malformed frankfurter time series')
    const days = Object.entries(data.rates).map(([date, rates]) => ({ date, rates }))
    recordProviderFetch('frankfurter', { count: days.length })
    return days
  } catch (err) {
    recordProviderFetch('frankfurter', { error: err instanceof Error ? err.message : 'fetch failed' })
    throw err
  }
}

export interface PairHistory {
  pair: CurrencyEntry
  range: HistoryRange
  interval: 'daily' | 'weekly'
  points: PairHistoryPoint[]
}

/** One pair's history over a range. Throws when no day could be priced. */
export async function fetchPairHistory(pair: CurrencyEntry, range: HistoryRange, now: Date = new Date()): Promise<PairHistory> {
  const legs = currenciesFor([pair])
  const days = await fetchEuroRatesSince(rangeStart(range, now), legs, range === '5y' || range === '10y' ? 21_600 : 3_600)
  const { interval, points } = buildPairHistory(pair, days, range, now)
  if (points.length === 0) throw new Error(`the ECB published no ${pair.name} rate in this range`)
  return { pair, range, interval, points }
}

export interface LatestPairRates {
  /** The newest publication date among the pairs. */
  date: string
  pairs: Record<string, LatestPairRate>
  /** Slugs the newest days could not price. */
  missing: string[]
}

/** Each catalog pair's newest rate and its change since the previous working day, in one request. */
export async function fetchLatestPairRates(now: Date = new Date()): Promise<LatestPairRates> {
  // Ten days back covers a long weekend and the ECB's holiday closures.
  const from = new Date(now.getTime() - 10 * 86_400_000).toISOString().slice(0, 10)
  const days = await fetchEuroRatesSince(from, currenciesFor(ECB_PAIRS), 3_600)
  const pairs: Record<string, LatestPairRate> = {}
  const missing: string[] = []
  for (const p of ECB_PAIRS) {
    const r = latestPairRate(p, days)
    if (r) pairs[p.slug] = r
    else missing.push(p.slug)
  }
  const dates = Object.values(pairs).map((r) => r.date).sort()
  if (dates.length === 0) throw new Error('the ECB published no rate in the last ten days')
  return { date: dates[dates.length - 1], pairs, missing }
}
