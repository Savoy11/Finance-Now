# Owner decisions — 2026-09-25

## D26 — Remove the six per-provider staking risk dimensions (answers T-409)

**Owner, 2026-09-24, on being shown editorial round 1 of T-394:** *"we should consider removing
this risk assessment as it may sound like a recommendation."* **Owner, 2026-09-25**, asked
directly to remove or keep: **"Remove them."**

### What is decided

The six editorial 1–10 scores per staking provider — custody, counterparty, contract,
slashing, liquidity, regulatory — are removed from **every surface that exposes them**: the
catalog (`risks` and per-asset `assetRisks`), `/api/v1/staking/opportunities` and its OpenAPI
text, the MCP tool `get_staking_opportunities`, the in-app agent tool of the same name, and the
derived per-pool `risks` in `/live-data/staking-discovery`. `scoreStakingProvider()` goes with
them — it had no live consumer since D14.

### Why, and how this relates to D14

D14 (2026-09-14) removed every *composite* of the six and kept the six themselves as
*"reference INPUTS, not a ranking"*. D26 reverses that half: the inputs are gone too. The
reasoning is RP-6's (2026-08-29), which removed per-coin risk scores because *"a risk figure on
an asset the reader is viewing may be seen as a recommendation, a regulated activity"* — now
applied to editorial figures on a provider.

**The finding that sharpened it.** Measured on 2026-09-24 before the decision: the `/staking`
page had **never rendered** the six dimensions — no read of `provider.risks` anywhere in the
UI. A person met these numbers only through the public API, the MCP tool and the agent tool,
i.e. through an AI agent narrating *"custody risk 2 out of 10"*. That is the surface where a
reference number most easily becomes advice, and it is not one a disclaimer on a web page
reaches.

### What D26 does not remove

- `custodyModel` (custodial / non-custodial / smart-contract) — a fact about a provider, not
  a score.
- The `lib/risk/` framework and its other consumers (options Trade Risk Scorer, macro/equity
  profiles) — each decided separately, unchanged.
- The defunct-provider record (Celsius) — a historical fact, not a rating.

### Consequences

- **T-394 shrinks** to its factual fields: TVL, APR, lock-ups, minimums, audit counts,
  founded, websites. The 330-judgment editorial pass no longer exists.
- **API and MCP contracts change** the D14 way: the field simply stops appearing. Nothing is
  rejected.
- A guard test pins the removal, on the pattern of `riskScoringRemoved.test.ts`.
- `rejected-proposals.md` records it as RP-6 extended; CLAUDE.md's D14 paragraph is
  annotated, not rewritten.
