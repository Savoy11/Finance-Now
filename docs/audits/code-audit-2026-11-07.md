# Code audit — 2026-11-07

**Run by:** the `code-auditor` agent (`.claude/agents/code-auditor.md`), in a cloud container, read-only, at
the owner's request ("Check what we built"). **Scope:** the eight feature PRs merged since the last audit,
#475 to #482 (T-445 to T-452, D198 to D205): `git diff a74b1b8..dc37485`. **Checked out:** `f5dcbed` on
`claude/dazzling-volta-lbbz61` (main at `dc37485` plus one merge commit).

**Every finding below was re-checked against the code before it was fixed.** The owner asked for all of
them to be fixed before the report came back ("Fix all of them", D206). What was done, and how each fix was
checked, is in the last section.

## Checks run

- `npx tsc --noEmit`: exit 0.
- `npx eslint .`: 0 errors, 46 warnings (the same count as 2026-11-05).
- `npx vitest run`: 235 files, 3,547 tests passed. Coverage 84.5% of statements, 78.34% of branches (85.15%
  and 78.21% on 2026-11-05). `lib/server/tradeImports.ts` and `lib/server/secListings.ts` have no unit
  coverage.
- `npx next build`: exit 0.
- `docs:check` (23 counts), `queue:check` (0 failing, 1 to review: T-407, unchanged), `staleness:check`
  (every clock fresh or acknowledged; `FUND_FACTS_BUILT_ON` acknowledged 2026-11-07, and
  `FALLBACK_MEASURED_ON` fires on 2026-11-20), `deps:check` (nothing high or critical).
- `npm run data-sources -- --verify`: 60 surfaces, no drift across 64 routes, and `DATA-SOURCES.md` left
  alone (the D195 fix holds).

**Network:** five GET requests to home.treasury.gov, a host the app already reads, for the 2020, 2021 and
2022 real-curve files and the 2020 and 2023 par-curve files. Nothing went to sec.gov or data.sec.gov (the
app's SEC requests name the owner's email as their contact), and the app was not started.

**Not run:** `npm run audit` and `npm run smoke` (not the owner's machine, and both call the SEC); the
`mcp-server` type-check (nothing in scope touched it); the frozen backend (D2).

## Findings

### 1. Negative real yields were thrown away, and the chart drew a line across the gap (P1) — reproduced

`lib/server/treasuryCurve.ts:102` read each figure with `([\d.]+)`, which cannot match a minus sign. The
Treasury's 2021 real-curve file writes `<d:TC_10YEAR m:type="Edm.Double">-1.08</d:TC_10YEAR>`; the app's own
`parseCurveFile(xml, 'real')` over that file kept 58 of 251 days and none with a 10-year real yield.
Negative readings in the Treasury's files:

| Year | 5Y | 10Y | 30Y |
|---|---|---|---|
| 2020 | 243 of 251 | 227 of 251 | 190 of 251 |
| 2021 | 251 of 251 | 251 of 251 | 193 of 251 |
| 2022 | 112 of 249 | 80 of 249 | 41 of 249 |

`components/markets/YieldHistoryCard.tsx:96` passed `connectNulls`, so the real-yield and expected-inflation
lines were joined straight across the missing days, and since the files had been read, the card's "the line
has a gap there" note never appeared. On Bonds & Rates and the 5-, 10- and 30-year yield pages, the 5Y and
10Y ranges drew 2020 to spring 2022 as a straight line between readings on either side, while the real yield
was negative for that whole time. The default 1Y range and the expected-inflation table were not affected.

### 2. A tracked portfolio's 10-year fund cost charged the sales load again on funds already owned (P2) — reproduced

`lib/data/portfolioCosts.ts:93-105` sent each fund's live value to `feeImpact`, which takes a verified front
load off at year 0, and the tracked card labelled the figure "at today's values". AGTHX (verified 5.75% load)
worth $50,000 in a tracked portfolio showed **$10,687** over ten years; without the load, already paid when
the fund was bought, **$5,357**. D198 and the methods page said "verified sales charges included" for both
kinds of portfolio, so this was a question for the owner rather than a break of the decision; the owner's
"fix all" answered it (D206).

### 3. The trade import took a trade row for the column names when a file's last columns are usually empty (P2) — reproduced

`lib/data/tradeImport.ts:126-148` dropped trailing empty cells when measuring a line, and took the first line
whose width matched the most common width exactly. In a file whose last columns (fees, a note) are empty on
most rows, those rows are narrower than the column names, so the first trade became the column names, the
real ones were set aside as "above the column names", and every row with a fee or note filled was set aside
as having too many cells. At worst a person matched columns to data values and imported, losing the first
trade and every row with a fee from the history the gains are worked out on. The existing test had one data
row, so it never met this.

### 4. The macro agent's history tool gave weekly highs and lows as the period's (P3) — reproduced

`lib/agents/tools.ts:1011-1013` (yields) and `:1029-1031` (currency pairs) took the highest and lowest of the
route's points, which over 5Y and MAX are each week's last reading, beside a note saying "One official figure
a day". On the 2023 par file the daily 10-year high was 4.98% (2023-10-19) and the weekly series' 4.93%
(2023-10-20).

### 5. "Download my data" labelled every what-if entry price as dollars (P3) — reasoned from the code

`lib/data/userExport.ts:160-161` named the column `entry_price_usd`, while the Portfolios page has the entry
price typed in the instrument's own unit (`entryUnitLabel`): cents for grains, percent for yields, points for
bond futures, the quote currency for a currency pair. A corn entry of 472.75¢ exported as
`entry_price_usd = 472.75`.

### Set aside as minor

- The date order is guessed from the first 50 rows (`tradeImport.ts:331`); later rows with a day above 12
  are then refused on screen, so it is not silent.
- A single-trade save and an import shared no lock, so `MAX_TRADES_PER_PORTFOLIO` could be passed by
  requests sent at once.
- `lib/server/tradeImports.ts`'s transaction, lock and repeat check have no unit test (D200 records a manual
  run against PostgreSQL 16).
