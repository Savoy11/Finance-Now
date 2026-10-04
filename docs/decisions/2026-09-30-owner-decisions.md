# Owner decisions — 2026-09-30

Recorded from the owner's answers in the session that worked T-414 (the rulings the
2026-09-26 reading of the 37 non-'40-Act fund fees asked for), then T-412 (the seventeen
differences the 2026-09-26 four-quarter reconcile found), then T-413 (the findings from the
2026-09-26 source-terms readings), then a ledger sweep and T-099 (D47, D48), then two
rulings the owner had made in the business chat and confirmed here (D49, D50). Same form as
`2026-09-29-owner-decisions.md`: one row per ruling, what it cascades to, and what was
actually done. Each question offered a recommendation first — the audit's, except for OKX,
where the audit named both readings without choosing and the session recommended one — and
the owner took it fourteen times of sixteen. The exceptions are D46 and D47.

| # | Decision | Ruling | Cascades to |
|---|---|---|---|
| D35 | The four Teucrium funds' expense ratios (T-414, question 1) | **Use the realized 2025 totals** — CORN 3.45, WEAT 3.18, SOYB 3.34, CANE 4.27, in place of the 1.00 management fee, each description naming the year. Chosen over "wait for a fact-sheet check" and "leave at 1.00%". The issuer fact-sheet cross-check the audit recommended doing first becomes a follow-up, not a precondition. → APPLIED | `frontend/src/lib/data/fundCatalog.ts` (four rows and the banner); `fundCatalog.test.ts` now fails if any of these pools, or USO/UNG/CPER, records no more than its management fee; T-416 carries the fact-sheet check |
| D36 | How the catalog records a fee under a waiver (T-414, question 2) | **What investors pay today, with the full fee stated in the fund's description.** Chosen over "the full official fee". The D27 rule becomes the catalog's one rule. The 2026-09-10 IBIT reasoning ("waivers are revocable, so the standing rate is the durable figure to publish") is annotated as replaced, not rewritten. → APPLIED | SIVR's description now states its 0.45% gross; EMLC, BKLN and HEFA already complied. IBIT stays 0.25 until T-416 reads whether any waiver is in effect today. `fundCatalog.test.ts` fails if a row mentions a waiver without its gross figure, or records the gross |
| D37 | PSLV's expense ratio (T-414, question 3) | **0.56%, naming 2025** — the 2025 management expense ratio from Sprott Physical Silver Trust's Form 40-F, over leaving 0.57. → APPLIED | `fundCatalog.ts` (row and banner); pinned in `fundCatalog.test.ts` |
| D38 | The sixteen corrections the four-quarter reconcile found (T-412, question 1) | **Apply all sixteen** — ICLN 0.41 → 0.39; IYT, IHI, IAI, ITA, ITB 0.39 → 0.38; SOXX 0.35 → 0.34; IBB 0.45 → 0.44; TIP 0.19 → 0.18; VUG, VTV 0.04 → 0.03; VWO 0.07 → 0.06; VBTLX 0.05 → 0.04; VWINX 0.23 → 0.22; QYLD 0.61 → 0.60; PRGFX 0.65 → 0.66. Each read from the fund's own Risk/Return filing, matched on its SEC class id. Chosen over "wait for a fresh check". → APPLIED | `fundCatalog.ts` (sixteen rows and a T-412 block citing each filed date and accession); `build-fund-fees.mjs` now reports gross beside net (below); T-417 carries the confirming re-run |
| D39 | FXAIX (T-412, question 2) | **Keep 0.015% until the prospectus is read.** The filing's data tag states 0.010% at six declared decimals; Fidelity's own literature has long said 0.015%. Both are right only if 0.010% is the fee after a waiver — a 0.015% full fee with 0.005% waived — which the 2026-09-26 run could not tell; otherwise one is wrong. The prospectus fee table decides, not the tag. Chosen over "change to 0.010% now". → HELD | T-417 reads the fee table in accession 0000819118-26-000072 on the owner's machine |
| D40 | OKX (T-413, question 1) | **Stop using it now.** Its API Agreement §9.4 allows Market Data only "for your own personal, non-commercial trading and account management purposes", bars using it in any "analytics platform", and covers public endpoints expressly. Chosen over "keep it while only you use it" (the D22 posture). → APPLIED | `okx.com` is `prohibited` in `sourceTerms.ts`; `/live-data/funding-rates` answers `ok:false` with the reason; the Market Structure panel shows funding and open interest as not available and no longer credits OKX; `DATA-SOURCES.md` (regenerated), `DATA-AVAILABILITY.md` and `CLAUDE.md`'s prohibited list updated; pinned in `sourceTerms.test.ts` |
| D41 | Nasdaq Trader (T-413, question 2) | **Add it to T-407** with CoinDesk and Investing.com — whether a plain-text symbol list is protected "Content" is the same scope question. Kept in use meanwhile. Chosen over "stop using it now". → APPLIED | `nasdaqtrader.com` goes `approved` → `conditional`, the open question written into its condition; T-407 gains it |
| D42 | KuCoin (T-413, question 3) | **Personal use only (D22)** — allowed while only the owner uses the app. Chosen over "stop using it now". → APPLIED | `⚠ SINGLE-USER ONLY` condition on `kucoin.com`, naming the written permission Article 91 asks for; its finding no longer says the terms were unread |
| D43 | Alpha Vantage, Messari, Santiment (T-413, question 4) | **Personal use only (D22).** Chosen over "stop using all three". → APPLIED | `⚠ SINGLE-USER ONLY` condition on each, naming its route to broader rights — none is stated for Santiment |
| D44 | CoinMarketCap (T-413, question 5) | **Treat it as personal (D22)** — the owner's key is free, absent or unconfirmed. Chosen over "a paid commercial plan". → APPLIED | `⚠ SINGLE-USER ONLY` condition; the commercial agreement's required credit line ("Data provided by CoinMarketCap.com" with a link) is recorded as the route to broader rights, not rendered |
| D45 | Jito, Rocket Pool, Pendle (T-413, question 6) | **The narrow reading** — their terms govern their websites, not the public APIs the app reads — as D25 read publicnode. Chosen over "stop using all three". → APPLIED | each goes `approved` → `conditional` with an "API only" condition that records the judgement as a judgement |
| D46 | Which 2026-09-26 readings to mark `verified` (T-413, question 7) | **Not yet.** No entry is flipped, including the six ruled on above: every one stays `seeded`, with its reading and its ruling recorded beside it. Chosen over "all 17 fully read and settled" and "only the 11 clean readings". → HELD | T-005 stays blocked, on this sign-off alone |
| D47 | "Set my own weights" — Portfolio Builder's build-by-allocation mode (found by the 2026-09-30 queue sweep: D4 said it was dark, and it is live) | **"A lawyer doesn't need to review this."** Build-by-allocation is cleared: no legal review, and it stays visible. Neither offered option — hide it now (recommended), or keep it for the owner and hide it before launch. **D4 is narrowed, not reversed:** its review still gates S5 contribution modeling and the federal sale-tax estimator, neither of which is built. → APPLIED | T-059, the item-16 legality question, closes. T-058, T-064 and T-068 now wait on D4's review by name; the item-16 clause of T-116's blocker is cleared. `BUSINESS-CHECKLIST.md` §5, `LEGAL-REVIEW.md` §D and the TASK-QUEUE S5 note record it |
| D48 | Est. Annual Income on holdings with no live price (T-099) | **Priced holdings only, with the coverage shown** — the page's own rule ("excluded from totals, never valued at cost"), and PB-1's for the value and P&L totals. Chosen over "keep planned amounts and say so" and "leave it as is". → APPLIED | `computeAnnualIncome` leaves out a holding with no live price and reports `unpriced` and `pricedPct`; the card says "covers N% of yielding holdings" below 99.5%, as the risk card does. The test that pinned the old behaviour is flipped, and restoring the old fallback turns two tests red. T-099 closes |
| D49 | Paid and affiliate links at launch (made in the FN & NC business chat; confirmed in this session) | **None at launch, on either product; revisit after launch.** Recorded in the ledger page's workspace log at 11:15 UTC and in the Disclosure Set, then confirmed here: *"Yes, record it."* → APPLIED | T-120 (each affiliate program's terms) and T-125 (the affiliate legal review) are parked until after launch — neither is needed for it. Nothing changes in code: no provider has an `affiliateUrl`, so the paid-link slots stay empty. `BUSINESS-CHECKLIST.md` §5 names D49 beside D7 |
| D50 | Where the legal pages go (made in the business chat; confirmed in this session) | **One About page per product**, reached from a footer link on every page and, on Finance Now, from Settings, where "About & Legal" replaces the How We Make Money entry. **Privacy keeps its own footer link** (CalOPPA; CoinGecko API Terms §7(e)). **The short "not investment advice" lines stay beside the features they qualify.** Confirmed here: *"Yes, record and reopen."* → APPLIED | T-291 is reopened — this session's queue sweep had parked it the same morning (see the note below). T-293 is unblocked: the rule it asked for is decided, and building the footer, the About page and the Settings entry is what remains. `BUSINESS-CHECKLIST.md` §3's placement line is ticked |

