# CAEP — Market Assessment & Growth Outlook

> ⚠ **STALE-CLAIM WARNING (added 2026-07-28).** This assessment predates major work and
> two of its load-bearing claims are now false: risk scoring **no longer shows N/A**
> (live since 2026-07-18, rebranded "Safety Score"), and the "3-way scale inconsistency"
> was **disproved and settled** — R1/R2 ratified and shipped the canonical 0–100
> higher-is-safer scale (`docs/architecture/risk-scale-spec.md`). The app has also been
> renamed Finance Now and gained the Macro Markets module. Treat market/competitor
> analysis here as directional; verify any product claim against the code before
> planning work from it. This banner exists because a stale memo has misdirected an
> entire work stream in this repo once before (see `docs/TASK-QUEUE.md` revision note).

>
> **Update, 2026-09-20 — the warning above is now itself stale, in the same direction it
> was correcting.** It told readers that risk scoring "no longer shows N/A" and had shipped
> as a user-facing **"Safety Score"**. As of 2026-09-20 that is no longer true, and the
> reversal was deliberate: **the canonical 0–100 composite — the "Safety Score" — is not
> published for any coin, in this app, its API, or its MCP server.** RP-6 (2026-08-29)
> removed every per-coin composite surface — the header gauge, the identity band pill, the
> search-result score, the Composite Risk panel, `/live-data/risk-scores`, and the
> `Asset.riskScore` / `riskBand` fields themselves — and D14 (2026-09-14) removed the
> composite staking score together with `safetyScore`, `band`, `riskScore`, `riskLevel` and
> the `max_risk` / `min_safety` / `max_safety` filters from
> `/api/v1/staking/opportunities`, `/live-data/staking-discovery`, and the
> `compare_staking_risk` MCP tool.
>
> **Checked in the tree on 2026-09-20, not inherited from this page.**
> `grep -rn "Safety Score" frontend/src/` returns 15 hits and not one publishes a score —
> they are dated removal comments, copy that says a field is *not* the canonical score, and
> `lib/risk/__tests__/riskScoringRemoved.test.ts`, the guard that fails if any of those
> surfaces come back. `/api/v1/staking/opportunities` states in its own response `note` that
> it publishes no composite score. `mcp-server/src/index.ts:372` is a tombstone where the
> comparison tool was.
>
> **State the scope precisely, because "no risk score anywhere" is too strong.** Three risk
> surfaces were decided separately and are live as of 2026-09-20: the options **Trade Risk
> Scorer** (`/equities/options`, the UI over `lib/risk/profiles/optionsTrade.ts`, scored via
> `/api/v1/options/score`); the portfolio **Risk Profile** panel, which renders each
> holding's curated tier as "N/10" with a weighted portfolio figure beside it
> (`portfolios/page.tsx:908–921`, and its own copy at :1066 says this is *not* the canonical
> score); and the **six curated risk dimensions** per staking provider (1–10, higher =
> riskier), which D14 kept in `riskBreakdown` while cutting the composite over them. What
> was withdrawn is the single per-coin verdict figure, not every risk number.
>
> The framework survives: `frontend/src/lib/risk/` with eight profiles on the canonical
> 0–100 higher-is-safer scale (`docs/architecture/risk-scale-spec.md`), whose last live
> consumer is the options Trade Risk Scorer (D18, 2026-09-14). So the scale settlement cited
> above is still true, and now governs an engine with one rendering surface and no per-coin
> one.
>
> **This matters for exactly the reason the banner above gives about itself.** A memo read
> as current has misdirected a work stream in this repo before, and "finish the risk
> framework" is still written into §6 Phase 0 and §7 item 5 as outstanding work. It is not
> outstanding — it was withdrawn by the owner. Both lines are annotated in place below
> rather than rewritten, and §2's "Risk scoring unfinished" row is now superseded twice
> over: by the 2026-07-28 banner, and again by this update.
>
> **Measurements taken 2026-09-20, for anyone planning from §2.** User data now lives in
> Postgres — `users`, `portfolios`, `watchlists`, `builder_plans`, `user_wallets` among 21
> tables under `frontend/src/lib/db/schema/`, with four migrations in `frontend/drizzle/` —
> so "no database" in that table is false. Provider keys (`.provider-config.json`,
> `providers.ts:811`) and module entitlements (localStorage) are still single-user, and with
> the auth wall off by the owner's explicit request the app runs every request as one local
> user (`lib/auth/session.ts`), so the multi-tenancy blocker that row names still stands and
> the "No authentication" row beside it is still accurate. Three counts were re-checked and
> are exact: 9 monitored stablecoins, 30 assets on the alert feed, 8 risk profiles.
>
> **The coin figures in §2 measure live price coverage, not the catalog, and they have
> barely moved — do not read a coverage expansion into this document.** `COINGECKO_IDS`
> (`lib/api/live/coingeckoIds.ts`) held **78** entries on 2026-06-30 and holds **80** on
> 2026-09-20, so "77–78 coins" was exact when this was written on 2026-07-01 and is off by
> two now. The registry catalog is a different, larger universe: `assetCatalog.ts` held
> **98** entries on 2026-06-30 — already before this assessment — and has held **108** since
> 2026-07-08. If the coverage-ceiling row is read as catalog coverage it understated the
> product on the day it was authored, which is a July authoring choice and not drift.
> Neither 80 nor 108 disturbs that row's conclusion against 10,000+ on CoinGecko/CMC.
>
> Decisions recorded: RP-6, D14 and D18 are the owner's and are not reversible by a
> document edit. Per `docs/agents/checklist-steward.md`, this file's caveats are
> **extended rather than its conclusions edited** — the market and competitor analysis below
> is untouched and remains a dated July 2026 snapshot.

