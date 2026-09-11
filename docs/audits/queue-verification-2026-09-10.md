# Queue verification — 2026-09-10

**Proposal, not an applied change.** Status docs move by propose → owner approves → apply
(checklist-steward charter), so this records evidence and asks for a ruling. Nothing in
`docs/TASK-QUEUE.md` was edited.

## Why this pass happened

Asked to work through every item needing no owner input, I started fixing the "bug"
category and found the first five already fixed. That is a signal about the list, not about
those five — so the remaining effort went into **verifying** rather than fixing.

The imported queue is dated **2026-09-07** at `main_sha 2128a18`. `main` is now `8aeecbb`,
nine merged PRs later. It already carries a `closed_but_still_listed_as_open_in_docs`
count of 60; this proposes 15 more.

## Proposed CLOSED — bugs (9 of 11 in the category)

| Item | Claim | Evidence found |
|---|---|---|
| T-022 | equities TA page says "daily/weekly stock candles" | no occurrence of "weekly" anywhere in that page |
| T-072 | setState-in-effect warning in `FundsClient.tsx` | `npx eslint` on the file exits 0 with no output |
| T-138 | fabricated `updatedAt` on the cbdc fallback | `CBDC_FALLBACK_COMPILED` is imported and returned in **both** fallback branches (lines 410, 429). The `new Date()` at 419 is the LIVE branch, which is correct |
| T-259 | XRP wallet route has no timeout budget | `signal: AbortSignal.timeout(WALLET_FETCH_TIMEOUT_MS)` present |
| T-262 | dead `computeSegmentOptions()` in `transferFees.ts` | absent from all source; only `docs/assessments/T8-transfer-fees-audit.md` still names it |
| T-267 | crypto TA badge hardcodes "Binance" | derives from `ohlcvSourceLabel(data?.source, data?.venue)`, which maps `binance-us` → "Binance.US" |
| T-273 | volume not adjusted across splits | `ohlcvAdjust.ts`: `volume = Number.isFinite(c.volume) ? c.volume / f : c.volume` |
| T-333 | doubled `/api/v1/api` in the legacy rewrite | `local-setup.md:134` now says "the **origin only** — no `/api` or `/api/v1` suffix"; the dead WS/USE_MOCK lines are recorded as removed |
| T-388 | setState-in-effect warning on crypto TA page | `npx eslint` exits 0 with no output |

## Proposed CLOSED — docs (6)

| Item | Claim | Evidence found |
|---|---|---|
| T-167 | DATA-AVAILABILITY says "only BTC live" | now reads **"5 of 18 live"** |
| T-168 | "Exchange connections Live" rows still present | replaced with "Removed 2026-08-18 (RP-5)" in 2 places |
| T-169 | "Risk scores Derived" row still present | replaced with "Removed 2026-08-29 (RP-6)" in 2 places |
| T-163 | audit harness has no macro quote check | the check exists: `macro quotes (gold / EURUSD / 10y future)` |
| T-164 | CoinGecko rate-limit artifact unresolved in the harness | pacing wired at 5 sites; the 2026-09-10 run took `coin-discovery` and `alerts` from FAIL to REAL |
| T-004 | raise staking coverage above 4 of 51 | **27 of 51 live**, recorded in DATA-AVAILABILITY |

⚠ T-004 is proposed closed on COVERAGE, not on ambition. The remaining 24 keys have no
upstream publishing a rate — they are sourceless rather than unfetched — so "raise coverage"
has no further move without new sources. See the `gaps` map in `staking-rates/route.ts`.

## Not verified, and why

- **T-062** appeared in the category count but not in the items I sampled; it needs its own
  check rather than an assumption.
- The other **65 open remote-dev/either items** were not individually verified. Given 15 of
  15 sampled were already closed, **the base rate suggests many more are** — but a base rate
  is not evidence about any particular item, and proposing a closure without checking it is
  exactly what put this list out of date.

## What genuinely still needs the owner

The four items previously described as "green, no input needed" all name the owner in their
own `next_action`, and that description was wrong:

| Item | Its own words |
|---|---|
| T-056 | "**Owner opens** Bitfinex's and Bitget's own withdrawal-fee pages… never hand-edit to 0 from the API reading alone" |
| T-036 | fill maker/taker "from each exchange's spot fee schedule page" — 30 exchange sites, several being the unreviewed hosts of T-252 |
| T-394 | 55 providers × **6 risk dimensions** — subjective assessment, not lookup |
| T-130 | run 11 agents "from /research and the Assistant" and **fine-tune** them — UI, API spend, judgement |

## Suggested ruling

1. Approve the 15 above as closed, or ask for any one to be re-evidenced.
2. Decide whether a full verification sweep of the remaining 65 is worth a session. On the
   sampled base rate it would likely close a large fraction — and it is the only way to know
   which of the 81 "open" items are real.
