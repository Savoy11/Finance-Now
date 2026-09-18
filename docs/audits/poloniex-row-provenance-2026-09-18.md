# Poloniex row provenance — 2026-09-18

**Question, recorded unassigned in `docs/decisions/2026-09-14-owner-decisions.md`:**
were the hand-maintained Poloniex rows in `transferFees.ts` copied from the
now-prohibited API, or read from the published fee page? Several are dated
2026-08-22, the day of the owner probe that returned 31 Poloniex rows. It was
filed as *a suspicion, not a finding*, and as a blocker on the next
`TRANSFER_FEES_LAST_VERIFIED` bump.

**Answer: they came from the API.** Not inferred — traced.

## The evidence

**1. Git says so.** `git log -S` on the stored values returns exactly one commit:

> `5358377` · 2026-08-22 · *fix(transfer-fees): apply 90 machine-verified fee
> corrections from the first reconcile*

Its own body: *"run on the owner's machine **against each exchange's own public
API**."* Every one of the five precise Poloniex values below appears as an added
line in that commit.

**2. The adapter records the probe's per-exchange counts.**
`withdrawFeeAdapters.ts:287` lists what that run returned — *"bitget 42,
**poloniex 31**, lbank 51, bitfinex 14, xtcom 41"* — and the block immediately
below it notes that Poloniex's 31 rows were removed on 2026-09-15 on terms
grounds.

**3. The precision is not a published schedule.** A fee page does not quote
0.06241486 LINK. These are machine-read quotes:

| Coin / network | Stored value | Row's own note |
|---|---|---|
| ETH / ERC-20 | `0.00029903` | — |
| USDT / ERC-20 | `0.754371` | "Exchange quotes this fee dynamically — the stored value is a 2026-08-22 reading" |
| USDC / ERC-20 | `0.753542` | same |
| LINK / ERC-20 | `0.06241486` | same |
| BTC / Bitcoin | `0.000021` | — |

The notes settle it on their own: a fee the exchange *quotes dynamically* cannot
have been read off a static published schedule. The table says where it came
from; nobody had joined that up to the terms finding.

## What this does and does not establish

**Does:** these five rows are retained Poloniex API data. The API is assessed
`prohibited` — User Agreement §9 licenses it "solely for the purposes of trading
on Poloniex" and bars use of the API *or its data* "for any other commercial
purpose". The source was removed on 2026-09-15; this data predates that removal
and survived it.

**Does not:** say anything about the rest of the Poloniex entry. The round-number
rows — XRP 0.2, TRX 1.0, DOGE 5.0, USDT/TRC-20 1.2 — are consistent with a
published schedule and were not touched by `5358377`. They date from the table's
original 2025-06-01 compilation, whose provenance is a separate, older question
that this finding does not answer.

## The decision this unblocks

Owner's call, not this document's. The precedent is on record twice: Yahoo's data
went on 2026-08-06 and Poloniex's *source* went on 2026-09-15, both on terms
rather than on quality. The narrow reading removes the five API-derived rows; the
broad one removes the Poloniex entry, on the grounds that a partially-sourced
exchange in a fee comparison is worse than an absent one.

Either way `TRANSFER_FEES_LAST_VERIFIED` is unblocked, because the question it
was waiting on is now answered.