_Prepared 2026-07-01. Grounded in a hands-on audit of the running product (live API tests
across all 78 supported coins, per-provider data-flow attribution, and page-by-page feature
verification) plus current competitor pricing research (July 2026)._

---

## 1. Executive summary

**Verdict: CAEP is not sellable as-is, but it contains a genuinely marketable product —
if it is repositioned as a focused crypto-operations utility rather than a general
analytics platform, and if ~3–6 months of productization work (auth, multi-tenancy,
hosting) is completed first.**

- Against research platforms (Messari, Nansen) CAEP loses on data depth and will not win.
- Against **utility tools** (fee calculators, staking dashboards, portfolio trackers) CAEP
  is competitive today and differentiated in three specific ways (§4).
- The most defensible angle is one almost no competitor serves: **agent-native crypto
  data** (clean REST + OpenAPI + MCP server) at a moment when AI-agent tooling demand is
  accelerating.
- The realistic business is a **niche freemium SaaS** ($0 / ~$10–15 per month) targeting
  active retail crypto operators, with an API/agent tier as the growth vector — not a
  venture-scale platform play.

---

## 2. Product state (tested, honest)

### What is real and works today (verified live this session)
| Capability | State |
|---|---|
| Live prices / market caps | 🟢 77–78 coins via CoinGecko + CoinMarketCap Pro + Binance, 3-way fallback |
| Transfer-route fee optimizer | 🟢 Ranked routes, time estimates, address-collision safety warnings — decision-grade |
| Staking explorer | 🟢 6-dimension risk taxonomy, TVL, audits, receipt tokens (APRs partly estimates) |
| Technical Analysis suite | 🟢 8 chart types, 25+ indicators, ~18-pattern detector with trade projections, backtester, two-click growth Measure tool |
| News + sentiment | 🟢 Multi-provider (RSS workhorses + NewsAPI + GNews), asset tagging |
| Alerts (peg + 24h moves) | 🟢 30 assets monitored, surfaced in bell + dashboard |
| Reserves transparency | 🟢 Live DefiLlama supply/collateralization for 9 stablecoins |
| Portfolios / wallets | 🟢 Live prices; on-chain balance reads |
| Agent surface | 🟢 REST `/api/v1` + OpenAPI + MCP server |
| Integrations transparency | 🟢 Per-provider utilization indicator ("serving N items / failing / not consumed") |

