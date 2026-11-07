// ─── Currency pairs from the European Central Bank's reference rates ─────────
// T-445, owner decision D203 (2026-11-07): every pair in the currency catalog
// shows the ECB's daily reference rate where it would otherwise show a dash,
// on its own pages (the Currencies table, the pair pages and the Macro
// overview), and charts it from the ECB's daily history. The keyed quote
// ladder still comes first wherever it answers; Compare, watchlists and
// portfolios are unchanged (the owner's choice).
//
// The ECB publishes each currency against the euro: "1 EUR = 1.1165 USD". A pair
// without the euro is worked out from two of those, on the same day:
//
//   1 BASE in QUOTE = (QUOTE per 1 EUR) ÷ (BASE per 1 EUR)
//
// so USD/JPY = 176.77 ÷ 1.1165 = 158.33. The ECB's terms ask that a change to its
// figures be stated, which is why every surface says the pair is worked out from
// the euro rates (lib/server/sourceTerms.ts, the ecb.europa.eu entry). The rates
// are published "for information purposes only", once a working day, never a
// dealable price, and are labelled daily rather than live. Pure; the fetching is
// lib/server/ecbReference.ts.

import { CURRENCY_CATALOG, type CurrencyEntry } from './currencyCatalog'
import { closingCandlesOf, intervalFor, lastOfEachWeek, rangeStart, type ClosingCandle, type HistoryRange } from './dailyHistory'

/** One day of ECB reference rates: ISO code → units per 1 euro. The euro itself is implied at 1. */
export interface EuroRatesDay {
  /** YYYY-MM-DD */
  date: string
  rates: Readonly<Record<string, number>>
}

/** The catalog pairs the ECB's rates price: every one but the Dollar Index, which is ICE's index. */
export const ECB_PAIRS: readonly CurrencyEntry[] = CURRENCY_CATALOG.filter((c) => c.category !== 'index')

const BY_SLUG = new Map(ECB_PAIRS.map((c) => [c.slug, c]))
const BY_SYMBOL = new Map(ECB_PAIRS.map((c) => [c.symbol, c]))

export const ecbPairBySlug = (slug: string): CurrencyEntry | undefined => BY_SLUG.get(slug)
export const ecbPairBySymbol = (symbol: string): CurrencyEntry | undefined => BY_SYMBOL.get(symbol)

/** The currencies to ask the ECB for: every leg of the given pairs but the euro, sorted. */
export function currenciesFor(pairs: readonly Pick<CurrencyEntry, 'base' | 'quote'>[]): string[] {
  return [...new Set(pairs.flatMap((p) => [p.base, p.quote]))].filter((c) => c !== 'EUR').sort()
}

/** Whether a pair has no euro leg, so its rate is worked out from two euro rates. */
export const isWorkedOut = (pair: Pick<CurrencyEntry, 'base' | 'quote'>) => pair.base !== 'EUR'

const perEuro = (rates: Readonly<Record<string, number>>, code: string): number | null => {
  if (code === 'EUR') return 1
  const v = rates[code]
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
}

/** Six significant figures: the ECB publishes five or six, so more would be false precision. */
const sig6 = (v: number) => Number(v.toPrecision(6))

/**
 * 1 BASE in QUOTE from one day's euro rates, or null when either leg is missing
 * that day. Never a neighbouring day's figure: a rate made of two days is not a
 * rate anyone published.
 */
export function pairRate(pair: Pick<CurrencyEntry, 'base' | 'quote'>, rates: Readonly<Record<string, number>>): number | null {
  const quote = perEuro(rates, pair.quote)
  const base = perEuro(rates, pair.base)
  if (quote === null || base === null) return null
  return sig6(quote / base)
}

export interface PairHistoryPoint {
  /** YYYY-MM-DD */
  date: string
  rate: number
}

