# Owner decisions — 2026-09-30

Recorded from the owner's answers in the session that worked T-414 (the rulings the
2026-09-26 reading of the 37 non-'40-Act fund fees asked for). Same form as
`2026-09-29-owner-decisions.md`: one row per ruling, what it cascades to, and what was
actually done. Each question offered the audit's recommendation first; the owner took it
all three times.

| # | Decision | Ruling | Cascades to |
|---|---|---|---|
| D35 | The four Teucrium funds' expense ratios (T-414, question 1) | **Use the realized 2025 totals** — CORN 3.45, WEAT 3.18, SOYB 3.34, CANE 4.27, in place of the 1.00 management fee, each description naming the year. Chosen over "wait for a fact-sheet check" and "leave at 1.00%". The issuer fact-sheet cross-check the audit recommended doing first becomes a follow-up, not a precondition. → APPLIED | `frontend/src/lib/data/fundCatalog.ts` (four rows and the banner); `fundCatalog.test.ts` now fails if any of these pools, or USO/UNG/CPER, records no more than its management fee; T-416 carries the fact-sheet check |
| D36 | How the catalog records a fee under a waiver (T-414, question 2) | **What investors pay today, with the full fee stated in the fund's description.** Chosen over "the full official fee". The D27 rule becomes the catalog's one rule. The 2026-09-10 IBIT reasoning ("waivers are revocable, so the standing rate is the durable figure to publish") is annotated as replaced, not rewritten. → APPLIED | SIVR's description now states its 0.45% gross; EMLC, BKLN and HEFA already complied. IBIT stays 0.25 until T-416 reads whether any waiver is in effect today. `fundCatalog.test.ts` fails if a row mentions a waiver without its gross figure, or records the gross |
| D37 | PSLV's expense ratio (T-414, question 3) | **0.56%, naming 2025** — the 2025 management expense ratio from Sprott Physical Silver Trust's Form 40-F, over leaving 0.57. → APPLIED | `fundCatalog.ts` (row and banner); pinned in `fundCatalog.test.ts` |

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
