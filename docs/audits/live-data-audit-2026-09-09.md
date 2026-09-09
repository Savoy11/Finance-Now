# Live-data audit — 2026-09-09 (owner's machine)

**Run:** `npm run audit` (full), owner's machine, 2026-09-09.
**Result:** 63 REAL · 9 FALLBACK · 1 UNCONFIGURED · 1 EMPTY · 2 FAIL.

This is the first audit record taken on an IP that can actually reach these
hosts. Every prior availability figure in the repo was measured from a cloud
session, where publisher and provider hosts are blocked at the gateway — so
this run supersedes them, and only this kind of run may be cited for a
"which sources work" claim. See CLAUDE.md, *Testing the Live Data Layer*.

---

## What this run settled

### 1. `staking-rates` served 4 live APRs, not the ~17 the route wires

The route fires 17 upstreams and reports `4/51 live`. The 51 is not the
interesting number — most of those keys are static fallbacks that are
estimates **by design**, so `4/51` cannot distinguish a healthy route from a
broken one. The interesting number was invisible: **13 of 17 live rungs
produced nothing**, and the response had no way to say which.

The run's own timing was the tell — 6479ms against a 6s per-fetch timeout,
so at least one leg aborted rather than answered.

**Fixed, not merely recorded.** `/live-data/staking-rates` now returns an
`upstreams` map giving each upstream's outcome, distinguishing the four
failures that have four different fixes:

| Outcome | Means |
|---|---|
| `live (n/n)` / `partial (n/m live)` | answered, rates landed |
| `http <status>` | reachable, refused — endpoint moved or now needs auth |
| `timeout after 6s` | reachable but slow from this IP |
| `unreachable: …` | DNS/socket failure — host gone or blocked |
| `reachable but no usable rate (0/n)` | **HTTP 200 whose body no longer parses** — the failure that was indistinguishable from a healthy estimate |

`keys` counts only the keys an upstream is meant to make live, never the ones
derived from it by an offset (ankr/coinbase/kraken/binance off Lido,
`native_sol`, `native_matic` — always estimates by design). So
"reachable but no usable rate" means a genuine parse failure, not an upstream
declining to fabricate neighbours.

The audit probe prints the failing upstreams by name. **The next run on the
owner's machine diagnoses this without further code changes** — which is the
point; the previous number was unactionable from anywhere.

Also removed: a dead `api.avax.network/ext/info` fetch. Its result was
destructured and never read (the leg's own comment says the endpoint returns
a node version, never an APY), so it cost a round trip and a slot in the
shared parallel budget on every request.

### 2. The `social` row was blaming the wrong cause

The row read `0 signals — Reddit RSS likely rate-limited (429) from this IP`.
It is **not** rate-limited. Reddit is deliberately gated off in
`pinnedFetch`: its robots.txt disallows this app's agent (2026-08-29 terms
review), and the gate lifts only when `REDDIT_CLIENT_ID` is set.

The harness was guessing, because `/live-data/social` returned `[]` for a
gated provider with no reason attached — indistinguishable from a provider
that fetched and found nothing. So the one row whose whole purpose is an
IP-truthful reading told the owner to go looking for a network fault that
does not exist and cannot clear on a re-run.

**Fixed.** The route now reports a `withheld: [{ id, name, reason }]` array,
mirroring the shape `/live-data/stock-social` already used, and the probe
prints the stated reason instead of inferring one. Verified end-to-end: the
route reports the robots gate by name.

### 3. Binance.com is permanently unreachable for this owner, not an artifact

Three `ohlcv` rows fall back to Binance.US. Earlier notes framed the
Binance.com 451 as a cloud-IP artifact ("geo-blocked *here*"), implying the
owner's machine would see the real venue. It does not: Binance.com blocks US
users, so for this owner the fallback is the **steady state**, and the
venue/price difference the row flags is permanent. The route labels it
correctly; only the framing of the cause was wrong.

---

## Not defects

- **`coin-discovery` 503 and `portfolio-history` FAIL** — both CoinGecko HTTP
  429. The harness itself labels the second "transient: re-run". Two
  rate-limit hits in one run against the same provider point at the audit's
  own request volume, not at the routes.
- **`security-returns` `source=none`, `stock-universe` curated (79 of
  ~thousands), `stock-outliers` 66 evaluated, `video-search` unconfigured** —
  all key-gated and honestly reported. The fix is a key, not code.
- **`fund-holdings` SPY from catalog** — SPY is a UIT and files no N-PORT.
  Expected, and the row says so.
- **`cbdc-data` static, `chart` synthetic** — both marked in the response.

## Still open

