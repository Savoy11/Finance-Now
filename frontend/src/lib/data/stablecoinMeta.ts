// Curated stablecoin issuer metadata — attestations, reserve composition, and
// structural facts from public issuer disclosures. This is REFERENCE data
// (a maintained snapshot, not a live feed): consumers must surface META_AS_OF
// and treat it as lower-confidence than live oracle data.
//
// Read by /live-data/reserves (the Reserve Monitor). /live-data/risk-scores,
// the other reader, was removed on 2026-08-29 (RP-6).
//
// Re-checked as a whole on 2026-11-05 (D190) from search results of the
// issuers' own reports and of the trackers that copy them; no issuer page was
// opened (D149). That counts as a reading, the way D178 counted search answers
// for staking facts. Every field, its verdict and its sources:
// docs/audits/stablecoin-issuers-2026-11-05.md. A figure no source confirmed
// is null, which the page shows as not disclosed, never as a guess (D190).

/** Snapshot date of the curated tables below — update when refreshing them. */
export const META_AS_OF = '2026-11-05'

// ── Staleness machinery (same pattern as transferFees.ts) ────────────────────
// Issuer attestations publish monthly-to-quarterly, so a snapshot older than
// 120 days is more than one full attestation cycle behind and must be treated
// as stale. This exists because the previous snapshot silently aged to 20
// months while feeding the live risk engine (audit finding H2, 2026-07-27).

export const META_STALE_AFTER_DAYS = 120

export function stablecoinMetaAgeDays(now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(META_AS_OF).getTime()) / 86_400_000)
}

export function stablecoinMetaIsStale(now: Date = new Date()): boolean {
  return stablecoinMetaAgeDays(now) > META_STALE_AFTER_DAYS
}

export type StablecoinMetaConfidence = 'high' | 'medium' | 'low'

export interface StablecoinMetaProvenance {
  source: string
  verifiedAt: string
  ageDays: number
  stale: boolean
  confidence: StablecoinMetaConfidence
}

export function getStablecoinMetaProvenance(now: Date = new Date()): StablecoinMetaProvenance {
  const ageDays = stablecoinMetaAgeDays(now)
  const stale = ageDays > META_STALE_AFTER_DAYS
  const confidence: StablecoinMetaConfidence =
    ageDays <= 60 ? 'high' : ageDays <= META_STALE_AFTER_DAYS ? 'medium' : 'low'
  return {
    source: 'Curated snapshot of public issuer disclosures (attestations, reserve reports), re-read from those reports as quoted in search results, news and stablecoin trackers',
    verifiedAt: META_AS_OF,
    ageDays,
    stale,
    confidence,
  }
}

/** The stablecoins Finance Now actively monitors (DefiLlama symbols, uppercase). */
//
// FRAX is the LEGACY Frax Dollar (algorithmic, no $1 guarantee since FIP-430);
// FRXUSD is Frax's fully backed coin. Both are tracked (D190): the rest of the
// app's FRAX (CoinGecko 'frax') is the legacy coin, so its row has to say what
// that coin is, and frxUSD is the one with reserves to report.
export const MONITORED_STABLECOINS = ['USDC', 'USDT', 'DAI', 'FRAX', 'FRXUSD', 'TUSD', 'PYUSD', 'USDP', 'GUSD', 'LUSD'] as const

export type MonitoredStablecoin = (typeof MONITORED_STABLECOINS)[number]

/**
 * Which DefiLlama stablecoin each monitored coin IS, by DefiLlama's id and the
 * CoinGecko id DefiLlama gives it. Both must match before a row is shown.
 *
 * The route used to match on the ticker and keep the largest coin sharing it.
 * That stopped being safe once a bigger coin took a ticker: measured
 * 2026-11-05, "GUSD" was Gate USD (id 306, $319M) and Gemini Dollar (id 19,
 * $35M), so the GUSD row showed Gate USD's supply under Gemini's auditor. A
 * ticker is not an identity; these ids are (checked against DefiLlama's list
 * that day).
 */
export const DEFILLAMA_STABLECOINS: Record<MonitoredStablecoin, { id: string; geckoId: string; name: string }> = {
  USDT:  { id: '1',   geckoId: 'tether',         name: 'Tether' },
  USDC:  { id: '2',   geckoId: 'usd-coin',       name: 'USD Coin' },
  DAI:   { id: '5',   geckoId: 'dai',            name: 'Dai' },
  FRAX:  { id: '6',   geckoId: 'frax',           name: 'Frax' },
  FRXUSD: { id: '235', geckoId: 'frax-usd',      name: 'Frax USD' },
  TUSD:  { id: '7',   geckoId: 'true-usd',       name: 'TrueUSD' },
  LUSD:  { id: '8',   geckoId: 'liquity-usd',    name: 'Liquity USD' },
  USDP:  { id: '11',  geckoId: 'paxos-standard', name: 'Pax Dollar' },
  GUSD:  { id: '19',  geckoId: 'gemini-dollar',  name: 'Gemini Dollar' },
  PYUSD: { id: '120', geckoId: 'paypal-usd',     name: 'PayPal USD' },
}

