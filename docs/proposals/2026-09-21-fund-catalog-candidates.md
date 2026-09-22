# Fund catalog — candidate additions for coverage gaps

**Date:** 2026-09-21 · **Item:** T-070 (S6 build-out item 2 — "catalog growth with the
provenance discipline") · **Half:** the REMOTE half only · **Status:** PROPOSAL — nothing
approved, nothing added

**Read against:** `frontend/src/lib/data/fundCatalog.ts`, `equityCatalog.ts`
(`SECTOR_INFO`), `portfolioBuilder.ts` (`SECTOR_ETF`, `BOND_STYLES`),
`app/(dashboard)/portfolio-builder/page.tsx` (`TILTABLE_SECTORS`),
`components/portfolio-builder/AllocationBuilder.tsx` (`TILTABLE`), and CLAUDE.md's Funds,
Macro and standing-rule sections. Everything described as being "in the tree" below was
read on 2026-09-21 and is a dated observation of that read, not a live figure.

---

## ⛔ STOP — NOT ONE FIGURE OR TICKER BELOW IS VERIFIED

This document was written in an environment that **cannot reach sec.gov, any issuer
website, or any quote provider**. That is not a caveat on the edges of it. It is the
condition under which every single line was produced.

Therefore:

> ### **EVERY ROW IN THIS DOCUMENT IS A CANDIDATE, NOT AN ADDITION.**
>
> **No row may be written into `fundCatalog.ts` until it has been probed on the owner's
> machine and confirmed BOTH:**
>
> 1. **QUOTABLE** — the symbol resolves and returns a price through the app's own
>    `/live-data/security-quotes` ladder, and
> 2. **ACTIVELY TRADING** — it returns a **5-day price history**, not merely a single
>    cached price. A delisted fund can still answer with a stale last price; a five-day
>    series is what distinguishes a live fund from a corpse. This is the same standard
>    CLAUDE.md records for the commodity `etfProxies` lineups ("verified both quotable AND
>    actively trading (5-day history, not just a cached price) before inclusion").
>
> **AND** its expense ratio has been read from a primary source, dated, by
> `npm run fund-fees` or from the prospectus directly.

**Why this is stated this loudly.** `computeFeeDrag()` multiplies `expenseRatioPct` out
over the projection horizon and prints the result as a dollar figure on the fund detail
page, inside the Portfolio Builder's blended-ER and fee-projection maths, and inside
`reviewPlan()`'s fee-creep check. A plausible-but-wrong expense ratio does not look wrong
— it comes out the far end as a confident ten-year or thirty-year cost. `fundCatalog.ts`'s
own provenance banner records the live example: FCNTX carried 0.39 instead of 0.74, and
the Fee Drag card understated the thirty-year cost of holding Contrafund by roughly half
until a primary source was read.

So this document **proposes and does not assert**. Where a number is not verifiable from
here, it says **unverified** and gives no figure at all. A gap that admits it is a gap is
recoverable; a guess wearing a decimal point is not.

---

## The rules this proposal is written under

These are the catalog's own rules, restated so the reader does not have to hold them in
their head while reading the tables.

**1. The `SalesCharge` rule — `kind` required, `maxPct` optional ON PURPOSE.**
A load's **existence** (established by the issuer's documented share-class structure) and
its **rate** (read from the prospectus) are separately knowable. Undefined `maxPct` means
*"a charge applies and we have not verified how much"* — it **never** means *"no charge"*.
A stated rate **requires** `source` + `verifiedAt`, enforced catalog-wide by a test.
Consequence for this document, stated plainly: **no candidate below carries a load rate**,
and none ever will from this environment.

**2. Reference values are fallbacks, not prices.** `expenseRatioPct`, `aumB`,
`referencePrice` and `yieldPct` are approximate reference values that keep pages rendering
offline; live quotes override price. That makes a wrong `referencePrice` cosmetic and a
wrong `expenseRatioPct` load-bearing — the two are not the same kind of error and must not
be probed with the same care.

**3. Delisted funds are deliberately excluded, and several empty `etfProxies` lists are
deliberate.** CLAUDE.md names the confirmed-delisted tickers. **None of them appears
below, and none must ever be proposed:**

| Confirmed delisted | Where recorded |
|---|---|
| UHN, JO, NIB, BAL, COW | single-commodity ETFs/ETNs, last trade 2019–2023, confirmed 2026-07-21 |
| FXM, BZF, CYB, ICN, SZR | EM single-currency funds, confirmed delisted |

**4. Do NOT backfill a deliberate gap with a broad-basket fund.** Heating oil, coffee,
cocoa, cotton, live cattle and lean hogs have **empty** `etfProxies` on purpose, as do
every EM currency pair, every FX cross, and NZD/KRW. Filling those with DBC, DBB, a miner
ETF or a multi-currency fund is the *overstated-specificity* error the commodity-proxy fix
already corrected once. **Nothing in this document proposes a commodity or currency
addition**, and that is deliberate rather than an oversight — see "What is deliberately
not proposed" at the end.

---

## How the gaps below were identified

Not by reading a list of popular funds. Each gap below is a place where **this repo's own
code reaches for a category and finds nothing there**. The three groups the T-070 item
suggests — bond, international, sector — are each grounded differently:

- **Sector** — `equityCatalog.ts`'s `SECTOR_INFO` defines the investable GICS sectors the
  app uses. `portfolioBuilder.ts`'s `SECTOR_ETF` is typed `Partial<Record<SectorId,
  string>>` — *partial*, because it does not cover them all. `TILTABLE_SECTORS` (the
  questionnaire) and `TILTABLE` (the allocation builder) both hard-code the same shorter
  list. As read 2026-09-21, the sectors a user **cannot** tilt toward, because the catalog
  holds no broad fund for them, are: **communication-services, consumer-discretionary,
  consumer-staples, materials**. Of those, `communication-services` and `consumer-staples`
  have **no fund in the catalog at any `focusSector` at all**; `consumer-discretionary`
  and `materials` have only narrow thematic slices (ITB/XRT and GDX/LIT respectively),
  which is not the same thing as sector exposure.

  ⚠ **This is a coverage gap, not a bug.** The UI is honest about it — it renders only
  `TILTABLE_SECTORS`, so no user is offered a control that silently does nothing. Do not
  "fix" the filter; the filter is correct until the funds exist.

- **Bond** — the catalog's bond rows cover the Treasury duration ladder, broad aggregate,
  municipals, TIPS, and USD-denominated credit. `BOND_STYLES` offers a `corporate` tilt
  and a `high-yield` tilt, served by LQD and HYG. The gaps are exposures with no
  representative at all, not second issuers for exposures already held.

- **International** — the catalog holds broad developed, broad EM, broad global and the
  EAFE benchmark. The gaps are size (small cap), currency treatment (hedged), and income
  style — again, distinct exposures rather than duplicate wrappers.

**A second issuer for an exposure already covered is NOT a gap.** SPAB beside BND, JNK
beside HYG, IEMG beside VWO — each adds a row and no new exposure. They are named in "not
proposed" so that a later reader does not mistake their absence for an oversight.

---

## Candidate group A — Sector (broad GICS coverage)

**Why first:** this is the only group where the missing funds are wired into an existing
feature that is currently narrower than its own data model.

| Ticker | Issuer (believed) | Category | `focusSector` | Expense ratio | Sales load | What is unverified |
|---|---|---|---|---|---|---|
| **XLC** | State Street | `sector` | `communication-services` | **UNVERIFIED — no figure stated** | ETF ⇒ expected none (see below) | Everything: that the symbol is live and quotable; the ER; AUM; yield; inception year; the tracked index name; top holdings |
| **XLP** | State Street | `sector` | `consumer-staples` | **UNVERIFIED — no figure stated** | ETF ⇒ expected none | As above |
| **XLY** | State Street | `sector` | `consumer-discretionary` | **UNVERIFIED — no figure stated** | ETF ⇒ expected none | As above |
| **XLB** | State Street | `sector` | `materials` | **UNVERIFIED — no figure stated** | ETF ⇒ expected none | As above |

**Issuer attribution.** The catalog already files XLK, XLF, XLE, XLV, XLI and XLU under
`issuer: 'State Street'`. The four above are named as belonging to the same Select Sector
SPDR family, which is why the same issuer string is proposed — but the *family membership
itself* is an external fact this environment cannot check. Confirm it on the issuer's own
product page during probing; if any of the four is not in that family, the issuer string
and every assumption resting on it changes.

### The one place a figure is nearly inferable — and why it still is not one

The six Select Sector SPDR funds already in the catalog **all record `expenseRatioPct:
0.09`** (read 2026-09-21). If the four candidates above are on the same family fee
schedule, that is the figure a probe should expect to find.

**That is an expectation to test, not a value to write.** Three reasons it must not be
copied into the catalog:

1. The evidence is *this catalog's own sibling rows*, not any of the four candidates'
   prospectuses. Reading a number off a neighbour is exactly the reasoning the
   `fundCatalog.ts` banner records as having held USO at 0.81 for months.
2. Those six sibling rows were themselves last confirmed against the SEC Risk/Return
   Summary data on 2026-09-01, and `FUND_DATA_LAST_VERIFIED` deliberately did **not**
   move for that check.
3. Family fee schedules are not uniform by law or by habit. "Probably the same" is a
   hypothesis; `npm run fund-fees` is the test.

**If the probe comes back with a different figure, the probe is right.** That is the
standing lesson from USO (0.81 → 0.86, the third-party API was right), UNG (0.60 → 1.17)
and CPER (0.65 → 0.88) — in the last two the catalog had recorded the **management fee**
where the prospectus stated a higher **total annual fund operating expense**. Read the
*Total*, never the management-fee line.

### Effect if these land

`SECTOR_ETF` in `portfolioBuilder.ts` could then map `communication-services`,
`consumer-staples`, `consumer-discretionary` and `materials`, and `TILTABLE_SECTORS` /
`TILTABLE` could be widened to match. **That is a separate change and is not proposed
here** — it is a code edit to files outside this document's scope, and it must not happen
before the funds exist and are verified. A tilt pointing at a catalog row that was added
on an unverified expense ratio would put a fabricated fee straight into a built plan's
blended ER.

---

## Candidate group B — Bond

| Ticker | Issuer (believed) | Category | Exposure the catalog lacks | Expense ratio | Sales load | What is unverified |
|---|---|---|---|---|---|---|
| **VCSH** | Vanguard | `bond` | Short-term investment-grade **corporate** credit. LQD is the catalog's only IG corporate row and sits at the intermediate/long end; the short end of the ladder (SHY, IEI) is Treasury-only, so `BOND_STYLES.corporate` has no short-duration instrument to reach for | **UNVERIFIED** | ETF ⇒ expected none | Symbol liveness; ER; AUM; yield; inception; index name; **and the duration claim itself** — `FundEntry` carries no duration field, so "short-term" here is a description of the fund's mandate that must be confirmed on the issuer page, not a figure |
| **VMBS** | Vanguard | `bond` | Agency **mortgage-backed** securities as a standalone holding. BND and AGG include MBS inside the aggregate, but no row isolates it, and `BOND_STYLES.aggregate`'s own note names "mortgage debt" as a component of the exposure | **UNVERIFIED** | ETF ⇒ expected none | As above |
| **VTIP** | Vanguard | `bond` | **Short-duration** inflation-protected. TIP is the catalog's only TIPS row and is broad-maturity, so an inflation hedge and a duration bet are currently inseparable in this catalog | **UNVERIFIED** | ETF ⇒ expected none | As above |
| **EMLC** | VanEck | `bond` | Emerging-market **local-currency** sovereign debt. EMB and VWOB are both **USD-denominated** EM sovereign — a credit exposure. Local-currency EM debt is a credit *and* an FX exposure, and they behave differently | **UNVERIFIED** | ETF ⇒ expected none | As above, plus: whether EMLC is genuinely local-currency rather than a blend — confirm on the issuer page before writing the description |
| **BKLN** | Invesco | `bond` | Senior/floating-rate bank loans. Every bond row in the catalog is fixed-rate, so there is no instrument whose coupon rises with short rates | **UNVERIFIED** | ETF ⇒ expected none | As above. ⚠ Also unverified and important: whether this belongs in `bond` at all. `fundRiskLevel()` maps `category: 'bond'` → **`conservative`** unconditionally. Senior loans are below investment grade. **See the risk-banding caveat below — this candidate is the weakest of the five and may be better rejected than mis-banded** |

### ⚠ The `fundRiskLevel()` caveat, which applies to this whole group

`fundRiskLevel()` returns `'conservative'` for **any** fund with `category: 'bond'`, with
no further discrimination. The catalog already stretches that: HYG (high yield) and EMB
(EM sovereign) both band as conservative today. Adding EMLC and especially BKLN stretches
it further.

**This document does not propose changing `fundRiskLevel()`.** Widening a risk band is a
judgement about how the app characterises risk to a user, and it is adjacent to decisions
the owner has already made narrowly (RP-3: explanation yes, ranking no; RP-6: no published
per-coin risk score). Raise it as its own item. **What must not happen is adding the funds
and leaving the band unexamined**, which silently labels a below-investment-grade
floating-rate fund "Conservative" on the fund detail page.

---

## Candidate group C — International

| Ticker | Issuer (believed) | Category | Exposure the catalog lacks | Expense ratio | Sales load | What is unverified |
|---|---|---|---|---|---|---|
| **VSS** | Vanguard | `international` | International **small-cap**. VXUS, VEA and EFA are all large/mid-weighted; IWM covers US small cap and has no non-US counterpart in the catalog | **UNVERIFIED** | ETF ⇒ expected none | Symbol liveness; ER; AUM; yield; inception; index name; whether its mandate is developed-only or all-world ex-US (which decides `category: 'international'` vs `'emerging'`) |
| **VGK** | Vanguard | `international` | A **region**. The catalog holds no regional fund of any kind — a user cannot express "Europe" or "Japan" at all, only "developed ex-US" | **UNVERIFIED** | ETF ⇒ expected none | As above |
| **EWJ** | BlackRock | `international` | The other half of the regional gap — Japan is the largest single weight inside VEA/EFA and is not separately reachable | **UNVERIFIED** | ETF ⇒ expected none | As above |
| **VYMI** | Vanguard | `dividend-income` *or* `international` | International **dividend/income**. Every row in `dividend-income` (SCHD, VYM, VIG, JEPI, JEPQ, QYLD) is US. **Category assignment is an open question, not a detail** — the catalog has one category per fund, and the choice decides which registry filter finds it and which `fundRiskLevel()` band it lands in (`dividend-income` → moderate, `international` → aggressive) | **UNVERIFIED** | ETF ⇒ expected none | As above, plus the category decision, which is the owner's or the reviewer's, not the probe's |
| **HEFA** | BlackRock | `international` | **Currency-hedged** developed international. Every international row is unhedged, which the Portfolio Builder's currency-sleeve note already calls out ("VXUS already carries unhedged FX exposure"). A hedged wrapper is the only way to hold non-US equity without that exposure | **UNVERIFIED** | ETF ⇒ expected none | As above, plus whether the hedge is full or partial — a description claiming "hedged" for a partially-hedged fund is a substantive error, not a wording one |

---

## The sales-load column, stated once and properly

Every candidate above is an **ETF**, and `FundEntry.salesCharge`'s docblock records that
absent = no load, "which is true of every ETF and of the no-load mutual fund families
here." So the proposal for every candidate in this document is: **omit `salesCharge`
entirely.**

**That is a claim, and it is checkable — check it.** The correct probe is not "ETFs don't
have loads"; it is confirming, on the issuer's own product page, that the instrument is an
exchange-traded fund purchased at market rather than a share class purchased at NAV plus a
charge.

**No mutual fund is proposed in this document, and that is deliberate.** A mutual-fund
candidate would require establishing its share-class structure — which is what decides
`kind` — and `kind` is **required** when `salesCharge` is present. From this environment
that structure cannot be established for any fund, and the honest default for a
load-bearing family is `{ kind }` with `maxPct` undefined, i.e. *"a charge applies and we
have not verified how much"*. Proposing a mutual fund I could not classify would mean
proposing either a fabricated `kind` or a silent no-load, and the silent no-load is the
exact failure `ISSUER_SALES_CHARGE` was built to prevent (AGTHX's front-end load rendered
nowhere in the app because the lookup key missed).

---

## The probe procedure, per candidate

Run on the owner's machine. **Check the egress first** — a VPN exit node is not the
owner's IP, and a probe run through one produces a systematically wrong baseline:

```powershell
$ip = curl.exe -s https://api.ipify.org
curl.exe -s "http://ip-api.com/json/$ip`?fields=isp,org,proxy,hosting"
```

If `proxy` or `hosting` is true, stop. (`curl` in PowerShell is an alias for
`Invoke-WebRequest` and will swallow the URL — use `curl.exe`, or `Invoke-RestMethod`.)

Then, per candidate, in this order — **any step failing rejects the candidate; it does not
downgrade it**:

1. **Quotable.** `/live-data/security-quotes?symbols=<TICKER>` returns a price whose
   `source` is **not** `'reference'` (the equivalent flag on `/api/v1/securities/quotes`
   is `reference: true`). A reference-sourced answer means the catalog answered — which,
   for a symbol not yet in the catalog, means nothing answered at all.
2. **Actively trading.** `/live-data/security-chart?symbol=<TICKER>` (or
   `security-ohlcv`) returns a **5-day history**. One cached price is not evidence of a
   live fund.
3. **Expense ratio.** `npm run fund-fees -- --inspect` first, then `npm run fund-fees`.
   Read the **Total Annual Fund Operating Expenses** line, never the management-fee line.
   For any candidate the Risk/Return Summary dataset cannot reach, `npm run
   fund-prospectus-fees` reads the filing directly.
4. **Everything else** — AUM, yield, inception, tracked index, top holdings, website —
   from the issuer's own product page, on that same date.

**Do not run `npm run audit` immediately before this.** It bursts the same providers and
can earn a per-IP rate-limit that then reads as "the symbol isn't quotable" — the
misattribution CLAUDE.md records three times over in a single day.

### And when they land: do not move the stamp

`FUND_DATA_LAST_VERIFIED` is dated by when the catalog was compiled **as a whole**. Adding
verified rows does not re-verify the existing ones. The catalog's own banner records the
precedent twice — the 2026-07-21 currency and commodity appends did not move it, and the
2026-09-01 fee spot-check of 87 rows deliberately did not move it either. **Adding these
candidates must not move it.** Record what was done in the provenance comment block, dated,
in the established form.

---

## What is deliberately NOT proposed

Listed so a later reader does not read an absence as an oversight.

| Not proposed | Why |
|---|---|
| Any commodity fund | The empty `etfProxies` lists (heating oil, coffee, cocoa, cotton, live cattle, lean hogs) are deliberate — their single-commodity ETFs/ETNs are **confirmed delisted**. Backfilling with a broad basket is the overstated-specificity error already corrected once |
| Any currency fund | Same shape: EM single-currency funds are confirmed delisted, crosses have never had a dedicated fund, NZD/KRW never had one. The empty lists are the honest state |
| UHN, JO, NIB, BAL, COW, FXM, BZF, CYB, ICN, SZR | Confirmed delisted. Named here so they are never re-proposed by someone who has not read CLAUDE.md's Macro section |
| SPAB / SCHZ (beside BND, AGG) | Second issuer, same exposure. A row, not a gap |
| JNK (beside HYG) | Same |
| IEMG (beside VWO) | Same |
| XLRE | Real estate already has VNQ, which is broader US REIT exposure than the S&P 500 slice. The weakest case in the sector group, and excluded on that basis |
| IVOL, PFF, CWB and other hybrids | Their category is genuinely arguable under `FundCategoryId`, and a fund filed in the wrong category gets the wrong `fundRiskLevel()` band. Not worth proposing without a settled answer |
| Any leveraged or inverse fund | The catalog holds a few already (UPRO, SQQQ, TQQQ, SOXL, SH). Adding more is a volume decision, not a coverage gap |
| Widening `SECTOR_ETF` / `TILTABLE_SECTORS` | A code change in files outside this document's scope, and one that must not precede the funds it would point at |

---

## Summary for the reviewer

Three groups. **Sector** — XLC, XLP, XLY, XLB, which between them would close a gap the
Portfolio Builder's own type signature already admits (`Partial<Record<SectorId,
string>>`). **Bond** — VCSH, VMBS, VTIP, EMLC, BKLN, exposures with no representative in
the catalog. **International** — VSS, VGK, EWJ, VYMI, HEFA, likewise.

**Nothing here is ready to add.** Every ticker, every issuer attribution, every expense
ratio and every descriptive claim requires probing on the owner's machine first. No
expense ratio appears anywhere in this document as a value, because a plausible one that
turns out wrong would be compounded by `computeFeeDrag()` over ten and thirty years and
shown to a user as a dollar amount.

The recommended order, if any of it is approved: **group A first** — it is the only group
whose gap is already visible in shipped code, and its four candidates share one issuer and
one probable fee schedule, so they probe as a batch.
