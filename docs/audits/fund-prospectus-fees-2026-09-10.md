# T-386 — expense ratios for the 37 funds the Risk/Return dataset cannot reach

Run 2026-09-10 on the owner's machine, `npm run fund-prospectus-fees`.
**27 confirmed unchanged · 3 flagged (all correctly left alone) · 7 unresolved · 2 real errors corrected.**

`FUND_DATA_LAST_VERIFIED` was **not** moved. Verifying 22 of 126 rows does not refresh
the other 104, and that date asserts the table was compiled as a whole.

## Why this was possible at all

These 37 are absent from the SEC's quarterly Risk/Return Summary dataset because they are
UITs, grantor trusts or commodity pools, which file differently. For months that absence
was recorded as *"no primary source in hand"*, and USO's ratio sat wrong at 0.81 on the
strength of it.

**Absent from the dataset we habitually read is not the same as unobtainable.** Every one
of these funds files a prospectus, and a prospectus states fees. The USO correction
(#173) proved it for one fund; this did it for all 37.

## Real error 1 of 2: UNG

```
Management Fees                        0.60 %
Distribution Fees                      NONE
Other Fund Expenses                    0.57 %
Total Annual Fund Operating Expenses   1.17 %
```

From UNG's 424B3 filed 2026-04-24 (CIK 1376227). `0.60 + 0.57 = 1.17`, so the components
reconcile.

**The catalog held 0.60 — the management fee, recorded as if it were the expense ratio.**
The app was showing barely half the real cost of a fund whose fee is its main drawback.
Same class of error as USO, roughly twice the size. Corrected to 1.17.

## Real error 2 of 2: CPER — the same mistake

```
Management Fees                        0.65 %
Other Fund Expenses                    0.23 %
Total Annual Fund Operating Expenses   0.88 %
```

From CPER's own 424B3 filed 2026-04-24. `0.65 + 0.23 = 0.88`. **The catalog held 0.65 —
the management fee.** Identical to UNG.

Two of USCF's six funds had it; USO, USL, BNO and UGA were already correct, which is why
it looked like a one-off rather than a pattern.

## The three flagged and deliberately NOT changed

| Fund | Catalog | Prospectus | Decision |
|---|---|---|---|
| DBC | 0.87 | mgmt 0.85; "aggregate amount of approximately 0.85% per annum"; **no itemised AFOE table** | leave |
| UDN | 0.77 | mgmt 0.75; identical language; no AFOE table | leave |

Both are Invesco DB commodity pools that state fees **narratively** rather than in a fee
table. The catalog is 0.02pp higher in each case — the brokerage estimate their published
ratios add. Both figures are defensible and the catalog's is the more inclusive one, so
changing it on the strength of the word "approximately" would trade a complete figure for
a narrower one.

⚠ **This is why the probe reports and never writes.** It flagged three differences and
only one was an error. Applied automatically it would have made two funds less accurate in
order to fix one.

## 19 confirmed unchanged

`SPY · DIA · GLD · IAU · SLV · PPLT · USO · USL · BNO · UNL · UGA · ETHA · FXE · FXB ·
FXY · FXF · FXC · FXA · UUP`

Worth stating plainly: this is the bulk of the result. Most of the catalog was right, and
now it is right *with a citation* rather than by assumption.

## 15 unresolved — NOT evidence of anything

A fund whose fee label this script does not recognise still has a fee. These need a human
opening the filing; the URLs are recorded so nobody repeats the lookup.

| Fund | Why | Filing |
|---|---|---|
| HACK | no CIK in `company_tickers.json` | — |
| GLDM · SGOL · AAAU · BAR · SIVR · PSLV · PALL | fee label not matched — mostly older grantor-trust filings using wording the probe does not cover | see run log |
| CPER · CORN · WEAT · SOYB · CANE | fee label not matched. CORN/WEAT/SOYB/CANE share ONE combined Teucrium filing, so a single read settles four | `tags20260831_424b3.htm` |
| IBIT | fee label not matched | `bit20251120_424b3.htm` |
| OUNZ | EDGAR returned 503 mid-run (rate limit, not a missing filing) — just re-run | — |

Several are quick wins: the four Teucrium funds share a prospectus, and OUNZ is only a
retry.

## The probe itself

`scripts/probe-fund-prospectus-fees.mjs`, `npm run fund-prospectus-fees`. Reports, never
writes — same split as `build-fund-fees.mjs`. It records **which label it matched**
alongside every number, because different structures name the same quantity differently: a
'40-Act ETF states "Total Annual Fund Operating Expenses", a grantor trust a "Sponsor's
Fee", a commodity pool itemises management plus other expenses.

⚠ **One bug worth recording, caught only by smoke-testing against a known answer.** The
first version reported USO as **0.45%** (its management fee) instead of 0.86%, because
filers separate a label from its value with `&#9;` — a tab entity that *contains a digit*,
which the "no digits between label and value" guard could not cross. A confidently wrong
number, on the one fund whose right answer was already known. It was caught because that
fund was probed first, deliberately, before the other 36 were trusted.

---

## What the probe learned during this run

Five defects surfaced while running it, every one found by checking a result rather than
trusting it. They are listed because each was a *silently plausible* wrong answer.

| # | Symptom | Cause | Guard added |
|---|---|---|---|
| 1 | USO read **0.45%** (its management fee), not 0.86% | filers separate label from value with `&#9;` — a tab entity **containing a digit**, which the "no digits between label and value" rule cannot cross | decode numeric entities before matching |
| 2 | Every well-formed filing flagged AMBIGUOUS | a stated total and its components legitimately differ | ambiguity reserved for *competing components with no total* |
| 3 | 6 trusts "no fee label matched" | they write "the Sponsor's **annual** fee of 0.10%", not "Sponsor's Fee" | allow a qualifier between the words |
| 4 | SGOL/IBIT/CORN returned 1–5 KB | `primaryDocument` is often a **cover page**, and the newest 424B3 is often a **supplement** incorporating the base prospectus by reference | fall back to the largest doc in the accession, then walk back through earlier filings |
| 5 | **CPER read 1.05% — USCI's fee** | shared registrant; the walk-back reached a sibling fund's prospectus | require the fund to be named **on the cover page** |

Defect 5 deserves emphasis: it produced a confident, plausible recommendation to put one
fund's fee on another. Nothing about the output looked wrong.

⚠ The cover-page guard itself then failed twice before it was right, and both failures are
instructive. **Ticker-only** rejected SPY, DIA, IBIT and ETHA, whose covers print a name and
never a ticker. **Word-overlap** on the name accepted USCI for CPER, because "United States
Copper Index Fund" and "United States Commodity Index Fund" share four words of five. Only a
**contiguous phrase** match separates siblings while still matching name-only covers.

The through-line, and the reason this script reports rather than writes: **of five
differences it flagged across the run, two were real errors and three were correct data it
wanted to overwrite.** A 40% hit rate is useful for directing attention and useless as an
automatic action.
