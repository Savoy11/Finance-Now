# Unified Risk Framework

**Status:** v1 core implemented (`frontend/src/lib/risk/`) · **7 profiles**: commodity,
cryptoAsset, currency, equity, optionsTrade, rateInstrument, stablecoin (stakingAdapter was
the 8th until owner decision D26 deleted it, 2026-09-25)
**Date:** 2026-07-03 · **Status line refreshed:** 2026-09-26

> **The canonical scale, its bands and its vocabulary are specified in
> [`risk-scale-spec.md`](./risk-scale-spec.md), not here.** This document is the
> design rationale and the profile roadmap; that one is the contract. Where they
> appear to disagree, the spec wins.

> **Checked 2026-09-21 (queue item T-360).** T-360 asked for a
> "See `risk-scale-spec.md`" cross-reference under the status line — the block above
> already is one, and is stronger than the item assumed, so nothing was added. The
> status line's eight profile names are exactly the files in
> `frontend/src/lib/risk/profiles/` today; each is re-listed with what it exports under
> **Architecture** below. Read the **names** as the record rather than the figure "8":
> when a ninth lands (`fund.ts`, queue item T-353) the number goes wrong silently and
> the list goes wrong visibly.

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

> ### Answer first: all three are resolved. None of the table above is live.
>
> *Added 2026-09-22 (queue item T-360). The dated blocks below are prior passes and are
> kept exactly as written; this one exists so the answer is not four annotations deep.*
>
> | The table's system | Where it ended up |
> |---|---|
> | Frontend risk utils | Canonical **80/60/40/20**, higher = safer. `lib/utils/risk.ts` is now a thin re-export holding no thresholds of its own (R1/R2) |
> | Staking providers | The composite was **deleted**, not migrated — `computeOverallRisk()`/`getRiskLevel()` are gone (D14, 2026-09-14). The six dimensions remain and are published as INPUTS, 1–10 higher = riskier, with nothing combining them |
> | Backend scoring engine | **Frozen, not reconciled** (D2, 2026-09-14). Its 65/50/30 bands still differ; `backend/FROZEN.md` makes adopting the canonical bands a precondition of any revival, so it cannot be reopened silently |
>
> **A fourth system was removed rather than reconciled** and never appeared in the table:
> the per-coin composite on `/assets` (RP-6, 2026-08-29). Two of the four outcomes were
> DELETIONS — which is the thing this document is easiest to misread about. Unifying a
> vocabulary was the goal in 2026-07; by 2026-09 the owner had decided twice that the
> right number of scores is none. Do not read an unresolved row above as work to do.
>
> **Why the table is still here.** T-360 asked for it to be REPLACED by a dated note.
> Owner ruling, 2026-09-22: **annotate**. It is the dated problem statement this whole
> framework was written against, and the only surviving record of what the three systems
> looked like before R1/R2 — delete it and every annotation beneath becomes an answer to
> a question nobody can see. It is a historical record, not a status board.