/** The fields of a DefiLlama stablecoin entry the match reads. */
export interface PeggedAssetIdentity {
  id: string | number
  gecko_id?: string | null
}

export interface MonitoredPick<T> {
  key: MonitoredStablecoin
  coin: T
}

/**
 * Picks each monitored coin out of DefiLlama's list by id, and reports any it
 * could not find, so a coin that drops out is named rather than silently
 * missing. An entry whose CoinGecko id no longer matches is refused: the id
 * pointing at a different coin is the very error this replaces.
 */
export function pickMonitoredStablecoins<T extends PeggedAssetIdentity>(
  assets: readonly T[],
): { picked: MonitoredPick<T>[]; notFound: { key: MonitoredStablecoin; reason: string }[] } {
  const byId = new Map<string, T>()
  for (const a of assets) byId.set(String(a.id), a)
  const picked: MonitoredPick<T>[] = []
  const notFound: { key: MonitoredStablecoin; reason: string }[] = []
  for (const key of MONITORED_STABLECOINS) {
    const want = DEFILLAMA_STABLECOINS[key]
    const coin = byId.get(want.id)
    if (!coin) {
      notFound.push({ key, reason: `DefiLlama has no stablecoin with id ${want.id} (${want.name})` })
    } else if ((coin.gecko_id ?? null) !== want.geckoId) {
      notFound.push({ key, reason: `DefiLlama id ${want.id} is now ${coin.gecko_id ?? 'no CoinGecko id'}, not ${want.geckoId}` })
    } else {
      picked.push({ key, coin })
    }
  }
  return { picked, notFound }
}

export interface AttestationMeta {
  attester: string
  attestationUrl: string
  /** null = continuous on-chain verification, no periodic attestation. */
  lastAttestedDate: string | null
  /** null = no current source confirms one; the page shows "not disclosed". */
  collateralizationRatio: number | null
}