### What is not sellable yet
| Gap | Why it blocks selling |
|---|---|
| **Single-user architecture** | Provider keys and config live in a local JSON file; no database; no multi-tenancy. This is a desktop-style app, not a SaaS. **The #1 scaling blocker.** _(Annotated 2026-09-20: the "no database" half is no longer true — `users`, `portfolios`, `watchlists`, `builder_plans`, `user_wallets` and `instruments` are Postgres tables under `frontend/src/lib/db/schema/`. Provider keys are still a single local `.provider-config.json` and module entitlements are still localStorage-only, so the blocker this row names does still stand.)_ |
| **No authentication** | Login is deliberately disabled (tracked for re-enable). No accounts → no customers. |
| **Risk scoring unfinished** | Flagship "risk" positioning shows N/A; 3-way scale inconsistency unresolved (framework in progress). |
| **Data licensing exposure** | Prices come from CoinGecko/CMC under terms that generally do **not** permit redistribution to paying customers without commercial data licenses. BYOK (bring-your-own-key) sidesteps this; a hosted data product does not. |
| **Coverage ceiling** | ~78 coins vs. 10,000+ on CoinGecko/CMC. Fine for an ops utility; fatal for a "market data" pitch. |

---

## 3. Competitive landscape (July 2026 pricing)

| Competitor | What they sell | Price | CAEP overlap |
|---|---|---|---|
| **Messari** | Institutional research, data, taxonomy | Pro ~$29.99/mo ($300/yr); Enterprise $6k–34k/yr | Low — research depth CAEP can't match |
| **Nansen** | On-chain "smart money" analytics | Free + Pro $49/mo annual ($69 monthly); collapsed its $999 tier in late 2025 | Low-medium — signals pricing pressure at the high end |
| **CoinStats** | Retail portfolio tracker | Free / Premium ~$13.99/mo / "Degen" ~$62.91/mo | **High** — closest retail price anchor |
| **Delta (eToro)** | Portfolio tracker | Pro ~$99.99/yr | High on portfolio; none on ops tools |
| **CoinGecko / CoinMarketCap** | Market data, free consumer apps | Free (ads/API monetized) | High on data; they set the "free" expectation |
| **DeFiLlama** | DeFi TVL/fees analytics | **Free, open** | Medium — sets free expectation for reserve/TVL data |
| **Staking Rewards** | Staking data | Free + enterprise data sales | Medium-high on staking; CAEP's risk taxonomy is deeper per-provider |
| **TradingView** | Charting | ~$14–60/mo | Medium on TA; unbeatable on charting breadth |
| **Fee/bridge comparators** (Swapzone etc.) | Route comparison | Free (affiliate-monetized) | **High** on transfer routing — but none combine it with the rest |

**Key market context:** the crypto asset-management tools market is ~$1.06B (2026) growing
~20% CAGR toward ~$5.6B by 2035, with **retail as the fastest-growing segment (~28% CAGR)**.
Meanwhile Nansen's 90%+ price collapse and CryptoPanic killing its free tier show a market
squeezing the middle: winners are either free-with-scale or cheap-and-focused.

---

## 4. Where CAEP actually wins

1. **Transfer-route optimizer with safety rails.** Ranked multi-network routes with fee
   breakdowns, ETAs, and EVM address-collision warnings. Free comparators do pieces of
   this; none pair it with warnings + staking + portfolio context. **This is the wedge.**
2. **Staking risk taxonomy.** 6-dimension per-provider risk scoring (custody, counterparty,
   contract, slashing, liquidity, regulatory) is more granular than Staking Rewards' public
   surface.
3. **Agent-native surface.** REST + OpenAPI + MCP server means an AI agent can consume
   CAEP out of the box. Messari/Nansen sell human dashboards; the agent-tooling wave is
   underserved and growing. This is also the most future-proof differentiator.
4. **Data honesty as brand.** Strict-live architecture (no fabricated numbers, explicit
   "not available", per-provider utilization transparency) is a real trust story in a
   market notorious for fake data.

