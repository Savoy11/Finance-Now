/**
 * Why an equity scan's symbols came back with no history, in words (T-129, 2026-10-24).
 *
 * /live-data/security-ohlcv names each provider it tried and why it failed
 * ("tiingo: Tiingo 429"). The Equity Scanner said only that "the OHLCV providers
 * are key-gated", which on the owner's machine, with both keys set, sent a reader
 * after a missing key: the measured cause was Tiingo's hourly request limit (429)
 * with FMP's free plan not covering the symbol (402). This groups the rows by the
 * reasons they share, so the scanner can say which it is.
 */

const STATUS_WORDS: Record<string, string> = {
  '401': 'key refused',
  '402': 'not on this plan',
  '403': 'not on this plan',
  '404': 'symbol not found',
  '429': 'request limit reached',
}

/** "tiingo: Tiingo 429" → "Tiingo: request limit reached (429)". Anything else is kept as it came. */
export function describeOhlcvFailure(failure: string): string {
  const m = failure.match(/^[^:]+:\s*(\S+)\s+(\d{3})$/)
  if (!m) return failure.replace(/^[^:]+:\s*/, '')
  const [, provider, status] = m
  const words = STATUS_WORDS[status]
  return words ? `${provider}: ${words} (${status})` : `${provider}: HTTP ${status}`
}

export interface FailureGroup {
  /** The providers' reasons in the order they were tried, joined with "; ". */
  reason: string
  count: number
}

/**
 * Group failed rows by their reasons, most common first. A row with no reasons
 * (an older response, or the request itself failing) counts as "no reason given",
 * never as some other row's reason.
 */
export function groupOhlcvFailures(rows: Array<{ failures?: string[] }>): FailureGroup[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const reason = row.failures?.length
      ? row.failures.map(describeOhlcvFailure).join('; ')
      : 'no reason given'
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
}
