# The 37 non-'40-Act fund fees — read on the owner's machine, 2026-09-26

**Item:** T-386 · **Method:** `npm run fund-prospectus-fees` over the 37 catalog rows the
SEC Risk/Return dataset cannot reach (grantor trusts, commodity pools, UITs), then a
**hand read of the seven it could not resolve** · **Egress:** verified clean before the run
(Charter Communications, AS11426, `proxy:false hosting:false`) · **Writes:** nothing.
`FUND_DATA_LAST_VERIFIED` unmoved.

All 37 now carry a primary-source figure. Twenty-seven agree with the catalog to the basis
point. Three were re-flagged and are already-decided non-corrections. **Seven needed a
filing opened by hand, and four of those are wrong in the catalog by more than two
percentage points.**

## The headline: the four Teucrium funds carry the management fee, not the total

`CORN`, `WEAT`, `SOYB` and `CANE` each record `expenseRatioPct: 1.00`. That is the
management fee, stated in each fund's own prospectus:

> (2) The Fund is obligated to pay the Sponsor a **management fee at the annual rate of
> 1.00%** of the Fund's average daily net assets, payable monthly.
> — 424B3 filed 2026-04-30, breakeven analysis footnote

The same prospectus's breakeven table shows what the fund actually costs, per share:

| CORN, per share on an assumed $17.89 | Amount | As a rate |
|---|---|---|
| Management Fee | $0.18 | 1.00% |
| Estimated Brokerage Commissions | $0.02 | 0.11% |
| **Other Fund Fees and Expenses** | **$0.45** | **2.52%** |
| Total | $0.65 | **3.63%** |

And the trust's annual report states the realized figure per fund, three years each:

| Fund | Catalog | Total **gross** expense ratio, FY2025 | FY2024 | FY2023 |
|---|---|---|---|---|
| CORN | 1.00 | **3.45%** | 3.27% | 2.57% |
| WEAT | 1.00 | **3.18%** | 3.20% | 2.62% |
| SOYB | 1.00 | **3.34%** | 3.56% | 3.05% |
| CANE | 1.00 | **4.27%** | 4.42% | 3.21% |

Source: Teucrium Commodity Trust Form 10-K filed 2026-03-02 (`weat20251231_10k.htm`),
per-fund MD&A tables. No net-of-waiver line appears for these four; the trust states one
only for its Agricultural Fund (TAGS, gross 2.28% / net 0.11%), which is not in the
catalog.

