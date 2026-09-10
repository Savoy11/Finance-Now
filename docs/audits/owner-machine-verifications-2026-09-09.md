# Owner-machine verifications — 2026-09-09

Four queue items that could only be settled on a machine with real network reach.
Tree at `74f1598`. Each section states what was measured, not what was expected.

| Item | Outcome |
|---|---|
| **T-305** USDP / SNX price in portfolios | **Bug found and fixed** — two invalid CoinGecko ids |
| **T-272** FMP `historical-price-eod/full` carries `adjClose` | **Verified — no change needed** |
| **T-089** curve-sourced Treasury yields | **Data + mapping verified**; on-screen render still unverified |
| **T-155** fund-fee reconciliation | **Unblocked and run** — three separate wrong assumptions in the script |

---

## T-305 — two CoinGecko ids in `coinCatalog.ts` matched nothing

`paxos-standard` (USDP) and `havven` (SNX) price correctly:

    {"prices":{"paxos-standard":0.999782,"havven":0.213029},"missing":[],"source":"live"}

`FN_TRACKED_IDS` held the *intuitive* spellings instead, and neither exists:

    {"prices":{},"missing":["pax-dollar","synthetix-network-token"],"source":"error"}

CoinGecko keys both coins by their ORIGINAL project name. The intuitive spelling is
not an alias — it resolves to nothing.

**Why it mattered.** That set exists to EXCLUDE already-tracked coins from discovery
(`coin-discovery/route.ts:105`). With ids that match nothing, `/coin-discovery` was
offering USDP and SNX as fresh candidates for coins the platform already tracks, and
its `alreadyTracked` counter read two low. Nothing validates these ids, so the failure
was silent.

**Scope checked, not assumed.** All 47 ids were priced in one batched call: 45
resolved, and only these two did not. The task named two, and two was the whole of it.

Fixed, with the counter-intuitive ids explained at the site so they are not "corrected"
back, and the audit harness's `portfolio-prices` probe widened from 3 ids to 5 so both
are checked on every run.

## T-272 — FMP's `full` endpoint IS split-adjusted

The route's comment said this "varies by plan" and asked for a live check. It has now
had one, on the free tier, and no switch to the dividend-adjusted endpoint is needed.

NVDA (10-for-1 split, 2024-06-10), `range=5Y`, 1254 candles, window 2021-09-10 to
2026-09-09:

| Evidence | Reading |
|---|---|
| across the split | 122.44 → 121.00 → 120.89 → **121.79** → 120.91 — no cliff |
| largest 1-day move, whole 5 years | **1.24×** (a split would be ~10×) |
| Sept 2021 close | **22.48**, where unadjusted NVDA traded ~$224 — i.e. ÷10 |

Recorded at the call site. Deliberately NOT switched pre-emptively: the
dividend-adjusted endpoint also applies dividend adjustment, which would silently
change the basis of every existing chart.

## T-089 — the curve is right; the pixels are still unverified

`/live-data/treasury-yield-curve` returns 13 maturities in plain percent, dated
2026-09-09. Running the real `yieldFromCurve` mapping against that live payload:

    ^IRX  13-Week T-Bill Yield    3.95%   Official Treasury par yield, 3M  · daily, as of 2026-09-09
    ^FVX  5-Year Treasury Yield   4.61%   Official Treasury par yield, 5Y  · daily, as of 2026-09-09
    ^TNX  10-Year Treasury Yield  4.83%   Official Treasury par yield, 10Y · daily, as of 2026-09-09
    ^TYX  30-Year Treasury Yield  5.28%   Official Treasury par yield, 30Y · daily, as of 2026-09-09

All four plain percent (no ×10 index artifact — the thing D3 was about), each labelled
`daily` with its maturity and date, and all four futures entries correctly returned
`null` rather than borrowing a curve yield.

⚠ **What is NOT verified: the rendered page.** `/macro/rates` returns 69 KB of HTML
containing zero percent-formatted values — the KPIs are client-rendered, so `curl`
cannot see them. Two apparent matches in the HTML were SVG path coordinates, not
yields. Closing T-089 fully needs a browser; everything behind the pixels is confirmed.