## Where CAEP loses (don't fight these battles)
- Research depth, on-chain intelligence, historical archives → Messari/Nansen/Dune win.
- Coin coverage and charting breadth → CoinGecko/TradingView win.
- "Free everything" expectations → DeFiLlama/CoinGecko set the floor; CAEP's free tier
  must be genuinely useful.

---

## 5. Can it be marketed and sold?

**Yes — in one specific form.** As **"the crypto operator's toolkit"**: a $0/$10–15
freemium web app for active retail users who move funds between exchanges, stake, and
watch a portfolio — plus an API/agent tier. Positioning sentence:

> _"CAEP tells you the cheapest safe way to move your crypto, which staking is actually
> safe, and watches your pegs and positions — with data honesty no one else offers, and
> an API your AI agent can use."_

**No — in the form it superficially resembles.** A general "institutional analytics
platform" pitch dies on contact with Messari/Nansen at comparable prices and DeFiLlama
at free.

### Recommended pricing
| Tier | Price | Contents |
|---|---|---|
| Free | $0 | Full ops tools with keyless data (CoinGecko/RSS/Reddit), limited alerts |
| Pro | **$9.99–14.99/mo** | BYOK premium sources, full alerts, portfolios, TA suite, priority data |
| Agent/API | usage-based or ~$29/mo | keyed `/api/v1` + MCP access, rate limits |

Undercuts CoinStats Premium and Messari Pro; BYOK keeps data costs and licensing risk
near zero at launch.

---

## 6. Growth & scaling picture

### Phase 0 — Productize (3–6 months, prerequisite to any revenue)
- Re-enable + harden auth (task already tracked); accounts, sessions
- Multi-tenant backend: move provider config/keys from local JSON to a real DB with
  per-user encrypted key storage (the single biggest architectural change)
- Hosting (Vercel/Fly + managed Postgres), rate limiting, monitoring
- ~~Finish the risk framework (resolve the 3-scale inconsistency — tracked)~~ — **overtaken,
  annotated 2026-09-20.** The framework shipped (R1/R2, 2026-07-19) on the canonical 0–100
  higher-is-safer scale and the "3-scale inconsistency" was disproved rather than resolved
  (`docs/architecture/risk-scale-spec.md`); the user-facing scores it was to power were then
  withdrawn by RP-6 (2026-08-29) and D14 (2026-09-14). Nothing on this line is outstanding —
  do not start risk-scoring work from it.
- Estimated infra cost at this stage: **$50–200/mo**

### Phase 1 — Wedge launch (months 3–9)
- Ship free tier around the **transfer-fee optimizer** as the acquisition hook (it's
  inherently shareable: "I saved $40 moving USDT")
- Content/SEO: route-cost pages per exchange-pair rank well and are cheap to generate
  from existing data
- Success gate: retention on the ops tools, not raw signups

### Phase 2 — Monetize (months 6–15)
- Pro tier on; target conversion benchmarks for freemium utilities (2–5%)
- 1,000 Pro subs ≈ **$120–180k ARR** — a real solo/small-team business
- Watch the data-licensing line: the moment you serve premium data from *your* keys to
  customers, you need commercial agreements (CoinGecko/CMC enterprise API tiers run
  $500–thousands/mo)

### Phase 3 — The agent bet (months 12+)
- Package `/api/v1` + MCP as a first-class product for AI-agent builders
- This is the scenario with non-linear upside: if agent-mediated crypto ops grow the way
  agent tooling generally is growing, being early with a clean MCP surface matters more
  than coin coverage

### Scaling constraints to plan for
| Constraint | When it bites | Mitigation |
|---|---|---|
| Upstream rate limits (CoinGecko ~30/min free) | ~hundreds of concurrent users | Server-side shared cache (already partially built), paid API tiers |
| Data redistribution licensing | First paying customer on hosted data | BYOK default; commercial licenses when revenue justifies |
| Single-file config | Immediately at 2 users | DB migration in Phase 0 |
| Regulatory (advice vs. information) | Risk scores + "recommendations" at scale | Keep framing informational; disclaimers already present in backtester |