/** One pair's rate on each day from `from` on, oldest first; a day missing a leg is left out. */
export function buildPairHistory(
  pair: Pick<CurrencyEntry, 'base' | 'quote'>,
  days: readonly EuroRatesDay[],
  range: HistoryRange,
  now: Date,
): { interval: 'daily' | 'weekly'; points: PairHistoryPoint[] } {
  const from = rangeStart(range, now)
  const interval = intervalFor(range)
  const seen = new Set<string>()
  const out: PairHistoryPoint[] = []
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    if (d.date < from || seen.has(d.date)) continue
    const rate = pairRate(pair, d.rates)
    if (rate === null) continue
    seen.add(d.date)
    out.push({ date: d.date, rate })
  }
  return { interval, points: interval === 'daily' ? out : lastOfEachWeek(out) }
}

/** A pair's history as closing-only candles: one figure a working day, no high, low or volume. */
export function pairClosingCandles(points: readonly PairHistoryPoint[]): ClosingCandle[] {
  return closingCandlesOf(points, (p) => p.rate)
}

export interface LatestPairRate {
  /** The newest day the ECB published both legs. */
  date: string
  rate: number
  /** The working day before it on which both legs were published, if any. */
  previousDate?: string
  previousRate?: number
  /** Change since that day, percent, to hundredths. */
  changePct?: number
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** A pair's newest rate and its change since the ECB's previous working day, or null. */
export function latestPairRate(pair: Pick<CurrencyEntry, 'base' | 'quote'>, days: readonly EuroRatesDay[]): LatestPairRate | null {
  const priced = [...days]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((d) => ({ date: d.date, rate: pairRate(pair, d.rates) }))
    .filter((d): d is PairHistoryPoint => d.rate !== null)
  const [now, before] = priced
  if (!now) return null
  if (!before || before.date === now.date) return { date: now.date, rate: now.rate }
  return {
    date: now.date, rate: now.rate, previousDate: before.date, previousRate: before.rate,
    changePct: round2(((now.rate - before.rate) / before.rate) * 100),
  }
}

export interface ShownPairRate {
  price: number
  /** Live: today's change. ECB: the change since the Bank's previous working day. */
  changePct: number | null
  basis: 'live' | 'ecb'
  /** The ECB publication date, for an ECB rate. */
  date?: string
  previousDate?: string
}

/**
 * What a pair's row shows: the live quote where the keyed ladder has one, and
 * the ECB's daily rate only where it would otherwise be a dash (D203). Null
 * when neither has a figure.
 */
export function shownPairRate(
  live: { price: number | null; changePercent: number | null } | null | undefined,
  ecb: LatestPairRate | null | undefined,
): ShownPairRate | null {
  if (live?.price != null && Number.isFinite(live.price)) {
    return { price: live.price, changePct: live.changePercent ?? null, basis: 'live' }
  }
  if (ecb) return { price: ecb.rate, changePct: ecb.changePct ?? null, basis: 'ecb', date: ecb.date, previousDate: ecb.previousDate }
  return null
}

/** How a pair's rate was arrived at, in a sentence, for every surface that shows one (the ECB asks for it). */
export function pairRateBasis(pair: Pick<CurrencyEntry, 'base' | 'quote' | 'name'>): string {
  return isWorkedOut(pair)
    ? `${pair.name} is worked out from the European Central Bank’s euro reference rates: ${pair.quote} per euro divided by ${pair.base} per euro, on the same day.`
    : `${pair.name} is the European Central Bank’s own euro reference rate.`
}

/**
 * Shown wherever an ECB rate is: what it is, and (an ECB condition on reuse in
 * anything sold, the Macro module being a paid one at launch) that the Bank
 * publishes it free of charge.
 */
export const ECB_RATE_DESCRIPTION =
  'The European Central Bank’s euro reference rates, published once a working day around 16:00 CET for information only, not a dealable price.'
export const ECB_FREE_OF_CHARGE = 'The Bank publishes them free of charge on its website.'
/** Both, as plain text, for a surface with no room for a link (the agent tools). */
export const ECB_RATE_NOTE = `${ECB_RATE_DESCRIPTION} ${ECB_FREE_OF_CHARGE.replace('on its website', 'at ecb.europa.eu')}`
export const ECB_RATES_PAGE = 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html'
