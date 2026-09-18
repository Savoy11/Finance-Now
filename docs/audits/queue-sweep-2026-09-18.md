# Queue sweep — 2026-09-18

A verification pass over the items `docs/decisions/2026-09-14-owner-decisions.md`
lists as remaining. Prompted by the hit rate on the ones worked today: of six
touched, **four were already done and still listed open**.

Everything below was checked against the current repo or the running app on the
owner's machine, not against what another document says. Where a check is
limited, the limit is stated rather than rounded away.

## Closed on evidence

| Item | Evidence |
|---|---|
| **T-003** — root-cause staking 4/51 live coverage | Coverage is **27/51**, all 7 upstreams healthy. The 4/51 reading predates the 2026-09-09 fix, and the per-upstream diagnostic the item asked for already ships in the response body. |
| **T-073** — verify AGTHX's sales load, wire `maxPct` | `fundCatalog.ts:547` carries `salesCharge: { kind: 'front', maxPct: 5.75, source: "SEC Risk/Return Summary 2025q4 … 485BPOS filed 2025-10-31 (CIK 44201)", verifiedAt: '2026-09-10' }`. Verified with provenance, not asserted. |
| **T-089** — Treasury yields render live on /macro/rates | `/live-data/treasury-yield-curve` → REAL: 13 maturities, 2s10s = 0.27, 3m10y = 0.82, shape normal. |
| **T-159** — delete pre-2026-08-18 `.exchange-credentials.json` (RP-5) | None anywhere under the home tree or the repo. **Limit:** the item also names deployment hosts, which this machine cannot reach. |
| **T-272** — confirm FMP `historical-price-eod/full` carries adjClose | It does **not**: `symbol, date, open, high, low, close, volume, change, changePercent, vwap`. Probed with the configured key. Recorded in `2026-09-18-owner-decisions.md`. |
| **T-305** — live spot-check that USDP and SNX price | Both live: `{"havven":0.219961,"paxos-standard":0.996965,"missing":[]}`. |
| **T-385** — settle USO's expense ratio | `fundCatalog.ts:490` → `expenseRatioPct: 0.86`. |
| **T-397** — refresh stale staking FALLBACK values | Done today; 19 of 27 rewritten, three by ≥25%. |
| **T-398** — dead/moved staking endpoint sweep | Already swept: three Cosmostation LCDs and `js.adapools.org` annotated `no-upstream` with the DNS finding, `api.binance.org`'s staking path retired (404), both Subscan endpoints `needs-api-key` (403). The 7 URLs the route fetches are the 7 that answered. |

## Open, and correctly so

| Item | Why it is not stale |
|---|---|
| **T-036** — verify seeded maker/taker rates | The 2026-09-13 review names this the *owner-gated set*: it means reading 30 exchange fee-schedule pages by hand. |
| **T-056** — the two held-back zero-fee rows | Same set, and explicitly *"owner opens Bitfinex's and Bitget's own withdrawal-fee pages … never hand-edit to 0 from the API reading alone"*. A zero renders as "Free". |
| **T-394** — re-verify the staking provider catalog | Same set: 55 providers × 6 risk dimensions is subjective assessment, not lookup. |
| **T-129 / T-130** — agent evaluation and tuning | Harness built (`npm run agent-eval`). The run is deferred by owner instruction, 2026-09-18. |
| **T-393** — close the 2024 cycle row | `cycleHistory.ts` still reads `troughLabel: 'Jun 2026 · ~$59,000 (so far)'`. The trough is not final, which is the item's own condition. |

## Needs a decision, not work

**T-386 — the re-verification happened; the date did not move.** #174 read the 37
non-'40-Act expense ratios from their prospectuses, but
`FUND_DATA_LAST_VERIFIED` is still `'2026-07-20'`. The item's wording —
*"before moving FUND_DATA_LAST_VERIFIED"* — means the blocker is cleared and the
bump is now a judgement call about whether the *unchecked catalog fields* were
also covered. Not moved here: a freshness date is a claim, and this one would be
claiming more than #174 verified.

**T-006 — partially done.** The owner-machine `npm run audit` ran twice today
(0 FAILs, 66 REAL on the clean run) and its JSON is committed at
`docs/audits/live-data-audit-2026-09-18.json`. Regenerating `DATA-AVAILABILITY.md`
from it is a separate step and has **not** been done.

## Method, and its limit

Two of the checks above were wrong on the first attempt, both in the same
direction — a probe I wrote badly, read as a defect in the app:

- `/live-data/portfolio-prices?ids=synthetix-network-token` returned
  `missing: ["synthetix-network-token"]`, which looked like T-305 failing. The
  route takes CoinGecko ids and `COINGECKO_IDS` already maps `snx: 'havven'`
  with a comment naming the legacy project. My id was wrong, not the map.
- `/live-data/treasury-yields` returned an HTML 404 page, which looked like
  T-089 failing. The route is `/live-data/treasury-yield-curve`.

Recorded because it sets the confidence on this sweep: a "still broken" verdict
from a single probe is worth about as much as the probe, and both of mine failed
first. Every closure above rests on a source read or a second probe.
