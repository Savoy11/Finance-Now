# Owner decisions — 2026-09-28

Recorded from the owner's replies in the FN & NC business-and-compliance chat (Block 1 of
the 28 Sep starting-point plan). Same form as `2026-09-14-owner-decisions.md`: one row per
ruling, what it cascades to, and what was actually done.

| # | Decision | Ruling | Cascades to |
|---|---|---|---|
| D28 | Entity structure (T-284, T-285, T-286) | **One new North Carolina LLC**, formation targeted **January 2027**, owning **Finance Now** and **News Charts** as registered assumed names. The owner's existing rental LLC stays completely separate (not a parent, not a subsidiary). Single-member, **default (disregarded) tax status**; the S-corp election is revisited once profit justifies payroll — **not in the launch year**. → APPLIED | T-284, T-285, T-286 close. T-287 and T-288 stay parked under D13, now timed to the rollout rather than blocked on a structure decision |
| D29 | Pricing and editions (T-085, T-086) | *"We are still using the August pricing model but it will need to be reassess[ed]."* The August model is recorded as the **working plan, pending the owner's reassessment**: hosted tiers Free / Core $9.99 / Pro $29 / Advisor $99 per seat (annual $99 / $249 / $990), plus a **BYOK Perpetual desktop edition at $299** (about $149 upgrades). Tiered bundles, not per-module licences. → RECORDED, no code change | T-085 and T-086 stay **parked under D21** (paid decisions deferred); each gets a progress note pointing here |
| D30 | Professional help | *"No not at this time; I am the accountant."* The owner self-administers the books and compliance; no lawyer or CPA is engaged for now. **D4 is unchanged:** the personalised tools stay dark until a qualified review clears them. → RECORDED | T-284/T-285's "book a lawyer/accountant consultation" step is superseded by D28. D4's review stays the gate for the personalised tools |
| D31 | House source-labeling policy (T-292) | **Approved with two corrections**: rename Chronolens → News Charts, and state honestly that `<DerivedNote>` is required by the policy but **not yet rendered anywhere** (imported once, in `coin-discovery/page.tsx:16`, never used). §7's three unenforced rows stay **convention for now**; no coverage test is queued. → APPLIED | T-292 closes. `docs/policies/source-labeling.md` status moves from DRAFT to APPROVED |
| D32 | "Risk framework shipped" milestone (T-310) | **Approved as applied.** The strike-through and OVERTAKEN annotation in `docs/MARKET-ASSESSMENT.md` §8 (applied 2026-09-14 under D15) stand as written. → APPLIED | T-310 closes |
| D33 | Methodology Guide scope (T-359) | **Scope corrected and approved.** The guide (Google Doc "CAEP — Methodology Guide", last updated 2026-07-22) has no risk section. The new **Section 3 — Risk scoring** covers: the options Trade Risk Scorer; how Portfolios' 1–10 tiers and the fund suitability band are derived; the Pump Report's separate 0–10 heuristic and AI suspicion scores; and what is deliberately **not** scored (per-coin scores — RP-6; composites and cross-asset comparisons — D14; staking risk dimensions — D26). Dropped from the old list: the staking API legacy-field note (nothing left to describe after D26) and the P5 cross-class paragraph (answered by D14: no comparisons). → DRAFTED; the owner pastes it into the Google Doc | T-359 stays open until the text is in the guide. New item T-415 files the stale risk wording found while scoping |

## Notes the rulings did not settle, and how they were resolved

**What D28 does not do.** It decides the structure; it does not form anything. D13
(2026-09-14) parked formation with the rollout, and that still holds: the Articles of
Organization, EIN, assumed-name certificate, NC-BR registration and bank accounts are
timed to the rollout date (Block 3 of the starting-point plan), with January 2027 as the
target. The step-by-step filing list lives outside the repo, in the owner's
*FN & NC — Accounting, Tax & Filing Manual (v2)* (28 Sep 2026).

**Why D29 is a record and not a decision to charge.** D21 defers every paid-service and
pricing decision, and D22 keeps the product personal until the first outside page load.
D29 only writes down which model the business documents are built on, so the accounting
manual, the sales-tax analysis (desktop download taxable in NC; hosted subscriptions
generally not) and the regulatory memo are all describing the same plan. The owner has
said it will be reassessed; when it is, that reassessment gets its own dated ruling.

**What was left out of this record on purpose.** The owner's own professional licensing
position was discussed and set aside for now. It is a personal matter and this repository
is public, so it is recorded only in the owner's private project notes.

**D31's honesty correction.** The policy draft said "Nothing here is new behaviour. The
conventions below already ship." That is true of `<SourceLine>` (44 files),
`<ProvenanceNotice>` (5) and `<DataGapNote>` (1), and of the CoinGecko 10px attribution
test. It is **not** true of `<DerivedNote>`: the component exists but no page renders
it. The regulatory posture memo (T-289, 28 Sep) found the same thing independently. The
policy now says so in §2 and §7 rather than implying coverage that does not exist.
Rendering it where computed figures sit beside sourced ones is build work that this ruling
does not queue; the owner chose to keep §7 as convention for now.

**D33 and the Drive connector.** The connector can read the Google Doc but cannot edit
its body, so the section was drafted as paste-ready text and handed to the owner. T-359
closes when the text is in the guide and a Change Log row is added there.

## New item filed

(T-412 to T-414 are already used on unmerged branches, so the next free id is T-415.)


- **T-415 — Remove stale risk wording left after D14/D26.** Found while scoping D33, by
  reading the code rather than the docs:
  - `src/app/api/v1/route.ts:29` — the API index still advertises "six curated risk
    dimensions (1–10, higher = riskier)" for staking, which D26 removed.
  - `src/lib/agents/prompts.ts:201` — tells the agent staking-provider risk profiles exist.
  - `src/lib/data/stakingProviders.ts:216-222` and `CLAUDE.md:596-599` — say
    `scoreStakingProvider` is retained; `stakingProviders.ts:1073` mentions `assetRisks`.
  - `src/app/layout.tsx:23` — site metadata still advertises "risk scores".
  - `src/lib/agents/prompts.ts:496-535` — the equity due-diligence agent's output still has
    a field named `riskScore` (0–10, higher = more concerning); the Pump Report's
    equivalent was renamed `suspicionScore`.
  - `src/app/(dashboard)/assets/[id]/page.tsx:411-415, 484-493, 1016-1018` — comments
    still say the removed composite panel renders.
  - `docs/decisions/2026-09-14-owner-decisions.md:93` (D18) says the options scorer is
    `lib/risk`'s last live consumer; the commodity, currency and rate profiles still feed
    Portfolios' tiers through `src/lib/data/instruments.ts:143-177`.
  - `docs/architecture/risk-scale-spec.md:79` says there is no other scale on user-facing
    surfaces; the Pump Report's `signalScore`/`collapseRisk` (0–10) and the Portfolios
    1–10 tiers are other scales.
