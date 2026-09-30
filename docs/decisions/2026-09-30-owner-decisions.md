# Owner decisions — 2026-09-30

Recorded from the owner's answers in the session that worked T-414 (the rulings the
2026-09-26 reading of the 37 non-'40-Act fund fees asked for) and then T-412 (the
seventeen differences the 2026-09-26 four-quarter reconcile found). Same form as
`2026-09-29-owner-decisions.md`: one row per ruling, what it cascades to, and what was
actually done. Each question offered the audit's recommendation first; the owner took it
all five times.

| # | Decision | Ruling | Cascades to |
|---|---|---|---|
| D35 | The four Teucrium funds' expense ratios (T-414, question 1) | **Use the realized 2025 totals** — CORN 3.45, WEAT 3.18, SOYB 3.34, CANE 4.27, in place of the 1.00 management fee, each description naming the year. Chosen over "wait for a fact-sheet check" and "leave at 1.00%". The issuer fact-sheet cross-check the audit recommended doing first becomes a follow-up, not a precondition. → APPLIED | `frontend/src/lib/data/fundCatalog.ts` (four rows and the banner); `fundCatalog.test.ts` now fails if any of these pools, or USO/UNG/CPER, records no more than its management fee; T-416 carries the fact-sheet check |
| D36 | How the catalog records a fee under a waiver (T-414, question 2) | **What investors pay today, with the full fee stated in the fund's description.** Chosen over "the full official fee". The D27 rule becomes the catalog's one rule. The 2026-09-10 IBIT reasoning ("waivers are revocable, so the standing rate is the durable figure to publish") is annotated as replaced, not rewritten. → APPLIED | SIVR's description now states its 0.45% gross; EMLC, BKLN and HEFA already complied. IBIT stays 0.25 until T-416 reads whether any waiver is in effect today. `fundCatalog.test.ts` fails if a row mentions a waiver without its gross figure, or records the gross |
| D37 | PSLV's expense ratio (T-414, question 3) | **0.56%, naming 2025** — the 2025 management expense ratio from Sprott Physical Silver Trust's Form 40-F, over leaving 0.57. → APPLIED | `fundCatalog.ts` (row and banner); pinned in `fundCatalog.test.ts` |
| D38 | The sixteen corrections the four-quarter reconcile found (T-412, question 1) | **Apply all sixteen** — ICLN 0.41 → 0.39; IYT, IHI, IAI, ITA, ITB 0.39 → 0.38; SOXX 0.35 → 0.34; IBB 0.45 → 0.44; TIP 0.19 → 0.18; VUG, VTV 0.04 → 0.03; VWO 0.07 → 0.06; VBTLX 0.05 → 0.04; VWINX 0.23 → 0.22; QYLD 0.61 → 0.60; PRGFX 0.65 → 0.66. Each read from the fund's own Risk/Return filing, matched on its SEC class id. Chosen over "wait for a fresh check". → APPLIED | `fundCatalog.ts` (sixteen rows and a T-412 block citing each filed date and accession); `build-fund-fees.mjs` now reports gross beside net (below); T-417 carries the confirming re-run |
| D39 | FXAIX (T-412, question 2) | **Keep 0.015% until the prospectus is read.** The filing's data tag states 0.010% at six declared decimals; Fidelity's own literature has long said 0.015%. Both are right only if 0.010% is the fee after a waiver — a 0.015% full fee with 0.005% waived — which the 2026-09-26 run could not tell; otherwise one is wrong. The prospectus fee table decides, not the tag. Chosen over "change to 0.010% now". → HELD | T-417 reads the fee table in accession 0000819118-26-000072 on the owner's machine |

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