## Notes

**What D35 changes on screen.** The Fee Drag Analyzer on each fund's page projects a
cost from this field. On $10,000 at the analyzer's default 7% return, measured against a
0.03% index fund, CORN's thirty-year cost goes from **$19,133 at 1.00% to $48,889 at
3.45%** ($1,822 → $5,765 at ten years). The page was showing about two fifths of the real
thirty-year cost, and a third of the ten-year one. CANE, at 4.27%, now shows $54,884.

**Why D36 matches the tooling.** `npm run fund-fees` already takes the net figure where a
filing states a waiver and the total otherwise (T-411). Under D36 the catalog and the
reconcile agree by construction; under the other choice every waived fund would have
shown up as a difference on every run until the script was changed to match.

**What is still open — T-416, on the owner's machine.** This cloud session could not make
three readings: the environment's network policy refuses `www.sec.gov`, `efts.sec.gov`
and `teucrium.com`, and its web-fetch tool is blocked the same way.

1. The four Teucrium fact sheets, against the 10-K totals D35 applied.
2. Whether any IBIT or ETHA fee waiver is in effect today. The 0.12% the prospectus probe
   found in IBIT's 424B3 (`bit20251120_424b3.htm`) is a temporary waiver that was never
   checked against today's date. If it was the launch-period waiver, it has lapsed and 0.25
   is also the net figure, so nothing changes.
