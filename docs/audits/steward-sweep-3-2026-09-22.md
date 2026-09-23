# Checklist-Steward Sweep 3 — 2026-09-22

**Scope:** the two status surfaces T-328 names that the 2026-09-21 sweeps did not cover.
The first sweep (`steward-sweep-2026-09-21.md`) and the second (`steward-sweep-2-2026-09-21.md`)
took TASK-QUEUE and `docs/assessments/P3-production-review.md`. This run takes:

- **Surface 1** — `DATA-AVAILABILITY.md`, **action-items list only** (`:894`–`:978`).
  Per `docs/agents/checklist-steward.md:114-117` the per-row statuses in that file are
  never hand-edited; they are regenerated from `npm run audit`. Nothing below proposes a
  row-status edit.
- **Surface 2** — `CLAUDE.md`'s status surfaces: the Feature Inventory table (`:1228`–`:1259`),
  the three per-module tables (`:1262`–`:1302`), and the Agent API / MCP tool tables
  (`:1344`–`:1390`). Where a defect in those tables has a twin in CLAUDE.md prose that the
  table depends on, the twin is included and marked.

**Status of this document: PROPOSAL ONLY.** Nothing was edited. Per the charter's approval
protocol (`checklist-steward.md:121-136`) the owner approves, then the steward applies.
This file is the only file this run created.

**Method.** Every verdict below was reached by reading the tree and following the path, not
by reading another document. Where a doc agrees with the tree it is cited as corroboration,
never as the evidence. Citations are `file:line` as of 2026-09-22.

---

## 0. Headline

**CLAUDE.md's Feature Inventory and module tables carry 14 defects, and they cluster into
four causes, not fourteen unrelated slips:**

| Cause | Rows affected |
|---|---|
| **The 2026-09-20 MarketWatch / Dow Jones terms removal** never propagated out of the code | 4 (`:592`, `:1289`, `:1296`, and the prohibited-host list that never gained the entry) |
| **A surface hidden or emptied** is still described as present | 4 (`:93`, `:1230`, `:1244`, `:1250`) |
| **"🟢 Live" on a path that is key-gated or paid-gated** | 3 (`:1264`, `:1288`, `:1290`) |
| **A typed count that drifted** from the list it describes | 3 (`:131`, `:1291`, `:1349`) |

Plus three stale claims in the Source-Terms prose the tables rest on (`:640-646`, `:678`,
`:689-700`), all with the same root: **eight registry entries flipped to `verified` after
that prose was written, four of them the very four it names as still `seeded`.**

`DATA-AVAILABILITY.md`'s action-items list is in far better shape: of the 19 entries
(1–18 plus 17b), **17 are correct as written**, one carries a factual error in its
explanation (item 6), and one is a classification overtaken by an owner decision (item 9).

---

# SURFACE 1 — `DATA-AVAILABILITY.md` action items

## 1.1 Verdict per item

| # | Line | Marker | Verdict | Evidence |
|---|---|---|---|---|
| 1 | `:896` | ✅ | **Correct** — the classification exists and is this document | `DATA-AVAILABILITY.md:160-176` (the legend: 🟢/🟡/🔴/⚪/🔑) |
| 2 | `:897` | ✅ | **Correct** — no mock layer survives | `frontend/src/lib/api/` contains `__tests__`, `alerts.ts`, `assets.ts`, `instrumentPrices.ts`, `live/`, `market-data.ts`; **no `mock/` directory exists**. `LIVE_DATA` hardcoded true, `frontend/src/lib/constants.ts` |
| 3 | `:898` | ⚪ overtaken | **Correct** — there is no `/reports` route; the dashboard page list has no such entry | `frontend/src/app/(dashboard)/` contains no `reports/`; corroborated `DATA-AVAILABILITY.md:768` |
| 4 | `:902` | ✅ | **Correct, and the path is connected** — not a parts inventory. `frontend/src/app/api/v1/network-fees/route.ts:3` imports `computeNetworkFees` from `@/lib/data/networkFees` and calls it at `:14`; `NETWORK_GAS` is defined once at `networkFees.ts:58` and consumed at `:296`, `:340` | as cited |
| 5 | `:903` | ✅ + caveat | **Correct, caveat still live** — `/transfer-fees` → `/headlines` is present at `frontend/next.config.mjs:60`, and the page file still exists at `frontend/src/app/(dashboard)/transfer-fees/page.tsx` (held, not deleted) | as cited |
| 6 | `:904` | ✅ | **⚠ CORRECT COUNT, WRONG EXPLANATION — see §1.2** | `networkFees.ts:18-21`, `:284-290` |
| 7 | `:905` | ✅ | **Correct** — `npm run audit` → `scripts/test-live-data.mjs`; REAL/FALLBACK verdicts referenced at `test-live-data.mjs:1025,1074` (cited in `DATA-AVAILABILITY.md:176`) | `frontend/package.json` scripts block |
| 8 | `:906` | ✅ | **Correct, and connected** — `frontend/src/lib/data/dataSources.ts` exists, `/data-sources` page exists (`frontend/src/app/(dashboard)/data-sources/page.tsx`), `DATA-SOURCES.md` is generated at repo root | as cited |
| 9 | `:910` | ⏳ | **Open, but its CLASSIFICATION is overtaken by D21 — see §1.3** | `docs/decisions/2026-09-18-owner-decisions.md:7-25` |
| 10 | `:911` | ✅ | **Correct on the fix; first caveat correct; second caveat NOT VERIFIABLE from code — see §3.1** | `frontend/src/lib/server/socialBlend.ts`; its test file has **7** `it(` cases (`__tests__/socialBlend.test.ts:27,41,54,68,79,91,99`), matching the item's "7 unit tests" |
| 11 | `:924` | ✅ | **Correct** — measurement-derived; the `126` it cites matches `FUND_CATALOG.length`, which `npm run docs:check` pins | `check-doc-facts.ts:132-138` |
| 12 | `:934` | ✅ | **Correct** — the ladder-vs-allSettled distinction it records is still the repo's rule (`CLAUDE.md:1505-1510`) | as cited |
| 13 | `:937` | ✅ | **Correct** — dated historical record of a 2026-07-29 run | — |
| 14 | `:941` | ✅ | **Correct, including the count** — "Four keyless publisher RSS built-ins" matches the registry exactly: `coindesk-rss`, `cointelegraph-rss`, `decrypt-rss`, `bitcoinmagazine-rss`, all `requiresKey: false` | `frontend/src/lib/api/live/providers.ts:198,208,219,230` |
| 15 | `:947` | 🟢 | **Correct; every code-derived half checks out.** `FALLBACK` has **51** keys (`stakingRates.ts:123`); `FALLBACK_MEASURED` holds **27** (`:258`); `FALLBACK_MEASURED_ON = '2026-09-18'` (`:214`); the 14-day withhold is real and deletes the rate (`:697`, `:705`). The live/estimate ratio itself is measurement-derived and stays as written | as cited |
| 16 | `:958` | ✅ | **Correct** — dated historical record | — |
| 17 | `:960` | ✅ | **Correct** — dated, and points at 17b for the live part | — |
| 17b | `:965` | 🟢 | **Correct** — `describeThrottle` exists in `frontend/src/lib/server/coingeckoThrottle.ts` and the "every call site" claim is guarded, not asserted: `__tests__/coingeckoThrottleReporting.test.ts` walks the CoinGecko routes. The remaining "allowance still unread" statement is measurement-derived | as cited |
| 18 | `:974` | ✅ | **Correct** — and its 🔑 UNCONFIGURED result is still the standing state, re-recorded at `DATA-AVAILABILITY.md:741` for 09-09, 09-18 and 09-19 | as cited |

