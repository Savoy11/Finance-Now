# Agent Charter — Code Checker

**Role:** Review code changes (PRs, branches, or the working tree) against Finance Now's
invariants, and report findings ranked by severity with file:line evidence.

**Why this charter exists:** this codebase carries an unusual number of decisions that
*look* like bugs and are not — empty lists left empty on purpose, ladders deliberately not
parallelised, a score ceiling that is unreachable by design. A reviewer without the
registry below will "fix" them, and every such fix is a regression. Symmetrically, the
genuinely dangerous defects here have been the quiet kind: a 200 carrying fallback data, a
blocklist written but never read, an export that only a production build rejects.

---

## Baseline (run before judging anything)

```bash
cd frontend
npm install --no-audit --no-fund
npx tsc --noEmit        # must be clean
npx vitest run          # 1437 tests in 102 files as of 2026-09-12; must all pass
npx eslint .            # 0 errors; 44 pre-existing warnings as of 2026-09-12
npx next build          # THE check dev mode misses — see C1 below
```

- **`next build` is load-bearing.** Finding C1 (2026-07-27): a helper exported from a
  route file passed tsc, vitest, and dev mode, and broke only the production build. Any
  review that skips the build can miss an unshippable app.
- **Lint warnings: diff instances, not counts.** The ~52 warnings are pre-existing
  (react-hooks rules). Judge a change by whether it *adds* instances — line numbers shift,
  so compare rule+context, or stash and compare.
- **`npm run audit` results are IP-dependent.** From a datacenter/container, most
  market-data hosts are unreachable (proxy 403s, Binance 451, Reddit blocks) — a FAIL
  column collected there is void. Code reading is environment-independent; availability
  is not. Never file "source X is broken" from a non-owner machine.

## Invariants to enforce

**Routes**
- Route files (`route.ts`) export **only** HTTP handlers, config fields, and types. A
  helper function export breaks `next build` (C1). Shared logic goes in `lib/server/`.
- Every `/live-data/*` route: `export const dynamic = 'force-dynamic'`; `next:
  { revalidate: N }` on fetches; a typed exported response interface.
- Failure boundaries by shape — this is the one reviewers most often get backwards:
  - *Independent fetches* → `Promise.allSettled`.
  - *Sequential fallback ladder* (try A, else B…) → per-leg try/catch, return on first
    success. **Parallelising a ladder is a regression** — it burns rate limit on exactly
    the calls the ladder exists to avoid. 7 of 8 routes once flagged for "missing
    allSettled" were correct as written.
  - *Accumulate-until-satisfied* (page walks) → try/catch inside the loop, break and
    report the range as incomplete.
- First-party API routes with dynamic segments MUST live under `/api/user/` — the
  next.config rewrite silently proxies dynamic routes elsewhere to the dormant backend.
- Public `/api/v1/*` routes use the `_cors.ts` helper + OPTIONS export. The v1 surface is
  a public contract (MCP server + external agents) — changes must be additive.

**Modules**
- Module pages import shared code only from `components/ui`, `components/charts`,
  `components/markets`, `lib/` core, and their own folders. Cross-module route-type
  imports must be `import type` only.
- Every optional-module page wraps in `<ModuleGate>` **at the component boundary** —
  wrapping returned JSX still mounts the page and fires its queries behind the lock.
- New nav entries go in `lib/modules/registry.ts`, never in Sidebar.tsx.

**Data honesty (the house identity — treat violations as HIGH)**
- Live-only: no mock path exists. A surface without a real source renders an explicit
  "not available" (`LiveUnavailable`), never a fabricated value. Reference prices carry
  the amber `ref` tag.
- Hand-maintained tables carry provenance: `*_LAST_VERIFIED`, staleness window,
  injectable-`now` age functions, `get…Provenance()`, rendered via `<ProvenanceNotice>`
  **always visible, not only when stale**. Reference implementations: `transferFees.ts`,
  `stablecoinMeta.ts`, `stakingProviders.ts`.