3. SIVR's 0.45% gross. The 2026-09-26 audit states it without naming the filing it came
   from, and D36 now prints it in SIVR's description.

**What these rulings do not decide.** T-412's seventeen '40-Act corrections are a separate
item awaiting their own ruling. DBC and UDN stay as decided on 2026-09-10.
`FUND_DATA_LAST_VERIFIED` does not move: six corrected rows of 140 re-verify nothing else.

**Later the same day.** On merging #253 the owner said *"It's fine I trust your
findings"* instead of reading the four Teucrium fact sheets; the session took that as
dropping T-416's first reading and said so, with no objection. T-416 keeps the other two,
which are not checks of anything already found. T-412 was then ruled as D38 and D39.

## Notes on D38 and D39

**How big the changes are.** Fourteen are 1 bp cuts, ICLN's is 2 bp, and PRGFX rises
1 bp. The audit's prose called all sixteen 1 bp; its table showed ICLN at −0.02, and the
question put to the owner repeated the prose. PRGFX is an actively managed fund whose
ratio is realized, so it moves both ways; the others are prospectus fees filed after the
catalog was compiled — the same shape as the sector SPDRs D27 corrected.

**What is not known, and why the script changed.** `npm run fund-fees` compares the
catalog against the net figure where a filing states a waiver and the total otherwise —
D36's first half, as the D36 note above says. But until this change it then dropped
whichever figure it had not compared, so no run could say whether a figure was a waiver
or a cut, and D36's second half — the description states the full fee — could not be
checked for any fund it read. The note above calls the catalog and the reconcile
"agreeing by construction"; that was true of the number and not of the disclosure. The
script now keeps both figures per fund and prints every waiver with whether the catalog
description states the gross (`scripts/lib/feeWaiver.mjs`, unit-tested; the report was
run offline against a synthetic dataset to see each branch print). Whether any of
D38's sixteen is a waiver is therefore still open, and T-417's re-run answers it.

**Why FXAIX was held.** The dataset row is `0.0001` at six declared decimals, so the filer
stated 0.010% rather than rounding 0.015%, and the reconcile's own report asks for the
prospectus text before the row moves. Holding it risks overstating the fee by 0.005
percentage points; moving it wrongly would publish a fee the fund does not charge.

**Or both are right.** The owner asked whether the 0.005% is a fee paid to Fidelity. It may
be: if the fee table shows a 0.015% management fee with 0.005% waived, Fidelity's 0.015%
is the full fee and 0.010% is what investors pay, and under D36 the row becomes 0.01 with
"(0.015% gross)" in its description. The first draft of D39 said the two "cannot both be
right"; that was too strong, and T-417 now covers the waiver case. It could not be settled
from the cloud session: its network policy refuses sec.gov and fidelity.com, and two web
searches returned summaries that disagreed — one described a 0.015% total with a 0.010%
net, the other gross and net both at 0.015%. Neither is a reading.

## Notes on D40–D46

**Why OKX went and the D22 sources stayed.** FMP, Finnhub, Tiingo and now KuCoin, Alpha
Vantage, Messari, Santiment and CoinMarketCap grant a licence for personal use and forbid
going beyond it — a condition this app meets while only the owner can load a page. OKX's
grant is narrower in kind: "your own personal, non-commercial *trading and account
management* purposes", with a separate bar on any "analytics platform". That is the
Poloniex shape (§9, "solely for the purposes of trading on Poloniex"), where the use falls
outside the grant rather than failing a condition inside it — so there was no licence to
keep while single-user.

