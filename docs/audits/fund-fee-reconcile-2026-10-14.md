# Fund fee reconcile — 2026-10-14 (T-417)

**Owner's machine** (Spectrum, residential), `npm run fund-fees` over the SEC's four newest
Risk/Return Summary data sets (2026q2, 2026q1, 2025q4, 2025q3): 97 of the 140 catalog funds matched,
the unit declared by the data set (`uom=pure`) and agreeing with the catalog's own ratios. The
script reports and never writes. T-417 asked three things of it: confirm the sixteen fees T-412
applied (D38), check the waiver list under D36, and read FXAIX's fee table (D39).

## The sixteen fees from 2026-09-30 hold, at the filings' own precision

The re-run found no difference on any of them. That alone could not settle it (see the next
section): a fee stored short would match a catalog row set from the same short value. So each was
also read from its own filing's inline XBRL tag, at the precision the filing declared:

| Fund | Catalog | Filing tag | Declared places | Accession |
|---|---|---|---|---|
| ICLN | 0.39 | 0.39 | 4 | 0001193125-25-187621 |
| IYT | 0.38 | 0.38 | 4 | 0001193125-25-187621 |
| SOXX | 0.34 | 0.34 | 4 | 0001193125-25-162603 |
| IBB | 0.44 | 0.44 | 4 | 0001193125-25-162603 |
| IHI | 0.38 | 0.38 | 4 | 0001193125-25-162603 |
| IAI | 0.38 | 0.38 | 4 | 0001193125-25-162603 |
| ITA | 0.38 | 0.38 | 4 | 0001193125-25-162603 |
| ITB | 0.38 | 0.38 | 4 | 0001193125-25-162603 |
| TIP | 0.18 | 0.18 | 4 | 0001193125-26-064179 |
| VUG | 0.03 | 0.03 | 4 | 0000036405-26-000181 |
| VTV | 0.03 | 0.03 | 4 | 0000036405-26-000181 |
| VWO | 0.06 | 0.06 | 4 | 0001193125-26-032824 |
| VBTLX | 0.04 | 0.04 | 4 | 0000794105-26-000106 |
| VWINX | 0.22 | 0.22 | 4 | 0001193125-26-024956 |
| QYLD | 0.60 | 0.60 | 4 | 0001432353-26-000085 |
| PRGFX | 0.66 | 0.66 (net and total) | exact | 0001999371-26-004113 |

Every one was tagged to hundredths of a percent, so the data set's four places could not have cut
it, and every one matches. None is a waived figure: none appears in the re-run's waiver list.

## FXAIX: the catalog's 0.015% is right; the data set stores it short

The prospectus fee table in 0000819118-26-000072 (filed 2026-04-24) reads: management fee 0.015%,
distribution fees none, other expenses 0.000%, **total annual operating expenses 0.015%**, with no
waiver line. The filing's inline tag agrees: 0.015 at scale −2, six declared decimals. That is
T-417's outcome (c): the row stays at 0.015.

The 0.010% came from the data set. Its `num.tsv` holds `0.0001` for the class (C000100045) while its
`dcml` column still says 6. **The data set keeps four decimal places**, so a fee in thousandths of a
percent reads short: the same filing's 0.035% funds (C000103355, C000103357) are stored as `0.0003`.
D39 read the `0.0001` as "0.010% as stated, not a rounding of 0.015%". It was the rounding.

**The script now says so.** `scripts/lib/datasetPrecision.mjs` (tested, every rule mutation-checked)
marks a difference smaller than one stored unit, on a row whose filing declared more places than
were kept, as one the data set cannot settle. Such a row leaves the "differing" list for its own
section, "read the filing, change nothing". A real change of a hundredth of a percent is a whole
unit and still reports as a difference. On the re-run FXAIX moved there and the differing list
read "none".

## Fee waivers (D36): PDBC now states its full fee

| Fund | Net | Gross | Before | After |
|---|---|---|---|---|
| HEFA | 0.35 | 0.70 | stated | stated |
| EMLC | 0.30 | 0.31 | stated | stated |
| BKLN | 0.65 | 0.67 | stated | stated |
| PDBC | 0.59 | 0.74 | **not stated** | stated |

PDBC's fee table (0001104659-26-020374, filed 2026-02-26): management fee 0.59%, acquired fund
fees and expenses 0.15% (the money-market funds it holds), total 0.74%, a 0.15% waiver, net 0.59%.
Invesco "has contractually agreed to waive" that 0.15% "Through August 31, 2027" and "cannot
discontinue this waiver prior to its expiration". The row keeps 0.59, and its description now ends
"Expense ratio is net of a contractual waiver (0.74% gross, 0.15 of it the fees of the money-market
funds it holds, waived through August 31, 2027)."

## Also reported, nothing to do

- **AGTHX:** front load 5.75%, deferred 1%, 12b-1 0.24%, from 0000051931-25-001201. The catalog
  already records the 5.75% front load from the same filing (verified 2026-09-10).
- **43 funds with no usable value:** the same commodity trusts, currency trusts and UITs as before,
  which file no Risk/Return data. Absence is not evidence of anything.

`FUND_DATA_LAST_VERIFIED` does not move: this checked seventeen rows and one description, not the
table.
