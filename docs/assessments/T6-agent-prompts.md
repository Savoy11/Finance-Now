# T6 — Agent prompt evaluation

**Date:** 2026-09-08 · **Against:** `main` @ `792e55a` · **Scope:** `frontend/src/lib/agents/prompts.ts` (11 agents), read against the shipping app
**Environment:** cloud session. **No agent was RUN for this pass** — see "What this pass could not do".

---

## Why this document exists

T6 is listed as complete in the TASK-QUEUE's Phase 2 preamble ("Waves 0–4 all done"),
and the checklist-steward's 2026-07-28 annotation contradicts that: no
`docs/assessments/T6-*.md` exists, no commit is tagged T6, and the L11 finding in
`app-audit-2026-07-27.md` says the same. The prompt work that did happen — X1, the
2026-08-16 refresh — landed inside feature commits rather than as a recorded pass.

A task marked done with no record of what was checked cannot be relied on, and the
cost of that showed up immediately: **by 2026-09-08 the app-assistant's platform
context described three surfaces that no longer exist and one that was never
possible.** This is the record, and the drift is fixed in the same commit.

---

## What was wrong (and is now fixed)

The app-assistant's PLATFORM CONTEXT block is the map it uses to route a user to
the right page. Six of its statements were false against `main`:

| Line said | Reality | Consequence if unfixed |
|---|---|---|
| Coins has a "safety-score column" | Removed 2026-08-18 (item 4), and **no per-coin score is published anywhere** (RP-6, 2026-08-29) | The assistant would describe a column the user cannot find, and — worse — invite a request for a risk figure the app deliberately withholds |
| Coin detail has a "risk panel" | Removed under the same decision | Same |
| Transfer Fees is a working calculator | Hidden from the initial rollout 2026-08-22; `/transfer-fees` redirects | The assistant would send a user to a page that bounces them to Headlines, with no explanation |
| Wallets offers "read-only exchange APIs" | Exchange API linking was **removed entirely** on 2026-08-18 (RP-5) on security grounds, and the Wallets page is hidden | **The most serious of the six.** An assistant telling a user they can hand over an exchange API key, in an app that deliberately refuses to hold one, invites the exact behaviour RP-5 exists to prevent |
| TA has a "scanner and backtest tab" | The scanner is its own page (items 6/7); the backtest tab is hidden (2026-08-20) | Wrong navigation, twice |
| Fund catalog is "118 funds" | 126 | Minor, but the block claims "every count below is real, not approximate" |

Also corrected: the four macro yield indices now read the treasury.gov par curve
and publish **daily** (D3, 2026-09-03), so the assistant is told not to quote them
as a live tick; the Pump Report has its own page; and the role instruction
"explain … risk scores in plain language" is rewritten so an explanation cannot
slide into a recommendation.

### A second, quieter defect: two copies of one schema

`prompts.ts` carries the configurable default for `pump-report-investigator`, and
the investigate route carries its own `buildSystem()`. The route resolves
`agentCfg?.systemPrompt ?? buildSystem(...)` — so the `prompts.ts` copy is what
the agent-config UI displays, and it becomes the saved override the moment anyone
edits and saves it.

When the report field was renamed `riskScore` → `suspicionScore` (Phase 6), the
route was updated and this copy was not. A user who opened `/agent-config`, glanced
at the prompt and pressed save would have pinned the old key — after which the
reader finds nothing, the score reads 0, and the UI paints **a clean bar on an
unscored fraud report**. No error anywhere. Both copies are now aligned and a test
asserts they agree.

`equity-diligence` carries a similar 0–10 `riskScore` in its output schema. Nothing
parses it (the Research page renders the report as text), so it is left named as it
is — but the prompt now states its direction and that it is **not** the canonical
0–100 higher-is-safer Safety Score, so neither a reader nor a model can conflate
the two.

---

## What was checked, and how

Read-only, against source:

1. Every `systemPrompt` in `AGENT_DEFAULTS` (11 agents) compared statement-by-statement
   against `lib/modules/registry.ts`, the `next.config.mjs` redirect list, and the
   catalogs each prompt quotes a count from.
2. Every JSON output schema embedded in a prompt compared against the code that
   parses it.
3. Tool lists in prompts compared against `toolsForAgent()` in `tools.ts`.
4. The `researchAgents.test.ts` picker ↔ route ↔ catalog symmetry guard re-read: it
   holds, and it is what stops NT5's fix from regressing.

---

## What this pass could not do

**It did not run a single agent, and no conclusion here is about output quality.**

Agent tools read the same `/live-data/*` routes the UI does, so judging an answer
requires knowing whether those routes served REAL or FALLBACK data at the time —
and that is IP-dependent. Binance is geo-blocked from this host (451), Reddit and
LunarCrush block datacenter IPs, and the keyed equity providers are unconfigured
here. An agent giving a vague answer off a degraded feed is a data problem
misreported as a prompt problem, which is the specific mistake the audit rules warn
against.

**Precondition for the output half of T6:** `cd frontend && npm run audit` on the
owner's machine with provider keys set, then run each agent with its REAL/FALLBACK
classification in hand. Until that happens, T6 is **half done**: the prompts are
verified accurate against the app; their answers are unevaluated.

**T7 remains unrecorded entirely** — it is not covered by this pass.

---

## The guard, built

The drift took three weeks to appear and nobody was looking, so the fix is not "be
more careful next time". `lib/agents/__tests__/promptRoutes.test.ts` reads
`next.config.mjs`'s `redirects()` list and asserts that **no agent prompt names a
redirected route without saying it is withdrawn** — checked on the line the route
appears on, since a "HIDDEN" forty lines away does not qualify a mention here.

It reads the redirect list rather than a fixture, because every hide adds an entry
there: a future hide is caught without anyone remembering to extend anything. It
also asserts the app-assistant never offers exchange API-key linking, which is the
same class of drift and the one with a real cost.

**The guard was verified by breaking it**, not merely by watching it pass: restoring
the old "Transfer Fees: cheapest-route calculator at /transfer-fees…" line makes it
fail with the route named. The first attempt at that check was itself faulty — it
left withdrawn wording on the same line, so the test passed and looked like a
working guard over a regression it had not actually caught. A guard nobody has seen
fail is an assumption.

**One pre-existing guard already worked**, and is worth naming: `boundaryDrift.test.ts`
asserts that counts stated in the assistant's prompt match the catalogs. Removing the
Transfer Fees line dropped the exchange/coin/network counts and the test failed
immediately. Those counts are kept on the hidden-surface line — the data is real and
maintained, which is precisely why the page is hidden rather than deleted.