## 1.2 — PROPOSAL A (verified): action item 6 calls the 13 non-live networks "L2s". Only three are.

**Current text** (`DATA-AVAILABILITY.md:904`):

> 6. ✅ Network fee-feed built (`FeeProvider` + `FEE_PROVIDERS`). **Live EVM gas landed in `01d6bfe` (2026-08-21)** — **5 of 18 networks 🟢** (BTC via mempool.space, plus ETH/BNB/Polygon/AVAX via keyless `publicnode eth_gasPrice`). The 13 L2s stay 🟡 estimates **on purpose**: `eth_gasPrice` omits their L1 data fee, which is most of the real cost, so the remaining work is non-EVM chains rather than L2s. This item read "live EVM gas remains the next step" for four weeks after that step had been taken.

**Proposed text** (one clause changed; everything else verbatim):

> 6. ✅ Network fee-feed built (`FeeProvider` + `FEE_PROVIDERS`). **Live EVM gas landed in `01d6bfe` (2026-08-21)** — **5 of 18 networks 🟢** (BTC via mempool.space, plus ETH/BNB/Polygon/AVAX via keyless `publicnode eth_gasPrice`). The remaining **13 stay 🟡 estimates, and only three of them are L2s** (Arbitrum, Base, Optimism); the other ten are non-EVM chains. For the three L2s the estimate is deliberate — `eth_gasPrice` omits their L1 data fee, which is most of the real cost — so the remaining work is the ten non-EVM chains rather than the L2s. This item read "live EVM gas remains the next step" for four weeks after that step had been taken.

**Evidence.** `frontend/src/lib/data/networkFees.ts:18-21` is the `NetworkKey` union — 18 keys:
`erc20, arbitrum, base, optimism, bep20, solana, trc20, polygon, avalanche, bitcoin, xrpl,
litecoin, dogecoin, cardano, polkadot, cosmos, ton_network, near_network`.
`frontend/src/lib/data/networkFees.ts:284-290` is `FEE_PROVIDERS` — five entries: `bitcoinProvider`,
plus `evmGasProvider` for `erc20`, `bep20`, `polygon`, `avalanche`. `computeNetworkFees()` at
`:339-352` marks `source: 'live'` **only** where a provider supplied the gas amount (`:350`),
so the live set is exactly those five. Subtracting them leaves 13 — of which `arbitrum`,
`base` and `optimism` are L2s and the other ten (`solana`, `trc20`, `xrpl`, `litecoin`,
`dogecoin`, `cardano`, `polkadot`, `cosmos`, `ton_network`, `near_network`) are not EVM L2s
at all.

**Why this matters beyond wording.** The sentence names the wrong remaining work in the same
breath as naming the right one — it says "the 13 L2s" and then says "the remaining work is
non-EVM chains rather than L2s". A reader taking the first half plans an L2 data-fee project
for ten chains that do not have one. This is the same shape as the three wrong attributions
CLAUDE.md records at `:1171-1173`: a true observation generalised one category too wide.