- `rangeStart`: 31 March less one month gave 3 March.

## Examined and found sound

- **Who can reach what on the new `/api/user` routes:** the imports and cancel routes call
  `ownedTrackedPortfolio(userId, id)` first; every query in `tradeImports.ts` filters on `user_id`; cancel
  needs import, portfolio and user to match; the export takes the account only from `getCurrentUserId()`,
  and every exported table is filtered on `user_id`.
- **The import's repeat and cancel logic under requests sent at once:** fingerprints count repeats within a
  file; the hand-typed match leaves out cancelled, imported, starting-position and split rows; the save
  re-checks under `pg_advisory_xact_lock`; cancel adds rows with `onConflictDoNothing`.
- **Decimal places:** `parseTradeInput`'s limits match the column scales, so Postgres never rounds silently.
- **Cost basis with income**, **CSV formula injection**, **ECB cross rates** (both legs from the same day),
  **the expected-inflation table** (the newest day both curves share), **the SEC wider list** (no price-based
  sort or filter key; quotes for the 50 rows on screen; the curated 79 kept; the $100,000 guard matches the
  methods page), **D190** (the import never picks a coin), **D163** (the methods page gained a section for
  each figure change), **fund net assets** (labelled and dated), **coin supply** (share of maximum withheld
  when circulating exceeds it), **no automated deletion** and **counts in the docs**.

## What was done (D206)

All five findings and two of the minor ones are fixed, each with a test that fails when the fix is undone
(each was undone on purpose and the test watched fail).

1. **Negative real yields.** The pattern takes a leading minus (`(-?[\d.]+)`), and the card passes
   `connectNulls={false}`, so a missing reading is a gap, never a line drawn across it. Tests: a 2021-shaped
   entry with five negative readings, and the card's source holds no `connectNulls` that joins gaps.
2. **Front load on funds already held.** `feeImpact` takes `alreadyHeld`, and `portfolioFundCosts(…, { held })`
   passes it for a tracked portfolio: the 10-year figure leaves a front-end sales charge out, and the card
   says the charge was paid at purchase and that the fund page counts it for a new purchase. An unverified
   front load on a held fund is no longer called an understatement. A what-if portfolio, which stands for a
   purchase, still counts verified loads. AGTHX at $50,000 held: $5,357; bought: $10,687. The methods page's
   "Fund costs" section says so (D163).
3. **Column names.** The column-names line is the first with at least three filled cells and **at least** the
   most common width. Test: the audit's file, with a title line above, reads all four trades ready.
4. **Weekly extremes.** Over weekly readings the tool's note says the highest and lowest are of those weekly
   readings, not of every day (`extremesNote`).
5. **Entry price unit.** The holdings spreadsheet's columns are now `entry_price` and `entry_price_unit`
   (USD, US cents, percent, points of par, index points, or the quote currency), from the same table the
   Portfolios page labels its box with (`entryUnitLabel`, moved to `lib/data/instruments.ts`, and its words
   `entryUnitName`).

Minor ones:

- **One lock for every save.** A single trade now saves under the same advisory lock as an import
  (`portfolioSaveLock`), with the trade limit and the one-starting-position rule checked inside that
  transaction (`insertTrade` returns `full` or `has-starting-position`). Checked against PostgreSQL 16 in
  this container, with every migration applied: five starting positions for one holding sent at once saved
  one and refused four; five trades sent at once one short of the 10,000 limit saved one and left exactly
  10,000 rows. The probe was a temporary test and is not committed: the repository has no database test
  harness, so `tradeImports.ts` and this lock still have no committed test, as the audit says.
- **Month arithmetic.** `rangeStart` counts back to the same day, or to the last day of a shorter month: 31
  March less one month is 28 (or 29) February.

Left as they are: the date-order guess from the first 50 rows (refused on screen, never silent).