**What D40 costs.** One panel: funding rate and open interest on the crypto
technical-analysis page's Market Structure panel, which now say "not available — source
withdrawn", with the reason on hover. OKX was the surface's only source, which is the
single-sourcing D21 warns about; Binance futures answers 451 from US hosts. A replacement
needs a source whose terms permit display in an analytics product, and that is a new
reading, not a setting. The route keeps its address and response shape, so one can be
wired in without touching the panel. The rewrite also removes a defect: a failed OKX call
used to be reported as a 0% funding rate.

**D46 and what "seeded" now means for these entries.** The registry defines `seeded` as
"written from documented posture, never read". Every entry read on 2026-09-26 stays
`seeded` by the owner's choice, although its document was read, so each carries a dated
`READ` note and, where ruled, a `RULED 2026-09-30` note saying so. OKX is therefore
`prohibited` and `seeded` at once — the combination Yahoo already had.

**Two slips in the record, corrected here.** The 2026-09-26 audit and T-413 both speak of
"nine findings" and list ten hosts: Nasdaq Trader, OKX, KuCoin, Alpha Vantage,
CoinMarketCap, Messari, Santiment, Jito, Rocket Pool and Pendle. And OKX's registered
`termsUrl` names its API documentation rather than the API Agreement the reading found
through the Terms of Service §4.3; the reading did not record that address, so the entry
says so and T-005's sign-off should record it.

## Notes on D47 and D48

**The sweep behind D47.** The next four owner-decision items in the ledger were T-096 to
T-099, and three of them had been decided on 2026-09-14 and built that day. A pass over
every item not closed found 47 in the same state; the owner approved applying all 47
(`docs/audits/queue-sweep-2026-09-30.md`). One finding needed the owner rather than the
ledger: D4 — restated by D30 — says build-by-allocation "stay[s] built but dark until a
qualified review clears" it, and `BUSINESS-CHECKLIST.md` listed it as "built, dark", while
the mode switch was live at `portfolio-builder/page.tsx:278`. D47 settles it the other way
from both offered fixes: nothing is hidden, because no review is needed.

**What D47 does not decide.** The answer was given about the tool the question named. It is
not recorded as a ruling on the other two tools D4 named — S5 contribution modeling and the
federal sale-tax estimator — and nothing about them was changed on its strength. Both are
unbuilt, and their items (T-067, T-058) say not to build them before the review. If the
owner's answer covers them too, that is its own ruling. (`BUSINESS-CHECKLIST.md` had also
called those two "built"; it now says they are not.)

**Why D48 shows a percentage rather than a count.** The Weighted Risk card beside it already
says "covers N% of allocation" when its figure describes only part of the portfolio, and a
reader who has learned that line should find the same one here. The percentage is of the
yielding holdings' planned capital, not of the whole portfolio: a crypto position can never
yield income on this card, so counting it would make a fully priced estimate look partial.
With no live price at all, the card shows a dash and says how many yielding holdings lack
one.

## Notes on D49 and D50

**Where these came from.** Both were made earlier the same day in the FN & NC business chat,
which is drafting the disclosure set, and recorded there and in the ledger page's workspace
log — not in the repository, because this file was still in an open PR (#254). The workspace
entries said so themselves. This session found them only after #254 merged, by reading that
log, and asked the owner to confirm each before recording it; both were confirmed.

**The mistake D50 corrects.** The morning's queue sweep parked T-291 under D7 ("the disclosure
documents land with the rollout") without reading the workspace log, where the business chat
had recorded a first draft of the whole disclosure set on 29 September and the placement
decision on 30 September. "Parked" means *do not start unprompted*, and the owner had
prompted it. T-291 is reopened, the correction is recorded on the item and in
`docs/audits/queue-sweep-2026-09-30.md`, and that record now says to read the log before a
sweep.

**What D49 does not do.** It does not remove anything built: the per-link "Paid link" label,
`SponsoredLink` and the How We Make Money page stay, unused. The business chat is redrafting
that page as a short launch version ("no link on either site pays us"); that copy is T-119's,
awaiting the owner's approval, and is not recorded as a ruling here. T-123 (affiliate
sign-ups on the Coin Registry) and T-124 (brokerage referrals) are also affiliate surfaces,
but the owner confirmed parking the two items named, so these two were left as they are.

## Pointers appended 2026-10-04

> The rulings above are left as made.
>
> - **D46's hold was lifted by D54** (`2026-10-04-owner-decisions.md`). The owner chose
>   option 1, "All 17 fully read and settled", and those seventeen readings are now
>   `verified`.
> - **T-119 closed the same day.** The launch copy that the note on D49 says was waiting for
>   the owner's approval became the How we make money section of `/about` (D50, T-293). It is
>   approved, or not, together with the rest of the disclosure set under T-291.
