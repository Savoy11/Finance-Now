// ─────────────────────────────────────────────────────────────────────────────
// STABLECOIN PEG HISTORY (T-467, owner decision D242, 2026-11-24).
//
// Has this coin actually held its peg? The Reserve Monitor stated only the
// present tense — today's price, supply and mix — and the alert bell fires on a
// current deviation. This module answers the track-record question with facts
// and dates only, the posture D204 chose for supply: the largest distance a
// coin's price moved from $1 over the window and the day it happened, how many
// daily readings sat more than half a percent off, and the readings themselves
// for a small chart. No grade, no band, no "stable/unstable" word, no alert.
//
// THE SOURCE is the Monitor's own host (stablecoins.llama.fi — the DefiLlama
// sourceTerms entry covers it): /stablecoinprices, one request carrying every
// coin's one price per day, keyed by the same geckoIds the hand-kept
// DEFILLAMA_STABLECOINS table already records per monitored coin (D190 — the
// coin is picked by its own identifier, never a ticker). The prices are
// DefiLlama's DAILY READINGS, not exchange closes, and the figures say so.
//
// ONLY DOLLAR-PEGGED COINS get a history: the readings are dollar prices, so a
// euro-pegged coin's distance from ITS peg cannot be read from them (EURS sits
// near $1.09 because the euro does). The route checks each coin's pegType and
// names any coin excluded, rather than computing a wrong figure.
// ─────────────────────────────────────────────────────────────────────────────

/** One row of /stablecoinprices: a day, and each coin's price that day by geckoId. */
export interface PegPriceRow {
  /** Unix seconds. The feed's first row carries date 0 and is dropped. */
  date: number
  prices: Record<string, number>
}

export interface PegDayReading {
  /** ISO day. */
  date: string
  /** DefiLlama's daily dollar-price reading. */
  price: number
}

export interface PegHistory {
  /** Oldest first — the window's readings, for the chart. */
  readings: PegDayReading[]
  /** The largest move from $1 in the window, signed, percent. */
  maxDevPct: number
  /** The day it happened. */
  maxDevDate: string
  /** Readings more than PEG_OFF_THRESHOLD_PCT from $1. */
  daysOffHalfPct: number
  /** How many daily readings the window actually had for this coin. */
  daysCovered: number
}

/** The window, in days of readings. */
export const PEG_HISTORY_DAYS = 90

/** "More than half a percent off" — the counted threshold, shown wherever the count is. */
export const PEG_OFF_THRESHOLD_PCT = 0.5

const isoDay = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString().slice(0, 10)

/** The rows inside the window, oldest first, junk rows (date 0, duplicates) dropped. */
export function windowRows(rows: readonly PegPriceRow[], now: Date = new Date(), days: number = PEG_HISTORY_DAYS): PegPriceRow[] {
  const cutoff = now.getTime() / 1000 - days * 86_400
  const seen = new Set<string>()
  return rows
    .filter((r) => Number.isFinite(r.date) && r.date > 1_000_000_000 && r.date <= now.getTime() / 1000 + 86_400 && r.date >= cutoff)
    .sort((a, b) => a.date - b.date)
    .filter((r) => {
      const day = isoDay(r.date)
      if (seen.has(day)) return false
      seen.add(day)
      return true
    })
}

/**
 * One coin's history from the windowed rows, by its geckoId — or null when the
 * window holds no reading for it at all. A day the feed carries no price for
 * this coin is left out and the coverage count says so; it is never read as $1.
 */
export function pegHistoryFor(geckoId: string, rows: readonly PegPriceRow[]): PegHistory | null {
  const readings: PegDayReading[] = []
  for (const row of rows) {
    const price = row.prices[geckoId]
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) continue
    readings.push({ date: isoDay(row.date), price })
  }
  if (readings.length === 0) return null

  let maxDevPct = 0
  let maxDevDate = readings[0].date
  let daysOffHalfPct = 0
  for (const r of readings) {
    const dev = (r.price - 1) * 100
    if (Math.abs(dev) > Math.abs(maxDevPct)) {
      maxDevPct = dev
      maxDevDate = r.date
    }
    if (Math.abs(dev) > PEG_OFF_THRESHOLD_PCT) daysOffHalfPct++
  }
  return { readings, maxDevPct, maxDevDate, daysOffHalfPct, daysCovered: readings.length }
}

/** "−0.22%" / "+0.04%" — the signed move, two places. */
export function formatDevPct(devPct: number): string {
  const rounded = devPct.toFixed(2)
  return `${devPct > 0 && rounded !== '0.00' ? '+' : ''}${rounded}%`
}
