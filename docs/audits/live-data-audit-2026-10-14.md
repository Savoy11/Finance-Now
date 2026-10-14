# Live-data audit — 2026-10-14 (residential, two paces)

**Owner's machine, both runs**, on the audit as rebuilt the same day (#340): it calls every
`/live-data` and `/api/v1` route but five named in `NOT_AUDITED`, and reports a decided state as
UNCONFIGURED with the decision named. Same code (`main` at `5a41654`), same dev server, same
egress. The only variable changed between the runs was the audit's CoinGecko pace. The paced run
is the run of record; its raw output is `live-data-audit-2026-10-14.json` beside this file.

| | First run | Paced run |
|---|---|---|
| Egress | AS11426 Charter / Spectrum | same |
| `proxy` / `hosting` | false / false | same |
| CoinGecko pace | 10 a minute (the default) | **4 a minute** (`AUDIT_CG_PER_MIN=4`) |
| Finished (UTC) | 09:29 | 09:39 |
| Wall time | 281s | 500s |
| **REAL** | 73 | **75** |
| **FALLBACK** | 4 | 5 |
| **UNCONFIGURED** | 7 | 8 |
| **FAIL** | **5** | **1** |
| Checks | 89 | 89 |

**The server was fresh.** A dev server left running since 2026-10-10 was stopped first and `.next`
cleared. `restart-dev.ps1` could not do it: it assigned `$pid` and so stopped itself (fixed in #341).
The dev server's log shows no request but the audit's during either run, so nothing else spent
the CoinGecko budget.

## The headline: CoinGecko refused at the fifth call

Four of the first run's five failures were CoinGecko 429s, and all four cleared at 4 a minute:

| Check | First run | Paced run |
|---|---|---|
| `ohlcv eth MAX candles` | FAIL, 429, retry-after 60 | UNCONFIGURED: CoinGecko's free service refuses candles past 365 days, as designed |
| `chart (synthetic OHLC proxy)` | FAIL, no candles | FALLBACK, correctly marked `synthetic: true`, as designed |
| `coin-list` | FAIL, 429 on page 1, retry-after 12 | REAL, 750 coins |
| `alerts` | FAIL, 429, retry-after 45 | REAL, 5 alerts |

**The refusal came at the fifth CoinGecko request, after five or six real calls.** The order was
`markets` (1 call), `ohlcv btc 1Y` (2), `ohlcv btc 1Y closes` (DefiLlama, 0), `ohlcv xrp 6M` (2),
then `ohlcv eth MAX`, refused. CLAUDE.md's last bound was about nine calls a minute (the seventh
run, 2026-09). Today's is lower: the keyless allowance moves with CoinGecko's own load. The 429s
carried `retry-after` and the message, and no rate-limit headers, so the exact allowance is still
unread.

**What it means:**
- **For the audit:** the default pace of 10 a minute was too fast for keyless today. Run it as
  `$env:AUDIT_CG_PER_MIN='4'; npm run audit` until there is a key.
- **For the app:** every CoinGecko route shares that same keyless allowance, so a busy page can
  meet the same 429. A free CoinGecko Demo key raises it (T-105), and the app already sends one as
  `x-cg-demo-api-key` when it is set. Creating the account is the owner's.

## The one remaining failure: Tronscan rate-limits this IP

`wallet tron` failed in both runs with `Tronscan HTTP 429`, from a single call each time. Called
directly, outside the app, `apilist.tronscanapi.com/api/account` answered **429** again. That is
the same as on 2026-09-12 from this ISP. It is Tronscan limiting this IP, not something the audit
provoked. The Wallets page is hidden from the rollout, so nothing a user sees depends on it.

## Findings

1. **Stride's staking endpoint is gone.** `edge.stride.zone` returned NXDOMAIN from the system
   resolver and no address from 1.1.1.1 or 8.8.8.8, while `stride.zone` itself resolves. The
   upstream probe (`npm run staking-upstreams`, sequential) reported "fetch failed" in 112ms.
   - It fed `stride_atom`, `stride_inj` and `stride_tia`. All three are measured fallbacks dated
     2026-10-07, so they are withheld from 2026-10-22 when the 14-day window closes, and the
     fallback refresh cannot re-measure them.
   - CLAUDE.md's rule is to drop a dead rung or find its new URL; which one is the owner's call.
2. **Injective's public endpoint answered HTTP 502 four times over about 45 minutes**: a 6s
   timeout in each audit run, then 502 after 8.2s in the probe and 502 after 5.5s when called
   directly (`lcd.injective.network/cosmos/mint/v1beta1/inflation`). It feeds `native_inj`. A 502
   is the server's own error and may pass, so it should be re-checked before the rung is dropped.
