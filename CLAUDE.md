# Finance Now — Multi-Asset Financial Analytics
## Claude Code Project Guide

This file is auto-loaded by Claude Code at session start. It gives instant context so you can make changes without re-exploring the codebase.

---

## What This Is

An institutional-grade financial analytics suite built with Next.js 15 (App Router). It began as a crypto dashboard (risk, reserves, news sentiment, transfer fees, staking) and has grown into an entitlement-gated module suite (see `docs/ROADMAP.md`): a **core** section (headlines, watchlist, portfolios, compare, research, brief) plus **five** optional modules — **Crypto** (the original Finance Now), **Equities** (`/equities`), **Macro Markets** (`/macro`), **ETFs & Funds** (`/funds`), and the premium **Portfolio Builder** (`/portfolio-builder`, its own entitlement). (This said "seven" while listing five; `lib/modules/registry.ts` is the count that matters — `core` plus those five.) Modules are declared in `src/lib/modules/registry.ts`; the sidebar renders from that registry, modules can be toggled in Integrations → Suite Modules, and **every optional module's pages are wrapped in `<ModuleGate>`** so a disabled module is locked by direct URL too, not just hidden from the nav. The frontend runs **live-only** against public data providers via its `/live-data/*` route handlers. User data (portfolios, tracked portfolios and their trades, watchlists, builder plans, wallets) persists to Postgres through `/api/user/*`; module entitlements are **localStorage-only** (`useEntitlementStore` — the `entitlements` table exists in the schema but no route serves it yet, which is the Phase 6 rollout-posture question); the legacy Python backend is **retired and frozen** (owner decision D2, 2026-09-14 — `backend/FROZEN.md`): nothing in the app calls it, no CI job builds it, and the `/api/*` proxy rewrite that pointed at it is gone. The claim that it "still serves assets/market-data/alerts/risk-scores" was already stale — the axios client that did so went in the M8 sweep. Sign-in is Auth.js against the app's own `users` table. Surfaces with no free real-time source show an explicit "not available" notice — there is no mock/demo data path.

**Working directory:** the repo root is the `Finance-Now` monorepo (`frontend/`, `backend/`,
`mcp-server/`, `infrastructure/`, `docs/`); **the Next.js app and all its npm commands live in
`frontend/`**. `backend/` is **frozen and not part of the build** — read `backend/FROZEN.md`
before touching anything in it. (Older docs reference a local `Crypto-Stuff\frontend` checkout path — same app,
pre-monorepo naming.)

**Agent charters:** four maintenance agents are deployed, split along two boundaries
(full table: `docs/IMPROVEMENT-AGENT-SETUP.md`). By scope: `code-checker`
(`docs/agents/` — diff/PR review against the review invariants + the do-not-fix
registry of deliberate decisions) vs `code-auditor` (`.claude/agents/` — repo-wide
dated defect reports). By kind of status write, both approval-gated:
`checklist-steward` (`docs/agents/` — maintains existing ledger entries) vs
`opportunity-scout` FILE mode (`.claude/agents/` — inserts newly approved TASK-QUEUE
items). The two TASK-QUEUE writers must read each other's outputs before writing
(`docs/audits/rejected-proposals.md` ↔ steward annotations). If you are reviewing
code or updating status docs, read the matching charter first; each ends with a
ready-to-paste deployable prompt.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS with custom CSS variables |
| Data fetching (client) | TanStack React Query v5 |
| Data fetching (server routes) | `fetch` with `next: { revalidate: N }` |
| State management | Zustand stores |
| Charts | Recharts (line/area/bar) + lightweight-charts (all candlestick surfaces) |
| Icons | Lucide React |
| Toasts | react-hot-toast |

---

## Directory Structure

```
frontend/src/
├── app/
│   ├── layout.tsx                  # Root layout — wraps everything in <Providers>
│   ├── providers.tsx               # React Query + Toaster setup
│   ├── (auth)/                     # Login page (Auth.js credentials; wall currently off), and
│   │                               #   reset-password/, which spends an owner-issued reset link
│   │                               #   (T-435; see "Password reset" under Environment Variables)
│   ├── (legal)/                    # About & Legal — PUBLIC: no sign-in gate, no sidebar (D50,
│   │                               #   2026-10-01). Outside (dashboard) on purpose: that layout
│   │                               #   renders nothing signed-out once REQUIRE_AUTH is on, and
│   │                               #   the Privacy link must work for a visitor who isn't
│   │   ├── layout.tsx              # Public shell: header + SiteFooter
│   │   └── about/page.tsx          # /about, the draft's ten sections; terms/, privacy/,
│   │                               #   not-investment-advice/ hold the full documents and
│   │                               #   open-source/ the licence list built from package-lock.json.
│   │                               #   Text: lib/legal/disclosures.ts — Draft v1, shown under a
│   │                               #   "Draft — not yet in force" notice until approved + no blanks.
│   │                               #   risk-ratings/ is the T-420 rating methodology, rendered from
│   │                               #   lib/risk/methodology/v1.ts; a 404 while ASSET_PAGE_RATINGS_SHOWN
│   │                               #   is false
│   ├── (dashboard)/                # All main pages (use Sidebar layout)
│   │   ├── layout.tsx              # Dashboard shell with Sidebar
│   │   │
│   │   │  # ── Core (always on) ──
│   │   ├── headlines/page.tsx      # Landing page — cross-module aggregate news feed
│   │   ├── videos/page.tsx
│   │   ├── brief/page.tsx          # AI Daily Brief (needs ANTHROPIC_API_KEY)
│   │   ├── watchlist/page.tsx      # Cross-module; DB-backed
│   │   ├── portfolios/page.tsx     # DB-backed what-if portfolios
│   │   ├── portfolios/tracked/page.tsx # Real trades, FIFO gains (T-027, D65)
│   │   ├── compare/page.tsx        # 2–6 stocks/funds/coins
│   │   ├── research/page.tsx       # Crypto/Equities/Macro agent runner
│   │   ├── agent-config/page.tsx   # AI Agents tab
│   │   ├── settings/page.tsx       # Integrations + Suite Modules toggles
│   │   ├── data-sources/page.tsx
│   │   │  # (no how-we-make-money/ — folded into /about on 2026-10-01 under D50;
│   │   │  #  /how-we-make-money redirects to /about#how-we-make-money, next.config.mjs)
│   │   │
│   │   │  # ── Crypto module (all gated by <ModuleGate module="crypto">) ──
│   │   ├── assets/page.tsx         # Coin Registry ("Coins" nav; route kept /assets) — live prices
│   │   ├── assets/[id]/page.tsx    # Coin detail
│   │   ├── news/page.tsx           # Per-coin news feed with sentiment
│   │   ├── social/page.tsx
│   │   ├── wallets/page.tsx
│   │   ├── transfer-fees/page.tsx  # Transfer Fee Calculator
│   │   ├── staking/page.tsx        # Staking Opportunities
│   │   │  # (no staking-discovery/ — merged into staking/ as ?tab=pools, 2026-08-20;
│   │   │  #  /staking-discovery redirects, next.config.mjs)
│   │   ├── coin-discovery/page.tsx
│   │   ├── technical-analysis/page.tsx
│   │   ├── scanner/page.tsx        # Crypto Scanner — the setup detectors closing prices can feed
│   │                               #   (SETUPS_FROM_CLOSES, T-423), over the universe
│   │   ├── pump-report/page.tsx    # Promoted from a /wallets tab 2026-08-22; carries its own
│   │   │                           #   address entry so it survives that page being hidden.
│   │   │                           #   In the Feature Inventory since then, in this tree
│   │   │                           #   only since 2026-09-22
│   │   │  # (no reserves/ — folded into assets/ as ?tab=reserves, 2026-07-29)
│   │   │
│   │   │  # ── Optional modules (each gated by its own <ModuleGate>) ──
│   │   ├── equities/               # EQUITIES MODULE — registry, [symbol], news, social, TA,
│   │   │                           #   scanner (setups + AI outlier scan), backtests, calendar
│   │   ├── macro/                  # MACRO MODULE — overview, news, commodities, currencies,
│   │   │                           #   rates (+ [slug] detail), TA, scanner
│   │   ├── funds/                  # FUNDS MODULE — ETF/mutual fund registry + [symbol] detail
│   │   ├── portfolio-builder/      # PREMIUM module — own entitlement
│   │   └── global-adoption/        # EMPTY — page DELETED 2026-09-14 (D10) with
│   │                               #   /live-data/cbdc-data. The /global-adoption →
│   │                               #   /headlines redirect remains (next.config.mjs:52),
│   │                               #   so bookmarks land. This row said "page
│   │                               #   retained" until 2026-09-22; what is actually
│   │                               #   retained is an empty directory, nothing else.
│   └── live-data/                  # Server-side API proxy routes (no API keys exposed) — 61 routes
│       ├── markets/route.ts        # CoinGecko price data
│       ├── news/route.ts           # Multi-provider crypto news (RSS + JSON feeds)
│       ├── social/route.ts         # Social sentiment data
│       ├── reserves/route.ts       # Reserve data
│       ├── alerts/route.ts
│       ├── chart/route.ts
│       ├── config/route.ts
│       ├── network-fees/route.ts   # Live BTC (mempool.space) + live EVM-L1 gas (eth_gasPrice,
│       │                           #   keyless publicnode) for ETH/BNB/Polygon/AVAX; L2s stay
│       │                           #   estimates — eth_gasPrice omits their L1 data fee
│       ├── withdraw-fees/route.ts  # Live exchange withdrawal fees (KuCoin/HTX keyless; Bybit probed 403 — authed) — overlay-only, per-row live tags;
│       │                           #   also deposit status where a feed publishes it (D66, T-054)
│       ├── staking-rates/route.ts  # HTTP face of lib/server/stakingRates.ts — the collector moved
│       │                           #   there 2026-09-18 (landed in 516220f, 2026-09-19) so that
│       │                           #   /api/v1/staking/opportunities reads the SAME one. Live APR
│       │                           #   from 6 upstreams onto 48 keys; the rest stay
│       │                           #   static estimates. Returns `upstreams` — each one's
│       │                           #   outcome — because "4/51 live" cannot say WHICH failed.
│       │                           #   Was 17: ten rungs went in the 2026-09-09 audit — nine
│       │                           #   dead, whose DNS hangs were starving the rest, plus NEAR,
│       │                           #   whose endpoint is healthy but carries no yield at all.
│       │                           #   Stride went 2026-10-14 with its three keys: it is
│       │                           #   winding down, liquid staking closed (catalog: defunct)
│       ├── security-quotes/route.ts # Stock/ETF/fund quotes (FMP→…→Alpha Vantage→reference; ALL KEYED)
│       ├── security-chart/route.ts  # Price history (Tiingo→FMP→Twelve Data; all keyed)
│       ├── security-ohlcv/route.ts  # Full OHLCV candles (Tiingo→FMP; both keyed)
│       ├── source-terms/route.ts    # Terms registry + live robots/terms probe
│       ├── market-news/route.ts     # Stock-market RSS news: sentiment, category, ticker tags
│       ├── stock-social/route.ts    # Reddit finance subs + StockTwits sentiment
│       ├── sec-filings/route.ts     # SEC EDGAR filings feed (ticker→CIK→submissions; tabbed 10-K/10-Q/8-K on equity detail)
│       ├── company-facts/route.ts   # SEC EDGAR XBRL fundamentals → financial ratios + annual trend on equity detail
│       ├── company-profile/route.ts # SEC EDGAR registrant metadata (SIC, HQ, incorporation) + Wikipedia summary
│       ├── coin-rating/route.ts     # T-420 measured-risk rating, one catalog coin (CoinGecko daily chart, day-cached)
│       ├── stock-rating/route.ts    # T-420 measured-risk rating, one catalog stock (reads security-ohlcv + company-facts;
│       │                            #   never cached, Tiingo §1.6(a)). ⚠ BOTH HIDDEN: while ASSET_PAGE_RATINGS_SHOWN
│       │                            #   (lib/risk/visibility.ts) is false they answer only on localhost / FN_ADMIN_TOKEN.
│       │                            #   Weekly readings need migration 0007 (`npm run db:migrate`)
│       ├── stock-universe/route.ts  # Stock Registry universe — FMP stock-screener (daily-cached) w/ curated fallback; ?symbol= single lookup
│       ├── stock-outliers/route.ts  # Sector-relative z-score outliers over the universe (cheap/expensive/highYield/high-lowBeta) — backs the Equity Screener agent
│       ├── fund-holdings/route.ts   # Full ETF/fund portfolio: SEC N-PORT direct (keyless, authoritative) → FMP → catalog.
│                                   #   Also derives the stock/bond/cash asset mix from N-PORT assetCat (NT9)
│       ├── fund-holdings-history/route.ts # Quarter-over-quarter holdings diff from N-PORT filings (EDGAR direct; FMP fallback)
│       ├── fund-prospectus/route.ts # T-420 item 2: the share class's summary prospectus (497K) filed with its latest
│                                   #   annual 485BPOS, else that 485BPOS; keyless EDGAR. Not the newest 497K: that can
│                                   #   be a supplement (FXAIX, 2025-11-10). SPY/GLD file neither, and get no link
│                                   #   (lib/server/fundProspectus.ts)
│       ├── security-returns/route.ts # Trailing 1M/3M/YTD/1Y returns (Tiingo, per symbol, capped at 60; whole-universe requests refused)
│       ├── fx-rates/route.ts        # Daily ECB reference FX (frankfurter.dev, keyless) — Macro currency converter, official tier
│       ├── fx-rates-extended/route.ts # +126 more currencies (community currency-api, keyless) — converter's
│                                   #   labeled extended tier. Said 127 until 2026-09-22; it has been 126
│                                   #   since 'bgn' was removed 2026-07-22 (Bulgaria adopted the euro)
│       ├── treasury-yield-curve/route.ts # Official 13-maturity daily par curve (treasury.gov XML, keyless) + spreads/shape
│       ├── macro-news/route.ts     # 4 keyless RSS feeds + content-first pillar classifier
│                                   #   (was 8 — marketwatch-macro removed 2026-09-20 and
│                                   #   Investing.com's three 2026-10-17, D133, both ON TERMS)
│       ├── staking-discovery/route.ts, coin-discovery/route.ts
│       ├── coin-profile/route.ts    # CoinMarketCap → keyless CoinGecko ladder; backs the
│       │                            #   "About this project" panel on /coin-discovery
│       ├── futures-curve/route.ts   # Resolves contract months, then answers ok:false with the
│       │                            #   reason — nothing reachable quotes a dated contract
│       ├── global/route.ts          # CoinGecko /global aggregates (keyless) — BTC/ETH dominance
│       │                            #   for the Cycle Context tab
│       ├── portfolio-prices/route.ts, portfolio-history/route.ts
│       ├── wallet/                 # On-chain balances + exchange connections
│       ├── pump-report/            # Pump-report scan + chat (own agent loop)
│       ├── videos/, video-search/, video-analyze/
│       ├── market-calendar/route.ts, fund-universe/route.ts, coin-list/, coin-search/
│       └── btc-stats/, defi-tvl/, fear-greed/, funding-rates/, ohlcv/, assets/
│                                   #   (first three now feed the crypto TA Market Structure panel — NT11)
│                                   #   (funding-rates has NO source since 2026-09-30 — OKX withdrawn on
│                                   #    terms, D40; it answers ok:false with the reason)
│                                   #   (no cbdc-data/ — route cut 2026-09-14 (D10) along with
│                                   #    /global-adoption; the page redirect remains)
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             # Renders from module registry (see lib/modules)
│   │   ├── ModuleGate.tsx          # Wraps module pages; locks when module disabled
│   │   ├── TopBar.tsx
│   │   ├── StatusBar.tsx
│   │   ├── DataStatusBanner.tsx
│   │   └── SiteFooter.tsx          # Not-advice line + About · Terms · Privacy · Not investment
│   │                               #   advice. In all three layouts — a test fails if one drops it
│   ├── legal/                      # About & Legal rendering: LegalDocumentView, DraftNotice…;
│   │                               #   FeatureNotice, the short not-advice line beside a feature;
│   │                               #   RatingMethodology, the /about/risk-ratings content (T-420)
│   ├── ui/                         # Generic reusable components (incl. SourceLine, ProvenanceNotice)
│   ├── charts/                     # Recharts wrappers + CandlestickChart/indicatorRegistry (shared TA engine)
│   ├── markets/                    # Shared equities/funds UI (PriceChartCard, MarketNewsList) and
│   │                               #   AgentScanPanel — the AI scan button on the Equity and Macro
│   │                               #   scanners; scans are listed in agentScans.ts. AssetRatingPanel is
│   │                               #   the T-420 rating card on coin and stock pages: it renders and
│   │                               #   fetches nothing while ASSET_PAGE_RATINGS_SHOWN is false
│   ├── agents/                     # AssistantWidget + agent chat UI
│   ├── portfolio-builder/          # PlanMonitor and questionnaire UI
│   ├── pump-report/                # PumpReportTab (used by /pump-report)
│   ├── assets/
│   ├── analytics/                  # Reserve UI (reserves.tsx) + standalone charts
│   │   └── technical/              # The 9 TA panels extracted from technical-analysis/page.tsx
│   │                               #   (BacktestPanel, KeyLevelsPanel, MarketStructurePanel,
│   │                               #   MultiTimeframeGrid, PatternsPanel, SignalSummaryPanel,
│   │                               #   SupportResistancePanel, TechnicalReadPanel,
│   │                               #   ThesisBuilderPanel). The crypto TA page composes these
│   │                               #   rather than inlining them — same rule as reserves.tsx:
│   │                               #   a panel with two copies gets fixed in only one
│   ├── dashboard/                  # EMPTY — the 6 M8-sweep widgets went first, RiskHeatmap
│                                   #   followed on 2026-08-18 with the item 4 ranking cut
│   └── alerts/                     # LiveAlertRow only (TopBar bell)
│
├── lib/
│   ├── constants.ts                # App-wide constants, stale times, API URLs
│   ├── modules/
│   │   └── registry.ts             # ← SUITE MODULE REGISTRY — nav + entitlements live here
│   ├── risk/                       # Unified risk framework (pure TS, vitest-tested)
│   │   │                           #   see docs/architecture/risk-framework.md
│   │   ├── engine.ts               # composeRisk() — profile-agnostic scoring
│   │   ├── normalize.ts            # piecewise/linear normalizers, vol, drawdown
│   │   └── profiles/               # 7: commodity, cryptoAsset, currency, equity,
│   │                               #   optionsTrade, rateInstrument, stablecoin
│   │                               #   (macro three added by P2-R3; stakingAdapter
│   │                               #   was the 8th until D26 deleted it, 2026-09-25)
│   ├── auth/                       # Auth.js config + getCurrentUserId()/requireUserId()
│   ├── legal/                      # disclosures.ts — the public documents' text (Draft v1 of
│   │                               #   the owner's disclosure set, copied as written); inline.ts
│   │                               #   (bold, links, [BLANKS]); openSource.ts (lockfile → licences);
│   │                               #   featureNotices.ts (the short not-advice lines beside features, T-293)
│   ├── db/                         # Drizzle schema + client (users, entitlements, instruments,
│                                   #   user_wallets…)
│   ├── data/                       # Static/semi-static data files (no API calls)
│   │   ├── transferFees.ts         # 30 exchanges × 22 coins × 18 networks (+ provenance)
│   │   ├── stakingProviders.ts     # 55 staking providers — terms, lock-ups, reference APRs (+ provenance)
│   │   ├── equityCatalog.ts        # 79 large-cap stocks, 11 sectors, reference data
│   │   ├── fundCatalog.ts          # 140 ETFs/mutual funds + computeFeeDrag()
│   │   ├── commodityCatalog.ts     # 19 front-month contracts, 5 categories
│   │   ├── currencyCatalog.ts      # 17 FX pairs + DXY
│   │   ├── ratesCatalog.ts         # 4 CBOE yield indices + 4 CBOT futures
│   │   ├── instruments.ts          # Unified instrument layer across all classes
│   │   ├── stablecoinMeta.ts       # Curated issuer metadata (+ provenance)
│   │   ├── fomcCalendar.ts         # FOMC meeting dates from the Fed Board's calendar (+ provenance)
│   │   ├── portfolioBuilder.ts     # Portfolio Builder engine (pure TS, vitest-tested)
│   │   ├── lookThrough.ts          # Fund look-through + pairwise overlap (pure TS, vitest-tested)
│   │   ├── taxCharacter.ts         # Tax CHARACTER of a transfer route — what kind of event each
│   │   │                           #   leg is (settled/recently-changed/unsettled + authority).
│   │   │                           #   Computes nothing; tests forbid rates/$ figures in the copy
│   │   └── assetCatalog.ts         # Coin reference metadata
│   ├── agents/                     # Agent runner, prompts, tools
│   ├── server/                     # Server-only helpers (apiGuard, edgar, secFundamentals, customFeeds…)
│   │   ├── sourceTerms.ts          # ← SOURCE TERMS REGISTRY — may we use this website?
│   │   └── termsProbe.ts           #   robots.txt + terms probe for unreviewed hosts
│   ├── api/                        # API client functions
│   │   └── live/                   # Live data fetchers (CoinGecko, DefiLlama, marketData.ts, providers.ts)
│   ├── utils/
│   └── feed/                       # useFeedStatus — derives app-wide feed health
│                                   #   from React Query's cache (replaced lib/websocket/,
│                                   #   whose shim reported 'connected' unconditionally)
│
├── store/                          # Zustand stores
│   ├── useEntitlementStore.ts      # Which suite modules are enabled
│   ├── useWatchlistStore.ts        # DB-backed, optimistic
│   ├── usePortfolioStore.ts        # DB-backed, optimistic
│   ├── useAlertStore.ts, usePriceAlertStore.ts
│   ├── useAssetStore.ts, useCoinDiscoveryStore.ts
│   ├── useWalletStore.ts           # DB-backed (NT3) — watched addresses + browser
│   │                               #   connections via /api/user/wallets
│   ├── useThesisStore.ts, useFeedBiasStore.ts
│   ├── usePopoutStore.ts, useTierStore.ts, useRefreshStore.ts
│   └── useFeedStore.ts             # FeedStatus: connecting | live | degraded | offline.
│                                   #   Replaced useStreamStore, whose websocket vocabulary
│                                   #   (heartbeat, channels, stream errors) was all dead
│                                   # NOTE: no auth store — session comes from
│                                   # next-auth/react's useSession()
│
└── types/                          # Shared TypeScript types
```

### Module boundary rules (keep these or the suite can't be split later)
1. A module's pages import shared code only from `components/ui`, `components/charts`, `components/markets`, `lib/` core, and its own folders — never another module's internals.
2. Cross-module data flows through `/live-data` or `/api/v1` routes, never direct page imports.
3. New module = new entry in `lib/modules/registry.ts` + pages wrapped in `<ModuleGate module="...">`.

---

## How Changes Land

**Branch and PR by default** (owner, 2026-08-22). Work goes on a feature branch
and lands through a draft pull request — not straight onto `main`.

The reason is review, not ceremony. A run of changes went directly to `main`
during P3-W3, including two that altered what ships in the initial rollout
(hiding Transfer Fees and Wallets). Those are exactly the changes that deserve a
diff someone can read before they land, and a commit message is not a substitute
for one: it explains what the author *meant*, not what the patch *does*.

Direct-to-`main` is for when the owner asks for it in the moment, and it stays
the exception.

