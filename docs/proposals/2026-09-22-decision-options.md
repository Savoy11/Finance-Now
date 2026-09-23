# Decision options — T-401 (unadjusted closes) and T-399 (Pendle)

**Drafted 2026-09-22. Nothing here is decided.** Both carry a recommendation, and both
recommendations are arguable — they are written to be disagreed with, not adopted.

Neither option set was reasoned from field names. Every count below was measured against
the live API or traced in the tree on the date above, from the owner's machine on a clean
egress (Spectrum, `proxy:false`, `hosting:false`).

---

## 1. T-401 — trailing returns on unadjusted closes

### What is true today

`frontend/src/app/live-data/security-returns/route.ts:89` reads:

```ts
const close = row.adjClose ?? row.close
```

When a provider omits `adjClose`, the unadjusted close is used and **nothing downstream
says so**. A 4:1 split reads as a −75% return with no marker.

Two surfaces consume it, and both render a Returns column:
`(dashboard)/equities/EquitiesClient.tsx:227` and `(dashboard)/funds/FundsClient.tsx:383`.

### Why this is a decision and not a bug

`docs/decisions/2026-09-18-owner-decisions.md` records it as **explicitly open**:

> *"Whether to serve trailing returns computed on unadjusted closes, clearly labelled, or
> to keep the surface dark until a paid or Tiingo decision. That is a data-fidelity call
> with a real tradeoff — distributions and splits distort unadjusted returns, and for
> mutual funds distributions are the point — and it belongs to the owner. **Recorded here
> as open so it is not decided by default.**"*

The line above decided it by default. That is the whole of the problem: not that the
fallback is necessarily wrong, but that a decision recorded as the owner's was taken by a
`??`.

⚠ **Note where the sting lands.** D21 says *for mutual funds distributions are the point*
— and `/funds` is one of the two consumers. Unadjusted returns are least defensible
exactly where this app uses them most questionably.

### The options

**Option A — Disclose per row.** Keep the fallback; mark any return computed without
`adjClose`. The repo already has the vocabulary: catalog reference prices render behind an
amber `ref` tag, and this would be the same pattern with its own label. The route would
return an `adjusted: boolean` per symbol and the two Returns columns would tag the
unadjusted ones.
· *For:* nothing goes dark; the reader is told. Consistent with how this app already
handles degraded data, and with the data-honesty principle in the README.
· *Against:* a tag on a number that is wrong by a split's magnitude is a small marker on a
large error. A −75% return does not become acceptable by being labelled.

**Option B — Refuse the fallback.** Compute only from `adjClose`; where it is absent,
return no figure and let the column show its existing gap state.
· *For:* the app's stated principle is that a surface with no reliable source shows "not
available" rather than a fabricated value. An unadjusted trailing return is not a
degraded version of the right number, it is a different number.
· *Against:* it goes dark on whichever symbols the serving provider does not adjust, and
that set is provider-dependent and invisible until it happens. D21 already records that
there is **no free, held provider with adjusted closes across funds**, so this may empty
the funds Returns column entirely.

**Option C — Ratify the current behaviour.** Decide the fallback is acceptable, record it
in the decision file, and remove the "not decided" status.
· *For:* it is what ships today, and it has shipped without complaint. Cheapest by far.
· *Against:* it ratifies a silent fallback rather than a disclosed one. If chosen, the
disclosure question from Option A should be answered separately rather than assumed away.

### Recommendation

**Option A, with a caveat I want on the record.** It preserves the surface, matches the
`ref`-tag pattern the app already uses, and converts a silent default into a stated one —
which is the actual defect. But Option B is the more principled reading of this repo's own
data-honesty rule, and if the funds column turns out to be mostly unadjusted, A is
disclosure theatre and B is the honest answer. **Measuring how many symbols actually lack
`adjClose` should precede the choice** — that is an owner-machine run with keys, and it
would turn this from a judgement into an arithmetic.

---

## 2. T-399 — which Pendle whitelist flag

### The question as filed, and why it dissolves

Pendle's API moved. The old `/core/v1/sdk/1/markets` 404s; `/core/v1/1/markets` returns
200. Three changes come with it:

