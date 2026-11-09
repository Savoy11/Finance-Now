# Code audit — 2026-11-09

**Commit:** `4081889` on `claude/dazzling-volta-lbbz61` (main `14e9fed` plus one merge commit). **Scope:**
`git diff 381069c..14e9fed`, PRs #484 to #489 and #464 (D207 to D213). **Run by:** the `code-auditor` agent in a
cloud container, read-only. **Checks run:** `tsc`, `eslint`, `vitest --coverage`, `next build`, `docs:check`,
`queue:check`, `staleness:check`, `deps:check`, `data-sources -- --verify`. **Checks skipped:** `npm run audit` and
`npm run smoke` (not the owner's machine, so the results would be skewed by the IP, and both call the SEC); the
`mcp-server` type-check (nothing in scope touched it); the frozen backend (D2).

**Every finding below was re-checked against the code before it was fixed.** The owner chose to fix all eight
("Fix all eight", D214). What was done, and how each fix was checked, is in the last section.

**Network:** none. No request went to sec.gov, data.sec.gov or efts.sec.gov, or to any other host, and the app was
not started. Every reproduction below runs the repository's own functions on made-up inputs (tsx, or vitest with
`fetch` stubbed). The scripts are in the scratchpad's `probe/` folder, outside the repository.

## Summary

The build, type-check, lint and all 3,686 tests pass, and every docs and ledger guard is green. The worst problem is
the Portfolio Builder's new drift check against a tracked portfolio: it can drop the largest holding with no notice
and label what is left "live value", so the buy and sell list for real money is wrong. Fix that first. After it, fix
the earnings-date card, which says "no date listed" when Alpha Vantage, the source behind most dates, has failed.

## Findings

### 1. The drift check on a tracked portfolio can leave out a holding with no live price and say nothing · `P1` — reproduced

**Evidence:** `lib/data/trackedPortfolioViews.ts:149-155` measures the unpriced share by what the holdings *cost*.
`PlanMonitor.tsx:331` shows the "Only X% … could be marked to market" notice only when `pricedPct < 99`, and
`:272` labels the total "live value" otherwise. The `unpriced` list the function returns is never displayed
(`grep unpriced PlanMonitor.tsx` finds nothing). Probe: 1 BTC that cost $400 and has no live price this minute, plus
VTI that cost $50,000 and is worth $60,000. `actualWeightsFromTracked` gives
`{ weights: { VTI: 100 }, valueUsd: 60000, pricedPct: 99.2, unpricedPct: 0.8, unpriced: ['BTC'] }`, so the panel
reads "$60,000 live value". There is no notice, and the drift table is worked out as if the portfolio were 100% VTI.
**What is wrong:** a holding that cost little but is worth a lot (old crypto, a low-basis or gifted stock, an OTC
ticker no provider quotes) is dropped without a word. The methods page (`dataMethods.ts`, "tracked-return-mix") says
the drift check "states how much was left out". It does not, below 1% of cost. The tracked portfolio's own page names
the same holding (TrackedPortfolioDetail, TrackedMixCard).
**Why it matters:** D208 accepted that on a tracked portfolio "the buy and sell lists become trade lists for real
money". With BTC at 5% in the plan, the table says to buy BTC while the reader already holds most of the portfolio in
it.
**Suggested fix:** for a tracked portfolio, name `actual.unpriced` whenever it is not empty, as TrackedMixCard does,
and never call the total "live value" while anything is left out.
*Importance:* high · *Efficiency:* high (a few lines in PlanMonitor) · *Practicality:* high

### 2. Earnings dates say "no date listed" when Alpha Vantage failed and FMP answered · `P2` — reproduced

