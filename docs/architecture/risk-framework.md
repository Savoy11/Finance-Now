# Unified Risk Framework

**Status:** v1 core implemented (`frontend/src/lib/risk/`) · **8 profiles**: commodity,
cryptoAsset, currency, equity, optionsTrade, rateInstrument, stablecoin, stakingAdapter
**Date:** 2026-07-03 · **Status line refreshed:** 2026-09-08

> **The canonical scale, its bands and its vocabulary are specified in
> [`risk-scale-spec.md`](./risk-scale-spec.md), not here.** This document is the
> design rationale and the profile roadmap; that one is the contract. Where they
> appear to disagree, the spec wins.

## Why

The suite vision is one platform family — crypto (Finance Now today), equities, ETF/mutual
funds, bonds, commodities — sellable together or separately, sharing a home shell and
a set of common services. Risk scoring is Finance Now's identity feature, so it must become
a **shared service with one vocabulary**, not a per-app reinvention.

The codebase had **three inconsistent risk systems** when this was written:

| System | Location | Scale | Polarity | Bands |
|---|---|---|---|---|
| Backend scoring engine | `backend/app/scoring/` | 0–100 | higher = safer | low ≥80, moderate ≥65, elevated ≥50, high ≥30 |
| Frontend risk utils | `frontend/src/lib/utils/risk.ts` | 0–100 | higher = safer | low ≥80, moderate ≥60, elevated ≥40, high ≥20 |
| Staking providers | `frontend/src/lib/data/stakingProviders.ts` | 1–10 | higher = riskier | low ≤3, **medium** ≤5.5, high ≤7.5, critical |

Same product, three scales, two polarities, two band vocabularies, and thresholds
that disagree even where the vocabulary matches. Every new asset class would have
multiplied this. The unified framework fixes the vocabulary before that happens.

> **Where those three stand now (2026-09-08).** The table above is the problem
> statement, kept as written.
>
> - **Frontend risk utils — resolved (R1/R2).** `lib/utils/risk.ts` is a thin
>   re-export of `lib/risk/presentation.ts` and `bandForScore()`; it holds no
>   thresholds of its own. The canonical bands are 80/60/40/20.
> - **Staking providers — deliberately unresolved, and bounded.**
>   `computeOverallRisk()`/`getRiskLevel()` are marked `@internal` and retained
>   **only** because the public `/api/v1/staking/opportunities` contract still
>   serves those fields (R2 §5.3). No deprecation date, on purpose: removing them
>   is an API break, not a cleanup. New code goes through
>   `scoreStakingProvider()`, which wraps the same weights and converts at the
>   boundary.
> - **Backend scoring engine — dormant.** Its 65/50/30 bands still differ, and
>   that stays open while the FastAPI backend's future is itself an open question
>   (ROADMAP.md, Phase 6). Nothing in the shipping app reads them.
> - **A fourth system was removed rather than reconciled**: the per-coin composite
>   published on `/assets` (RP-6, 2026-08-29). See the spec's post-implementation
>   note. The pump-report's separate 0–10 measure was renamed `suspicionScore` on
>   2026-09-08 so it can no longer be mistaken for this scale.
> - **Coin discovery — also removed, and in two steps that are easy to conflate**
>   (added 2026-09-12, T-360). Item 5b (2026-08-18) renamed its four *verdicts*
>   ("Strong Add / Consider / Monitor / Too Speculative") to score bands, because a
>   verdict tells the reader what to **do**. Two days later W3-1 (2026-08-20) cut the
>   **score itself** — owner: *"remove any reference to a score because it may imply a
>   recommendation. Replace with price, growth, or liquidity."* So `/coin-discovery`
>   now publishes no score and no band: `CandidateCoin` carries price, growth, volume,
>   liquidity ratio, market cap and a factual category/utility note, sorted by the
>   reader over facts, defaulting to the feed's own market-cap order.
>   ⚠ **Do not read the surviving `AddedCoin.score` / `.profileBand` fields as a fifth
>   system.** They are write-never, read-defensively legacy keys for coins a user saved
>   *before* the cut, in the user's own localStorage list — nothing writes them now, and
>   deleting them would blank data the user already has. That is the deliberate
>   exception to RP-6's "no permanently-null fields" rule, which applied to a
>   server-shaped `Asset`, not to a user's saved records.
## Research grounding

