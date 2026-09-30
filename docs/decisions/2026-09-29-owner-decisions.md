# Owner decisions — 2026-09-29

Recorded from the owner's answer in the session that worked T-415 (stale risk wording
left after D14/D26). Same form as `2026-09-28-owner-decisions.md`: one row per ruling,
what it cascades to, and what was actually done.

| # | Decision | Ruling | Cascades to |
|---|---|---|---|
| D34 | The equity due-diligence agent's `riskScore` (T-415) | **Remove it entirely.** Owner, asked whether to rename the field the way the Pump Report's became `suspicionScore`: *"Remove it entirely; the backend of the risk assessment is most likely not correct."* The report keeps its findings, sources, severities, red flags and mitigating factors; it carries **no numeric score under any name**. → APPLIED | T-415's one open question is answered, so T-415 closes. The field is gone from the `equity-diligence` report schema in `frontend/src/lib/agents/prompts.ts`; `lib/agents/__tests__/diligenceReport.test.ts` guards it |

## Notes

**Why removal was a small change.** Nothing in the app parsed the field: the Research
page renders the agent's report as text, and no route, store or test read `riskScore`
from it. So the change is to what the agent is asked to print, and no consumer breaks.
The ledger had held the rename back only because it changes an agent's output shape,
which is the owner's call — that call is now made, and made more strongly than the
question asked.

**What the guard covers.** The test fails if the report schema asks for `riskScore`,
and also if it asks for a score under any other name (`concernScore`, `redFlagScore`),
since that would be the same unreviewed estimate with a new label. It drives itself red
with a re-added field to prove it can fail.

**What D34 does not decide.** The ruling's reason — that the risk assessment behind the
number is most likely not correct — was given about this agent's score. It is not
recorded here as a ruling on anything else, and nothing else was changed on the strength
of it. Three things sit close enough that the owner may want to rule on them separately:

- the same report's `overallRisk` verdict word (`clean | watch | elevated | critical`),
  which the agent also chooses by itself;
- the Pump Report's `suspicionScore` (AI-chosen, 0–10) and its heuristic `signalScore`
  with the `collapseRisk` band (computed from price and volume thresholds);
- the scoring engine in `lib/risk/`, which still derives Portfolios' 1–10 macro tiers
  and computes the options Trade Risk Scorer.

None of these is queued as work. Each would need its own ruling.
