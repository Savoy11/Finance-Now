# Stablecoin issuer table — re-check, 2026-11-05

**What was checked:** every field of `frontend/src/lib/data/stablecoinMeta.ts` (auditor, last report
date, backing ratio, reserve mix, regulated issuer, incident note) for the coins the Reserve Monitor
tracks. The table was last checked 2026-07-28; its 120-day clock would have fired on 2026-11-26.

**How (D190, under D178):** three helpers read web search results only. No issuer page was opened
(D149). Where a quote is from an issuer's own file, it was read as a search snippet and is marked so.
Many current figures come from trackers that copy the issuers' reports (DIA, pharos.watch,
AltStreet, achivx), and a few rest on one source. Each is marked below. The owner's ruling (D178,
applied here by D190) is that answers built this way count as a reading.

**Verdicts:** MATCHES (table was right), CHANGED (table updated), NOT CONFIRMED (no source settles
it; under D190 a ratio with no source is left blank and the page shows "not disclosed").

**Also fixed:** the route matched coins by ticker and kept the largest. On 2026-11-05 DefiLlama listed
two "GUSD" coins, Gate USD (id 306, $319M) and Gemini Dollar (id 19, $35M), so the GUSD row showed
Gate USD's supply under Gemini's auditor. Coins are now picked by DefiLlama id and CoinGecko id.

| Coin | DefiLlama id | CoinGecko id |
|---|---|---|
| USDT | 1 | tether |
| USDC | 2 | usd-coin |
| DAI | 5 | dai |
| FRAX (legacy Frax Dollar) | 6 | frax |
| FRXUSD | 235 | frax-usd |
| TUSD | 7 | true-usd |
| LUSD | 8 | liquity-usd |
| USDP | 11 | paxos-standard |
| GUSD | 19 | gemini-dollar |
| PYUSD | 120 | paypal-usd |

---

## USDC (Circle)

| Field | Was | Now | Verdict |
|---|---|---|---|
| Auditor | Deloitte & Touche (monthly) | same | MATCHES |
| Last report | 2026-03-31 | 2026-09-30 | CHANGED |
| Ratio | 1.0 | 1.0 (about 1.001) | MATCHES |
| Reserve mix | Fund 80 / bank cash 20 | Fund 84.5 / bank cash and directly held Treasuries 15.5 | CHANGED |
| Regulated issuer | yes | yes | MATCHES |
| Incident note | ~$0.88 in SVB, made whole within days | ~$0.87, back at its peg within 72 hours | CHANGED (wording) |

- Report dates 2026-09-04 and 2026-09-30, and about $73.96B of reserves: Circle's examination
  report PDF on its file host (`6778953.fs1.hubspotusercontent-na1.net/…/2026 USDC_Examination Report
  September 26.pdf`), **snippet only**.
- $73.879B in circulation and "approximately 84% of USDC reserves are held in the Circle Reserve
  Fund. The remaining amount is held in cash … and, starting from 2026, in U.S. Treasury securities
  held outside of the Circle Reserve Fund": Circle's Q3 10-Q, sec.gov
  (`edgar/data/0001876042/000187604226000311/crcl-20260930.htm`). The Q1 10-Q said about 86%, so the
  old 80/20 was wrong at its own date. No source splits the 15.5% between cash and Treasuries.
- Deloitte, monthly: S&P research PDF `spglobal.com/_assets/documents/ratings/research/101610806.pdf`;
  stablecoininsider.org (Circle OCC approval article).
- Circle's OCC trust bank (final approval 2026-07-10) does custody only and does not issue USDC
  (lasvegassun.com, 2026-07-10).
- SVB: decrypt.co/123211.
- Not in the table, noted: about $800M of USDC frozen around 2026-10-29 over the suspected Binance
  hack (pbxscience.com); supply fell to about $70B by 2026-10-29 (cryptobriefing.com).

## USDT (Tether)

| Field | Was | Now | Verdict |
|---|---|---|---|
| Auditor | BDO Italia (quarterly) | same | MATCHES |
| Last report | 2026-03-31 | 2026-09-30 (published 2026-10-30) | CHANGED |
| Ratio | 1.04 | 1.04 (1.0434) | MATCHES |
| Reserve mix | T-bills 74, repos 6, money-market funds 4, gold 4, bitcoin 4, other 8 | see below | CHANGED |
| Regulated issuer | no | no | MATCHES |
| Incident note | 2021 CFTC settlement | same | MATCHES |

- Assets $191,451,091,374 against liabilities $183,496,460,904 as of 2026-09-30: securities.io,
  news.bitcoin.com, stablecoininsider.org (Tether Q3 2026 attestation).
- Q3 mix, as shares of $191.451B: T-bills $122.84B (64.2%), overnight reverse repos $9.52B (5.0%),
  term reverse repos $7.18B (3.75%), precious metals $19.08B (10.0%), bitcoin $8.37B (4.4%), secured
  loans $14.18B (7.4%), equities $4.18B (2.2%), other investments $6.00B (3.1%); corporate bonds,
  about $64M, left out. cryptobriefing.com (Tether Q3 2026), securities.io, stablecoininsider.org.
  Coingeek gives secured loans as $14.6B. No money-market-fund line appears. Gold was already about
  10% at Q1, not 4%.
