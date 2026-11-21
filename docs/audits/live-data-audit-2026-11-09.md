# Live data audit — 2026-11-09

**Run:** `npm run audit`, once, on the owner's machine against the dev server, at the default
CoinGecko pacing (10 a minute, Demo key since T-105); the pacing held the run for 196.8 s. The
egress was not checked before this run, so it is not recorded here; every run since 2026-10-14 was
on the owner's home line.

| | Count | 2026-10-26 |
|---|---|---|
| 🟢 REAL | 82 | 78 |
| 🟡 FALLBACK | 6 | 5 |
| 🔑 UNCONFIGURED | 9 | 9 |
| ⚪ EMPTY | 1 | 0 |
| 🔴 FAIL | 0 | 0 |

The four extra REAL checks are new since 2026-10-26, not recoveries.

## Measured on the owner's machine for the first time

These were built in cloud sessions, which cannot reach the SEC (the app names the owner's email as
its contact) or a keyed provider, so this run is their first reading on real data:

- **The wider Stock Registry list (T-450, D205):** 5,723 NYSE and Nasdaq stocks from the SEC's
  `company_tickers_exchange.json`, 4,328 with an SEC earnings figure; left out 2,783 listed
  elsewhere, 1,565 preferred shares, warrants and units, and 338 funds. The keyless search for
  "ford" put Ford first.
- **Next earnings dates (T-458, D213):** AAPL 2027-02-04, MSFT 2027-01-27, NVDA 2026-11-17, each
  from FMP. Over the 90 days asked, FMP answered with 63 dates and Alpha Vantage with 1,873, so
  most companies' dates come from Alpha Vantage. The Market Calendar read 120 earnings and 1
  economic event in its default range.
- **Treasury yield history (T-446, D202):** 10Y, 249 readings to 2026-11-06, 4.86%, expected
  inflation 2.23%.
- **Currency pairs at the ECB rate (T-445, D203):** 17 pairs at the rate of 2026-11-06, EUR/USD
  1.1165 (−0.53% since 2026-11-05); USD/JPY's past year, 254 rates.

## Two findings, both fixed on `claude/dazzling-volta-lbbz61`

### 1. Eleven CoinGecko call sites never sent the key

`coin-discovery` was FALLBACK: its tokenized-security category reads stopped at a 429 on the fifth
category, and its stablecoin labels fell back to guessing. The same thing happened on 2026-10-26,
when it was taken for a one-off because the second run passed.

The cause was in the code, not CoinGecko's load. The owner saved a Demo key on 2026-10-15 (T-105),
and six routes sent it (`markets`, `chart`, `ohlcv`, `alerts`, `pump-report/metrics`,
`coin-rating`). Eleven call sites wrote CoinGecko's address by hand with a bare `Accept` header, so
they spent the keyless allowance:

- the paged helper `lib/server/coingeckoPages.ts`, behind `coin-list`, `coin-discovery` and the two
  category reads (`tokenizedSecurities.ts`, `stablecoinCategory.ts`);
- `coin-search`, `coin-profile` ("About this project"), `portfolio-prices`, `portfolio-history`,
  `global` (the market-dominance figures);
- the network fees' prices (`lib/data/networkFees.ts`, behind `network-fees`, `/api/v1/network-fees`
  and the withheld `/api/v1/transfer/routes`);
- `/api/v1/prices`.

It explains the "one-off" too: the category reads are cached a day, so the first run after the
cache lapses sends about nine keyless requests in one check, and the second run is served from the
cache.

**Fixed:** every call now uses `coingeckoBase()` and `coingeckoHeaders()` from
`lib/api/live/coingecko.ts`, so a saved key is sent and `COINGECKO_BASE_URL` reaches every call.
`networkFees.ts` takes both from its routes as an argument, because the Transfer Fees page loads
that file in the browser, where the key is not available. The Integrations "Test" button keeps
sending the key typed into the form.

**Held by:** `lib/api/__tests__/coingeckoKeySent.test.ts` (CoinGecko's address is written in one
file only, and every file that builds one sends the key); `coingeckoPages.test.ts` (each page and a
retry carry the key); `networkFees.test.ts` (the price request uses the address and key it is
given). Four deliberate breaks, one per rule, each caught.

**What it costs:** these requests now count against the Demo key's monthly allowance rather than
the keyless one. CoinGecko's dashboard shows how much of the month is used.

**Not yet measured:** whether the 429 is gone. The next `npm run audit` on the owner's machine
answers it.

### 2. The video feed answered "0 videos" with no reason

`videos` was EMPTY: 0 videos. On 2026-10-26 no check was empty, so the feeds answered then. The route answered `ok: true` with no videos
and nothing else when every channel feed failed, so the run could not tell a changed YouTube feed
from a blocked one. The cause is not known.

**Fixed:** `/live-data/videos` now returns `tried` (feeds asked for) and `failed` (each feed it could
not read, with the reason). The audit prints them beside the count, and the Videos page says how
many feeds failed and why, in place of "channel feeds may be unreachable". A feed that answered
with no videos is not counted as failed. Held by `lib/server/__tests__/videosFailures.test.ts`.

**Not yet measured:** the reason on the owner's machine. The next run prints it. From this cloud session the same
day, all 14 feeds failed, each answered by YouTube's own feed server (`server: YouTube RSS Feeds server`) with
HTTP 404 or 500, not refused by the session's network. That is one address's reading, not the owner's
(see "Data-availability results are IP-dependent" in CLAUDE.md).

## Known and expected

**Fallbacks (5 besides `coin-discovery`), all as on 2026-10-26:**
- the chart route's synthetic OHLC, marked as such;
- the staking rates, 22 of 45 live, with Swell's and Stader's DefiLlama readings of 0 refused (D169);
- the stock universe and outlier screen on the 79-stock catalog, since FMP's screener needs a paid
  plan (D21);
- SPY's holdings from the catalog: SPY is a unit investment trust and files no N-PORT.

**Unconfigured (9), each withheld by a decision or a missing key, and named as such:** ETH candles
past 365 days, funding rates (D40), crypto social and stock social (Reddit's robots gate), video
search and analysis, the TRON wallet, the futures curve, and macro quotes.

**Slow:** `fund-universe` at 11.8 s, as before (11.3 s on 2026-10-14, 12.0 s on 2026-10-17): a cold
read of NASDAQ Trader's directory and the SEC's fund data set. `risk-scores (withdrawn)` at 4.6 s: a
removed route answering 404, not looked into.

**Not called, on purpose (5):** the three Pump Report AI routes and the two hidden rating routes
(`scripts/lib/auditCoverage.mjs`).

## Also run on the owner's machine the same day

- **`npm run db:migrate`:** "migrations applied". The two notices are Postgres saying the
  migration bookkeeping schema and table already exist. Migrations 0010 (importing trades from a
  file, T-447) and 0011 (cash income, T-451) are applied there; nothing is waiting.
- **`npm run fund-facts`:** rebuilt `fundFacts.generated.json` from the SEC's 2026q3 N-PORT data set:
  14,066 registrants, 13,199 series with reported net assets, 25,009 tickers. The file is on the
  owner's machine and not yet in the repository. Once it is, `FUND_FACTS_BUILT_ON`
  (`lib/data/fundNetAssets.ts`) moves to 2026-11-09 and its STALENESS-ACK comes out, as the
  script says.