**History and archives.** `main` was re-rooted on 2026-08-05: its root commit is a
full-tree snapshot of PR #71, and nothing before it — PRs #1–#70, ~354 commits back to
the 2026-05-24 scaffold — is reachable from `main`. That history is preserved on the
`archive/pre-reset*` branches (anchor: `archive/pre-reset-main`, 264 commits, plus 13
`archive/pre-reset/*` tips holding commits the anchor lacks; created 2026-08-24 — see
`docs/audits/git-repo-audit-2026-08-23.md`, PR #110). Any "recoverable from git history"
claim about a deletion made **before 2026-08-05** resolves there, not in `main`'s log —
`git log`, `--follow`, and blame all stop at the re-root unless those branches are
fetched. `archive/wave-two-pre-reset` is the same pattern for the wave-2 rollback of
2026-08-15. Keep every `archive/*` branch through any stale-branch cleanup.

**Retiring a branch means tagging it, not deleting it** (2026-09-11). The remote went
from 100 branches to 24 by turning every retired branch into an annotated
`archive/<branch-name>` **tag** and then deleting the branch — `git tag -l 'archive/*'`
is the inventory, `git checkout -b <name> archive/<name>` is the restore, and
`git show archive/<name>` prints why and when it was retired. Tags were chosen over
more `archive/*` **branches** because the branch-list length was the problem being
solved; the repo had zero tags before this, so that namespace is exactly this and
nothing else. **54 of the 78 were squash-merged**, meaning their commits are
unreachable from `main` and `git branch --merged` will call them unmerged forever —
which is why the rule is one rule, applied without checking whether a branch "looks"
merged. Tag, verify the tag is on the remote, *then* delete. Record:
`docs/audits/branch-archive-2026-09-11.md`. The 15 `archive/*` branches were not
converted and stay as branches.

⚠ **The tags rescued nothing, and the record says so.** Measured after the sweep:
**0 of the 78** were the only ref preserving their commits — 71 were already held by
a GitHub PR ref (`refs/pull/N/head`, which **survives** head-branch deletion) and 7
by an `archive/*` branch. The first draft of those tag messages claimed the opposite
for 54 branches; all 78 were rewritten to name what else holds them. The tags are
still worth keeping — they are the only **inventory** (a PR ref needs a number nobody
remembers), they carry provenance, and `git fetch --tags` brings them while PR refs
are not fetched by default. It also means enabling *Automatically delete head
branches* is safe and creates no exception to the rule: the tag only earns its keep
for a branch that never had a PR. **The first one is `archive/local-wip-s1` (2026-10-14,
T-017):** a WIP commit from 2026-08-19 that lived only in the owner's local clone, which
cloud sessions cannot see, so three ledger passes had taken it for gone. Record:
`docs/audits/local-wip-s1-archive-2026-10-14.md`. A mirror clone outside OneDrive is now a
second copy that is not GitHub (T-238); refresh it without `--prune`. Since 2026-10-15 (D121)
it keeps every ref log and object, so a ref force-moved on GitHub cannot strip old commits from
it, and a Windows scheduled task refreshes it monthly. Neither setting deletes anything.

**Do NOT enable *Automatically delete head branches* — archive instead** (owner,
2026-09-12: *"I dont want to delete any branches, if possible can we enable an auto
archive feature"*). This reverses the recommendation in the paragraph above, which was
argued on safety (deletion loses nothing) and not on preference. Safe and wanted are
different questions, and the second one is the owner's.

`.github/workflows/archive-branch.yml` is the auto-archive. On every **merged** PR it
creates the annotated `archive/<branch>` tag and **leaves the branch alone**; the tag
message says so in as many words, since the tag is what a future reader finds. It also
takes a `workflow_dispatch` branch name, which is the only way to archive a branch that
never had a PR — the case where a tag is the sole preservation. Behaviour worth knowing
before editing it:

- It **never overwrites** an existing tag. A reused branch name archives as
  `archive/<branch>@<short-sha>`, because clobbering would destroy the record of the
  earlier work rather than add to it.
- It **warns rather than fails**. The merge has already happened by the time it runs, so
  a red X would report failure on landed work and fix nothing. That makes a regression
  **silent**, which is why `lib/server/__tests__/archiveBranchWorkflow.test.ts` extracts
  the script from the YAML and executes it against a mocked API instead of eyeballing it.
- It uses `pull_request_target` because a fork PR gets a **read-only** token under
  `pull_request` and tag creation would fail. That trigger is only safe while no
  untrusted code is checked out or run — there is no `actions/checkout` step, and a test
  fails if one appears. **Do not add one.**

**STANDING RULE — no automated deletion of project files, anywhere** (owner, 2026-09-12:
*"I will not enable or authorize any auto delete functions for any project files related
to the build"*). This is broader than the branch question above and it is not a
preference to be traded off against tidiness:

- **No GitHub setting that deletes.** *Automatically delete head branches* stays OFF.
- **No workflow, script, hook or npm script that removes a tracked file**, including
  "clean", "reset", "prune" and "stale X" helpers, however well scoped.
- **Archiving is the substitute, and it never deletes.** `archive-branch.yml` creates a
  tag and leaves the branch; it contains zero deletion calls.
- If a task seems to need deletion, it needs the owner in the loop instead. Propose it;
  do not build it and gate it behind a flag.

**Audited when the rule was set, so "nothing violates this" is measured, not assumed.**
The whole repo contains exactly **two** deletion operations, and neither touches a
project file:

| Where | What | Why it is not a violation |
|---|---|---|
| `frontend/restart-dev.ps1:56` | `Remove-Item -Recurse -Force $buildDir` (`.next`, by full path) | Next.js **build output**, gitignored and regenerated on every build. It is also the documented fix for the OneDrive lock that kills the dev server mid-session. Deleting it loses nothing. Was line 11, a relative `".next"`, until 2026-10-14; the root `restart-dev.ps1` now runs this file and holds no deletion of its own (`restartScript.test.ts`) |
| `lib/api/__tests__/providerStatus.test.ts:31` | `rmSync(dir, …)` | Removes only the `mkdtempSync` directory that same test created, in teardown |

No CI/CD workflow has a delete, prune or cleanup step; no `package.json` script does
either. **The line is regenerable build output vs. anything tracked in git** — `.next`
is fine, a tracked file never is. Re-run the audit before adding any deletion:

```bash
grep -rnE 'rm -rf|Remove-Item|rmSync|unlinkSync|rimraf' -r . | grep -v -e node_modules -e '\.claude/'
grep -rniE 'delete|prune|cleanup' .github/workflows/
```

⚠ **`grep` does not exist in PowerShell, and this repo is maintained from PowerShell.**
An audit that enforces a standing rule has to run in the shell of the person enforcing
it, or it is a control on paper. The equivalent, verified 2026-09-20 to return the same
two benign hits plus `package-lock` dependency metadata, and re-run 2026-10-14
(`restart-dev.ps1:56`, `providerStatus.test.ts:2` and `:31`, its import and its call):

```powershell
Get-ChildItem -Recurse -File -Include *.ts,*.tsx,*.mjs,*.js,*.ps1,*.json,*.yml |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.next\\|\\coverage\\|\\\.claude\\' } |
  Select-String -Pattern 'rm -rf|Remove-Item|rmSync|unlinkSync|rimraf'
Select-String -Path .github/workflows/*.yml -Pattern 'delete|prune|cleanup'
```

`.claude\` is left out because it is gitignored and not the project: an old agent worktree
under `.claude\worktrees\` keeps a copy of the pre-fix restart script, and the audit is about
files tracked in git.

**Standing rule:** any history-shaping operation — force-pushing or re-rooting a branch,
deleting branches, archiving a workstream — lands **together with a dated note in
`docs/`** saying what was done and where the prior state lives. A reset nobody writes
down silently breaks every recoverability claim written before it; the 2026-08-05
re-root went unrecorded for 19 days and did exactly that.

---

## Adding a New Page — Checklist

1. **Create the page:** `src/app/(dashboard)/your-page/page.tsx`
   - Add `'use client'` at top if it uses React hooks
   - Server components are fine for static content

2. **Add to sidebar:** `src/lib/modules/registry.ts` (NOT Sidebar.tsx — it renders from the registry)
   - Import the icon from `lucide-react`
   - Add entry to the owning module's `navItems`: `{ href: '/your-page', label: 'Label', icon: IconName }`
   - To nest it under an existing entry, add it to that entry's `children` array instead
     (**one level only**; the parent must still route somewhere, since its label is a link).
     `lib/modules/__tests__/registry.test.ts` fails on a nav href with no `page.tsx`, a
     duplicate href, or a third level of nesting
   - If the page belongs to an optional module, also add its route prefix to that module's `routePrefixes` and wrap the page in `<ModuleGate module="...">`
   - **Wrap at the component boundary, not inside the page's JSX.** `export default function Page() { return <ModuleGate module="x"><PageInner /></ModuleGate> }` — so a disabled module never mounts `PageInner` and its queries never fire. Wrapping the returned JSX instead renders the lock notice while still fetching everything behind it

3. **If you need a live data API route:** `src/app/live-data/your-route/route.ts`
   - **If it fetches a host the app doesn't already use, read that site's terms first** and
     add an entry to `lib/server/sourceTerms.ts` + `lib/data/dataSources.ts`. The test suite
     fails on an unregistered host — see "Source Terms" below
   - Always add `export const dynamic = 'force-dynamic'` (prevents static caching)
   - Use `next: { revalidate: N }` on individual `fetch()` calls (N in seconds)
   - Return `NextResponse.json(...)` with a typed interface exported from the route
   - Every multi-fetch needs a **failure boundary that preserves partial results** — never let one upstream
     failure crash the route. `Promise.allSettled` when the fetches are genuinely independent; per-leg
     try/catch when they are a sequential fallback ladder (see the pattern note below — parallelising a
     ladder is a regression, not a fix)

4. **If you need static data:** `src/lib/data/your-data.ts`
   - Export typed interfaces, constants, and helper functions
   - No API calls in this layer — pure data

---

## Live Data Architecture

All external API calls happen in **server-side route handlers** (`/live-data/*`), never from client components. This keeps API keys off the client and lets Next.js cache responses. Every host also has to clear the **source-terms registry** before it is fetched — see "Source Terms" below.

```
Client component
  → useQuery('/live-data/foo')         # React Query, runs in browser
    → src/app/live-data/foo/route.ts   # Next.js route handler, runs on server
      → External APIs (CoinGecko, mempool.space, Lido, etc.)
```

### Key external APIs used (no auth keys required):
| API | Used for | Route |
|-----|----------|-------|
| `api.coingecko.com/api/v3/simple/price` | Coin prices (16 coins) | `network-fees`, `staking-rates` |
| `mempool.space/api/v1/fees/recommended` | Live BTC sat/vByte fee | `network-fees` |
| `eth-api.lido.fi/v1/protocol/steth/apr/sma` | Live stETH APR | `staking-rates` |
| `api.marinade.finance/msol/apy/1y` | Live mSOL APY | `staking-rates` |
| `kobe.mainnet.jito.network/api/v1/apy` | Live jitoSOL APY | `staking-rates` |
| Various RSS/JSON feeds | News articles | `news` |

> ⚠ **Binance and Binance.US are out of the crypto data (T-423, D102, D103; done 2026-10-13).**
> Binance.US licenses its data "personal to you" with no route to public use, and Binance.com's
> terms could not be read. The price backup (`/live-data/markets`, now CoinGecko → CoinMarketCap)
> and the coin list's order (now market-cap rank) came off them on 2026-10-12, and Binance went
> from Integrations. **`/live-data/ohlcv` followed on 2026-10-13**, once DefiLlama's closing
> prices (below) covered what CoinGecko's free service cannot, measured 2026-10-12: it refuses
> history older than 365 days, sends 4-day candles for any window over 30 days, and allows fewer
> than 10 calls a minute against a scanner sweep of about 160. Nothing in the app fetches a
> Binance host now; `ohlcvRoute.test.ts` fails if the chart route calls one, for any range or a
> stale `source=binance`, which is served like `auto`. The registry keeps both entries as the
> record of their verdicts. The hidden Backtest tab's `BT` range asks for candles past 365 days
> and so has no source on the free tier; `BacktestPanel.tsx` says what restoring it needs. The route's
> `granularity` is measured from the candles (`lib/utils/candleGranularity.ts`), never typed per
> range; the scanner, the multi-timeframe grid and the Coins screener leave out, and count, a coin
> whose candles are not the size they asked for.
>
> **Charts launch on CoinGecko's candles and DefiLlama's closing prices (D103, 2026-10-13).**
> Owner: *"Lets use the other two options; remember anything we do pre launch is considered
> personal use"*, so no licence is pursued first and the Kraken letter stays unsent.
> DefiLlama's price API (`coins.llama.fi`) has no key, 15-minute to weekly spacing and history
> back to each coin's listing, but **one price per interval: no high, low or volume**. So
> `/live-data/ohlcv` serves it **only to a caller that sends `closes=1`**, marked `bars: 'close'`
> (real candles are `bars: 'ohlc'`), and serves CoinGecko's candles to everyone else. Only a
> caller that reads nothing but closes may send it: the Coins screener's sweep (78 of 80 coins
> daily, against 39 before) and Cycle Context's Pi Cycle. **The assistant's `get_price_history`**
> asks for candles and reads closes only when the candle request fails (past 365 days, or a
> CoinGecko refusal); its summary then reports `highestClose`/`lowestClose` instead of
> `periodHigh`/`periodLow`, says the prices are closes, and carries why candles were not used
> (`priceHistoryTool.test.ts`). It keeps CoinGecko's 4-day candles where they come, since their
> highs and lows are still the period's real extremes. **The two crypto charts** (the TA page and the coin page) ask for candles first and
> switch to closing prices only where the candles are missing or 4-day ones, through
> `hooks/useCryptoChartSeries.ts`; on closes they draw a line, offer only the indicators that
> read closes alone (`indicatorsFor(false, false)`, flags **measured** by
> `indicatorInputs.test.ts`), withhold the signal summary, patterns, support/resistance and key
> levels, and say so (`ClosingPricesNotice`). **The Crypto Scanner and the multi-timeframe grid**
> read closing prices for every coin and timeframe, since CoinGecko alone could not carry their
> sweeps at launch; they run only the setups and signal votes that read a close
> (`detectSetups(…, 'close')`, `computeSignalSummary(…, 'close')`, flags **measured** by
> `setupInputs.test.ts` and `signalSummaryInputs.test.ts`) and name what they leave out.
> **Do not add `closes=1` anywhere else** that reads a high, a low or a volume: fed one price as
> a candle, each computes a zero range without complaint. `closesReaders.test.ts` fails on any
> file asking for closes (`closes=1`, or `source=defillama`, which reaches the same prices) that
> it does not list, and `ohlcvRoute.test.ts` fails if a candle request ever reaches DefiLlama.
>
> **Coin Metrics backs DefiLlama up for daily and weekly closes (T-434, D108, 2026-10-14).**
> DefiLlama was the only source of crypto history past 365 days, the single-vendor state D21
> rules out. Coin Metrics' Community API (keyless, one daily price per coin back to its start)
> now answers a closes request on a daily or weekly range when DefiLlama does not, for the coins
> on a hand-kept map (`COINMETRICS_ASSETS`, `lib/api/live/coinMetrics.ts`: each checked against
> DefiLlama's prices, never matched by symbol), and never a candle request or an intraday range.
> A series more than 4 days old is not served, since some stop updating while still answering.
> Its licence is CC BY-NC 4.0, which asks for a credit: the route sends it as `attributions`
> only on responses Coin Metrics served (the owner's choice), and every closes reader shows it
> (`RequiredCredits`, which also links the licence). `closesCredits.test.ts` fails on a closes
> reader that drops it, including the Coins screener's cached sweep, which keeps the credits
> inside its query result because a cache hit runs no callback.

### React Query patterns on the client:
```typescript
const { data } = useQuery({
  queryKey: ['unique-key'],
  queryFn: () => fetch('/live-data/your-route').then(r => r.json()),
  staleTime: 1000 * 60 * 5,       // don't refetch for 5 minutes
  refetchInterval: 1000 * 60 * 10, // background refresh every 10 minutes
})
```

---

## Data Files Reference

> **Every hand-maintained table must carry provenance.** Curated reference data
> presented next to live data reads as live, and three separate audit findings
> (H2, M5, L2) were the same bug: a static snapshot shown with no age, or worse,
> stamped with a fresh `updatedAt`. The established pattern — copy it — is a
> `*_LAST_VERIFIED` date, a `*_STALE_AFTER_DAYS` window, `…AgeDays(now)` /
> `…IsStale(now)` with an **injectable `now`** so it's testable, and a
> `get…Provenance()` returning `{ source, verifiedAt, ageDays, stale, confidence }`.
> Render it with `<ProvenanceNotice>` (components/ui) — **always visible, not only
> when stale**, since a notice that only appears past a threshold teaches readers
> to treat its absence as "live". Reference implementations: `transferFees.ts`,
> `stablecoinMeta.ts`, `stakingProviders.ts`.
>
> Date the table by when it was **compiled as a whole**, never by its most recent
> partial edit — re-verifying 8 rows of 55 does not refresh the other 47.
>
> **`npm run staleness:check` reports which windows are about to close**, and runs in CI
> beside `docs:check`. It exists because the rule above has a blind spot: all this
> machinery tells a *reader* the data is old, and nothing told a *maintainer* a clock was
> about to fire. Measured 2026-09-20: `transferFees` was **355 days past** its window with
> a green repo, and the staking catalog's was caught 7 days out only because someone
> happened to read the file.
>
> ⚠ **It does not fail on "stale" — it fails on staleness nobody decided on.** Going red
> the day a window closes would offer whoever is on shift a four-second fix (bump the
> date), which is the fabricated freshness this whole section exists to prevent. Letting a
> notice fire is often the right call; it just has to be *chosen*. Record it with a
> `// STALENESS-ACK: <date> — <why>` comment in the contiguous comment block above the
> anchor constant. An ack dated before its anchor is void, so it cannot be inherited when
> the table is re-compiled.
>
> Clocks are **discovered**, never listed — zero found, an unresolvable anchor, or an
> ambiguous one each exit 1 rather than reporting a clean sweep of nothing. Seven exist
> as of 2026-09-20; run it rather than trusting that number.
>
> To see what a clock will do *before* it does it:
> `npm run staleness:check -- --now=2026-09-28`. The flag is the documented form rather
> than the `STALENESS_NOW` env var because a `VAR=x cmd` prefix is POSIX-only and this
> repo is maintained from PowerShell; the env var is kept for CI, which is Linux.
>
> **Two live acknowledgements**, both worth reading before adding a third:
> `transferFees` (stale, held out of rollout, nothing published — verified, not assumed)
> and `stakingProviders` (owner, 2026-09-20: let the 2026-09-27 notice fire rather than
> rush 330 editorial risk judgments to beat a date).
>
> ⚠ **Not every clock is a disclosure clock.** `stakingRates.ts`'s 14-day
> `FALLBACK_STALE_AFTER_DAYS` **withholds** the rate (`delete rates[key]` → a dash);
> the `*_LAST_VERIFIED` windows only change what a notice says. Do not unify them.
>
> **`npm run queue:check` does for the task-queue ledger what `docs:check` does for this
> file** (added 2026-09-23, runs in CI beside both). `docs/audits/task-queue-2026-09-07.json`
> describes itself — header counts, closure blocks, blockers — and three times in one month
> that description was false while every guard stayed green: a closure review verified 62
> items and never wrote; a decision pass nulled two blockers and left them `blocked`; sixteen
> terms items described readings finished days earlier. Thirteen checks in
> `scripts/lib/queueLedgerChecks.mjs`; it **fails** only on facts the ledger states about
> itself that are false, and **warns** where a human must judge (a blocker citing a now-closed
> item may be half-satisfied; an open item naming a verified host may want more than the
> entry has — T-243 does). Every parked item carries `parked_on`, the date it was parked, and
> C13 warns on one without it (D85, 2026-10-05). Every check is driven red by a named mutation in
> `lib/server/__tests__/queueLedgerCheck.test.ts`, because a guard only ever seen green
> proves nothing. `node scripts/check-queue-ledger.mjs --html <out>` also renders the ledger
> as a page — the published Finance Now Ledger artifact is that output, never hand-edited.
> **The page carries a shared workspace (2026-09-27)**: uploads, progress notes and
> "confirm complete" live in the artifact's own runtime storage (`db` collections `docs` and
> `log`, plus `assets`), not in the HTML, so regenerating never touches them. Publish with
> `WORKSPACE_CAPABILITIES` from `scripts/lib/ledgerWorkspace.mjs` — its db rule raises writes
> to `admin` (Editor, Owner, project members: the level that also gets `assets`); reads stay
> open to everyone the page is shared with, so every upload is readable by all of them,
> including signed-in visitors arriving by link while link sharing is on (they hold `view`).
> Sharing is the owner's setting. A confirmation there is a request, not a closure: read `log`
> with the artifact data tool and apply it to the JSON by PR. Every decision and every write
> is in `ledgerWorkspace.core.js` (no DOM; the tests run it against fake stores), and the
> store it exposes has no delete path — archive only, per the owner's no-deletion rule. Rows
> are normalized before they render, so one malformed row cannot blank the page. The db caps
> at 5,000 documents across `docs`, `log` and `added`; at the cap, creates fail with `quota_exceeded`
> and the page says nothing was removed — what to do then is the owner's call, not a cleanup.
> **"Added since the ledger began" (2026-09-30)** lists items numbered after the JSON's
> `baseline.through` (T-398), or carrying an `opened` block, and holds a third collection,
> `added`: work recorded on the page before it has a number. Filing one means adding it to
> the JSON by PR, then marking the row `filed` with its new number; a mistaken row is
> `dropped` with a reason, never removed. The News Charts ledger is rendered by this same
> script (`--queue`/`--root`/`--title`/`--repo`/`--baseline`; the header comment has the line).

### `src/lib/data/transferFees.ts`
Central data file for the Transfer Fee Calculator.

- **`CoinId`** union — 22 coins: btc, eth, usdt, usdc, bnb, sol, dai, xrp, ltc, trx, doge, matic, avax, ada, dot, atom, link, ton, shib, uni, near, arb
- **`NetworkId`** union — 18 networks: erc20, trc20, bep20, solana, polygon, arbitrum, base, optimism, avalanche, bitcoin, xrpl, litecoin, dogecoin, cardano, polkadot, cosmos, ton_network, near_network
- **`EXCHANGES`** array — 29 exchanges (Binance through Hyperliquid; Poloniex was removed 2026-09-15 on TERMS — its User Agreement §9 licenses the API solely for trading on Poloniex), each with per-coin/per-network `withdrawFee`, `minWithdraw`, `withdrawEnabled`, `depositEnabled`, optional `note`. Data is hand-maintained with provenance: `TRANSFER_FEES_LAST_VERIFIED` + `getTransferFeeProvenance()` drive a staleness banner (stale after 120 days).
- **`findTransferPaths()`** — path-finding algorithm: direct routes first, then multi-hop via personal wallet, sorted by totalFeeUsd
- **`PERSONAL_WALLET_ID = 'wallet'`** — the "My Wallet" option in the From/To selectors
- **`EVM_NETWORKS`** — array of all EVM-compatible network IDs (address collision danger)
- **Re-verifying the table (T-031, owner decision D52, 2026-10-01).** The hand pass is worked while the page stays hidden. `npm run fee-check-page -- <out.html>` builds the **Transfer Fee Check** page: one card per exchange with its fee-page link, its rows and its entry-tier trading fee (T-036), the highest-impact rows only a person can check first (`CORE_N`), and the open fee leads from the ledger on the exchanges they name. The owner answers each row (matches / different / not offered / can't see it) from the exchange's own page; the answers live in the published page's database (`checks`, `trading`, `notes`), never in its HTML, so regenerating loses nothing. `npm run fee-check-plan -- <answers-dir> --csv <out.csv>` reads them through the page's own core against the table **as it is now** — an answer given against older figures is never planned — and writes the changed fees for `npm run fee-apply`, whose guards still decide. Minimums, rows no longer offered and trading fees are hand edits. The CSV worksheet and the page share one row list and ranking (`scripts/lib/transferFeeRows.ts`); the exchanges with a keyless fee feed (`WITHDRAW_FEE_SOURCES`) stay with `npm run fee-reconcile` on the owner's machine. ⚠ This cloud environment refuses every exchange host, fee pages and feeds alike, which is why the reading is the owner's.

To add an exchange: append to `EXCHANGES` array following the existing pattern. Tier 1 = major/regulated, Tier 2 = smaller.

### `src/lib/data/stakingProviders.ts`
Central data file for the Staking Opportunities page.

- **Provenance:** `STAKING_DATA_LAST_VERIFIED` + `getStakingDataProvenance()` drive the freshness notice on `/staking` (both the Providers and Live Pools tabs — `/staking-discovery` was merged in on 2026-08-20 and now redirects), and the `referenceData` block on `/api/v1/staking/opportunities`. Stale after 90 days (shorter than the 120 used for fees/attestations — a provider's risk profile can change overnight, which is why Celsius is in the catalog).
- **`StakingCoinId`** — 16 stakeable coins: eth, sol, ada, dot, atom, matic, avax, bnb, trx, btc, cro, osmo, ksm, inj, tia, near
- **`ProviderCategory`** — `'cefi' | 'wallet' | 'liquid'`
- ~~**`RiskProfile`** — 6 dimensions, each 1–10: `custodyRisk`, `counterpartyRisk`, `contractRisk`, `slashingRisk`, `liquidityRisk`, `regulatoryRisk`~~ **REMOVED 2026-09-25 (owner decision D26)** — see the ⚠ block below. No per-provider risk figure of any kind exists now; `custodyModel` (a fact) stays.
- ⚠ **There is NO composite staking risk score anywhere in this app, its API, or its MCP
  server (owner decision D14, 2026-09-14). Do not add one.** ~~The six `RiskProfile`
  dimensions above are published as-is — they are reference INPUTS, not a ranking — and
  nothing combines them into a single number.~~

  > **⚠ OVERTAKEN 2026-09-25 — D26 removed the six dimensions too.** Owner: *"it may sound
  > like a recommendation."* RP-6's reasoning, applied to the inputs D14 had kept. What
  > made it sharper than a taste call: the `/staking` page had **never rendered** them —
  > they reached a person only through `/api/v1`, the MCP tool and the agent tool, i.e.
  > through an AI agent narrating *"custody risk 2 out of 10"*. Removed: `RiskProfile`,
  > `risks`/`assetRisks` on every provider and asset, `mergedRisks()`, the API's
  > `riskBreakdown`, the MCP/agent-tool text, the discovery route's derived `risks`
  > (`RISK_PRESETS`/`adjustRiskFromSignals`), and `lib/risk/profiles/stakingAdapter.ts`.
  > Guarded by `lib/risk/__tests__/riskDimensionsRemoved.test.ts`. The rest of this D14
  > block is left as written: it is the history D26 extends. Record:
  > `docs/decisions/2026-09-25-owner-decisions.md`.

  The distinction the decision draws: *"Risk metrics that use traditional financial
  formulas can stay and should be visible where appropriate."* Sharpe, Sortino,
  volatility, drawdown and beta are arithmetic and stay (see `/compare`; the
  Portfolios weighted-risk figure was cited here too, and is switched off since D64,
  2026-10-04). A weighted composite over six editorial judgments
  is not arithmetic — it is one number that ranks providers against each other, which
  is the shape that reads as a recommendation. Cards describing the dimensions
  **without** a composite are the decided state (RP-3), not a half-built feature.

  **What was removed**, all on 2026-09-14: `computeOverallRisk()` and `getRiskLevel()`
  (deleted from `stakingProviders.ts` — a tombstone comment sits where they were);
  `safetyScore`, `band`, `riskScore`, `riskLevel` and the `max_risk` / `min_safety` /
  `max_safety` filters from `/api/v1/staking/opportunities`; the same fields plus
  `riskCanonical` and `max_risk` from `/live-data/staking-discovery`; the
  `compare_staking_risk` MCP tool; and the `max_risk` argument from the in-app agent
  tool. Guarded by `lib/risk/__tests__/riskScoringRemoved.test.ts`.

  ⚠ **The ruling said the public API was those helpers' only consumer. It was not** —
  `/live-data/staking-discovery` imported them too, with its own `max_risk` filter.
  Both had to go for the helpers to be deletable at all. If you are reading an older
  doc that names only the API, it is describing half the change.

  **Removed parameters are IGNORED, not rejected.** An old client sending `max_risk=5`
  still gets a 200 — with MORE rows than before, never fewer, so nothing is filtered
  out by a rule the caller can no longer see. `middleware.ts` logs those requests so a
  silently-widened result set stays attributable.

- ~~**`scoreStakingProvider()`** (`lib/risk/profiles/stakingAdapter.ts`) is retained as the
  canonical **0–100, higher-is-SAFER** engine with the 5-band vocabulary, but has **no
  live consumer** after D14. D18 defers new risk profiles until a surface is approved to
  render one, so do not wire it into a page on the assumption it is merely unused.~~
  **DELETED 2026-09-25 with the six dimensions (D26)** — there is no staking scorer to
  wire in. This bullet still called it "retained" until 2026-09-29 (T-415).
- **`STAKING_PROVIDERS`** array — 55 providers (count is dynamic; the page reads `STAKING_PROVIDERS.length`). Representative names:
  - CeFi: Celsius (defunct, cautionary), Coinbase, Kraken, Binance, OKX, Bybit, KuCoin, Crypto.com, Bitget, Gate.io, HTX, Robinhood, Nexo, Gemini, Bitfinex, Bitstamp, MEXC, Upbit
  - Wallet: Ledger Live, MetaMask, Phantom, Trust Wallet, Exodus, Keplr, Solflare, Coinbase Wallet, Atomic Wallet, Trezor Suite
  - Liquid/restaking: Lido, Rocket Pool, Marinade, Jito, Stride, Benqi, EtherFi, Frax, Stakewise, Stader, Swell, Renzo, Kelp, Puffer, Bedrock, Sanctum, Babylon, Lombard, Aave, Convex, Ankr, MetaPool, and more
- **Re-reading the facts (T-394, D134, 2026-10-17).** `npm run staking-facts-page -- <out.html>` builds the
  **Staking Facts Check** page: one card per live provider with its own website, and a row per fact (website, year
  founded, audit count, the staking-assets figure where DefiLlama supplies none, and each coin's minimum stake and
  lock-up), liquid protocols first, then wallets, then exchanges. The answers live in the published page's database
  (`checks`, `notes`), never in its HTML; `npm run staking-facts-plan -- <answers-dir>` reads them against the catalog
  as it is then and reports, never writes. The rows come from `scripts/lib/stakingFactRows.ts`, which the page, the
  plan and the CSV worksheet (`LLAMA_SLUG`) share. The lock-ups the 2026-09-26 audit questioned are marked Start here
  (`LOCKUP_LEADS`), each only while the catalog still has the figure and note questioned, and so are two rows the
  2026-10-17 agent evaluation read out as staking options (Uniswap's ETH/USDC pool, Kraken's US line; D136). `STAKING_DATA_LAST_VERIFIED`
  moves only when the plan reports every fact settled. Same look and rules as the Transfer Fee Check.

To add a provider: append to `STAKING_PROVIDERS` following the pattern. Celsius should always be kept — it's used as the educational cautionary example.

**The catalog's text states facts, never a grade of risk (D137, 2026-10-18).** D26 removed the 1–10 figures; 20 lines of
text still graded providers ("elevated counterparty risk", "excellent security"), and an agent read them out. Write the
fact ("Founders indicted by the US DOJ in 2023"), not the grade; naming a kind of risk ("restaking slashing applies") is
a fact. `lib/data/__tests__/stakingWording.test.ts` holds it for every live provider; Celsius keeps its history.

### `src/lib/data/equityCatalog.ts` (Equities module)
- **`EQUITY_CATALOG`** — 79 large-cap US stocks with sector (11 GICS sectors in `SECTOR_INFO`), industry, and approximate reference values (price, market cap, P/E, dividend yield, beta). Reference values are fallbacks — live quotes override price/change.
- Symbols use the dash form of the class-share convention (`BRK-B`, not `BRK.B`) — every provider in the quote ladder accepts it, so one string works across all of them.
- To add a stock: append to `EQUITY_CATALOG`; the registry table, detail route, and quote universe pick it up automatically.

### `src/lib/data/fundCatalog.ts` (Funds module)
- **`FUND_CATALOG`** — 140 funds (`type: 'etf' | 'mutual'`) with issuer, category (`FUND_CATEGORY_INFO`), expense ratio, AUM, yield, inception, tracked index, and indicative top holdings.
- **`computeFeeDrag(principal, erPct, years, returnPct, benchmarkErPct, frontLoadPct)`** — cost projection used by the Fee Drag Analyzer on fund detail pages. `frontLoadPct` is a SALES CHARGE deducted at purchase, not an annual fee: it comes off the top so only the remainder compounds, and it is **not** charged to the benchmark (a no-load index fund), or the comparison would cancel out the very difference it exists to show. Defaults to 0, so every no-load fund is unaffected.
- **`SalesCharge` / `fundSalesCharge(f)`** — a fund's load, or null. **`kind` is required and `maxPct` is optional on purpose**: a load's EXISTENCE (from the issuer's documented share-class structure) and its RATE (from the prospectus) are separately knowable, and conflating them is how a wrong fee gets published. Undefined `maxPct` means *"a charge applies and we have not verified how much"* — never *"no charge"*. A stated rate REQUIRES `source` + `verifiedAt`, enforced catalog-wide by a test. The UI puts a verified rate into the maths and discloses an unverified one in words while excluding it from the projection: guessing is worse than omitting, and omitting silently is worse than both. Populate rates with `npm run fund-fees` (below), never from memory.
- To add a fund: append to `FUND_CATALOG` following the pattern.
- **Re-reading the approximate figures (T-440, D132, 2026-10-17).** `npm run fund-figures-page -- <out.html> [--order <file>]` builds the
  **Fund Figures Check** page: one card per fund with the issuer's page and a box per figure for the value it shows, the date it
  states and which kind of figure it is. The figures are derived: every `yieldPct`, and every asset figure without `aumAsOf`. The
  readings live in the published page's database (`readings`, `notes`), never in its HTML; `npm run fund-figures-plan -- <answers-dir>`
  reads them against the catalog and reports, never writes, and the differences go to the owner before any change.
  `FUND_FIGURES_COMPILED_ON` moves only when every figure has a dated reading. `--order` takes a sort-order file kept off the
  repository (symbols and a `differs` flag, worked out from a data service's figures, which are licensed); no outside figure
  reaches the page. It shares the Transfer Fee Check's look and rules (`scripts/lib/fundFigures.core.js`, tested).
  `npm run fund-figures-prefill` suggests figures from the issuers' pages the owner ruled Allowed (D141), for the
  owner to compare with each page; see "Site terms check" under Testing the Live Data Layer.

### `src/lib/data/portfolioBuilder.ts` (Portfolio Builder module)
Pure engine, no API calls, covered by `__tests__/portfolioBuilder.test.ts` (86 tests).

- **`buildPortfolio(inputs)`** — questionnaire → `BuiltPortfolio`. The glide path anchors to `yearsToFirstUse` (the spend date), **not** retirement; risk tolerance shifts it ±15pts but can never extend a horizon.
- **Sleeve appetite + style.** Appetite decides *how much* (`commodityComfort` / `currencyComfort`, `SleeveAppetite = none|small|moderate`); **style decides *what kind*** (`cryptoStyle` / `commodityStyle` / `currencyStyle` / `bondStyle`) because risk varies as much inside an asset class as between them. Style tables (`CRYPTO_STYLES`, `COMMODITY_STYLES`, `CURRENCY_STYLES`, `BOND_STYLES`) each carry a `label`, a plain-language risk `note` shown in the UI at the point of choice, and (except bonds) an instrument `mix`. Bonds have style but no appetite — they're always held; `applyBondStyle()` rewrites the duration ladder for credit posture (treasury swaps BND→IEF; corporate/high-yield scale the ladder and append LQD/HYG). Higher-risk styles emit explicit notes (high-yield behaves like equity in a crisis; commodity currencies fall *with* equities; silver is ~2× gold's volatility). **All style fields are optional and every default reproduces pre-style behaviour**, so saved plans replay unchanged.
- **Sleeve legs use `MIN_SLEEVE_LEG_PCT` (2%), not the bond ladder's `MIN_RUNG_PCT` (1%)** — a sleeve leg is a distinct position to buy and rebalance, not a duration slice. When a sleeve is too small to carry its style's legs it collapses to the largest one **and says so in a note**, rather than silently ignoring the user's choice. Both fields are **optional (`?`) on purpose** — plans saved before they existed replay through `reviewPlan()`'s aged rebuild and must rebuild identically, so absent === `'none'`. Commodities: GLDM alone at small, GLDM+PDBC (K-1-free basket) at moderate; **deliberately not scaled by risk tolerance** — gold is a diversifier, and an aggressive investor may rationally want none. Currency: FXE at small, FXE+FXY at moderate, and **always** emits a warn note that foreign cash has no long-run expected return and that VXUS already carries unhedged FX exposure.
- **Each sleeve is funded from its own side of the growth/defensive split** so opting in never changes how much risk the plan takes: commodities come out of equity (they're growth-side, and are counted in `GROWTH_CLASSES` for risk-drift), currency comes out of the bond residual (it moves like cash). Verified by test: growth/defensive totals are unchanged with sleeves on.
- **`bondLadder(horizon)` / `consolidateLadder(rungs, sleevePct)`** — duration matched to the spend date (SHY → IEF → BND → TLT). `consolidateLadder` drops rungs worth under `MIN_RUNG_PCT` (1%) and re-spreads them, so a thin sleeve becomes one real position instead of several unbuyable slivers.
- **Sector exclusions remove tilts only.** A broad-market core still holds the excluded companies at index weight, and the engine says so in a note — the catalog carries no screened fund, so a true screen is not deliverable. Do not "fix" this by silently dropping the core.
- **`fees`** — blended expense ratio, annual dollar cost, and compounded drag vs a 3bps benchmark. There is deliberately **no** fee warning at build time: every reachable instrument is a cheap index fund, so the blend tops out near 0.13% and any threshold would be dead code.
- **`diversificationScore`** — Gini–Simpson diversity (1 − Σwᵢ²) over the class mix, worth 90 points, plus up to 10 graded points for international equity reaching 20% of the plan. Replaced (2026-07-21) a count-based formula that pinned every reasonable multi-class plan at exactly 100. Realistic range is ~48–75; the ceiling is unreachable by an actual plan, on purpose — don't "fix" a plan not scoring 100.
- **`checkDrift(plan, weights, valueUsd)`** — target vs actual with per-holding buy/sell dollar trades, turnover, and off-plan positions. Drift exactly on the band is `hold`; only a breach trades.
- **`reviewPlan(saved, actual?, now?)`** — suitability monitoring: ageing glide path, risk drift, fee creep, concentration, off-plan holdings, overdue review. Checks needing real holdings are skipped rather than guessed when `actual` is absent. `now` is injectable so time-dependent behaviour is testable. **Fee creep is checked here**, against what the user actually holds (which can include 0.49–0.87% funds), not at build time.
- **Concentration is measured against the plan's own target**, not an absolute weight — a 55% total-market core is 3,500 companies held on purpose, and flagging it would train users to ignore the warning.
- **`actualWeightsFromPortfolio(portfolio, prices)`** — bridges a `/portfolios` portfolio into symbol→weight. Positions with no live price are **excluded, never valued at cost**; `pricedPct` reports coverage so the UI can disclose it.
- UI: `src/components/portfolio-builder/PlanMonitor.tsx` (expandable per saved plan) supports both a linked portfolio and manual weight entry.
- **Plans persist to Postgres** (`builder_plans` table — jsonb snapshot of engine output, deliberately not normalized) via `/api/user/builder-plans` (+ `/[id]` PATCH/DELETE). Ownership via `getCurrentUserId()` (local-user mode while the auth wall is off). The page one-time-imports legacy `BUILDER_STORAGE_KEY` localStorage plans (timestamps preserved, key renamed `*:imported` so it can't run twice). `builder_plans.linked_portfolio_id` persists which portfolio the drift monitor compares against (auto-selected on load; portfolios are DB-backed with UUID ids).
- **Plan history and printable rebalance notes (D56, 2026-10-04; T-065, T-066).** The drift
  monitor's **Save this check** stores one drift check in `builder_plan_snapshots` through
  `/api/user/builder-plans/[id]/snapshots` (GET newest first, POST one). ⚠ **Migration 0004
  adds that table — run `npm run db:migrate` on the owner's machine**; until then the route
  answers 503 with that instruction (`isMissingTableError`, `lib/db/errors.ts`) rather than a
  500. Saving is a button press, never a side effect of opening the panel, and it does not
  mark the plan reviewed. The server stores only what `parsePlanSnapshot()`
  (`lib/data/planHistory.ts`, pure + tested) returns, and recomputes the summaries from the
  rows. One plan keeps at most `MAX_SAVED_CHECKS_PER_PLAN`; past that, saving is refused and
  **nothing is pruned** (the no-deletion rule). Rows go only with their plan or user
  (CASCADE). **Print rebalance notes** renders `buildRebalanceNotes()`
  (`lib/data/rebalanceNotes.ts`, pure + tested) into a `<body>` portal
  (`RebalanceNotesPrint.tsx`) that `globals.css` shows only in print, while
  `html[data-print="rebalance-notes"]` is set; it makes no file. Both buttons stay off
  while hand-entered weights do not total 100%. Contribution modeling and asset location
  are **not** built: they wait on T-064 and D4.
- ~~**⚠ New API routes with dynamic segments MUST live under `/api/user/`**~~ — **this
  constraint was LIFTED on 2026-09-14 (D2).** It existed only because a
  `next.config.mjs` rewrite proxied unmatched `/api/*` paths to the legacy backend and
  resolved before dynamic routes, so any dynamic segment outside the excluded prefixes
  was silently forwarded to a dormant service (which is how `/api/auth/csrf` and
  `/api/auth/callback/*` came to 500). The backend is retired and the rewrite is gone,
  so a dynamic `/api/*` route may now live wherever it belongs. Existing routes were
  **not** moved — `/api/user/*` is still the right home for user-scoped data on its own
  merits. If anything is ever proxied from `/api/*` again, this constraint returns with
  it.

### Quote plumbing for both modules (`src/lib/api/live/marketData.ts`)
**All four equity data surfaces are registry-driven** (same provider system as crypto — `src/lib/api/live/providers.ts`, configured on the Integrations page, persisted to `.provider-config.json`; providers carry `market: 'crypto' | 'equities'` so the two sides never cross). Every surface records per-provider utilization, supports toggling built-ins (order is fixed by the registry — there is no reorder action), and accepts user-added custom feeds (SSRF-validated, auth via header/query/bearer, tolerant JSON field extraction in `src/lib/server/customFeeds.ts`):

- **Quotes** (`fetchSecurityQuotes` → `getEquityQuoteProviders()`): custom `json-quote` feeds first, then FMP → Finnhub → Twelve Data → Tiingo → Alpha Vantage → catalog reference prices. **Every live rung is keyed** since the Yahoo removal (2026-08-06) — see below. `{symbol}` (per-symbol) or `{symbols}` (batch) placeholders. **Stooq used to be the last live rung and is gone** — it 404s on every variant (confirmed in the 2026-07-19 audit) and has been removed from the registry and the quote path; catalog reference is the real last resort. The only remnant is the legacy `'stooq'` value in `PRICE_SOURCES` (db/schema/instruments.ts), which is inert. Don't re-add it as a fallback.
- **News** (`/live-data/market-news` → `getEquityProviders('news')`): **CNBC is the only built-in**, plus custom `rss`/`atom`/`json-news` feeds, all active sources merged in parallel. ⚠ **MarketWatch was removed 2026-09-20 ON TERMS, not availability** — the feed still serves 200. Dow Jones's Terms of Use §9.4.1 bars automated ingestion "without our prior written consent" and §9.1 names RSS content expressly, so `dowjones.io` and `marketwatch.com` are now `prohibited` in the registry — a `pinnedFetch` socket block, the same class as Yahoo. **Do not reintroduce it**: restoring it needs written consent, not a code change. Equity news is single-sourced on CNBC as a result, which is a known D21 optionality gap rather than a comfortable state. **There is no keyless per-ticker feed** — Yahoo's was the only free one. Symbol mode reads the same general wires and filters to articles that actually name the company, and does **not** force-tag the requested symbol onto unrelated stories. **With a Marketaux key (T-430, 2026-10-07)** symbol mode also asks Marketaux for that ticker (`lib/server/marketauxNews.ts`): headline, snippet and link, credited to each article's own publisher, cached six hours per ticker so the free plan's 100 requests a day go further; an article counts for the stock when Marketaux itself tagged it with the ticker. The general feed never calls it. ⚠ Its terms allow personal, non-commercial use only, and a public app needs its written approval; the enquiry is drafted in `docs/licensing/marketaux-enquiry-2026-10-07.md`, not sent.
- **Social** (`/live-data/stock-social` → `getEquityProviders('social')`): built-ins Reddit Finance / StockTwits plus custom `json-social` feeds. ⚠ **Reddit's absence is OUR OWN robots gate, not a datacenter-IP block** — this line said the latter, which sends a reader chasing a network fault that is not there. Its robots.txt disallows this app's agent (2026-08-29 terms review), so both social routes check `robotsPermits` and skip `reddit.com` unless `REDDIT_CLIENT_ID` is set (so does the Integrations Test button, since 2026-10-13): **that applies on the owner's machine too**, and expecting StockTwits-only is right everywhere, not just in CI. Reddit does separately 403 datacenter IPs and rate-limit its `.rss` feeds, but neither is what you are seeing while the gate is closed. **Lifting the gate is a post-launch project (D58, 2026-10-04):** Reddit now approves every API user, personal projects included, and setting `REDDIT_CLIENT_ID` alone would lift the gate while both routes still read the anonymous `.rss` feeds — the OAuth reader comes first (T-245).
- **OHLCV / TA / backtests** (`/live-data/security-ohlcv` → `getEquityOhlcvProviders()`): custom `json-ohlcv` feeds first, then Tiingo → FMP. Both keyed; with neither the route reports `source: 'none'` and the TA/backtest/candlestick surfaces show their no-live-source state. **Both take out splits and dividends (T-441, D138, 2026-10-18):** FMP's `/full` takes out splits only, so its rung reads `/dividend-adjusted` through `lib/api/live/fmpHistory.ts`, which the `security-chart` ladder's FMP rung shares; a fall from Tiingo to FMP no longer moves a dividend payer's history. Every response names its `basis`; `/full` serves only where the plan withholds the endpoint (403), labelled `splits`. The chart's third rung, Twelve Data, is `unadjusted`.

UI labels non-live prices with a small amber `ref` tag; KPIs needing live data show "requires live quotes" instead of fabricated values.

The **TopBar data-tier dropdown** (`TierSwitch` / `src/lib/tier.ts`) breaks sourcing down per category. Categories carry a `market: 'crypto' | 'equities'` field: crypto rows respond to the free/paid/custom toggle as before; equity rows are `informational: true` — they reflect the live registry (enabled providers per category, scoped by market) rather than the toggle, since equity sourcing is managed entirely on the Integrations page. Multi-select option lists are market-scoped so crypto selectors never pull in equity providers that share a `category` id.

---

## Source Terms — may we use this website?

**Before any host is fetched, there is a dated verdict on what its terms of use permit.**
`src/lib/server/sourceTerms.ts` is the registry; `termsProbe.ts` is the live check for a
site nobody has reviewed. Full design: `docs/architecture/source-terms.md`.

> ⚠ **Yahoo Finance was removed as a data source on 2026-08-06 — on terms grounds, not
> availability.** The `query1/query2.finance.yahoo.com` v8/v10 endpoints are undocumented
> internals of Yahoo's own web app with no published third-party API terms, while Yahoo's
> ToS prohibit automated access and redistribution. It is **hard-blocked in code**:
> `pinnedFetch` and `termsGatedFetch` refuse `*.yahoo.com` before connecting, and
> `sourceTerms.test.ts` fails while any data-source entry names it. ⚠ A plain `fetch` is
> refused by neither: only the drift check stops one, by failing on a host its route's entry
> does not name (the entries it still skips are T-433). **Do not reintroduce it** without changing the registry verdict, which means
> re-reading the terms and being able to defend the change.
>
> It was the only **keyless** rung on the equity/fund/macro quote, chart and OHLCV paths.
> What that cost, all of it deliberate and visible rather than papered over:
>
> | Surface | Now |
> |---|---|
> | Quotes, charts, OHLCV/TA/backtests (stocks, funds, macro) | **Key-gated.** FMP/Finnhub/Twelve Data/Tiingo/Alpha Vantage for quotes, Tiingo→FMP→Twelve Data for history. No key ⇒ catalog `ref` prices for stocks/funds, an honest dash for macro |
> | **Macro instrument quotes** (`GC=F`, `EURUSD=X`) | **Hit hardest.** Tiingo does not carry them, so coverage depends on the keyed provider configured and is expected to be partial |
> | **Treasury yield indices** (`^IRX`/`^FVX`/`^TNX`/`^TYX`) | **No longer affected (2026-09-03, D3).** No free provider quotes them at all — FMP paywalls them, Finnhub returns nothing, Twelve Data 404s, Alpha Vantage answers empty — so they were moved off the quote ladder onto the official treasury.gov par curve: keyless, plain percent, daily |
> | **Futures term structure** (`/live-data/futures-curve`) | **No source at all.** Nothing reachable quotes a dated contract month. The route resolves the months and returns `ok:false` with the reason; `TermStructureCard` prints it. Front-month prices are unaffected |
> | Trailing returns | One request per symbol. `?universe=` is **refused**, not truncated; `?symbols=` capped at 60. Fund return **screening and sorting are off** — a screen that could only see the visible page would filter as though it had seen every fund. Per-page Returns columns still live |
> | Per-ticker news | **Gone.** Symbol mode reads the general wires and keeps articles that name the company. It no longer force-tags the requested symbol onto unrelated stories |
> | Fund holdings | Unaffected (SEC N-PORT, keyless). Sector weights now need an FMP key (N-PORT carries no GICS classification). The stock/bond/cash **asset mix is derived from N-PORT's `assetCat`** (NT9, `lib/utils/assetMix.ts`) — keyless, so also unaffected; the earlier "no source" note here was overtaken by that work. It is absent only for filers that publish no N-PORT (UITs such as SPY), where the section correctly does not render |
> | FX converter, Treasury curve, SEC filings/XBRL, all of crypto | **Unaffected** — keyless and unrelated |
>
> The fix for any of the key-gated rows is a free API key on the Integrations page — **not
> a substitute scraper.**

> ⚠ **19 of 75 registry entries are `seeded`, not `verified` — check `review` before
> trusting one.** The registry was authored in an environment whose network policy
> blocked every publisher and provider host at the gateway, so not one terms document
> could be opened. The entries are honest starting positions drawn from each
> provider's publicly documented posture (published API docs, documented free tiers,
> openly advertised RSS feeds) — they are **not readings**. **56 entries are
> `verified`** as of 2026-10-14 (the count was spelled out as a word here until 2026-09-20,
> which is why no guard could watch it — see `docs:check`): **Cboe** (P2-O1 audit, 2026-08-05) and
> **CoinGecko** (the 2026-08-29 probe run) were the first two, and sixteen more
> were **read** on a clean egress on 2026-09-14/15
> (`docs/audits/terms-review-apis-2026-09-14.md`,
> `docs/audits/terms-review-news-2026-09-14.md`) — all on the owner's machine.
> Reading is not ratifying: those sixteen stayed `seeded` until the owner flipped
> them, two on 2026-09-16 (`bcd4490`) and fourteen on 2026-09-19 (`516220f`).
>
> **Eight more followed, and they are what makes 2 + 16 add up to 26:** FMP on
> 2026-09-13, then on 2026-09-20 Finnhub, Twelve Data, Binance.US, CoinDesk,
> Investing.com, and the two Dow Jones properties — `dowjones.io` and
> `marketwatch.com`, both read to a **`prohibited`** verdict, which is a reading
> like any other and is why a rising `verified` count is not by itself good news.
> Readings: `docs/audits/terms-review-finnhub-2026-09-20.md`,
> `terms-review-twelvedata-binanceus-2026-09-20.md`, `terms-review-news-2026-09-20.md`.
>
> **Twenty-one more on 2026-10-04 (D54, D55), which take 26 to 47.** All thirty seeded
> entries were read on the owner's machine on 2026-09-26
> (`docs/audits/terms-review-seeded-2026-09-26.md`). D46 held the sign-off. D54 then marked
> seventeen of them verified: the eleven clean readings and the six ruled on first (OKX,
> Nasdaq Trader, KuCoin, Alpha Vantage, Messari, Santiment). D55 added the four ruled on
> later that day (CoinMarketCap, Jito, Rocket Pool, Pendle). The 11 left `seeded` then were
> CryptoPanic (its API terms would not open), three that could not be read (Binance.com,
> HTX, XT.com), four with no terms document at all (DefiLlama, Blockchain.com, Stride,
> Beefy), Yearn, which is no longer fetched, the **Federal Reserve Board**, added 2026-10-03 for the Market Calendar's FOMC dates: read that day, not yet ratified, and **Marketaux**, read 2026-10-07 for company news on stock pages (T-430): personal, non-commercial use only until Marketaux approves otherwise in writing.
>
> **Thirteen more on 2026-10-13 (T-432), all `seeded`:** the wallet routes' public RPC and
> explorer hosts (Blockstream, Solana, Tronscan, Ripple's XRPL server, dRPC, Cloudflare's
> legacy gateway, 1RPC, polygon-rpc.com, BNB Chain, Avalanche, Arbitrum, Base, Optimism).
> They had never been checked: the `wallet` entry in `dataSources.ts` named no host, and
> `npm run data-sources -- --verify` read only top-level route folders, so the nested
> `wallet/*` routes were invisible to both guards. The check now walks every folder
> (`scripts/lib/routeHosts.mjs`, `dataSourcesDrift.test.ts`). Each document was read on the
> owner's machine. Most of the operators offer their public endpoint for development and
> say to run a node or pay a provider in production, which is personal use before launch
> (D96) and a launch step only if Wallets returns.
>
> **The owner ruled on 2026-10-14 (D105), taking 47 verified to 54.** Verified: the five clean
> readings (Blockstream, Solana, Ripple, Base, Optimism), and dRPC and Arbitrum on the narrow
> reading, as D25 read publicnode. Arbitrum's terms and Tronscan's, which answered 403 to a
> script, were read in the owner's browser. **`cloudflare-eth.com` is dropped** from the
> Ethereum ladder: Cloudflare is retiring it, and nothing grants keyless use. **Tronscan is
> called only with a key** (`TRONSCAN_API_KEY`, sent as `TRON-PRO-API-KEY`): its terms require
> an account and its API rate-limits keyless requests, so without one the TRON route calls
> nothing and says why (`walletTerms.test.ts`). Still `seeded`: Tronscan, Cloudflare, and the
> four with no governing document (1RPC, polygon-rpc.com, BNB Chain's dataseed, Avalanche's
> API), as D54 left DefiLlama and the others.
>
> **Two more the same day (T-433): NewsAPI and GNews**, the news route's keyed fallbacks,
> verified by the owner on 2026-10-14 (D106), taking 54 to 56. Each keeps its launch step: a
> paid plan at launch, or the fallback dropped. The drift check had skipped every entry with a hostless provider (23 of 56),
> which hid them; it no longer does, and its only exceptions are two named lists in
> `scripts/lib/routeHosts.mjs`. **AI providers are not data sources and stay out of this
> registry (D104, owner: *"no on the AI providers"*)**: the nine the Integrations Test button
> calls are in `NOT_DATA_SOURCES`. Do not add a `sourceTerms.ts` entry for one.
>
> **One more, `seeded`, on 2026-10-14 (T-434, D108): Coin Metrics Community Data**, the chart
> route's backup for closing prices. Its grant is CC BY-NC 4.0, read that day: non-commercial
> use with a credit, so personal use before launch (D96) and a T-151 question at launch.
>
> **And one found, `seeded`, the same day (T-439, D113): Injective's public LCD.** The staking
> collector had fetched it with no entry at all: the collector lives in `lib/server`, and the
> drift check read only route files. It now follows a route into the `lib/server` and `lib/api`
> modules it imports (`scripts/lib/routeHosts.mjs`), skipping three named modules that hold
> links rather than requests, and fails if one of those starts making requests. The collector
> also called `lcd.injective.network`, which Injective's docs do not list and which failed all
> that day; it now calls the documented `sentry.lcd.injective.network`. No document governs the
> public endpoints, and the docs advise against them for production traffic: a launch step.
>
> A seeded `approved`/`conditional` means *nobody has objected yet*, not *cleared*.
> Seeded entries still serve data — breaking the app over a documentation gap is the
> wrong failure, same reasoning as staleness — but they are counted, badged on
> /data-sources, and carry the caveat in `decision.reason` so every surface that
> renders it inherits the warning.
>
> > **First real probe run: 2026-08-29** (owner's machine — the first environment
> that could reach these hosts). Results and decisions:
> `docs/audits/terms-review-2026-08-29.md`. Two findings acted on:
>
> - **CoinGecko is now `verified`** against its **API Terms** — not the Website
>   Terms the probe read by mistake. Clause 4.1.6 permits charging for products
>   built on the API and bars only reselling API *access*, so the
>   "non-commercial" alarm the probe raised never applied here. Clause 4.4
>   prescribes the attribution **message**, so `SourceProvider.attribution`
>   carries "Powered by CoinGecko" verbatim with a 10px floor and `SourceLine`
>   renders it — a test parses the rendered class and fails below the floor.
>   **Where it renders is checked too (T-424, 2026-10-12):**
>   `lib/data/__tests__/coingeckoCredit.test.ts` follows imports, not URLs, and fails when a
>   route reaching CoinGecko has no entry naming it, or when a page or a part of the app
>   shell reads such a route without a SourceLine (or `attributionText()`, for a toast)
>   carrying the credit. It cannot see tabs: a tabbed page keeps its SourceLine above the tabs.
>   **And beyond the pages (D100, D101, 2026-10-12):** the agent API sends the credit as
>   `attributions`, the MCP server relays it, and AI answers built on CoinGecko figures show
>   it — see "Agent API Layer" and "AI Agents" below. The same guard holds all three.
> - **Reddit's robots.txt disallows this app's agent**, so reddit.com is gated
>   off unless `REDDIT_CLIENT_ID` is set, enforced in `pinnedFetch`, in
>   `termsGatedFetch` and by `robotsPermits` checks in the two social routes.
>   ⚠ This said a new call site "inherits" the gate from `pinnedFetch`; only a
>   `pinnedFetch` caller does (4 of 60 routes, measured 2026-10-13), and the
>   Integrations Test button read reddit.com on every click until that day.
>   `termsGatedFetch.test.ts` now fails on any file that writes a robots-disallowed
>   host into a URL without one of those checks. `SourceTermsEntry.robotsDisallowed` records that as a
>   dated **first-hand** observation kept separate from the terms `review`
>   state: robots.txt is an instruction we either honour or don't, while a terms
>   verdict is an interpretation — recording one must not launder the other into
>   looking reviewed.
>
> One item stays open: the **personal-vs-commercial question**, which decides
> **eight** more sources (Finnhub, Twelve Data, Tiingo, Binance.US, YouTube,
> OilPrice, Bitget — and **FMP**, added 2026-09-02) and is the owner's to answer.
> **Update 2026-09-19:** four of those eight were read on a clean egress on
> 2026-09-14 and are now `verified` — Tiingo, YouTube, OilPrice and Bitget.
> ~~Finnhub, Twelve Data, Binance.US and FMP's entry are still `seeded`.~~
> **Overtaken 2026-09-22: all four are now `verified`.** FMP flipped on 2026-09-13
> (`sourceTerms.ts:287`), and Finnhub, Twelve Data and Binance.US on 2026-09-20
> (`:393`, `:465`, `:613`), against the readings in
> `docs/audits/terms-review-finnhub-2026-09-20.md` and
> `terms-review-twelvedata-binanceus-2026-09-20.md`. ⚠ **This does NOT answer the
> personal-vs-commercial question.** `docs/LEGAL-REVIEW.md` records that all four bar a
> deployment other people can reach, with no tier curing it, and that is the owner's to
> resolve (T-151). `verified` means the document was read — never that the permission
> it grants is adequate.
>
> **D96 (2026-10-09): everything before launch is personal use, for every source.** Owner:
> *"Consider anything done pre launch as personal use; revaluate and apply that to all of the
> current sources."* Launch is still D22's trigger, the first page load by anyone other than the
> owner. Every source was re-read (`docs/assessments/source-terms-prelaunch-2026-10-09.md`):
> fifteen personal-use licences are fine before launch and each entry names its launch step;
> Yahoo, Cboe, Poloniex, Dow Jones and MarketWatch stay blocked because their bans are not about
> who uses them; OKX stays blocked by the owner's choice (its terms bar building an analytics
> platform). ⚠ A personal-use rule never reopens a ban on automated access.
>
> **FMP is the load-bearing one, and it was missed until now.** Its entry is
> `seeded`, and its finding asserts the permission is *tier-dependent* (free =
> personal/development, redistribution on a higher plan). A 2026-09-01 fund-fee
> assessment asserts the opposite — personal use on **every** tier. Neither is a
> reading, and `terms-review-2026-08-29.md` does not mention FMP at all: the
> seeded finding read as already settled by plan tier, so it never joined the
> queue. An assumption wearing the confidence of a resolved entry is precisely
> what `seeded` exists to expose.
>
> **Read 2026-09-13, and recorded as read since then.** The document was opened
> on the owner's machine (`docs/audits/terms-review-fmp-2026-09-13.md`) and its
> verbatim clauses are now the entry's `finding`. It answers the paragraph above
> and contradicts both sides of it: §2.2.1 grants personal, non-business,
> non-commercial use only, and §2.2.2 bars any multi-user deployment
> "irrespective of whether such usage is complimentary or paid" — so the
> permission is **not** tier-dependent, and broader rights come from an Order
> Form under §2.1, not a higher plan. **The registry now matches the reading:**
> `sourceTerms.ts:287` carries `review: 'verified'`, `reviewedAt: '2026-09-13'`,
> with those verbatim clauses as its `finding`. What remains open is not the
> RECORD but the PERMISSION — personal, non-business use only, with broader
> rights available solely by Order Form. That is T-151's keystone question; see
> `docs/LEGAL-REVIEW.md`.
>
> It matters because FMP is not a marginal source. It is the first rung of the
> quote ladder, the **only** source for the Stock Registry universe and for
> `/live-data/market-calendar`, and the OHLCV fallback — 7 live-data routes
> across 20 files. If "personal use on every tier" is right, that is a live
> problem on shipping surfaces rather than a future decision. See the dated note
> on the entry in `sourceTerms.ts` for the three questions to answer.

> **`docs/LEGAL-REVIEW.md` is the standing note for all of this** (opened 2026-09-20). The
> legal questions in this project are spread across ~65 queue items, several audits and a
> drafts folder, and nothing said what they add up to. It groups them, names the keystone
> (**T-151 — is Finance Now personal/internal or commercial?**), and records the four
> provider enquiries drafted on 2026-09-20 in `docs/licensing/` — **none of which have been
> sent**. Read it before reopening any licensing question.
>
> ⚠ Its headline finding: FMP, Finnhub, Twelve Data and Binance.US were all read on the
> owner's machine and **all four bar a deployment other people can reach**, with no tier
> curing it. Three name a route (Order Form / written approval / Redistribution Add-On);
> Binance.US names none. That is not a pricing question, so D21 does not defer it.
> (Binance.US has since left the app: nothing fetches it from 2026-10-13, T-423. The other
> three stand.)

> **Tokenized securities** — `docs/assessments/tokenized-securities-2026-09-21.md` is the
> dated record (regulation by jurisdiction, live products, data sources, the tree's gaps,
> an adaptation plan, owner decisions). Read it before touching anything that classifies a
> token, prices a stock, or states trading hours. Three things it establishes that are easy
> to get wrong: **a tokenized share is a *representation* of an existing instrument, not a
> coin and not a new asset class** (the same Tesla share can carry several prices, hours,
> rights and eligibility rules at once); **USDY in the coin registry is a tokenized Treasury
> note, not a stablecoin** (its false 282 bps "depeg" went 2026-09-22, and since 2026-10-07 it
> is filed as `assetType: 'tokenized'`, which fills the Coins page's "Tokenized" filter — TS-1,
> TS-2; `assetTypeChips.test.ts` holds both and fails on a filter chip that can match no coin);
> and the SEC's 2026-09-17 innovation exemption relieves venues and liquidity providers,
> **not information services**, so the app's analytics-only posture holds while it labels
> truthfully. `docs/LEGAL-REVIEW.md` §3.G carries the open legal questions.

> **Risk ratings by asset type** — `docs/assessments/risk-ratings-by-asset-type-2026-10-07.md`
> (T-419, 2026-10-07) is the research D64 asked for before any rating returns (T-420). Read it
> before restoring anything behind `lib/risk/visibility.ts`. Its line, from public sources and
> not yet a lawyer's: a rating that is the same for every reader, with its method shown, is the
> publisher's form; a figure worked out from a user's own holdings is the personal form, and the
> draft disclosures promise the app offers none. **The owner's answers (D92, 2026-10-07):** a
> rating on the asset's own page for crypto coins and stocks only, facts everywhere else, never a
> rating of a user's holdings or portfolio, and nothing shown until counsel confirms it in the
> legal review (D4). T-420 rebuilds to that scope. `docs/LEGAL-REVIEW.md` §3.H.
> **Build status (2026-10-11):** the engine, the weekly readings, the two rating routes, the panel
> and the methodology page are built, all behind `ASSET_PAGE_RATINGS_SHOWN = false`
> (`lib/risk/visibility.ts`). The §8 validation has run (`npm run ratings:validate`, written up in
> `docs/assessments/risk-ratings-validation-2026-10-10.md`): good ordering, but the draft's classes sat
> three below the EU scale for stocks and two for coins. **The owner then decided the numbers (D97):**
> one set of volatility and drawdown curves for coins and stocks, worked out from the EU PRIIPs bands
> (`PRICE_CURVES` in `methodology/v1.ts`), and no lift from the other parts, which can lower a class but
> never raise it; the same day (D98) the cap moved from the top of the price class to the price score
> itself, so scores within a class differ again. Version `v1 (2026-10-11)`. Not rated (D99): an asset
> with no reported trading over the volume window (vBUSD), and coins whose supply steers their price
> (Ampleforth). The method and every build decision are in `docs/architecture/risk-ratings-methodology.md`.

**To close it:** `npm run terms:report -- --seeded` (or `--news`) from a machine
> that can reach these sites writes a review worksheet — current verdict, what the
> probe saw, a link to the document, and a conclusion box per host. Read the
> documents, then flip `review` to `'verified'`. The open queue for the news
> publishers is `docs/audits/terms-review-news-2026-08-07.md`. **The news feeds are
> the priority**: they are the app's only keyless content sources, and their
> permission rests on a publisher syndication policy rather than an API licence.

**Three verdicts**, because two would collapse a real distinction:
- `approved` — permitted, unconditionally enough to just use it.
- `conditional` — permitted *while conditions hold* (attribution, a rate limit, "headline
  and link only", "personal use"). Most of the registry. The conditions are the
  maintainer's obligation, not something code enforces; writing them down is the point.
- `prohibited` — hard-blocked, no override, anywhere.

> **The prohibited set is nine, and six of them are recent.** `yahoo.com` (2026-08-06,
> terms), `cboe.com` (P2-O1 audit, 2026-08-05), `poloniex.com` (2026-09-15, User Agreement
> §9), — added **2026-09-20** — `dowjones.io` and `marketwatch.com` (Dow Jones Terms of
> Use §9.1/§9.4.1: RSS content is named expressly and automated ingestion needs prior
> written consent), and — added **2026-09-30** (D40) — `okx.com` (API Agreement §9.4:
> market data only for "your own personal, non-commercial trading and account management
> purposes", never in an "analytics platform", public endpoints expressly included;
> `/live-data/funding-rates` lost its only source and answers `ok:false` with the reason), and
> — added **2026-10-17** (D129, T-407) — `bitget.com` (Terms of Use §1: the United States is a
> Prohibited Country and the owner is US-resident; the owner chose to stop rather than rely on
> a no-account call falling outside it. The withdraw-fee overlay lost one feed, and Bitget's
> rows in the hidden Transfer Fees table are now checked by hand), and — the same day (D131) —
> `xt.com` (no terms document can be found, and XT's own site refuses service to the owner's
> region; `review` stays `seeded`, since the verdict is the owner's choice and not a reading),
> and — the same day (D133, T-407) — `investing.com` (Limitations on Use (c) forbid automated
> extraction "for any purpose"; the owner chose to stop rather than read its published RSS feeds
> as an invitation. The macro-news route lost three of its seven feeds, and every pillar keeps a
> source).
> KuCoin, which raises the same residence question in its Article 17(5), was kept until launch
> instead (D130): that undertaking binds on registering an account, which the app never does.
> All nine are refused by `pinnedFetch` and `termsGatedFetch`, with no override, and
> `sourceTerms.test.ts` fails while a data-source entry names one. A plain `fetch` to one is
> refused by neither, and is caught only by the drift check (see Yahoo above). Yahoo is described at
> length above; the other eight were only ever recorded in `sourceTerms.ts`, which is why
> this list exists.

**Two assertion forms, and the split is the design:**
- `assertSourceNotProhibited` (used by `pinnedFetch`) — only `prohibited` fails. A
  decision about *someone else's terms*, so it binds every request forever.
- `assertSourceAllowed` (strict) — an unreviewed host fails too. A decision about *us*,
  enforced at test time and at save time, where a human can be asked.

Collapsing them would either let a prohibited host through or make the acknowledgement
flow a lie.

**Enforcement, by path:**
- **Built-ins → test time.** `__tests__/sourceTerms.test.ts` walks every `host` in
  `lib/data/dataSources.ts` and fails if one is unregistered or prohibited. Add a route
  fetching a new host and the suite fails until someone reads that site's terms. (It
  caught ten already-shipping hosts with no review on its first run.)
- **User-added feeds → save time, then socket.** `/live-data/config` runs
  `probeSiteTerms()` on `add-custom` **and** `update-custom` (or "add an approved feed,
  then edit the URL" is a hole straight through the gate). A hard block is `403` with no
  override; anything else needing a human is `409` carrying the report, and the
  Integrations UI shows the matched clauses and asks for `termsAcknowledged`.

**One display field, and it is the switch (T-247, 2026-09-26):** `whatMayBeDisplayed` on a
content source records what its terms grant a syndicator to *show* — `headline-link-summary`,
`headline-link`, or `unclear` (the owner's recorded decision to proceed on an unresolved scope
question — LEGAL-REVIEW §7). `summaryPermitted(url)` is its one enforcement point and every
summary site in the three news routes calls it, gated on the **article's** host; only
`headline-link` blanks a summary. So resolving CoinDesk toward headline-and-link is a
one-field change that reaches all three routes at once. (Investing.com, the other `unclear`
entry, is `prohibited` since D133, 2026-10-17, and no feed of it is read.)
`lib/server/__tests__/displayGrant.test.ts` pins the rule, the eight publisher values, and
that no summary site is ungated. No source is `headline-link` today.

**Two review states**, and the split is not cosmetic:
- `verified` — someone opened the document and read the relevant clauses on `reviewedAt`.
- `seeded` — written from documented posture, never read. The first cut of this file
  had no such field, so 47 unread entries all carried a date that read as "checked".
  A verdict nobody read, wearing a date saying somebody did, launders an assumption
  into a record — which is worse than having no registry.

**Two rules the probe follows, and you should too:**
1. **A keyword scan is not a reading.** Only `blocked` is enforced automatically;
   "nothing prohibitive found" still asks a human.
2. **"Couldn't read it" is not permission.** Publishers 403 datacenter IPs, including on
   their legal pages. `unknown` asks a human, exactly like `needs-review`. Same rule as
   the data audits: verify on the owner's machine, never downgrade a verdict on a CI probe.

Verdicts go **stale** (180 days) rather than expiring — terms change, but breaking the app
because nobody re-read a document is the wrong failure. The registry is dated by its
**oldest** entry, not its newest, exactly like the hand-maintained data catalogs. Since
2026-10-07 (T-250, D88) that oldest date is also a `npm run staleness:check` clock
(`TERMS_REREAD_OLDEST_READING`), so the re-read is announced three weeks ahead instead of
waiting for someone to notice; a test keeps the anchor equal to the registry's oldest
`reviewedAt`.

---

## Environment Variables

```bash
# ── Database (required for every DB-backed feature) ──
DATABASE_URL=postgres://…                   # Postgres. Backs users, entitlements, portfolios,
                                            # watchlists, builder_plans, instruments. Without it
                                            # those routes return 503 (isDbConfigured guard) —
                                            # the rest of the app still runs live-only.

# ── Auth (Auth.js / next-auth v5) ──
AUTH_SECRET=…                               # REQUIRED once the login wall is re-enabled — Auth.js
                                            # reads it directly from env (it appears in no source
                                            # file, so grep won't find it). Generate: openssl rand -base64 32
FN_ALLOW_LOCAL_USER=true|false              # (legacy CAEP_ALLOW_LOCAL_USER still honored)
                                            # Defaults: allowed in dev, denied in production.
                                            # ⚠ Setting true in production hands every anonymous
                                            # visitor the same shared account. See lib/auth/session.ts.

# ── Legacy backend — RETIRED 2026-09-14 (D2) ──
# NEXT_PUBLIC_API_URL is no longer read by anything. The backend is frozen
# (backend/FROZEN.md), the /api/* proxy rewrite is gone, and the API_BASE_URL
# constant that exported this value was removed — it had no importers, because the
# axios client that once used it went in the M8 sweep. Setting the variable now has
# no effect; it is documented here only so nobody re-adds it expecting one.
# NEXT_PUBLIC_WS_URL is likewise gone — the app opens no socket. The reconnect
# client it configured was unreachable (LIVE_DATA is hardcoded true), removed in M8.
NEXT_PUBLIC_SITE_URL=…                      # Absolute base for share links / metadata

# ── AI agents ──
ANTHROPIC_API_KEY=…                         # Daily Brief, all agents, pump-report. Also settable in
                                            # Integrations → AI Providers (UI key wins over env).
# Other LLM providers, same resolution order via getProviderKey():
# OPENAI_API_KEY, GOOGLE_API_KEY, GROQ_API_KEY, XAI_API_KEY, DEEPSEEK_API_KEY,
# PERPLEXITY_API_KEY, MISTRAL_API_KEY, TOGETHER_API_KEY, COHERE_API_KEY

# ── Market data providers (all optional; all settable in the Integrations UI) ──
FMP_API_KEY=...                             # Uses FMP's /stable API (legacy /api/v3 is retired → 403). FREE tier: single-symbol quote/profile/history + earnings calendar. PAID only: batch quotes, company-screener, constituent lists, economic calendar. So a free key powers per-stock data & detail-page ticker resolution, but the broad Stock Registry universe needs a paid plan.
COINGECKO_API_KEY=…                         # Paid tier; COINGECKO_BASE_URL overrides the endpoint
# Equity quotes:  FINNHUB_API_KEY, TWELVE_DATA_API_KEY, TIINGO_API_KEY, ALPHA_VANTAGE_API_KEY
# Equity news:    MARKETAUX_API_KEY (company news on stock pages, T-430; personal use only, see sourceTerms.ts)
# Crypto/news:    COINMARKETCAP_API_KEY, CRYPTOPANIC_API_KEY, MESSARI_API_KEY,
#                 NEWSAPI_API_KEY, GNEWS_API_KEY, LUNARCRUSH_API_KEY, SANTIMENT_API_KEY
# Wallets:        TRONSCAN_API_KEY (TRON balances; env only, sent as TRON-PRO-API-KEY.
#                 Without it the TRON route calls nothing: Tronscan's terms require an
#                 account and its API rate-limits keyless requests, D105)
# Full env-var mapping lives in getProviderKey() (src/lib/api/live/providers.ts).

# ── Admin ──
FN_ALLOW_KEYLESS_COIN_PROFILES=true|false     # Default true. Set false to forbid the keyless
                                            # CoinGecko rung on /live-data/coin-profile, leaving
                                            # only the keyed CoinMarketCap path (2026-08-29 —
                                            # owner concern about relying on free-tier terms).

FN_ADMIN_TOKEN=...                          # (legacy CAEP_ADMIN_TOKEN still honored) Optional — sensitive endpoints (AI agents, provider config) require this token when the app is served from a non-localhost host; without it they are localhost-only (see src/lib/server/apiGuard.ts)
FN_SECRETS_KEY=…                            # 32 random bytes, base64: encrypts .provider-config.json
                                            # at rest (T-437). A Windows USER variable, outside OneDrive;
                                            # a host secret at launch. See "Server-side secret stores".
FN_BASE_URL=http://localhost:3000           # (legacy CAEP_BASE_URL still honored) Base URL the MCP
                                            # server and scripts call back into
```

**Password reset, without email (T-435, D123, 2026-10-15).** Sign-in had no reset, and after a
breach the only lever was rotating `AUTH_SECRET`. That signs everyone out but cannot make anyone
choose a new password. There is no email provider before launch (D21), so the owner issues links:

- `npm run auth:reset -- --user <email>` prints a one-time link, valid 60 minutes, to hand over
  directly.
- Adding `--force` also refuses that account's sign-in until it resets.
- `--all --force` does that for every account. It is the breach lever; pair it with rotating
  `AUTH_SECRET`.
- `--status` lists the accounts that must reset.

The rules are in `lib/auth/passwordReset.ts` (pure); the password rule is in `passwordPolicy.ts`,
shared with sign-up. The link's token travels after `#`, so it never reaches a server log or a
Referer header. Only its SHA-256 is stored, it works once, and using it spends every other link
for the account.

⚠ **Migration 0008 adds `password_reset_tokens` and `password_states`; run `npm run db:migrate`.**
The flag lives in its own table, never on `users`, deliberately: a new `users` column would break
every `select().from(users)`, sign-in included, on a database not yet migrated. Until 0008 runs,
sign-in works as before and the reset route answers 503 with the instruction.
Guarded, with mutations, by `lib/auth/__tests__/passwordReset.test.ts`.

**Creating an account requires agreeing to notices by email (T-436, D124, D127, 2026-10-17).**
North Carolina lets a breach notice go by email only to people who agreed to receive
communications electronically (G.S. 75-65(e)(2)), and the app holds no postal address or phone
number. `POST /api/auth/signup` refuses an account without `electronicConsent: true` and the
current `consentVersion`, and writes the account and the agreement in one transaction. The
agreement keeps its date and the exact words agreed to.

- The words are the Terms of Use's section 6 paragraph (`EMAIL_NOTICES_CLAUSE`) and the box's
  label (`SIGNUP_CONSENT`, `lib/legal/signupConsent.ts`), copied from the owner's document (D128).
  The Privacy Policy's section 2 names what is kept; a test pins the table's columns to it.
- `version` is a hash of those words, and a test fails if they change without it.
- `npm run auth:consent -- --status` lists who may be sent notices by email; `--withdraw --user
  <email>` marks a withdrawal and deletes nothing.
- There is no sign-up page yet (T-132); when it is built it must show that box, and a test holds
  it to that.

⚠ **Migration 0009 adds `communication_consents`; run `npm run db:migrate`.** It is its own table
for the reason 0008's are, so sign-in is untouched. Until it runs, sign-up answers 503 with the
instruction and creates nothing. Draft wording for counsel (D4). Guarded, with mutations, by
`lib/auth/__tests__/electronicConsent.test.ts`.

**Server-side secret stores** (gitignored, written at repo `frontend/` root):
`.provider-config.json` (provider API keys) and `.agent-prompts.json` (agent overrides).

**`.provider-config.json` is encrypted at rest when `FN_SECRETS_KEY` is set (T-437, D122,
2026-10-15).** The key is 32 random bytes, base64. Keep it in a Windows **user** environment
variable, not `.env.local`, which sits beside the file in the OneDrive folder; at launch it is a
host secret. The whole file is sealed with AES-256-GCM (`lib/server/secretBox.ts`,
`providerConfigCodec.ts`), and a plain file is rewritten sealed the first time it is read with the
key set. Without the key the file stays plain, and the Integrations page says so.

⚠ **A file the store cannot read is never treated as empty and never written over.** That covers a
sealed file with no key or the wrong one, a malformed key, or corrupt JSON. Data routes fall back
to environment-variable keys; every write is declined and logged once; the Integrations page shows
the reason, and its save returns 409. Before this, a corrupt file read as `{}` and the next save
lost every key. Lose `FN_SECRETS_KEY` and the saved keys go with it, so keep a copy somewhere safe.
Scripts read the file through `scripts/lib/providerConfigFile.mjs`, which only opens it. Guarded,
with mutations, by `lib/server/__tests__/providerKeyStore.test.ts`.

> **`.exchange-credentials.json` is gone (2026-08-18).** Exchange API linking was removed
> on security grounds: it stored an `apiKey` + `apiSecret` in plaintext at rest — the
> highest-value secret the app held — to power a read-only balance view that watched
> addresses already approximate from public chain data. The store, both
> `/live-data/wallet/exchange*` routes and `lib/server/exchangeCredentials.ts` were
> deleted, and the wallet store's v2 migration drops any persisted connection metadata.
> **If the file exists on a host from before this date, delete it by hand** — code does not
> remove files outside its own data, so nothing cleaned it up for you. See
> `docs/audits/rejected-proposals.md` RP-5. Do not reintroduce exchange key custody
> without an explicit decision reversing this.

Finance Now runs **live-only**. `LIVE_DATA` is hardcoded `true` in `lib/constants.ts` — there is **no** `NEXT_PUBLIC_USE_MOCK` / `NEXT_PUBLIC_LIVE_DATA` toggle and **no mock data path**. All market data comes from the `/live-data/*` route handlers; surfaces with no free real-time source show an explicit "not available" notice rather than fabricated values. See `DATA-AVAILABILITY.md`.

---

## Testing the Live Data Layer

```bash
npm run smoke   # quick subset (CI)
npm run audit   # full audit; also audit:strict and audit:json
```

**Fee reconciliation (owner machine — needs sec.gov):**

```bash
npm run fund-fees -- --inspect          # discover the dataset's tables/columns/tags; changes nothing
npm run fund-fees                       # reconcile the whole catalog → fund-fee-reconcile.json + fund-fee-worksheet.csv
npm run fund-fees -- --symbols XLC,VTIP # reconcile these tickers, catalogued or not (a candidate gets its SEC figure, no delta)
```

**It reads the newest FOUR quarterly archives, not one (T-411, 2026-09-26).** A fund appears in
the Risk/Return dataset only in the quarter it filed its prospectus, and most file annually, so a
single-quarter read is green and stale at once: the Select Sector SPDRs cut their fee to 0.08% in a
485BPOS filed 2026-01-28 (2026q1), the 2026-09-01 reconcile read 2026q2 alone, found nothing for
them, and six rows sat at 0.09 under a clean report until D27. Per ticker the newest quarter that
carries it wins (`scripts/lib/rrQuarters.mjs`, unit-tested); `RR_QUARTERS=n` widens, `RR_QUARTER=YYYYqN`
pins one; each quarter caches under `fn-rr-cache-<q>`. **The same pass fixed a second blindness:**
`ExpensesOverAssets` is the taxonomy's *Total Annual Fund Operating Expenses* and `NetExpensesOverAssets`
the total after a waiver, but the script had listed the total line as a fallback for *net* — and since
every archive carries the net tag for some fund, the total was never read and every no-waiver fund
(VOO, XLK, VTIP…) reported `no-expense-value`. That is how the 2026-09-09 run matched 27 of 126 and
read as thorough. Net is now taken where a waiver exists and the total otherwise.

**And it keeps BOTH figures (T-412, 2026-09-30).** It used to write only the one it compared, so no
run could tell a waiver from a fee cut — and D36 (a row records the fee paid today, and its
description states the full fee) needs exactly that distinction. Each row now carries net, gross
and a waiver flag, and the report lists every waiver with whether the catalog description states
the gross (`scripts/lib/feeWaiver.mjs`, unit-tested). A net with no total, or a net above its total,
is reported as unknown and sent to the filing — never classified by guess.

**And it knows what the data set cannot carry (T-417, 2026-10-14).** The data set stores four
decimal places while its `dcml` column keeps the filing's own precision, so a fee in thousandths of a
percent reads short: FXAIX's 0.015% is stored as `0.0001`, which read as 0.010% and was taken for a
fee cut (D39). A difference under one stored unit, on a row whose filing declared more places than
were kept, now gets its own section, "read the filing, change nothing"
(`scripts/lib/datasetPrecision.mjs`, tested). A real change of a hundredth of a percent is a whole
unit and still reports. Record: `docs/audits/fund-fee-reconcile-2026-10-14.md`.

`scripts/build-fund-fees.mjs` checks `FUND_CATALOG`'s expense ratios and finds its sales-load
rates against the SEC's quarterly **Risk/Return Summary** data sets — the prospectus fee table as
structured XBRL. It fills the gap `build-fund-facts.mjs` names: N-PORT carries no expense tag.

It **reports, never writes** — same split as `apply-fee-updates.ts`, because an automated fee
overwrite is how a correct number lands on the wrong fund, and share classes make that easy
(AGTHX/AGTFX/CGFAX). Matching is on the SEC CLASS id, resolved to a ticker through the SEC's own
`company_tickers_mf.json` — never a name or a number — and it never moves
`FUND_FEES_LAST_VERIFIED` (`FUND_DATA_LAST_VERIFIED` until D117 split it, 2026-10-14; see the Fund
Registry row). **Run `--inspect` first**: the tag and column names are candidates until
someone confirms them against a real archive.

⚠ The decimal-vs-percent unit is **declared by the dataset, not inferred** (changed 2026-09-09).
`num.tsv` states `uom` per row: `pure` means a decimal fraction (`0.0112` = 1.12%). That matters
because the two encodings overlap (`0.03` is either 3% or 0.03%, and 0.03% is VOO), so guessing
per value produces a silent 100× error on the cheapest funds.

The old rule calibrated against the catalog and needed 5 matched funds, aborting below that — which
made the unit "undecidable" for data that was never ambiguous, because ONE quarterly archive only
covers the funds that filed a prospectus that quarter (27 of 126 on the 2026-09-09 run). The
calibration is **kept as a cross-check**: where both are available and they disagree the run stops
rather than picking a winner, and a mixed or unrecognised `uom` also stops it instead of guessing.

Both run `scripts/test-live-data.mjs` (the old `scripts/smoke.mjs` was folded into it —
`smoke` is now just `--quick`).

**It calls every `/live-data` and `/api/v1` route except the ones in `NOT_AUDITED`**
(`scripts/lib/auditCoverage.mjs`), each named with its reason and printed at the end of every
run. Today they are the Pump Report's three paid AI routes and the two hidden rating routes,
which write to the database.
`auditCoverage.test.ts` fails on a route that is neither called nor named. Until 2026-10-14 the
script said "every" while 15 routes went uncalled, the MCP server's four among them. **A route
withheld by a recorded decision reads UNCONFIGURED with the decision named, never FAIL.** That
covers funding rates (D40), futures curves (Yahoo, on terms) and Reddit's robots gate. The
funding-rates check had failed the whole run since D40.

⚠ **The harness throttles its own CoinGecko calls, and the pacing is WEIGHTED per
check** (`scripts/lib/coingeckoPacing.mjs`, pure + tested with an injectable
clock). Two earlier models each looked right and weren't, and the symptom both
times was a healthy route reported as broken: first *adjacency* (pause only after
another CoinGecko check — backwards, a rate limit is a rate over a window), then
*one check = one call* — which fixed `alerts` and `portfolio-history` but not
`coin-discovery`, because `coin-list` issues **three** upstream page requests
inside a single check and the budget recorded one. The next check took the 429 that
belonged to its neighbour. Weights **mirror the routes** (`coin-list` = 3 pages,
`ohlcv` = 2 since its candles come only from CoinGecko's `/ohlc` + `/market_chart`);
keep them in step or the budget drifts back out. The weight is an upper bound on
purpose — an `ohlcv` check with `closes=1` may be served by DefiLlama and spend no budget
at all, and over-counting costs seconds while under-counting costs a 429 that reads
as a broken route. The run prints what the pacing cost, so the delay is never
mistaken for slowness and "optimised" back out.
>
> ⚠ **The minimum gap is DERIVED from the cap (`derivedMinGapMs`), and that was
> the third wrong model.** The gap and the cap are not independent knobs: a cap of
> "10 per 60s" beside a fixed 1.8s floor lets ten calls land inside **eighteen**
> seconds, so the cap never binds until the calls are already slow. Measured on
> the 2026-09-09 owner run — seven real CoinGecko requests inside 19.4s, a peak of
> **22/min under a cap reporting 10/min**, and the seventh refused. That is why
> two rounds of cap-tuning (8 → 10) barely moved anything: the gap was governing
> the rate the whole time. Spacing is now `window / cap`, so the cap means what it
> says; the sliding window stays as the backstop for bursts a single check makes
> internally. `AUDIT_CG_GAP_MS` still overrides for deliberate experiments.
>
> ⚠ **And the limit itself is still unread — but the reporting now covers every
> call site.** Four models were tuned against an allowance inferred from how many
> calls a run made before a refusal, which is a guess wearing the clothes of a
> measurement. `lib/server/coingeckoThrottle.ts` (`describeThrottle`) reports what
> a refusal actually states — rate-limit headers plus the body's `error_message` —
> and **every** CoinGecko route uses it. It first went into `coingeckoPages.ts`
> alone, and the very next run moved the 429 onto `alerts` and `portfolio-history`,
> which fetch CoinGecko directly, so the run still said `HTTP 429` and settled
> nothing. `__tests__/coingeckoThrottleReporting.test.ts` walks every CoinGecko
> route and fails any that builds a failure string from a bare status, so a new one
> inherits the requirement instead of rediscovering it. **Read that line before
> touching the cap again.**
>
> ⚠ **Known bound as of the seventh run: ~9 real CoinGecko calls in ~60s was still
> refused**, with `coin-discovery` passing (the derived gap fixed it) and `alerts`
> + `portfolio-history` taking the 429 instead. So the true allowance is BELOW the
> 10/min cap, and the next run's error line should say by how much.
>
> **Lower again on 2026-10-14: refused at the fifth CoinGecko request, after five or six
> real calls** (`docs/audits/live-data-audit-2026-10-14.md`). The 429s carried only
> `retry-after` and the message, no rate-limit headers, so the allowance is still unread,
> and it moves with CoinGecko's own load. At `AUDIT_CG_PER_MIN=4` all four routes it had
> failed passed or behaved as designed. Until there is a key, run
> `$env:AUDIT_CG_PER_MIN='4'; npm run audit`. A free Demo key raises the limit for the
> app as well (T-105); `coingeckoHeaders()` already sends it as `x-cg-demo-api-key`.
>
> **There is a key now: the owner saved a Demo key on 2026-10-15 (T-105, closed), and that
> day's run passed at the default pace with no refusal** (`live-data-audit-2026-10-15-t105.md`).
> So run plain `npm run audit`. The 2026-10-17 run was slowed to 4 a minute out of habit and
> spent 438 s waiting for nothing (`live-data-audit-2026-10-17.md`).

Run `npm run audit` before trusting any route, and read its
**REAL vs FALLBACK** classification rather than the HTTP status: a 200 carrying fallback data
is the failure mode that misdirects debugging to the UI layer. An earlier harness reported
43/43 PASS while several routes were quietly serving static catalogs.

This matters when judging AI agent output too — agent tools read the same `/live-data/*` routes
the UI does, so an agent giving vague answers off a FALLBACK route is a data problem, not a
prompt problem. Don't tune a prompt to compensate for a degraded feed.

**Staking upstream triage (owner machine):**

```bash
npm run staking-upstreams          # probe the route's upstreams directly; no dev server
npm run staking-upstreams -- --json
```

`scripts/probe-staking-upstreams.mjs` asks each of `/live-data/staking-rates`'s
upstreams the same question the route asks, **outside** the route, and groups the
answers by the cure — because the cures are mutually exclusive and the route
cannot tell them apart:

| Verdict | Cure |
|---|---|
| `no-rate` / `partial` | endpoint answered, but no usable number — **read the body excerpt the probe prints**, because two opposite cures land here. Either the field MOVED (reparse, keep the URL) or the endpoint carries no rate AT ALL (drop the rung). NEAR was the second: `api.nearblocks.io/v1/stats` is a healthy network-stats endpoint with no yield field in it, and this row used to assert "the field moved", which sent the reader hunting for something never there |
| `http-error` / `unreachable` | endpoint gone — find the new URL or drop the rung |
| `over-budget` | served a usable rate, just slower than the route's 6s — raise the budget, nothing to reparse |
| `timeout` | in the default SEQUENTIAL mode, that host really is slow; under `--parallel` it means nothing about the host |
| `blocked-here` | **our own egress policy refused it** — says nothing about the source |

**It probes SEQUENTIALLY by default, and that is load-bearing.** The route fires every
upstream at once under a *shared* 6s clock, and the 2026-09-09 audit showed the cost:
upstreams 1–5 answered and 6–17 "timed out", **in array order** — position decided
the outcome, so that was queueing, not host health. The sequential run then found
*why*: **four dead hosts whose DNS lookups hung ~10s each**, occupying Node's
4-thread resolver pool for longer than the whole budget. Removing them (nine rungs
went in that pass; NEAR made ten across the audit) was the fix — no healthy source was ever slower than 1.3s. The probe's first version fanned
out the same way and would have reported twelve healthy hosts as dead. `--parallel`
reproduces the route deliberately; the difference between the two runs is the
measurement of contention, and parallel mode names the array-order signature when it
sees it.

The `blocked-here` verdict is the same principle: a sandboxed run 403s on every host,
and reporting that as "endpoint gone" would be this probe committing the
misattribution it exists to catch. When half or more of the hosts are blocked locally the probe prints
"THIS RUN PROVES NOTHING ABOUT THE SOURCES" and exits **2** (inconclusive) rather
than 1 (sources broken) — a caller must be able to tell "the sources are down"
from "you ran this in the wrong place".

`lib/server/__tests__/stakingUpstreamProbe.test.ts` fails if the probe's URL list,
upstream names, or timeout drift from the route's — a mirror is only useful while
it matches, and a stale one looks authoritative while pointing at a source the app
no longer uses.

**DeFiLlama symbol resolution (owner machine):**

```bash
npm run llama-symbols              # which LLAMA_MAP keys no longer match a pool, and what does
npm run llama-symbols -- --json
```

`staking-rates` reports `defillama-yields: partial (19/25 live)` and names the
misses. Naming them is what made them fixable — but it stops one step short: that
`STKBNB` matched nothing does not say whether the **token was renamed**, the
**pool was delisted**, or the **chain label moved**, and those have three
different cures. `scripts/probe-llama-symbols.mjs` fetches the pool list once and,
per unmatched key, prints what DeFiLlama actually carries through three lenses —
same project staking that asset, same project any asset, similar symbol any
project. Nothing from that project at all means the rung is gone and should follow
the NEAR one out, on the same evidence standard.

It **reports, never writes** (same split as the fee scripts — an automated symbol
rewrite is how a rate from the wrong protocol lands on a coin), reproduces the
route's matcher exactly including the chain preference, and exits **2** rather
than 1 when DeFiLlama is unreachable — "you ran this in the wrong place" is not
"the symbols are wrong". `lib/server/__tests__/llamaSymbolProbe.test.ts` fails if
the probe's map drifts from the route's.

> **First run: 2026-09-09, over 17,193 pools. All six misses were REMOVALS, not
> renames** — `LLAMA_MAP` went 25 → 19 and now matches everything it asks for.
> Ankr is present with five products but no longer Solana; Stader has ETHX and
> MATICX but no BNBX; pSTAKE and Quicksilver are absent from the dataset entirely;
> Meta Pool appears only as `meta-pool-eth`. All six keep the static fallback they
> were already serving, so nothing regressed.
>
> ⚠ **The near-misses the probe printed were LP pairs, and they are traps.**
> `BNBX-WBNB` (thena-fusion) and `STKATOM-WETH` (sushiswap) are liquidity pools:
> their APY blends trading fees and incentives and carries impermanent-loss
> exposure, so publishing one as a "staking APR" is a category error, not an
> approximation. The route matches symbols EXACTLY so it cannot drift into one —
> but a maintainer reading probe output might paste one in.
>
> Seen and deliberately not acted on: **ANKRMATIC** and **MPETH/SPETH** are live
> pools with no key in the map. Adding them means new keys in the static table and
> on the staking page — a feature, not this cleanup.

**Agent evaluation (owner machine — D20, needs `ANTHROPIC_API_KEY`):**

```bash
npm run agent-eval                 # PLAN only — prints what would run, spends nothing
npm run agent-eval -- --run        # actually runs all 11. This costs money.
npm run agent-eval -- --run --only equity-research,macro-screener
```

`scripts/run-agent-eval.mjs` runs each of the 11 agents once on a **fixed** task and
writes `agent-eval-worksheet.md` with a blank verdict box per agent — the same
report-never-tune split as the fee scripts, because D20 says the owner judges. It
never edits a prompt, a model or a temperature. A run with `--only` writes
`agent-eval-worksheet-partial.md` instead, so re-running one agent never replaces a full
run's worksheet. An answer over 12,000 characters shows its opening and its last 3,000, where the
runner's cut-off notice would be, and a cut-off answer is marked (`scripts/lib/agentEvalAnswer.mjs`). The file starts with a byte-order mark so Windows PowerShell's
`Get-Content` reads it as UTF-8.

**The default does nothing on purpose.** Every run bills, and the failure mode for an
eval harness is being invoked by accident, so reaching the API takes an explicit
`--run`. Tasks are fixed rather than generated: an eval whose inputs move cannot be
compared across runs, which is the whole point of having one before a prompt change.

Exit codes follow the probe convention — **2 is inconclusive** (dev server down, no
key configured), **1** is a real failure. A dev server that is not running says
nothing about agent quality.

⚠ **Read the worksheet next to a fresh `npm run audit`.** Agent tools read the same
`/live-data` routes the UI does, so a vague answer off a FALLBACK route is a DATA
problem and tuning the prompt fixes the wrong layer. The worksheet records which
tools each agent actually called; **an agent that called none answered from its own
weights**, which is the specific failure worth catching — the text can read perfectly
well and still be untethered from this app's data.

⚠ **All 11 agents default to `claude-sonnet-5`**, from the single constant
`DEFAULT_ANTHROPIC_MODEL` in `lib/agents/prompts.ts` — the agent defaults, the
Integrations picker's first entry, the three `pump-report` route fallbacks and the eval
worksheet's header all read it, so the id exists in one place and a swap cannot
half-land. Owner decision 2026-09-17, taken **before** D20's run on purpose: an eval
against a model you are about to replace describes a config that will not exist by the
time anyone reads it. Sonnet 5 is newer than the 4.6 it replaces and **cheaper** — $2/$10
per MTok against $3/$15 — so the upgrade lowers the bill rather than raising it. The
picker's Opus option moved to `claude-opus-5` in the same pass. Haiku's dated id is
deliberately untouched: it works, and it is not what this decision was about.

⚠ **That swap broke every agent, and nothing noticed for a month (found 2026-10-17).**
Claude Sonnet 5, and every model after Opus 4.6, refuses a `temperature` with a 400
("`temperature` is deprecated for this model"), and every Anthropic request sent the
agent's saved one. The first `npm run agent-eval -- --run` found all of them refused; no
test reaches the paid API. **Send a temperature only through `anthropicSampling(model,
temperature)` (`lib/agents/sampling.ts`)**, which passes it only to Claude 4.6 and older
and to nothing it does not recognise. `__tests__/sampling.test.ts` fails on an Anthropic
`messages.create` that sends a bare one. The AI Agents tab says so under the slider when
the chosen model ignores it. Other providers (OpenAI-compatible) still get it.

**The first run that reached the agents (2026-10-17) is judged: `docs/assessments/T6-agents-2026-10-17.md`,
verdicts D136.** Most of what was wrong sat in the app, not the prompts, and is fixed: the runner joined
an answer's text blocks with line breaks, which split every sentence quoting the web
(`anthropicAnswerText`); an answer cut at its length limit looked whole (it now ends with
`CUT_OFF_NOTICE`); and three tools handed over figures without what an agent needs to report them
honestly, so each one now does. Each live network fee names its `provider`. The stock profile's
Wikipedia `background` carries its link and licence. The outlier screen's note dates the hand-kept
figures. The curve tool gives the comparison curves' spreads, and since D137 each maturity's change in basis points. **When a tool returns a figure an agent
will quote, return its source and anything it will be compared with already worked out**: an agent
credits the only source it is shown and does its own arithmetic badly. Three prompts were verdict
*tune* and changed in #377; the second run (2026-10-18, D137) kept all 11 and closed T-130 and T-001.
It also found two agents putting one yield move at +53bp and +8bp, which is why the curve's changes now
come worked out.

**Site terms check (owner machine, D140, needs an Anthropic key):** `npm run site-terms` plans and
spends nothing; `-- --run --limit 3` reads three sites and prints what they cost; `-- --run` reads
the rest, stopping when the next site would likely pass `--max-dollars` ($10 unless set). For every
website the Transfer Fee, Staking Facts and Fund Figures Checks link to (a prohibited one skipped),
an agent finds the terms and quotes what they say about software reading the site. This machine then
looks each quote up on the page, runs the keyword scan (`termsProbe.ts`) over it as a second reader,
and reads robots.txt itself. Before the agent starts, this machine also reads the site's home pages
for links that look like its terms and gives them to the agent, whose page opens and searches per site
are fixed (`FETCH_USES`, `SEARCH_USES`) and stated in its instructions: the first paid run (2026-10-20)
spent them on home pages and examples and never reached Kraken's or Vanguard's terms. A "not found"
that only means they ran out gets no ruling box; the worksheet lists it under "Read again" with the
`--redo` command. So does one whose web tools failed: on the full run (2026-10-20) every call failed
on 22 sites, Fidelity's and Trezor's among them, with no error code kept. Each failed call's code is
kept now (`toolErrors`), and the codes settled it: the newer `_20260209` tools, which filter a page in a
code sandbox, failed with `invalid_tool_input` on 9 of 10 sites re-read with them, and the basic
versions on none of the 22, at about half the cost. **So the basic tools are the default
(`DEFAULT_WEB_TOOLS`, 2026-10-21)**; `--web dynamic` still asks for the newer ones. The owner rules
each site in `site-terms-worksheet.md` (repository root,
gitignored, beside `site-terms-results.json`, which a rerun keeps). The rulings themselves are kept
in `site-terms-rulings.json`, which no reading rewrites (2026-10-21): every run first copies in the
boxes ticked and notes typed on the worksheet, `-- --rule allowed=a.com --rule not-allowed=rest`
records them without reading anything, and a site read again after a ruling asks for a new one. A
reading short of "forbids" whose page the keyword scan finds a ban in is marked ⚠: Invesco's read
"conditions" from search excerpts while its terms ban "data mining, robots, or similar data gathering
and extraction tools". It decides nothing and reads no
figure. Rules and tests: `scripts/lib/siteTerms.ts`, `lib/server/__tests__/siteTerms.test.ts`.

**The owner's rulings (D141, 2026-10-21): 4 Allowed** (vanguard.com, ssga.com, sectorspdrs.com,
proshares.com), 84 Not allowed, 3 with no reading. Every site behind the Transfer Fee and Staking
Facts Checks is Not allowed, so **the pre-fill (step 2) reaches only the Fund Figures Check**:
`npm run fund-figures-prefill` plans and spends nothing; `-- --run --limit 4` reads one page per
Allowed site. It reads only a page on a site ruled Allowed on the reading in force, from the owner's
machine, as FinanceNow, where robots.txt lets FinanceNow, and never skips the terms gate. A model
copies the figures out of the page's text without being shown the catalog's; a figure is kept only
when its quote is in that text and holds it, its date only when written in what was quoted, and only
if the check page itself (`fundFigures.core.js`) would accept it. It writes
`fund-figures-suggestions.json` (repository root, gitignored) and nothing else. Vanguard's pages carry
their net assets in a data attribute the browser draws from (`pageTextOf` decodes it) but not their
yields, which load later in the browser. ⚠ **Never force a tool choice on Claude Sonnet 5.5, Opus 5.5
or Fable 5.1**: they refuse `tool_choice` `any` or `tool` with a 400, which is how the trial's first run
ended (2026-10-21). The pre-fill asks for structured output instead (`output_config.format`,
`FIGURES_FORMAT`) and reads it with `answerFromResponse`. Rules and tests: `scripts/lib/figurePrefill.ts`,
`lib/server/__tests__/figurePrefill.test.ts`.


**⚠ STANDING RULE — paid decisions are deferred; no provider may be load-bearing (D21,
owner, 2026-09-18).** Anything whose remedy is "buy a plan" is not a defect to chase
now: record it and move on. The correct state for a surface blocked only by a paid tier
is an honest empty or a disclosed fallback, never a purchase. The other half is the
standing requirement: **build so that dropping any one vendor degrades a surface rather
than removing it.** That is measured, not asserted — `npx tsx scripts/gen-coverage-matrix.ts`
prints a "Strands if dropped" column per vendor, and those counts are the ones to drive
to zero. Four surfaces were single-sourced when the rule was made; `security-returns` is
the only one with no fallback at all. Full reasoning, and the measured provider coverage
behind it, in `docs/decisions/2026-09-18-owner-decisions.md`.

⚠ **That column sees only degraded surfaces and the keyed vendors that could fix them**, so
a keyless vendor carrying a surface that works never appeared in it: DefiLlama under the crypto
charts did not (T-434). Since 2026-10-14 (T-439, D110) the matrix prints a second table,
"Working surfaces one vendor carries", over every surface the audit found working, keyless
vendors included, split into what dropping the vendor would empty and what it would only
degrade to a hand-kept table. Its first run counted **16 working surfaces with nothing behind
their one vendor, five of them CoinGecko's alone** (`docs/audits/coverage-matrix-2026-10-14.md`).
Which providers count as sources is in `scripts/lib/workingSources.ts`, tested. **Ranges are
counted too (D112):** a provider's optional `limits` in `dataSources.ts` (`historyDays`,
`intervals`) say what it cannot serve that others on its surface can, and a third table,
"Ranges one vendor carries", lists each range left with one vendor or none. Before D108 it would
have shown DefiLlama alone for crypto history past 365 days; a test holds that case. A limit
nobody records is not seen, so set `limits` when adding a provider that has one.

**⚠ Data-availability results are IP-dependent — audits MUST run on the owner's machine.**
LunarCrush blocks datacenter IPs and the cloud gateway blocks most provider hosts outright, so a
cloud or CI run produces a systematically wrong baseline of "which sources work." Code reading,
design, and spec work are fine remotely; "which data sources actually work" is not.

Two caveats that are **not** cloud artifacts, so an owner-machine run does not clear them
(2026-09-09, `docs/audits/live-data-audit-2026-09-09.md`): **Binance.com's 451** is a US
geo-block, so for a US owner the Binance.US fallback was the steady state, not a degraded run
(moot since 2026-10-13: neither Binance host is fetched, T-423);
and **Reddit's absence is our own robots gate**, not a rate limit — it lifts only with
`REDDIT_CLIENT_ID`. Both were previously filed under "datacenter IP", which sent debugging
after a network fault that was never there.

**⚠ "The owner's machine" is not the same claim as "the owner's IP" — CHECK THE EGRESS
FIRST (2026-09-10).** A machine sitting behind a VPN measures a proxy IP, which is the
same systematically-wrong baseline this warning exists to prevent, just from a different
address. The whole 2026-09-09 audit ran through a Bitdefender WireGuard tunnel
(`bdvpnservice_2`) egressing from AS62651, flagged `proxy: true`, and its reachability
rows were wrong in BOTH directions:

```bash
curl -s https://api.ipify.org                                   # what the world sees
curl -s "http://ip-api.com/json/<ip>?fields=isp,org,proxy,hosting"
```

⚠ **DO NOT RUN THAT IN POWERSHELL — `curl` is an ALIAS for `Invoke-WebRequest` there**,
and this repo is maintained from PowerShell. It does not fail cleanly: `-s` binds as a
parameter and swallows the URL, so the line dies with *"missing mandatory parameters:
Uri"* rather than "command not found". A check that misfires while looking like a check
is worse than no check — and this one is the gate deciding whether an entire
data-availability audit is valid. Use the real binary (`C:\Windows\System32\curl.exe`,
present on Windows 10+) or the native cmdlet; both verified 2026-09-20:

```powershell
$ip = curl.exe -s https://api.ipify.org                          # note the .exe
curl.exe -s "http://ip-api.com/json/$ip`?fields=isp,org,proxy,hosting"

# or with no curl at all
$ip = Invoke-RestMethod https://api.ipify.org
Invoke-RestMethod "http://ip-api.com/json/$ip`?fields=isp,org,proxy,hosting"
```

If `proxy` or `hosting` is true, it is not an owner-machine baseline no matter which
machine ran it.

| Host | Behind the VPN | On the residential IP |
|---|---|---|
| `mempool.space` (BTC fees) | TCP dropped on 80 AND 443 — BTC read `estimate`, and every `network-fees` call paid an 11s timeout | **live, 129ms** |
| `publicnode.com` (keyless EVM RPC) | worked | **refused at the Cloudflare edge**, v4 and v6 alike, >3 min |


> ⚠ **Re-measured 2026-09-12 on a DIFFERENT VPN, and the mempool.space row above does
> not generalise.** Through Netprotect / **AS22781** (`proxy:true`), `network-fees`
> returned `18 networks, 5 live / 13 estimated` and the cross-layer check reported
> `bitcoin fee is live (mempool.space) source=live` — no TCP drop, no 11s timeout, no
> `estimate` fallback. The 2026-09-10 observation was made through **Bitdefender
> WireGuard, AS62651**. So mempool.space was refusing *that exit node*; "behind the VPN"
> was never the right variable, and the table above should be read as one exit node's
> behaviour rather than a property of VPNs or of the host.
>
> The publicnode row DOES hold up: the short hostnames answered from both a second VPN
> and a second residential ISP (Charter/AS11426), which is the reason the ladder puts
> them ahead of the `-rpc` variants. That preference is now measured twice, not argued.
>
> Same run, both egresses: **67 checks, exactly one differed** — `wallet tron`, a
> transient `Tronscan HTTP 429` on the residential IP, reproduced with a single call
> against Tronscan directly, so not something the audit's own burst provoked. Full
> record: `docs/audits/live-data-audit-2026-09-12.md`. The VPN also cost **2.56×** in
> wall time, so a "slow" route on a VPN run may be the tunnel, not the upstream.

Both are IP-scoped and neither host was ever down. Two lessons worth keeping:

1. **A host that answers ICMP but drops TCP is filtering you, not broken.** mempool.space
   completed a traceroute (hop 14, 104ms) while refusing every connection — which is why
   "the route is blackholed" and "DNS is hijacked" both looked plausible and both were
   wrong. Test the layers separately: DNS across three resolvers, then TCP, then TLS.
2. **The audit can provoke the failure it then reports.** A burst of RPC calls earns a
   per-IP rate-limit ban, and the next run records "provider down".

⚠ **publicnode: the third wrong attribution, and the correction matters more than the
fix (2026-09-10).** The claim recorded here was that `ethereum-rpc.publicnode.com` and
`polygon-bor-rpc.publicnode.com` are dead hosts, failing the TLS handshake while the
other five `-rpc` names answer 200. **They are not dead.** Re-tested the same day from a
different egress:

| host | residential IP | via VPN |
|---|---|---|
| `ethereum-rpc.publicnode.com` | TLS fails | **200** |
| `polygon-bor-rpc.publicnode.com` | TLS fails | **200** |

They were refusing ONE IP, and they are publicnode's two busiest endpoints — which is
what a per-IP rate-limit ban looks like right after `npm run audit` has hammered them.
The five quieter `-rpc` hosts were never near a limit, which is exactly why the failure
looked host-specific rather than IP-specific.

The ladder keeps the short hostnames regardless, because they answer from **both**
egresses and are therefore the safer first rung.

**Three wrong attributions in one day, all the same error**: mempool.space "down" (it was
VPN-blocked), publicnode "dead" (IP-rate-limited), Polygon "missing a fallback" (it had
three). Each time a single observation was read as a property of the world.

⚠ **And the first correction was itself too broad** (2026-09-12). "mempool.space was
VPN-blocked" replaced a claim about the HOST with a claim about VPNs — still a category
wider than the evidence. It was one exit node: the host answers fine through a different
VPN (AS22781). The narrowest true statement is *"AS62651 could not reach mempool.space on
that date"*. Worth keeping as its own lesson: **correcting an over-broad claim with
another over-broad claim feels like rigour and is not.** Ask what the narrowest statement
the evidence supports actually is, then write that one down.

Two habits that would have caught all three:

1. **Re-test from a second egress before concluding anything about a host.** "I tested it
   and it failed" is evidence about the path, not the host.
2. **Report counts, not conditions.** "All RPC endpoints failed" never said how many there
   were, so one dead rung and three read identically — see the derive-the-count rule
   below.

---

## Stale Time Constants (from `src/lib/constants.ts`)

```typescript
STALE_TIME_SHORT  = 30_000   // 30s  — prices, volatile data
STALE_TIME_MEDIUM = 60_000   // 1m   — news, social
STALE_TIME_LONG   = 300_000  // 5m   — fees, staking rates
GC_TIME           = 600_000  // 10m  — query cache retention
```

---

## Styling Conventions

Tailwind with custom CSS variables defined in `globals.css`:
- `bg-bg-card`, `bg-bg-elevated`, `bg-sidebar-gradient` — surface colors
- `text-text-primary`, `text-text-secondary`, `text-text-muted` — text hierarchy
- `border-border`, `border-border-hover` — border colors
- `text-accent-blue`, `bg-accent-blue` — primary accent (#3b82f6)
- `w-sidebar` — sidebar width constant

Risk/status color convention used across the app:
- **Emerald** (`emerald-400`) — low risk, positive, safe
- **Amber** (`amber-400`) — medium risk, warning
- **Orange** (`orange-400`) — high risk
- **Red** (`red-400/500`) — critical risk, danger, defunct

---

## Feature Inventory (what exists)

> **Data-status source of truth:** `DATA-AVAILABILITY.md` (repo root) is the authoritative,
> regularly-regenerated record of what is 🟢 Live / 🟡 Partial / 🔴 Not available. Consult it,
> not this table, when in doubt. Finance Now is live-only — there is **no mock/demo data path**;
> "Mock" labels in older docs are obsolete.

| Feature | Route | Status | Source / Notes |
|---------|-------|--------|----------------|
| Headlines | `/headlines` | 🟢 Live | **Landing page** (`/` and post-login redirect here). Client-side merge of `/live-data/news` (crypto) + `/live-data/market-news` (equities) into a cross-module "Top Stories" strip plus a section per enabled module. Sections follow the entitlement store, so the feed reflects the user's bundle. Funds has no general feed of its own and shares the Markets section. Replaced the old `/dashboard` page; its `components/dashboard/*` widgets are **all gone and the directory is empty** — the six M8-sweep widgets first, then `RiskHeatmap`. (This clause said "retained but no longer routed" until 2026-09-22, while the directory tree at the top of this file already said EMPTY.) `RiskHeatmap` — the last one still reachable, via `PopoutContent` — was deleted on 2026-08-18 (item 4: a grid ranking every coin by risk band is a leaderboard in another shape). |
| Coins (Coin Registry) | `/assets` | 🟢 Live | Nav label "Coins"; route path kept as `/assets` to preserve deep links. Market-breadth KPIs, asset-type chips + inline screener, sortable/paginated table (Stock-Registry-standard layout), Reserve Monitor tab. **No Safety Score / Risk Band columns and no score screener** — removed 2026-08-18 (item 4); a sortable score column over the universe is a leaderboard. **No per-coin risk score is published anywhere as of 2026-08-29 (RP-6)** (the coin page's Pump Report tab is the one exception the owner chose, under D70: its "collapse risk" grade is kept as an alert about pump activity, not as a risk rating) — owner: a risk figure on an asset the reader is viewing may be seen as a recommendation, a regulated activity. Removed: the header Safety Score gauge, the identity band pill, the search-result score, the Composite Risk panel, `/live-data/risk-scores`, `lib/api/live/riskScores.ts`, `useRiskScoreIndex`, `RiskScoreBadge`, and the `Asset.riskScore` / `riskBand` fields themselves (permanently-null fields invite a future "N/A" that reads as missing rather than withheld). **`lib/risk/` stays** — the options Trade Risk Scorer and the macro profiles that derive Portfolios' 1–10 tiers are separate decisions, and **both have been switched off since 2026-10-04 (D64)** with their code kept, until the risk engine is rebuilt (`lib/risk/visibility.ts`) (this said "staking-provider risk and the macro/equity profiles" until 2026-09-29: D26 removed staking risk on 2026-09-25, and the equity profile has no consumer). Guarded by `lib/risk/__tests__/riskScoringRemoved.test.ts`. Live prices; metadata from static `assetCatalog.ts` (reference data, not mock) |
| Coin Detail | `/assets/[id]` | 🟢 Live | Price, OHLCV chart, per-coin news, and a **Pump Report tab** (see the Pump Report row): an AI fraud search on the coin and, for the 20 coins `/live-data/pump-report/metrics` covers, a live 0–10 pump signal and "collapse risk" grade from 24-hour price and volume. This row did not mention the tab until D70 (2026-10-04) |
| Risk Scores | ~~`/risk-scores`~~ | ⚪ Removed | **Page deleted 2026-08-18** (P3-W2 short-list item 4); `/risk-scores` redirects to `/headlines`. Owner: *"these scores may represent a recommendation, which is a regulated activity."* The line drawn was **ranking vs explanation** — a leaderboard over a universe goes, scoring a coin the reader opened stays. `/live-data/risk-scores` was retained at the time for the per-coin panel; **both were removed on 2026-08-29 (RP-6)** — see the Coins row. See `docs/audits/rejected-proposals.md` RP-3 and the review's Appendix E |
| Reserves | `/assets?tab=reserves` | 🟢 Live | Reserve Transparency Monitor — DefiLlama stablecoin supply + collateralization (`/live-data/reserves`). **A tab inside Coins, not a page.** The standalone `/reserves` page was folded in on 2026-07-29 (`/reserves` → `/assets?tab=reserves`, `next.config.mjs`); no separate nav entry. ⚠ **All reserve UI lives in `components/analytics/reserves.tsx` — do not re-inline it.** Three hand-maintained copies existed and only the orphaned page ever got the fixes, so the two surfaces users actually reach carried the bugs: peg-mechanism badges keyed on `_` while the feed sends `-` (8 of 9 coins unstyled), a KPI reading "Verified Attestations … by third-party auditor" for something nobody verifies, a header claiming the whole table was live when only supply is, and no provenance at all. `ReserveProvenance` is mandatory on any surface showing attester/date/collateralization — those come from the `stablecoinMeta` snapshot, not the live feed |
| Alerts | TopBar bell | 🟢 Live | `/live-data/alerts` — stablecoin depegs + major-asset 24h moves; surfaced in the TopBar bell (no standalone page) |
| Watchlist | `/watchlist` | 🟢 Live | Cross-module: coins, stocks, ETFs & funds, and macro instruments in named lists with live prices. **DB-backed** via `/api/user/watchlists` (+`/[id]` PUT/DELETE) through `useWatchlistStore` (optimistic, client-UUID ids, one-time localStorage import that MERGES even into a non-empty account — see store comment). Feed bias (`lib/watchlist/bias.ts`) and the Daily Brief read the store, not localStorage |
| News | `/news` | 🟢 Live | Multi-provider RSS/JSON; sentiment + asset detection. Stories about tokenized securities are filed under **Tokenization** and tag the catalog stock they name (TS-13, 2026-10-01) — see News Feed Architecture |
| Social | `/social` | 🟡 Partial | `/live-data/social`. **Live:** Reddit post text/link/author/timestamp (Atom feeds, keyless but robots-gated — see below), and the social VOLUME figures from Santiment (`mentionsCount`) and LunarCrush (`social_volume_24h`, `galaxy_score`), both **key-gated**: with no key those signals are absent, not zero. **Derived:** every sentiment label. Reddit's is a keyword regex over the post text; LunarCrush's is a threshold on galaxy score (≥60 / ≤35) rather than the provider's own `sentiment` field; Santiment's is hardcoded `neutral`. The per-asset `sentimentScore` aggregates those derived labels, so it is derived twice over. **Neither live nor derived:** Reddit `score` is a literal 0 and `upvoteRatio` is never set — Atom carries no vote data, and both are sentinels the pages render only when present. Reddit itself is gated off in `pinnedFetch` unless `REDDIT_CLIENT_ID` is set (its robots.txt disallows this app's agent, 2026-08-29 terms review). |
| Global | `/global-adoption` | ⚪ De-routed | Access removed (T5) pending a post-production rework — a mislabeled CBDC tracker on stale/duplicated static data with a fabricated live timestamp. Page and `/live-data/cbdc-data` route were both **deleted 2026-09-14 (D10)**; `/global-adoption` still redirects to `/headlines` so bookmarks land. See `docs/assessments/T5-utility-triage.md`. |
| Transfer Fee Calc | ~~`/transfer-fees`~~ | ⚪ **Hidden from rollout** | Static fee table (`transferFees.ts`) + live token prices; staleness-labeled. **Live withdrawal-fee overlay** (`/live-data/withdraw-fees`, the keyless feeds in `WITHDRAW_FEE_SOURCES`, all confirmed on the owner's probe 2026-08-22; RP-5 forbids keyed endpoints) — overlay-only, per-row `live` tags. **Open or closed is assumed unless an exchange reports it**: withdrawal status on the sending side and, since D66 (2026-10-04, T-054), deposit status on the receiving side, from the feeds marked `reportsDeposits`, are read live where published and tagged per route. A route an exchange reports closed renders as blocked with attribution instead of vanishing, and the notice is deliberately NOT gated on fee staleness. The deposit field names come from each exchange's API documentation; `npm run fee-probe` on the owner's machine confirms them (T-422). Tax-character panel (`lib/data/taxCharacter.ts`) states what kind of event each leg is, with no numbers |
| Staking | `/staking` | 🟡 Partial | **Two tabs since 2026-08-20 (W3-3):** Providers (curated catalog, live APR where available, defunct toggle) and Live Pools (on-chain opportunities via `/live-data/staking-discovery`). Curated catalog is staleness-labeled (`getStakingDataProvenance()`) |
| Staking Discovery | ~~`/staking-discovery`~~ | ⚪ Merged | **Merged into `/staking` 2026-08-20 (W3-3, option B)** — its curated directory duplicated the Staking page's provider cards; the live on-chain pool discovery became the **Live Pools tab** on `/staking` (`?tab=pools`, content-preserving redirect). The defunct-platform toggle (Celsius, the cautionary example) moved to the Providers tab. `/live-data/staking-discovery` unchanged |
| Coin Discovery | `/coin-discovery` | 🟢 Live | Candidate coins from live market data — facts only, no score (see below; this cell opened "Scored candidate coins" until 2026-09-29). **Tokenized securities are left out (TS-3, 2026-10-07)** and listed on the page with the reason: members of CoinGecko's seven tokenized stock, ETF, Treasury, money-market, credit, private-credit and pre-IPO categories (`lib/server/tokenizedSecurities.ts`, cached a day). Tokenized gold and silver stay in, being commodity tokens. If the categories cannot be read nothing is left out and the page says the check did not run. Measured: `docs/audits/tokenized-securities-probe-2026-10-07.md`. **Coin links point at the project's own site, not CoinGecko (2026-08-29)**, and each card carries an on-demand "About this project" panel — description, category tags, official site and whitepaper — from `/live-data/coin-profile`, a **two-rung ladder**: (1) **CoinMarketCap** when `COINMARKETCAP_API_KEY` is set — keyed, licensed and genuinely bulk (`/v2/cryptocurrency/info`, 1 credit per 100 coins), with identity resolved by `lib/utils/coinIdentity.ts`, which matches on symbol + name + **market-cap agreement** and **declines rather than guesses** (a wrong match would attach another project's website to a coin); (2) **CoinGecko** `/coins/{id}` per coin, keyless — switchable off with `FN_ALLOW_KEYLESS_COIN_PROFILES=false`, after which an unresolved coin renders an honest blank with its reason instead of reaching for a free-tier source. A coin CMC can't identify is reported as unresolved *with the reason*, so "we couldn't tell which project this is" never looks like "this project published nothing". Descriptions are sanitized to plain text and sentence-truncated (`lib/utils/coinDescription.ts`, pure + 14 tests) — never rendered as HTML. CoinGecko stays linked and labelled as the data source, which its free-tier terms require. **Verdict vocabulary retired 2026-08-18, then the score itself cut 2026-08-20** — two steps, and conflating them is why this entry was wrong until 2026-09-12. Item 5b renamed the four verdicts ("Strong Add / Consider / Monitor / Too Speculative") to score bands, because a verdict tells the reader what to *do*. W3-1 then removed the **composite score** outright — owner: *"remove any reference to a score because it may imply a recommendation. Replace with price, growth, or liquidity."* So there is **no score and no band on this page**; `CandidateCoin` reports price, growth, volume, liquidity ratio, market cap and the factual category/utility note, and the reader sorts over facts (default: the feed's own market-cap order). This entry previously described `profileBand: high/moderate/low/very-low` as live, which it has not been since 2026-08-20. `AddedCoin.score`/`.profileBand` survive in the store as **write-never legacy keys** so coins a user saved before the cut keep what they saved — read defensively, never populated |
| Technical Analysis | `/technical-analysis` | 🟢 Derived | Trend/S-R/patterns computed client-side from live OHLCV. **The scanner is no longer a tab here** — see below. ⚠ **The Backtest tab is HIDDEN (2026-08-20)** — one of the three backtest surfaces that went dark together; this row said "backtest" as though it shipped, contradicting the Strategy Backtests row below. `BacktestPanel` and `lib/utils/backtest.ts` are retained in place and `page.tsx:101-103` carries the restore instructions; `DATA-AVAILABILITY.md` classes crypto backtests 🔴 Not available |
| Crypto Scanner | `/scanner` | 🟢 Derived | Items 6/7 (2026-08-19): one scanner per section, promoted to nav. Three timeframes, bounded-concurrency scan, auto-refresh (its source is keyless). **Reads DefiLlama closing prices since 2026-10-13 (T-423, D103)**, so of the seven shared setup detectors it runs only those that read a close (`SETUPS_FROM_CLOSES`), and its signal counts only the votes that do (`SIGNALS_FROM_CLOSES`), for every coin alike; the setups needing a high or a volume are named on the page as not run. A scanner sweeps a universe to find candidates; the TA page charts the one you picked. **Screener filters** (`lib/data/scannerFilters.ts`, pure + 12 tests): visible coin range, market cap, FDV, 24h volume and 24h change — applied BEFORE the sweep, so filtering cuts OHLCV requests rather than just shortening the table. CMC's Networks/Category/Exchange/Volume-change/Age filters are deliberately ABSENT with the reason shown on-page (no source for those fields; an inert control would imply a narrowing that never happened). Coins with no market data are counted as 'not tested', never folded into 'excluded'. Its universe is the app's own catalog (`COINGECKO_IDS`), not CoinGecko's top 750; a catalog entry filed `assetType: 'tokenized'` (USDY) carries a "Tokenized security" label (TS-3) |
| Portfolios | `/portfolios` | 🟢 Live | Live prices + history (`/live-data/portfolio-*`). **DB-backed** via `/api/user/portfolios` (+`/[id]` PUT/DELETE): store keeps its sync Zustand interface via optimistic mutations + client-UUID ids; consumers call `hydratePortfolios()` on mount; one-time localStorage import. Holdings resolve through the instrument layer (`lib/server/instrumentResolve.ts` — global rows, cgId round-trips via `instrument_crypto.coingecko_id`). **All-asset-class since 2026-08-29:** the add-search covers all 7 instrument classes plus live lookups (`coin-search` for any CoinGecko coin, `stock-universe?symbol=` for any quotable ticker — the latter answers catalog-only without an FMP key); breakdown slices by class with crypto split by category; weighted risk averages only holdings with a vetted tier and discloses `riskCoveredPct` — non-catalog additions get `riskTier: null`, never a defaulted 5. ⚠ **The ratings, the weighted risk and the two warnings read off it are switched off since 2026-10-04 (D64)** until the risk engine is rebuilt; the computation stays and the Analysis tab shows the concentration figures alone. Entry-price inputs label the quote unit (¢/%/pts/fx), since macro instruments aren't USD prices. **Look-through tab** (`lib/data/lookThrough.ts`): true underlying-issuer exposure across held funds + direct positions, a "held twice over" callout, and per-fund coverage. Weights are target allocations (stated on the panel). A partial holdings list is **never scaled to 100%** — the unexplained tail is reported, not redistributed **Trade history, built 2026-10-04 (T-027; D12, D65): `/portfolios/tracked`** (nav: Portfolios → Tracked). FIFO for every portfolio, in a new kind of tracked portfolio where anything already owned is entered once as a starting position, the oldest lot; today's what-if portfolios are never converted. Gains are plain, labelled `REALIZED_METHOD_LABEL`, not adjusted for tax rules. The lot engine is `lib/data/costBasis.ts` (exact decimal arithmetic, tested). Trades save through `/api/user/tracked-portfolios` (+`/[id]`, `/[id]/trades`, `/[id]/trades/[tradeId]/cancel`), with the input rules and the live-price valuation (`valueLedger`) in `lib/data/tradeLedger.ts` (tested): a mistake is cancelled, never edited or removed; one starting position per holding; only coins, stocks and funds; a holding with no live price is left out of value and unrealized gain, never valued at cost. The screen is `components/portfolio/tracked/`; its instrument search is shared with this page's (`components/portfolio/useInstrumentSearch.ts`). ⚠ **Migration 0005 adds its tables — run `npm run db:migrate` on the owner's machine**; until then those routes answer 503 with that instruction, the page says so, and every existing page is unaffected. A tracked portfolio is marked by a row in `tracked_portfolios`, not a column, and the what-if routes leave it out. **Splits since 2026-10-07 (T-421):** a split or reverse split is its own kind of entry (`side: 'split'`), a ratio and the date it took effect. Every unit acquired before that date changes by the ratio and keeps its cost; trades dated that day are already in the new units; cash paid instead of a fraction of a unit counts as a sale of that fraction, oldest units first. The ratio lives in `trade_splits`, read only for split rows, so ⚠ **migration 0006 is needed only to record a split** — until it runs, saving one answers 503 with that instruction and nothing else changes. Mergers and spin-offs are not handled |
| Pump Report | `/pump-report` | 🟢 Live | Public fraud-intelligence scan + chat over wallet addresses (`/live-data/pump-report/*`, own agent loop). **Promoted to its own page 2026-08-22**: it was a tab on `/wallets` and went dark when that page was held out of the rollout, purely because it had no route. The page reads saved wallets from the DB-backed store but carries **its own address entry**, so it does not depend on `/wallets` being reachable. **Ships in the initial rollout, coin tab included (D70, 2026-10-04, T-176)**: the owner's purpose for it is to work against day trading and meme trading by alerting users that an asset is being targeted, and its scores stay outside D64's risk-ratings switch on that reading. The coin tab is the Pump Report tab on `/assets/[id]` (see Coin Detail) |
| Wallets | ~~`/wallets`~~ | ⚪ **Hidden from rollout** | **Hidden 2026-08-22** (owner), same posture as Transfer Fees — kept, not deleted; `/wallets` redirects to `/headlines`. On-chain balances for watched addresses + connected browser wallets (`/live-data/wallet/*`). `/api/user/wallets` is deliberately left up: user-data CRUD carries no staleness harm and saved addresses survive the hide. **DB-backed** since 2026-08-18 (NT3) via `/api/user/wallets` (+`/[id]` PATCH/DELETE) — optimistic store, client-UUID ids, one-time `fn:wallets` localStorage import that merges additively. **Exchange API linking removed 2026-08-18** on security grounds — see the secret-stores note above |
| Research / Agent Config | `/research`, `/agent-config` | — | Crypto + equity research agents; AI Agents tab configures all agents (see "AI Agents" section) |
| Risk Case Studies | `/backtests` | ⚪ Removed | Deleted (2026-07) — static educational replay of 3 depeg events with no clear user value; `/backtests` redirects to `/headlines`. Recoverable from the `archive/pre-reset-main` branch if ever wanted — the deletion predates the 2026-08-05 re-root of `main` (see "How Changes Land"), so it is not in `main`'s own history. (Equities Strategy Backtests at `/equities/backtests` are unrelated. That page is **retained but HIDDEN since 2026-08-20** — `/equities/backtests` redirects to `/equities`, so no user reaches it. "Remain" read as reachable; see the Equities table.) |
| Videos | `/videos` | 🟢 Live | Video search + AI analysis (`/live-data/videos`, `video-search`, `video-analyze`) |
| Data Sources | `/data-sources` | — | Per-provider status and utilization, read from the provider registry |
| About & Legal | `/about` | ⚠ **Draft copy** | **Built 2026-10-01 (D50, T-293); replaced How We Make Money**, whose address now redirects to `/about#how-we-make-money`. Ten sections in the order of the owner's draft (who we are, how we make money, not investment advice, regulatory status, data credits, privacy, terms, questions and complaints, policy updates, open-source notices), with the full Terms of Use, Privacy Policy and Not Investment Advice at `/about/terms`, `/about/privacy`, `/about/not-investment-advice` and a licence list generated from `package-lock.json` at `/about/open-source`. Reached from a footer on every page (`SiteFooter`, in all three layouts) and from Settings → About & Legal. Lives in the **`(legal)` route group, outside the dashboard's sign-in gate**, so a signed-out visitor can read the Privacy Policy once sign-in is on. ⚠ **The text is Draft v1 of the owner's disclosure set (T-291), copied as written, and is NOT in force**: `lib/legal/disclosures.ts` keeps `DISCLOSURE_STATUS = 'draft'`, the bracketed blanks ([COMPANY LLC NAME], [CONTACT EMAIL]…) render highlighted, and a "Draft — not yet in force" notice listing them shows until the owner approves the set AND no blank is left (`disclosuresInForce()`; a test pins both halves). Edit wording in the owner's document first, then copy it — never here alone. **Since D60 (2026-10-04) the documents' home is the two ledgers' file libraries** (the Finance Now Ledger and News Charts Ledger pages): a document both products share must be the same file in both, compared before any copy, and the copy records which upload it came from. Their addresses stay out of this public repository. The "How we make money" section says no link pays us (D49: none at launch) — **do not populate an `affiliateUrl`**; `lib/legal/__tests__/disclosures.test.ts` fails if a paid link appears while that sentence stands. **The short not-advice lines beside features are in (T-293, 2026-10-07):** the six Finance Now rows of the draft's "Short versions for the pages" table, copied as written into `lib/legal/featureNotices.ts` and rendered by `components/legal/FeatureNotice.tsx` — Portfolio Builder above a built plan; the calculators line on the Fee Drag Analyzer, the tax-equivalent yield card and the switched-off Trade Risk Scorer; the AI line on the assistant, Research, Daily Brief and the two AI scans; the Pump Report line on its page and the coin tab; the video line on video answers; and the crypto line under every crypto page, which `ModuleGate` renders from the registry's `pageNotice`, so a new crypto page inherits it. Where a page's own line said the same thing, the draft's replaced it. `lib/legal/__tests__/featureNotices.test.ts` pins every placement, fails on a line pasted into a page instead of rendered, and holds the copy to the tab revision `DISCLOSURE_SOURCE` records |
| Daily Brief | `/brief` | 🟢 Live | AI morning brief grounded in holdings (needs ANTHROPIC_API_KEY) |
| Compare | `/compare` | 🟡 Key-gated | 2–6 assets of ANY class (stocks/funds/coins + all 45 macro instruments — commodities/FX/rates ride `security-chart`, coverage provider-dependent), date-aligned growth-of-100 + window stats + correlation + **beta vs a selectable benchmark** (SPY/QQQ/IWM/VT/AGG/BTC, R² shown alongside) (`security-chart`, `chart`). Fund selections also get a **holdings-overlap** section (`lib/data/lookThrough.ts`) — the question correlation can't answer: whether two funds move together because they hold the same companies or because they track the same economy. Partial holdings lists are labelled as floors, never rescaled. **Cross-class comparisons get a structural panel** (`lib/data/assetClassProfiles.ts`, pure + tested): when ≥2 distinct asset classes are selected it states similarities and differences across five dimensions (what you own / income / valuation anchor / trading hours / supply) plus mix-specific method caveats (crypto weekend overlap, rate indices not investable, FX carry, NAV timing, futures roll). Facts only, class-level only — the advice line (RP-3) holds. **"When it trades" is computed, not typed** (`lib/utils/marketHours.ts`, TS-9, 2026-10-01): Nasdaq's overnight session has a *reported* start of 2026-12-06, and the stock/ETF wording changes only when someone marks that start `confirmed` — the file's staleness clock fires before the date to make them check |
| Budget | ~~`/budget`~~ | ⚪ Removed | **Module removed 2026-08-20** — owner decision: personal-finance tooling moves to a separate product (*"we will build this out in a completely different tool"*). Pages, `/api/user/budget/*`, `lib/budget/` all deleted. **DB tables + imported bank history RETAINED** — schema definitions kept in `lib/db/schema/budget.ts` precisely so drizzle never generates a DROP; export instructions live in that file's banner. Reverses RP-2 via its recorded reopen trigger |
| Retirement Planner | ~~`/retirement`~~ | ⚪ Removed | **Module removed 2026-08-20** with Budget (same decision). `lib/retirement/` and its 53 tests deleted; recoverable by name from the **`archive/wave-two-pre-reset`** branch (kept deliberately, 2026-08-29 owner decision — do not delete) if the separate tool wants the engine — the §402(g) shared-cap and monthly-compounding fixes live there |
| Portfolio Builder | `/portfolio-builder` | 🟢 Derived | PREMIUM module (own entitlement). **Two modes since 2026-08-19 (item 16):** the guided questionnaire, and **build-by-allocation** (`buildFromAllocation`, `AllocationBuilder`) where the user sets class weights plus market-cap and sector sub-division. Both emit the same `BuiltPortfolio`, so a hand-built plan shares saved-plan storage, the drift monitor and `reviewPlan`. Weights must total 100 — they are **never** silently normalized. Questionnaire → diversified allocation with bond ladder, sector tilts/exclusions, fee summary, drift-vs-actual rebalancing and suitability monitoring. Engine is pure TS in `lib/data/portfolioBuilder.ts` (vitest-tested); see below |
| Trade Risk Scorer | ~~`/equities/options`~~ | ⚪ **Switched off (D64)** | **Switched off 2026-10-04 (D64)** with every other risk rating until the risk engine is rebuilt and the compliance research is done: `/equities/options` redirects to `/equities`, the nav entry is commented out, `/api/v1/options/score` answers 503, and the agent and MCP tools are withheld. Page, engine and tests are kept (`lib/risk/visibility.ts` lists every surface and how to restore). When on: EQUITIES module. Describe an options position (1–4 legs in the UI; the API and agent tool accept up to 8, structure presets) and see it scored across liquidity, IV environment, assignment, time decay and defined risk — canonical 0–100 higher-is-safer, per-dimension with evidence. Engine is `lib/risk/profiles/optionsTrade.ts` (pure, tested). **There is deliberately NO options chain browser**: the P2-O1 audit found no usable keyless source (Cboe prohibited by its terms, Yahoo options 401s and Yahoo is now blocked outright on terms grounds), and the owner closed P2-O3 on 2026-08-05. Option-level numbers are hand-entered from the user's broker chain — never infer them. Also exposed as the `score_options_trade` agent tool, `POST /api/v1/options/score`, and an MCP tool |
| Settings | `/settings` (→ Integrations) | — | API keys, data tier, integrations + Suite Modules toggles |

### Equities module (`/equities`)
| Feature | Route | Status | Source / Notes |
|---------|-------|--------|----------------|
| Stock Registry | `/equities` | 🟡 Partial 🔑 | Universe from `/live-data/stock-universe` (FMP stock-screener, daily-cached) with `equityCatalog.ts` curated fallback. ⚠ **"All active common stocks" needs a PAID FMP plan** — `company-screener` is paid-only, so on the free key the registry IS the 79-name curated catalog, which is the measured state (`DATA-AVAILABILITY.md:708`). This row said 🟢 Live until 2026-09-22, contradicting both that file and this one's own env-var table. **Deferred under D21, not a defect** — and `stock-universe` is one of the four single-sourced surfaces D21 names. Paginated (50/page), live quotes for the visible page only, range screener, sortable columns incl. beta. Detail pages resolve non-catalog tickers via FMP profile lookup. **P/E is backfilled from SEC XBRL** — see below. |

#### P/E enrichment (`src/lib/server/secFundamentals.ts`)
FMP's `company-screener` returns **no P/E at all**, so on a paid plan every non-curated name would have a blank P/E column and be invisible to the registry's min/max P/E filter. `enrichPeRatios()` in the stock-universe route backfills it from the SEC's XBRL **frames** API (`data.sec.gov/api/xbrl/frames/...`) — bulk diluted EPS across all filers, with basic EPS as a gap-filler, keyed ticker→CIK via `edgar.ts`'s `fetchTickerCikMap()`. Free and keyless. Measured coverage: **~6,100 symbols**.

Caveats, all deliberate:
- It is a **trailing** P/E (last complete fiscal year's EPS ÷ reference price), so it won't match a broker's forward/TTM figure exactly.
- Loss-making companies return `null`, not a negative multiple — a negative P/E would corrupt the range filter (INTC is a live example).
- Coverage gaps: foreign private issuers (20-F), off-calendar fiscal years, and **recently reorganized registrants whose ticker now maps to a new holding-co CIK with no XBRL history** (XOM is a live example).
- Runs only on the FMP path — the 79-entry curated catalog already carries hand-written P/E, so enriching it would gain one row for three multi-MB fetches.
- Frame years derive from the clock (`recentAnnualFrames()`), so this does not go stale each January.
| Equity Detail | `/equities/[symbol]` | 🟢 Live | Live chart/news + reference stats, 52-wk range, key stats |
| Market News | `/equities/news` | 🟢 Live | RSS multi-feed; category/sentiment/ticker filters. A token symbol tags its company (`TSLAx`, `TSLAon` → TSLA), and stories about tokenized securities are filed under **Tokenization** (TS-13) |
| Stock Social | `/equities/social` | 🟡 Partial | **StockTwits only in practice** (keyless). Reddit is **gated off by its own robots.txt** — not rate-limited, not IP-dependent: `assertRobotsPermits` refuses every `reddit.com` URL unless `REDDIT_CLIENT_ID` is set, and the route declares the omission in `withheld[]` rather than quietly returning a short feed. This row said "Reddit + StockTwits" until 2026-09-22 |
| Equity TA | `/equities/technical-analysis` | 🟢 Derived | Shared candlestick engine, 62 indicators (shared registry), patterns |
| Equity Scanner | `/equities/scanner` | 🟢 Derived | **The section's one scanner** (items 6/7): all seven shared setup detectors (the crypto scanner runs only the closes-only ones, since it reads closing prices), over the 79-name curated catalog, **merged with the AI Outlier Scan**. Replaced the 24-symbol RSI/SMA screener tab. No auto-refresh — every row is a keyed provider request, unlike crypto's keyless source; windows (3M/6M/1Y) change history depth, not bar size, because the provider serves daily bars only |
| Options Calculator | `/equities/options-calculator` | 🟢 Derived | **Built and shown 2026-10-07 (D93, T-420 item 4)**, ahead of counsel's answer to the risk-ratings memo's §8 question 7, at the owner's call; that answer may still change it. Arithmetic on a position the user enters: payoff at expiry, maximum gain and loss, breakevens, a payoff chart, and Black-Scholes Greeks from the implied volatility the user enters (`lib/options/payoff.ts`, `lib/options/greeks.ts`, pure and tested against textbook values). **No grade, score or "safer"** — the graded Trade Risk Scorer stays off (D64, D92), and `lib/options/__tests__/calculator.test.ts` fails if the page imports `lib/risk`. Every option figure is typed in (no chain, P2-O1); only the underlying price is fetched. Links the OCC's *Characteristics and Risks of Standardized Options* and carries the calculators notice |
| Strategy Backtests | `/equities/backtests` | 🚫 Hidden | **HIDDEN 2026-08-20, deliberately recoverable** — owner: *"hide the back testing tool … I may revisit back testing."* All three backtest surfaces went dark the same way: this page (route now redirects to `/equities`), the crypto TA Backtest tab, and the Portfolios Backtest tab. Every engine (`equityBacktest.ts`, `backtest.ts`), panel component and test is retained in place; subproject P3-W2-S1 is suspended, not cancelled. Restore = delete the redirect + re-add the nav entry and tab unions (each site carries a comment saying exactly this) |
| Market Calendar | `/equities/calendar` | 🟡 Partial | FMP calendars: earnings (free key) + US economic events (paid endpoint, empty on free). **FOMC meeting dates are keyless** (2026-10-03): a hand-maintained table, `lib/data/fomcCalendar.ts`, copied from the Federal Reserve Board's calendar with a 90-day review clock, shown on every plan and with no FMP key at all. Dates after the next meeting are labelled tentative, per the Board's own rule. `ok` counts FMP rows only, so the research agent never reads a dead FMP leg as "no earnings" |

### Macro Markets module (`/macro`) — bonds/rates, commodities, fiat
One module (`macro` entitlement), three areas. Owner spec + status: `docs/ROADMAP.md` ("Macro Markets"). **Zero new quote plumbing** — futures, FX pairs, and yield indices all price through the existing `security-quotes`/`security-chart`/`security-ohlcv` routes (verified). Catalogs carry **no reference prices** (futures/FX quotes stale in hours; unpriced = honest dash).

| Feature | Route | Status | Source / Notes |
|---------|-------|--------|----------------|
| Macro Overview | `/macro` | 🟡 Key-gated | Landing page; quote strips per area ride the shared `security-quotes` ladder, **which has answered 🔑 UNCONFIGURED for macro symbols on every audit since 2026-09-09** — `GC=F`, `EURUSD=X` and `ZN=F` all missing with five provider keys held (`DATA-AVAILABILITY.md:741`). Unpriced renders a dash; the catalogs carry no reference prices by design. Open between a paid FMP plan (it answers 402) and a symbol-mapping fix, and nothing measured so far distinguishes them — **do not write "no keyed rung carries them"** |
| Macro News | `/macro/news` | 🟢 Live | `/live-data/macro-news` — 4 keyless RSS feeds (OilPrice, FXStreet, CNBC ×2). **MarketWatch's `mw_bulletins` feed was removed 2026-09-20 ON TERMS** (Dow Jones ToU — `dowjones.io` is `prohibited`), which thinned the general pool rather than removing a pillar. **Investing.com's three feeds (commodities, bonds, forex) were removed 2026-10-17 ON TERMS too (D133, T-407)**: its Limitations on Use (c) forbid automated extraction "for any purpose", and `investing.com` is now `prohibited`. Every pillar keeps a source: commodities → OilPrice, currencies → FXStreet, and bonds → CNBC Economy through the classifier (the Investing.com bonds feed carried mostly op-eds). The route uses a plain `fetch`, so `sourceTerms.test.ts` and the drift check are what keep it out. **Content-first pillar classifier** (strong-currency terms → commodities → bonds → weak-currency; general-feed articles matching no pillar are dropped). 14-day staleness cutoff; future `pubDate`s clamped (a zone-less stamp, as Investing.com sent, is read as UTC); balanced merge guarantees each pillar ≤¼ of slots so slow bonds feeds aren't crowded out; detected instruments link to macro detail pages |
| Commodities | `/macro/commodities`, `/[slug]` | 🟡 Key-gated | `commodityCatalog.ts` — 19 verified front-month contracts, 5 categories. **Prices and charts are key-gated and currently unserved** — the futures ride the same `security-quotes`/`security-chart` ladder as equities, and macro symbols have measured 🔑 UNCONFIGURED on every run since 2026-09-09. The catalog copy, categories and ETF proxies below are unaffected, which is why this is 🟡 rather than 🔴. `quoteBasis: 'usd'\|'cents'` renders each market's convention (472.75¢/bu, never "$472"). Detail: chart + facts + ETF proxies → /funds. **`etfProxies` are genuine single-commodity exposure**, not the broad-basket DBC these used to point to. Deep, multi-issuer lineups for the liquid metals/energy markets (gold: GLD/IAU/GLDM/SGOL/AAAU/BAR/OUNZ; silver: SLV/SIVR/PSLV; WTI: USO/OILK/USL; nat gas: UNG/UNL) — each variant genuinely differs (expense ratio, K-1 vs 1099 tax form, front-month vs laddered roll, physical-redemption feature), all added to `fundCatalog.ts` and verified both quotable AND actively trading (5-day history, not just a cached price) before inclusion. Copper/grain/platinum/palladium get one verified proxy each (CPER/CORN/WEAT/SOYB/CANE/PPLT/PALL) — genuinely thinner markets, not an under-researched gap; broad-basket funds (DBB, COPX-style miner ETFs) are deliberately excluded even as a single option since that's the exact overstated-specificity problem this fix corrected. Heating oil, coffee, cocoa, cotton, live cattle, and lean hogs are **deliberately empty** — their single-commodity ETFs/ETNs (UHN, JO, NIB, BAL, COW) were confirmed delisted (last trade 2019–2023) 2026-07-21; don't backfill with a basket fund to avoid a blank list |
| Currencies | `/macro/currencies`, `/[slug]` | 🟢 Live | `currencyCatalog.ts` — 17 pairs + DXY (18 entries), per-pair `precision`. **`etfProxies`** (new `FundCategoryId: 'currency'` in `fundCatalog.ts`): the 6 USD majors get their CurrencyShares trust (FXE/FXB/FXY/FXF/FXC/FXA — holds currency deposits, direct exposure); Dollar Index gets UUP/UDN/USDU (long/short/alt-index). Deliberately empty for every EM pair and every cross — EM single-currency funds (FXM/BZF/CYB/ICN/SZR) confirmed delisted, crosses have never had a dedicated fund (only vs-USD trusts exist), NZD/KRW never had one. **Converter is two-tier**: 30 ECB currencies (`/live-data/fx-rates`, frankfurter.dev — verified to be ECB's *complete* published set, not a subset) plus 126 more via `/live-data/fx-rates-extended` (said 127 until 2026-09-22 — it has been 126 since `bgn` was removed on 2026-07-22, Bulgaria having adopted the euro; community `fawazahmed0/currency-api`, keyless, hand-verified allowlist excluding crypto tickers/precious-metal ounce codes/IMF SDR/defunct pre-euro currencies from that feed's ~340 raw codes). Grouped by `<optgroup>` in the UI; any conversion touching an extended-tier currency shows a distinct disclosure (community-sourced, not ECB) instead of the "official" ECB copy — the two tiers are never blended without attribution |
| Bonds & Rates | `/macro/rates`, `/[slug]` | 🟢 Live | `ratesCatalog.ts` — 4 CBOE yield indices + 4 CBOT futures. **The four YIELD entries no longer use the quote ladder (2026-09-03, D3):** they read the official treasury.gov par curve via `lib/data/ratesFromCurve.ts` — keyless, plain percent, and published **daily**, so surfaces label them as a daily reading with no intraday change. The probe that forced this (`npm run rates-providers`) found no free provider quotes `^IRX`/`^FVX`/`^TNX`/`^TYX`: FMP paywalls them (HTTP 402), Finnhub returns nothing, Twelve Data 404s the symbol, Alpha Vantage returns an empty quote, Tiingo has no index space. Only the FUTURES still hit `security-quotes`. Curve chart from `/live-data/treasury-yield-curve` = **official** treasury.gov 13-maturity daily par curve (keyless XML, regex-parsed, 4h revalidate) + 2s10s/3m10y spreads + shape. Overview-page bond ETF shelf → /funds. **CUSIP-level bond quotes are licensed data — intentionally absent, stated on-page.** The overview shelf gained international and municipal rows (items 11/13); municipal fund detail pages carry a **tax-equivalent-yield calculator** (`lib/utils/taxEquivalentYield.ts`, pure + 10 tests) — a muni's headline yield is not comparable to a taxable fund's, and TEY is the arithmetic that makes it so. Detail pages carry a per-instrument **"Duration-Matched Funds"** section (`etfProxies`, distinct from the commodity/currency "ETF Proxies" naming since nobody buys "the 10-year yield" directly — the match is by maturity band, not asset identity): 13-week yield → SGOV/BIL (0-3mo bills); 5-year yield + 5yr future → IEI (3-7Y, added to fill the SHY↔IEF duration gap); 10-year yield + 10yr future → IEF; 30-year yield + 30yr future → TLT; 2yr future → SHY. General credit/inflation/aggregate funds (LQD/HYG/TIP/BND/AGG) stay overview-only since they don't map to a specific curve point |
| Macro Scanner | `/macro/scanner` | 🟢 Derived | The section's one scanner (items 6/7), moved off the TA page. RSI 14 / vs-SMA50 / composite over the **29 liquid** macro instruments; the 6 delisted-ETF commodities and 10 EM/cross FX pairs stay excluded and the exclusion is stated on-page. **AI Movers Scan** (2026-10-01, NT6): a button that runs the `macro-screener` agent over the whole universe — the same `AgentScanPanel` as the equities AI Outlier Scan. Macro quotes are key-gated, so its report names unpriced instruments rather than estimating them |
| Macro TA | `/macro/technical-analysis` | 🟢 Derived | Shared candlestick/indicator engine over all 45 macro instruments — **no new data route**, macro symbols ride the same `security-ohlcv` path as equities. ⚠ That path is keyed and its macro coverage is narrower since the Yahoo removal — many macro symbols simply aren't carried by the remaining providers, and unpriced renders a dash. Chart tab (grouped picker, 5 ranges, 6 chart types, **51** indicators, patterns). **51, not the registry's 62**, and the gap is deliberate: the page calls `indicatorsFor(false)` because macro series carry no volume, so the **11** volume-derived indicators are withheld and named on-page rather than rendered against a missing input. This row said 16 until 2026-09-12 + Scanner tab (RSI 14 / vs-SMA50 / composite signal). **Scanner covers 29 of 45**: the 6 delisted-ETF commodities and the 10 EM/cross FX pairs are excluded because their series gap enough that a ranked RSI beside a liquid contract reads as comparable when it isn't — the exclusion is stated on-page and all 45 still chart. Levels go through `formatInstrumentQuote()`, so grains stay ¢/bu and yields stay % |

`PriceChartCard` takes `valueFormat: 'usd' | 'plain'` (default `'usd'`, existing pages unchanged) — use `'plain'` for FX, yields, and cents-quoted contracts so axes aren't $-mislabeled. **Cross-cutting integration shipped 2026-07-21**: `market: 'macro'` exists across the provider registry (7 built-in rows — was 11 until `marketwatch-macro` was removed on terms, 2026-09-20, and Investing.com's three, 2026-10-17; macro routes are registry-driven with utilization), tier categories, Integrations sections, and agents (`macro-research`/`macro-screener`, toolset `'macro'`); all 45 macro instruments (19 commodities + 18 currencies + 8 rates) are `sec:`-keyed entries in `instruments.ts` (classes `commodity`/`currency`/`rate`, `detailPath` slug routing) so watchlists/portfolios/Compare can hold them.

### ETFs & Funds module (`/funds`)
| Feature | Route | Status | Source / Notes |
|---------|-------|--------|----------------|
| Fund Registry | `/funds` | 🟡 Key-gated | `fundCatalog.ts` + live quotes; 140 ETFs/mutual funds (8 added 2026-08-19 for items 11/13: BNDX/IAGG/BWX/EMB/VWOB international, MUB/VTEB/TFI municipal; **14 added 2026-09-26 under D27** — XLC/XLP/XLY/XLB sector, VCSH/VMBS/VTIP/EMLC/BKLN bond, VSS/VGK/EWJ/VYMI/HEFA international — each probed quotable, actively trading and fee-sourced from its SEC filing first, `docs/audits/fund-candidates-probe-2026-09-26.md`). Catalog carries provenance on **two dates since D117 (2026-10-14)**, both rendered on detail pages and both `staleness:check` clocks with 120-day windows. `FUND_FEES_LAST_VERIFIED` (`getFundFeeProvenance()`) is a verification date: every row's expense ratio was checked against the fund's own filings, and it is the oldest check still standing. Those ratios are computed on by `computeFeeDrag`, the builder's fee math, and `reviewPlan`'s fee-creep check. `FUND_FIGURES_COMPILED_ON` (`getFundFiguresProvenance()`) is **not** a verification date. It is when the oldest hand-compiled figure was written down: every yield, plus the asset figures no filing supplies. 112 asset figures carry their own SEC filing date and accession instead (`aumAsOf`, `aumSource`; D114), and the page shows that date. A mutual fund's figure is the whole fund, every share class (D115). An undated figure shows as "≈". Record: `docs/audits/fund-catalog-facts-2026-10-14.md` |
| Fund Detail | `/funds/[symbol]` | 🟢 Live | Live chart/news + fund facts; Fee Drag Analyzer, top holdings. **The analyzer accounts for sales loads since 2026-09-03**: a verified rate enters the projection, an unverified one is disclosed in an amber panel that says plainly the figures understate the cost and links the prospectus. AGTHX is the live example — a Class A front-end load roughly DOUBLES its ten-year cost versus the 0.59% expense ratio alone, and none of it was shown before. **Bond funds show their duration since 2026-10-17 (T-420 item 2, D92)** in an "If Rates Move" card, worked out from the fund's own N-PORT filing (Item B.3.a, the same filing the holdings come from): \|ΣDV01\| ÷ net assets × 10,000 (`lib/utils/fundRateSensitivity.ts`, tested against iShares' published figures). The filing's DV100 is **not** used: its sign and size suggest the direction of the move differs by filer (TLT's sits above its straight-line duration, as a fall would; BND's below, as a rise would), so a "1-point rise" figure read from it would be wrong by 1.5 points on a long fund. A fund under 25% in debt files no such section and the card renders nothing |

---

## AI Agents (`src/lib/agents/`)

All agents run through one loop (`runner.ts`, Anthropic + OpenAI-compatible). Defaults live in `prompts.ts` (`AGENT_DEFAULTS`); per-agent overrides (provider/model/temperature/systemPrompt/**enabled**) persist to `.agent-prompts.json`. Each agent has a `market: 'crypto' | 'equities' | 'macro'` (undefined = shared) and a `toolset: 'crypto' | 'equities' | 'macro' | 'all'`.

**Agents (11):** `app-assistant` (shared, toolset `all`), crypto `research-analyst` / `data-scraper` / `pump-report-investigator` / `pump-report-chat`, equity `equity-research` / `equity-screener` / `equity-data-scraper` / `equity-diligence`, and macro `macro-research` / `macro-screener` (6 macro tools: search_macro_instruments, get_macro_quote, get_macro_price_history, get_yield_curve, get_fx_rates, get_macro_news).

**Tools (`tools.ts`):** tagged by market; `toolsForAgent(toolset)` gives an agent only its market's tools. `score_options_trade` is the one tool that POSTs (a multi-leg trade doesn't fit a query string) and the one that computes rather than fetches — its prompt text carries the no-chain-feed rule, so an agent asks the user for a missing bid instead of inventing one. ⚠ **It is withheld since 2026-10-04 (D64)**: `WITHHELD_TOOLS` keeps it out of every toolset, and `runTool` answers with the reason if a model names it anyway. Crypto tools hit `/api/v1/*` + `/live-data/ohlcv`; equity tools (`get_stock_quote/financials/profile/filings/news/social/price_history`) hit the equity `/live-data/*` routes. Every tool reads exactly what the UI reads — one source of truth. The Anthropic runner also adds the server-side **`web_search`** tool (max_uses via `opts.webSearchMaxUses`, default 5 / research 8), and handles the `pause_turn` stop reason it produces; web search is **Anthropic-only** (agents switched to another provider keep data tools but lose search).

**Invocation:** `app-assistant` (Assistant chat → `/api/agents/chat`), `research-analyst` / `equity-research` / `macro-research` (Research page Crypto/Equities/Macro selector → `/api/agents/research`), and `equity-screener` (Stock Registry "AI Outlier Scan" panel → `/api/agents/research`, whitelisted; calls `get_stock_outliers` then drills in) have run triggers. `macro-screener` runs from the Macro Scanner's **"AI Movers Scan"** panel (2026-10-01 — NT6, approved 2026-08-12 and folded into the scanner work, which shipped without it; until then the agent was reachable only by `?agent=macro-screener`, P3 review X5). Both scan panels are one component, `components/markets/AgentScanPanel.tsx`, driven by the scan list in `agentScans.ts`; `researchAgents.test.ts` holds every scan there to the route whitelist and to its agent's market. `data-scraper` / `equity-data-scraper` / `equity-diligence` gained real invocation paths on 2026-08-18 (NT5): the Research page now carries a **per-market agent picker**, so every whitelisted agent — including the two screeners, previously deep-link-only — is selectable. `lib/agents/__tests__/researchAgents.test.ts` guards picker ↔ route ↔ catalog symmetry so an agent cannot go configurable-but-unrunnable again. `pump-report-*` run via their own `/live-data/pump-report/*` routes (separate loop, own web_search).

**LLM keys** resolve via `getProviderKey(provider)` — UI-saved key (Integrations → AI Providers, the `llm`-category providers in `providers.ts`) first, then the env var. The pump-report routes resolve the Anthropic key the same way.

**Credits under AI answers (D101, 2026-10-12).** An answer built on CoinGecko figures shows "Powered by CoinGecko". `runToolWithCredits` (`tools.ts`) gathers the credits of every response a tool reads, through the one `get` every tool fetches with: a response's own `attributions` (the agent API, D100), else the registry entry owning the `/live-data` route. The runner returns them once each as `AgentRunResult.credits`, the agent routes send them, and the Brief, Research, the Assistant and the AI scans render them under the answer with `RequiredCredits` (`components/ui/RequiredCredits.tsx`, which also renders SourceLine's credits, so the licence's size lives in one place). A new tool collects its credits without doing anything; a new surface showing an answer must render them, or the credit guard fails.

**Control surfaces:** the **AI Agents tab** (`/agent-config`) edits model/temperature/prompt per agent (tabs grouped shared/crypto/equity); **Integrations** (`/settings`) holds the AI Providers key section and per-agent enable toggles. The **Research page** (`/research`) has a Crypto/Equities selector and accepts `?symbol=` / `?agent=equity-research` deep links; stock detail pages have an **Analyze with AI** button → `/research?symbol=…`. Disabled agents throw `AgentDisabledError` (503) from the run routes.

## News Feed Architecture (`src/app/live-data/news/route.ts`)

The news route has a multi-layer asset detection system:
1. **Direct mention** — regex patterns for coin names/tickers (e.g. "bitcoin", "BTC")
2. **Issuer match** — "Circle" → USDC, "Tether" → USDT
3. **Regulatory inference** (`lib/server/newsRegulatoryImpact.ts`, tested) — "MiCA" → USDC+USDT, "GENIUS Act" → USDC+USDT+PYUSD, "DeFi regulation" → DAI+FRAX. The **CLARITY Act and other US market-structure bills → `general`**, i.e. every coin's feed, plus the three stablecoins they reached before. Until TS-13 (2026-10-01) CLARITY shared the GENIUS entry and reached only those three
4. **Category fallback** — "stablecoin" with no match → general stablecoins; "crypto/blockchain" → general

Asset filter is applied server-side so only relevant articles are returned when a coin filter is active. Articles tagged `'general'` always pass through.

**Tokenized securities (TS-13, 2026-10-01).** `lib/server/tokenizedNews.ts` answers two questions for this
route and `/live-data/market-news` alike, so the two feeds cannot disagree. First, is the story about
tokenized stocks, funds or bonds? If so, its category is **`tokenization`**, checked before every other
category, Global included: xStocks and Ondo's stocks are not offered in the US, so many launch stories would
otherwise file as Global. Second, which catalog stock does it name? A token symbol counts as its company
by the issuers' own suffixes, `TSLAx` (Kraken xStocks) and `TSLAon` (Ondo), with three guards: the
suffix must be lowercase (an all-capitals ticker ending in X is a mutual fund), the ticker part must have
two letters or more (C, T and V are catalog tickers, and "Con", "Ton" and "Tx" are words), and the ticker
must be in the stock catalog. On this route the stocks go in `relatedSymbols`, which is **empty for every
other story**: the crypto feed tags coins, not companies. "Oracle" and "Intel" never link by name here,
because both are everyday crypto words (price oracles, Arkham's Intel Exchange). Not read: Dinari's
dShares symbols, because the sources disagree on their form, and tokenized ETFs, because the chips link
to stock pages. `lib/server/__tests__/tokenizedNews.test.ts` also reads the category vocabulary from the
two routes, the two filter lists and the `/api/v1/news` spec and note, and fails if they drift apart.

---

## Agent API Layer (`/api/v1/`)

A separate, agent-optimised REST API lives at `/api/v1/`. It is distinct from `/live-data/*` (which is internal to the UI) — the v1 API is designed for programmatic consumption by AI agents, external scripts, and other services.

### Key differences from `/live-data/*`
- All routes include `Access-Control-Allow-Origin: *` CORS headers
- Responses are flat and descriptive (no UI-specific shape)
- Proper HTTP 400 errors with human-readable messages for bad params
- Every response includes `updatedAt` and `source` metadata
- A response serving data whose licence requires a credit carries `attributions` (D100, 2026-10-12):
  today the three serving CoinGecko figures (`/prices`, `/network-fees`, `/transfer/routes`). Read
  from the registry, never typed; a new route serving CoinGecko data without it fails
  `lib/data/__tests__/coingeckoCredit.test.ts`
- OpenAPI 3.0 spec available at `GET /api/v1/openapi.json`

### Available endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/` | Discovery — lists all endpoints and supported coins/networks |
| `GET /api/v1/prices?coins=btc,eth` | Live USD prices |
| `GET /api/v1/exchanges?tier=1` | All supported exchanges with ids, coins, networks |
| `GET /api/v1/network-fees` | Gas fees for all **18** networks, **5 of them live** — BTC via mempool.space plus ETH/BNB/Polygon/AVAX via keyless `publicnode eth_gasPrice`; the other 13 are static gas amounts priced live (`source: 'estimate'`) — `NETWORK_GAS` / `NetworkKey` / `FEE_PROVIDERS` in `lib/data/networkFees.ts`, which the route derives from. Said 16 networks until 2026-09-12, and said "BTC live, rest estimated" until 2026-09-22 — the live EVM gas landed 2026-08-21 (`01d6bfe`) and this row never caught up |
| `GET /api/v1/transfer/routes?from=binance&to=coinbase&coin=usdt&amount=1000` | Transfer route finder |
| `GET /api/v1/staking/opportunities?coin=eth&category=liquid` | Staking options with APY, lock-up, custody model, receipt token, TVL and audit count. **No risk figure of any kind** — no composite (D14) and, since 2026-09-25, no per-dimension figures either (D26); `riskBreakdown` no longer appears and `max_risk`/`min_safety` are ignored if sent |
| `GET /api/v1/news?coin=btc&sentiment=negative&limit=10` | News with sentiment/category tagging; `relatedSymbols` lists the stocks a story about tokenized securities names (TS-13) |
| `GET /api/v1/securities/quotes?symbols=AAPL,VOO,GC=F` | Stock/ETF/fund/macro quotes (max 25; same keyed ladder + reference fallback as the UI, `reference: true` rows labeled) |
| `GET /api/v1/securities/history?symbol=AAPL&range=1y` | Daily close history for any quotable symbol (1mo–max) |
| `GET /api/v1/macro/yield-curve` | Official treasury.gov 13-maturity par curve + 2s10s/3m10y spreads + shape |
| `GET /api/v1/macro/fx-rates?symbols=EUR,JPY` | Daily ECB reference FX (official tier only — extended community tier deliberately not exposed) |
| `POST /api/v1/options/score` | ⚪ **WITHHELD (503) since 2026-10-04 (D64)** — risk ratings are switched off until the risk engine is rebuilt. When on: score a described options position on the canonical safety scale. **Computes, doesn't fetch** — there is no chain feed, so the caller supplies every option-level figure. `GET` on the same path returns the schema. Explains risk; never recommends |
| `GET /api/v1/openapi.json` | Full OpenAPI 3.0 spec |

### CORS helper
All v1 routes import from `src/app/api/_cors.ts`:
```typescript
import { CORS, options } from '../../_cors'
export { options as OPTIONS }   // handles preflight
// ...
return NextResponse.json(data, { headers: CORS })
```

---

## MCP Server (`mcp-server/`)

A standalone Node.js MCP server at `mcp-server/` (repo root) that exposes Finance Now tools to Claude and any MCP-compatible AI agent. It calls the `/api/v1/` endpoints — Finance Now frontend must be running.

### Tools exposed
| Tool | Description |
|------|-------------|
| `get_coin_prices` | Live prices for one or more coins; ends with "Powered by CoinGecko" from the API's `attributions` (D100) |
| `list_exchanges` | All supported exchanges with coin/network support |
| ~~`find_transfer_routes`~~ | ⚪ **WITHHELD 2026-08-22** — Transfer Fees held out of the initial rollout; tool commented out in mcp-server, `/api/v1/transfer/routes` answers 503 |
| `get_network_fees` | Gas fees for all **18** networks (same `NETWORK_GAS` set as the v1 route); ends with CoinGecko's credit, as above |
| `get_staking_opportunities` | Staking options filtered by coin and category; reports facts only — APY, lock-up, custody model, receipt token, TVL, audits. No risk score, rating or dimension (D14 + D26) |
| `get_crypto_news` | Recent news with sentiment, category, and coin tags, plus the stocks a story about tokenized securities names |
| `get_security_quotes` | Stock/ETF/fund/macro quotes (reference prices flagged) |
| `get_security_history` | Daily close history + 52-week range for any quotable symbol |
| `get_yield_curve` | Official Treasury par curve with spreads and shape |
| `get_fx_rates` | Daily ECB reference FX rates (official tier) |
| ~~`run_audit`~~ | ⚪ **REMOVED 2026-10-04 (D68)** — a maintenance tool, not market data: it ran `npx tsc` on the host (which downloads and runs a package, unasked, where TypeScript is missing), called eight live-data routes and read the frontend's code files. Removed rather than locked down; CI and `npm run audit` do its checks better. The server is **data-only** now: every tool reads `/api/v1` and nothing else, held by `lib/server/__tests__/mcpDataOnly.test.ts`. This settles the P3 review's D5 (not the 2026-09-14 D5, which is SOC 2) |
| ~~`score_options_trade`~~ | ⚪ **WITHHELD 2026-10-04 (D64)** — commented out in `mcp-server/src/index.ts` with every other risk rating until the risk engine is rebuilt. When on: risk-score a user-described options position (0–100, higher = safer, per-dimension) |

### Setup (build once)
```bash
cd mcp-server
npm install
npm run build
```

### Add to Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "finance-now": {
      "command": "node",
      "args": ["<path-to-repo>/mcp-server/dist/index.js"],
      "env": { "FN_BASE_URL": "http://localhost:3000" }
    }
  }
}
```
Claude Desktop config lives at `%APPDATA%\Claude\claude_desktop_config.json` on Windows.

### Add to Claude Code (project-level MCP)
```bash
# Run from any directory — adds Finance Now MCP to this project's .claude/settings.json
claude mcp add finance-now node <path-to-repo>/mcp-server/dist/index.js
```

### Environment variable
`FN_BASE_URL` — base URL of running Finance Now instance (default: `http://localhost:3000`; legacy `CAEP_BASE_URL` still honored)

---

## Testing conventions

`vitest.config.ts` aliases **`server-only`** to `test/stubs/server-only.ts`. That import is a
Next *build-time* poison pill (it fails the bundle if a module reaches the client), not a runtime
dependency, so it does not exist in `node_modules` — vitest could not resolve it, and all seven
`lib/server/` modules importing it were untestable. The alias restores that; the real bundler check
is unaffected. Add tests for `lib/server/` freely.

`lib/server/sourceTerms.ts` and `termsProbe.ts` are pure and tested for the same reason —
`sourceTerms.test.ts` doubles as the repo-wide guard that every host in `dataSources.ts`
carries a terms verdict, so a new undocumented source fails the suite rather than shipping.

Anything producing a **dollar figure or a percentage a user acts on** should be pure and tested:
`computeNetworkFees()`, `computeFeeDrag()`, `portfolioBuilder.ts`, `lookThrough.ts`,
`costBasis.ts`, `lib/risk/`. Where a function needs the clock, take an injectable `now` — every provenance helper
and `reviewPlan()`/`buildCurveData()` do, and it is the only reason their edge cases are testable.

---

## Dependency audit — the Security Scan gate

`npm run deps:check` (in `frontend/`) has been the CI Security Scan's dependency audit since
2026-10-03 (D53). It fails on every high or critical advisory, as the bare
`npm audit --audit-level=high` it replaced did, **except** one that a recorded owner decision
allows in `frontend/audit-exceptions.json`. An exception names one GHSA advisory and its
package, cites a `| Dnn |` row under `docs/decisions/`, and expires at most 92 days after it was
decided. It also stops applying the moment npm reports a fix short of a major upgrade. Holding
on past the date takes a new decision with a new date, never an edited expiry.
`npm run deps:check -- --now=YYYY-MM-DD` previews a later date. The rules and their reasons are
in `scripts/lib/auditGate.mjs`; `lib/server/__tests__/auditGate.test.ts` drives each one red
and also reads the CI step. `mcp-server/` keeps its plain `npm audit`.

The first exception, granted 2026-10-03 until 2026-11-03 (D53): GHSA-vfj7-8cjw-p6xm, braces ≤ 3.0.3,
which has no patched release. braces only sees file patterns written in this repo (Tailwind's
content paths, ESLint's file globs). T-418 tracks its removal. Since the Tailwind 4 upgrade
(2026-10-07) Tailwind no longer depends on it; the only path left is
`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → braces.
**Renewed on 2026-10-14 until 2027-01-14 (D111)**, the 92 days allowed: braces 3.0.3 was still the
newest release, and npm's suggested fix was a downgrade to `eslint-config-next` 14.2.35. Replacing
`eslint-config-next` with the project's own lint config would remove the last path; it was offered
and not chosen.

---

## Counts and lists in copy: derive them, never type them

**If code can compute a number, the string must not contain it.** Every count written
into copy or an error message is correct exactly once — the day it was written — and
nothing fails when it drifts. Owner ruling, 2026-09-10, to apply project-wide.

The rule is about whether the figure is DERIVABLE, not about whether it is currently
right:

```tsx
// ✗ correct today, silently wrong after the next PR
description="…across 30 exchanges and 18 networks"
subtitle="…62 indicators from the shared registry"
throw new Error(`all RPC endpoints failed (last: ${lastErr})`)

// ✓ cannot go stale, because the data IS the source
description={`…across ${EXCHANGES.length} exchanges and ${Object.keys(NETWORKS).length} networks`}
subtitle={`…${ALL_INDICATORS.length} indicators from the shared registry`}
throw new Error(describeLadderFailure(rpcs.length, attempts, { budgetExhausted }))
```

**What this caught when it was applied** (all four were shipping):

| Site | Said | Actually |
|---|---|---|
| `/transfer-fees` warning | "USDT exists on **10+** networks" | **7** in this app's own table |
| `/technical-analysis` | "**60+** indicators" | 62 — and inconsistent with the equities page saying 62 |
| `/equities/technical-analysis` | "**62** indicators" | right, and about to be wrong |
| `wallet/eth` ladder error | "all RPC endpoints failed" | never said how many, so 1 dead rung and 3 read identically |

That last one is why this is not cosmetic. The message cost **two wrong diagnoses** on
2026-09-10: "all endpoints failed" reads as a provider outage and the truth was two
stale hostnames. `describeLadderFailure()` in `lib/server/walletFetch.ts` is the
reference implementation — it takes `total` from the live list, names every failure in
order rather than only the last, and reports rungs that were never reached separately
from rungs that failed.

**Three things are legitimately frozen**, and the difference is worth stating because
over-applying this rule is its own failure:

1. **A dated historical claim.** "Nine rungs removed 2026-09-09" describes an event.
   Deriving it would be wrong.
2. **A fact about an external system.** "The Treasury publishes 13 maturities", "FMP's
   free tier covers both calendar endpoints" — not ours to compute.
3. **A rationale that reasons about a specific past size**, as long as it says so.
   `WALLET_LADDER_BUDGET_MS` used to argue "more than two rungs' worth and less than
   three" — that silently became wrong when a fourth rung arrived, so it now states
   the invariant for N rungs instead.

When in doubt: ask whether adding one more item would make the sentence false. If yes,
derive it.

---

## Common Patterns

### Resilient multi-fetch — pick the boundary that matches the shape

**Independent fetches** (all results wanted, order irrelevant) → `Promise.allSettled`:
```typescript
const [res1, res2] = await Promise.allSettled([fetch(url1), fetch(url2)])
if (res1.status === 'fulfilled' && res1.value.ok) { /* use it */ }
// always fall through to static defaults if fetch fails
```

**Sequential fallback ladder** (try A, else B, else C — `markets`, `portfolio-prices`; ⚪ `cbdc-data` was this pattern’s third example until the route was cut 2026-09-14, D10) → per-leg
try/catch, returning on first success. **Do not "upgrade" these to `allSettled`**: it fires every provider in
parallel, burning rate limit on exactly the calls the ladder exists to avoid. The 2026-07-22 pass found 7 of 8
routes flagged for "missing allSettled" were already correct for this reason.

**Sequential accumulate-until-satisfied** (walk pages until you have enough — `sec-filings` archives) → try/catch
*inside* the loop, `break` on failure and report the range as incomplete. The bug this fixed: a thrown page fetch
propagated out and 503'd the route, throwing away filings already collected.

### Adding a coin to the transfer fee calculator
1. Add to `CoinId` union type in `transferFees.ts`
2. Add entry to `COIN_INFO` record
3. Add `GAS_AMOUNTS` entry in `network-fees/route.ts` if it has its own network
4. Add per-exchange network entries in `EXCHANGES` array for each exchange that supports it
5. Update coin selector grid columns in `transfer-fees/page.tsx` if needed

### Adding an exchange to the transfer fee calculator
1. Append to `EXCHANGES` array in `transferFees.ts`
2. Include all coin/network combinations that exchange supports
3. Use `tier: 1` for top-25 by volume, `tier: 2` for smaller exchanges
4. Note: Hyperliquid (DEX) is already included as a special case with Arbitrum-only withdrawal
