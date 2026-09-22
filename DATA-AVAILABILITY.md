# Finance Now — Data Availability Report

_Last generated: **2026-09-19**, from a full audit of all `/live-data/*` route handlers
executed against a running dev server on the development machine. This document is the
authoritative record of **what data in Finance Now is live, what is partially live, and what has
no free real-time source**. It exists so that a walk-through of the app surfaces exactly
what is — and is not — backed by real data, with no fabricated figures presented as real._

> **Companion doc:** [`DATA-SOURCES.md`](./DATA-SOURCES.md) is the "**where does each surface's data come
> from**" inventory — generated from `frontend/src/lib/data/dataSources.ts` (`npm run data-sources`), the same
> registry that powers the in-app **/data-sources** page and per-page source badges. This file tracks *whether*
> a surface is live; that one tracks *who* provides it.
>
> **Reproduce this report:** `npm run audit` in `frontend/` with the app running.
> The harness (`scripts/test-live-data.mjs`) classifies every route as
> REAL / FALLBACK / UNCONFIGURED / EMPTY / FAIL rather than just pass/fail.
> `npm run smoke` runs the fast CI subset.
>
> **Do not hand-edit a STATUS without re-running the audit** — that is how this file
> went stale last time. The 2026-09-08 ruling recorded just below is the one exception,
> and it is narrower than it looks: a claim about *which code exists* may be corrected
> from a file-and-line reading, because that is a reading rather than a measurement. A
> 🟢/🟡/🔴 verdict that depends on reaching an upstream may not.
>
> **The evidence for each run lives in `docs/audits/`, not in this file.** For the run
> of 2026-09-19: `live-data-audit-2026-09-19.json` (77 probes, machine-readable),
> `coverage-matrix-2026-09-19.md` (which surfaces each vendor carries, and what
> dropping it would cost — the D21 measurement) and `provider-config-2026-09-19.json`
> (which keys were held). Earlier runs: `live-data-audit-2026-09-{09,12,18}.*`.