- KPMG U.S. clean opinion on FY2025 statements, announced 2026-08-13, statements not published:
  theblock.co, decrypt.co/375577.
- CFTC order 2021-10-15: cftc.gov press release 8450-21.
- USAT is a separate token issued by Anchorage Digital Bank (bloomberg.com, 2026-01-27); it does not
  change USDT's issuer.

## PYUSD (Paxos, for PayPal)

| Field | Was | Now | Verdict |
|---|---|---|---|
| Auditor | KPMG LLP (monthly) | same | MATCHES |
| Last report | 2026-05-31 | 2026-09-30 (KPMG report dated 2026-10-23) | CHANGED |
| Ratio | 1.0 | 1.0 ($2,754,709,360 against about $2.75B) | MATCHES |
| Reserve mix | Treasuries and repos 85 / deposits 15 | repos 78.2 / a line cut off after "U.S." 18.1 / deposits 3.7 | CHANGED, partly confirmed |
| Regulated issuer | yes (NYDFS) | yes, now the OCC | MATCHES; regulator changed |
| Incident note | none | 300 trillion mistaken mint (2025-10-15); NYDFS $48.5M (Aug 2025) | CHANGED |

- Report date and assets: achivx.org/stablecoins/pyusd, pharos.watch/stablecoin/pyusd-paypal
  (trackers only). KPMG since 2025-02-28: paxos.com/pyusd-transparency, **snippet only**.
- 78.2% "Overnight reverse repurchase agreements collateralized by U.S. Treasury obligations": pharos.watch.
  The 18.1% line's name is cut off in the source and is shown as "Other U.S. holdings (not
  confirmed)". Uninsured bank deposits were $100,160,089 (3.6%).
- OCC national trust charter, Paxos Trust Company, N.A., Charter No. 25379, from 2025-12-12:
  skadden.com (2025-12), occ.gov news release nr-occ-2025-125e, paxos.com licences page (**snippet
  only**). One secondary source (theindustryspread.com) says approval was still pending.
- Mistaken mint: theblock.co/post/374870. NYDFS settlement: dfs.ny.gov press release pr20250806.

## USDP (Pax Dollar, Paxos)

| Field | Was | Now | Verdict |
|---|---|---|---|
| Auditor | "KPMG LLP — proactive monthly reports discontinued" | KPMG LLP (monthly) | CHANGED |
| Last report | 2025-02-28 | 2026-08-31 (signed 2026-09-24) | CHANGED |
| Ratio | 1.0 | 1.0 (1.0007) | MATCHES |
| Regulated issuer | yes (NYDFS) | yes, now the OCC | MATCHES; regulator changed |
| Incident note | reports discontinued, "transparency materially reduced" | NYDFS $48.5M (Aug 2025) | CHANGED: old note not supported |

- KPMG's monthly attestations continue; what stopped was Paxos's own unaudited monthly reserve
  reports: altstreet.investments (Paxos review), paxos.com/usdp-transparency (**snippet only**).
- August 2026 report, 29,168,261 USDP against $29,189,905, signed 2026-09-24: diadata.org (USDP).
  AltStreet also cites a 2026-09-30 figure; one source only, not used.
- OCC charter: as for PYUSD.

## GUSD (Gemini Dollar)

| Field | Was | Now | Verdict |
|---|---|---|---|
| Auditor | BPM (periodic, NYDFS-supervised) | BPM LLP (monthly, NYDFS-supervised) | MATCHES; cadence stated |
| Last report | 2026-03-31 | 2026-05-29 (signed 2026-06-29) | CHANGED |
| Ratio | 1.0 | 1.0 (40,136,854.84 against $40,136,854.84) | MATCHES |
| Regulated issuer | yes (NYDFS) | yes (NYDFS) | MATCHES |

- diadata.org (GUSD); gemini.com/dollar (**snippet only**); coinranking.com.
- **Possible gap:** the June and July 2026 reports were listed as drafts (July's "DRAFT AS OF"
  2026-10-02), and no later final report was found. One tracker, not confirmed on a primary document.
- Sources disagree on custodians (State Street and Western Alliance Bank in the May report; State
  Street, Goldman Sachs or Fidelity on Gemini's page). The table carries no reserve mix for GUSD.

## TUSD (TrueUSD, Techteryx)

| Field | Was | Now | Verdict |
|---|---|---|---|
| Auditor | Moore Hong Kong (paused/irregular) | Moore Hong Kong (no dated report found since 2024-10-01) | firm MATCHES; cadence NOT CONFIRMED |
| Last report | 2024-10-01 | 2024-10-01 | NOT CONFIRMED (no newer one found) |
| Ratio | 1.0 | **blank (not disclosed)** | NOT CONFIRMED |
| Regulated issuer | no | no | MATCHES |
| Incident note | attestation gaps since 2023 | SEC settlement (2024-09); Dubai freezing order over about $456M | CHANGED (stated as facts) |

- Last ratio found: about $503M of reserves against about $495M of TUSD, about 1.016, with the fund
  valued "at cost": protos.com (Nov 2024). Nothing newer.
- Issuer's white paper describes a "daily attestation report update" (tusd.io white paper, **snippet
  only**); Chainlink's TUSD feed calls itself "a non-attest service" (data.chain.link).