3. **Polygon's gas price is not live, because the gas ladder names the wrong host.**
   `network-fees` reported 4 live chains where CLAUDE.md documents 5; Polygon read `estimate`.
   - `lib/data/networkFees.ts` tries `polygon-bor-rpc.publicnode.com`, then `polygon.publicnode.com`.
   - Both resolve to the same Cloudflare addresses as `ethereum.publicnode.com`, and accept TCP on
     443. **Both fail the TLS handshake** (`SEC_E_INVALID_TOKEN`), while the ETH name answers over
     the same addresses.
   - **`polygon-bor.publicnode.com` answers `eth_gasPrice` from this IP.** It is the host the
     wallet route uses, and the `wallet eth (polygon)` check passed in both runs.
   - So the second rung is a name that does not serve Polygon, and the first is refused from this
     IP, the pattern recorded on 2026-09-10. Replacing `polygon.publicnode.com` with
     `polygon-bor.publicnode.com` should make Polygon live again.
   - First read as an IP refusal on both names; the wallet route's hostname showed otherwise.
4. **The crypto Social page is empty**: 0 signals. Reddit is withheld by its robots gate (D58), and
   neither LunarCrush nor Santiment has a key, so every source the route has is withheld. Equity
   Stock Social has StockTwits (30 signals) and is not affected.

## Every check added on 2026-10-14 passed

| Check | Result |
|---|---|
| `v1 securities quotes` | 2/2 live via Finnhub |
| `v1 securities history` | 130 daily closes via Tiingo |
| `v1 macro yield-curve` | 2026-10-13 curve, 2s10s 0.42, normal |
| `v1 macro fx-rates` | EUR 0.89381, JPY 158.12 per USD, ECB 2026-10-13 |
| `v1 options score` | 503 with its reason, as D64 requires |
| `withdraw-fees` | 6/6 exchange feeds live, 115 fees overlaid |
| `ipo-calendar` | 6 upcoming IPOs via Alpha Vantage |
| `source-terms` | 73 entries: 47 verified, 26 seeded, 6 prohibited; oldest reading 2026-08-05 |
| `video-analyze` (GET) | 1 analyzer, none configured (UNCONFIGURED, no key) |
| `futures-curve gold` | 8 contract months resolved, none priced (UNCONFIGURED, no source since Yahoo) |
| `funding-rates` | UNCONFIGURED, no source by decision (D40); it failed the whole run before #340 |
| `stock-social` | 30 StockTwits signals, Reddit withheld (UNCONFIGURED); it read green before #340 |

The four `/api/v1` routes the MCP server reads had never been audited before this run.

## Expected, and the same as before

| Cause | Checks |
|---|---|
| **By design** | `chart` synthetic candles, marked; `fund-holdings` SPY from the catalog (a UIT files no N-PORT); `ohlcv eth MAX candles` refused past 365 days |
| **A decision** | `funding-rates` (D40), `futures-curve` (Yahoo, on terms), Reddit on both social routes (robots gate, D58) |
| **Paid plan, deferred under D21** | `stock-universe` at the 79-name catalog; `stock-outliers` over 66 of them |
| **No key** | `video-search` (YouTube), `video-analyze`; `macro quotes`, where `GC=F`, `EURUSD=X` and `ZN=F` went unserved by any keyed provider, the open question since 2026-09-09 |

## Figures, for the next run to compare

- `markets`: 78 assets via CoinGecko.
- `network-fees`: 18 networks, 4 live; the cross-layer checks agree to the cent and BTC's fee is live from mempool.space.
- `staking-rates`: 23/51 live APRs, 5/7 upstreams healthy.
- `config`: 57 providers, no keys leaked.
- `v1 exchanges`: 29.
- `agent prompts`: 11 agents.
- `fund-universe`: the 140-fund catalog plus 29,053 discovered funds.

**Slow checks:**
- `fund-universe`, 11.3s: a cold read of NASDAQ Trader's directory and the SEC's fund dataset.
- The staking collector and both `/api/v1/staking` checks, 5.7 to 6.2s: Injective's 6-second timeout.

Some of each is first-compile time in the dev server.

## What this does and does not license

- **Does:** treat the data layer as healthy at the keyless CoinGecko pace. There is one failure,
  Tronscan's limit on this IP, and every fallback and gap is explained.
- **Needs the owner:**
  - a CoinGecko Demo key (T-105);
  - Stride's rung, dropped or re-pointed, before 2026-10-22;
  - Injective re-checked;
  - the one-line Polygon hostname fix.
- **Does not:** close T-001, T-129 or T-130. Those need the agent-output half
  (`npm run agent-eval -- --run`), which this harness does not measure.
