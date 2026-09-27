# Staking lock-up consistency audit — 2026-09-26

**Item:** T-394, the factual-fields half (D26 removed the editorial half) · **Scope:** the
`lockupDays` field on all 187 asset rows across the 55 providers in `stakingProviders.ts`
· **Method:** a brace-matching parse of the catalog, then each coin's rows compared against
each other · **Writes:** nothing.

`lockupDays` is unusual among the catalog's fields: for a natively-staked position it is
mostly a **protocol** property, not a provider one. Cosmos unbonding is 21 days for
everybody. So rows for the same coin that disagree are either a real product difference
that should be explained in `lockupNote`, or an error — and the catalog can be asked which,
without leaving the repo.

## Result: eleven coins agree, four do not

| Coin | Rows | State | Values |
|---|---|---|---|
| ada | 11 | consistent | 0d ×11 |
| atom | 15 | consistent | 21d ×15 |
| avax | 9 | consistent | 14d ×9 |
| bnb | 8 | consistent | 7d ×8 |
| dot | 15 | consistent | 28d ×15 |
| inj | 6 | consistent | 21d ×6 |
| matic | 8 | consistent | 9d ×8 |
| tia | 6 | consistent | 21d ×6 |
| btc, cro, osmo | 1 each | single row | — |
| **eth** | 17 | ⚠ **3 values** | 0d ×9 · 7d ×7 · 10d ×1 |
| **near** | 5 | ⚠ **2 values** | 4d ×3 · 0d ×2 |
| **sol** | 22 | ⚠ **4 values** | 3d ×13 · 5d ×7 · 0d ×1 · 7d ×1 |
| **trx** | 5 | ⚠ **2 values** | 3d ×4 · 14d ×1 |

Counts exclude 8 defunct rows, 40 liquid-staking rows (a receipt token is sold, so no
unbonding applies) and 9 lending or soft-staking rows — see the false lead below.

## The pattern: the disagreement lives in the rows with no note

70 of the 179 live rows carry a `lockupNote`. In every one of the four disputed coins, the
rows that explain themselves agree with the protocol, and the rows that differ are silent.

**SOL** — Solana deactivation completes at the end of the current epoch, so ~2–3 days. All
seven rows that carry a note say "~2-3 epoch cooldown" and record **3d**. The seven rows at
**5d**, one at **7d** (KuCoin) and one at **0d** (MEXC) carry **no note at all**. An
exchange may well batch withdrawals and take five days — that is a real product fact and
belongs in the note. As it stands the field says two different things about one chain.

**TRX** — the minority value is the only one with a source. Four rows say **3d** with no
note; `atomic-wallet` says **14d** with "Tron Stake 2.0 — 14-day unstake". Stake 2.0 is the
current mechanism, which makes the four silent 3d rows look like the Stake 1.0 era.

**NEAR** — three rows say **4d**, each noting "~4-day NEAR unstaking". NEAR's own protocol
docs state the unbonding period as **4 epochs**, which they put at "~24 hours" (one section
says ~48 hours). Four epochs is not four days, and the note preserves the reading rather
than the fact. The other two rows (Binance, OKX) say 0d with no note.

**ETH** — the widest spread, and the most defensible. Nine CeFi rows say 0d with no note;
seven say 7d, five of those explaining the validator exit queue; Aave says 10d and explains
its own staking-module cooldown, which is correct and unrelated to the queue. Exchanges do
front liquidity for ETH unstaking, so 0d can be true — but with no note it is
indistinguishable from a field nobody filled in.

## A false lead worth recording

The first pass of this audit flagged eight rows as "claiming a lock-up shorter than the
chain allows" — Nexo on SOL, BNB, DOT and AVAX, Bitfinex and MEXC on SOL, Binance and OKX
on NEAR. **Six of those are correct and the catalog already says why**, in `features`
rather than `lockupNote`:

> Nexo SOL: `['Lending-based yield', 'Higher rate but higher counterparty risk']`
> Nexo AVAX: `['Lending-based, not validator staking']`
> Bitfinex SOL: `['Soft staking — remains tradable while earning', …]`

A lending or soft-staking product has no protocol unbonding, so zero is the right number.
Any future automated check on this field has to read `features` before calling a zero
wrong — which is the argument for a `yieldType` the row states outright rather than a
reader inferring it from prose.

The same first pass also reported eleven rows as **missing** `lockupDays`. They were not:
the parse was line-based and the asset entries for Marinade, Stride, Lido, Benqi, Sanctum
and Phantom span several lines. **No live row is missing the field.** Recorded because the
wrong number was nearly written into a report.

## What this asks for

Per-provider verification against each provider's own documentation, which is what T-394
says and what this audit now scopes to **12 specific rows** instead of 187:

1. **SOL 5d ×7 + 7d ×1** (Kraken, OKX, Bybit, Crypto.com, Bitget, Gate.io, HTX, KuCoin) —
   confirm the longer hold and add a note, or correct to 3d.
2. **TRX 3d ×4** (Binance, Trust Wallet, Gate.io, HTX) — confirm against Stake 2.0 or
   correct to 14d.
3. **NEAR 4d ×3** (Coinbase, KuCoin, Gate.io) — the protocol says 4 epochs ≈ 24 hours;
   confirm each provider's own stated period and fix the note with it.
4. **ETH 0d ×9** — confirm each exchange fronts liquidity and say so in the note, or
   correct.

Everything else on this field is consistent and needs nothing. `STAKING_DATA_LAST_VERIFIED`
does not move for a single-field pass, and the 2026-09-27 notice fires as already
acknowledged.
