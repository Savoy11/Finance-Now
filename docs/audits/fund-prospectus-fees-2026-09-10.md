# T-386 — expense ratios for the 37 funds the Risk/Return dataset cannot reach

Run 2026-09-10 on the owner's machine, `npm run fund-prospectus-fees`.
**19 confirmed unchanged · 3 flagged · 15 unresolved · 1 real error corrected.**

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

## The one real error: UNG

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

## The two flagged and deliberately NOT changed

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