// Known attestation metadata — keyed by uppercase symbol for reliable matching
// (DefiLlama coin IDs like 'usd-coin' are not stable across API responses).
//
// Refreshed 2026-07-28 (audit H2) from public issuer disclosures. Dates marked
// "conservative" are the latest attestation that could be POSITIVELY verified;
// issuers on a monthly cadence likely have a newer one — never assume it.
export const ATTESTATION_META: Record<string, AttestationMeta> = {
  'USDC': {
    // 2026-11-05: Deloitte's monthly examination, report dates 2026-09-04 and
    // 2026-09-30 (Circle's report PDF, read as a search snippet). Circle's Q3
    // 10-Q: $73.879B in circulation against about $73.96B of reserves (≈1.001).
    attester: 'Deloitte & Touche (monthly)',
    attestationUrl: 'https://www.circle.com/transparency',
    lastAttestedDate: '2026-09-30',
    collateralizationRatio: 1.0,
  },
  'USDT': {
    // 2026-11-05: BDO Italia's quarterly attestation as of 2026-09-30,
    // published 2026-10-30: assets $191,451,091,374 against liabilities
    // $183,496,460,904 (1.043). KPMG U.S. also gave a clean opinion on the
    // FY2025 financial statements (announced 2026-08-13; not published).
    attester: 'BDO Italia (quarterly)',
    attestationUrl: 'https://tether.to/en/transparency/',
    lastAttestedDate: '2026-09-30',
    collateralizationRatio: 1.04,
  },
  'DAI': {
    // MakerDAO rebranded to Sky (2024); DAI and USDS share one collateral
    // pool. No third party attests to it. The 1.2 this table carried was an
    // approximation, and on 2026-11-05 sources gave anything from 1.01
    // (assets against obligations, the Q2 2026 Sky Frontier Foundation report)
    // to 1.59 ($15.89B of collateral against 10.00B DAI and USDS, 2026-10-26),
    // depending on what is measured. None is a ratio for DAI alone, so none
    // is shown (D190).
    attester: 'On-chain (Sky Protocol, formerly MakerDAO)',
    attestationUrl: 'https://info.sky.money',
    lastAttestedDate: null,
    collateralizationRatio: null,
  },
  'FRAX': {
    // The LEGACY Frax Dollar. This entry described frxUSD until 2026-11-05,
    // but DefiLlama's and CoinGecko's FRAX is the old coin: FIP-430 (2025)
    // ended its guaranteed migration into frxUSD and gave the two separate
    // balance sheets, and it trades near $0.99. No reserve report for it was
    // found, so it carries none.
    attester: 'None found (legacy Frax Dollar)',
    attestationUrl: '#',
    lastAttestedDate: null,
    collateralizationRatio: null,
  },
  'FRXUSD': {
    // frxUSD mints only against custodial collateral: Circle USDC, BlackRock
    // BUIDL, Superstate USTB/USCC, Agora AUSD, Janus Henderson JTRSY and
    // WisdomTree WTGXX (Chaos Labs' review), run by Frax Inc for the DAO under
    // FIP-432. Chaos Labs' proof of reserves watches them on-chain; no
    // accounting firm attests. About $104.5M of assets against $103.7M of
    // frxUSD around 2026-09-19 (1.008, one secondary source citing Frax).
    attester: 'Chaos Labs proof of reserves (on-chain, continuous)',
    attestationUrl: 'https://frax.com/frxUSD',
    lastAttestedDate: null,
    collateralizationRatio: 1.0,
  },
  'TUSD': {
    // Moore Hong Kong is still the named firm, but on 2026-11-05 no dated
    // Moore report newer than this one was found. The issuer describes a daily
    // dashboard, and its Chainlink feed calls itself "a non-attest service".
    // The last ratio found was about 1.016, valued at cost (Nov 2024), with
    // about $456M of the reserves under a Dubai freezing order since, so no
    // ratio is shown (D190).
    attester: 'Moore Hong Kong (no dated report found since 2024-10-01)',
    attestationUrl: 'https://www.tusd.io/',
    lastAttestedDate: '2024-10-01',
    collateralizationRatio: null,
  },
  'PYUSD': {
    // 2026-11-05: KPMG's monthly examination of the report dated 2026-09-17
    // and 2026-09-30, signed 2026-10-23 (from two stablecoin trackers):
    // $2,754,709,360 of redemption assets against about $2.75B outstanding.
    attester: 'KPMG LLP (monthly)',
    attestationUrl: 'https://www.paxos.com/pyusd-transparency',
    lastAttestedDate: '2026-09-30',
    collateralizationRatio: 1.0,
  },
  'USDP': {
    // 2026-11-05: KPMG's monthly attestations never stopped. What Paxos
    // stopped was its own unaudited monthly reserve reports, and the 2026-07
    // entry read that as the attestations ending. Latest found: the report
    // dated 2026-08-06 and 2026-08-31, signed 2026-09-24 (DIA): 29,168,261
    // USDP outstanding against $29,189,905 of redemption assets (1.0007).
    attester: 'KPMG LLP (monthly)',
    attestationUrl: 'https://www.paxos.com/usdp-transparency',
    lastAttestedDate: '2026-08-31',
    collateralizationRatio: 1.0,
  },
  'GUSD': {
    // 2026-11-05: BPM's monthly attestation, latest final report dated
    // 2026-05-04 and 2026-05-29, signed 2026-06-29 (DIA): 40,136,854.84 GUSD
    // against $40,136,854.84 of reserves. The June and July 2026 reports were
    // listed as drafts and no later final one was found, so this may be a gap.
    attester: 'BPM LLP (monthly, NYDFS-supervised)',
    attestationUrl: 'https://www.gemini.com/dollar',
    lastAttestedDate: '2026-05-29',
    collateralizationRatio: 1.0,
  },
  'LUSD': {
    // Immutable Liquity v1 protocol — continuously verifiable on-chain. The
    // 1.1 this table carried was the 110% minimum a single loan must hold,
    // not the system's ratio, which moves with the ETH price and was not in
    // any source on 2026-11-05. So none is shown (D190).
    attester: 'On-chain (Liquity Protocol)',
    attestationUrl: 'https://www.liquity.org/',
    lastAttestedDate: null,
    collateralizationRatio: null,
  },
}