- **Which staking upstreams are actually dead** — the mechanism now reports
  it, but the verdict needs one more owner-machine run. Cloud runs answer
  `http 403` for every host (the agent proxy), which is exactly the
  systematically-wrong baseline this file exists to avoid.
- The FMP personal-vs-commercial terms question (7 live-data routes,
  20 files) remains the owner's to answer — unchanged by this run.

---

## Second owner-machine run, same day — the diagnostic paid off, and it says "not the sources"

The `upstreams` map from the first fix reported **4/17 healthy**, and the shape of
the failure is the finding:

| # | Upstream | Outcome |
|---|---|---|
| 1–4 | lido-eth, rocketpool-eth, marinade-sol, jito-sol | **answered** |
| 5 | stride-cosmos-lsts | **answered**, but the parse found no rate (0 of 3) |
| 6–17 | cosmoshub, osmosis, polkadot, kusama, cardano, bnb, lido-matic, tron, injective, celestia, near, **defillama-yields** | **all "timeout after 6s"** |

**Positions 1–5 answered; positions 6–17 timed out, in array order.** Twelve
unrelated hosts across three continents do not fail in the order a JavaScript
array happens to list them. Position decided the outcome, so this is **client-side
contention** — the route fires all 17 at once and gives them a *shared* 6-second
wall clock, so a request that spends 5.9s queued gets 0.1s to complete. The
route's total time was 6695ms, i.e. it returned the moment the budget expired.

So the earlier reading — "13 of 17 live rungs produced nothing" — was right about
the count and **wrong about the cause**. Almost none of those twelve is a dead
endpoint. `defillama-yields` alone backs ~24 of the route's live keys, and it is
in the timed-out block.

### The probe had the same flaw

`scripts/probe-staking-upstreams.mjs` fanned out with `Promise.all` over all 17 —
the same pattern as the route. It would have reproduced these false timeouts and
reported twelve healthy hosts as gone: the exact misattribution the probe was
written to prevent, one layer up.

**Corrected: the probe is sequential by default**, one host at a time with a
generous 20s ceiling, so a timeout means that host really is slow. `--parallel`
reproduces the route's behaviour deliberately, and the *difference between the two
runs is the measurement of contention*. A new `over-budget` verdict marks a host
that serves a usable rate but takes longer than the route's 6s — nothing to
reparse or replace there; the budget is what would have to move. Parallel mode
also detects the array-order signature explicitly and prints that position, not
host health, decided the result.

### Two things this run does NOT settle

- **The route's fix.** Raising the budget, bounding concurrency, or both — the
  number should come from the sequential run's real per-host latencies, not from a
  guess. One `npm run staking-upstreams` supplies them.
- **`stride-cosmos-lsts`.** A genuine parse failure (HTTP 200, no rate found), and
  the only one of the thirteen that is. Fixing it needs the body excerpt the
  sequential probe prints; the audit's summary line does not carry it.

### The rest of this run reads as locally degraded, not as source outages

Also newly red: `news` (no articles, was 10 from 4 providers), `staking-discovery`
(no pools, was 97), `alerts`, `coin-discovery` and `portfolio-history` (all
CoinGecko HTTP 429). `news` and `staking-discovery` are keyless multi-source routes
that fan out exactly like `staking-rates`, and three 429s in one run point at the
audit's own request volume. Treat these as suspected collateral of the same
bottleneck and re-check them on a quiet run before opening anything upstream —
`risk-scores` taking 12.4s for a route that only proves a removal is the same
smell.

---

## Sequential probe, same day — the cascade had a cause, and it was four dead hosts

`npm run staking-upstreams` on the owner's machine, one host at a time. This is
the run the previous two sections were waiting for, and it settles both open
questions at once.

**Six answered, all comfortably inside the route's 6s budget:**

| Upstream | Time | Reading |
|---|---|---|
| lido-eth | 630ms | 2.18% |
| rocketpool-eth | 606ms | 2.16% |
| marinade-sol | 1224ms | 6% (`0.06` fraction, scaled by `normPct`) |
| jito-sol | 453ms | 4.86% |
| injective-native | 506ms | 4% (`0.04` fraction) |
| defillama-yields | 418ms | 17,217 pools |

**Not one upstream was slow.** The slowest healthy source answered in 1.2s
against a 6-second allowance. So the timeout cascade was never about latency.

### What actually caused "4 of 51 live"

Four hosts had no DNS record at all, and three of them took **~10 seconds each**
to fail:

```
cosmoshub-native   ~10.7s   api-cosmoshub-ia.cosmostation.io   fetch failed
osmosis-native     ~10.6s   api-osmosis.cosmostation.io        fetch failed
celestia-native    ~10.2s   api-celestia-ia.cosmostation.io    fetch failed
cardano-native      0.25s   js.adapools.org                    fast NXDOMAIN
```

Node resolves DNS on the libuv threadpool, which has **four threads by default**.
Four dead hosts, three of them hanging for ten seconds, occupy every thread for
longer than the route's entire 6-second budget — so the upstreams queued behind
them aborted **without a socket ever opening**. That is precisely the array-order
signature: positions 1–5 answered, 6–17 "timed out".

The dead hosts were not merely *among* the failures. They **were** the failure
mechanism for the other twelve. Removing them is the fix for the cascade.

### The nine rungs removed, each on its own evidence

| Rung | Evidence | Verdict |
|---|---|---|
| cosmoshub, osmosis, celestia (Cosmostation LCDs) | DNS failure, three siblings together | Pattern gone, not one host |
| cardano (adapools) | Fast NXDOMAIN | Host gone |
| polkadot, kusama (Subscan) | HTTP 403 whose body says *"If you want to use a program to access the API, see support.subscan.io"* | **Now key-gated** — restoring means adding a keyed provider, a policy decision, so deliberately left out rather than left failing |
| bnb (api.binance.org) | HTTP 404 | BNB Beacon Chain retired |
| tron (tronscanapi) | HTTP 404, Jetty error page — host alive, path gone | No replacement path verified, so none guessed |
| lido-matic (polygon.lido.fi/api/stats) | HTTP 200 serving **Lido's marketing HTML**, not JSON | API withdrawn |

Every one of those coins keeps the static fallback it was already serving. None
of these fetches was producing a rate; they were producing latency.

### Stride: fixed — the shape moved, the endpoint never broke

`edge.stride.zone/api/stake-stats` answered HTTP 200 throughout. It now returns

```json
{ "stats": [ { "chainId": "cosmoshub-4", "denom": "ATOM",
               "currentYield": 0.1485, "strideYield": 0.1429, … }, … ] }
```