> ### Correction pass — 2026-09-08
>
> Seven rows below asserted a state the code contradicts. Each was corrected in
> place with a dated marker, under the owner's 2026-09-08 ruling on the
> checklist-steward flow: **apply where the evidence is a file-and-line
> contradiction with no judgement in it; propose the judgement calls.** All seven
> are the first kind — the code says what it says.
>
> | Row | Was | Is |
> |---|---|---|
> | `network-fees` (×2 places) | "Only Bitcoin's fee is live" | 5 of 18 live — BTC plus ETH/BNB/Polygon/AVAX (`networkFees.ts` FEE_PROVIDERS). L2s stay estimates on purpose |
> | Risk scores | 🟢 Derived | ⚪ Removed 2026-08-29 (RP-6) — no per-coin score is published anywhere |
> | Exchange connections | 🟢 Live | ⚪ Removed 2026-08-18 (RP-5) — routes and credential store deleted |
> | Fund asset mix | "no source at all" | Derived from N-PORT `assetCat` (NT9, `lib/utils/assetMix.ts`) |
> | Stock social | "Known issue: Reddit is starved" | Fixed 2026-07-22 (`socialBlend.ts`); Reddit is now gated by robots.txt instead |
> | Staking APR (live coverage) | "PR #37 grew the catalog … **without adding live rate sources**" | Contradicted by the tree: `staking-rates/route.ts` carries a keyless **DeFiLlama Yields** rung mapping 25 provider keys plus ~20 native live keys, and `stakingProviders.ts` wires **33 distinct `liveAprKey`** values across 35 of 55 providers. The 4-of-51 RATIO is a 2026-07-29 measurement and is NOT changed here — only the claim that no live source was added. Whether those rungs answer is the owner-machine question (T-004). *(Overtaken since, and the **25 is left standing because it was right when written**: the six dead DeFiLlama keys were dropped the following day, 2026-09-09 (#165, `62b8388`), leaving **19**, and the collector moved out of the route into `lib/server/stakingRates.ts` with #205, landed 2026-09-19 — the in-file comment's "2026-09-18" is when the work was done, not when it landed. **T-004 is answered: 27 of 51 live, 7/7 upstreams healthy, `defillama-yields` 19/19** — see the 2026-09-19 run below.)* |
> | Social sentiment (crypto) | "Partial" with no live/derived split | Split stated: post text + Santiment/LunarCrush VOLUME are live (the latter two key-gated); every sentiment LABEL is computed in `social/route.ts` (Reddit = keyword regex, LunarCrush = galaxy-score threshold, Santiment = hardcoded neutral); Reddit `score`/`upvoteRatio` are absent-sentinels, not data |
>
> **Nothing here re-measures anything.** These correct claims about which code
> exists — which is a reading, not a measurement. Every LIVE/PARTIAL verdict that
> depends on reaching an upstream still needs `npm run audit` on the owner's
> machine, for the IP-dependence reason stated above.

> ✅ **2026-08-06 YAHOO REMOVAL — NOW MEASURED, NOT PREDICTED (run of 2026-09-09).**
>
> Yahoo was withdrawn on **terms grounds, not availability**: the
> `query1/query2.finance.yahoo.com` v8/v10 endpoints are undocumented internals of
> Yahoo's own web app with no published third-party API terms, and Yahoo's ToS
> prohibit automated access and redistribution. It is hard-blocked in code —
> `frontend/src/lib/server/sourceTerms.ts` refuses `*.yahoo.com` at the socket, so
> re-adding a fetcher does not bring it back.
>
> It was the only **keyless** rung on the equity/fund/macro quote, chart and OHLCV
> paths. The block that stood here was an honest *prediction from the code*; it has
> now been replaced by what `npm run audit` actually reported on the owner's machine.
>
> ⚠ **Read the middle column as "with this machine's keys configured".** The
> quote/chart/OHLCV rows came back REAL because FMP and Finnhub keys were present
> here on 2026-09-09. **Since 2026-09-19 tiingo, alpha-vantage and anthropic are keyed
> too** — the **Tiingo** key is what moved chart and OHLCV onto Tiingo and lit trailing
> returns; **no row in this table moved on account of alpha-vantage** (it is a quote
> rung and the IPO-calendar source, not a chart rung). An unkeyed deployment still
> lands on the catalog `ref` path the prediction described — that path was not
> removed, it simply was not exercised. Nothing below says the key-gating went away.
>
> | Surface | Predicted | **Measured 2026-09-09** |
> |---|---|---|
> | Quotes (stocks/ETFs/funds) | 🟡 Key-gated, else catalog `ref` | 🟢 **REAL** — 3/3 live via **Finnhub**, AAPL=$316.22. Key-gating intact; a key is configured |
> | Price chart | 🟡 Key-gated — Tiingo → FMP | 🟢 **REAL** — 130 close points (close-only by design). **2026-09-18 (#202):** Twelve Data joined as a third rung (Tiingo → FMP → Twelve Data) and a `basis` field now travels with every chart. **2026-09-19:** `source=tiingo`, `basis=adjusted` |
> | OHLCV / TA / backtests | 🟡 Key-gated — Tiingo → FMP | 🟢 **REAL** — 130 candles via **FMP**. **2026-09-18 (#202):** the ladder is now Tiingo → FMP → Twelve Data. **2026-09-19: 135 candles via Tiingo** once the Tiingo key landed |
> | Trailing returns | 🟡 Key-gated and capped | 🟡 **FALLBACK** — `source=none`, no returns served. **Prediction confirmed:** no Tiingo key, so the surface is dark rather than degraded. **Overtaken 2026-09-19:** Tiingo keyed → 🟢 **REAL**, `source=tiingo`, AAPL and MSFT both served |
> | Market news | 🟡 Partial — MarketWatch + CNBC | 🟢 **REAL** — 10 articles from CNBC + MarketWatch. Prediction exactly right |
> | Fund holdings | 🟢 Unchanged — SEC N-PORT | 🟢 **REAL** — VOO: 513 holdings via SEC, asOf 2026-06-30. SPY correctly falls back (UIT, files no N-PORT) |
> | Commodity / FX quotes | 🟡 Key-gated, hit hardest | 🔑 **UNCONFIGURED** — **no keyed provider served any macro quote**; `GC=F`, `EURUSD=X`, `ZN=F` all missing. The prediction's worst-case row is the one that came true. **Still 🔑 on 2026-09-19** with tiingo and alpha-vantage keyed as well: every keyed rung was available and none answered these three symbols. What the run recorded is **two different failures** — FMP answered **402** (a paid plan, not an absent capability), while Finnhub, Twelve Data, Tiingo and Alpha Vantage each "returned no quotes" for these Yahoo-style tickers. So the cause is still open between **coverage** and **symbol vocabulary**, and nothing measured yet distinguishes them |
> | Treasury yield indices | 🟢 Keyless since D3 | 🟢 **REAL** — treasury.gov, 13 maturities, 2s10s=0.41, 3m10y=0.86, shape=normal |
> | FX converter | 🟢 Unaffected | 🟢 **REAL** — ECB official tier 30 currencies + community extended tier 126, both date=2026-09-08 |
> | SEC filings / XBRL | 🟢 Unaffected | 🟢 **REAL** — filings, `company-facts` (rev=$416B, netMargin=26.9%), `company-profile` all live |
> | Futures term structure | 🔴 Not available | ⬜ **Not covered by the harness** — no check exists, so this run says nothing about it. Left as-is rather than assumed |
>
> A companion safeguard shipped in the same change: every external host now carries a
> dated terms verdict in `sourceTerms.ts`, a vitest fails if a host in `dataSources.ts`
> has no verdict, and user-added feeds are checked against the site's robots.txt and
> terms (`termsProbe.ts`) before they can be saved. See
> `docs/architecture/source-terms.md`.

> ✅ **RE-MEASURED 2026-07-29 (second run, evening) on the owner's machine** — `npm run audit`,
> app on localhost:3000, tree at **`54fbf0c`**. Headline: **76 checks — 60 REAL, 9 FALLBACK,
> 3 UNCONFIGURED, 1 EMPTY, 3 FAIL.** Macro is measured for the first time.
>
> **Two fixes verified by this run, both previously unconfirmed:**
>
> - **Crypto news is live again.** `news` → REAL (10 articles from **4 providers**) and
>   `v1 news` → REAL (5 articles). The morning run had both FAILING, which took out `/news`,
>   the crypto half of `/headlines`, and the `get_crypto_news` agent tool. The cause was
>   structural, not a feed outage: every built-in crypto news provider required an API key and
>   CryptoPanic's free tier ended April 2026, so with no key saved the route found zero
>   providers. The keyless RSS built-ins (CoinDesk, Cointelegraph, Decrypt, Bitcoin Magazine)
>   resolve from the owner's network — the thing the dev container could not test.
> - **`btc-stats` reports a real hashrate: 828 EH/s.** It read `0 EH/s` in both earlier runs
>   while block height advanced normally, because the route divided blockchain.info's GH/s
>   figure by `1e12` as though it were H/s. This is the measurement that confirms the
>   magnitude-inference fix, and it is worth noting *the audit classified that route REAL
>   throughout* — a wrong field inside a healthy payload is invisible to the REAL/FALLBACK
>   split, which is why the number itself had to be read.
>
> **Macro, measured at last** (the rows below are no longer ⬜): `macro-news` REAL — 20
> articles across 3 pillars; `fx-rates` REAL — 30 ECB currencies, `source=frankfurter-ecb`;
> `treasury-yield-curve` REAL — 13 maturities, 2s10s=0.45, 3m10y=0.84, shape=normal;
> `fx-rates-extended` **FALLBACK** — 124 of 126 allowlisted currencies priced, KPW and SYP
> unpriced upstream. That last one is the community tier degrading honestly, not a bug.
>
> ### The 3 remaining failures are one cause, not three
>
> `coin-discovery` (**explicit HTTP 429**), `portfolio-history` (`source=error`) and `alerts`
> (`ok:false`) all call CoinGecko, and `markets` / `coin-list` / `coin-search` succeeded
> earlier in the same run. This is the free tier's rate limit tripping partway through a burst
> of ~8 CoinGecko-backed checks — a **harness artifact**, not three broken routes. Re-running
> after a pause, or configuring `COINGECKO_API_KEY`, should clear all three together.
>
> `alerts` is new to the failure list only because `news` vacated it; it is not a regression
> (the route hardcodes its CoinGecko URL — no provider registry, no `pinnedFetch`).
>
> **Harness gap this exposed:** `alerts` reported bare `not ok` with no reason, because ten
> checks threw `'not ok'` while discarding the route's own `error` field. All ten now surface
> it. An unactionable failure line is its own kind of silent degradation — it sends the reader
> to the wrong layer, which is the exact failure this file exists to prevent.
>
> **Earlier the same day**, a first run (tree `d79c5d2`, 72 checks — 56 REAL, 8 FALLBACK,
> 3 UNCONFIGURED, 1 EMPTY, 4 FAIL) closed audit finding H3 and corrected two claims this
> document had asserted without measuring:
>
> 1. **The staking claim was wrong in the other direction.** The 2026-07-28 warning here
>    said PR #37's rewrite meant "only 4 of 28 live" no longer held. Measured, it is
>    **4 of 51 live** — the rewrite added providers to the catalog without adding live rate
>    sources, so the *proportion* got worse, not better. The warning was itself an
>    unverified claim, which is precisely the failure mode this file exists to prevent.
>    Re-confirmed at **4/51** in the evening run.
> 2. **The macro rows could never have been filled by running the audit** — the harness had
>    **no macro checks at all**. Four routes shipped 2026-07-21 and were never added to
>    `scripts/test-live-data.mjs`, so the doc gap and the harness gap were the same gap.
>    Macro coverage was added 2026-07-29 (4 checks) and the evening run exercised them.
>
> Statuses remain IP-dependent (see CLAUDE.md) — this run is from the owner's network. A
> datacenter run produces different, systematically worse answers.
>
> But two of the gaps below are **permanent, not IP artifacts**, so a re-run will not clear them
> (2026-09-09): Binance.com's 451 is a **US geo-block**, so the Binance.US fallback is the steady
> state for this owner; and Reddit is absent because **its robots.txt disallows our agent** and we
> honour that — it is not a rate limit, and it lifts only with `REDDIT_CLIENT_ID`.

## Legend

| Status | Meaning |
|--------|---------|
| 🟢 **Live** | Sourced from a real external provider at request time. |
| 🟡 **Partial** | Some fields live, others are static reference values or labeled estimates. |
| 🔑 **Key-gated** | Needs an API key/paid plan the project does not have. Route reports `configured: false` honestly. |
| 🔴 **Not available** | No free real-time source. The UI shows an explicit "not available" notice — never fabricated numbers. |
| ⚪ **Removed** | The surface is gone by decision, not by outage. The row is kept — with its date and the decision id — because "absent" and "deliberately withdrawn" are different answers to a reader asking why a feature is not there. |
| ⬜ **Not measured** | The surface exists in code but has never been through an audit run. **Not a status** — an admission that one is owed. Never leave a row here after a regeneration. |

⚠ **Two glyph collisions worth knowing before reading a run record.** The audit harness
has its own icon map (`scripts/test-live-data.mjs:58`) and it does not match this legend:
the harness uses **⚪ for its EMPTY verdict** and **🔑 for UNCONFIGURED**, whereas ⚪ here
means *removed by decision*. And `--strict` fails on FALLBACK and EMPTY only
(`test-live-data.mjs:1025,1074`) — never on UNCONFIGURED — so a 🔑 row cannot be made to
exit non-zero by that flag, whatever the header comment suggests.

⚠ **One ⬜ row has survived three regenerations**, against the rule stated above: futures
term structure (line ~594). It is not an oversight — the harness has no check for it
because there is no source to check — but it is carried as an open admission, tracked in
the action items, rather than quietly reclassified 🔴.

---

## ⚠️ Environment dependence — read this first

**This report is only valid from a network where these upstreams are reachable.**
Several providers geo-block or bot-block, and the results differ by IP. Verified
**2026-07-20** from the development machine — but read the egress split at the
"Environment dependence found by this run" section first: a VPN can be this machine's
normal state and re-enable itself unattended, so a VPN-on run and a VPN-off run are
**two legitimate baselines** and the rows below can flip between them. **Capture the
egress before trusting any row**, not after:

```bash
curl -s https://api.ipify.org                                   # what the world sees
curl -s "http://ip-api.com/json/<ip>?fields=isp,org,as,proxy,hosting"
```

If `proxy` or `hosting` is true it is not an owner-machine baseline, whichever machine
ran it. The 2026-09-19 run is the first in this file whose egress was captured *before*
its results: **AS11426 Charter/Spectrum, `proxy: false`, `hosting: false`, US.**

| Upstream | Result | Consequence |
|----------|--------|-------------|
| `api.binance.com` | **451** (US geo-block — permanent, not an IP artifact) | All crypto OHLCV silently served by Binance.US instead |
| `api.binance.us` | 200 | The de-facto crypto candle source |
| `fapi.binance.com` (futures) | **451** | `funding-rates` uses OKX instead |
| `api.okx.com` | 200 | Funding rates + open interest |
| Coinbase / Kraken public | 200 | Unused reachable fallbacks if more are ever needed |
| `min-api.cryptocompare.com` | **401** | Now requires a key; unusable keyless |
| CoinGecko free | 200 (intermittent **429**) | Rate-limited under load; 60 s polling floor |
| ~~Reddit `*.json` (API)~~ | **403** — all subs, all UAs (re-probed 2026-09-19) | **NOT FETCHED SINCE 2026-08-29 — robots grounds, same gate as the `.rss` row below.** `assertRobotsPermits` (`sourceTerms.ts:1331-1345`) refuses every `reddit.com` URL whatever the path, so the 403 is no longer the operative reason. 🔑 Lifted by `REDDIT_CLIENT_ID` — which per the entry's 2026-09-14 note means **accepting Reddit's Data API Terms**, not merely registering an app |
| ~~Reddit `*.rss` (Atom)~~ | 200, then **429** — a **per-IP rate window, not a UA split** (re-probed 2026-09-19: first call 200 under both a browser UA and `FinanceNow/1.0`, 429 on the next two, default UA included) | **NOT USED SINCE 2026-08-29 — robots grounds, not availability.** `reddit.com/robots.txt` disallows this agent, so `assertRobotsPermits` refuses every reddit.com fetch (`robotsDisallowed`, `sourceTerms.ts:546-551`). The 2026-09-19 audit scores `/live-data/social` UNCONFIGURED and the route returns `signals: []` with `withheld: [{id:"reddit"}]`. 🔑 Lifted by `REDDIT_CLIENT_ID` (OAuth) |
| `lunarcrush.com/api3` | **404** | Endpoint gone; also behind Cloudflare |
| ~~`stooq.com` CSV quotes~~ | **404** (re-probed 2026-09-19) | Dead, and **no longer in any ladder** — removed from the provider registry and the quote path after the **2026-07-19** audit found it 404ing on every variant. `'stooq'` survives only as an INERT legacy enum value (`instruments.ts:29-33`); nothing writes it and nothing branches on it (the 2026-08-06 date in that comment is the `yahoo`→`security` rename, not this). Quotes today ladder FMP → Finnhub → Twelve Data → Tiingo → Alpha Vantage → catalog reference; **price history** is a different ladder, Tiingo → FMP → Twelve Data (#202) |
| `cloudflare-eth.com` | JSON-RPC `-32603` | **Fixed:** ETH wallet route now uses a fallback ladder |
| `polygon-rpc.com` | 403 "tenant disabled" | **Fixed:** same ladder |
| `kobe.mainnet.jito.network/api/v1/apy` | **404** | **Fixed:** switched to `/stake_pool_stats` |
| SEC EDGAR / data.sec.gov | 200 | Keyless and authoritative — filings, XBRL, N-PORT |
| ~~Yahoo Finance spark/chart~~ | 200 | **NOT USED SINCE 2026-08-06 — removed on terms grounds, not availability.** Reachability is beside the point: there are no published third-party API terms for these endpoints. Hard-blocked in `sourceTerms.ts` |
| ~~Yahoo Finance **v8 chart, individual futures months**~~ (`CLZ26.NYM`) | 200 | **Measured 2026-08-05 (P2-O1):** 9/9 across NYMEX/COMEX/CBOT, 64 daily bars. Unblocks the futures term-structure view (P2-O4) — same API already in production |
| ~~Yahoo Finance **options**~~ (`v7/finance/options`) | **401** — both hosts, all symbols | **Measured 2026-08-05 (P2-O1):** auth wall, not a rate limit. The keyless options-chain path is closed. Note Yahoo chart answered 10/10 in the same run — Yahoo is reachable; Yahoo *options* is gated |
| `cdn.cboe.com` delayed options quotes | 200, complete (greeks + IV + OI) | **Measured 2026-08-05 (P2-O1): technically perfect, PROHIBITED BY TERMS.** Cboe forbids auto-extraction of delayed quote data and blocks the IPs that attempt it; programmatic use runs through the paid All Access API. Not used, and not to be added. Owner decision 2026-08-05: options chains stay not-available; the Trade Risk Scorer takes hand-entered legs instead — see `docs/assessments/P2-O1-options-data.md` |
| StockTwits | 200 | Keyless equity social |
| DefiLlama, alternative.me, Lido, Marinade | 200 | All healthy |
| `mempool.space` | 200 in 0.04s (2026-09-19) · **TCP dropped from one exit node** — Bitdefender WireGuard **AS62651**, 2026-09-10 | **Exit-node-dependent, NOT VPN-dependent.** It answered normally through a second VPN (Netprotect **AS22781**) — `docs/audits/live-data-audit-2026-09-12.md`. The narrowest true statement is *"AS62651 could not reach it that day"*; the host was never down. This is the single reason BTC network fees flip 🟢↔🟡. Probe the host directly, never through the route |

**Key-gating vs geo-blocking are different problems.** A route needing a paid FMP plan
(`stock-universe` — the screener still 402s even with the key held) is a commercial
decision, and under **D21 it is deferred, not chased**. A route blocked by IP
(`ohlcv`, `funding-rates`) cannot be fixed by paying anyone.

**Reddit is a third case and belongs in neither bucket.** It is 🔑 gated by *our own*
robots decision since 2026-08-29, lifted by setting `REDDIT_CLIENT_ID` and accepting
Reddit's Data API Terms — not an IP block, not a plan. Filing it under "blocked by IP"
is what sent earlier debugging after a network fault that was never there.

---

## 🔴 Silent degradation — routes that return HTTP 200 with non-live data

**This is the most important section.** These routes look healthy to any status-code
check. They are not lying about their data, but a caller that ignores the provenance
field will treat catalog/reference/estimate values as live readings.

| Route | Looks like | Actually is | Provenance field |
|-------|-----------|-------------|------------------|
| `ohlcv` | `source: "binance"` | **Binance.US**, a different venue with its own liquidity and prices | `venue: "binance-us"` (added 2026-07-20) |
| `stock-universe` | 79 stocks, `ok: true` | Curated `equityCatalog.ts` fallback — the real universe is thousands | `source: "catalog"` |
| `stock-outliers` | Sector z-score screener | Screens the catalog only — **66 of the 79 names, across 7 sectors**, clear the mcap/sector filters, so "outlier" means outlier within a hand-picked large-cap set *(measured 2026-09-19)* | inherits `stock-universe` |
| `staking-rates` | **51** APRs, `ok: true` | **27 live, 24 estimated** *(re-measured 2026-09-19; unchanged since 2026-09-09, which corrected the 4 live / 47 estimated of 2026-07-29)*. The 24 are **not all sourceless** — #203 splits them by gap reason: `no-upstream` 14, `derived-estimate` 5, `curated-estimate` 3, `needs-api-key` 2 (`native_dot`, `native_ksm` — 🔑, a source exists). Of the 27 checkable against a live reading on 2026-09-09, **22 were ≥25% overstated** (worst: `lombard_btc` 3.2 → 0.17); #203 refreshed the fallbacks and **that spread has not been re-measured since**. A measured fallback older than **14 days** is now withheld outright — gap `estimate-expired`, and the rate deleted from `rates` (`stakingRates.ts:697,705`). | `sources: { key: "live" \| "estimate" }`, `gaps` (per-key reason), and `fallbackProvenance` — **one dated record**, `{ measuredOn: "2026-09-18", measuredKeys: 27, unmeasuredKeys: 24 }`, not per-key rows |
| `network-fees` | 18 networks with USD fees | **5 of 18 are live** (Bitcoin via mempool.space; ETH / BNB / Polygon / AVAX via keyless `eth_gasPrice`, added 2026-08-21, `01d6bfe`). The other 13 are static gas × live price. **The L2s are estimates on purpose** — `eth_gasPrice` omits their L1 data fee, which is most of the real cost — so the remaining work here is non-EVM chains, not L2s. *(Corrected 2026-09-08: this row said "only Bitcoin", written before the EVM-L1 work.)* | per-network `source: "estimate"`, `btcFeeSource`. ✅ **The 2026-09-09 "BTC read `estimate`" was an egress artifact, not a dead host.** Narrowed 2026-09-10 to the **TCP layer** (DNS correct and identical across three resolvers; a connect to `103.165.192.x:443` never completed while control hosts connected in 0.19s), then **settled 2026-09-12** by reaching the host normally through a different exit node (AS22781) — the refusal was **AS62651 specifically**, not VPNs and not the host. Re-confirmed 2026-09-19 from AS11426: 200 in 0.03s, route reports `btcFeeSource: "live"`, audit 🟢 REAL. Count stays 5 of 18 because that is the design, not a degradation. Probe the host, not the route |
| ~~`cbdc-data`~~ | — | ⚪ **Removed 2026-09-14 (D10)** — this route and `/global-adoption` were cut; the path now 404s and only an empty untracked directory remains. This also makes **T-138 moot**: the fabricated `updatedAt` it tracked lived in a route that no longer exists | n/a |
| `fund-holdings` (SPY) | 5 holdings | Catalog's indicative top holdings. **Expected** — SPY is a unit investment trust and files no N-PORT | `source: "catalog"`, `full: false` |
| `chart` | OHLCV candles | **Synthesised** — `open==high==low==close`; built from a price-only series | `synthetic: true` (added 2026-07-20) |
| `security-quotes` | Live prices | Equities are live (`source: "fmp"` / `"finnhub"`). Macro tickers `GC=F` / `EURUSD=X` / `ZN=F` return 🔑 **200 with `source: "reference"` and an EMPTY `quotes: {}`** — the catalogs hold no reference row for macro by design, so there is nothing to fall back *to*. Why no rung answered is **not settled**: FMP returned 402 (paid plan) while the other four returned no quotes for these symbol forms *(measured 2026-09-19)* | `source: "reference"`, per-quote `reference: true` |

**The audit harness fails-loud on five of these** (🟡 FALLBACK — `ohlcv`, `chart`,
`stock-universe`, `stock-outliers`, `fund-holdings`; 7 of 77 probes on 2026-09-19), so
they cannot pass silently again. `network-fees` and `staking-rates` now pass 🟢 REAL
because their live/estimate split is counted and by design, and macro `security-quotes`
reports 🔑 UNCONFIGURED.

Run `npm run audit:strict` to make the FALLBACK rows exit non-zero — but note it adds
**FALLBACK and EMPTY only** (`scripts/test-live-data.mjs:1025,1074`), never UNCONFIGURED,
so the macro row cannot be made to exit non-zero by that flag at all. The header comment
at `:26-28` says otherwise and is wrong.

---

## Run of 2026-09-19 — measured results

✅ **This is the cleanest baseline in this file, and the first whose egress was captured
BEFORE its results rather than reconstructed afterwards.**

| | |
|---|---|
| Egress | **AS11426 Charter / Spectrum**, US |
| `proxy` / `hosting` | **false / false** |
| Harness | `npm run audit` against localhost:3000, tree at `516220f` |
| Evidence | `docs/audits/live-data-audit-2026-09-19.json` (machine-readable, 77 probes) |

That matters because the 2026-09-09 run — still the most-cited run in this document — was
measured through a Bitdefender WireGuard tunnel on **AS62651** with `proxy: true`, and two of
its reachability rows were wrong in **both** directions. This run is on a residential ISP with
neither flag set, so its reachability rows are load-bearing in a way that run's were not.

**Headline: 77 probes — 65 REAL, 7 FALLBACK, 3 UNCONFIGURED, 0 EMPTY, 2 FAIL.**

### Exactly three verdicts moved since 2026-09-18

Everything else held. A one-day diff that moves three checks is worth stating precisely,
because the interesting part is *which* three:

| Check | 09-18 | 09-19 | Why |
|---|---|---|---|
| `security-returns` | 🟡 FALLBACK — `source=none` | 🟢 **REAL** — 2 symbols via Tiingo | The Tiingo key landed. This surface was **dark, not degraded**, so the key did not improve it — it turned it on |
| `coin-search` | 🟢 REAL — 20 matches | 🔴 **FAIL** — HTTP 404, non-JSON | Next was still recompiling the route. A direct probe seconds later returned 200. **A harness artifact, not a route defect** |
| `wallet tron` | 🟢 REAL — balance served | 🔴 **FAIL** — HTTP 502, Tronscan 429 | Reproduced with a single call against Tronscan directly, so **not provoked by the audit's own burst** — the same transient seen on 2026-09-12 |

Two further moves changed no verdict but record real work landing:

- **`v1 exchanges` 30 → 29.** Poloniex left the catalog — removed 2026-09-15 on **terms**,
  not on a probe (User Agreement §9 licenses the API "solely for the purposes of trading on
  Poloniex"), and the host is now `prohibited` in `sourceTerms.ts`.
- **`v1 staking` ETH APR range 2.5–4.8% → 0.6–3.5%.** This is #203 landing. The v1 route had
  been serving **catalog estimates for 6 of 7 keys** while the UI served live readings, because
  its private fetcher multiplied an already-percentage Lido value by 100 and then failed its own
  `apr < 30` guard. Both surfaces now read `collectStakingRates()`. The narrower range is the
  fix, not a market move.

### "65 REAL" is not a count of live data — 7 of the 65 assert the opposite

This is worth stating because the headline number invites the wrong reading. Seven REAL
checks assert that something is **correctly absent or correctly refused**, not that an
upstream answered:

- `risk-scores` — correctly gone (RP-6, 2026-08-29)
- `cbdc-data` — correctly gone (D10, 2026-09-14)
- `wallet exchange-connections` — correctly gone (RP-5, 2026-08-18)
- `v1 transfer routes` ×2 — correctly **withheld** (503), and the 503 correctly precedes
  parameter validation, so a withheld surface cannot be probed for its parameter shape
- `portfolio-history` (missing params) — correctly rejected with 400
- `security-chart` (wrong range vocab) — correctly rejected with 400 (`6mo`, not `6M`)

So **58 of 77 probes** represent an upstream actually answering. A REAL verdict means "the
route did the right thing", which is the more useful property — but it is not a synonym for
"data is flowing", and summing the column as though it were overstates live coverage by seven.

### The 7 FALLBACK rows are three different situations

Not one backlog. Grouping them is what makes the list actionable:

| Rows | Situation | Action |
|---|---|---|
| `ohlcv` ×3 (btc 1Y, xrp 6M, eth MAX), `chart` | **Honest labelling of a known substitution.** Binance.com is US-geo-blocked so candles come from Binance.US (`venue` records it); `chart` is synthetic OHLC and says `synthetic: true` | None. Working as designed |
| `stock-universe`, `stock-outliers` | **A paid-plan wall.** FMP's `company-screener` needs a paid plan, so the universe is 79 curated names and the screener evaluates 66 of them across 7 sectors | **Deferred under D21** — record and move on |
| `fund-holdings` (SPY) | **Correct behaviour, mis-shelved as a fallback.** SPY is a unit investment trust and files no N-PORT | None. The harness counts it FALLBACK because it is catalog-sourced, which is accurate but reads as a defect |

### What this run could not answer

Stated so the next reader does not mistake silence for coverage:

- **The harness has no check for `/live-data/ipo-calendar`.** Its 🟢 status in the tables
  above rests on a **direct probe only** (`ok:true`, `source=alpha-vantage`, 2 events). Same
  for `/live-data/withdraw-fees`, `/live-data/global`, `/live-data/coin-profile` and
  `/live-data/source-terms` — five live, user-facing routes with no probe in any run.
- **Futures term structure remains ⬜ Not measured**, for the third regeneration running. There
  is no check because there is no source to check; it is carried as an open admission.
- **All six `cross-layer` checks are network-fee checks.** The agreement property they verify —
  that `/live-data` and `/api/v1` report the same number — is only ever tested on fees. Prices,
  staking APRs and quotes cross the same boundary untested.
- **Nothing measures reachability.** Every route behind Transfer Fees, Wallets and Equity
  Backtests probes 🟢 while the pages redirect away. See "Reachability is not availability".
- **The 22-of-27 overstated-fallback spread was not re-measured.** #203 refreshed the values;
  whether the spread closed is unknown.

---

## Run of 2026-09-09 — measured results

⚠ **This run was measured through a VPN and its IP-dependent rows are wrong.** See
"Environment dependence" below. It is kept because the key-gated, terms-gated and
catalog-shaped findings are unaffected and still stand — only the reachability rows
moved. The corrected run is 2026-09-10, immediately below.

`npm run audit`, owner's machine, app on localhost:3000, tree at `57bb322`.
**77 checks: 62 REAL · 11 FALLBACK · 3 UNCONFIGURED · 0 EMPTY · 1 FAIL.**

### ✅ Re-run 2026-09-10 with the VPN OFF

**77 checks: 62 REAL · 9 FALLBACK · 3 UNCONFIGURED · 0 EMPTY · 3 FAIL.**

⚠ **This was first written up as "the corrected baseline". That framing is wrong, and the
correction matters for anyone reading these rows.** The VPN is the machine's NORMAL state —
it was found re-enabled hours later, having reconnected on its own. So a VPN-off run is the
exception, not the baseline, and **there are two legitimate baselines depending on egress**:

| Row | VPN on (normal) | VPN off |
|---|---|---|
| BTC network fee | 🟡 estimate, ~11s per `network-fees` call | 🟢 live, 129ms |
| `publicnode` EVM RPC | 🟢 all hostnames answer | ❌ the two busiest refuse this IP |
| Everything key-gated, terms-gated or catalog-shaped | identical | identical |

Neither column is "the truth". A reader asking *"is the BTC fee live?"* needs to know which
egress the app is running behind, and **the honest answer is that it depends** — which is
why the check in "Environment dependence" below is to look at the egress first, not to
trust either table.

⚠ **Do not test reachability through the route.** With the VPN back on, a direct request to
`mempool.space` timed out at 20s while `/live-data/network-fees` still reported
`btcFeeSource: live` — a value cached during the VPN-off window and served inside its
revalidate period. The field is not lying (that reading *was* live) but it answers "where
did this number come from", not "can we reach the source now". For reachability, probe the
host directly.

| Moved | From | To | Why |
|---|---|---|---|
| `network-fees` | 🟡 FALLBACK, 10,936ms | 🟢 **REAL, 129ms** | mempool.space reachable; BTC fee live |
| `bitcoin fee is live (mempool.space)` | 🟡 FALLBACK `source=estimate` | 🟢 **REAL `source=live`** | same |
| `wallet eth (polygon)` | 🟢 REAL | 🔴 **FAIL 502** | all THREE of its rungs were dead at once — corrected below |
| `wallet tron` | 🟢 REAL | 🔴 **FAIL** | Tronscan HTTP 429, per-IP |
| `portfolio-history` | 🔴 FAIL | 🔴 FAIL | unchanged — CoinGecko 429, `retry-after=18` |

Net: **two real fixes and two IP-scoped regressions**, in opposite directions. Neither
host was ever down. The `network-fees` timing alone removed three entries from the
slow list — it had been paying an 11-second timeout on every call.

⚠ Everything NOT reachability-shaped is identical across the two runs: the same 62
REAL, the same 3 UNCONFIGURED (`social`, `video-search`, macro quotes), the same
catalog and paid-plan findings. A VPN changes which hosts answer, not whether a key
is configured — which is why the 2026-09-09 conclusions about Yahoo, FMP tiers and
terms gating all still hold.

This is the run the 2026-08-06 Yahoo block was waiting for — see the measured table
near the top of this file.

### 🔴 Failures (1) — transient, and it produced a reading worth keeping

| Check | Verdict |
|---|---|
| `portfolio-history` | CoinGecko **HTTP 429** on `bitcoin`, `retry-after=7`. Transient — re-run |

**What the 429 body actually says**, because three rounds of cap-tuning were done on
inference and this run was meant to settle it:

> `"You've exceeded the Rate Limit. Please visit`
> `https://www.coingecko.com/en/api/pricing to subscribe to our API plans for higher`
> `rate lim…"`

**CoinGecko states no numeric allowance** — just that phrase, a pricing link, and
`retry-after=7`. The instrumentation added in #164/#165 worked exactly as designed, and
the honest conclusion is that **the cap still cannot be read off a refusal**;
`retry-after=7` is the only hard datum. Do not move `AUDIT_CG_PER_MIN` on the strength
of this. It is not the reading that was hoped for, and treating it as one would be the
fourth inference in a row.

Pacing held the run for **52.5s** (10/min cap, 6000ms derived gap, `coin-list` weighted
3 calls) and a 429 still landed — so the real allowance remains **below 10/min**.

### 🟡 Silent degradation (11) — 200 OK, not the intended source

| Check | What it actually served |
|---|---|
| `ohlcv` btc 1Y / xrp 6M / eth MAX | Binance.com geo-blocked (451, US) → served by **Binance.US**: different venue, different prices. Steady state for a US owner, not a fault |
| `chart` | 721 price points, correctly marked `synthetic:true` — a close-price proxy, not real OHLC |
| `network-fees` | **BTC fee not live** (`btcFeeSource=estimate`) — see the environment note below |
| `cbdc-data` | 55 countries from the static table (de-routed surface) |
| `security-returns` | `source=none` — no Tiingo key |
| `stock-universe` | 79 stocks from the curated catalog — FMP `company-screener` needs a **paid** plan |
| `stock-outliers` | only 66 evaluated across 7 sectors — screening the catalog, not the real universe |
| `fund-holdings` (SPY) | 5 indicative holdings from catalog — **expected**: SPY is a UIT and files no N-PORT |

### 🔑 Unconfigured (3) — honestly reported

| Check | Missing |
|---|---|
| `social` | 0 signals, every provider withheld. Reddit is gated by **our own robots.txt honouring**, not a rate limit — needs `REDDIT_CLIENT_ID` |
| `video-search` | no YouTube API key |
| macro quotes | no keyed provider served `GC=F` / `EURUSD=X` / `ZN=F` |

### ✅ Measurements this run settles

| Question | Measured |
|---|---|
| **Staking live-rate coverage** | **27 of 51 keys live · 7/7 upstreams healthy · `defillama-yields` 19/19.** Was 4/51. The cascade is fixed: four dead hosts were hanging DNS ~10s each on libuv's 4-thread pool and starving the shared 6s budget (#157–#165) |
| **`fund-universe` payload size** | **2,271,262 bytes (2.27 MB)** uncompressed, 10.9s, 126 catalog + **28,962** discovered funds. Still large, and **served unzipped** — a `gzip` `Accept-Encoding` request returned the same byte count |
| `coin-list` | 750 coins, source=coingecko |
| `btc-stats` | height 966,190 · hashrate 855 EH/s (10.9s) |
| `staking-discovery` | 94 pools, APY 0.1–88.7% |

### ✅ Environment dependence — found, diagnosed and RESOLVED (2026-09-10)

The BTC fee read `estimate` because mempool.space was unreachable. It took three
wrong explanations to get to the cause, and each one is worth keeping because each
looked convincing:

1. ~~"mempool.space is down or moved."~~ No — traceroute **completes**, reaching the
   host at hop 14 in 104ms. It answers ICMP fine.
2. ~~"DNS interception — those addresses are not where it lives."~~ No — the system
   resolver, Cloudflare `1.1.1.1` and Google `8.8.8.8` all return the same
   `103.165.192.202-207`, and mempool.space self-hosts with no CDN (its own
   `*.wiz.biz` nameservers, no CNAME). Those are genuinely its addresses.
3. ~~"A blackholed route."~~ No — see (1). Packets arrive.

**The actual cause: all traffic was egressing through a VPN.** The active adapter was
`bdvpnservice_2` (Bitdefender, WireGuard) and the egress IP was `108.171.102.153` —
Strong Technology / NetProtect, AS62651, which IP intelligence flags `proxy: true`.
mempool.space answers ICMP from that address but **silently drops TCP on both 80 and
443**, the standard signature of a host blocking VPN/proxy ranges. Bitcoin
infrastructure does this aggressively because of scraping abuse.

With the VPN off, the same checks pass immediately:

| | VPN on | VPN off |
|---|---|---|
| Egress IP | `108.171.102.153` (`proxy: true`) | `76.39.172.140` (Spectrum, `proxy: false`) |
| Apparent location | Colorado | North Carolina (the real one) |
| mempool.space `:80` / `:443` | both dropped | **both connect** |
| `/api/v1/fees/recommended` | 20s timeout | **HTTP 200 in 0.40s** |
| `btcFeeSource` | `estimate` | **`live`** |
| `network-fees` check | 🟡 FALLBACK, **10,936ms** | 🟢 **REAL, 129ms** |

⚠ **THE BASELINE CAVEAT THIS EXPOSES.** This document tells you to trust an
owner-machine run because results are IP-dependent. That is right, and it is not
sufficient: **the owner's machine can itself be behind a VPN**, in which case the run
measures a datacenter/proxy IP — exactly the systematically-wrong baseline the warning
exists to prevent, just from a different address. Every IP-dependent verdict recorded
in the 2026-09-09 run was measured through that proxy.

**Check the egress before trusting a run:**

    curl -s https://api.ipify.org
    curl -s "http://ip-api.com/json/<that-ip>?fields=isp,org,proxy,hosting"

If `proxy` or `hosting` is true, the run is not an owner-machine baseline no matter
which machine it ran on.

### ⚠ And the trade-off runs BOTH ways — publicnode (2026-09-10)

Turning the VPN off fixed mempool.space and broke something else. `publicnode.com`
(the keyless EVM RPC behind `network-fees` and the wallet routes) now **refuses this
residential IP at the Cloudflare edge** — both `ethereum-rpc` and `polygon-bor-rpc`,
over IPv4 and IPv6 alike, failing in 40-75ms rather than timing out. It did NOT
recover after 3+ minutes, and under the VPN it worked, so this is IP-scoped, not an
outage. Most likely a per-IP rate-limit ban earned by the audit's own RPC burst.

Consequences, one of which is a genuine gap:

| Check | Outcome |
|---|---|
| `wallet eth (mainnet)` | 🟢 REAL — the ladder fell through to `eth.drpc.org` |
| `wallet eth (polygon)` | 🔴 **FAIL 502** — all three rungs dead at once (corrected 2026-09-10; it was NOT missing a fallback) |
| `wallet tron` | 🔴 FAIL — Tronscan HTTP 429, also per-IP |

⚠ **CORRECTED 2026-09-10 — the "no fallback" claim here was WRONG.** Polygon always had
three rungs (`polygon-bor-rpc.publicnode.com`, `polygon.drpc.org`, `polygon-rpc.com`).
The real fault was worse and less obvious: **all three were failing simultaneously**, so
the ladder behaved exactly as designed and still had nothing to land on.

Diagnosed by testing each endpoint individually instead of trusting the route's "all RPC
endpoints failed" message, which never says how many there were:

| Chain | `-rpc` hostname | short hostname |
|---|---|---|
| ethereum | ❌ TLS never completes | ✅ `ethereum.publicnode.com` |
| polygon-bor | ❌ TLS never completes | ✅ `polygon-bor.publicnode.com` |
| bsc · avalanche · arbitrum · base · optimism | ✅ all 200 | ✅ |

So it is **not** a publicnode naming change — five of the seven `-rpc` hostnames are
fine. Exactly two are broken, and both happened to sit FIRST in their ladder. Ethereum
survived by falling through to `eth.drpc.org`, paying one wasted request; Polygon had no
survivor because its other two rungs were independently down.

Fixed in `wallet/eth/route.ts`: both dead hosts replaced with their verified working
form, plus `1rpc.io/matic` added to Polygon, which had zero working rungs without it.

**The transferable lesson:** a fallback ladder is only as good as its rungs still being
alive, and nothing was checking. "All endpoints failed" reads like an outage and was two
stale hostnames plus coincidence.

⚠ Note the shape of this: the audit can provoke the very failure it then reports. A
burst of RPC calls earns a rate-limit ban, and the next run records "provider down".
Neither of these two hosts was ever down.
### 🐢 Slow (>3s)

`network count matches across layers` 22.8s · `v1 network-fees` 11.1s · `fund-universe`
11.1s · `network-fees` 10.9s · `btc-stats` 10.9s · `staking-discovery` 6.4s.

The three `network-fees` figures share one cause: each waits out the unreachable
mempool.space before falling back.

### ⚙ How to reproduce this run

`next dev` **exhausts its default heap** partway through a full audit — it reached
1.87 GB, went unresponsive, and stalled the run for 83 minutes with the harness blocked
on a request that never returned. `next start` is not an option here (`output:
'standalone'`). Run it with headroom:

    NODE_OPTIONS=--max-old-space-size=8192 npm run dev
    # then, in another shell:
    npm run audit

With 8 GB the same run completed in ~4 minutes at a steady 1.06 GB.

---

## Run of 2026-07-29 — measured results

_Superseded by the 2026-09-09 run above; kept for the record of what changed._

`npm run audit`, owner's machine, app on localhost:3000, tree at `54fbf0c` (evening run).
**76 checks: 60 REAL · 9 FALLBACK · 3 UNCONFIGURED · 1 EMPTY · 3 FAIL.**

### 🔴 Failures (3) — all three are one cause

| Check | Verdict |
|-------|---------|
| `coin-discovery` | **HTTP 503** — CoinGecko markets unavailable, page 1 returned HTTP 429 (rate limited). |
| `portfolio-history` | **No historical prices** (`source=error`). CoinGecko history. |
| `alerts` | **`ok:false`** on a single CoinGecko `simple/price` call for 30 ids. |

**Do not chase these as three bugs.** All three call CoinGecko, and `markets`, `coin-list`
and `coin-search` succeeded earlier in the same run — the free tier's rate limit trips
partway through a burst of ~8 CoinGecko-backed checks. Re-run after a pause, or configure
`COINGECKO_API_KEY`, and expect all three to clear together. `alerts` is new to this list
only because `news` vacated it, and is **not** a regression: the route hardcodes its
CoinGecko URL, with no provider registry and no `pinnedFetch` involvement.

**Fixed since the morning run:** `news` and `v1 news`, both now REAL — see the verification
note at the top of this file.

> The morning run listed `alerts` as a bare `not ok` with no reason, because ten harness
> checks threw `'not ok'` and threw away the route's own `error` field. All ten now surface
> it (`j.error ?? 'not ok'`). A failure line you cannot act on sends the reader to the wrong
> layer — the same class of problem as a 200 carrying fallback data.

### 🟡 Silent degradation (8) — 200 OK, not the intended source

`ohlcv` btc/xrp/eth (Binance.com geo-blocked → Binance.US, a different venue) ·
`chart` (synthetic OHLC, correctly marked `synthetic: true`) ·
`cbdc-data` (static table; live feed unavailable) ·
`stock-universe` (79 curated names — FMP screener needs a paid plan) ·
`stock-outliers` (66 evaluable names across 7 sectors, inherited) ·
`fund-holdings` SPY (expected — a UIT files no N-PORT).

### 🔑 Unconfigured (3) — honestly reported

`video-search` and `market-calendar` (no YouTube / FMP key) · `fund-holdings-history` for
SPY (no N-PORT series *and* no FMP key).

### ⚪ Empty (1)

`wallet exchange-connections` — 0 configured, which is correct for a fresh install.

> **Overtaken, 2026-09-08.** This run record is left as measured. The surface it
> measured no longer exists: exchange API linking was removed on 2026-08-18 under
> **RP-5** (it stored an apiKey + apiSecret in plaintext at rest — the highest-value
> secret the app held — to power a read-only balance view that watched addresses
> already approximate from public chain data). Both `/live-data/wallet/exchange*`
> routes and `lib/server/exchangeCredentials.ts` are deleted.

### 🐢 Slow (>3s)

`staking-discovery` **21.8s** · `fund-universe` **12.4s** (28,988 funds) ·
`staking-rates` **6.7s** · `defi-tvl` **3.2s**. The first two are the standing
pagination/performance items, and both are marginally slower than the morning run — noise at
this sample size, not a trend.

### What this run could not answer

The four **Macro** routes were not exercised — the harness had no macro group. Coverage was
added 2026-07-29; their rows stay ⬜ **Not measured** until the next run.

---

## Summary by feature

### Crypto — market data
| Feature / Page | Status | Source | Notes |
|----------------|--------|--------|-------|
| Asset prices, market cap, volume, 24h change | 🟢 Live | CoinGecko (`/live-data/markets`) | **78 priced** (2026-09-19). Three different denominators circulate for "how many coins are there" and they are not interchangeable: `assetCatalog.ts` carries **108** catalog entries, `COINGECKO_IDS` maps **80** of them to a CoinGecko id, and the route priced **78** on this run. Metadata from the static catalog — reference data, not fabricated. |
| Asset OHLCV / price charts | 🟡 Partial | **Binance.US** → CoinGecko fallback | Binance.com is 451 here, so candles come from the US mirror — different venue, different prices. `venue` field records which. |
| Coin list / search / discovery | 🟢 Live | CoinGecko | 750 coins, 209 discovery candidates. |
| Fear & Greed Index | 🟢 Live | alternative.me | |
| Funding rates + open interest | 🟢 Live | **OKX** (Binance fapi is 451 here) | 10 instruments. |
| DeFi TVL | 🟢 Live | DefiLlama | 50 protocols. |
| BTC network stats | 🟢 Live | blockchain.info + mempool.space | Height, hashrate, difficulty, mempool. Hashrate **unit is inferred from magnitude** (`lib/server/btcHashrate.ts`), not assumed: the upstream sends GH/s and a hardcoded `/1e12` reported `0 EH/s` while block height advanced normally (fixed 2026-07-29). Returns `null` — rendered as not-available — rather than a figure it cannot justify. A wrong field inside an otherwise healthy payload is the one failure the REAL/FALLBACK split cannot catch. |
| Reserves / collateralization | 🟢 Live | DefiLlama Stablecoins API | 9 stablecoins. Composition breakdown is **approximate / derived** from chain distribution, not issuer attestation. |
| Risk scores | ⚪ **Removed 2026-08-29 (RP-6)** | — | **No per-coin risk score is published anywhere.** Owner: a risk figure on an asset the reader is viewing may be read as a recommendation, which is a regulated activity. `/live-data/risk-scores`, `lib/api/live/riskScores.ts`, `useRiskScoreIndex`, `RiskScoreBadge` and the `Asset.riskScore`/`riskBand` fields are all gone, and `lib/risk/__tests__/riskScoringRemoved.test.ts` guards it. **`lib/risk/` itself stays** — the options Trade Risk Scorer and the macro/equity profiles are separate decisions and remain live. **Staking is no longer among them:** D14 (2026-09-14) deleted `computeOverallRisk()`/`getRiskLevel()` and struck the composite from `/api/v1/staking/opportunities`, `/live-data/staking-discovery` and the MCP server; `scoreStakingProvider()` survives as the canonical engine with **no live consumer**, and only the six raw `riskBreakdown` dimensions are published. |
| Alerts | 🟢 Live | Derived from live market thresholds | Generated from live price/peg movement, not a stored backend. |
| Network fee — Bitcoin | 🟢 Live | mempool.space | Real sat/vByte. |
| Network fees — ETH / BNB / Polygon / AVAX | 🟢 Live | keyless `eth_gasPrice` (publicnode) | Live gas amount × live token price (2026-08-21, `01d6bfe`). |
| Network fees — L2s (Arbitrum, Base, Optimism) | 🟡 Partial | static gas amount × live token price | **Estimate on purpose.** `eth_gasPrice` returns only the L2 execution price and omits the L1 data fee, which is most of what a rollup transaction actually costs — a live-looking number that is wrong by the majority of the total is worse than a labelled estimate. |
| Network fees — non-EVM (Solana, Tron, XRPL, Litecoin, Dogecoin, Cardano, Polkadot, Cosmos, TON, NEAR) | 🟡 Partial | static gas amount × live token price | Gas amount is a **static estimate**; only the price is live. Labeled `estimate`. This is where the remaining work is. |
| Transfer withdrawal fees | 🟡 Partial · 🚫 **page held out of rollout** | static table (`transferFees.ts`) + keyless live overlay (`/live-data/withdraw-fees`) | Hand-maintained, carries `lastVerified` + confidence (high ≤60d / medium ≤120d / low when stale). Stale ⇒ ranking degraded with an explicit caveat. **Live overlay since 2026-08-21** rewrites fees per (exchange, coin, network) for the keyless Tier-1 exchanges — probe 2026-09-19: KuCoin 48, HTX 54, Bitget 42, LBank 52, Bitfinex 14, XT.com 41 rows, all `status: live`; the rest of the table stays static behind the staleness banner. **Poloniex was removed 2026-09-15 on TERMS, not on a probe** — User Agreement §9 licenses the API "solely for the purposes of trading on Poloniex", so the host is now `prohibited` in `sourceTerms.ts`. ⚠ **The route is live but the page is not reachable** — `/transfer-fees` redirects to `/headlines` (`next.config.mjs:60`, owner 2026-08-22). |
| `chart` route | 🟡 Partial | CoinGecko market_chart | **Synthetic OHLC** (zero-range candles) now marked `synthetic: true`. **One consumer, not none:** `/compare` fetches it for every crypto series (`compare/page.tsx:205`, since 2026-07-20) and reads closes only — which is safe, because a zero-range candle's close is the real price. Use `/live-data/ohlcv` for real candles. |

### Crypto — staking, news, social
| Feature / Page | Status | Source | Notes |
|----------------|--------|--------|-------|
| Staking APR — stETH / rETH / mSOL / jitoSOL | 🟢 Live | Lido, Rocket Pool, Marinade, Jito | **jitoSOL was restored 2026-07-20**: the old `/api/v1/apy` endpoint 404s and had silently pinned it to a 7.5% static estimate. Now reads `/api/v1/stake_pool_stats`. **The 7.5 FALLBACK itself was only corrected 2026-09-09** — it survived the endpoint fix by 7 weeks, and measured 4.86 against it (54% high, not the 41% recorded here). It was one of 22 of 27 measured fallbacks that were ≥25% overstated; see the FALLBACK header comment in **`lib/server/stakingRates.ts`** — the collector moved there with #205 (landed 2026-09-19) so `/api/v1/staking/opportunities` reads the same rates, sources and gaps instead of its own broken fetcher, leaving `staking-rates/route.ts` a 14-line HTTP face. |
| Staking APR — all other providers | 🟡 Partial | 7 live upstreams + static estimates | **27 of 51 live, 24 estimated** (re-measured 2026-09-09, owner's machine; was 4/51). The 4/51 was never a catalog-size problem: four dead hosts were hanging DNS ~10s each on libuv's 4-thread resolver pool, starving the route's shared 6s budget so healthy upstreams aborted without ever opening a socket (#157–#165). All 7 remaining upstreams are live and `defillama-yields` is 19/19 (re-confirmed 2026-09-19). Each estimate still carries `sources[key] = 'estimate'`; the 24 unmeasured FALLBACK values are flagged in `fallbackProvenance`. **Since #203 a measured fallback older than 14 days is WITHHELD, not published** — the key is deleted from `rates` and reported as `gaps[key] = 'estimate-expired'`, so the v1 route and the staking page each fall through to their own "no live number" path instead of each deciding. It bites only when an upstream has also failed, and with `FALLBACK_MEASURED_ON = '2026-09-18'` nothing is expired today. The 24 undated keys are out of the gate's scope by design and each reports **why** in `gaps` — measured 2026-09-19: `no-upstream` 14, `derived-estimate` 5, `curated-estimate` 3, `needs-api-key` 2. ⚠ The module comment at `stakingRates.ts:225-229` says all 24 report `curated-estimate`; the route does not, and **that comment is wrong**. |
| Staking discovery | 🟢 Live | DefiLlama — **Yearn / Pendle / Beefy contribute 0** | **DefiLlama is the only source that lands a pool, and the count is not stable:** three consecutive probes on 2026-09-19 returned 0, 0 and 94 pools, `sources` = `{defillama: N, yearn: 0, pendle: 0, beefy: 0}` every time (audit 09-19: 94; 09-18: 90). `api.yearn.finance` does not resolve, the Pendle markets endpoint 404s on the exact URL the route sends, and Beefy answers 200 yet lands no pool. `allSettled` substitutes `[]` per rejection, so `ok: true` is returned either way; the one mitigation is a last-good cache (`route.ts:463-468`) re-serving the previous payload for the same filter key marked `stale: true` — when it is cold or past TTL the answer is **0 pools from all four sources, `ok: true`, and no stale flag**. **No longer slow: 2.2 s in the audit, 7.6–9.6 s on re-probe** (was ~18 s). |
| News + sentiment + categories | 🟢 Live | 4 keyless publisher RSS feeds + optional keyed providers | **Verified 2026-07-29 (evening): 10 articles from 4 providers; `v1 news` 5 articles.** The outage earlier that day was **structural, not a feed failure**: every built-in crypto news provider required an API key, and CryptoPanic's free tier — the one carrying this — ended April 2026. With no key saved all four resolved to `disabled`, so the route found zero providers and returned `ok:false`, which `/api/v1/news` reported as "all news providers failed upstream" — blaming the upstream for a config state. Fixed by adding keyless RSS built-ins (CoinDesk, Cointelegraph, Decrypt, Bitcoin Magazine), matching what equities and macro already had, so the feed has a default that needs no key. Articles use `headline` (not `title`); sentiment/category are heuristic classifiers (labeled derived). |
| Social sentiment (crypto) | 🔑 Key-gated _(was 🟡 Partial, pre-2026-08-29 terms review)_ | Reddit **Atom/RSS** — withheld without `REDDIT_CLIENT_ID` | **Reddit is gated off, not rate-limited:** since the 2026-08-29 terms review `pinnedFetch` honours reddit.com's robots.txt, which disallows this app's agent, so the route returns 0 signals and `withheld: [{ id: 'reddit', … }]` carrying the OAuth instruction (`social/route.ts:166`; audit 2026-09-19 UNCONFIGURED, every provider withheld). The JSON API also 403s server-side and the `.rss` feeds 429 (a per-IP rate window), but **neither is what stops it today**. **Live vs derived, stated 2026-09-08 (code reading, not a re-measurement):** LIVE — post title/body/link/author/timestamp from the Atom feed, plus `mentionsCount` (Santiment) and `social_volume_24h`/`galaxy_score` (LunarCrush), both **key-gated**, so with no key those signals are ABSENT rather than zero. DERIVED — every sentiment label, all computed in `social/route.ts`: Reddit's from a keyword regex over the post text, LunarCrush's from a galaxy-score threshold (≥60 / ≤35) rather than the provider's own `sentiment` field, Santiment's hardcoded `neutral`. The per-asset `sentimentScore` counts those derived labels, so it is derived twice over. NEITHER — Reddit `score` is a literal `0` and `upvoteRatio` is never set, because Atom carries no vote data; both pages render those badges only when present, so nothing shows rather than a fake zero. |
| Videos | 🟢 Live | RSS | 60 videos. |
| Video search / analyze | 🔑 Key-gated | YouTube Data API | Reports `configured: false`; returns empty rather than fabricating. |

### Crypto — portfolio & wallets
| Feature / Page | Status | Source | Notes |
|----------------|--------|--------|-------|
| Portfolio prices | 🟢 Live | CoinGecko | `source: live \| partial \| error`. |
| Portfolio history | 🟢 Live | CoinGecko history | **Recovered.** REAL in both the 2026-09-18 and 2026-09-19 audits (`source=live`) and on a direct probe 2026-09-19 — `?ids=bitcoin,ethereum&date=2026-06-01` priced 2/2. The 2026-09-09 and 2026-09-10 FAILs were CoinGecko 429s on the upstream call, recorded with `retry-after=7` and `retry-after=18`; the 2026-07-29 `source=error` was **never diagnosed further than "not the handler"** and no status code was captured for it, so it is left as an undiagnosed failure rather than retro-labelled a 429. Missing params still correctly return HTTP 400. |
| Wallet — BTC / ETH / SOL / TRON / XRP | 🟢 Live | Public explorers + JSON-RPC | **ETH/EVM fixed 2026-07-20:** was hard-502ing on Ethereum and Polygon because each chain had a single RPC and `cloudflare-eth.com` / `polygon-rpc.com` both broke. Now walks a fallback ladder and reports the serving endpoint in `rpc`. All 7 EVM chains verified. |
| Exchange connections | ⚪ **Removed 2026-08-18 (RP-5)** | — | Exchange API-key linking was withdrawn on security grounds: plaintext `apiKey`/`apiSecret` at rest for a read-only balance view that watched addresses already approximate. Routes and credential store deleted — `lib/server/exchangeCredentials.ts` is gone and `live-data/wallet/exchange/` and `…/exchange-connections/` are empty directories (audit 2026-09-19: REAL, "correctly gone"). ⚠ **The v2 store migration that scrubbed persisted `exchanges` no longer runs:** it was added 2026-08-18 (`24ee839`) and removed the next day by NT3 (`6ae77dc`), which moved wallets to Postgres and took the whole `persist` wrapper with it. Nothing reads the field today — the one-time legacy import reads only `watched`/`connected` before renaming `fn:wallets` to `fn:wallets:imported` (`useWalletStore.ts:204`) — so a stale key preview cannot resurface, but in a browser that never loaded the app during that one-day window it is **archived rather than dropped**. Secrets were always server-side in the gitignored `.exchange-credentials.json`, which no migration ever touched; deleting it remains an operator action. Do not reintroduce without a decision reversing RP-5. |
| Pump report metrics | 🟢 Live | derived | 20 metrics. `scan`/`investigate`/`chat` are POST-only (405 on GET is correct). |

### Equities module
| Feature / Page | Status | Source | Notes |
|----------------|--------|--------|-------|
| Quotes | 🟡 Key-gated _(was 🟢, pre-2026-08-06 measurement)_ | ladder: FMP → Finnhub → Twelve Data → Tiingo → Alpha Vantage → catalog | **Every live rung needs a key** since Yahoo was removed. With none configured, stocks and funds render catalog reference prices behind an amber `ref` tag and macro instruments render a dash. **Stooq was removed earlier** (2026-07-28) — 404s on every variant. |
| OHLCV / TA / backtests | 🟢 Live 🔑 _(Tiingo key added 2026-09-19)_ | Tiingo → FMP | Both rungs keyed. Serving `source=tiingo` — 135 candles, AAPL 6M (2026-09-19); FMP served it on 09-18. Unkeyed it still reports `source: 'none'` and the surfaces show their no-live-source state rather than synthetic candles. |
| Price chart | 🟢 Live 🔑 _(Tiingo key added 2026-09-19)_ | Tiingo → FMP → **Twelve Data** (#202) | Close-only by design. Serving `source=tiingo basis=adjusted` (2026-09-19). **`basis: adjusted \| unadjusted` now travels with every chart** — only Tiingo is adjusted; FMP and Twelve Data serve raw closes, so the basis is **named rather than assumed** and a split no longer silently disagrees between rungs. **Takes range vocab `6mo`, unlike its sibling `security-ohlcv` (`6M`)** — mismatched vocab returns 400. |
| Trailing returns | 🟢 Live 🔑 _(Tiingo key added 2026-09-19; was dark, `source=none`, on 09-18)_ | Tiingo — **its only source, no fallback rung** | One request per symbol, so `?universe=` is **refused** rather than truncated, and `?symbols=` is capped at 60. Fund return screening/sorting stays disabled; per-page Returns columns are live. ⚠ Single-sourced: under D21 this is the one surface with no second vendor at all (see `coverage-matrix-2026-09-19.md`). |
| Stock Registry universe | 🟡 Partial | **curated catalog fallback** | FMP `company-screener` is **PAID-only**; without it the registry is 79 hand-maintained names. P/E backfill from SEC XBRL frames only runs on the FMP path. |
| Equity screener / outliers | 🟡 Partial | derived from the above | Screens 66 evaluable names across 7 sectors — inherits the catalog's narrowness. Backs the `equity-screener` agent. |
| Market news | 🟡 Partial _(was 🟢)_ | MarketWatch / CNBC RSS | Keyless and unaffected in themselves. What went is the **per-ticker** feed — Yahoo's was the only free one — so symbol news is now these general wires filtered to articles that actually name the company. An empty result for a symbol is the honest answer, not a fault. |
| Stock social | 🟡 Partial | StockTwits + **Reddit (fixed 2026-07-20)** | Reddit was calling the `.json` API, which **403s 100% of the time server-side** — a permanently dead provider that looked like a quiet feed. Switched to the `.rss` Atom feeds already proven in the crypto route. **Starvation fixed 2026-07-22** (`lib/server/socialBlend.ts`, unit-tested): merging by recency let StockTwits — minutes old, against Reddit's hours — fill every slot at `limit ≤ 30`. The blend now allocates the budget round-robin across providers and orders the winners by recency, so the slower source keeps its share. **Separately, since the 2026-08-29 terms review, reddit.com is gated off** — its robots.txt disallows this app's agent — unless `REDDIT_CLIENT_ID` is set, enforced in `pinnedFetch`. So expect StockTwits-only in server/CI environments, by policy rather than by bug. |
| SEC filings | 🟢 Live | SEC EDGAR | Keyless. |
| Company fundamentals / ratios | 🟢 Live | SEC EDGAR XBRL | AAPL rev $416B, net margin 26.9% — sanity-checked. |
| Company profile | 🟢 Live | SEC EDGAR + Wikipedia | |
| Market calendar | 🟡 Partial 🔑 | FMP | `configured: true` — earnings live (3 upcoming, 2026-09-19). The economic calendar is a **paid** FMP endpoint (402 on free), so `economic` is always empty here. Deferred under D21, not chased. |
| IPO calendar | 🟢 Live 🔑 | Alpha Vantage `IPO_CALENDAR` | `configured: true`, `source=alpha-vantage`, 2 upcoming listings (2026-09-19). Fixed in #205: it sent `Accept: text/csv`, which this endpoint **406s** while answering `*/*` with that very CSV — so T-384 read as "needs a key" for weeks when a key would never have helped. One rung deep on purpose; the 25 req/day free tier is a terms condition, hence the 6 h revalidate. **Live-probe evidence only — the harness has no IPO check.** |

### ETFs & Funds module
| Feature / Page | Status | Source | Notes |
|----------------|--------|--------|-------|
| Fund universe | 🟢 Live | SEC + providers | 126 catalog + **29,009 discovered** (5,593 ETFs, 23,416 mutual). **Slow: ~12 s** — but the 2026-07-30 slimming (action item 11) is now measured: **2.27 MB, down from 14 MB** (2026-09-19). |
| Fund holdings | 🟢 Live | SEC N-PORT (keyless, authoritative) | Verified full books: **VOO 513** (re-probed 2026-09-19 — this row said 511, disagreeing with both the audit and the measured table earlier in this file), IVV 507, VTI 1500, QQQ 101, ARKK 46. |
| Fund holdings — UITs | 🟡 Partial | catalog | **SPY, and UITs generally, file no N-PORT**, so they correctly fall back to indicative top holdings. Not a bug. |
| Fund holdings history | 🟡 Partial | SEC N-PORT diff → FMP | `configured: true` — the FMP key is held. Works only where an N-PORT series exists; a fund without one (SPY) returns `periods: []` and says so rather than emptying silently. |

### Macro Markets module
Shipped 2026-07-21 and **measured for the first time on 2026-07-29 (evening run)**. The harness
had no macro checks until that day, so these rows sat ⬜ Not measured for eight days while the
routes were in production — the doc gap and the harness gap were the same gap. **Five checks now
cover the module**, and the shared quote path is observed too since action item 18 added it —
🔑 UNCONFIGURED on 2026-09-09, on the 2026-09-10 re-run, and on both the 09-18 and 09-19 audits.
(The 2026-09-12 two-egress run reported only REAL/FALLBACK/FAIL counts and never itemised
UNCONFIGURED, so it is not evidence either way for these rows.)

| Feature / Page | Status | Source (measured) | Notes |
|----------------|--------|-------------------|-------|
| Macro news | 🟢 Live | 8 keyless RSS feeds (Investing.com ×3, OilPrice, FXStreet, MarketWatch, CNBC ×2) | `macro-news` — **20 articles across 3 pillars** (commodities, bonds, currencies) in 1.7s. Content-first pillar classifier; 14-day staleness cutoff. Note only 3 of 4 pillars were represented in this sample; the balanced merge caps each at ¼ of slots, so an empty pillar means that feed set returned nothing in-window, not that classification failed. Several of these publishers bot-block elsewhere in this report — expect per-feed variance by IP. |
| FX rates — official tier | 🟢 Live | ECB daily reference via frankfurter.dev (keyless) | `fx-rates` — **30 currencies**, `date=2026-07-29`, `source=frankfurter-ecb`. Confirms the 30-currency set is ECB's complete published list, not a subset. |
| FX rates — extended tier | 🟢 Live | community `fawazahmed0/currency-api` (keyless) | `fx-rates-extended` — **126 of 126 allowlisted currencies priced, `missing: []`** (2026-09-19; REAL on the 09-18 run too). KPW and SYP became quotable upstream, so the "permanent FALLBACK" expected here on 2026-09-08 has **lapsed**. The reasoning behind that decision still stands for the next code that goes unquoted, and is worth keeping: a currency nobody quotes stays in the allowlist and reports no rate, because dropping it would make the harness report REAL while the route behaved identically — optimising the measurement rather than the thing measured. A user who picks KPW learns that nobody quotes it; a user who cannot find KPW learns nothing. Labeled community-sourced in the UI, never blended with the ECB tier unattributed. |
| Treasury yield curve | 🟢 Live | treasury.gov daily par curve XML (keyless) | `treasury-yield-curve` — **13 maturities**, 2s10s=+0.25, 3m10y=+0.87, `shape=flat` (read on the 2026-09-19 run; par curve dated 09-18). Both spreads still positive and the curve un-inverted. Against the 2026-07-29 read the **2s10s has more than halved** (+0.45 → +0.25) while 3m10y barely moved (+0.84 → +0.87): the 2Y now sits ~62bp above the 3M, so **the flattening is in the 2y–10y belly, not at the front**, which if anything steepened. ⚠ `shape` is derived from **2s10s alone** (`treasuryCurve.ts:126`: >0.25 normal, <-0.1 inverted, else flat), so the 09-18 run's `normal` at 0.27 became `flat` at 0.25 on a **0.02 move across a threshold** — not on a change in the curve's character. 4h revalidate. |
| Commodity / currency / rate quotes | 🔑 Key-gated _(measured 2026-09-09, 09-18 and 09-19 — 🔑 UNCONFIGURED on all three)_ | existing `security-quotes` ladder | **The surface the Yahoo removal hit hardest, and the one this round of keys did not fix.** `GC=F` / `EURUSD=X` / `ZN=F` were quoted keylessly; with FMP, Finnhub, Twelve Data, Tiingo and Alpha Vantage keys all held, the ladder still answers `source=reference`, `quotes: {}`, all three missing. What the run actually recorded (`provider-config-2026-09-19.json`, one fan-out at `18:36:58–59Z`) is **two different failures**: FMP answered **402**, so its quote endpoint for these is a paid plan rather than an absent capability, while Finnhub, Twelve Data, Tiingo and Alpha Vantage each "returned no quotes" for these symbol forms. So what is open is **a paid FMP plan or a symbol-mapping fix**, and nothing measured yet distinguishes them — **do not write "no keyed rung carries them" until something does.** Tiingo genuinely carries no futures or FX at all. Unpriced renders a dash; the catalogs carry no reference prices by design. Sharing the ladder never meant sharing its coverage. |
| Futures term structure (forward curve) | 🔴 Not available _(was 🟢, P2-O4)_ | — | Dated contract months (`CLZ26.NYM`) had exactly one reachable source and it was Yahoo. FMP/Tiingo/Finnhub/Twelve Data/Alpha Vantage carry continuous front-months at best; exchange settlement files are licensed. `/live-data/futures-curve` still resolves the months and returns `ok:false` with the reason, and `TermStructureCard` prints it — the section says why rather than vanishing. Front-month prices are unaffected. |
| CUSIP-level bond quotes | 🔴 Not available | — | Licensed data. Intentionally absent and stated on-page; this row needs no measurement. |

### Not available
| Feature | Status | Notes |
|---------|--------|-------|
| TA — liquidation heatmap / OI depth / exchange flows | 🔴 Not available | Coinglass/Glassnode are paid. Shown as explicit "not available (paid feed)" rows. |
| TA — event markers (unlocks, CPI/FOMC) | ⚪ **Removed 2026-07-01 (`94b26d6`)** | The news overlay was **cut, not shipped**: the feed returns ~40 articles all from the last ~24h, so on a multi-month range every marker collapsed at the chart's right edge. Nothing plots events on the TA chart now — only `PriceHistoryChart`'s static `NOTABLE_EVENTS` annotations remain (reference data, listed below). Token unlocks and macro prints still need a paid calendar. |
| Peg deviation history | ⚪ **Removed 2026-09-14 (D11/CR6)** | No free historical peg series, so `PegDeviationChart` went with the rest of the permanently-null `analyticsBundle` arm rather than stay as an empty card. The **current** peg deviation is still live on the asset tables. |
| Per-row price sparklines | ⚪ **Removed 2026-09-14 (D11/CR3)** | No free per-asset trend source at list scale. The `/assets` 30d column was a hardcoded "n/a" and was cut with `Sparkline.tsx` — a permanent placeholder reads as a temporary gap. |
| Reports (AUM, risk tables) | ⚪ **Removed 2026-07-01 (`99e81ef`)** | The notice was real while the section lasted — the commit calls it "a permanent 'not available' placeholder" — and the page carrying it was deleted along with its sidebar nav item. There is no `/reports` route today, so nothing renders the notice. Fund AUM still renders on the funds pages from curated `fundCatalog` snapshots. |
| Backtests (crypto) | 🔴 Not available | Requires a backtesting backend; not present. ⚠ **The equity strategy backtests are no longer a counter-example:** `/equities/backtests` has redirected to `/equities` since 2026-08-20 (`next.config.mjs:101`, owner: *"hide the back testing tool … I may revisit"*). The engines, panels and tests are retained in place and would work off live `security-ohlcv` — which is now keyed and serving — but **no user can reach the page**. Availability and reachability are different questions; see the note below this table. |
| `/live-data/tier` | 🔴 **Route does not exist** | The directory is empty and nothing references the path — tier data is client-side (`src/lib/tier.ts`). Listed in older inventories in error. *(Re-checked 2026-09-19 — still true.)* |
| CBDC tracker / `/global-adoption` | ⚪ **Removed 2026-09-14 (D10)** | Page, `/live-data/cbdc-data` and `cbdcProvenance` deleted: a real CBDC tracker needs a feed that does not exist keyless, and what shipped was a static table under a live timestamp. `/global-adoption` still redirects to `/headlines` so bookmarks land. The CBDC **asset type** on `/assets` is untouched. |
| On-chain analytics panels (liquidity depth, wallet concentration, velocity) | ⚪ **Removed 2026-09-14 (D11/CR6)** | `overlay.ts` hardcoded `analyticsBundle: null` for every asset, so all four panels had **never once rendered**. Deleted with their types rather than kept as an unreachable branch. |

### ⚠ Reachability is not availability

This document tracks whether a **route** is live. It has never tracked whether a **user
can get to the surface that route feeds**, and since 2026-08-20/22 those two answers have
diverged for three shipped features. Every route below is 🟢 and every page below is dark:

| Surface | Route status | Page | Since |
|---|---|---|---|
| Transfer Fees | 🟢 `/live-data/withdraw-fees` + static table | `/transfer-fees` → `/headlines` (`next.config.mjs:60`) | 2026-08-22 (owner) |
| Wallets | 🟢 `/live-data/wallet/*`, all 7 EVM chains | `/wallets` → `/headlines` (`next.config.mjs:66`) | 2026-08-22 (owner) |
| Equity Strategy Backtests | 🟢 `/live-data/security-ohlcv` (Tiingo, keyed 09-19) | `/equities/backtests` → `/equities` (`next.config.mjs:101`) | 2026-08-20 (owner) |

All three are **held out of the rollout, not broken** — engines, routes and tests are
retained deliberately so each is a redirect-deletion away from returning. `/api/v1/transfer/routes`
answers **503** to match, and the `find_transfer_routes` MCP tool is commented out.
`/pump-report` was promoted to its own page on 2026-08-22 precisely because it was a tab
on `/wallets` and went dark with it, purely for want of a route of its own.

The distinction matters to this file's opening promise — that "a walk-through of the app
surfaces exactly what is and is not backed by real data". A walk-through today cannot
reach these three at all, so no amount of route-level green says anything about them.

---

## Reference data (legitimately static — NOT mock)

Not real-time and not fabricated; stable reference facts that belong in the app as static data:

- **Asset metadata catalog** — id, symbol, name, asset type, blockchain, contract address, issuer, description, website, whitepaper, peg target. (`lib/data/assetCatalog.ts`)
- **News categories** — the fixed taxonomy of category labels. (`lib/data/newsCategories.ts`)
- **Asset launch dates & notable historical events** — chart annotations. (`lib/data/priceHistoryMeta.ts`)
- **Network / address-format reference** — chains, address formats, examples, plus the curated exchange withdraw-fee and spot-fee tables. 🟡 Fee rows are **not purely static** — `lib/server/withdrawFeeOverlay.ts` overlays live per-hop fees through the `LiveFeeOverrideMap` exported here. (`lib/data/transferFees.ts`)
- **Staking provider risk profiles + reference APRs** — the six qualitative risk dimensions per provider (they survive: D14/RP-6 struck only the *composite* score — see the note at `stakingProviders.ts:184-200`), plus lock-ups, minimums, TVL, audit counts and **188 `staticApr` fallback APRs**. 🟡 Like the equity/fund catalogs below, those APRs double as the **fallback** path for `staking-rates`, which is where the silent-degradation risk comes from — see that route's row above, and #203's 14-day expiry (`FALLBACK_STALE_AFTER_DAYS`, `lib/server/stakingRates.ts:238`). ⏳ Table compiled `2026-06-28`; `STAKING_DATA_STALE_AFTER_DAYS = 90` drops it to **low confidence on 2026-09-26**. (`lib/data/stakingProviders.ts`)
- **Equity / fund catalogs** — `equityCatalog.ts` (**79**), `fundCatalog.ts` (**126** — counted 2026-09-19; the "~55" here predated the catalog's growth, and action item 11 below says 118, which was also wrong). Legitimate reference data, but note they double as the **fallback** path for `stock-universe` and `fund-holdings`, which is where the silent-degradation risk comes from.

---

## Route conventions audit

Project convention (CLAUDE.md): every `/live-data` route needs `export const dynamic = 'force-dynamic'`,
`next: { revalidate: N }` on each fetch, and a **failure boundary that preserves partial
results** on any multi-fetch. (CLAUDE.md dropped the blunter "`Promise.allSettled` for any
multi-fetch" wording in `23654fc`, 2026-07-22 — it adopted the conclusion reached below.)

- ✅ **`force-dynamic`** — all **58** route files comply (`chart` was the sole exception; fixed 2026-07-20).
  Count and compliance re-verified **statically** on 2026-09-19 (`git ls-files 'src/app/live-data/**/route.ts'`
  vs `grep -l "export const dynamic"`, 58/58). This one line needs no running server, so it is current
  even though the availability statuses above are not. The count moved 56 → 58 as routes landed; ⚪ `cbdc-data`
  is **not** among them — the route was cut 2026-09-14 (D10) and only an empty untracked directory remains.
- 🟡 **`revalidate`** — present on every outbound fetch in **57 of the 58** routes that fetch.
  The exception is `config`: of its **17** probe fetches only one carries `next: { revalidate }`
  (`config/route.ts:336`, the Tiingo probe, `revalidate: 0`, spelled out for a licence reason);
  the other 16 pass no `next` option at all. That is **deliberate, not a regression** — the probes are
  key-liveness tests that must never be cached, and `export const dynamic = 'force-dynamic'` already
  leaves them uncached — but the convention is met there by Next's default rather than by the call
  sites. Re-checked **per call site** on 2026-09-19 (87 fetch sites across 58 routes). The blanket ✅
  that stood here came from a **file-level** grep, which passes `config` on that single line 336.
- ✅ **`Promise.allSettled`** — resolved 2026-07-22. The earlier flag listed 8 routes found by grepping for
  multi-fetch without `allSettled`; reading them showed **7 were already correct and 1 had a real bug that
  `allSettled` would not have fixed**:
  - `markets`, `portfolio-prices`, ⚪ `cbdc-data` (route cut 2026-09-14, D10) — deliberate **sequential fallback ladders** (try provider A,
    fall back to B, then C), each leg try/caught. `allSettled` would be actively **wrong** here: it fires every
    provider in parallel, burning rate limit on calls the ladder exists to avoid.
  - `company-profile` — `Promise.all([SEC, wiki])` is safe because `fetchWikiSummary` is fail-silent (returns
    `null`). Only the SEC leg can reject, and that *should* fail the route: it is the primary data.
  - `stock-universe` — already has an explicit inner boundary so a SEC hiccup costs the P/E column, not the
    response. ⚪ `wallet/exchange` (deleted 2026-08-18, RP-5) and `config` are **not multi-fetch at all** — one exchange / one provider test
    per request, each try/caught.
  - `sec-filings` — **the one genuine bug.** Its archive-page walk is sequential by design (it stops as soon as
    `limit` is satisfied, so parallel fetching would request pages nobody asked for). A non-`ok` response broke
    the loop gracefully, but a *thrown* fetch propagated to the outer handler and **503'd the whole route,
    discarding the filings already collected from `recent`**. Now per-page try/catch: partial results return with
    `hasMore: true`. Verified by fault injection — old code 503 / 0 filings, new code 200 / 11 filings.

  Conclusion (**adopted into CLAUDE.md on 2026-07-22, `23654fc`** — see its "Resilient multi-fetch" pattern
  note): the convention as originally stated ("`Promise.allSettled` for any multi-fetch") was too blunt. A sequential
  fallback ladder is a multi-fetch that must *not* be parallelised. What every multi-fetch actually needs is a
  **failure boundary that preserves partial results** — sometimes `allSettled`, sometimes try/catch per leg.

---

## Performance outliers

| Route | Latency | Note |
|-------|---------|------|
| `staking-discovery` | **~2.2 s** (re-measured 2026-09-19; was ~18 s) | 4 upstreams (DefiLlama, Yearn, Pendle, Beefy) — **bounded 2026-09-08.** The fan-out is parallel, so the response was gated by the slowest leg, and with no timeout "slowest" had no upper bound. Each upstream now gets a 6 s budget, and a TIMEOUT is not retried — the retry exists for upstreams that throw and immediately succeed, whereas retrying a slow one buys the same answer for twice the wait. The fan-out is `allSettled`, so a timed-out leg drops its pools and the other three still serve. **The bound held and is now measured:** 2,238 ms for 94 pools in `docs/audits/live-data-audit-2026-09-19.json`, though direct re-probes the same day ran 7.6–9.6 s. |
| `fund-universe` | ~13 s / **2.27 MB** | 126 catalog + 29,009 discovered entries in one payload — the 2026-07-30 slimming (action item 11) is **now measured**: 14 MB → 2,274,590 bytes on a 2026-09-19 probe, an 84% cut. First-fetch latency is upstream directory latency, 24 h-cached after, and is untouched |
| `staking-rates` | ~3.9 s | **7** parallel upstreams with a 6 s per-fetch timeout — the collector moved to `lib/server/stakingRates.ts` (#205) and both surfaces read it; 27/51 APRs live on 2026-09-19. ⚠ The old **18** figure still survives in `lib/data/dataSources.ts`, where it is wrong too |
| `stock-social` | ~0.8 s | **StockTwits only** — Reddit's robots.txt gates the RSS legs off (needs 🔑 `REDDIT_CLIENT_ID`), so the 429 path is no longer walked at all; 30 signals, all StockTwits, on 2026-09-19 |

---

## Refresh intervals (free tier)

CoinGecko's keyless tier is advertised at **~30 calls/minute** — the figure this repo repeats in
`lib/api/live/providers.ts` (`freeTierLabel`), `coin-discovery/page.tsx`, `coin-profile/route.ts`
and `cmcProfiles.ts` — but it is a **provider label, not a reading**: a 429 body states
`retry-after=7`, the phrase "You've exceeded the Rate Limit" and a pricing link, and nothing
numeric (item 17b).

In-app polling therefore sits at **30–60 s behind a server-side `revalidate`**, not at a
per-client rate. The audit harness, which **bursts rather than polls**, paces itself far below the
label — `AUDIT_CG_PER_MIN`, default 10, with the minimum gap derived as `window / cap` — precisely
because the real allowance is unread. The 2026-09-19 run sustained that 10/min with **no CoinGecko
429 at all**, so 10/min is a self-imposed floor and says nothing about where the upstream limit sits.

| Surface | Endpoint | Refresh interval | Stale after |
|---------|----------|-----------------|-------------|
| Technical Analysis — screener prices | `/live-data/markets` | 60 s | 60 s |
| _(same endpoint, different consumer — see the note under this table)_ | | | |
| Technical Analysis — chart (1H range) | `/live-data/ohlcv` | on demand | 60 s |
| Technical Analysis — chart (4H / 1M) | `/live-data/ohlcv` | on demand | 5 min |
| Technical Analysis — chart (3M / 6M / YTD / 1Y) | `/live-data/ohlcv` | on demand | 15 min |
| Technical Analysis — chart (3Y / 5Y / 10Y / MAX / BT) | `/live-data/ohlcv` | on demand | 1 h |
| Asset prices / market data | `/live-data/markets` | 30 s | 30 s |
| Network fees | `/live-data/network-fees` | on demand | 5 min |
| Staking APRs | `/live-data/staking-rates` | on demand | 5 min |
| News | `/live-data/news` | on demand | 5 min — keyless RSS built-ins; keyed built-ins 2 min; custom providers **uncached** (`pinnedFetch` bypasses Next's cache). There has never been a 60 s cache here |
| Equity price history — Tiingo rung | `security-chart`, `security-ohlcv`, `security-returns` | on demand | **never cached** — Tiingo ToS §1.6(a) forbids durable storage, so `revalidate: 0` at every call site |
| Equity price history — FMP / Twelve Data rungs | `/live-data/security-chart` | on demand | 5 min |
| Equity candles — FMP rung | `/live-data/security-ohlcv` | on demand | 5 min (1M) / 15 min (3M–1Y) / 1 h (5Y, MAX) — per-range `RANGE_CONFIG`, **not a flat 5 min**, and there is no Twelve Data rung on this route |
| Equity returns | `/live-data/security-returns` | on demand | **never cached** — Tiingo is its only source (`source: 'tiingo' \| 'none'`), so there is no cached rung to fall to |
| IPO calendar | `/live-data/ipo-calendar` | on demand | 6 h — Alpha Vantage's 25/day free tier is a **terms condition**, not just a quota. Do not lower it |

> The chart price display is derived from the last candle's close — it updates whenever
> OHLCV refetches, not on a separate price tick.
>
> ⚠ **`/live-data/markets` appears twice in the table above, at 60 s and at 30 s, and both
> are right.** They are two consumers of one endpoint, not a contradiction: the TA screener
> polls at 60 s while the asset tables poll at 30 s (`useMarketData.ts`), behind a route cache
> that is itself 60 s / 30 s (`markets/route.ts`). The column says *how often a surface asks*,
> not *how often the upstream is hit* — which is the distinction that makes a shared endpoint
> legible at all.

---

## Action items tracked from this report

1. ✅ Classify every surface (this document).
2. ✅ Remove all mock generators; relocate legitimate reference data out of `lib/api/mock/`. There is no mock/demo data path.
3. ⚪ ~~Reports page confirmed to show "not available" (no live-mode mock leak).~~ **Overtaken:
   the page was deleted on 2026-07-01 (`99e81ef`)**, three weeks before this item was written,
   as "a permanent 'not available' placeholder". The notice was real; there is no longer a page
   to render it. Nothing to verify here again.
4. ✅ De-duplicate network-fee logic into one source of truth (`lib/data/networkFees.ts`), consumed by both layers. Verified identical at runtime + by the audit's cross-layer checks.
5. ✅ Provenance primitive (`DataBadge`) wired into the transfer-fees page; fees carry `lastVerified` + staleness warning. ⚠ **That page has been held out of the rollout since 2026-08-22** (`/transfer-fees` → `/headlines`), so the provenance work is done and correct but currently unreachable — see "Reachability is not availability" above. The primitive itself is reused elsewhere and is not idle.
6. ✅ Network fee-feed built (`FeeProvider` + `FEE_PROVIDERS`). **Live EVM gas landed in `01d6bfe` (2026-08-21)** — **5 of 18 networks 🟢** (BTC via mempool.space, plus ETH/BNB/Polygon/AVAX via keyless `publicnode eth_gasPrice`). The remaining **13 stay 🟡 estimates, and only three of them are L2s** (Arbitrum, Base, Optimism) — the other ten are non-EVM chains. For those three the estimate is deliberate: `eth_gasPrice` omits their L1 data fee, which is most of the real cost. So the remaining work is the ten non-EVM chains, not the L2s. (This said "the 13 L2s" until 2026-09-22, naming the wrong remaining work in the same breath as the right one — a reader taking the first half plans an L2 data-fee project for ten chains that do not have one.) This item read "live EVM gas remains the next step" for four weeks after that step had been taken.
7. ✅ **Audit harness classifies real vs fallback data** (`npm run audit`). Replaces the old pass/fail smoke test, which reported 43/43 green while two routes served static catalogs.
8. ✅ Surface data provenance in-app. Done — a canonical registry (`src/lib/data/dataSources.ts`) now powers the
   **/data-sources** page (in-app catalog), per-page `<SourceLine/>` badges, and the generated
   [`DATA-SOURCES.md`](./DATA-SOURCES.md). `npm run data-sources -- --verify` fails if a route fetches a host the
   registry doesn't name, so the docs/app can't silently drift from the code.
9. ⏳ **Get a paid FMP plan or a different universe source** — `stock-universe` and `stock-outliers` are the largest remaining fallback surface.
   ⚠ **Deferred by owner decision D21 (2026-09-18) — not outstanding work.** *"Any action that required a decision around a paid service can be deferred until closer to the end of production."* A surface blocked only by a paid tier is **sequencing**, and its correct state is the honest fallback it already shows, so nothing here should be chased before late production. What D21 *does* ask for is measured and already recorded: `stock-universe` is one of the four single-sourced surfaces in the decision's own table, with the ~79-name curated catalog as its keyless fallback. The ⏳ is still right — it is genuinely open — but read `docs/decisions/2026-09-18-owner-decisions.md:7-38` before acting on it, or you will re-prepare work already decided against.
10. ✅ ~~**Fix Reddit starvation in `stock-social`**~~ Done 2026-07-22 — `lib/server/socialBlend.ts` allocates the
    response budget round-robin per provider (newest-first within each), then re-sorts by recency for display, so
    the feed still reads chronologically. Unused share flows to other providers, so one active source still fills
    the limit. Measured before → after at `limit=20`: **20/0 → 10/10** StockTwits/Reddit; at `limit=40`: 30/10 →
    20/20. `providers` now lists only sources that actually placed a signal in the response — previously it named
    Reddit at limit=20 while showing zero Reddit posts, which is what hid the starvation. 7 unit tests.
    ⚠ **The 10/10 split is the 2026-07-22 measurement, not today's.** Since the 2026-08-29 robots
    gate Reddit is withheld unless `REDDIT_CLIENT_ID` is set, so `limit=20` now returns 20/0
    StockTwits — the same shape as the starvation this item fixed, but **declared** in `providers`
    and in the gap reason rather than hidden. The blend logic is unchanged and still correct.
    ⚠ Separately: the `/equities/social` **page** currently never issues its query (stuck on "Fetching social
    signals…" while the app reports Offline/DISCONNECTED). Pre-existing and unrelated — the route and a direct
    fetch from that page both work; tracked separately.
11. ✅ ~~Paginate `fund-universe` — 14 MB in one response.~~ **Payload fix shipped 2026-07-30;
    re-measured 2026-09-19 at 2.27 MB — an 84% cut.** Not pagination — that would have broken FundsClient's client-side
    screening, which needs the whole universe. The 14 MB was shape: ~29k uncurated funds each
    serialized as a full 18-field entry with 14 fields always null. Discovered funds now ship as
    compact `{symbol, name}` lists per type (`discoveredEtfList` / `discoveredMutualList`),
    hydrated client-side; `entries` carries only the **126** rich catalog rows (this item said 118,
    a third figure for the same catalog — see the reference-data note above), and the `?symbol=`
    lookup path is unchanged. The expected ~80% cut came in at **84%**: 2,274,590 bytes, 29,009 funds
    discovered, measured on the owner's machine 2026-09-19. The ~12 s first fetch is upstream
    directory latency (24 h-cached thereafter) and is untouched.
12. ✅ ~~Bring the 8 bare-`Promise.all` routes onto `Promise.allSettled`.~~ Done 2026-07-22 — 7 were already
    correct (sequential fallback ladders that must not be parallelised, or not multi-fetch at all); the real
    bug was `sec-filings` discarding collected filings when an archive page threw. See the conventions audit above.
13. ✅ ~~**Regenerate this report** (audit finding H3).~~ Done 2026-07-29 on the owner's machine — see
    "Run of 2026-07-29" above. The code-derived half had landed 2026-07-28 (route count 51 → 56, the Stooq
    rung, a Macro section); this run supplied the measurements. It also corrected a claim this file had made
    without measuring: staking live coverage is **4 of 51**, not "better than 4 of 28".
14. ✅ ~~**News outage.**~~ **Fixed and verified 2026-07-29 (evening run):** `news` REAL with 10 articles
    from 4 providers, `v1 news` REAL with 5. The diagnosis first recorded here was wrong: "two code paths,
    one verdict, so this is the feeds". Both paths read the same route, and that route returned `ok:false`
    for a *config* reason — zero enabled providers — not a fetch failure. Every built-in crypto news
    provider required a key and CryptoPanic's free tier ended April 2026, so nothing keyless was left.
    Four keyless publisher RSS built-ins restore a default that works with no key at all.
15. 🟢 **Raise live staking coverage.** **Largely done: 27 of 51 live as of 2026-09-09** (was 4 of 51 —
    47% of the table, up from 8%). The diagnosis recorded here was wrong: this was never "PR #37 grew the
    catalog, not the live sources". Four dead hosts were hanging DNS ~10s each on libuv's 4-thread resolver
    pool, so the route's shared 6s budget expired and healthy upstreams aborted in array order without ever
    opening a socket — positions 1–5 answered and 6–17 "timed out". Removing the dead rungs was the fix
    (#157–#165). What remains is **24 non-live keys, and they are not all sourceless** — measured
    2026-09-19: 14 `no-upstream`, 5 `derived-estimate`, 3 `curated-estimate`, 2 `needs-api-key`
    (`native_dot`, `native_ksm` — 🔑, a source exists and is deferred under D21). `fallbackProvenance`
    dates only the **27 measured** keys (`measuredOn: 2026-09-18`, #203 `16d7dce`); the other 24 carry
    undated legacy estimates. Since #203 a measured reading older than 14 days is **withheld** rather
    than published, with gap `estimate-expired`.
16. ✅ ~~**Re-run for Macro.**~~ Done 2026-07-29 (evening). 3 of 4 checks REAL, `fx-rates-extended`
    FALLBACK on two unquoted currencies (KPW, SYP). See the Macro Markets table.
17. ✅ ~~**Clear the CoinGecko rate-limit artifact.**~~ **Done** — the pacing of item 17b landed and the
    2026-09-19 run has `coin-discovery`, `alerts` and `portfolio-history` **all REAL**, with no CoinGecko
    429 anywhere in the run. That run's only two failures are elsewhere and unrelated: `coin-search`
    (404 while Next was recompiling — 200 on a direct probe seconds later) and `wallet/tron`
    (Tronscan 429, reproduced against Tronscan directly, so not provoked by the audit's own burst).
17b. 🟢 **CoinGecko rate-limit artifact — paced, and the limit probed.** The harness now paces its own
    CoinGecko calls, weighted per check (`coin-list` = 3 upstream pages), with the minimum gap **derived
    from the cap** (`window / cap`) rather than fixed — a fixed 1.8s floor beside a 10/min cap let ten
    calls land inside 18s, so the cap never bound. On 2026-09-09 that took `coin-discovery` and `alerts`
    from FAIL to REAL; only `portfolio-history` still 429'd, one failure instead of three.
    ⚠ **The allowance itself is still unread.** Every CoinGecko call site now reports what a 429 states,
    and what it states is nothing numeric: `retry-after=7`, the phrase "You've exceeded the Rate Limit",
    and a pricing link. So the cap remains set on a bound (below 10/min), not a reading — do not tune it
    further on inference.
18. ✅ ~~**Add a macro quote check.**~~ Done — the harness now exercises `GC=F` / `EURUSD=X` / `ZN=F`
    through the `security-quotes` ladder. First result, 2026-09-09: 🔑 **UNCONFIGURED — no keyed provider
    served any of the three.** The inference this item distrusted was indeed wrong; sharing the ladder did
    not mean sharing its coverage.

## Validation

`npm run audit` (in `frontend/`, with the app running) is the full check; `npm run smoke`
is the fast CI subset; `npm run audit:strict` also fails on fallback/empty responses.
`npm run lint` and `npm run type-check` run clean (non-interactive, CI-ready).

_This file is maintained alongside the code. Update it whenever a data source is added,
removed, or changes status — and re-run `npm run audit` rather than editing statuses by hand._