Institutional multi-asset risk systems (Bloomberg [MAC3](https://professional.bloomberg.com/products/risk/mac3/),
MSCI [BarraOne](https://www.msci.com/data-and-analytics/factor-investing/multi-asset-class-factor-models))
converge on the same architecture: a **single factor/dimension engine** with
**per-asset-class factor catalogs** — equities modeled by return factors, fixed
income by duration/convexity/spread, derivatives by Greeks and implied volatility
([overview](https://www.landytech.com/blog/managing-risk-with-multi-asset-factor-models),
[Nasdaq](https://www.nasdaq.com/articles/risk-modeling-assumptions-and-techniques-for-multi-asset-portfolios)).
That is exactly the shape of Finance Now's existing backend engine (weighted components +
confidence), generalized. The framework keeps that architecture and makes it
asset-class-neutral.

For the options profile, calibration anchors follow practitioner liquidity
heuristics — open interest ≥ 100 contracts and tight bid/ask spreads as the
liquidity floor ([TradingBlock](https://www.tradingblock.com/blog/options-liquidity),
[Tackle Trading](https://tackletrading.com/options-101-bidask-open-interest-and-volume/),
[Option Samurai](https://optionsamurai.com/blog/options-liquidity-tips-to-identify-the-best-opportunities-with-real-market-example/)) —
plus IV-rank direction fit and IV-crush exposure around earnings.

## Canonical conventions

1. **Scores are 0–100, higher = safer** — at both dimension and composite level.
   Matches the backend engine and the risk-scores UI users already know.
2. **Bands:** `low ≥80 · moderate ≥60 · elevated ≥40 · high ≥20 · critical <20`
   (the frontend thresholds). One vocabulary: `low | moderate | elevated | high | critical`.
3. **Missing data lowers confidence, never the score.** Dimensions without data are
   excluded and remaining weights renormalize; `coverage` reports how much of the
   profile's weight had data, and `confidence = weighted dimension confidence × coverage`.
   (Same philosophy as the backend engine's completeness-based confidence.)
4. **Profiles are versioned recipes.** Weights or semantics change → version bump,
   so stored scores remain comparable (mirrors backend `model_version`).
5. **Every score carries evidence** — the raw metrics that produced it. Scores are
   explainable or they're not trustworthy, and "research tool, not advice" framing
   depends on showing the math.
6. **The core is pure TypeScript** — no React, Next, or API imports — so it lifts
   into a shared `@suite/core` package unchanged when the multi-app suite lands.

## Architecture

```
frontend/src/lib/risk/
├── types.ts          # RiskBand, RiskProfileSpec, DimensionScore, CompositeRisk …
├── normalize.ts      # piecewise/linear normalizers, volatility, drawdown, scale converters
├── engine.ts         # validateProfile, composeRisk — profile-agnostic composite math
├── profiles/
│   ├── equity.ts          # EQUITY_RISK_PROFILE + scoreEquity()
│   ├── optionsTrade.ts    # OPTIONS_TRADE_RISK_PROFILE + scoreOptionsTrade()
│   └── stakingAdapter.ts  # existing staking model expressed in the framework
└── __tests__/        # vitest — engine math, normalizers, profile behavior (44 tests)
```

A **profile** declares weighted dimensions; a **scorer** turns raw inputs into
per-dimension scores with evidence; the **engine** composes them into one
`CompositeRisk` with band, confidence, coverage, and warnings. Adding an asset
class = adding a profile module; the engine, bands, and UI treatment come free.

## Profiles

### Staking provider (crypto) — adapter, v1.0.0
Wraps the existing six-dimension editorial model with the **same weights** as
`computeOverallRisk()` (counterparty 25%, custody 20%, liquidity 20%, contract 15%,
slashing 10%, regulatory 10%), converted to the canonical scale. Tests verify the
legacy ordering is preserved exactly (the conversion is linear). The staking page
keeps using the legacy functions for now — migration is a UI change for later.

### Equity — v1.0.0
| Dimension | Weight | Inputs |
|---|---|---|
| Volatility | 25% | annualized vol from daily closes; beta as evidence |
| Drawdown | 20% | max peak-to-trough over supplied history |
| Liquidity | 20% | avg daily dollar volume; spread caps the score |
| Size | 15% | market-cap tier (nano → mega) |
| Fundamentals | 20% | debt/equity, net margin |

All inputs available from FMP-class providers. Calibration points are v1
heuristics encoded as `piecewise()` anchors — deliberately easy to re-tune.

### Options trade — v1.0.0 (the options-helper differentiator)
| Dimension | Weight | Inputs |
|---|---|---|
| Liquidity | 30% | per-leg OI, volume, spread% — worst leg governs |
| IV environment | 20% | IV rank fit for trade direction; earnings-before-expiry penalty |
| Assignment | 15% | short-leg moneyness/delta; ex-div penalty for short calls |
| Time decay | 15% | DTE vs net premium side; deep-OTM long premium floor |
| Defined risk | 20% | bounded vs unbounded max loss; loss:profit ratio |

Scores single- and multi-leg positions. Output is explanatory (evidence + warnings),
never a recommendation — keeps the product on the research/education side of the
investment-advice line.

## Roadmap

*Annotated 2026-09-08 with what shipped.*

1. **Wire into UI** — ⚠ **partly done, and partly reversed.** The breakdown UI ships
   on the Trade Risk Scorer (`/equities/options`). The **assets** half was built and
   then removed under RP-6, so this item can never complete as written.
2. **Expose to the suite** — ⚠ partial. `score_options_trade` exists as an agent tool,
   `POST /api/v1/options/score` and an MCP tool. `score_equity` and the general
   `/api/v1/risk/*` surface are not built.
3. **ETF/fund profile** (`fund.ts`) — ⬜ not built. Inputs exist in `fundCatalog`
   (expense ratio, AUM, category) plus concentration from `lookThrough`.
4. **Bond profile** — ✅ **DONE (P2-R3)** as `rateInstrument.ts`. The follow-up idea of
   scaling the duration dimension by realised rate volatility is deferred: it needs a
   persisted daily yield series that does not exist yet.
5. **Crypto token profile** — ⬜ **superseded.** It was framed as porting the backend's
   components so "frontend mock-mode and backend produce identical shapes"; there is no
   mock mode (`LIVE_DATA` is hardcoded true) and the backend is dormant. `cryptoAsset.ts`
   exists but publishes nothing (RP-6).
6. **Calibration pass** — ⬜ not started; still waiting on real per-class distributions.

Also shipped beyond this list, all P2-R3: `commodity.ts` and `currency.ts`.
