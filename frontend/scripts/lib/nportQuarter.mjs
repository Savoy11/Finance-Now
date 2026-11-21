// The quarter of an SEC N-PORT data set, read from its own address (T-449 c).
//
// build-fund-facts.mjs dated every figure by looking for "2026q3" in the names
// of the files it had extracted, which never carry it (the archive is saved as
// nport.zip and holds FUND_REPORTED_INFO.tsv and the like), so every figure fell
// back to the month the script ran: the file built in July 2026 says "2026-07"
// for all 25,003 tickers. The SEC names the archive after its quarter
// (".../2026q3_nport.zip"), so the quarter comes from there, and a run that
// cannot find it refuses to write rather than dating figures by guess.

/** "2026q3" from ".../2026q3_nport.zip", lower-cased, or null. */
export function quarterFromDatasetUrl(url) {
  const m = /(\d{4})q([1-4])_nport\.zip(?:$|[?#])/i.exec(String(url ?? ''))
  return m ? `${m[1]}q${m[2]}` : null
}

/**
 * Whether the archive already on disk is the one wanted: only when it exists
 * and the quarter recorded beside it is the newest one. An archive with no
 * recorded quarter (any made before this fix) is never trusted, since it may be
 * an older data set that would be labelled as the newest.
 */
export function cachedArchiveIsCurrent({ zipExists, cachedQuarter, newestQuarter }) {
  return Boolean(zipExists && cachedQuarter && newestQuarter && cachedQuarter === newestQuarter)
}