- SEC settlement 2024-09-24, "99% of the reserves … invested in the speculative fund":
  sec.gov press release 2024-145. DIFC worldwide freezing order over $456M (2025-02-28, extended
  2025-10-17): decrypt.co/348402, legal-wires.com; Justin Sun's loan: coindesk.com (2025-04-02).

## DAI (Sky Protocol)

| Field | Was | Now | Verdict |
|---|---|---|---|
| Auditor | On-chain (Sky Protocol) | same | MATCHES |
| Last report | none (on-chain) | none | MATCHES |
| Ratio | 1.2 | **blank (not disclosed)** | NOT CONFIRMED |
| Reserve mix | PSM USDC 38, RWA 22, crypto loans 25, Spark 10, other 5 | USDC and tokenized money-market funds 50, on-chain crypto lending 25, off-chain crypto lending 10, not confirmed 15 | CHANGED |
| Regulated issuer | no | no | MATCHES |
| Incident note | Black Thursday 2020 | same | MATCHES |

- Ratios disagree because they measure different things: $15.89B of collateral against 10.00B DAI and
  USDS (about 1.59, 2026-10-26, stablecoininsider.org citing sky.money); protocol collateral $12.32B
  against $12.22B of obligations (about 1.008, Sky Frontier Foundation Q2 2026 report); an AI-written
  page claiming 121.9% that contradicts its own inputs (coinstats.app, not used). None is DAI alone.
- Reserve mix: S&P's affirmation of 2026-10-01, as reported by chaincatcher.com (article 2293726) and
  rootdata.com (news 776845): USDC plus tokenized money-market funds about $4.92B, "roughly 50% of USDS
  and DAI in circulation"; on-chain crypto lending about 25%; off-chain about $1B, roughly 10%. The
  rest is not named. These are shares of the pool DAI shares with USDS (DAI $4.72B, USDS $6.5B on
  DefiLlama, 2026-11-05).
- No third-party attestation; the Sky Frontier Foundation publishes quarterly reports and a live
  financial dashboard (financial.skyeco.com).

## FRAX (legacy Frax Dollar) and FRXUSD (Frax USD)

The ticker FRAX now means the **legacy Frax Dollar**, and the table's FRAX row described **frxUSD**.
FIP-430 ended the guaranteed migration from the legacy coin into frxUSD and gave them separate
balance sheets; the legacy coin trades near $0.99 (DefiLlama 2026-11-05: $0.991, algorithmic, $145M).
FIP-428 also renamed FXS to FRAX. Sources: diadata.org (FRAX), github.com/InverseFinance/
Risk-Assessments (frxUSD pre-screening), securities.io. **Owner (D190): track both.**

| Field | FRAX (legacy) | FRXUSD |
|---|---|---|
| Auditor | None found | Chaos Labs proof of reserves (on-chain, continuous); no accounting firm |
| Last report | none | none (continuous feed) |
| Ratio | blank (not disclosed) | 1.0 (about 1.008, one secondary source) |
| Reserve mix | none | none in the table: USDC, BUIDL, USTB/USCC, AUSD, JTRSY, WTGXX, no shares given |
| Regulated issuer | no | no |
| Incident note | split from frxUSD without a $1 guarantee | — |

- frxUSD reserves and proof of reserves: chaoslabs.xyz (frxUSD token review; proof-of-reserves post).
  About $104.5M of assets against $103.7M of frxUSD around 2026-09-19: stablecoininsider.org citing
  Frax. Frax Inc runs the reserves for the DAO under FIP-432.
- The old note's "migration completed" was wrong.

## LUSD (Liquity v1)

| Field | Was | Now | Verdict |
|---|---|---|---|
| Auditor | On-chain (Liquity Protocol) | same | MATCHES |
| Ratio | 1.1 | **blank (not disclosed)** | NOT CONFIRMED |
| Regulated issuer | no | no | MATCHES |
| Incident note | none | below its peg for stretches of 2023 | CHANGED (added) |

- 1.1 was the 110% minimum a single loan must hold, and Recovery Mode begins when the whole system
  falls below 150%: help.defisaver.com (Liquity v1 liquidations). No current system-wide figure was in
  any source; the newest dated one is 259.9% from 2023-03-03. A live figure would need the contract's
  `getTCR` reading.
- 2023 below-peg periods: thedefiant.io ("LUSD Briefly Spikes to $1.03 After Trading Below Peg Since
  July"). Supply about $24M (DefiLlama, 2026-11-05); v1 still active.
