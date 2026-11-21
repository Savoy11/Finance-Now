# Code audit — 2026-11-12

**Commit:** `b962399` on `claude/dazzling-volta-lbbz61` (main `a068493` plus merge commits). **Scope:**
`git diff 14e9fed..a068493`, PRs #490 to #500, weighted to #494–#500 (T-460, T-459, T-461, T-465, T-464, T-463,
T-462). The options calculator (#492, #493) had its own review (D221) and was read only where it touches other code.
**Run by:** the `code-auditor` agent in a cloud container, read-only. **Checks run:** `tsc` (frontend and
mcp-server), `eslint` on the changed files, `vitest --coverage`, `docs:check`, `queue:check`, `staleness:check`,
`deps:check`, `data-sources -- --verify`. **Checks skipped:** `npm run audit` and `npm run smoke` (not the owner's
machine, so the results would be skewed by the IP, and both call outside hosts); `next build` (optional; the last
full build on this head passed).

**Every finding below was re-checked against the code** by reading the lines it cites before this report was written.
The owner chose to fix all four and five of the small items ("Fix all four + small items", D226). What was done, and
how each fix was checked, is in the last section.

**Network:** none. No outside host was contacted and the app was not started. Every probe ran the repository's own
functions on made-up inputs (vitest with `fetch` stubbed), from a scratch folder outside the repository; `git status`
was clean afterwards.

## Summary

All 3,882 tests, the type-check and every docs and ledger guard pass. The most important defect is in the stock
page's new quarterly table: a worked-out fourth-quarter revenue subtracts a nine-month figure from a full-year figure
that can be on a different basis, so when a company moves a business into discontinued operations the whole
difference lands in "Q4". Fix that first. Second is the Staking page notice, which counts the collector's keys rather
than the rows the page shows, so its numbers disagree with the page.

## Findings

### 1. A worked-out fourth quarter can subtract nine months reported on a different basis from the full year · `P2` — reproduced

**Evidence:** `frontend/src/lib/utils/companyQuarters.ts:92-101` (`latestPerPeriod`) keeps the most recently filed
value for each period; `:127` takes the nine months and `:138` works out `value: year.val - firstNine.value`. Nothing
checks that the two figures are on the same basis: the full year usually comes from a 10-K, the nine months last
appeared in a 10-Q. Probe (made-up facts): a company spins off a segment on 2025-11-01, after its third quarter. Its
2025 10-Qs report 100 a quarter and 300 for nine months, segment included; its 2025 10-K reports continuing operations
only, 300 for 2025 and 300 for 2024 restated (the true figure is 75 a quarter). `lastQuarters()` returns
`2025-12-31 revenue {value: 0, workedOut: true}` and `2024-12-31 revenue {value: 0, workedOut: true}`; every other
quarter reads 100.

**What is wrong:** whenever a 10-K reports revenue on a different basis from that year's third-quarter 10-Q (a
discontinued operation classified in the fourth quarter, or a prior year restated in a later 10-K), the whole
difference falls into the worked-out fourth quarter, for the latest year and the year-earlier quarter inside the
eight-quarter window. It can be zero or negative revenue, marked only with "*". The methods page ("stock-quarters")
says "Both figures must come from the same line of the company's accounts": true of the tag, not of the basis. Net
income is unaffected (NetIncomeLoss includes discontinued operations).

**Why it matters:** revenue and its change from a year earlier are on every stock page (`QuarterlyResults`), and the
agents quote them through `get_stock_financials`. AAPL, the audit harness's only check, has no such restatement. How
often real filings trigger it was not measured (no network).

### 2. The Staking page's notice counts the collector's keys, not the rates the page shows · `P2` — reproduced