| Route reads | New API |
|---|---|
| `totalLiquidity` (number) | `liquidity` — **an object**, `{ usd, acc }` |
| `isWhitelisted` | split into `isWhitelistedPro` / `isWhitelistedSimple` / `isWhitelistedLimitOrder` |
| `?order_by=liquidity:desc` | rejected, HTTP 400 |

The filed question was which flag replaces `isWhitelisted`, on the grounds that the choice
changes which markets the app surfaces. **Measured, it changes nothing**, because a later
filter removes everything regardless:

| Flag | Survives liquidity/APY/expiry | **After `symbolToCoinId`** |
|---|---|---|
| `isWhitelistedPro` | 28 | **0** |
| `isWhitelistedSimple` | 1 | **0** |
| `isWhitelistedLimitOrder` | 27 | **0** |

*(Sample: first 100 of 491 markets on chain 1, `limit=100`; the API rejects larger limits.)*

The 28 that survive under Pro are `USD3`, `USDx`, `reUSDe`, `mHyperBTC`, `USDat`,
`fxSAVE`, `sUSDx`, `sUSDD`, `sUSN`, `wstETH` and similar. `COIN_SYMBOL_MAP` covers nine
coins and matches on `base.startsWith(s)`. `"WSTETH"` starts with neither `ETH` nor
`WETH`, so even the one obviously-Ethereum market does not resolve.

**So repointing Pendle would restore a working fetch that still yields zero pools.** The
binding constraint is the coin map, not the flag — and that is the same constraint that
empties Beefy (76 single-asset vaults → 8 resolved → 0 past the $1M gate).

### The options

**Option A — Repoint Pendle and accept it yields nothing yet.** Fix the path, the
`liquidity.usd` shape and the `order_by` param; pick `isWhitelistedPro` as the closest
analogue to the old single flag. The rung becomes correct and inert.
· *For:* the fetcher stops being broken, and it starts working the moment the coin map
grows. Small, contained, no product judgement.
· *Against:* ships code whose measured output is zero, which is hard to distinguish from
dead code later. Would need a comment saying exactly that.

**Option B — Widen `COIN_SYMBOL_MAP` first, then repoint.** Teach the map liquid-staking
derivative symbols (`wstETH`, `weETH`, `ezETH`, `rsETH`, `swETH`, `ETHx` → `eth`), then
fix Pendle. This also un-empties Beefy.
· *For:* addresses the actual constraint, and fixes two upstreams with one change. The
symbols are well-known and the mapping is not ambiguous.
· *Against:* it is a **product** decision dressed as a data one. Mapping `wstETH → eth`
asserts that a Lido staked-ETH derivative belongs under Ethereum in this app's coin
vocabulary. Defensible, but it changes what `/staking` shows and should be chosen, not
slipped in. Note the app already holds this opinion elsewhere — `hasReceiptToken()` in the
same route detects exactly these `st`/`r`/`j`/`m` prefixes.

**Option C — Drop the Pendle rung.** Remove it and record why.
· *For:* honest about the measured state. One fewer upstream to keep alive.
· *Against:* **not supported by the evidence.** The host is healthy and serves 491 markets
on chain 1; nothing about Pendle is dead. Dropping it would record "source gone" for a
source that is fine, which is the specific error this whole item started as. Listed only
so the option is visibly rejected rather than unconsidered.

### Recommendation

**Option B, and treat the coin-map widening as the real decision.** The Pendle repoint is
mechanical once that is settled, and the same change makes Beefy non-empty. Option A is a
reasonable interim if you would rather not answer the vocabulary question today — but it
should land with a comment stating the measured zero, or the next reader will spend an
afternoon rediscovering it.

⚠ **Not recommended: choosing a flag.** As filed, this decision has no consequence. If the
coin map widens, revisit it then — with `isWhitelistedPro` and `isWhitelistedLimitOrder`
nearly identical in population (28 vs 27) and `isWhitelistedSimple` a curated ten, the
choice only starts to matter once something survives to be chosen.

---

## What would change these answers

- **T-401:** a count of how many held-provider symbols actually lack `adjClose`. If it is
  a handful, Option B costs almost nothing. If it is most of the funds catalog, Option A
  is disclosure over an empty surface and the real answer is a Tiingo or paid decision.
- **T-399:** whether `wstETH` and its siblings belong under `eth` in this app's coin
  vocabulary. Everything else follows from that.