- Never stamp static data with a fresh timestamp (`updatedAt: new Date()` on reference
  rows is the L2 anti-pattern).
- A 200 carrying fallback data is the failure mode that misdirects debugging. When
  reviewing data-layer changes, check what the response *claims* about itself, not just
  that it returns.

**Security**
- Sensitive routes (agents, provider config writes, video-analyze POST, the
  pump-report scan/investigate/chat routes) call `guardSensitiveRoute` first.
- **Exchange API-key custody is forbidden, not guarded (RP-5, 2026-08-18).** This
  bullet used to list "exchange creds" among the routes to check the guard on. Those
  routes are deleted: they stored an `apiKey` + `apiSecret` in plaintext at rest — the
  highest-value secret the app held — for a read-only balance view that watched
  addresses already approximate from public chain data. A diff that reintroduces
  exchange-key storage is a 🔴 finding regardless of how well it is guarded.
- User-supplied URLs go through `validatePublicHttpUrlResolved` + `pinnedFetch`
  (resolve-time validation AND connection pinning — string-level checks alone are the M3
  gap). Redirects on user-URL fetches: `redirect: 'manual'` or re-validate every hop (H1).
- Secret stores (`.provider-config.json` etc.) are written `mode: 0o600`, never sent to
  the browser (`hasKey` booleans only), never `NEXT_PUBLIC_`.
- Ownership scoping on `/api/user/*`: every query filters by `getCurrentUserId()`.

**Frontend**
- Tailwind compiles at build time (`aa35239`). `src/app/layout.tsx` imports
  `globals.css` directly; the old committed `globals.compiled.css` froze the CSS at
  whenever someone last remembered to run a build step, so a new utility class
  silently rendered as a no-op. There is no `css:build` script and none is needed.
  *(This bullet said the opposite until 2026-09-08.)*
- React Query uses the stale-time constants from `lib/constants.ts`.
- Money/net-worth columns are `numeric`, never float (see `invest.ts` note).

## The do-not-fix registry (deliberate decisions that look like bugs)

Reviewers must NOT flag or "fix" these. If you believe one is genuinely wrong, report it
as a question with your reasoning — do not change it.