**This is the USO and UNG error again, three times larger.** `fundCatalog.ts`'s own
provenance banner records USO corrected 0.81 → 0.86 and UNG 0.60 → 1.17, both because the
catalog had stored the *management fee* where the prospectus stated a higher *total*. These
four are the same shape and were never caught, because the Risk/Return dataset does not
cover commodity pools and the prospectus probe could not resolve them (see "Why the probe
missed them").

`computeFeeDrag()` projects a ten- and thirty-year dollar cost from this field and prints
it on the fund detail page. At 1.00% instead of ~3.4%, the projection understates the cost
of holding CORN over thirty years by roughly two thirds.

**Recommended, not applied:** publish the latest realized **total gross** expense ratio per
fund, with the fiscal year named in the row's description, exactly as USO and UNG were
handled. **One check first:** confirm against each fund's own published fact sheet, because
issuers sometimes publish a capped or estimated total that differs from the realized one,
and the realized ratio moves with fund size (CANE ranged 3.21–4.42% across three years).

## The other three hand reads

| Ticker | Catalog | Read | Verdict |
|---|---|---|---|
| **HACK** | 0.60 | **0.60%** — "Management Fees 0.60% · 12b-1 0.00% · Other Expenses 0.00% · **Total Annual Fund Operating Expenses 0.60%**" | ✅ agrees |
| **BAR** | 0.17 | **0.1749%** annualized Sponsor's Fee; the same report states it "was $2,534,557 **or 0.17%** of the Trust's assets on an annualized basis" for FY2026 | ✅ agrees — and this supersedes the 2018 S-1's 0.20% the probe flagged as stale |
| **PSLV** | 0.57 | Management fee **0.45%** contractual ("1/12 of 0.45% of the value of net assets … plus any applicable sales taxes"); **management expense ratio 0.56%** for 2025 (0.58, 0.60, 0.58, 0.62 in the four prior years) | ⚠ minor — see below |

Sources: Amplify ETF Trust 485BPOS filed 2026-01-28 (accession 0001213900-26-008327, fee
table at the Amplify Cybersecurity ETF heading); GraniteShares Gold Trust Form 10-K filed
2026-08-13 (0001493152-26-037707); Sprott Physical Silver Trust Form 40-F filed 2026-03-16
(0001999371-26-005829, exhibit 99-6).

**PSLV is a 0.01pp question and the figure moves every year.** The catalog's 0.57 sits
inside the five-year MER range and one basis point above the latest. The contractual fee
is 0.45%; the MER is what holders actually bore, including sales taxes. The catalog's more
inclusive figure is the right kind — the same reasoning that kept DBC and UDN where they
are. Either leave 0.57 or move it to 0.56 and name the year; both are defensible and
neither is worth much.

## The three the probe re-flagged, all already decided

| Ticker | Probe says | Standing decision |
|---|---|---|
| DBC | 0.87 → 0.85 | **Leave.** The catalog's figure is 0.02pp higher because Invesco's DB pools state fees narratively ("approximately 0.85% per annum") and their published ratios add a brokerage estimate on top. Recorded in the `fundCatalog.ts` banner. |
| UDN | 0.77 → 0.75 | **Leave**, same reasoning. |
| IBIT | 0.25 → 0.12 | **Recorded as leave** — 0.25% is the contractual Sponsor's Fee, 0.12% a temporary waiver, and the banner's rule is that "waivers are revocable, so the standing rate is the durable figure to publish". |

## ⚠ The catalog now treats waivers two ways

IBIT keeps its **contractual** rate and discloses the waiver. But `SIVR` records **0.30**,
which is its waived rate (contractual 0.45%), and the three rows added under D27 the same
day — EMLC 0.30 of 0.31 gross, BKLN 0.65 of 0.67, HEFA **0.35 of 0.70** — all record the
**net** figure with the gross in the description.

Both rules are defensible. Having both is not: two funds with the same structure now
report on different bases, and `computeFeeDrag` treats the number as comparable across
rows. HEFA is the case that makes it matter — the gross is double the net.

**Recommended:** one rule, the D27 one — publish what an investor pays today, state the
gross and the waiver's expiry in the description, and re-check when it lapses. Under that
rule IBIT becomes 0.12 with a note, and the banner's older reasoning is annotated rather
than rewritten. **This is a judgement about how the app characterises cost, so it is the
owner's, not a cleanup.**

## Why the probe missed them (and a script gap that remains)

- **CORN, SOYB, CANE** — "wrong-fund-document". Four funds share one registrant (Teucrium
  Commodity Trust, CIK 1471824) and the probe reads a filing's primary document, which for
  a shared registrant is whichever fund filed most recently. The per-fund prospectuses
  exist and are named for their fund (`cornprospectussupplement-.htm`,
  `weat20260318_424b3.htm`); a filename match would find them.
- **WEAT** — "no-fee-found": the probe read the trust's most recent 424B3, a 28 KB
  supplement with no fee table, rather than the 1.7 MB prospectus from April.
- **PSLV** — "no-fee-found": the fee sits in exhibit 99-6 of a Form 40-F (a Canadian
  filer), and the probe reads primary documents of 424B/485BPOS/S-1/10-K only.
- **BAR** — "stale-source": the probe correctly refused to contradict the catalog from an
  8-year-old S-1. The current 10-K confirms the catalog. The refusal worked as designed.
- **HACK** — "no-cik", and this one **survives the T-411 fix**: HACK is in neither
  `company_tickers.json` nor `company_tickers_mf.json`. Its registrant (Amplify ETF Trust,
  CIK 1633061) is reachable only through EDGAR company search or full-text search. A third
  resolution path would close it.

Four small script improvements, all in `probe-fund-prospectus-fees.mjs`: prefer a filing
document whose filename contains the ticker; fall back to the largest document in the
filing when the primary one carries no fee table; read 40-F exhibits; and resolve a ticker
through EDGAR company search when both JSON maps miss. None was made here — this pass was
a reading pass, and the readings are now complete without them.

## What the owner is asked to decide (T-414)

1. **Teucrium × 4** — publish the realized total gross expense ratio (CORN 3.45, WEAT 3.18,
   SOYB 3.34, CANE 4.27, FY2025) in place of the 1.00 management fee, after confirming
   against each issuer fact sheet. This is the one that changes a rendered dollar figure.
2. **One waiver rule** — adopt the D27 net-of-waiver convention catalog-wide, which moves
   IBIT 0.25 → 0.12 with the gross disclosed.
3. **PSLV** — leave 0.57, or move to 0.56 and name the year.
4. **BAR, HACK** — nothing to do; both confirmed. DBC, UDN — prior decisions hold.
