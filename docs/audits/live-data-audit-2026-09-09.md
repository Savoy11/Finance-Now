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
