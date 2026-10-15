# Live-data audit — 2026-10-15, after the CoinGecko Demo key (T-105)

**Owner's machine**, egress checked first: no proxy flag, no hosting flag. `npm run audit` at the
harness's **default** CoinGecko pacing (10 calls a minute, 6 s minimum gap, coin-list weighted 3).
Before the key, that pace was refused by the fifth CoinGecko request. On 2026-10-14
(`live-data-audit-2026-10-14.md`) the run passed only at `AUDIT_CG_PER_MIN=4`.

## Setup

- **The key:** a CoinGecko Demo API key, created by the owner and saved in Integrations. The session
  never handled it. Saved keys went from 10 to 11.
- **Encryption:** the store had been encrypted the same morning under `FN_SECRETS_KEY` (T-437, D122).
  Its status read encrypted, key set, no error, and all 10 earlier keys read back after the switch.
- **Two routes fixed first:** `/live-data/chart` and `/live-data/pump-report/metrics` used to read only
  the `COINGECKO_API_KEY` environment variable. They would have missed a key saved in Integrations,
  and #359 fixed both.

## Result

| | Checks |
|---|---:|
| 🟢 REAL | 77 |
| 🟡 FALLBACK | 4 |
| 🔑 UNCONFIGURED | 9 |
| 🔴 FAIL | **0** |

**No CoinGecko request was refused.** Every CoinGecko-backed check read REAL: markets (78 assets),
coin-list (750), coin-search, coin-discovery, alerts, portfolio-prices (5/5 live), portfolio-history,
`/api/v1/prices` and both network-fee layers. The pacing held the run for 195.9 s.

The four fallbacks are known, and none is CoinGecko's:
- the synthetic OHLC chart, marked `synthetic: true` by design;
- `stock-universe` and `stock-outliers`, which need a paid FMP plan (D21);
- SPY's holdings, which come from the catalog because a UIT files no N-PORT.

**Still refused, and correctly reported:** CoinGecko candles older than 365 days. The Demo plan is
the free tier, and a paid key reaches them (D21). Closing prices from DefiLlama, with Coin Metrics
as the backup, cover that range (D103, D108).

## The drift monitor's pricing (T-105's own test)

The Portfolio Builder's drift monitor prices coins through `/live-data/portfolio-prices`. Twenty
coins were asked for in one call. Nineteen priced and `toncoin` was missing, but that was this
check's own mistake: the app's catalog maps TON to `the-open-network`, which priced. **With the IDs
the app uses, 20 of 20 priced live, so `pricedPct` is 100.**

T-105 closed on this record, with the owner's approval (2026-10-15).