> **Where those three stand now (2026-09-08).** The table above is the problem
> statement, kept as written.
>
> - **Frontend risk utils — resolved (R1/R2).** `lib/utils/risk.ts` is a thin
>   re-export of `lib/risk/presentation.ts` and `bandForScore()`; it holds no
>   thresholds of its own. The canonical bands are 80/60/40/20.
> - **Staking providers — RESOLVED 2026-09-14 by owner decision D14.**
>   `computeOverallRisk()`/`getRiskLevel()` are **deleted**. They had been retained
>   only because the public `/api/v1/staking/opportunities` contract served those
>   fields (R2 §5.3); D14 removed the published fields on editorial grounds — a
>   composite that ranks providers against each other reads as a recommendation —
>   so the constraint that kept them alive is gone with them. The API break was
>   taken deliberately, not as a cleanup.
>
>   ~~The six `RiskProfile` dimensions remain and are published as inputs.~~ **Overtaken
>   2026-09-25 (D26): the six dimensions and `stakingAdapter.ts` are removed.** The
>   framework's other profiles are unaffected.
>   `scoreStakingProvider()` is retained as the canonical adapter but has **no live
>   consumer**; D18 defers new profiles until a surface is approved to render a
>   score. Note the D14 ruling named only the public API as the helpers' consumer —
>   `/live-data/staking-discovery` was a second one, and was changed with it.
> - **Backend scoring engine — RESOLVED 2026-09-14 by owner decision D2.** The FastAPI
>   backend is retired and frozen (`backend/FROZEN.md`); nothing in the shipping app reads
>   it and no CI job builds it, so the divergence below is no longer a live inconsistency.
>   It is **recorded rather than reconciled** — FROZEN.md makes adopting the canonical
>   80/60/40/20 bands a precondition of any revival, so it cannot be reopened silently.
>
>   *(Superseded text, kept for the record — this describes the state before D2 and is
>   NOT current:)* **Backend scoring engine — dormant.** Its 65/50/30 bands still differ,
>   and that stays open while the FastAPI backend's future is itself an open question
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