**Evidence:** `app/(dashboard)/staking/page.tsx:605` sets `backups = backupCounts(backupDates, rates)`, and
`aprDisplay.ts:157` counts the entries of `fallbackProvenance.byKey`, which are collector keys; `:608` `liveCount`
counts `sources` keys. The notice prints these (`:695-697`), then "Each rate says which it is." Probe, every source
failing (real collector, `fetch` throws): the notice says measured 21, undated 24; the rows the page shows by default
(157) are backup-measured 22, backup-undated 34, catalog 101. Normal case (the 21 measured keys live, Lido's and
Solana's anchors answered): the notice says "21 rates are live … 20 are backup rates with no measured date"; the rows
are live 22, derived 9, backup-undated 25, catalog 101. Ten of the 24 undated keys are read by no row at all
(`kraken_eth, binance_eth, native_ksm, native_matic, lido_matic, babylon_btc, native_cro, native_near, ankr_sol,
stader_matic`), and the counts ignore `?coin=`.

**What is wrong:** T-465 / D224 say "the notice counts both". It counts something the page never shows, so the "no
measured date" figure is too low and partly made of rates that appear nowhere. `aprDisplay.test.ts` checks only the
key counting.

**Why it matters:** a provenance count a reader checks against the rows: the "count that disagrees with the page"
pattern.

### 3. Commodity pages blame a missing key when the quote providers failed · `P3` — read

**Evidence:** `components/markets/CommodityFundsCard.tsx` shows `NO_FUND_PRICES_NOTE` ("Fund prices need a quote key,
free from several providers, on the Integrations page") whenever no fund has a live quote. With keys set,
`fetchSecurityQuotes` throws when no provider answered (`lib/api/live/marketData.ts:418-422`) and
`/live-data/security-quotes` answers `source: 'reference'` with no error or configured flag. The repository's own test
("shows no price at all when only reference prices came back") renders this state and asserts the note.

**What is wrong:** a rate-limited or failing provider is described as a missing key: the pattern of the 2026-11-09
Videos finding.

### 4. #493's preset refusal is not caught on the other page that builds presets · `P3` — reproduced (dormant)

**Evidence:** `lib/options/presets.ts:194,208` now throws when a structure's strikes would reach $0. The calculator
wraps `buildPreset` in try/catch (`options-calculator/page.tsx:219-226`); the switched-off Trade Risk Scorer page
(`app/(dashboard)/equities/options/page.tsx:199`) calls it without one. Probe: 19 preset-and-price pairs throw
between $0.05 and $2, among them cash-secured-put, collar, iron-condor and long-call-butterfly.

**What is wrong:** on that page a preset click at a low price raises an uncaught error with no message. Nothing today
(D64 keeps the page redirected), but `lib/risk/visibility.ts` keeps it for restoration, and this would ship with it.

## Set aside (minor, or not measurable here)

- `QuarterlyResults.tsx:71` heads the card "Last 8 Quarters" whatever the count; the caption uses `quarters.length`.
- `DATA-AVAILABILITY.md:814-819` says "all **67** route files comply", then "66/66" and "later to 66 with
  `fund-returns`"; `treasury-spread-history`, the 67th, is not in the prose. All 67 declare `force-dynamic`.
- `native_sol` is "derived … from a live reading" when only one of Marinade or Jito answered, and the average then
  includes the other's backup figure. This labelling predates T-465.
- Fund returns: if the newest N-PORT filing fails to load, `FundReturnsCard` presents the previous quarter as the
  newest, and the failure note (shown only in the no-12-month branch) calls the failed filing "older".
- `/live-data/earnings-dates` asks for 90 days while the listed-window check uses 92, so `sameWindow` is never true
  there and each call makes two FMP requests rather than one.
- `fund-returns` reads up to six full N-PORT files; Next's data cache refuses entries over 2 MB, so large funds may be
  downloaded again on every call. Not measured (no network).
- `gapHistoryFact`'s `startIsEarliestRead` is also true when a stretch starts right after a year's file that could not
  be read; only the name is affected.

## Results of the checks run

- `npx tsc --noEmit -p .` (frontend and mcp-server): exit 0.
- `npx eslint` on every changed file: 0 errors, 45 warnings.
- `npx vitest run --coverage`: 257 files, 3,882 tests passed; 86.72% of statements and 80.1% of branches (85.12% and
  78.76% on 2026-11-09). In scope, `stakingRates.ts` is lowest at 57.5% of statements; `nport.ts` 75.7%.
- `docs:check`: 23 counts match. `queue:check`: 0 failing, 0 warnings, 1 to review, 405 items.
- `staleness:check`: every clock fresh or acknowledged; `FALLBACK_MEASURED_ON` fires 2026-11-20, `fundCatalog`
  2026-11-18 (acknowledged).
- `deps:check`: nothing at high or critical. `data-sources -- --verify`: 63 surfaces, no drift across 67 routes.

## Examined and clean

- **T-460 sales list:** exact sums; each sale's parts map one-to-one to the engine's matches, so the years add up to
  the realized total; days counted in UTC as shown; the export's table and columns match the schema; `portfolio` is
  checked as a UUID and only narrows the session's own rows; the CSV formula guard leaves negative numbers alone.
- **T-459 fund returns:** rtn1–rtn3 map to the three months ending on the report date, in percent; another class is
  never substituted; a 12-month figure only with all 12 months; flows net is sales plus reinvestment less
  redemptions; the Fund Registry does not read the route.
- **T-464 gap history:** one spread function everywhere; stretches from the daily readings, −0 not counted as below
  zero; weekly shading; the look-back runs until each gap's start is known; the tool's longest stretch is over 10 years.
- **T-462:** reference prices and a `source: 'reference'` response are excluded; the price alerts use the same rule.
- **T-463:** links go through id maps, never tickers; the coin page's counts use the Staking page's own filter.
- **T-465:** a figure is "derived" only when its anchor answered, otherwise `upstream-failed` with its backup date;
  the API's `aprBasis`/`aprMeasuredOn` and the MCP labels match.
- **#490 fixes, spot-checked:** `earningsGap` and the Alpha Vantage cache tag; New York's day in the Macro calendar,
  releases and the FOMC tentative rule; the macro tag cap; Reserves' null price; the tracked drift check's notice.
- **#491:** no Claude request in `src/`, `scripts/` or `mcp-server/` sends `temperature`, `top_p` or `top_k`; the
  Test button sends API version `2026-10-21`.
- **Policy:** no deletion operation added; no new external host; no rating, ranking or affiliate link added.

Opportunity noted, not pursued: the security-quotes route could say whether any quote key is configured, which would
make finding 3's note exact.

## What was done (D226)

Each fix has a test that fails when the fix is undone: 17 deliberate breaks were tried, and every one made a test fail.

1. **Fourth quarter across a change of basis.** `conceptQuarters` now records, for each period, when its current value
   was first filed and every date a report changed one of the line's figures by more than `RESTATED_SHARE` (half a
   percent) from the report before it. A fourth quarter is not worked out when such a change falls after the earlier of
   the two figures was set, up to and including the later one, nor when a worked-out revenue is zero or below. The row
   stays, with a dash, a dagger and the reason; the AI tool gets `revenueNotWorkedOut` / `netIncomeNotWorkedOut` and is
   told not to work one out itself; the methods page states the rule ("Rule as of 12 Nov 2026"). Tests: the audit's
   spin-off case (both fourth quarters withheld as `restated`, rows kept), the same facts before the restating report
   (worked out), a later report that only repeats an earlier restatement (not counted), a 0.4% move (ignored) against
   a 1% move (withheld), and a negative revenue against a net loss (only the revenue withheld).
2. **The Staking page's counts.** `stakingPageRows` lists every row the page draws under its filters; the page groups
   its cards from it, each card draws the rows it is given, and the notice and the header's live count come from
   `basisCounts` over those rows' bases, printed by `rateSummary` ("Of the 157 rates shown, …"). The coin page's
   `stakingRowsFor` is the same list for one coin. Tests: the counts add up to the rows, follow the coin filter, and do
   not move when the response carries backup figures for keys no row reads (`kraken_eth`, `binance_eth`, `native_ksm`,
   `ankr_sol`); the page filters nowhere itself.
3. **Commodity note:** "either no quote key is set (…) or the price providers did not answer".
4. **Scorer page presets:** the refusal is caught and shown; a test finds every file under `src/app` and
   `src/components` that calls `buildPreset` and requires the try/catch.

Small items:

- The quarterly card is headed "Last N Quarters" with N its own count.
- `DATA-AVAILABILITY.md` says 67/67 and names `treasury-spread-history`.
- `/live-data/fund-returns` gives `newestUnread` (the filing date) when the newest filing listed could not be read;
  the fund page says the figures may not be the latest, the failure note no longer calls the failed filing "older",
  and the AI tool passes it on. Tested with the SEC reader mocked.
- The earnings server reads a range inside the 92-day window from the window's FMP request; the stock page and the
  watchlist now make one FMP request, not two. Tested by counting requests.
- Solana's native rate averages only the live Marinade and Jito readings. Tested on the real collector with Marinade
  answering and Jito not.

Not changed: the 2 MB data-cache limit on large N-PORT files (not measurable here) and the name of
`startIsEarliestRead` (no behaviour depends on it).