**Evidence:** `app/live-data/earnings-dates/route.ts:40-41` sets `ok: fmp.ok || alphaVantage.ok`. Its own comment
says a null date "means 'not listed', never 'the source failed'". The vitest probe stubbed FMP to list NVDA and
stubbed Alpha Vantage's HTTP-200 throttle note (the form the IPO reader documents). The route answered
`{"ok":true,"dates":{"WMT":null,"NVDA":"2026-11-19 fmp"},"av":{"ok":false,"detail":"rate-limited: …"}}`.
`NextEarnings.tsx:67` then shows "No date listed in the next 90 days. The company may not have announced it yet." The
watchlist footer still says the stocks reporting soon "are marked". No page reads the per-source status:
`grep earningsSources|sources['alpha-vantage']` over the `.tsx` files finds nothing. The owner's run on 2026-11-09
(DATA-AVAILABILITY.md, "Next earnings date") found FMP with 63 dates in 90 days and Alpha Vantage with 1,873.
**What is wrong:** when Alpha Vantage is down, about 97% of dates vanish, and each company is described as not having
announced a date. Two things make it last. Next caches any status-200 body
(`node_modules/next/dist/server/lib/patch-fetch.js:624`), so a throttle note stays in the cache for the full 86,400 s
(`lib/server/earningsCalendar.ts:16,58`). The memo is dropped only when both sources fail (`:88`). The same key's 25
requests a day are also spent by the quote ladder's Alpha Vantage rung (`marketData.ts:207-214`, five symbols, 300 s
cache) and by the IPO calendar.
**Why it matters:** a reader can believe a company has no report coming when one is in Alpha Vantage's list.
**Suggested fix:** when Alpha Vantage fails, say that dates for companies FMP does not list are missing (on the card,
the watchlist and the calendar). Keep a failed Alpha Vantage answer out of the day-long cache.
*Importance:* medium-high · *Efficiency:* medium · *Practicality:* high

### 3. Instrument pages miss stories that name them, because of the four-tag cap · `P2` — reproduced

**Evidence:** `lib/data/macroNewsMatchers.ts:44,51` stops tagging a story after `MAX_RELATED = 4` instruments, taken
in matcher order. The yields come last (the 10-Year Yield matcher is number 44 of 47). The story "Gold and silver
rallied, crude oil slipped and the euro firmed as the 10-year Treasury yield fell" is tagged Gold, Silver, WTI and
EUR/USD only. `InstrumentNewsCard.tsx:27` builds each page's list from those tags, and `:51` prints "No recent story
names {name}."
**What is wrong:** the cap was written to limit the chips under a story (and `macroCalendar.test.ts:188` holds it to
that). Since T-456 b the same tags decide which stories appear on an instrument's own page, so the cap drops stories
that do name it. The yield pages lose the most. The bonds pillar comes from CNBC Economy's general stories, which
often name several markets.
**Why it matters:** the yield and late-listed currency pages can say no story names them while Macro News shows one.
**Suggested fix:** keep every match in the data (e.g. `relatedAll`) and apply the cap only where chips are drawn.
*Importance:* medium · *Efficiency:* high · *Practicality:* high

### 4. The new stablecoin tool reports a stand-in $1.00 as a live price, 0 bps from the peg · `P2` — reproduced