/** Reserve composition breakdowns (from public disclosures — approximate), keyed by uppercase symbol. */
export const COMPOSITION_MAP: Record<string, { category: string; percentage: number }[]> = {
  // Circle, 2026-09-30: $11.49B of $73.96B held outside the Circle Reserve
  // Fund (report PDF snippet); the Q3 10-Q says "approximately 84%" is in the
  // fund and the rest is bank cash plus, from 2026, Treasuries Circle holds
  // directly. No source splits those two. The old 80/20 was already wrong at
  // its own date (the Q1 10-Q said about 86%).
  'USDC': [
    { category: 'US Treasuries (Circle Reserve Fund)', percentage: 84.5 },
    { category: 'Cash at banks and directly held Treasuries', percentage: 15.5 },
  ],
  // Tether's Q3 2026 attestation, shares of $191.451B of assets: T-bills
  // $122.84B, overnight reverse repos $9.52B, term reverse repos $7.18B,
  // precious metals $19.08B, bitcoin $8.37B, secured loans $14.18B, equities
  // $4.18B, other investments $6.00B (corporate bonds, about $64M, left out).
  // No money-market-fund line appears in the reported figures. Gold was
  // already about 10% at Q1, not the 4% this table said.
  'USDT': [
    { category: 'US Treasury bills', percentage: 64.2 },
    { category: 'Overnight reverse repos', percentage: 5.0 },
    { category: 'Term reverse repos', percentage: 3.75 },
    { category: 'Precious metals', percentage: 10.0 },
    { category: 'Bitcoin', percentage: 4.4 },
    { category: 'Secured loans', percentage: 7.4 },
    { category: 'Equities', percentage: 2.2 },
    { category: 'Other investments', percentage: 3.1 },
  ],
  // S&P's review of Sky, 2026-10-01 (as reported by two news sites): USDC and
  // tokenized money-market funds about 50%, on-chain crypto lending about
  // 25%, off-chain crypto lending about 10%, of the pool DAI shares with USDS.
  // The other 15% is not named in the sources, so it is marked as such. The
  // old buckets mixed asset types with one lender (Spark) and matched no
  // current source.
  'DAI': [
    { category: 'USDC and tokenized money-market funds', percentage: 50 },
    { category: 'On-chain crypto lending', percentage: 25 },
    { category: 'Off-chain crypto lending', percentage: 10 },
    { category: 'Not confirmed', percentage: 15 },
  ],
  // Paxos's PYUSD report as of 2026-09-30 (pharos.watch): 78.2% overnight
  // reverse repos backed by US Treasuries; a second line of 18.1% whose
  // name the source cuts off after "U.S." (likely Treasury bills, not
  // confirmed, so it is not named here); the remaining 3.7% bank deposits.
  'PYUSD': [
    { category: 'Overnight reverse repos (Treasury-backed)', percentage: 78.2 },
    { category: 'Other U.S. holdings (not confirmed)', percentage: 18.1 },
    { category: 'Bank deposits', percentage: 3.7 },
  ],
}

export interface StablecoinStructureMeta {
  /** Issuer operates under a prudential regulator (e.g. NYDFS trust charter). */
  regulatedIssuer: boolean
  /** Penalty (0–50) for past incidents: attestation gaps, banking crises, enforcement. */
  incidentPenalty: number
  incidentNote?: string
}

/**
 * Structural facts per monitored stablecoin. regulatedIssuer reflects a
 * NYDFS trust charter or equivalent prudential oversight of the issuer.
 */
export const STRUCTURE_META: Record<string, StablecoinStructureMeta> = {
  'USDC': { regulatedIssuer: true, incidentPenalty: 10, incidentNote: 'Fell to about $0.87 during the March 2023 SVB collapse; back at its peg within 72 hours.' },
  'USDT': { regulatedIssuer: false, incidentPenalty: 15, incidentNote: '2021 CFTC settlement over historical misstatements about reserve backing.' },
  'DAI': { regulatedIssuer: false, incidentPenalty: 10, incidentNote: 'Black Thursday 2020 liquidation failures left bad debt; system recapitalized.' },
  'FRAX': { regulatedIssuer: false, incidentPenalty: 10, incidentNote: 'The legacy Frax Dollar: under FIP-430 (2025) it was split from frxUSD without a guaranteed migration or a $1 guarantee, and it trades near $0.99. The ticker FRAX now also names the former FXS token.' },
  'TUSD': { regulatedIssuer: false, incidentPenalty: 20, incidentNote: 'SEC settlement in September 2024: by then 99% of the reserves were in a speculative fund. A Dubai court has frozen about $456M of the reserves worldwide since February 2025, in a dispute over where they went.' },
  // Paxos converted its NYDFS trust charter to an OCC national trust charter
  // (Paxos Trust Company, N.A.) on 2025-12-12, so PYUSD's and USDP's issuer is
  // regulated by the OCC now, not NYDFS.
  'PYUSD': { regulatedIssuer: true, incidentPenalty: 0, incidentNote: 'On 2025-10-15 Paxos mistakenly minted 300 trillion PYUSD and burned it within about 30 minutes. In August 2025 Paxos paid NYDFS $48.5M over its due diligence on Binance.' },
  // The 2026-07 note said USDP's monthly reports had stopped; only Paxos's
  // unaudited reports had, and KPMG's attestations continue. Penalty unchanged:
  // it feeds the switched-off risk profile only (D64) and is not re-judged here.
  'USDP': { regulatedIssuer: true, incidentPenalty: 10, incidentNote: 'In August 2025 Paxos paid NYDFS $48.5M over its due diligence on Binance.' },
  'GUSD': { regulatedIssuer: true, incidentPenalty: 0 },
  'LUSD': { regulatedIssuer: false, incidentPenalty: 0, incidentNote: 'No exploit or bad debt found. It traded below its peg for stretches of 2023, down to about $0.95 that March.' },
}
