# Code audit — 2026-11-24

**Commit:** `93d6e73` on `claude/upbeat-allen-cru6ir`, tree identical to main `b87d5f2` (merge commits only).
**Scope:** the post-merge window `0688307..b87d5f2` — PR #514 (D236–D241 decision sitting, with the T-116 plan
reminders, D238 staking terms-unpublished and the Finnhub launch step), PR #515 (D242 scout pass: T-467 peg history,
T-468 "Coming up" strip, T-469 DeFi protocol card, T-470 FMP returns rung), PR #517 (T-466 launch rehearsal),
PR #518 (T-471/D243/D244 stock ownership, two commits), plus three dependency bumps. **Run by:** the `code-auditor`
agent in a cloud container, read-only.
**Checks run:** `tsc --noEmit` (frontend + mcp-server), `eslint .`, `vitest run` (full suite), `next build`,
`docs:check`, `queue:check`, `staleness:check`, `deps:check`, `data-sources -- --verify`, the standing no-deletion
and affiliate greps. **Checks skipped:** `npm run audit` / `npm run smoke` and every other REAL-vs-FALLBACK
re-measurement (not the owner's machine — results would be IP-skewed); no outside host was contacted as evidence.

## Summary

Every check passes — type-check, lint (0 errors / 45 warnings, same as 2026-11-21), 274 files / 4,106 tests, the
production build, and all four docs/ledger/staleness/registry guards — and the three new feature sets hold the
house rules (facts-not-grades, derived counts, per-figure dates, honest refusals) everywhere they were followed.
The four findings are all P3 hardening/record items in brand-new code; the most useful next step is to give the new
ownership percent the same split guard its sibling P/E surface already has, before a catalog stock splits inside
the 13F window and the card quietly shows a percent off by the ratio.

## Findings

### 1. The institutional "% of outstanding" has no share-count/split guard, unlike the P/E path beside it · `P3`
**Evidence:** `frontend/src/lib/data/stockHolders.ts:176-179` — `institutionalPctOfOutstanding(totalShares,
outstanding)` divides with no unit check; `frontend/src/components/markets/StockOwnershipCards.tsx:84-89` — the
only withholding condition is `multiClass`. The numerator is as-filed shares for the 13F quarter ended
**2026-06-30** (`stockHolders.generated.json` head), the denominator a cover-page count up to 550 days fresh
(`shareStructure.ts:78`), a ~5-month unit-mismatch window per build. The repo's own record shows splits of this
size inside one year — D170 (`docs/decisions/2026-10-25-owner-decisions.md:13`): Booking 25-for-1, Honeywell's
count halved — and D170's cure for the identical P/E mismatch was to withhold when the share count moved outside
`SHARE_CHANGE_BAND` (0.7–1.4); the equity page already receives that signal
(`equities/[symbol]/page.tsx:191`, `shareChange`). **Checked, and stated so this is not overclaimed:** no current
wrong figure was found — the file's totals for NFLX (3.39B), NOW (845M), BKNG (719M) and HON (241M) are all
consistent with post-split units, i.e. this year's known splits all predate the 2026-06-30 period.
**What is wrong:** a split effective between the 13F quarter end and the cover-page date would shift the shown
percent by the split ratio, silently — the card's period note discloses holdings *lag*, not a unit change.
**Why it matters:** across 4,269 covered stocks, splits inside a 5-month window are routine; the first one makes
"X% of the shares in the market" wrong by 2×–25× on a page users act on, while every neighbouring figure looks right.
**Suggested fix:** withhold the percent (keep the shares) when the company's share-count-change signal sits outside
the band D170 already uses — or when `outstanding.asOf` and the 13F period straddle a count jump — with the same
"withheld after a split" wording the P/E path uses.
*Importance:* medium (latent, recurring trigger) · *Efficiency:* high (signal already computed) · *Practicality:* high

### 2. `npm run launch:rehearse` cannot run from the owner's own machine (Windows) · `P3`
**Evidence:** `frontend/scripts/launch-rehearse.ts:123` — `spawn('npx', ['next', 'dev', …])` with no `shell`;
`:279` — `run('npx', ['tsx', 'scripts/entitlements.ts', …])`; `:143-144` — `process.kill(-child.pid)` (POSIX
process groups). On Windows, `npx` is a `.cmd` shim that Node's `spawn` does not launch without a shell (modern
Node refuses `.cmd`/`.bat` outright), and negative-PID kill is unsupported — the repo's other builders handle this
explicitly (`build-fund-fees.mjs:257` shells out to `powershell`; `build-stock-holders.ts:158-163` documents the
`tar.exe` fallback for "Windows 10+"), and CLAUDE.md records throughout that this repo is maintained from
PowerShell. The harness has only ever run from a cloud container (its own ledger closure, T-466), and
CLAUDE.md/D242 define the launch flip as "a re-run" of it, with no platform caveat.
**What is wrong:** on the maintainer's own machine the harness dies in `spawn` — an unhandled `error` event, so it
exits 1 ("the launch recipe is broken") rather than its own 2 ("inconclusive"), misreporting an environment problem
as a recipe failure under the probe convention it documents.
**Why it matters:** the flip is near-term and the whole point of T-466 is that the owner can re-run it; the first
time that happens from PowerShell it produces a wrong verdict with a cryptic stack.
**Suggested fix:** spawn through `process.execPath` with resolved JS entrypoints (or `shell: true` on win32, and a
PID-tree kill), or state in CLAUDE.md and the script header that the rehearsal is Linux/cloud-only.
*Importance:* medium-low (loud failure; cloud path works) · *Efficiency:* high · *Practicality:* high

