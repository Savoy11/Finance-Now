# Fund fee reconcile — first four-quarter run, 2026-09-26

**Item:** T-411 · **Script:** `npm run fund-fees` (`frontend/scripts/build-fund-fees.mjs`)
· **Run on:** the owner's machine, sec.gov reachable · **Writes:** nothing — this is the
report the script emits, read and written up. `FUND_DATA_LAST_VERIFIED` unmoved.

## What changed in the script before this run

Two blindnesses, both found while sourcing fees for the T-070 candidates the same day.

1. **It read one quarter.** A fund appears in the SEC Risk/Return dataset only in the
   quarter it filed its prospectus, and most file annually. The 2026-09-01 reconcile read
   2026q2 alone, so the Select Sector SPDRs' January fee cut (485BPOS 2026-01-28, in
   2026q1) was invisible and six rows stayed at 0.09 under a clean report. The script now
   reads the newest **four** quarters (`RR_QUARTERS=n` widens, `RR_QUARTER=YYYYqN` pins
   one) and, per ticker, the newest quarter carrying it wins. Selection and merge are in
   `scripts/lib/rrQuarters.mjs`, unit-tested.
2. **It never read the total-expense line.** In the RR taxonomy `ExpensesOverAssets` is
   *Total Annual Fund Operating Expenses* (every fund has it) and `NetExpensesOverAssets`
   is the total after a waiver (only funds with one). The script had listed the total
   line as a *fallback* for net; tag resolution takes the first candidate an archive
   carries at all, and every archive carries the net tag for some fund — so the total was
   never read, and every no-waiver fund (VOO, XLK, VTIP …) reported `no-expense-value`.
   That is how the 2026-09-09 run matched 27 of 126 and read as thorough. Net is now
   taken where a waiver exists and the total otherwise.

Also: `--symbols A,B,C` reconciles arbitrary tickers (a candidate not in the catalog gets
its SEC figure and no delta), and the prospectus probe resolves through
`company_tickers_mf.json` as well — but refuses to read a trust-wide prospectus as one
fund's fee (its first attempt reported a sibling fund's 0.35% for XLC as "differs by
+0.27pp"; it now answers `trust-unscoped` and points here).

## Coverage

| | Count |
|---|---|
| Catalog rows | 140 |
| Series registrants (in the SEC fund ticker map) | 103 |
| Matched across 2026q2 · 2026q1 · 2025q4 · 2025q3 | **97** (was 27 of 126 on 2026-09-09) |
| Registrants not found in four quarters | 6 — TQQQ, SQQQ, UPRO, SH, SOXL, PIMIX |
| Not series registrants (grantor trusts, commodity pools, UITs) | 37 — the `fund-prospectus-fees` set |
| Unit | decimal, declared by the dataset (`uom=pure`), cross-checked against 97 catalog ratios, median error 0.0000pp |

The six unmatched registrants were re-tried with `RR_QUARTERS=6` (2025q2 and 2025q1
added): **0 of 6 in six quarters.** That is not a reach problem any more. Either those
trusts (ProShares, Direxion, PIMCO Funds) tag their fee tables under a class id that
differs from the one in `company_tickers_mf.json`, or they do not file the RR fee table
as XBRL by class. Worth a look with `--inspect` on their accession before concluding
anything; not done here.

## Differences: 17 rows, all primary-source, none applied

Sixteen are one-basis-point fee **cuts** filed after the catalog was compiled; one
(PRGFX) rose. Each is read from the fund's own filing, class-scoped, with the accession.
`computeFeeDrag()` compounds every one of them over ten and thirty years, so they are
small per row and real.

| Ticker | Catalog | Filing says | Δ | Filed | Quarter | Accession | Registrant |
|---|---|---|---|---|---|---|---|
| ICLN | 0.41 | 0.39 | −0.02 | 2025-08-25 | 2025q3 | 0001193125-25-187621 | iShares Trust |
| VUG | 0.04 | 0.03 | −0.01 | 2026-04-28 | 2026q2 | 0000036405-26-000181 | Vanguard Index Funds |
| VTV | 0.04 | 0.03 | −0.01 | 2026-04-28 | 2026q2 | 0000036405-26-000181 | Vanguard Index Funds |
| VWO | 0.07 | 0.06 | −0.01 | 2026-02-02 | 2026q1 | 0001193125-26-032824 | Vanguard International Equity Index Funds |
| SOXX | 0.35 | 0.34 | −0.01 | 2025-07-22 | 2025q3 | 0001193125-25-162603 | iShares Trust |
| IBB | 0.45 | 0.44 | −0.01 | 2025-07-22 | 2025q3 | 0001193125-25-162603 | iShares Trust |
| IHI | 0.39 | 0.38 | −0.01 | 2025-07-22 | 2025q3 | 0001193125-25-162603 | iShares Trust |
| IAI | 0.39 | 0.38 | −0.01 | 2025-07-22 | 2025q3 | 0001193125-25-162603 | iShares Trust |
| ITA | 0.39 | 0.38 | −0.01 | 2025-07-22 | 2025q3 | 0001193125-25-162603 | iShares Trust |
| IYT | 0.39 | 0.38 | −0.01 | 2025-08-25 | 2025q3 | 0001193125-25-187621 | iShares Trust |
| ITB | 0.39 | 0.38 | −0.01 | 2025-07-22 | 2025q3 | 0001193125-25-162603 | iShares Trust |
| TIP | 0.19 | 0.18 | −0.01 | 2026-02-23 | 2026q1 | 0001193125-26-064179 | iShares Trust |
| QYLD | 0.61 | 0.60 | −0.01 | 2026-02-26 | 2026q1 | 0001432353-26-000085 | Global X Funds |
| VBTLX | 0.05 | 0.04 | −0.01 | 2026-04-28 | 2026q2 | 0000794105-26-000106 | Vanguard Bond Index Funds |
| VWINX | 0.23 | 0.22 | −0.01 | 2026-01-28 | 2026q1 | 0001193125-26-024956 | Vanguard Wellesley Income Fund |
| PRGFX | 0.65 | 0.66 | **+0.01** | 2026-02-25 | 2026q1 | 0001999371-26-004113 | T. Rowe Price Growth Stock Fund |
| FXAIX | 0.015 | 0.01 | −0.005 | 2026-04-24 | 2026q2 | 0000819118-26-000072 | Fidelity Concord Street Trust |

**FXAIX needs a human before it moves.** The dataset row is `0.0001` at six declared
decimals, so the filer stated 0.010%, not a rounding of 0.015%. Fidelity's own literature
has long said 0.015%. Both cannot be right; the prospectus text (not the XBRL tag) decides.
Leave the row until someone reads the fee table in that filing.

**Sales charges:** AGTHX front 5.75% / deferred 1% / 12b-1 0.24% (filed 2025-10-31),
matching the verified rate already in the catalog. No other matched fund reports a load.

## The ask (T-412)

Approve the sixteen non-FXAIX corrections, or any subset. Applied by hand to
`fundCatalog.ts`, each with its accession in the provenance block; the stamp does not
move; `npm run fund-fees` re-run afterwards should report zero differences.
