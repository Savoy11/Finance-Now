# Live-data audit — 2026-09-12 (two egresses)

**Owner's machine, both runs.** Same code, same dev server process, same session.
The only variable changed between them was the network egress, which is what makes
this a comparison rather than two anecdotes.

| | VPN run | Residential run |
|---|---|---|
| Public IP | 64.145.93.77 | 76.39.172.140 |
| AS | AS22781 Strong Technology (Netprotect) | AS11426 Charter / Spectrum |
| `proxy` / `hosting` | **true / true** | false / false |
| Started | 18:59 | 19:05 |
| **REAL** | **65** | **64** |
| **FALLBACK** | 9 | 9 |
| **FAIL** | **0** | **1** |
| Wall time, 67 shared checks | 288.2s | **112.7s** |

## The headline: 67 checks, exactly one difference

`wallet tron` — REAL via VPN, FAIL residentially with `Tronscan HTTP 429`.

**It is a rate limit, not a block, and not something the audit provoked.** Re-tested
immediately afterwards with a single call and no burst: our route returned the same
429, and `apilist.tronscanapi.com` returned **429 directly** when called outside the
app entirely. So the residential IP is currently rate-limited by Tronscan. That will
clear on its own; it is not an outage and not a reason to touch the route.

Everything else — all 66 remaining checks — returned the identical classification on
both egresses.

## ⚠ mempool.space is not VPN-blocked. That claim was about one exit node.

`CLAUDE.md` records, from 2026-09-10:

> | `mempool.space` (BTC fees) | Behind the VPN: TCP dropped on 80 AND 443 — BTC read
> `estimate`, and every `network-fees` call paid an 11s timeout | On the residential IP:
> **live, 129ms** |

**This run contradicts it.** Through a VPN, `network-fees` returned
`18 networks, 5 live / 13 estimated` in 5.4s and the cross-layer check reported
`bitcoin fee is live (mempool.space) source=live`. No timeout, no estimate fallback.

The two observations are not in conflict once the variable is named properly: the
2026-09-10 run went through **Bitdefender WireGuard, AS62651**; this one through
**Netprotect, AS22781**. mempool.space was refusing *that exit node*, not VPNs, and
certainly not "being down".

This is the **fourth** time the same error has been caught in this repo — a single
observation read as a property of the world. The first three are already recorded
(mempool.space "down", publicnode "dead", Polygon "missing a fallback"). The
difference here is that the correction cost one command instead of a debugging
session, because the two-egress habit is now written down.

## The publicnode rung choice is now measured, not argued

`CLAUDE.md` keeps the **short** hostnames on the EVM ladder ahead of the `-rpc`
variants, on the reasoning that they "answer from BOTH egresses". That was inferred
from one pair of runs. It now holds across a second VPN and a second residential ISP:

| Endpoint | VPN (AS22781) | Residential (AS11426) |
|---|---|---|
| `ethereum.publicnode.com` | live — 6.7124 ETH, 5956 txs | live, 1139ms |
| `polygon-bor.publicnode.com` | live — 592.72 POL, 874ms | live, 2316ms |

Keep them first. Nothing here argues for reinstating the `-rpc` names.

## The 9 fallbacks are identical on both egresses, and none is a network problem

That they match exactly is the useful part: every one is a design decision or a
missing key, so no amount of egress work moves them.

| Cause | Checks |
|---|---|
| **By design** | synthetic chart proxy (correctly marked `synthetic:true`); `cbdc-data` static table (the page is de-routed); `fund-holdings` SPY (a UIT — files no N-PORT, so catalog is the correct answer) |
| **US geo-block** | 3× OHLCV served by Binance.US because Binance.com 451s from the US. The VPN exits in the US too, so it does not help — and the row is labelled with the venue difference rather than hidden |
| **Key-gated** | `security-returns` → `source=none`; `stock-universe` → 79 curated rather than thousands, because FMP's `company-screener` needs a **paid** plan; `stock-outliers` → only 66 evaluated, a direct consequence of the previous row |

**Reddit is absent on both egresses** (`stock-social: 30 signals, stocktwits=30`),
which confirms it is our own robots gate and not an IP or rate-limit artifact —
it lifts only with `REDDIT_CLIENT_ID`, exactly as `CLAUDE.md` says.

## The VPN costs 2.56× in latency

Not a correctness issue, but it changes how audit timings should be read — a "slow
route" on a VPN run may be the tunnel, not the upstream.

| Check | VPN | Residential | Penalty |
|---|---|---|---|
| pump-report metrics | 14216ms | 1388ms | +12.8s |
| v1 discovery | 12082ms | 2190ms | +9.9s |
| staking-discovery | 9883ms | 2890ms | +7.0s |
| risk-scores (withdrawn) | 8782ms | 3730ms | +5.1s |
| defi-tvl | 8111ms | 3416ms | +4.7s |

CoinGecko pacing also differed (25.7s held on the VPN run) — that is the throttle
responding to real timing, not a fault.

## Corroboration of the same day's docs work

The audit independently reports **`network-fees: 18 networks`** and
**`network count matches across layers: 18 networks both layers`**. `CLAUDE.md`
claimed **16** in two places until it was corrected earlier on 2026-09-12, and
`dataSources.ts` hardcoded "16 chains" into generated `DATA-SOURCES.md`. The running
code agrees with the correction.

Other figures matching their recorded values: `staking-rates 27/51 live APRs, 7/7
upstreams healthy`; `network-fees 5 live / 13 estimated`; `v1 exchanges 30`;
`config 59 providers, no keys leaked`; `agent prompts 11 agents`.

## What this does and does not license

- **Does:** treat the current data layer as healthy. One transient 429 out of 74
  checks, on both egresses, with every fallback explained.
- **Does not:** close T-001 or T-129b. Those need the *agent output* half — running
  the 11 agents and judging answer quality — which this harness does not measure.
- **Actionable, and unchanged by this run:** the FMP paid-plan gap is the single
  biggest live limitation, capping the Stock Registry at 79 curated names and the
  screener at 66. It is a purchasing decision, not a bug.