> **Where §Why stands — re-checked 2026-09-21 (queue item T-360, second pass).** T-360
> asked for the table above to be **replaced** by a dated note. It is **added beside**
> the table instead: the table is the dated problem statement this framework was written
> against, and the repo's rule is that dated records are annotated, never rewritten.
> Deleting it would also destroy the only record of what the three systems looked like
> before R1/R2. (The coin-discovery bullet above was T-360's first pass, 2026-09-12.)
> Each claim below was checked against the tree on 2026-09-21, not carried over:
>
> - **The scale is settled, and it was settled in R1/R2.** R1 chose it
>   (`docs/TASK-QUEUE.md`, "R1 — Choose the canonical risk scale (read-only)"); R2
>   shipped the migration in phases 1–5, 2026-07-19 → 2026-07-24
>   (`risk-scale-spec.md` status line, `docs/assessments/R2-phase2-verification.md`,
>   `docs/assessments/R2-phases-3-5.md`). Canonical: 0–100, higher = safer, bands
>   80/60/40/20, vocabulary `low | moderate | elevated | high | critical`.
> - **The backend's bands are still 65/50/30 — and the service is FROZEN, not merely
>   dormant.** `backend/app/scoring/weights.py` (`RISK_BAND_THRESHOLDS`) still reads
>   `low ≥80 · moderate ≥65 · elevated ≥50 · high ≥30`, so its middle three rungs
>   disagree with the canonical 60/40/20. Nothing reads them: the FastAPI backend was
>   retired by owner decision D2 (2026-09-14) and `backend/FROZEN.md` records the
>   divergence itself, making adoption of the canonical bands a precondition of any
>   revival. This is recorded rather than reconciled — do not describe it as an open
>   inconsistency in the shipping app, and do not re-downgrade "frozen" to "dormant".
> - **Pump-report is a SEPARATE scale and never converts onto this one.**
>   `frontend/src/app/live-data/pump-report/investigate/route.ts` publishes
>   `suspicionScore` — 0–10 where **higher = more suspicious** — with its own
>   `clean | suspicious | flagged | critical` vocabulary, renamed from `riskScore` on
>   2026-09-08 precisely because it collided with the canonical scale on both range and
>   direction. It measures how much fraud evidence an investigation turned up about a
>   target, not the safety of an asset, so it must never be rendered in a risk badge or
>   compared against a composite (spec §4.5).
> - **Coin discovery's composite was REMOVED by W3-1 (2026-08-20), not rescaled.**
>   `frontend/src/app/live-data/coin-discovery/route.ts` carries the decision at the top
>   of the file and `CandidateCoin` publishes no score and no band; `docs/TASK-QUEUE.md`
>   records W3-1 as done. The two-step history — item 5b renamed the verdicts, W3-1 then
>   cut the score itself — is in the bullet above, and conflating the two steps is the
>   error that pass existed to fix.

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
├── profiles/         # EVERY file in this directory, listed 2026-09-21 (T-360) —
│   │                 #   named rather than counted, so adding one makes this list
│   │                 #   incomplete instead of making a number wrong
│   ├── commodity.ts       # COMMODITY_RISK_PROFILE + scoreCommodity()          (P2-R3)
│   ├── cryptoAsset.ts     # CRYPTO_ASSET_RISK_PROFILE — built, publishes nothing (RP-6)
│   ├── currency.ts        # CURRENCY_RISK_PROFILE + scoreCurrency()            (P2-R3)
│   ├── equity.ts          # EQUITY_RISK_PROFILE + scoreEquity()
│   ├── optionsTrade.ts    # OPTIONS_TRADE_RISK_PROFILE + scoreOptionsTrade()
│   ├── rateInstrument.ts  # RATE_INSTRUMENT_RISK_PROFILE + scoreRateInstrument()
│   │                      #   (P2-R3; what the spec's §6 "bond profile" became)
│   ├── stablecoin.ts      # STABLECOIN_RISK_PROFILE + applyFatalFlaws()
│   └── stakingAdapter.ts  # STAKING_PROVIDER_RISK_PROFILE + scoreStakingProvider()
│                          #   — the staking model expressed in the framework;
│                          #   retained, no live consumer since D14
└── __tests__/        # vitest — engine math, normalizers, presentation, per-profile
                      #   behaviour, and riskScoringRemoved.test.ts (the RP-6/D14 guard).
                      #   Count deliberately not stated: it read "44 tests" until
                      #   2026-09-21, when the suites held well over twice that
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

> **Which queue item now carries each roadmap entry (annotated 2026-09-21, T-360).**
> The 2026-09-08 annotations above stand unchanged; this only records where each item
> went. T-360 named four queue items — T-353, T-356, T-357, T-358 — and they cover
> **four of the six** entries, not all six. Statuses below are the `2026-09-07` queue
> snapshot's own; the tree check beside each is from 2026-09-21.
>
> | Roadmap | Queue item | Queue status | Checked in the tree 2026-09-21 |
> |---|---|---|---|
> | 1. Wire into UI | **T-358** | `superseded` | `components/options/TradeRiskReport.tsx` exists, so the options third is done; assets closed by RP-6 and staking by RP-3. Equity is the only built-but-unwired profile, and rendering it is T-357's owner question, not a component task |
> | 2. Expose to the suite | **T-357** | `blocked` | `app/api/v1/` has no `risk/` directory — the general `/api/v1/risk/*` surface is still unbuilt. Blocked on the owner: does RP-6's "no per-asset risk figure" reach equities and the API/MCP surfaces? |
> | 3. ETF/fund profile | **T-353** | `open` | `lib/risk/profiles/fund.ts` is absent, as the item assumes. Scoped like P2-R3 — expense ratio, AUM, category, `lookThrough` concentration → `fundRiskTier`, **no new UI surface** |
> | 4. Bond profile | — | — | **No queue item among the four.** Already ✅ done as `rateInstrument.ts`; its 2026-09-08 annotation stands |
> | 5. Crypto token profile | — | — | **No queue item among the four.** Already ⬜ superseded; its 2026-09-08 annotation stands |
> | 6. Calibration pass | **T-356** | `blocked` | Blocked on spec **P5** (is cross-asset-class comparison a supported product claim?). Only worth doing if P5 is answered "yes" — the spec's §6.4 warns a 75 on a bond and a 75 on a crypto asset are not the same statement |
>
> ⚠ **Items 4 and 5 are deliberately un-annotated here**: none of the four named queue
> items is about them, and inventing a mapping would make a guess look checked. The
> queue's line references into this file (T-358 cites lines 118–119, T-353 line 122)
> have drifted well past where that text now sits — each was resolved by matching the
> quoted sentence, never the line number.

Also shipped beyond this list, all P2-R3: `commodity.ts` and `currency.ts`.