No test was added: `ratesFromCurve.test.ts` already covers this with fixtures,
including "every yield entry in the catalog resolves against a real curve".

## T-155 — three wrong assumptions, all of them silent

The task expected one blocker (a moved index URL). There were three, stacked.

**1. The index URL — one missing hyphen.** All five recorded candidates 404'd. The live
page is

    https://www.sec.gov/data-research/sec-markets-data/mutual-fund-prospectus-riskreturn-summary-data-sets

`riskreturn`, not `risk-return`. Found by listing hrefs on
`/data-research/sec-markets-data` rather than guessing a sixth spelling. 63 quarterly
archives, back to 2010q4, newest 2026q2.

**2. The archive filenames carry a digit.** Files are `2026q2_rr1.zip`, not `_rr.zip`.
The script's "is this the right page" probe tested for the undigited form and therefore
rejected a page carrying all 63 of them — reporting "could not find the index" for a
page it had already fetched with HTTP 200. Now tolerant of `rr`, `rr1`, `rr2` and so on.

**3. There is no ticker column, and the `class` column is empty.** `num.tsv` has no
ticker at all, and its `class` column is empty on **all 537,808 rows**. The share class
lives in `otherdims`, as `Class=C000nnnnnn;` — present on all 5,917
`NetExpensesOverAssets` rows. Tickers now join through the SEC's own
`company_tickers_mf.json` (note `_mf`; the intuitive `_mutual_fund` spelling 404s) — the
same map `lib/server/nport.ts` resolves fund series through, so the fee path and the
holdings path cannot disagree about which registrant a ticker is.

⚠ Joining on `series` instead would have been the easy mistake: a series holds many
share classes (AGTHX / AGTFX / CGFAX), so a Class A load would have landed on a no-load
class. That is exactly the wrong-fund error this script exists to prevent, which is why
the class dimension inside `otherdims` matters rather than being a detail.

### The unit is now declared, not inferred

`num.tsv` states its own unit per row: `uom=pure` means a decimal fraction
(`0.0112` = 1.12%). The script previously decided this ONLY by calibrating against the
catalog, needing 5 matched funds and aborting below that — which made the unit
"undecidable" for data that was never ambiguous, because one quarterly archive covers
only the funds that filed a prospectus that quarter.

`uom` is now primary and the calibration is **kept as a cross-check**: where both are
available and they disagree, the run stops rather than picking a winner. A mixed or
unrecognised `uom` also stops the run instead of guessing a scale.

### Results

    matched 27 of 126 catalog funds  (was 0)
    class-id map: 89 classes cover 89 of 126 catalog symbols
    unit: decimal — declared by the dataset (uom=pure), x100

Every SEC expense ratio found **agrees with the catalog exactly** — zero discrepancies
at or above 0.005pp:

| symbol | catalog | SEC | delta |
|---|---|---|---|
| GDX | 0.51 | 0.51 | 0 |
| AGG | 0.03 | 0.03 | 0 |
| MUB | 0.05 | 0.05 | 0 |
| DODGX | 0.51 | 0.51 | 0 |

Four exact matches is itself corroboration of the ×100 scale — the cross-check passing
in substance, just under its formal 5-sample threshold. No sales charges among matched
funds, and the no-load share classes (VTSAX, VFIAX, VBTLX, DODGX) correctly report a
zero front-end load.

### What this run does NOT settle

- **The 37 symbols absent from the MF map are not series registrants at all** — SPY,
  GLD, IAU, SLV, USO, UNG, the CurrencyShares trusts, UUP/UDN, IBIT/ETHA. Commodity
  pools and UITs file differently. Their absence is a *filing structure* fact, never
  "no fee published".
- **AGTHX is not in the 2026q2 archive**, so **T-073 remains open**. Its Class A
  front-end load needs the quarter its prospectus was filed — the script can now reach
  any of the 63 archives, so this is a matter of picking the right one.
- **99 of 126 funds** had no usable value this quarter. That is expected from a single
  quarterly archive and is not evidence about those funds.
- **`FUND_DATA_LAST_VERIFIED` was not moved**, and this script still never writes to the
  catalog. Both by design.
- The generated `fund-fee-reconcile.json` and `fund-fee-worksheet.csv` are gitignored,
  so the figures above are the record.