**Sibling, code-side, NOT proposed here (out of this run's write scope):**
`frontend/src/app/api/v1/network-fees/route.ts:9-12` carries the same wrong summary in its
own docblock — *"BTC is live (mempool.space); other networks are static gas amounts"* — and
CLAUDE.md `:1349` repeats it (Proposal M below). Three copies, one true statement between them.

## 1.3 — PROPOSAL B (verified): action item 9 is a D21 deferral, and nothing there says so.

**Current text** (`DATA-AVAILABILITY.md:910`):

> 9. ⏳ **Get a paid FMP plan or a different universe source** — `stock-universe` and `stock-outliers` are the largest remaining fallback surface.

**Proposed text** (append a dated annotation; the item line itself is unchanged):

> 9. ⏳ **Get a paid FMP plan or a different universe source** — `stock-universe` and `stock-outliers` are the largest remaining fallback surface.
>    ⚠ **Deferred by owner decision D21 (2026-09-18), not outstanding work.** *"Any action that required a decision around a paid service can be deferred until closer to the end of production."* A surface blocked only by a paid tier is **sequencing**, and the correct state for it is the honest fallback it already shows — so nothing here should be chased before late production. What D21 *does* ask for on this surface is measured and already recorded: `stock-universe` is one of the four single-sourced surfaces in the decision's own table, with the ~79-name curated catalog as its keyless fallback. Re-read `docs/decisions/2026-09-18-owner-decisions.md:7-38` before reopening.

**Evidence.** `docs/decisions/2026-09-18-owner-decisions.md:7-19` is D21 verbatim, including
*"A surface blocked only by a paid tier stays as it is; the correct state for it is an honest
empty or a disclosed fallback, not a purchase."* Its own single-sourced table at `:33-38`
lists `stock-universe` / FMP (paid tier) / fallback "~79-name curated catalog".
The tree corroborates the fallback is real and wired: `CLAUDE.md:1264` describes it, and
`DATA-AVAILABILITY.md:708` records the measured state (🟡 Partial, curated catalog fallback,
FMP `company-screener` PAID-only).

**Why this is a proposal rather than a status flip.** The item is still genuinely open — ⏳ is
correct. What has changed is what an agent reading it should *do*, and leaving a bare ⏳
invites exactly the chase D21 forbids. The charter's rule for this case is explicit
(`checklist-steward.md:37`): *"you must move an item out of an 'open, waiting on the owner'
list once it has been decided — leaving it there invites a session to re-prepare work
already done."* This is the annotation form of that, since the item is not fully closed.

---

# SURFACE 2 — `CLAUDE.md` status surfaces

## 2.1 — Cause 1: the 2026-09-20 MarketWatch / Dow Jones terms removal never reached the tables

This is the largest single cluster, and it is a **terms** matter, not a cosmetic one. On
2026-09-20 `dowjones.io` and `marketwatch.com` were both moved to `verdict: 'prohibited'`
in the source-terms registry, which is a `pinnedFetch` socket block — the same class of
block as Yahoo. CLAUDE.md still lists MarketWatch as a live built-in in two places and
counts it in a third.

**Evidence, first-hand:**
- `frontend/src/lib/server/sourceTerms.ts:1308` — `domain: 'dowjones.io'`, `verdict: 'prohibited'`, `review: 'verified'`, `reviewedAt: '2026-09-20'`.
- `frontend/src/lib/server/sourceTerms.ts:1366` — `domain: 'marketwatch.com'`, `verdict: 'prohibited'`, `review: 'verified'`, `reviewedAt: '2026-09-20'`.
- `frontend/src/app/live-data/market-news/route.ts:60-69` — the removal note, quoting Dow Jones ToU §9.1 / §9.4.1, ending *"dowjones.io is now `prohibited` in the registry, which is a pinnedFetch socket block… Restoring it requires prior written consent, not a code change."*
- `frontend/src/app/live-data/market-news/route.ts:70-72` — `BUILTIN_FEEDS` now contains **one** entry, `'cnbc'`.
- `frontend/src/app/live-data/macro-news/route.ts:68-72` — *"`marketwatch-macro` (mw_bulletins) removed 2026-09-20 ON TERMS … Seven feeds remain."*
- `frontend/src/lib/api/live/providers.ts:320-325` — *"CNBC is the only built-in equity news feed that remains."*

### PROPOSAL C (verified) — `:592`, equity news built-ins

**Current text** (`CLAUDE.md:592`):

> - **News** (`/live-data/market-news` → `getEquityProviders('news')`): built-ins MarketWatch / CNBC plus custom `rss`/`atom`/`json-news` feeds, all active sources merged in parallel.

**Proposed text:**

> - **News** (`/live-data/market-news` → `getEquityProviders('news')`): **CNBC is the only built-in** plus custom `rss`/`atom`/`json-news` feeds, all active sources merged in parallel. ⚠ **MarketWatch was removed 2026-09-20 ON TERMS, not availability** — the feed still serves 200. Dow Jones's Terms of Use §9.4.1 bars automated ingestion "without our prior written consent" and §9.1 names RSS content expressly, so `dowjones.io` and `marketwatch.com` are now `prohibited` in the registry — a `pinnedFetch` socket block, same class as Yahoo. **Do not reintroduce it**; restoring it needs written consent, not a code change.

**Evidence:** `market-news/route.ts:70-72` (one built-in, `'cnbc'`); `sourceTerms.ts:1308`, `:1366`;
`providers.ts:320-325`.

### PROPOSAL D (verified) — `:1289`, Macro News row counts a feed that was removed

**Current text** (`CLAUDE.md:1289`, opening clause):

> | Macro News | `/macro/news` | 🟢 Live | `/live-data/macro-news` — 8 keyless RSS feeds (Investing.com commodities/bonds/forex, OilPrice, FXStreet, MarketWatch, CNBC ×2). …

**Proposed text:**

> | Macro News | `/macro/news` | 🟢 Live | `/live-data/macro-news` — 7 keyless RSS feeds (Investing.com commodities/bonds/forex, OilPrice, FXStreet, CNBC ×2). **MarketWatch's `mw_bulletins` feed was removed 2026-09-20 ON TERMS** (Dow Jones ToU — `dowjones.io` is `prohibited`); every pillar still keeps a dedicated source, so this degraded the general pool rather than removing a pillar. …

**Evidence:** `frontend/src/app/live-data/macro-news/route.ts:60-74` — `FEEDS` holds exactly
seven `providerId` entries: `investing-commodities` (`:61`), `oilprice` (`:62`),
`investing-bonds` (`:63`), `investing-forex` (`:64`), `fxstreet` (`:65`), `cnbc-macro` (`:73`),
`cnbc-economy` (`:74`). The removal note at `:68-72` says "Seven feeds remain" in as many words.

### PROPOSAL E (verified) — `:1296`, macro provider registry row count

**Current text** (`CLAUDE.md:1296`, the clause only):

> `market: 'macro'` exists across the provider registry (11 built-in rows; macro routes are registry-driven with utilization)

**Proposed text:**

> `market: 'macro'` exists across the provider registry (10 built-in rows — was 11 until `marketwatch-macro` was removed on terms, 2026-09-20; macro routes are registry-driven with utilization)

**Evidence:** `frontend/src/lib/api/live/providers.ts` carries exactly ten provider objects with
`market: 'macro'` — `frankfurter` (`:346`), `currency-api-extended` (`:358`), `treasury-gov`
(`:370`), `investing-commodities` (`:385`), `oilprice` (`:397`), `investing-bonds` (`:409`),
`investing-forex` (`:421`), `fxstreet` (`:433`), `cnbc-macro` (`:449`), `cnbc-economy` (`:461`).
The removal note sits at `:444-446`.

### PROPOSAL F (verified) — the Source Terms section never gained the two new prohibited hosts

**Current state.** `CLAUDE.md:707-712` defines the three verdicts and says `prohibited` means
*"hard-blocked, no override, anywhere."* The document then names Yahoo at length (`:608-632`),
Cboe (`:1258`) and Poloniex (`:493`) — **and no others.** There are five prohibited entries.

**Proposed text** — add after `CLAUDE.md:732` (the `prohibited` bullet, under "Three verdicts" at `:727`):

> **The prohibited set today is five, and two of them are recent:** `yahoo.com` (2026-08-06,
> terms), `cboe.com` (P2-O1 audit, 2026-08-05), `poloniex.com` (2026-09-15, User Agreement §9),
> and — added **2026-09-20** — `dowjones.io` and `marketwatch.com` (Dow Jones Terms of Use
> §9.1/§9.4.1: RSS content is named expressly and automated ingestion needs prior written
> consent). All five are `pinnedFetch` socket blocks; none has an override.

**Evidence:** `frontend/src/lib/server/sourceTerms.ts` — `yahoo.com:160`, `cboe.com:171`,
`poloniex.com:186`, `dowjones.io:1308`, `marketwatch.com:1366`, each `verdict: 'prohibited'`.
Enforcement path verified, not assumed: `pinnedFetch.ts:35` imports `assertSourceNotProhibited`
and calls it inside `pinnedFetch`, and `sourceTerms.ts:1683-1687` throws `SourceTermsError` on
a prohibited decision.

---

## 2.2 — Cause 2: a surface that was hidden or emptied, still described as present

### PROPOSAL G (verified) — `:1244`, the crypto TA row advertises a hidden Backtest tab

**Current text** (`CLAUDE.md:1244`):

> | Technical Analysis | `/technical-analysis` | 🟢 Derived | Trend/S-R/patterns/backtest computed client-side from live OHLCV. **The scanner is no longer a tab here** — see below |

**Proposed text:**

> | Technical Analysis | `/technical-analysis` | 🟢 Derived | Trend/S-R/patterns computed client-side from live OHLCV. **The scanner is no longer a tab here** — see below. ⚠ **The Backtest tab is HIDDEN (2026-08-20)**, one of the three backtest surfaces that went dark together (see Strategy Backtests, Equities) — `BacktestPanel` and `lib/utils/backtest.ts` are retained in place and the page carries the restore instructions; `DATA-AVAILABILITY.md` classes crypto backtests 🔴 Not available |

**Evidence.** `frontend/src/app/(dashboard)/technical-analysis/page.tsx:101-103` —
*"'backtest' HIDDEN 2026-08-20 (owner decision, revisitable): the tab, its panel and
lib/utils/backtest.ts are retained — restore by re-adding the tab to the union and the two
lists below."* `:81-83` — *"BacktestPanel moved with them but is deliberately NOT imported
here: it has no call site while the Backtest tab is hidden."* `:432-433` — the tab block is
commented out. Corroborated by `CLAUDE.md:1280` itself, which names "the crypto TA Backtest
tab" as one of the three hidden surfaces, and by `DATA-AVAILABILITY.md:764`
("Backtests (crypto) | 🔴 Not available").

**This is a same-table self-contradiction.** `:1280` says the crypto TA Backtest tab is
hidden; `:1244` says the page computes backtests. A reader who reaches `:1244` first never
gets to `:1280`.

**Sibling, code-side, NOT proposed (out of scope):**
`technical-analysis/page.tsx:215` still renders the page description *"…candlestick charts
with ${ALL_INDICATORS.length} indicators, automated pattern detection, and strategy
backtests."* — user-visible copy advertising a hidden tab. Worth its own queue item.

### PROPOSAL H (verified) — `:1230`, the Headlines row says the dashboard widgets are retained. The directory is empty.

**Current text** (`CLAUDE.md:1230`, the clause only):

> Replaced the old `/dashboard` page; its `components/dashboard/*` widgets are retained but no longer routed.

**Proposed text:**

> Replaced the old `/dashboard` page; its `components/dashboard/*` widgets are **all gone** — the six M8-sweep widgets first, then `RiskHeatmap` on 2026-08-18 (item 4), leaving the directory empty.

**Evidence.** `frontend/src/components/dashboard/` exists on disk and **contains no files**.
`CLAUDE.md:173` — the directory tree in this same document already says
*"dashboard/ # EMPTY — the 6 M8-sweep widgets went first, RiskHeatmap followed on 2026-08-18
with the item 4 ranking cut"*. The remainder of `:1230` already records the `RiskHeatmap`
deletion correctly; only the "retained" clause is wrong.

**Why the guard missed it:** `docs:check`'s tree check reads CLAUDE.md's tree and asserts each
**listed leaf file** exists (`check-doc-facts.ts:222-231`). It never walks the other way, and
it skips directory rows outright (`:224`: `if (isDir || !/\.[a-z]+$/i.test(name)) continue`).
An empty directory described as full is invisible to it.

### PROPOSAL I (verified) — `:93`, the tree says the `/global-adoption` page is retained. It was deleted.

**Current text** (`CLAUDE.md:93`):

> │   │   └── global-adoption/        # De-routed (T5) — redirects to /headlines; page retained

**Proposed text:**

> │   │   └── (no global-adoption/ — page DELETED 2026-09-14 (D10) with /live-data/cbdc-data;
> │   │                              the /global-adoption → /headlines redirect remains,
> │   │                              next.config.mjs:52. An empty leftover directory sits on disk)

**Evidence.** `frontend/src/app/(dashboard)/global-adoption/` exists but contains **no
`page.tsx` and no files at all**. `frontend/next.config.mjs:52` still carries
`{ source: '/global-adoption', destination: '/headlines', permanent: false }`.
`CLAUDE.md:1239` — the Feature Inventory row in this same document already says
*"Page and `/live-data/cbdc-data` route were both **deleted 2026-09-14 (D10)**"*.
`CLAUDE.md:148-149` says the same about the route.

**Same guard gap as Proposal H:** `global-adoption/` is a directory row, and
`check-doc-facts.ts:224` skips directory rows before the existence test runs. The
17 guarded counts are all intact; this one is structurally outside the guard.

### PROPOSAL J (verified) — `:1250`, "Equities Strategy Backtests … remain" reads as reachable

**Current text** (`CLAUDE.md:1250`, final clause):

> (Equities Strategy Backtests at `/equities/backtests` are unrelated and remain.)

**Proposed text:**

> (Equities Strategy Backtests at `/equities/backtests` are unrelated. That page is **retained but HIDDEN since 2026-08-20** — `/equities/backtests` redirects to `/equities` — see the Equities table.)

**Evidence.** `frontend/next.config.mjs:101` —
`{ source: '/equities/backtests', destination: '/equities', permanent: false }`. The page file
still exists at `frontend/src/app/(dashboard)/equities/backtests/page.tsx` (so "retained" is
true, "remain" is misleading). `CLAUDE.md:1280` states the hide correctly.
`DATA-AVAILABILITY.md:764` — *"`/equities/backtests` has redirected to `/equities` since
2026-08-20 … **no user can reach the page**."*

### PROPOSAL K (verified) — two live pages are absent from the Feature Inventory and from the tree

**Missing from both the Feature Inventory table and the Directory Structure tree:**

| Page on disk | Nav entry | In CLAUDE.md? |
|---|---|---|
| `frontend/src/app/(dashboard)/how-we-make-money/page.tsx` | `registry.ts:133` — "How We Make Money" under Settings | **Nowhere.** Not in the tree, not in the Feature Inventory |
| `frontend/src/app/(dashboard)/pump-report/page.tsx` | `registry.ts:197` — "Pump Report" | In the Feature Inventory (`:1247`) but **not in the tree** (`:60-93` lists no `pump-report/page.tsx`) |

**Proposed:** add a Feature Inventory row for `/how-we-make-money`, and add both files to
the Directory Structure tree. Suggested row:

> | How We Make Money | `/how-we-make-money` | ⚠ **Placeholder copy** | Standing FTC affiliate disclosure behind the per-link tags on `/staking` (`lib/data/affiliates.ts`). **The prose marked "OWNER COPY REQUIRED" is a placeholder, not a disclosure** — `docs/BUSINESS-CHECKLIST.md` §3 lists the disclosure set as the owner's to write, and the placeholders are written so they cannot be mistaken for finished copy. Not harmful today: no provider has an affiliate URL set, so the live sections report zero |

**Evidence.** `frontend/src/lib/modules/registry.ts:133` —
`{ href: '/how-we-make-money', label: 'How We Make Money', icon: Coins }`, nested under the
`/settings` entry (`:119`). The page exists and its own docblock at
`how-we-make-money/page.tsx:7-24` says: *"⚠ THE PROSE MARKED 'OWNER COPY REQUIRED' BELOW IS A
PLACEHOLDER, NOT A DISCLOSURE … Nothing here is reachable in a harmful state today: no
provider has an affiliate URL set."* `registry.ts` is the file the sidebar renders from
(`CLAUDE.md:153` — `Sidebar.tsx # Renders from module registry`), so this page is nav-reachable, not orphaned.

**Why the guard missed it:** same one-directional tree check as Proposals H and I. A page
that exists but is unlisted cannot fail `docs:check` — the check iterates CLAUDE.md, never
the filesystem (`check-doc-facts.ts:212-238`).

**This is the highest-value finding of the run** and I want to be plain about why: an
unfinished legal-disclosure page is reachable from the nav, and the document every agent
auto-loads does not know it exists. The charter's own lesson applies verbatim
(`checklist-steward.md:49-51`): *"an unowned document does not drift more slowly than an
owned one, it just drifts unobserved."*

---

## 2.3 — Cause 3: "🟢 Live" on a key-gated or paid-gated path

`DATA-AVAILABILITY.md` is the declared source of truth for these statuses — CLAUDE.md says so
itself at `:1223-1226` ("Data-status source of truth"). Three rows contradict it.

### PROPOSAL L (verified) — `:1264`, Stock Registry is 🟢 Live against a PAID-only endpoint

**Current text** (`CLAUDE.md:1264`, status + opening clause):

> | Stock Registry | `/equities` | 🟢 Live | Universe from `/live-data/stock-universe` (FMP stock-screener, daily-cached, all active common stocks + sectors) with `equityCatalog.ts` curated fallback when no FMP key. …

**Proposed text:**

> | Stock Registry | `/equities` | 🟡 Partial 🔑 | Universe from `/live-data/stock-universe` (FMP stock-screener, daily-cached) with `equityCatalog.ts` curated fallback. ⚠ **"All active common stocks" needs a PAID FMP plan** — `company-screener` is paid-only, so with the free key the registry is the 79-name curated catalog, which is the measured state (`DATA-AVAILABILITY.md:708`). **Deferred under D21, not a defect** — and `stock-universe` is one of the four single-sourced surfaces D21 names. …

**Evidence.**
- `DATA-AVAILABILITY.md:708` — *"Stock Registry universe | 🟡 Partial | **curated catalog fallback** | FMP `company-screener` is **PAID-only**; without it the registry is 79 hand-maintained names."*
- `CLAUDE.md:810` (its own env-var table) — *"PAID only: batch quotes, company-screener, constituent lists… the broad Stock Registry universe needs a paid plan."*
- `docs/decisions/2026-09-18-owner-decisions.md:36` — the single-sourced table lists `stock-universe` / FMP (paid tier) / "~79-name curated catalog".

So CLAUDE.md contradicts itself across `:810` and `:1264`, and contradicts the file it names
as authoritative. The 🟡 + D21 note reconciles all three without proposing a purchase, which
D21 forbids.

### PROPOSAL M (verified) — `:1349`, the v1 network-fees row says only BTC is live

**Current text** (`CLAUDE.md:1349`):

> | `GET /api/v1/network-fees` | Gas fees for all **18** networks (BTC live, rest estimated) — `NETWORK_GAS` / `NetworkKey` in `lib/data/networkFees.ts`, which the route derives from. Said 16 until 2026-09-12 |

**Proposed text:**

> | `GET /api/v1/network-fees` | Gas fees for all **18** networks (**5 live** — BTC via mempool.space plus ETH/BNB/Polygon/AVAX via keyless `publicnode eth_gasPrice`; the other 13 are static gas amounts priced live, `source: 'estimate'`) — `NETWORK_GAS` / `NetworkKey` / `FEE_PROVIDERS` in `lib/data/networkFees.ts`, which the route derives from. Said 16 networks until 2026-09-12; said "BTC live, rest estimated" until the live EVM gas of 2026-08-21 (`01d6bfe`) was reflected here |

**Evidence.** Same as Proposal A: `networkFees.ts:284-290` (`FEE_PROVIDERS` = BTC + four EVM
L1s), `:350` (`source: liveNative != null ? 'live' : 'estimate'`), and
`api/v1/network-fees/route.ts:14` calling `computeNetworkFees()`.
`DATA-AVAILABILITY.md:904` already records "5 of 18 networks 🟢", and
`CLAUDE.md:102-104` (the tree's own route comment) already says
*"Live BTC (mempool.space) + live EVM-L1 gas (eth_gasPrice, keyless publicnode) for
ETH/BNB/Polygon/AVAX"*. Third self-contradiction in the same document.

### PROPOSAL N (verified) — `:1288` and `:1290`, macro rows are 🟢 Live against a ladder measured 🔑 UNCONFIGURED three times

**Current text** (`CLAUDE.md:1288`):

> | Macro Overview | `/macro` | 🟢 Live | Landing page; live quote strips per area |

**Proposed text:**

> | Macro Overview | `/macro` | 🟡 Key-gated | Landing page; quote strips per area ride the shared `security-quotes` ladder, **which has answered 🔑 UNCONFIGURED for macro symbols on every audit since 2026-09-09** (`GC=F`/`EURUSD=X`/`ZN=F` all missing with five keys held — `DATA-AVAILABILITY.md:741`). Unpriced renders a dash; the catalogs carry no reference prices by design. Open between a paid FMP plan (it answers 402) and a symbol-mapping fix, and nothing measured yet distinguishes them — **do not write "no keyed rung carries them"** |

**Current text** (`CLAUDE.md:1290`, status + the clause that matters):

> | Commodities | `/macro/commodities`, `/[slug]` | 🟢 Live | `commodityCatalog.ts` — 19 verified front-month contracts, 5 categories. … Detail: chart + facts + ETF proxies → /funds. …

**Proposed text** (status and one inserted clause; the long ETF-proxy passage is unchanged and
is separately correct):

> | Commodities | `/macro/commodities`, `/[slug]` | 🟡 Key-gated | `commodityCatalog.ts` — 19 verified front-month contracts, 5 categories. **Prices and charts are key-gated and currently unserved** — the futures ride the same `security-quotes`/`security-chart` ladder as equities, and macro symbols have measured 🔑 UNCONFIGURED on every run since 2026-09-09; the catalog copy, categories and ETF proxies below are unaffected. … Detail: chart + facts + ETF proxies → /funds. …

**Evidence.**
- `DATA-AVAILABILITY.md:741` — *"Commodity / currency / rate quotes | 🔑 Key-gated (measured 2026-09-09, 09-18 and 09-19 — 🔑 UNCONFIGURED on all three) … with FMP, Finnhub, Twelve Data, Tiingo and Alpha Vantage keys all held, the ladder still answers `source=reference`, `quotes: {}`, all three missing."*
- `DATA-AVAILABILITY.md:84` and `:258` record the same result from the audit runs.
- `CLAUDE.md:622` (its own Yahoo-removal table) — *"**Macro instrument quotes** (`GC=F`, `EURUSD=X`) | **Hit hardest.** … coverage depends on the keyed provider configured and is expected to be partial."*
- `CLAUDE.md:1284` — the module preamble confirms the shared plumbing: *"futures, FX pairs, and yield indices all price through the existing `security-quotes`/`security-chart`/`security-ohlcv` routes (verified)."*
- The agent tool text agrees and the table does not: `frontend/src/lib/agents/tools.ts:344` — *"macro quote coverage depends on the API key configured — an unpriced instrument returns no quote rather than a guess."*

**Deliberately NOT proposed for the other two macro rows, and why:**
- **Currencies (`:1291`)** — keeps 🟢 Live. Its headline feature is the two-tier converter, which is **keyless and measured live** (`DATA-AVAILABILITY.md:738-739`: ECB via frankfurter.dev 🟢, extended tier 🟢 with `missing: []`). Only the per-pair quote strip is gated, and that is a smaller share of the row than in Commodities.
- **Bonds & Rates (`:1292`)** — keeps 🟢 Live. The four yield entries moved **off** the quote ladder onto the keyless treasury.gov par curve on 2026-09-03 (D3), measured 🟢 at `DATA-AVAILABILITY.md:740`. Only the four CBOT futures still hit `security-quotes`.

Marking all four macro rows key-gated would be as wrong as marking none — the difference
between them is real and is the reason two of them survived the Yahoo removal intact.

### PROPOSAL O (verified) — `:1277`, Stock Social calls Reddit "keyless"

**Current text** (`CLAUDE.md:1277`):

> | Stock Social | `/equities/social` | 🟡 Partial | Reddit + StockTwits (keyless) sentiment |

**Proposed text:**

> | Stock Social | `/equities/social` | 🟡 Partial | **StockTwits only in practice** (keyless). Reddit is **gated off by its own robots.txt**, not rate-limited and not IP-dependent — `assertRobotsPermits` refuses every `reddit.com` URL unless `REDDIT_CLIENT_ID` is set, and the route declares the omission in `withheld[]` rather than returning a quiet short feed |

**And PROPOSAL O-bis** — the same misattribution in the prose the row rests on, `CLAUDE.md:593`:

> **Current:** (Reddit 403s from datacenter IPs without OAuth — expect StockTwits-only in server/CI environments.)
>
> **Proposed:** (Reddit is refused by `pinnedFetch` because reddit.com's robots.txt disallows this app's agent — 2026-08-29 terms review — unless `REDDIT_CLIENT_ID` is set. **This is our own gate, not an IP or rate-limit effect**, so it applies on the owner's machine exactly as in CI; expect StockTwits-only everywhere until a key is configured. The `.json` API's 403 and the `.rss` 429 are both real and both irrelevant — neither is what stops it today.)

**Evidence, path followed end to end.**
- `frontend/src/lib/server/sourceTerms.ts:1666-1676` — `assertRobotsPermits(url, env)` looks up the host, and `if (rd.liftedBy && (env[rd.liftedBy] ?? '').trim()) return` / `throw new RobotsDisallowedError(...)`. No IP or environment input.
- `frontend/src/lib/server/pinnedFetch.ts:35` imports it; `:122` calls it on every fetch.
- `frontend/src/app/live-data/stock-social/route.ts:248` — `const redditAllowed = robotsPermits('https://www.reddit.com/')`; `:249` and `:253` make the subreddit list empty when it is false; `:315-321` emits `withheld: [{ id: 'reddit-stocks', … reason: "Reddit's robots.txt disallows this app's agent. Configure REDDIT_CLIENT_ID (OAuth)…" }]`.
- Corroborated: `DATA-AVAILABILITY.md:214-215`, `:846` (*"StockTwits only — Reddit's robots.txt gates the RSS legs off … so the 429 path is no longer walked at all"*), and `CLAUDE.md:1238` itself, which states it correctly for the **crypto** Social row.

**Why this one matters more than its size.** `CLAUDE.md:1171-1181` records that three wrong
attributions in one day were all the same error — reading one observation as a property of
the world. `:593` is a fourth instance of it, still live in the file that teaches the lesson:
it names a datacenter-IP 403 as the cause of a block that is ours and unconditional. An agent
reading it debugs egress.

---

## 2.4 — Cause 4: typed counts that drifted

### PROPOSAL P (verified) — the extended FX tier is 126 currencies, not 127 (two places)

**Current text, `CLAUDE.md:131`:**

> │       ├── fx-rates-extended/route.ts # +127 more currencies (community currency-api, keyless) — converter's labeled extended tier

**Proposed:** `# +126 more currencies (community currency-api, keyless) — converter's labeled extended tier`

**Current text, `CLAUDE.md:1291`** (the clause only):

> **Converter is two-tier**: 30 ECB currencies (`/live-data/fx-rates`, frankfurter.dev — verified to be ECB's *complete* published set, not a subset) plus 127 more via `/live-data/fx-rates-extended`

**Proposed:** *"… plus 126 more via `/live-data/fx-rates-extended`"*

**Evidence.** `frontend/src/app/live-data/fx-rates-extended/route.ts:56-84` is
`EXTENDED_CURRENCIES`; excluding the comment blocks at `:58-63` and `:70-76`, it holds
**126 distinct three-letter codes**. `DATA-AVAILABILITY.md:739` measured it and agrees:
*"126 of 126 allowlisted currencies priced, `missing: []` (2026-09-19)"*. The drop from 127
is recorded in the file itself — `:58-63`, `'bgn' removed 2026-07-22` after Bulgaria adopted
the euro.

**Sibling, code-side, NOT proposed (out of scope, but it is a live violation of the
derive-don't-type rule at `CLAUDE.md:1442`):** `frontend/src/lib/agents/tools.ts:395` hardcodes
*"and, when include_extended is true, **127 more** community-sourced currencies"* in the
`get_fx_rates` tool description — a number the agent reads out to a user. The same file
derives correctly two tools earlier (`:344` interpolates `COMMODITY_CATALOG.length` etc.),
so the fix is a one-line interpolation and the pattern is already there. Worth a queue item.

### PROPOSAL Q (verified) — `:640-646`, `:678`, `:689-700`: the Source-Terms narrative is three claims behind the registry

This is prose, not a table, but the tables inherit from it and it is the most-read
explanation of the registry's trustworthiness in the repo. **The guarded count is right; the
story around it is not.** `docs:check` pins the numeral `26` (`check-doc-facts.ts:96-109`)
and nothing else in these paragraphs.

**The registry as of 2026-09-22** (read entry by entry from `frontend/src/lib/server/sourceTerms.ts`):
56 entries, 30 `seeded`, 26 `verified` — all three matching CLAUDE.md's guarded numerals.
Of the 26 verified, **eight carry `reviewedAt` dates after the narrative was written**:
`financialmodelingprep.com` (`:287`, 2026-09-13), `finnhub.io` (`:393`, 2026-09-20),
`twelvedata.com` (`:465`, 2026-09-20), `binance.us` (`:613`, 2026-09-20),
`coindesk.com` (`:1222`, 2026-09-20), `dowjones.io` (`:1308`, 2026-09-20),
`marketwatch.com` (`:1366`, 2026-09-20), `investing.com` (`:1412`, 2026-09-20).

**Q1 — `CLAUDE.md:678`. Current text:**

> Finnhub, Twelve Data, Binance.US and FMP's entry are still `seeded`.

**Proposed text:**

> **Overtaken 2026-09-22: all four are now `verified`.** FMP flipped on 2026-09-13
> (`sourceTerms.ts:287` — `review: 'verified'`, `reviewedAt: '2026-09-13'`), and Finnhub,
> Twelve Data and Binance.US on 2026-09-20 (`:393`, `:465`, `:613`) against the readings in
> `docs/audits/terms-review-finnhub-2026-09-20.md` and
> `docs/audits/terms-review-twelvedata-binanceus-2026-09-20.md`. **The
> personal-vs-commercial question itself is NOT thereby answered** — `docs/LEGAL-REVIEW.md`
> records that all four bar a deployment other people can reach, with no tier curing it, and
> that is the owner's to resolve. `verified` means the document was read, never that the
> permission is adequate.

**Q2 — `CLAUDE.md:689-700`. Current text (opening and closing sentences):**

> **Read 2026-09-13 — and the entry is still `seeded`.** … What is still open is the registry itself: the entry's `review` is `'seeded'` and its `reviewedAt` `'2026-08-06'`, so a reading that happened is not recorded as one.

**Proposed:** keep the whole §2.2.1/§2.2.2 substance verbatim — it is the record of what was
read and it is still accurate — and replace only the framing sentences:

> **Read 2026-09-13, and RECORDED as read since then.** … *(clause analysis unchanged)* …
> **The registry now matches the reading** (corrected on or before 2026-09-13):
> `sourceTerms.ts:287` carries `review: 'verified'`, `reviewedAt: '2026-09-13'`, with the
> verbatim clauses as its `finding`. What remains open is not the record but the **permission**:
> §2.2.1 grants personal, non-business, non-commercial use only and §2.2.2 bars any multi-user
> deployment "irrespective of whether such usage is complimentary or paid", so broader rights
> come from an Order Form under §2.1. That is T-151's keystone question — see `docs/LEGAL-REVIEW.md`.

**Q3 — `CLAUDE.md:640-646`.** The narrative reconciles to 18, not 26: *"Cboe … and CoinGecko …
were the first two, and sixteen more were read on a clean egress on 2026-09-14/15."*
**Proposed:** append one sentence —

> **Eight more followed and are included in the 26**: FMP on 2026-09-13, and on 2026-09-20
> Finnhub, Twelve Data, Binance.US, CoinDesk, Investing.com, and the two Dow Jones properties
> (`dowjones.io`, `marketwatch.com` — both read to a **`prohibited`** verdict, which is a
> reading like any other). Readings are recorded in
> `docs/audits/terms-review-finnhub-2026-09-20.md`,
> `terms-review-twelvedata-binanceus-2026-09-20.md` and `terms-review-news-2026-09-20.md`.

**Why the guard could not catch any of Q1–Q3.** `docs:check` watches the *numeral* 26
against `SOURCE_TERMS.filter(e => e.review === 'verified').length` and nothing else. A
sentence naming *which* entries are seeded is not a count, so it is unwatched — and its
anti-vacuity rule (`check-doc-facts.ts:34-38`) protects against a reworded pattern, not
against a correct number with a false story attached. This is worth a new FACT only if the
owner wants it; the honest fix is the prose.

---

# 3. Could not fully verify

### 3.1 — DATA-AVAILABILITY item 10's second caveat: the `/equities/social` page "never issues its query"

**Current text** (`DATA-AVAILABILITY.md:921-923`):

> ⚠ Separately: the `/equities/social` **page** currently never issues its query (stuck on "Fetching social signals…" while the app reports Offline/DISCONNECTED). Pre-existing and unrelated — the route and a direct fetch from that page both work; tracked separately.

**What I could establish.** There is **no code-level cause remaining.** The query in
`frontend/src/app/(dashboard)/equities/social/page.tsx:143-152` is an unconditional
`useQuery` — no `enabled:` gate, no feed-status guard, no suspense boundary between it and
mount. The "Fetching social signals…" string at `:216` renders on `isLoading` alone. So the
described mechanism (a query gated on a feed-status store that reports Offline) does not
exist in this file today.

**What I could not establish.** Whether the *symptom* still occurs. That is a runtime
observation, it was recorded as one, and nothing in the tree can refute it — a stuck spinner
could come from the provider-registry read inside the route, from React Query's global
defaults in `providers.tsx`, or from an unrelated hydration failure. Per the charter's rule 3
(`checklist-steward.md:80-82`) I am leaving it open rather than closing it on a partial read.

**Proposed instead — a dated annotation, not a closure:**

> ⚠ *(2026-09-22, code reading only — not a re-measurement.)* The mechanism this caveat
> describes is no longer present in the page: the query at
> `equities/social/page.tsx:143-152` is unconditional, with no `enabled:` gate and no
> feed-status dependency, and the spinner at `:216` keys on `isLoading` alone. Whether the
> symptom still reproduces needs one load of `/equities/social` on the owner's machine. Do
> not close this from the source read alone.

### 3.2 — "30 ECB currencies" (`CLAUDE.md:1291`)

**Not proposed for change, and here is the conflict so the next reader does not re-derive it.**
CLAUDE.md and `DATA-AVAILABILITY.md:738` both say 30, and the latter is a measurement
(*"`fx-rates` — 30 currencies, `date=2026-07-29`, `source=frankfurter-ecb`"*). But
`frontend/src/app/live-data/fx-rates-extended/route.ts:58-61` carries a **2026-07-22** code
comment asserting the opposite: *"The ECB dropped it from its reference set (29 currencies
today, BGN absent — verified against the live feed)."*

The app hardcodes no ECB list — `/live-data/fx-rates` passes through whatever frankfurter
returns — so this is a fact about an **external system**, measurement-derived, and under the
charter's rule 6 (`checklist-steward.md:106-112`) it is not mine to settle. One
`npm run audit` on the owner's machine decides it. Flagging it because two repo sources
disagree by one and both read as authoritative.

### 3.3 — Item 15's gap breakdown (14 / 5 / 3 / 2)

`DATA-AVAILABILITY.md:951-953` splits the 24 non-live staking keys by gap reason. Those
reasons are computed per request inside `stakingRates.ts`, not declared in a table, so the
split cannot be read off the source — only observed in a response. The **denominators** are
verifiable and correct (51 keys at `:123`, 27 measured at `:258`, so 24 unmeasured), and the
`needs-api-key` pair `native_dot`/`native_ksm` is the kind of claim D21 defers. No change
proposed; recording that I checked the halves I could.

### 3.4 — The `equity-diligence` agent still emits a `riskScore` field

Outside both surfaces, so **not a proposal** — recorded so it is not lost.
`frontend/src/lib/agents/prompts.ts:535` has the `equity-diligence` agent emit
`"riskScore": <0.0-10.0, higher = MORE CONCERNING — this is a diligence red-flag measure,
NOT the app's canonical Safety Score, which is 0-100 and higher = SAFER>`.

The 2026-09-08 rename (Phase 6 of the risk-scale spec) took `riskScore` → `suspicionScore`
on the **pump-report** surface only, and the guard test
(`live-data/pump-report/__tests__/suspicionScore.test.ts:45-50`) is scoped to
`live-data/pump-report/` and `components/pump-report/`, so this field is outside it.
`docs/architecture/risk-scale-spec.md:318` documents the pump-report field as the renamed one
and does not address this one.

**I am not proposing a rename.** It carries the disambiguating note the collision needed,
it is an agent output rather than a published per-asset figure (so RP-6 and D14 are not
engaged on their face), and deciding whether the same collision argument applies here is a
spec question for the owner, not a status correction. Whether it needs a queue item is the
owner's call.

---

# 4. Why `npm run docs:check` is green while all of this is true

The task brief asked that no proposal touch a figure the guard already pins without
explaining the gap. **None of the 17 guarded assertions is among these findings**, and I
verified the guarded facts independently rather than assuming:

| Guarded fact | Tree value | CLAUDE.md | Verified how |
|---|---|---|---|
| `source-terms-total` | 56 | 56 | counted every `domain:` in `sourceTerms.ts` |
| `source-terms-seeded` | 30 | 30 | counted `review: 'seeded'` |
| `source-terms-verified` | 26 | 26 | counted `review: 'verified'` |
| `exchanges` | 29 | 29 | `EXCHANGES` in `transferFees.ts` |
| `fund-catalog` | 126 | 126 | `FUND_CATALOG` |
| `equity-catalog` | 79 | 79 | `EQUITY_CATALOG` |
| `staking-providers` | 55 | 55 | `STAKING_PROVIDERS` |
| `macro-instruments` | 45 | 45 | 19 + 18 + 8 across the three catalogs |

**The guard has exactly three structural blind spots, and every finding above sits in one:**

1. **It watches numerals, never the sentence around them.** Proposals C, L, N, O and Q are
   wrong *claims* attached to right *numbers* (or to no number). `check-doc-facts.ts:68`
   defines a `Fact` as `{ value: () => number; asserts }` — prose has no representation.
2. **Its tree check runs one way only.** `checkTree()` (`:212-238`) parses CLAUDE.md's fenced
   block and asserts each listed leaf file exists. It never walks `frontend/src` to ask what
   is *missing* from the tree, and `:224` skips every directory row before the existence test.
   Proposals H, I and K all live in that gap — an empty directory described as full, a
   deleted page described as retained, and two live pages described nowhere.
3. **The counts it watches are catalog lengths, not route-level composition.** Proposals D
   (7 feeds, not 8), E (10 macro rows, not 11), M (5 live networks, not 1) and P (126
   currencies, not 127) are all counts of things the tree can compute that no FACT names.

**Cheap hardening, if the owner wants it** — the charter says adding a fact is cheap and a
count that has drifted twice is a candidate (`checklist-steward.md:56-59`). In descending
order of value:

| Candidate FACT | `value()` | Would have caught |
|---|---|---|
| `macro-news-feeds` | `FEEDS.length` in `live-data/macro-news/route.ts` | Proposal D |
| `extended-currencies` | `EXTENDED_CURRENCIES.length` | Proposal P (and the code copy at `tools.ts:395`) |
| `macro-providers` | providers with `market: 'macro'` | Proposal E |
| `live-network-fee-providers` | `FEE_PROVIDERS.length` | Proposals A and M |
| **A reverse tree check** | every `(dashboard)/**/page.tsx` appears in the tree | Proposals I and K |

The last one is the only structural change and is the one I would argue for: it closes the
blind spot that let a placeholder legal-disclosure page go undocumented in the file every
session auto-loads.

---

# 5. Summary for approval

**Verified — ready to apply on approval (16 changes across 2 files):**

| # | File:line | One-line change |
|---|---|---|
| A | `DATA-AVAILABILITY.md:904` | "13 L2s" → 13 remaining, of which 3 are L2s |
| B | `DATA-AVAILABILITY.md:910` | append D21 deferral annotation |
| C | `CLAUDE.md:592` | MarketWatch removed on terms; CNBC is the only built-in |
| D | `CLAUDE.md:1289` | 8 macro RSS feeds → 7, drop MarketWatch |
| E | `CLAUDE.md:1296` | 11 macro provider rows → 10 |
| F | `CLAUDE.md:732` | add the five-host prohibited list |
| G | `CLAUDE.md:1244` | crypto TA Backtest tab is hidden |
| H | `CLAUDE.md:1230` | `components/dashboard/*` is empty, not retained |
| I | `CLAUDE.md:93` | `/global-adoption` page deleted, not retained |
| J | `CLAUDE.md:1250` | `/equities/backtests` hidden, not "remain" |
| K | `CLAUDE.md:60-93` + Feature Inventory | add `how-we-make-money` and `pump-report` |
| L | `CLAUDE.md:1264` | Stock Registry 🟢 Live → 🟡 Partial 🔑 + D21 |
| M | `CLAUDE.md:1349` | v1 network-fees: 5 live, not BTC only |
| N | `CLAUDE.md:1288`, `:1290` | Macro Overview + Commodities 🟢 Live → 🟡 Key-gated |
| O | `CLAUDE.md:1277`, `:593` | Reddit is robots-gated by us, not IP-blocked |
| P | `CLAUDE.md:131`, `:1291` | 127 extended currencies → 126 |
| Q | `CLAUDE.md:640-646`, `:678`, `:689-700` | FMP/Finnhub/Twelve Data/Binance.US are `verified` |

**Could not fully verify — left open (4):** §3.1 (the `/equities/social` spinner — needs one
page load on the owner's machine), §3.2 (ECB 29-vs-30 — needs `npm run audit`), §3.3 (item
15's gap-reason split — runtime-computed), §3.4 (`equity-diligence`'s `riskScore` — an owner
spec question, not a status correction).

**Code-side siblings found but NOT proposed** (each wants its own queue item, none is a
status-document edit): `api/v1/network-fees/route.ts:9-12` repeats the BTC-only claim;
`technical-analysis/page.tsx:215` advertises the hidden Backtest tab in user-visible copy;
`lib/agents/tools.ts:395` hardcodes "127 more" currencies in a description an agent reads
aloud, in a file that already derives the same class of count correctly at `:344`.

**Standing decisions checked against every proposal above, none contradicted:** RP-3
(explanation yes, ranking no), RP-5 (no exchange API-key custody), RP-6 (no published
per-coin risk score), D14 (no composite staking risk score), D2 (Python backend retired),
D21 (paid tiers are sequencing — Proposals B and L *apply* it rather than proposing a
purchase), and the standing rule that nothing automatically deletes a project file. No
proposal adds, removes or rewords a decision, a finding, or a verdict.
