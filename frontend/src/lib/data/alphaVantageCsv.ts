// Reading Alpha Vantage's CSV calendars (IPO_CALENDAR, EARNINGS_CALENDAR). Pure.
//
// Both send CSV on success and JSON on failure, with HTTP 200 either way, so the body is read as
// text and sorted here. Shared since T-458 (D213), when the earnings calendar joined the IPO one.

export type AlphaVantageFailure = {
  ok: false
  /**
   * `rate-limited` is kept apart from every other failure: the free tier's 25 requests a day is a
   * condition of the terms entry, and the throttle arrives as a JSON note with HTTP 200. Shown as
   * an empty calendar it would read as "nothing scheduled", a claim about the market rather than
   * about our quota.
   */
  reason: 'rate-limited' | 'provider-message' | 'unparseable'
  detail: string
}

export type AlphaVantageCsv = { ok: true; header: string[]; rows: string[][] } | AlphaVantageFailure

/**
 * One CSV line into cells, honouring double quotes ("Acme, Inc." stays one cell, and "" inside
 * quotes is a quote). Cells are trimmed.
 */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { cells.push(cur.trim()); cur = '' }
    else cur += ch
  }
  cells.push(cur.trim())
  return cells
}

/**
 * A row with more cells than the header has an unquoted comma in its one free-text column (a
 * company's name: "Jones Energy, Inc."). The surplus is joined back into that column, so the
 * columns after it are read from the right places rather than shifted by one.
 */
export function fitRow(cells: string[], width: number, freeTextIndex: number): string[] {
  const surplus = cells.length - width
  if (surplus <= 0 || freeTextIndex < 0 || freeTextIndex >= width) return cells
  return [
    ...cells.slice(0, freeTextIndex),
    cells.slice(freeTextIndex, freeTextIndex + surplus + 1).join(', '),
    ...cells.slice(freeTextIndex + surplus + 1),
  ]
}

/** Header lower-cased, rows split; or why the body is not a calendar. */
export function readAlphaVantageCsv(body: string): AlphaVantageCsv {
  const text = (body ?? '').trim()
  if (!text) return { ok: false, reason: 'unparseable', detail: 'empty response body' }

  // Throttling and key problems arrive as JSON, with HTTP 200.
  if (text.startsWith('{')) {
    let msg = text.slice(0, 300)
    try {
      const j = JSON.parse(text) as Record<string, string>
      msg = j.Information ?? j.Note ?? j['Error Message'] ?? msg
    } catch { /* keep the raw prefix */ }
    const throttled = /rate limit|per day|higher API call|premium|frequency/i.test(msg)
    return { ok: false, reason: throttled ? 'rate-limited' : 'provider-message', detail: msg }
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) return { ok: false, reason: 'unparseable', detail: 'no lines' }
  return {
    ok: true,
    header: splitCsvLine(lines[0]).map((h) => h.toLowerCase()),
    rows: lines.slice(1).map(splitCsvLine),
  }
}
