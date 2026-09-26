# Fund catalog candidates — owner-machine probe, 2026-09-26

**Item:** T-070 · **Proposal probed:** `docs/proposals/2026-09-21-fund-catalog-candidates.md`
(14 candidates, UNRULED) · **Run on:** the owner's machine, egress checked first
(Charter Communications, AS11426, `proxy:false hosting:false`) · **Before any
`npm run audit`**, as the proposal requires.

This is the record of the probe the proposal asked for. **It adds nothing to
`fundCatalog.ts`.** Every row below is verified data waiting on the owner's ruling
about which groups to add, and on the two judgement calls the proposal names.

## Result: all 14 pass steps 1–3

| Step | Method | Result |
|---|---|---|
| 1. Quotable | `/live-data/security-quotes?symbols=…` through the app's own ladder | 14/14 priced, `source: finnhub`, none `reference` |
| 2. Actively trading | `/live-data/security-chart?symbol=…&range=1mo` | 14/14 returned **22 daily closes, 2026-08-26 → 2026-09-25**, `source: tiingo` |
| 3. Expense ratio | SEC Risk/Return Summary datasets (2026q2, 2026q1, 2025q4), joined on the share-class id in `num.otherdims` exactly as `build-fund-fees.mjs` does; class ids from `company_tickers_mf.json` | 14/14 found, each in the quarter its prospectus was filed |
| 4. Everything else | issuer product page (AUM, yield, inception, index, holdings, website) | **NOT DONE** — deferred until a group is approved |

## Expense ratios, from each fund's own filing

`ExpensesOverAssets` is the fee table's *Total Annual Fund Operating Expenses*.
`NetExpensesOverAssets` is the figure after a contractual waiver, where the filing
carries one — that is the tag `build-fund-fees.mjs` compares the catalog against
first, so it is the column proposed for `expenseRatioPct`. All values are
`uom=pure` (decimal fractions), shown here as percentages.

| Ticker | Group | Total (gross) | Net (after waiver) | Filing | Accession | Fee-table period |
|---|---|---|---|---|---|---|
| XLC | sector | 0.08 | — | 485BPOS 2026-01-28 | 0001193125-26-027312 | 2025-09-30 |
| XLP | sector | 0.08 | — | 485BPOS 2026-01-28 | 0001193125-26-027312 | 2025-09-30 |
| XLY | sector | 0.08 | — | 485BPOS 2026-01-28 | 0001193125-26-027312 | 2025-09-30 |
| XLB | sector | 0.08 | — | 485BPOS 2026-01-28 | 0001193125-26-027312 | 2025-09-30 |
| VCSH | bond | 0.03 | — | 497 2026-06-30 (and 485BPOS 2025-12-19) | 0001021882-26-000437 | 2025-08-31 |
| VMBS | bond | 0.03 | — | 497 2026-06-30 (and 485BPOS 2025-12-19) | 0001021882-26-000437 | 2025-08-31 |
| VTIP | bond | 0.03 | — | 485BPOS 2026-01-28 | 0001193125-26-024963 | 2025-09-30 |
| EMLC | bond | 0.31 | **0.30** (waiver 0.01) | 485BPOS 2026-04-29 | 0001137360-26-000433 | 2026-04-30 |
| BKLN | bond | 0.67 (0.65 mgmt + 0.02 acquired-fund) | **0.65** (waiver 0.02) | 485BPOS 2025-12-18 | 0001104659-25-122454 | 2025-12-31 |
| VSS | international | 0.06 | — | 497 2026-02-02 | 0001193125-26-032824 | 2026-01-31 |
| VGK | international | 0.06 | — | 485BPOS 2026-02-27 | 0001193125-26-077485 | 2025-10-31 |
| EWJ | international | 0.49 | — | 485BPOS 2025-12-19 | 0001193125-25-327007 | 2025-08-31 |
| VYMI | international / dividend-income | 0.07 | — | 497 2026-02-02 | 0001193125-26-032818 | 2026-01-31 |
| HEFA | international | 0.70 (0.38 mgmt + 0.32 acquired-fund) | **0.35** (waiver 0.35) | 485BPOS 2025-11-21 | 0001193125-25-291438 | 2025-07-31 |

Two rows deserve a sentence when they are written up, because the gross and net
figures are far apart:

- **HEFA** holds its exposure through another iShares fund, so 0.32 of the gross
  is that fund's fee counted twice, and BlackRock waives it contractually. The
  investor pays 0.35. A waiver has an expiry the dataset does not carry; the
  `provenance` comment on the row should say "net of a contractual waiver" so a
  later reader knows what to re-check.
- **BKLN** likewise: 0.65 net of a 0.02 waiver on acquired-fund fees.

## Finding outside the proposal: the six sector SPDRs already in the catalog are 0.08, not 0.09

The same 2026-01-28 filing (accession 0001193125-26-027312) carries the whole
Select Sector SPDR Trust. Read from it on 2026-09-26:

| Catalog row | `expenseRatioPct` in the tree | Filing says |
|---|---|---|
| XLK, XLF, XLE, XLV, XLI, XLU | 0.09 | **0.08** (`ExpensesOverAssets = 0.0008`, period 2025-09-30) |

The catalog's provenance block records those six as confirmed against SEC data on
2026-09-01 — against the archive that was newest *then*. The 0.08 table was filed
on 2026-01-28 and sits in the 2026q1 archive, which `npm run fund-fees` never
reads because it takes the newest archive only (2026q2), and a fund appears only in
the quarter it filed. **That is a limitation of the reconcile, not of the data**,
and it is the same shape as the proposal's warning: a figure that was right when
read and nothing watching for the next filing.

Proposed, not applied: six rows from 0.09 → 0.08, `FUND_DATA_LAST_VERIFIED`
unmoved, the provenance block gaining one dated line. `computeFeeDrag()` compounds
the difference, so it is small per row and real.

## Two script gaps met on the way, recorded rather than fixed

1. `npm run fund-prospectus-fees -- --symbols …` answered `no CIK in
   company_tickers.json` for all 14. That file maps *operating companies*; every
   '40-Act fund lives in `company_tickers_mf.json`, which `build-fund-fees.mjs`
   already reads. A fallback to that map is a small change.
2. `build-fund-fees.mjs` reconciles catalog rows only and reads the newest quarter
   only. Both a `--symbols` mode and a walk back over the last four quarters would
   have made this probe a one-liner — and would have caught the 0.08 above on the
   2026-09-01 run.

## What the owner is asked to decide

1. Which groups to add: **sector** (XLC, XLP, XLY, XLB — the only group wired into
   shipped code, via `SECTOR_ETF`'s partial map), **bond** (VCSH, VMBS, VTIP, EMLC,
   BKLN), **international** (VSS, VGK, EWJ, VYMI, HEFA).
2. **VYMI's category** — `dividend-income` (moderate band) or `international`
   (aggressive band). One category per fund; it decides the registry filter and
   `fundRiskLevel()`.
3. **Whether BKLN belongs in `bond` at all** — `fundRiskLevel()` bands every `bond`
   fund `conservative`; senior loans are below investment grade.
4. The six-row 0.09 → 0.08 correction above.

Once ruled, step 4 (issuer facts) runs for the approved rows and they are appended
with a dated provenance comment. `FUND_DATA_LAST_VERIFIED` does not move.