**Evidence:** `app/live-data/reserves/route.ts:93` writes `price: coin.price ?? 1` (this predates the scope). The new
`get_stablecoin_reserves` (#486) passes it on as `priceUsd`, works out
`pegDeviationBps: Math.round((a.price - 1) * 10_000)` (`lib/agents/tools.ts:709`), and tells the agent "Price and
supply are live from DefiLlama" (`:722`, and the description at `:138`). Probe: DefiLlama stubbed to send USDC with
`price: null`. Route: `price 1, priceSource "DefiLlama"`. Tool: `priceUsd 1, pegDeviationBps 0`.
**What is wrong:** a missing price becomes a made-up one, and the agent is told it is live and on the peg. CLAUDE.md
forbids made-up or silently swapped-in values. How often DefiLlama sends no price for a monitored coin was not
measured (no network here).
**Why it matters:** "USDC is at $1.00, 0 bps from its peg" is the one claim a reader checks a depeg monitor for.
**Suggested fix:** send `price: null` when DefiLlama has none, and have the tool and the Reserve Monitor say "no
price" rather than $1.00.
*Importance:* medium · *Efficiency:* high · *Practicality:* high

### 5. "One company never shows two dates" holds only within one requested range · `P2` — reproduced

**Evidence:** `lib/server/earningsCalendar.ts:93-103` asks FMP for `[from, to]` and merges only the rows in that
range. `mergeEarnings` (`lib/data/earningsCalendar.ts:112`) treats a company as "listed by FMP" only if FMP has a row
for it inside that range. The Market Calendar asks one calendar month at a time (`?month=`), and the stock page asks
today plus 90 days. Probe: FMP lists XYZ on 2026-12-02 and Alpha Vantage has it on 2026-11-30, run through the same
filter and merge. November grid: `XYZ 2026-11-30 alpha-vantage`. December grid: `XYZ 2026-12-02 fmp`. Stock page:
`2026-12-02 fmp`.
**What is wrong:** the methods page (`dataMethods.ts:113`) and D213 promise "Where both list a company, FMP's date …
so one company never shows two dates". When the two dates fall on either side of a month boundary, the calendar
shows Alpha Vantage's date for a company FMP lists, and the company appears in two months.
**Why it matters:** the date the reader sees on the calendar disagrees with the stock's own page. This only happens
when the two sources disagree across a month boundary.
**Suggested fix:** decide which companies FMP "lists" from one fixed window (today plus 90 days, already fetched for
the stock pages) whatever range is shown.
*Importance:* low-medium · *Efficiency:* medium · *Practicality:* high

### 6. The Macro calendar counts "today" in UTC: in the US evening, tomorrow's Fed decision or CPI reads "today" · `P3` — reproduced

**Evidence:** `lib/data/macroCalendar.ts:8,24,36` and `releaseCalendar.ts:169` take the day from
`now.toISOString()`. At 9:30 pm Eastern on 2026-11-09 (New York day 2026-11-09), `macroCalendarNext` lists
"cpi 2026-11-10 (today)". At 8 pm Eastern on 2026-12-08 it gives "rate decision 2026-12-09 … today". In the same way,
`/live-data/market-calendar`'s `?days=` mode, which the agent's `get_market_calendar` uses, starts at
`new Date().toISOString().slice(0, 10)` (`route.ts:85`). At 8:30 pm Eastern on 2026-11-17 that is 2026-11-18, so
that evening's reporters drop out.
**What is wrong:** D213 and the methods page settle that "today" is New York's, because UTC "dropped a company
reporting that evening after about 7 pm Eastern". The PR that settled it left both of these on UTC.
**Why it matters:** for about four or five hours each evening, a US reader is told an event is today when it is
tomorrow.
**Suggested fix:** use `marketToday()` in `macroCalendar.ts`, `nextReleases` and the market calendar's default
`from`.
*Importance:* low · *Efficiency:* high · *Practicality:* high

### 7. The Videos page says "No video channels are switched on" when the request itself failed · `P3` — reproduced

**Evidence:** `app/(dashboard)/videos/page.tsx:178` reads `tried === 0` as "no channels enabled". A 429 from
`guardQuotaRoute` (`{ error: 'Rate limit exceeded …' }`, `apiGuard.ts:147`), a site-lock 401, or a body that is not
JSON all leave `tried` undefined. Running the page's own `feedFailureNote` gives "No video channels are switched on.
Turn some on in Settings → Integrations." both for the 429 body and for `undefined`.
**What is wrong:** #489 replaced a guess ("may be unreachable") with a confident wrong reason, which sends the reader
to Settings for nothing.
**Suggested fix:** use the "no channels" wording only when the response is `ok` and `tried === 0`; otherwise say the
feed request failed, with its error.
*Importance:* low · *Efficiency:* high · *Practicality:* high

### 8. The CoinGecko key guard passes when one of a file's requests drops the key · `P3` — reproduced

**Evidence:** `lib/api/__tests__/coingeckoKeySent.test.ts` ("sends coingeckoHeaders() wherever it builds a CoinGecko
address") only checks that the name appears somewhere in each file. The #489 commit says the test "fails on … a
CoinGecko request without the key". As a deliberate break, `/ohlc`'s `headers: CG_HEADERS()` in
`app/live-data/ohlcv/route.ts:188` was replaced with a bare `Accept` header. All 4 tests still passed. The file was
restored and `git status` is clean.
**What is wrong:** no call site is wrong today (each file's `coingeckoBase()` and `coingeckoHeaders()` counts match,
or the file uses `fetchCoinGeckoPages`). The guard would not catch the next one inside a file that already has the
helper.
**Suggested fix:** check each `fetch(` call that builds a `coingeckoBase()` address, not just the file.
*Importance:* low · *Efficiency:* high · *Practicality:* medium

### Set aside (minor, or decided)

- `lib/server/marketCalendar.ts` `releaseEventsBetween` links 2027 BEA rows to `/news/schedule/next-year`, and the
  switch is hard-coded at `'2027-01-01'`. Once 2027 begins, BEA's page under that address will show 2028. The 90-day
  clock (2027-02-06) will prompt a re-check.
- Money-weighted return: a token old buy unlocks the yearly figure. Probe: $10 put in 13 months ago and $10,000 one
  month ago, worth $11,000 now, shows "+196.6% a year". This matches D208's wording ("first money put in") and the
  usual convention of annualising from inception. It is a question for the owner at most.
- `stablecoinReserves` types `notFound` as `string[]`, but the route sends `{ key, reason }` objects. The JSON passes
  through unchanged, so nothing breaks.
- The Compare button on currency, yield and unquoted commodity pages opens Compare with its honest "missing" banner.
  This follows from the owner's choice to leave Compare unchanged (T-445).

## Checks that could not be run

- `npm run audit`, `npm run smoke`: skipped. This is not the owner's machine, so which sources work would be skewed by
  the IP, and both call the SEC with the owner's email.
- `mcp-server` type-check: not run; nothing in scope touches `mcp-server/`.

## Results of the checks run

- `npx tsc --noEmit -p .`: exit 0.
- `npx eslint .`: 0 errors, 45 warnings (46 on 2026-11-07).
- `npx vitest run --coverage`: 243 files, 3,686 tests passed. Coverage is 85.12% of statements and 78.76% of
  branches (84.5% and 78.34% on 2026-11-07). Still 0% covered: `lib/server/trackedPortfolios.ts`, `tradeImports.ts`,
  `secListings.ts`, `ecbReference.ts`, and the treasury history fetcher. `nport.ts` is at 71%.
- `npx next build`: exit 0. The tree was clean afterwards.
- `docs:check`: 23 counts match. `queue:check`: 0 failing, 0 warnings, 1 to review, 398 items.
- `staleness:check`: every clock is fresh or acknowledged. `fundCatalog` fires 2026-11-18 (acknowledged), and
  `stakingRates` FALLBACK fires 2026-11-20 (within the horizon).
- `deps:check`: nothing at high or critical.
- `data-sources -- --verify`: 61 surfaces, no drift across 65 routes, and `DATA-SOURCES.md` was not changed.

## Examined and clean

- **Who can read whose data (#484):** the Brief, PlanMonitor and the tracked page read only
  `/api/user/tracked-portfolios` and `/[id]/trades`. Both take the user from `getCurrentUserId()`, and `/[id]/trades`
  also calls `ownedTrackedPortfolio(userId, id)`. Linking a plan to a portfolio (`builder-plans/[id]` PATCH) checks
  `portfolios.userId = userId`. The Brief sends tickers and classes only.
- **Arithmetic:** the money-weighted rate matched 10% exactly on a one-year case; with a sale and income counted as
  money out, it matched the tests. The flows count buys, transfers in and starting positions as money in, and sales
  and cash income as money out, skipping cancelled trades. The class split and the look-through are shares of the
  holdings that have a live price, and the unpriced ones are named.
- **Fund exposure (#487):** shares of net assets as filed, never rescaled. Maturity buckets count calendar
  anniversaries of the report date (a bond due exactly five years later is in 5 to 10 years). The bond splits show
  from 25% bonds. `holdingHead` stops at the nested sections. The portfolio country split reports funds with no
  filing and direct holdings separately.
- **Earnings (#488):** the earnings-dates route and the cards use New York's day. Alpha Vantage is asked at one fixed
  address, cached for 86,400 s. Within one range FMP wins. A company name containing a comma stays whole.
- **CoinGecko (#489):** every call site builds its address with `coingeckoBase()` and sends `coingeckoHeaders()`, or
  goes through `fetchCoinGeckoPages`. `networkFees.ts` now takes both from its server callers.
- **Policy:** the diff adds no deletion operations and no workflows. BLS and BEA are registered as `seeded` and are
  not fetched. The Alpha Vantage terms condition is updated. Counts in copy are worked out (the search tool, the
  methods page). Nothing new opens a provider's or issuer's own site (D149). The Ask the AI questions for coins, funds
  and macro ask for facts and risks, never what to do. The drift check on a tracked portfolio shows the builder's
  not-advice line. No rating or score was added.
- **#464 (Dependabot):** type-check, lint, tests and build all pass on the bumped versions.

Opportunity noted, not pursued: the per-source status that `earnings-dates` and `market-calendar` already return
could be shown on the pages.

## What was fixed (D214)

All eight, on `claude/dazzling-volta-lbbz61`. Each has a test that fails without it: thirteen deliberate breaks,
one or more per fix, each caught and each put back.

1. **Drift check.** On a tracked portfolio the Portfolio Builder now names every holding left out for want of a
   live price, at any share of cost (`trackedLeftOutNotice`, `lib/data/trackedPortfolioViews.ts`), and the total
   reads "live value of the priced holdings" while anything is left out. The printed rebalance notes name them too
   (`leftOut`, `rebalanceNotes.ts`). The cost-based "Only X%" notice stays for what-if portfolios only. The methods
   page says so.
2. **Earnings dates when a calendar fails.** `earningsGap` (`lib/data/earningsCalendar.ts`) gives the sentence when
   a configured calendar failed and another answered; `/live-data/earnings-dates` sends it as `gap` and the market
   calendar as `earningsGap`. The stock page's card shows it in place of "may not have announced it yet", the
   watchlist footer and the Market Calendar show it, and the agents' calendar tool tells the model not to read a
   missing date as no report. A failed Alpha Vantage answer marks its cache tag stale
   (`ALPHA_VANTAGE_EARNINGS_TAG`, `revalidateTag`), so the next caller asks again rather than reading the failure
   for a day. The IPO calendar, outside this audit's scope, still keeps a failed answer for its own cache window.
3. **Macro tags.** `detectMacroRelated` keeps every instrument a story names; `MAX_RELATED` now caps only the chips
   drawn on Macro News and Headlines.
4. **Stablecoin price.** `/live-data/reserves` sends `price: null` when DefiLlama sends none, and the reserves tool
   reports no price and no distance from the peg, and tells the model so. No page shows the price.
5. **One date per company.** Which companies FMP lists is decided over Alpha Vantage's whole reach, today plus 92
   days (`EARNINGS_LISTED_WINDOW_DAYS`), whatever range a page asks for (`mergeEarnings`'s `alsoListed`).
6. **New York's day.** `marketToday` and `addDays` moved to `lib/utils/marketDay.ts` (the earnings code re-exports
   them). The Macro calendar, the release table's `nextReleases`, the Fed table's "tentative" rule, the Fed-year
   list on the Macro card and the market calendar's `?days=` mode all count from New York's day.
7. **Videos wording.** `videoFeedNote` (`lib/data/videoFeedNote.ts`) says the feed could not be loaded, with the
   error, when the request failed; "No video channels are switched on" only when the feed answered and tried none.
8. **CoinGecko key test.** `coingeckoKeySent.test.ts` now checks each fetch whose address comes from
   `coingeckoBase()`, directly or through a variable declared from it, for `coingeckoHeaders` or a name declared
   from it. The audit's break (ohlcv's `/ohlc` request without the key) fails it.

Left as they are, as the audit suggested: the BEA 2027 link (its review clock prompts a re-check), the yearly
return from a token first purchase (D208's wording), the `notFound` type, and Compare's "missing" banner on
currency, yield and unquoted commodity pages.