| Looks like | Actually |
|------------|----------|
| Negative-P/E companies return `null` P/E | Deliberate — a negative multiple corrupts the range filter (INTC is the live example) |
| `'stooq'` literal in `PRICE_SOURCES` | Inert legacy value; Stooq is dead (404s) and must not return as a quote rung |
| Empty `etfProxies` on several commodities/EM currencies | Verified delistings (2026-07-21) — backfilling with a basket fund is the exact overstated-specificity bug that was fixed |
| `diversificationScore` never reaches 100 | Ceiling unreachable by design; the old formula pinned everything at 100 |
| Concentration measured vs plan target, not absolute weight | A 55% total-market core is 3,500 companies on purpose |
| No fee warning at build time in Portfolio Builder | Every reachable instrument is cheap; a threshold would be dead code. Fee creep is checked in `reviewPlan()` against actual holdings |
| `fund-holdings` uses `allSettled` over a "ladder" | Justified hybrid — side legs feed the response even when SEC wins. Do not "correct" it |
| SPY returns 5 catalog holdings | SPY is a UIT and files no N-PORT; pinned as a test so nobody "fixes" a filing that will never exist |
| Celsius (defunct) in the staking catalog | Deliberately retained as the educational cautionary example |
| Sequential provider ladders not parallelised | See failure-boundary rules above |
| `config/route.ts` save-time URL checks are string-level | On purpose — a Save should not fail because DNS was down; fetch-time paths carry the resolved checks |
| `LOCAL_USER_EMAIL = 'local@fn.local'` + legacy `local@caep.local` adoption lookup in `getOrCreateLocalUser()` | Sentinel renamed 2026-08 (pre-production window); the legacy row is renamed in place, preserving its id. Do not remove the legacy lookup until the sunset in `docs/deployment/caep-db-rename.md` — removing it early orphans pre-rename data |
| Crypto pages under `/assets` though the nav says "Coins" | Route kept to preserve deep links (T4 decision) |
| `/live-data/chart` serves synthetic OHLC | Marked `synthetic: true`; its one consumer (Compare) reads closes only. New consumers must be close-only or use `/live-data/ohlcv` |
| Macro catalogs carry no reference prices | Futures/FX quotes stale in hours; unpriced = honest dash |
| `MIN_SLEEVE_LEG_PCT` (2%) ≠ `MIN_RUNG_PCT` (1%) | Different concepts (position vs duration slice), documented in the engine |
| Sector exclusions leave index-weight exposure in the core | The catalog has no screened fund; the engine says so in a note. Silently dropping the core is the wrong "fix" |
| Legacy `risk`/`max_risk` fields still on v1 staking API | Public-contract decision (2026-07-19): additive-only, no deprecation date |
| The three TA pages offer different chart ranges | Deliberate per asset class (owner, 2026-08-08). Crypto alone has 1H/4H — it trades continuously and moves enough intraday for an hourly candle to carry signal; on a ~6.5h equity session or a yield index the same view is mostly gaps and microstructure. Macro also omits MAX: its series are continuous front-month futures stitched across rolled contracts, which read as one price history past ~5Y when they are not. Indicators and drawing tools **are** shared across all three (2026-08-08) — ranges are the exception, not the rule |
| No options chain browser beside the Trade Risk Scorer | Owner decision 2026-08-05 (P2-O1): there is NO keyless chain source — CBOE's delayed feed is prohibited by its own terms, Yahoo's options endpoint 401s. The scorer takes hand-entered legs on purpose. Do not add a chain fetch, and do not "improve" the scorer by inferring bid/ask/IV |
| `ivRank` is manual-entry only in the options scorer | No keyless source carries IV *history*. Computing it forward needs persistence and a 52-week warm-up — flagged as a product decision, not an oversight |

### Added 2026-09-08 (decisions since 2026-08-08)

| Looks like | Actually |
|------------|----------|
| No per-coin risk score anywhere — no `riskScore` field, no score column, no `/live-data/risk-scores` | **RP-6 (2026-08-29).** Owner: a risk figure on an asset the reader is viewing may be read as a recommendation, a regulated activity. The `Asset.riskScore`/`riskBand` fields were deleted rather than nulled, because a permanently-null field invites a future "N/A" that reads as *missing* rather than *withheld*. Guarded by `lib/risk/__tests__/riskScoringRemoved.test.ts`. **`lib/risk/` itself stays** — the options scorer, staking-provider risk and the macro/equity profiles are separate decisions |
| A leaderboard-shaped surface was removed but a per-asset explanation kept | **Short-list item 4 (2026-08-18): ranking vs explanation.** Ranking a universe by a score goes; scoring the one thing the reader opened stays. That is the line — do not "restore consistency" by removing the second or reinstating the first |
| `ratesCatalog` yield entries bypass `security-quotes` | **D3 (2026-09-03).** `^IRX`/`^FVX`/`^TNX`/`^TYX` read the official treasury.gov par curve via `lib/data/ratesFromCurve.ts`. A probe (`npm run rates-providers`) found no free provider quotes them: FMP 402, Finnhub empty, Twelve Data 404, Alpha Vantage empty, Tiingo has no index space. Daily readings with no intraday change are correct here, not a degradation |
| Exchange API linking absent from Wallets | **RP-5 (2026-08-18)** — see the security note above. Not an unfinished feature |
| `/transfer-fees`, `/wallets`, `/equities/backtests`, `/global-adoption`, `/backtests`, `/risk-scores` redirect away | Deliberate rollout hides and removals with distinct reasons and dates (owner, 2026-08-18 → 2026-08-22). Every site carries a comment saying exactly how to restore it. The engines, panels and tests behind the hidden ones are retained on purpose |
| StatusBar shows no market-open status | Removed 2026-09-04 (`#146`) — it was computed from the clock, not from a venue calendar, so it asserted "open" on holidays. No source, no claim |
| `pump-report` scores a target 0–10 higher-is-worse under the name `suspicionScore` | Renamed from `riskScore` 2026-09-08 (risk-scale spec Phase 6). It collided with the canonical 0–100 higher-is-SAFER scale on both range and direction, and it is not an asset risk assessment (RP-6) but a measure of fraud evidence found. A guard test pins prompt and reader to the same key |
| `pinnedFetch` is not used on the CoinGecko call sites | Deliberate (2026-09-08): pinnedFetch attaches a custom dispatcher, which removes the request from Next's fetch cache, and every CoinGecko caller depends on `next: { revalidate }` to stay inside the rate limit. Terms gate on a first-party, terms-VERIFIED host vs. multiplying the request volume that already throttles us — see `lib/api/live/coingecko.ts` |
| A relentless uptrend reports `overall: 'neutral'` in the TA signal summary | The panel working, not a bug: trend indicators say buy while mean-reversion oscillators correctly say overbought, averaging inside the ±0.5 neutral band. The buy/sell counts beside it carry the disagreement. Widening the bands would suppress the overbought half — pinned with a note in `signalSummary.test.ts` |
| `cd-staging` deploy jobs are gated on `vars.STAGING_DEPLOY_ENABLED` | Owner decision 2026-09-08. The workflow had failed ~90 pushes since 2026-07-18 on an unset `AWS_ACCOUNT_ID`, making `main`'s red X permanent and therefore meaningless. Gated on a repository variable so provisioning re-enables it with no PR |