---

## 7. Honest risk register

1. **Crowded, free-anchored market** — the default competitor is "free"; only the wedge
   + trust story earns payment.
2. **Solo-maintainer risk** — 20+ live integrations rot without maintenance (Forkast feed
   died silently; CryptoPanic killed its free tier — both caught this session).
3. **Platform dependency** — CAEP resells presentation of others' data; upstream terms
   changes are existential without BYOK.
4. **Crypto cyclicality** — retail tool demand tracks the market cycle; current drawdown
   cuts both ways (cheaper acquisition, lower willingness to pay).
5. **The risk-score gap** — the product is named "Crypto Asset **Evaluation** Platform";
   shipping paid tiers while the headline evaluation shows N/A undermines the pitch.
   Finish the framework before charging. — **Annotated 2026-09-20: the premise is void.**
   There is no headline evaluation left to finish, or to show as N/A. RP-6 (2026-08-29) and
   D14 (2026-09-14) withdrew every published per-coin composite score, and D18 (2026-09-14)
   defers new risk profiles until a surface is approved to render one — so the instruction
   this item ends with is not work to do. The name it argues from is gone too: the product
   was renamed **Finance Now** (`CLAUDE.md`, `README.md`) and no longer carries "Evaluation"
   in its title. A residual version of the risk survives and is the owner's to weigh, not a
   build task — the README still positions the app as "an AI-enhanced investment evaluator"
   while it deliberately publishes no per-coin score.

## 8. Go/no-go milestones
- [ ] Phase 0 complete (auth + multi-tenant + hosted) — **gate for any marketing**
- [ ] ~~Risk framework shipped (removes the N/A on the flagship metric)~~ — **OVERTAKEN,
      annotated 2026-09-14 (T-310, owner decision D15).** Both halves of this milestone are
      now false, in opposite directions. The framework **did** ship (R1/R2, 2026-07-19):
      `lib/risk/` is live with eight profiles on a canonical 0–100 higher-is-safer scale. But
      the "flagship metric" it was meant to un-N/A **was withdrawn** — RP-6 removed every
      per-coin risk score on 2026-08-29, "Safety Score" no longer exists as a user-facing
      figure, and D14 (2026-09-14) removed the remaining composite scores from `/api/v1` and
      MCP. So this cannot be ticked and cannot be failed: the gate measures a metric the
      product deliberately does not publish. Do not restate it as "risk framework shipped ✅"
      either — that would imply the user-facing outcome this line was actually gating.
      `lib/risk/` survives with one live consumer, the options Trade Risk Scorer.
- [ ] 100 weekly-active free users with >30% week-4 retention on ops tools
- [ ] First 50 Pro conversions (validates the $10–15 price point)
- [ ] 5 external consumers of the API/MCP surface (validates the agent bet)

---

_Sources: Messari pricing ([messari.io/pricing](https://messari.io/pricing),
[CaptainAltcoin review](https://captainaltcoin.com/messari-review/)); Nansen 2025–26
repricing ([nansen.ai/plans](https://www.nansen.ai/plans),
[Nansen pricing explained](https://academy.nansen.ai/articles/0414043-new-pricing-explained),
[ChainPlay review](https://chainplay.gg/blog/nansen-review/)); portfolio-tracker pricing
([CoinLedger](https://coinledger.io/tools/best-crypto-portfolio-tracker),
[Bitget comparison](https://www.bitget.com/academy/how-does-coinstats-compare-to-other-crypto-portfolio-trackers-in-terms-of-fees-and-supported-exchanges-in-2026),
[Benzinga Delta review](https://www.benzinga.com/money/delta-crypto-tracker-by-etoro-review));
market sizing ([Fortune Business Insights](https://www.fortunebusinessinsights.com/crypto-asset-management-market-106009),
[Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/cryptocurrency-market));
DeFiLlama ([defillama.com](https://defillama.com/))._
