// ─── Size and registrant for funds outside the catalog (T-449 c, D204) ────────
//
// scripts/build-fund-facts.mjs reads the SEC's quarterly N-PORT data set into
// src/lib/data/fundFacts.generated.json: for ~25,000 fund tickers, the fund's net
// assets and the name of the trust that filed (the registrant). Nothing read it
// until T-449 (T-392 closed it as moot). It now fills the issuer and size a fund
// page shows for a fund outside the 140-fund catalog; lib/server/fundFacts.ts
// reads the file, server-side only, since it is 2 MB.
//
// ⚠ WHAT THE FIGURE IS. N-PORT reports per SERIES, so a fund with several share
// classes reports them together: Vanguard's ETFs are share classes of a mutual
// fund, and VTI reads about $2.0 trillion against roughly $0.5 trillion for the
// ETF alone. Hence it is labelled FUND_NET_ASSETS_LABEL everywhere, never "AUM"
// (the build script's header says the same). And the registrant is the trust
// that filed ("VANGUARD INDEX FUNDS", "ARK ETF Trust"), not always the brand.
//
// ⚠ WHEN IT IS FROM. The script meant to date each figure by the data set's
// quarter, but read the quarter from file names that never carry it, so every
// figure in the file built in July 2026 is dated "2026-07", the month it ran.
// The script now keeps the quarter from the data set's own address; until the
// file is rebuilt, the figures say "built July 2026", which is what is known.

// The file's figures were built in July 2026 (their asOf); the day is not recorded, so the
// clock starts on the month's first day, the earliest it could have been.
// STALENESS-ACK: 2026-11-07 — the owner chose (D204) to show these figures now, dated "built
// July 2026", until the file is rebuilt on the owner's machine with `npm run fund-facts`, which
// downloads the SEC's ~420 MB quarterly data set. Re-running it and moving this date clears it.
export const FUND_FACTS_BUILT_ON = '2026-07-01'
/** N-PORT data sets are quarterly; past a quarter and a month, a newer one is out. */
export const FUND_FACTS_STALE_AFTER_DAYS = 120

export const FUND_NET_ASSETS_LABEL = 'Fund net assets, all share classes'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * The date words for a figure: "SEC N-PORT data set for 2026 Q3" when the file
 * carries the data set's quarter, "SEC N-PORT data, built July 2026" when it
 * carries only the month the script ran, or null for anything else (never guessed).
 */
export function fundFactsAsOfLabel(asOf: string | null | undefined): string | null {
  if (!asOf) return null
  const q = /^(\d{4})q([1-4])$/i.exec(asOf)
  if (q) return `SEC N-PORT data set for ${q[1]} Q${q[2]}`
  const m = /^(\d{4})-(\d{2})$/.exec(asOf)
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `SEC N-PORT data, built ${MONTHS[Number(m[2]) - 1]} ${m[1]}`
  return null
}

export interface FundFactsEntry {
  /** Net assets in billions of dollars, every share class of the fund together. */
  netAssetsB: number
  /** The trust that filed the N-PORT report. */
  issuer: string | null
  asOf: string
}