— an **array keyed by `denom`**, where the route read a `{ atom: { apr } }` map.
Parsing now looks up by denom and takes `strideYield` (what a stATOM/stINJ/stTIA
holder earns after Stride's fee) with `currentYield` as a fallback. This is the
failure class that hides: a stale parse path and a healthy static estimate are
indistinguishable from outside the route.

### Still open

- **near-native** — HTTP 200, healthy, 857ms, but the route's parse path finds
  nothing and the probe's 300-character excerpt cut off before any yield field.
  **The excerpt limit was the bug**, in the one verdict where the body is the
  deliverable; it is now 1500 characters for the field-moved family. The rung is
  kept and one more run should settle it.
  **Settled by the fourth run — see the last section: the rung is removed, not
  reparsed.** The endpoint carries no yield field at all.
- **Subscan (polkadot/kusama)** — an API key would restore two rates. Owner's call.

### Two flaws this run exposed in the probe itself

1. It printed raw fields, not what the route serves: marinade as `0.06` and
   injective as `0.04` where the app shows 6% and 4%. A diagnostic that disagrees
   with the thing it diagnoses is worse than none. It now applies `normPct`.
2. The 300-character excerpt truncated exactly the case it exists to serve
   (see near-native above).

### Net effect

The route now fetches **8 upstreams instead of 17**, all confirmed reachable and
sub-1.3s, with no dead host able to starve the resolver pool. Expect the next
`npm run audit` to show materially more than 4 live keys — DeFiLlama alone backs
~24 of them and was in the strangled block.

---

## Third owner-machine run — the fix landed: 4 live → 27 live

`npm run audit` after #160 merged.

| | Before | After |
|---|---|---|
| Live staking APRs | **4 / 51** | **27 / 51** |
| Healthy upstreams | 4 / 17 | **6 / 8** |
| Route duration | 6695ms (= the 6s budget, expired) | **1846ms** |

The route now returns in under two seconds instead of running out its budget, and
serves nearly seven times as many live rates. That confirms the diagnosis: the
cascade was four dead hosts holding Node's DNS threads, not slow sources.

Two upstreams remain imperfect, both now precisely identified:

- **`near-native`** — still `reachable but no usable rate (0/1)`. Unchanged and
  expected: the parse path needs the response body, and the widened excerpt only
  reaches the output on the next `npm run staking-upstreams`. **That run happened
  — see the last section. The answer was not the one assumed here.**
- **`defillama-yields`** — `partial (19/25 live)`. **New information**: DeFiLlama
  is healthy and 19 of its 25 `LLAMA_MAP` symbols match a pool; six no longer do.
  A miss there is a one-line map fix, but only once you know which symbol — so the
  verdict now names them rather than only counting them, the same correction
  "4/51 live" needed.

### The harness was still throttling itself, and the earlier fix had it backwards

`coin-discovery`, `alerts` and `portfolio-history` failed on CoinGecko 429 in **all
three** runs today. The pacing added for exactly this (its comment names the same
three routes from a 2026-07-27 audit) did not work, because of the model it used:

> *"a short pause before each CoinGecko-backed check, but only when the previous
> request also hit CoinGecko — a gap after an unrelated route buys nothing"*

That is backwards. A rate limit is a **rate over a window**, not a rule about
adjacency. Slotting an unrelated route between two CoinGecko calls does not lower
the CoinGecko rate at all; it just cancels the pause. The run proves it:

- **`alerts`** is preceded by `risk-scores` (not CoinGecko), so it received **no
  pause whatsoever** — then 429'd.
- **`coin-discovery`** sits eighth in an unbroken run of CoinGecko checks and 429'd
  *through* the gaps, because ~8 calls in ~13s exceeds the keyless allowance
  however they are spaced.

Replaced with a **sliding window** (a per-minute cap plus a minimum spacing since
the last CoinGecko *call*, whatever ran in between), both tunable via
`AUDIT_CG_PER_MIN` / `AUDIT_CG_GAP_MS`. The cap is deliberately conservative
because one check can be several upstream calls — `coin-discovery` pages through
markets, `coin-list` pulls 750 coins — so counting checks understates the rate.

Verified against a fake clock over this run's actual check order: `alerts` now gets
its gap despite the non-CoinGecko check before it, and no window exceeds the cap.
The run reports what pacing cost it, so the delay is never mistaken for slowness
and quietly "optimised" back out — which is how the 429s returned last time.

### Also seen, not acted on

**BTC network fee fell back to the static estimate**, and the gap is large:
`network-fees` took 10.8s and reported `btcFeeSource=estimate`, with
`bitcoin feeUsd` at **$11.95** against **$0.20** on an earlier run today — the
static figure is roughly **60× the live fee**, being calibrated for a busy mempool
rather than the current cheap one. `btc-stats` did answer (height 966181) but took
10.5s, so mempool.space was slow, not gone.

The disclosure works — the route flags `estimate` and the audit lists it under
silent degradation — so nothing is being passed off as live.

**⚠ Correction (same day): calling this a defect was wrong.** `lib/data/networkFees.ts`
carries a ⚠ note above `NETWORK_GAS` stating that these constants are *deliberately*
high, with the reasoning spelled out: the estimate is served **only when the live read
failed**, and fee spikes are exactly when mempool.space struggles — so a fallback
sized for a quiet market would have users underfund withdrawals during congestion.
*"Erring high costs a user an over-estimate; erring low costs them a stuck
transaction."* The note even cites the identical pattern for ERC-20 at ~200×.

So the 60× gap is the documented safety margin working as intended, and lowering it is
the specific change that comment forbids. Two other claims made alongside it were also
wrong and were checked before being acted on: there is no missing blockchain.info
fallback (that `dataSources` row is `btc-stats`, which does use it), and the fallback
was not caused by a timeout (that fetch has none — it returned a non-OK response).

**What was genuinely missing** is that the assumption was invisible. `btcSatPerVbyte`
is reported only for observed readings, so a reader saw $11.95 with no way to tell it
was priced at ~60 sat/vByte rather than quoted. `computeNetworkFees()` now also returns
`btcSatPerVbyteAssumed` — always present, always an assumption, deliberately kept in a
separate field so it can never be mistaken for a measurement. `BTC_TYPICAL_VBYTES` is
named once so the constant and the live conversion cannot drift apart about which
transaction they describe, and the BTC figures are written into the do-not-lower note
so the next reader does not re-raise this as I did. A test pins the fallback above a
quiet-mempool rate, with the reasoning attached: if that ever needs relaxing it is a
decision to record, not a test to edit.

---

## Fourth owner-machine run — NEAR: the field never moved, because it was never there

`npm run staking-upstreams`, sequential, with the widened 1500-character excerpt
that the third run's correction added. **7 of 8 upstreams live.** The one exception
was `near-native`, and the excerpt finally showed why.

### What `api.nearblocks.io/v1/stats` actually returns

HTTP 200, ~850ms, well-formed JSON, and the complete payload is one object inside a
`stats` array carrying **seventeen** fields:

```
id, total_supply, circulating_supply, avg_block_time, gas_price, nodes_online,
near_price, near_btc_price, market_cap, volume, high_24h, high_all, low_24h,
low_all, change_24, total_txns, tps
```

Not one of them is a yield. It is a **network-and-price statistics** endpoint —
supply, block time, node count, market price, 24h range, transaction count, TPS.

That changes the cure completely. Every previous entry in this file assumed a
*stale parse path*: the endpoint is right, the field moved, correct the expression.
Here there is no expression to correct. Two things follow, and both are worth
recording because each was an assumption this run overturned:

1. **The old expression could never have worked, on any past version of the
   response.** It read `d?.stats?.staking_return`, but `stats` is an **array** —
   so `d.stats.staking_return` is `undefined` regardless of what the objects inside
   it contain. This rung has been serving `native_near`'s static fallback since it
   was written, while presenting as a live source that happened to be failing.
2. **The APY is not derivable from what is there either.** NEAR's staking return is
   a function of the *total staked*, and the response gives only total supply and
   circulating supply. Nothing in those seventeen fields reaches it, so there is no
   arithmetic that rescues the rung from the same endpoint.

### Decision: removed, on the same evidence standard as the nine

The rung is gone — binding, fetch, parse leg and diagnostic row — with the full
reasoning left in place as a comment at the removal site so the next reader does not
re-add it. `native_near` keeps its static estimate, **which is exactly what it was
already serving**; nothing regresses. The route now fetches **7 upstreams**.

Leaving it in was the worse option, and for the reason recorded against the other
nine: a dead rung reads as a live source having a bad day. It also cost a real
fetch on every request for a number it structurally cannot produce.

If a live NEAR rate is wanted later it needs a **different endpoint**, not a
different field — validators/staking-pool data, or a provider that publishes the
network APY directly. That is new work with its own terms review, not a repair.

### The probe's own wording was part of the delay

The `no-rate` verdict printed *"the FIELD moved, not the endpoint"*, and its group
header read *"FIELD MOVED — fix the parse path, keep the URL"*. Both assert one of
**two** possible causes as though it were established, and it sent the reader
hunting for a field that had never existed. A diagnostic must not decide the cure
it is being consulted about.

Reworded so the body — which the probe already prints — is what decides:

> **ANSWERED, BUT NO USABLE RATE — read the body.** The endpoint is healthy. Either
> the field moved (fix the parse path, keep the URL) or it carries no rate at all
> (replace or drop the rung). The body below decides which.

Same class of error as the two the probe already guards against: filing local egress
403s as "endpoint gone", and reporting queueing as host health. In each case the tool
stated a conclusion its evidence did not support.

### Still open, unchanged

- **Subscan (polkadot/kusama)** — restoring `native_dot` / `native_ksm` means adding
  a keyed provider. Owner's policy call, deliberately not taken here.
- **`defillama-yields` partial (19/25)** — six `LLAMA_MAP` symbols no longer match a
  pool. The verdict now names them, so it is a one-line map fix per symbol once
  someone checks what each renamed to.

---

## Fifth owner-machine run — the NEAR fix is not in it yet, and two items moved

`npm run audit`, run **before** #162 landed on the owner's machine, so
`near-native: reachable but no usable rate (0/1)` and `6/8 upstreams` are the
pre-merge state. After a pull that row is gone and the count reads 7. Nothing
below depends on it.

Headline: **61 REAL · 12 FALLBACK · 3 UNCONFIGURED · 1 FAIL** (was 63/9/1/2).

### What is confirmed working

- **The `social` withheld reason reaches the report verbatim** — *"Reddit withheld
  — Reddit's robots.txt disallows this app's agent. Configure REDDIT_CLIENT_ID
  (OAuth)."* That is the #156 change working end to end: the row used to guess
  "likely rate-limited (429) from this IP" and send the reader after a network
  fault that does not exist.
- **`alerts` and `portfolio-history` now pass.** Both 429'd in all three earlier
  runs. The sliding-window pacing fixed them.
- **DeFiLlama now names its misses** — `ankr_sol`, `stader_bnb`, `pstake_bnb`,
  `quicksilver_atom`, `pstake_atom`, `metapool_near`. Six of 25, and the whole
  point of naming them is that the list above is actionable where "19/25" was not.

### `coin-discovery` still 429s — the pacing fix was right and incomplete

The run spent **40.3s** pacing and `coin-discovery` still failed on
`page 1: HTTP 429`. Two of the three target routes were cured; this one was not,
and the reason is in the model, not the numbers.

The window counted **one slot per check**. `coin-list` issues **three** upstream
page requests inside a single check — `fetchCoinGeckoPages(3, …)`, 250ms apart —
so the harness believed it had spent 8 requests when it had issued 10. The
budget was not exceeded by `coin-discovery`; it was already gone when
`coin-discovery` asked, and `coin-discovery` took the 429 that belonged to its
neighbour. Verified against the routes rather than inferred: `coin-list`
hardcodes 3 pages, `coin-discovery` at the audit's default limit of 250 is
`ceil(250/250)` = 1.

**Fixed with a per-check weight**, and the pacing moved to
`scripts/lib/coingeckoPacing.mjs` so it is pure and testable with an injectable
clock. The previous fix was described as "verified against a fake clock over this
run's actual check order" — accurate, but the verification was ad hoc and left no
artifact, which is how the third model shipped looking as settled as the two
before it. Seven tests now pin it, including a replay of this run's exact check
order that **fails under the shipped model and passes under the weighted one** —
the discrimination checked deliberately, since a replay asserting only "peak ≤ cap"
passes under both and proves nothing.

⚠ **It costs run time, and the amount depends on the cap — and the first table
written here measured the wrong thing.** That table covered all fifteen
CoinGecko-backed routes and reported 10/min as costing only +3.6s. Re-measured
over the **eight checks that actually produced the 429**, the picture is not a
gradient at all:

| Cap | Unweighted | Weighted | Does it throttle the failing sequence? |
|---|---|---|---|
| 8/min | 12.6s | 62.0s | **yes** (+49.4s) |
| 9/min | 12.6s | 60.3s | **yes** (+47.7s) |
| **10/min (shipped)** | 12.6s | **12.6s** | **no — identical request pattern to the failing run** |

The sequence weighs exactly ten, so a cap of ten fits it precisely and no wait
ever fires. The choice is close to binary: throttle at ~60s, or don't.

**The owner set 10 on 2026-09-09**, for run speed, with that consequence stated.
Recorded plainly because the earlier framing — "+3.6s, slightly riskier" —
understated it, and a wrong number in an audit file is worse than no number: the
weighting is still what makes the budget *honest*, but at this cap it does not on
its own prevent a repeat. A test pins exactly that, so nobody later reads "we
fixed the pacing" and concludes `coin-discovery` is protected. **If it 429s again,
move the cap first — 8 is the value the evidence supports — not the weighting.**

⚠ **And the per-minute rate may not be the trigger at all.** Real CoinGecko calls
in that window were about **seven**, not ten: the three `ohlcv` checks were served
by Binance and spent no CoinGecko budget. Seven requests in a minute should not
trip a keyless limiter. What *is* unusual is the shape — `coin-list` issues its
three pages **250ms apart** (`coingeckoPages.ts`, `gapMs = 250`), and a burst that
tight is the likelier cause than the minute-long average.

That would be a fix in `lib/server/coingeckoPages.ts`, which serves real users and
not just the harness, so it is **not** being changed on this evidence. It wants one
owner-machine run to confirm: if `coin-discovery` 429s again at cap 10 while the
run is nowhere near ten calls a minute, burst is the answer and the audit's cap was
never the right lever.

### The six DeFiLlama misses now have a probe

Naming them was necessary and not sufficient: "STKBNB matched nothing" does not
distinguish a **renamed token** from a **delisted pool** from a **moved chain
label**, and those cures are mutually exclusive — the same gap the upstream probe
was built to close. `npm run llama-symbols` fetches the pool list once and prints,
per unmatched key, what DeFiLlama actually carries under three lenses: same project
staking that asset, same project any asset, similar symbol any project. Nothing
from the project at all means the rung is gone and should follow NEAR's out.

Reports only, never writes. Exits **2** when DeFiLlama is unreachable rather than
1 — confirmed here, where the sandbox 403s the host; reporting that as "the
symbols are wrong" would be this probe committing the misattribution it exists to
catch. **Needs one owner-machine run to resolve all six.**

### Not defects, re-confirmed this run

- **BTC fee on the static estimate** (`btcFeeSource=estimate`, `network-fees`
  10.9s, `btc-stats` 10.8s). mempool.space slow again. The constant is
  deliberately high and documented as such — see the correction in the third run's
  section. `btcSatPerVbyteAssumed` now publishes the assumption.
- **Binance.US on the three `ohlcv` rows** — a US geo-block, the steady state for
  this owner, not a degraded run.
- **Macro quotes, `security-returns`, `stock-universe`, `stock-outliers`** — all
  key-gated and honestly reported. The fix is a key, not code.
- **`fund-holdings` SPY from catalog** — SPY is a UIT and files no N-PORT.

### Still open

- **Subscan (polkadot/kusama)** — a keyed provider would restore `native_dot` /
  `native_ksm`. Owner's policy call, unchanged.
- **The six DeFiLlama symbols** — one `npm run llama-symbols` away.

---

## Sixth owner-machine run — the prediction held, and it exposed a third wrong model

`npm run audit` with #162 and #163 both merged. Two things confirmed, one of them
mine, and a defect underneath both.

### Confirmed working

- **`staking-rates` reports `6/7 upstreams healthy`.** The NEAR rung is gone and
  the diagnostic no longer carries a row for it. #162 landed as intended.
- **The pacing line now names the weight** — *"10/min cap, 1800ms min gap,
  coin-list weighted 3 calls"*. #163 landed as intended.
- **The six DeFiLlama misses are still named and still unresolved** — the probe
  has not been run yet.

### `coin-discovery` 429'd again, exactly as predicted

Written before this run: *"at cap 10 the weighting throttles nothing, so the
harness reissues the request pattern that 429'd."* It did, and it did. Pacing held
the run 38.7s against 40.3s before — barely moved, because at cap 10 nothing extra
was ever held back.

The stated next step was *"move the cap first — 8 is the value the evidence
supports."* **That was wrong, and this run shows why.**

### The real defect: the gap and the cap were independent knobs

Counting only real CoinGecko requests before the refusal — verified by reading the
routes, not assumed:

| Check | Real CoinGecko calls |
|---|---|
| `markets` | 1 |
| `ohlcv` ×3 | 0 (served by Binance.US) |
| `chart` | 1 (`market_chart`) |
| `coin-list` | 3 |
| `coin-search` | 1 |
| `coin-discovery` | 1 → **429** |

**Seven real requests, and they all landed inside 19.4 seconds — a peak of
22/min, under a cap the harness was reporting as 10/min.**

That is the whole problem, and it is not the cap. A cap of N per 60s only limits
the *rate* if something spreads the calls across the window. With a fixed 1.8s
floor, ten calls fit in eighteen seconds. The cap binds only once the calls are
already slow — precisely when it is not needed. Both previous rounds of tuning
moved a number that was never governing anything.

Note what this also says about the cap-8 plan: at 8 the harness *would* have
throttled, but only because `ohlcv` is charged 3 calls it does not spend. It
would have prevented the 429 **by accident**, through an over-count, while the
real rate stayed unmodelled.

**Fixed:** the floor is now `derivedMinGapMs(window, cap)` — `window / cap`, so
the cap is the rate it claims to be. The sliding window stays as the hard backstop
for bursts a single check makes internally (`coin-list` fires three pages 250ms
apart regardless of what the harness does). Cost across the CoinGecko-backed set:
**71.0s → 96.3s** of pacing, a gentler shape than the 48s cliff that cap 8 would
have produced.

A test pins the difference: the shipped 1.8s gap let the cap's worth of calls out
at **more than triple** the named rate; derived, the peak sits at the cap plus a
fencepost (N calls span N−1 gaps, so ten at 6s occupy 54s → 11.1/min). The
fencepost is left in and documented rather than papered over by widening the gap
— the window already caps the count outright, and chasing an exact 10.0 would buy
a tenth of a call for real run time.

### The limit is still unread, and that is now fixed too

Every one of the three models was tuned against an allowance **inferred from how
many calls a run made before a refusal** — a guess wearing the clothes of a
measurement. Nobody read what CoinGecko says its limit is.

`coingeckoPages.ts` now reports it: on a terminal 429 the error carries the
rate-limit headers (`x-ratelimit-limit` / `-remaining` / `-reset`, `retry-after`)
and the body's `error_message`, which on the free tier states the allowance in
words. The body is read from a **clone**, so the retry path still sees an
undisturbed stream — pinned by a test, since getting that wrong would break the
retry while looking like a throttling bug.

If no headers come back the line says *"upstream stated no limit headers"*, which
must not read like headers nobody looked at.

**So the next run answers the question directly.** Read that line before touching
the cap again. If the stated limit turns out to be below ~10/min, the derived gap
follows it by lowering the cap; if the limit is fine and the refusal persists, the
remaining suspect is `coin-list`'s three pages at 250ms, and that fix lives in
code serving real users — still not something to change on inference.

### Unchanged, and still open

- **Subscan (polkadot/kusama)** — a keyed provider. Owner's policy call.
- **The six DeFiLlama symbols** — `npm run llama-symbols`, one owner-machine run.
- Everything under *Not defects* in the fifth-run section re-confirmed: BTC fee on
  the static estimate, Binance.US on `ohlcv`, key-gated macro/returns/universe,
  SPY-from-catalog.

---

## Seventh run — `coin-discovery` fixed, and the 429 moved somewhere I had not instrumented

`npm run audit` with #164 merged, plus the first real `npm run llama-symbols` run.

### The derived gap worked

| | Before | After |
|---|---|---|
| `coin-discovery` | **503** (CoinGecko 429 on page 1) | **REAL, 209 candidates** |
| Pacing held | 38.7s | 51.6s (10/min cap, **6000ms** derived gap) |

That is the fix landing: spacing the calls to the rate the cap names is what
`coin-discovery` needed, and it cost ~13s.

### But `alerts` and `portfolio-history` took the 429 instead — and reported nothing

Both failed on a CoinGecko 429, and both printed a **bare status**:

```
alerts:             Error: CoinGecko HTTP 429
portfolio-history:  bitcoin: HTTP 429 (transient: re-run)
```

No headers, no body, no stated limit. **That is a gap in the previous fix, not a
new problem.** `describeThrottle` went into `coingeckoPages.ts` — the *paging*
helper — and these two routes fetch CoinGecko directly and never touch it. So the
one run that was supposed to finally read the allowance read nothing, because the
refusal moved to a call site the instrumentation did not cover.

Instrumenting whichever site happens to be failing is whack-a-mole. So:

- `describeThrottle` moved to **`lib/server/coingeckoThrottle.ts`**, one
  implementation, imported by every CoinGecko call site — `coingeckoPages`,
  `alerts`, `portfolio-history`, and the `config` connection test.
- **`__tests__/coingeckoThrottleReporting.test.ts` walks every CoinGecko route**
  and fails any that builds a failure string from a bare `HTTP ${res.status}`. A
  new route inherits the requirement instead of rediscovering it. Verified by
  stripping the instrumentation back out of `alerts` and watching the guard name
  the file.
- The guard found a **third** site nobody had considered: `config/route.ts`'s
  CoinGecko ping, which backs the Integrations connection test. That is the one
  place a user can act on a stated limit directly, so it reports it now. The other
  providers' tests in that file keep the plain form — widening it to all of them is
  a separate change.

### What this run does establish about the limit

Real CoinGecko calls before `alerts` was refused — `markets` 1, `ohlcv`×3 **0**
(Binance.US), `chart` 1, `coin-list` 3, `coin-search` 1, `coin-discovery` 1,
`network-fees` 1, `alerts` 1 = **nine**, spread over roughly a minute by the 6s
gap.

**Nine real calls in ~60s was still refused.** So the true allowance is *below* the
10/min cap — a bound, not a reading. The cap is deliberately **not** being moved on
that bound: two previous rounds moved this number on inference and both were wrong,
and the next run now reports the actual figure. Set it from the reading.

### DeFiLlama: all six misses were removals, not renames

First `npm run llama-symbols` run, over DeFiLlama's full **17,193** pools. The
probe's three lenses agreed on every one, and no corrected symbol exists for any:

| Key | What DeFiLlama actually carries |
|---|---|
| `ankr_sol` | Ankr is present with **five** products (ANKRETH, ANKRFLOWEVM, ANKRBNB, ANKRAVAX, ANKRMATIC) — Solana is not among them |
| `stader_bnb` | Stader present with ETHX and MATICX only; no BNBX |
| `pstake_bnb` | pSTAKE absent from the dataset entirely |
| `pstake_atom` | ditto |
| `quicksilver_atom` | Quicksilver absent entirely |
| `metapool_near` | Meta Pool appears only as `meta-pool-eth` (MPETH, SPETH) |

`LLAMA_MAP` goes **25 → 19**, and now matches everything it asks for — so
`defillama-yields` stops reporting a permanent `partial (19/25)` that no fix could
close. All six keep the static fallback they were already serving, exactly like the
NEAR rung, so no rate regressed.

⚠ **The near-misses the probe printed are traps, and worth recording as such.**
`BNBX-WBNB` (thena-fusion) and `STKATOM-WETH` (sushiswap) look like the answer and
are not: an LP APY blends trading fees and incentives and carries
impermanent-loss exposure, so publishing one under "staking APR" is a category
error rather than an approximation. The route compares symbols exactly, so it
cannot drift into one — but a maintainer reading the probe output could paste one
in, which is why it is written at the removal site as well as here.

Seen, deliberately not acted on: **ANKRMATIC** (~2.4%) and **MPETH/SPETH** are live
pools with no key in the map. Adding them means new keys in the static table and on
the staking page — a feature, not this cleanup.

### Still open

- **Subscan (polkadot/kusama)** — a keyed provider. Owner's policy call.
- **The CoinGecko allowance** — one more run reads it. Then set the cap.

