# Live data audit — 2026-10-26

**Run:** `npm run audit`, twice, on the owner's machine against the dev server. The egress was
checked first: Spectrum, `proxy: false`, `hosting: false`, so this is a home-connection baseline
and not a VPN one. Default CoinGecko pacing (Demo key, T-105); the pacing held the run for 214 s.

## First run: 3 failures

| Check | What it found | Kind |
|---|---|---|
| `staking-discovery` | Live Pools served Swell's rswETH at **7,530%** APY, plus swETH at 366%, a Vesper ETH vault at 64% and an Aerodrome WETH-msETH pool at 70% | **A real defect on a shipping page** |
| `stock-universe` | "bad top entry": the check asked for `marketCapB` and a market-cap order | The check was out of date: D170 (2026-10-25) removed market cap and prices from this route |
| `stock-outliers` | "missing category highBeta" | The check was out of date: D170 removed the beta lists |

The Live Pools defect is the reading D169 (2026-10-25) had already kept off the staking rates. That
fix bounded every staking-rates collector (`usableRate`), but the Live Pools route
(`/live-data/staking-discovery`) reads DefiLlama on its own and had no bound. Only its Beefy leg
dropped values above 300%. The audit's own check allowed up to 1,000%, so it would have passed swETH
at 366% and caught the problem only because rswETH read 7,530%.

**Fixed the same day:**
- `lib/data/discoveryApy.ts` applies the staking rates' DefiLlama bound (40%) to every Live Pools
  source.
- A pool above the bound is left out and named in the response's new `refused`, never dropped
  silently.
- The panel says how many were left out, with each one in its hover text.
- The audit's check now fails on any yield above 40%.
- The two stock checks now match D170: no market cap or reference price is served, and the
  outlier categories are cheap, expensive and high-yield.

Tests: `src/lib/data/__tests__/discoveryApy.test.ts`. They also hold the 40% bound equal to the
staking rates' figure and to the audit's.

## Second run: 0 failures

| | Count |
|---|---|
| 🟢 REAL | 78 |
| 🟡 FALLBACK | 5 |
| 🔑 UNCONFIGURED | 9 |
| ⚪ EMPTY | 0 |
| 🔴 FAIL | 0 |

- **Live Pools:** 134 pools, APY 0.1–11.9%. Left out above 40%: rswETH 7,530%, swETH 366%,
  Vesper ETH 64%, Aerodrome WETH-msETH 70%.
- **The five fallbacks are all known and expected:**
  - the chart route's synthetic OHLC, marked as such;
  - the staking rates at 22 of 48 live, with Swell's and Stader's DefiLlama readings refused
    (D169; tomorrow's retry);
  - the stock universe and outlier screen on the 79-stock catalog, since FMP's screener needs a
    paid plan (D21);
  - SPY's holdings from the catalog, because SPY is a unit investment trust and files no N-PORT.
- **The nine unconfigured are each withheld by a decision or a missing key, and named as such:**
  ETH candles past 365 days, funding rates (D40), social (Reddit's robots gate), video search and
  analysis, the TRON wallet, the futures curve, and macro quotes.
- **One flake on the first run, not repeated on the second:** `coin-discovery` took a CoinGecko
  429 on its tokenized-securities and stablecoin category reads. It passed on the second run (191
  candidates, 18 tokenized securities left out).
- **Not called, on purpose (5):** the three Pump Report AI routes and the two hidden rating routes
  (`scripts/lib/auditCoverage.mjs`).

## Also run: `npm run accuracy-check` and `npm run fund-assets-check`

- **189 figures and tables:** 172 ok, 14 due soon, 3 due. Two of the due ones are clocks the owner
  chose to let fire (Transfer Fees, the staking catalog). The third is PSLV's net assets.
- **None of the 117 SEC-filed fund figures has a newer filing.**
  - The 13 due on 30 October still have their 31 May N-PORT as the newest public one; the 31
    August N-PORTs are made public about 60 days after the period, so re-run after 30 October.
  - PSLV files a 40-F once a year, for December, so it shows as due with nothing newer to read
    until early 2027.