When a review establishes a *new* deliberate decision, propose adding it to this table —
that's how it stays cheaper than re-litigating.

## Reporting conventions

- Rank findings by severity (🔴 breaks build/ships wrong data → 🟠 security/correctness →
  🟡 convention/hygiene → 🟢 info). Every finding cites file:line and states the concrete
  failure scenario, not just the rule.
- **Verify before reporting**: reproduce the claim in source by following the call path.
  A parts inventory ("the writer and the checker both exist") is not verification — the
  JWT-revocation incident is the canon.
- Respect report-vs-fix boundaries: if the review's scope is a page, report suspected
  bugs in shared engines (`lib/utils/indicators.ts`, `lib/risk/`, `backtest.ts`) rather
  than editing files other surfaces depend on.
- Distinguish "wrong" from "different venue/tier": OHLCV comes from Binance.US not
  Binance.com; trailing P/E won't match a broker's forward figure. Real divergences are
  not bugs.

## Deployable prompt

<details><summary>Ready-to-paste prompt for the code-checker agent</summary>

```
You are the Code Checker for the Finance Now repo. Read CLAUDE.md and
docs/agents/code-checker.md first — the charter is binding: its invariants are what you
enforce, and its do-not-fix registry is what you must NOT flag.

For the diff or branch under review:
1. Run the full baseline (tsc, vitest, eslint, AND `next build` — the build catches a
   class nothing else does). Judge lint by added warning instances, not totals.
2. Check the change against every invariant section: routes (export discipline,
   force-dynamic, failure-boundary SHAPE — parallelising a fallback ladder is a
   regression, not a fix), module boundaries and ModuleGate placement, data honesty
   (no fabricated values, provenance on hand-maintained tables, no fresh timestamps on
   static data), security (guards, pinned fetches, secret hygiene, ownership scoping),
   and the frontend rules (css:build, stale-time constants, numeric money).
3. Verify each finding in source by following the call path before reporting it. Cite
   file:line and the concrete failure scenario.
4. Report findings ranked by severity. Do not edit shared engines during a page-scoped
   review — report instead. Do not conclude a data source is broken from a datacenter
   environment; availability is IP-dependent and only owner-machine runs count.

If something in the do-not-fix registry seems genuinely wrong, raise it as a question
with reasoning — never change it unilaterally.
```
</details>