### 3. The committed ownership file's 13F `source` is an ephemeral `/tmp` container path · `P3`
**Evidence:** `frontend/src/lib/data/stockHolders.generated.json:5` (at main `b87d5f2`) —
`"source": "/tmp/claude-0/-home-user-Finance-Now/…/scratchpad/13f"`. Cause:
`build-stock-holders.ts:143-146` — the `--set-dir` branch of `ensureSetDir()` records the local directory as
`source`, while the download branch records the SEC zip URL; the first real build was run with `--set-dir`.
**What is wrong:** the head of the generated file is its own pinned-for-review provenance record (D243: "pinned in
the output for review"), and this field now identifies nothing — the directory died with the session, so which SEC
archive produced 8,857 managers' figures is recorded only in the ledger prose, not in the artifact. It also leaks a
build-container path into the public repository, and the field will churn meaninglessly on the next rebuild.
**Why it matters:** the 120-day rebuild cycle (`STOCK_HOLDERS_BUILT_ON`) depends on someone being able to say what
the last build read; a `/tmp` path defeats exactly the review the pinning exists for. (Users are unaffected — the
route hardcodes its own `source` string and never serves this field.)
**Suggested fix:** record the set's own identity whatever the input path — the zip's canonical name/URL, or at
minimum `"local directory (period 2026-06-30 set)"` — and regenerate the file's head.
*Importance:* low-medium · *Efficiency:* high (one branch + one regen) · *Practicality:* high

### 4. The fund-holders scope note calls the 103 funds *read* "the funds this app tracks" · `P3`
**Evidence:** `frontend/src/lib/data/stockHolders.ts:195-197` — `fundHoldersScopeNote(fundsRead)` renders "Among
the ${fundsRead} funds this app tracks…"; the generated file records `fundsRead: 103` against the catalog's 140
(the docs-checked count), with 37 skipped ("not in the SEC fund ticker map" — SPY/DIA UITs, the gold trusts).
**What is wrong:** the sentence a reader gets — "Among the 103 funds this app tracks" — misstates the tracking
universe; 103 is the count whose portfolio filings were read.
**Why it matters:** this is a load-bearing honesty note on a shipping card, and it is wrong in the one number it
derives; the derive-counts rule is satisfied but the words around the count are not.
**Suggested fix:** "Among the 140 funds this app tracks, the 103 with portfolio filings were read…" — both counts
derived.
*Importance:* low · *Efficiency:* high (one sentence) · *Practicality:* high

## Set aside (minor, or bounded)

- `build-stock-holders.ts:49-51`: the comment over `SET_INDEX_PAGES` says "read both" path families; the array has
  one entry.
- The rehearsal boots `next dev` (`launch-rehearse.ts:123`), not a production `next start` build — the middleware
  and routes are the same code, but the claim "boots the app with the launch environment" is one notch stronger
  than what runs.
- Rehearsal step 8 computes the "replayed" code fresh (`:254`); a 30-second window boundary crossed between confirm
  and replay makes the step FAIL spuriously (loud, report-only — a flake, not a defect).
- `StockOwnershipCards.tsx:123` blames every company-facts failure on "SEC EDGAR could not be reached" (a 404 or
  unknown symbol reads the same).
- T-471's ledger closure says the 37 skipped funds include "bond funds carry no equity rows"; the file records all
  37 as ticker-map misses — bond funds were *read* with zero equity rows. Prose only; the recorded reasons are right.
- For the next no-deletion audit runner: `launchRehearse.test.ts:27` now matches the deletion grep — it is a guard
  *asserting absence* of deletion, the fourth benign hit beside CLAUDE.md's three.

## Checks that could not be run

- `npm run audit`, `npm run smoke`: skipped — not the owner's machine; REAL/FALLBACK classification is IP-dependent
  (Binance 451s, Reddit/LunarCrush datacenter blocks), so a baseline from here would be systematically wrong.
- Any live re-measurement of data availability, including whether the peg-history and protocol feeds answer — code
  was judged on source, fixtures and tests only.

## Results of the checks run

- `npx tsc --noEmit`: exit 0 (frontend); exit 0 (mcp-server).
- `npx eslint .`: 0 errors, 45 warnings — the same count as 2026-11-21 and 2026-11-12.
- `npx vitest run`: 274 files, 4,106 tests, all passed (265 / 3,985 on 2026-11-21).
- `npx next build`: exit 0; tree clean before and after.
- `docs:check`: 23 counts match. `queue:check`: 0 failing, 0 warnings, 1 to review (T-407, unchanged), 411 items.
- `staleness:check`: every clock fresh or acknowledged; the new `STOCK_HOLDERS_BUILT_ON` clock is discovered
  (fires 2027-03-25); `FALLBACK_MEASURED_ON` fires 2026-12-01, owned by the D186 weekly refresh.
- `deps:check`: nothing at high or critical; zero exceptions in force.
- `data-sources -- --verify`: 64 surfaces, no drift across 68 routes (stock-holders registered with its static
  file and both SEC sources); `DATA-SOURCES.md` left as regenerated in `71c9abb`.

## Examined and clean

- **T-471 resolution rules vs the shipped file:** the via counts reproduce D244 exactly (2,510 fund-names + 726
  fund+13f-names + 1,030 13f-names + 3 sibling-elimination = 4,269 of 5,704; 1,435 unresolved, each with its
  reason); all 79 catalog symbols present; BRK-B/GOOG by 13F class titles and GOOGL by fund+13F, `multiClass`
  true on all three so no percent renders; AAPL 9.70B across 6,111 managers matches D243's sanity line;
  one-CUSIP-one-listing, price-median band, amendment semantics (restatement vs add), SH-only/option-excluded
  folding all verified in source and driven by `stockHolders.test.ts` (557 lines), which also pins the file's
  `builtOn` to `STOCK_HOLDERS_BUILT_ON`.
- **`allowedBrowseCount` (the EDGAR regression fix):** clamps to the browse endpoint's round tens, parser still
  slices to the caller's limit; no caller asks above 100; the audit harness's N-PORT checks exercise it.
- **Share structure:** current-vs-legacy treasury tag preference, the 550-day stray bound (Berkshire 2011/Nike
  2015), Apple's "no treasury reported ≠ 0", same-date ambiguity refusal, reconcile tolerance — all as documented,
  tested in `shareStructure.test.ts`; the audit pins Apple's no-treasury state with a read-the-filing warning.
- **T-470 returns rung:** FMP called only for symbols Tiingo did not serve (test: "never calls FMP for a symbol
  Tiingo answered"); Tiingo stays uncached (§1.6(a)) while the FMP rung caches 900s; 402 → dash, never an error;
  universe requests still refused; per-symbol `sources` served; `dataSources.ts` updated in the same PR.
- **T-467 peg history:** dollar-pegged only with non-USD excluded by reason; a missing day never read as $1;
  `allSettled` over the two feeds with the prices feed decisive; readings labelled as DefiLlama daily readings,
  not closes; no grade/alert; monitor wiring keyed by DefiLlama id (`assetId: a.id`); dated real-feed fixture
  (1,526 lines) drives `pegHistory.test.ts`.
- **T-469 protocol card:** hand-kept parent/slug map (D190), five mapped coins + five unmapped with reasons;
  change combined only when every counted part reports one, −100% voids; unmapped coins mount and fetch nothing;
  protocol-not-token line on the card and the methods page.
- **T-468 strip:** entitlement-gated, earnings fetched only with Equities on and watchlist stocks present; BLS/BEA
  citations and the "expected" earnings line rendered visibly (D211/T-458); dates UTC-read; counts derived.
- **T-116 reminders (PR #514):** drift via the same `checkDrift` on live values; one reminder per plan per day,
  browser-kept; no trade list or buy/sell words in the message; CoinGecko credit carried in the toast when a
  crypto leg priced the weights (T-424).
- **D238 terms-unpublished:** staking page, `/api/v1` and the MCP tool all say "not published" and never render a
  null as 0; the v1 change is additive.
- **Policy:** no risk score, ranking or composite added anywhere in the window; no affiliate URL populated; no new
  prohibited-host or Yahoo path; no exchange-key custody; no deletion of tracked files (the one new grep hit is a
  test asserting the rule); the ownership card's vocabulary stays at facts, dates and "largest".
- **Docs vs code:** CLAUDE.md's D242–D244 blocks, the methods-page additions (three new sections, same PR per
  D163) and the ledger's T-466–T-471 closures match the code as read, findings 2–4's details excepted.

Opportunity noted, not pursued: the generated holders file records everything needed for a "top institutional
buyers/sellers vs last quarter" diff; that is the opportunity-scout's call, not this report's.
