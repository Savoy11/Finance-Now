# Finance Now — Data Availability Report

_Last generated: **2026-09-10**, from a full audit of all `/live-data/*` route handlers
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
> `npm run smoke` runs the fast CI subset. **Do not hand-edit the statuses below
> without re-running the audit** — that is how this file went stale last time.

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
> | Staking APR (live coverage) | "PR #37 grew the catalog … **without adding live rate sources**" | Contradicted by the tree: `staking-rates/route.ts` carries a keyless **DeFiLlama Yields** rung mapping 25 provider keys plus ~20 native live keys, and `stakingProviders.ts` wires **33 distinct `liveAprKey`** values across 35 of 55 providers. The 4-of-51 RATIO is a 2026-07-29 measurement and is NOT changed here — only the claim that no live source was added. Whether those rungs answer is the owner-machine question (T-004) |
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
> quote/chart/OHLCV rows came back REAL because FMP and Finnhub keys are present
> here. An unkeyed deployment still lands on the catalog `ref` path the prediction
> described — that path was not removed, it simply was not exercised. Nothing below
> says the key-gating went away.
>
> | Surface | Predicted | **Measured 2026-09-09** |
> |---|---|---|
> | Quotes (stocks/ETFs/funds) | 🟡 Key-gated, else catalog `ref` | 🟢 **REAL** — 3/3 live via **Finnhub**, AAPL=$316.22. Key-gating intact; a key is configured |
> | Price chart | 🟡 Key-gated — Tiingo → FMP | 🟢 **REAL** — 130 close points (close-only by design) |
> | OHLCV / TA / backtests | 🟡 Key-gated — Tiingo → FMP | 🟢 **REAL** — 130 candles via **FMP** |
> | Trailing returns | 🟡 Key-gated and capped | 🟡 **FALLBACK** — `source=none`, no returns served. **Prediction confirmed:** no Tiingo key, so the surface is dark rather than degraded |
> | Market news | 🟡 Partial — MarketWatch + CNBC | 🟢 **REAL** — 10 articles from CNBC + MarketWatch. Prediction exactly right |
> | Fund holdings | 🟢 Unchanged — SEC N-PORT | 🟢 **REAL** — VOO: 513 holdings via SEC, asOf 2026-06-30. SPY correctly falls back (UIT, files no N-PORT) |
> | Commodity / FX quotes | 🟡 Key-gated, hit hardest | 🔑 **UNCONFIGURED** — **no keyed provider served any macro quote**; `GC=F`, `EURUSD=X`, `ZN=F` all missing. The prediction's worst-case row is the one that came true |
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
| ⬜ **Not measured** | The surface exists in code but has never been through an audit run. **Not a status** — an admission that one is owed. Never leave a row here after a regeneration. |

---

## ⚠️ Environment dependence — read this first

**This report is only valid from a network where these upstreams are reachable.**
Several providers geo-block or bot-block, and the results differ by IP. Verified
**2026-07-20** from the development machine:

| Upstream | Result | Consequence |
|----------|--------|-------------|
| `api.binance.com` | **451** (US geo-block — permanent, not an IP artifact) | All crypto OHLCV silently served by Binance.US instead |
| `api.binance.us` | 200 | The de-facto crypto candle source |
| `fapi.binance.com` (futures) | **451** | `funding-rates` uses OKX instead |
| `api.okx.com` | 200 | Funding rates + open interest |
| Coinbase / Kraken public | 200 | Unused reachable fallbacks if more are ever needed |
| `min-api.cryptocompare.com` | **401** | Now requires a key; unusable keyless |
| CoinGecko free | 200 (intermittent **429**) | Rate-limited under load; 60 s polling floor |
| Reddit `*.json` (API) | **403** — all subs, all UAs | Unusable server-side without OAuth |
| Reddit `*.rss` (Atom) | 200, then **429** | Works, but ~1 request per window per IP |
| `lunarcrush.com/api3` | **404** | Endpoint gone; also behind Cloudflare |
| `stooq.com` CSV quotes | **404** | Dead — bottom rung of the quote ladder no longer functions |
| `cloudflare-eth.com` | JSON-RPC `-32603` | **Fixed:** ETH wallet route now uses a fallback ladder |
| `polygon-rpc.com` | 403 "tenant disabled" | **Fixed:** same ladder |
| `kobe.mainnet.jito.network/api/v1/apy` | **404** | **Fixed:** switched to `/stake_pool_stats` |
| SEC EDGAR / data.sec.gov | 200 | Keyless and authoritative — filings, XBRL, N-PORT |
| ~~Yahoo Finance spark/chart~~ | 200 | **NOT USED SINCE 2026-08-06 — removed on terms grounds, not availability.** Reachability is beside the point: there are no published third-party API terms for these endpoints. Hard-blocked in `sourceTerms.ts` |
| ~~Yahoo Finance **v8 chart, individual futures months**~~ (`CLZ26.NYM`) | 200 | **Measured 2026-08-05 (P2-O1):** 9/9 across NYMEX/COMEX/CBOT, 64 daily bars. Unblocks the futures term-structure view (P2-O4) — same API already in production |
| ~~Yahoo Finance **options**~~ (`v7/finance/options`) | **401** — both hosts, all symbols | **Measured 2026-08-05 (P2-O1):** auth wall, not a rate limit. The keyless options-chain path is closed. Note Yahoo chart answered 10/10 in the same run — Yahoo is reachable; Yahoo *options* is gated |
| `cdn.cboe.com` delayed options quotes | 200, complete (greeks + IV + OI) | **Measured 2026-08-05 (P2-O1): technically perfect, PROHIBITED BY TERMS.** Cboe forbids auto-extraction of delayed quote data and blocks the IPs that attempt it; programmatic use runs through the paid All Access API. Not used, and not to be added. Owner decision 2026-08-05: options chains stay not-available; the Trade Risk Scorer takes hand-entered legs instead — see `docs/assessments/P2-O1-options-data.md` |
| StockTwits | 200 | Keyless equity social |
| DefiLlama, mempool.space, alternative.me, Lido, Marinade | 200 | All healthy |

**Key-gating vs geo-blocking are different problems.** A route needing a paid FMP plan
(`stock-universe`, `market-calendar`) is a commercial decision. A route blocked by IP
(`ohlcv`, `funding-rates`, Reddit) cannot be fixed by paying anyone.

---

## 🔴 Silent degradation — routes that return HTTP 200 with non-live data

**This is the most important section.** These routes look healthy to any status-code
check. They are not lying about their data, but a caller that ignores the provenance
field will treat catalog/reference/estimate values as live readings.

| Route | Looks like | Actually is | Provenance field |
|-------|-----------|-------------|------------------|
| `ohlcv` | `source: "binance"` | **Binance.US**, a different venue with its own liquidity and prices | `venue: "binance-us"` (added 2026-07-20) |
| `stock-universe` | 79 stocks, `ok: true` | Curated `equityCatalog.ts` fallback — the real universe is thousands | `source: "catalog"` |
| `stock-outliers` | Sector z-score screener | Screens only those 79 catalog names, so "outlier" means outlier within a hand-picked large-cap set | inherits `stock-universe` |
| `staking-rates` | **51** APRs, `ok: true` | **27 are live, 24 are static estimates** *(re-measured 2026-09-09; this row read 4 live / 47 estimated, measured 2026-07-29)*. The remaining 24 are **sourceless** — no upstream publishes a rate for them — rather than merely unfetched. Their FALLBACK values were undated until 2026-09-09, and of the 27 that could be checked against a live reading, **22 were ≥25% overstated** (worst: `lombard_btc` 3.2 → 0.17). | `sources: { key: "live" \| "estimate" }`, plus `fallbackProvenance` — whether the estimate was ever checked |
| `network-fees` | 18 networks with USD fees | **5 of 18 are live** (Bitcoin via mempool.space; ETH / BNB / Polygon / AVAX via keyless `eth_gasPrice`, added 2026-08-21, `01d6bfe`). The other 13 are static gas × live price. **The L2s are estimates on purpose** — `eth_gasPrice` omits their L1 data fee, which is most of the real cost — so the remaining work here is non-EVM chains, not L2s. *(Corrected 2026-09-08: this row said "only Bitcoin", written before the EVM-L1 work.)* | per-network `source: "estimate"`, `btcFeeSource`. ⚠ **2026-09-09: BTC read `estimate` on the owner's machine** because mempool.space was unreachable from that connection. Narrowed 2026-09-10 to the **TCP layer**: DNS is correct and identical across three resolvers, but a connect to `103.165.192.x:443` never completes, while control hosts connect in 0.19s. Count deliberately left at 5 of 18 — still unresolved between a regional filter, a broken route and a downed host, and one machine cannot tell those apart. See "Environment dependence found by this run" |
| `cbdc-data` | 55 countries | Entirely the static table; the live CBDC news feed did not resolve | `source: "fallback"` |
| `fund-holdings` (SPY) | 5 holdings | Catalog's indicative top holdings. **Expected** — SPY is a unit investment trust and files no N-PORT | `source: "catalog"`, `full: false` |
| `chart` | OHLCV candles | **Synthesised** — `open==high==low==close`; built from a price-only series | `synthetic: true` (added 2026-07-20) |
| `security-quotes` | Live prices | Falls back to catalog reference prices if the whole ladder fails | `source: "reference"`, per-quote `reference: true` |

**The audit harness now fails-loud on all of these** (🟡 FALLBACK), so they cannot pass
silently again. Run `npm run audit:strict` to make them exit non-zero.

---

## Run of 2026-09-09 — measured results

⚠ **This run was measured through a VPN and its IP-dependent rows are wrong.** See
"Environment dependence" below. It is kept because the key-gated, terms-gated and
catalog-shaped findings are unaffected and still stand — only the reachability rows
moved. The corrected run is 2026-09-10, immediately below.

`npm run audit`, owner's machine, app on localhost:3000, tree at `57bb322`.
**77 checks: 62 REAL · 11 FALLBACK · 3 UNCONFIGURED · 0 EMPTY · 1 FAIL.**

### ✅ Re-run 2026-09-10 with the VPN OFF — the corrected baseline

**77 checks: 62 REAL · 9 FALLBACK · 3 UNCONFIGURED · 0 EMPTY · 3 FAIL.**

| Moved | From | To | Why |
|---|---|---|---|
| `network-fees` | 🟡 FALLBACK, 10,936ms | 🟢 **REAL, 129ms** | mempool.space reachable; BTC fee live |
| `bitcoin fee is live (mempool.space)` | 🟡 FALLBACK `source=estimate` | 🟢 **REAL `source=live`** | same |
| `wallet eth (polygon)` | 🟢 REAL | 🔴 **FAIL 502** | publicnode refuses the residential IP; no fallback behind it |
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
| `wallet eth (polygon)` | 🔴 **FAIL 502** — no working fallback behind publicnode |
| `wallet tron` | 🔴 FAIL — Tronscan HTTP 429, also per-IP |

**Polygon having no fallback where mainnet has one is the real finding here** — the
VPN merely revealed it. Worth fixing regardless of which IP the app runs from.

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
| Asset prices, market cap, volume, 24h change | 🟢 Live | CoinGecko (`/live-data/markets`) | 78 assets. Metadata from static catalog — reference data, not fabricated. |
| Asset OHLCV / price charts | 🟡 Partial | **Binance.US** → CoinGecko fallback | Binance.com is 451 here, so candles come from the US mirror — different venue, different prices. `venue` field records which. |
| Coin list / search / discovery | 🟢 Live | CoinGecko | 750 coins, 209 discovery candidates. |
| Fear & Greed Index | 🟢 Live | alternative.me | |
| Funding rates + open interest | 🟢 Live | **OKX** (Binance fapi is 451 here) | 10 instruments. |
| DeFi TVL | 🟢 Live | DefiLlama | 50 protocols. |
| BTC network stats | 🟢 Live | blockchain.info + mempool.space | Height, hashrate, difficulty, mempool. Hashrate **unit is inferred from magnitude** (`lib/server/btcHashrate.ts`), not assumed: the upstream sends GH/s and a hardcoded `/1e12` reported `0 EH/s` while block height advanced normally (fixed 2026-07-29). Returns `null` — rendered as not-available — rather than a figure it cannot justify. A wrong field inside an otherwise healthy payload is the one failure the REAL/FALLBACK split cannot catch. |
| Reserves / collateralization | 🟢 Live | DefiLlama Stablecoins API | 9 stablecoins. Composition breakdown is **approximate / derived** from chain distribution, not issuer attestation. |
| Risk scores | ⚪ **Removed 2026-08-29 (RP-6)** | — | **No per-coin risk score is published anywhere.** Owner: a risk figure on an asset the reader is viewing may be read as a recommendation, which is a regulated activity. `/live-data/risk-scores`, `lib/api/live/riskScores.ts`, `useRiskScoreIndex`, `RiskScoreBadge` and the `Asset.riskScore`/`riskBand` fields are all gone, and `lib/risk/__tests__/riskScoringRemoved.test.ts` guards it. **`lib/risk/` itself stays** — the options Trade Risk Scorer, staking-provider risk and the macro/equity profiles are separate decisions and remain live. |
| Alerts | 🟢 Live | Derived from live market thresholds | Generated from live price/peg movement, not a stored backend. |
| Network fee — Bitcoin | 🟢 Live | mempool.space | Real sat/vByte. |
| Network fees — ETH / BNB / Polygon / AVAX | 🟢 Live | keyless `eth_gasPrice` (publicnode) | Live gas amount × live token price (2026-08-21, `01d6bfe`). |
| Network fees — L2s (Arbitrum, Base, Optimism) | 🟡 Partial | static gas amount × live token price | **Estimate on purpose.** `eth_gasPrice` returns only the L2 execution price and omits the L1 data fee, which is most of what a rollup transaction actually costs — a live-looking number that is wrong by the majority of the total is worse than a labelled estimate. |
| Network fees — non-EVM (Solana, Tron, XRPL, Litecoin, Dogecoin, Cardano, Polkadot, Cosmos, TON, NEAR) | 🟡 Partial | static gas amount × live token price | Gas amount is a **static estimate**; only the price is live. Labeled `estimate`. This is where the remaining work is. |
| Transfer withdrawal fees | 🟡 Partial | static table (`transferFees.ts`) | Hand-maintained, carries `lastVerified` + confidence (high ≤60d / medium ≤120d / low when stale). Stale ⇒ ranking degraded with an explicit caveat. |
| `chart` route | 🟡 Partial | CoinGecko market_chart | **Synthetic OHLC** (zero-range candles) now marked `synthetic: true`. **No consumers in the app** — use `/live-data/ohlcv` for real candles. |

### Crypto — staking, news, social
| Feature / Page | Status | Source | Notes |
|----------------|--------|--------|-------|
| Staking APR — stETH / rETH / mSOL / jitoSOL | 🟢 Live | Lido, Rocket Pool, Marinade, Jito | **jitoSOL was restored 2026-07-20**: the old `/api/v1/apy` endpoint 404s and had silently pinned it to a 7.5% static estimate. Now reads `/api/v1/stake_pool_stats`. **The 7.5 FALLBACK itself was only corrected 2026-09-09** — it survived the endpoint fix by 7 weeks, and measured 4.86 against it (54% high, not the 41% recorded here). It was one of 22 of 27 measured fallbacks that were ≥25% overstated; see the FALLBACK header comment in `staking-rates/route.ts`. |
| Staking APR — all other providers | 🟡 Partial | 7 live upstreams + static estimates | **27 of 51 live, 24 estimated** (re-measured 2026-09-09, owner's machine; was 4/51). The 4/51 was never a catalog-size problem: four dead hosts were hanging DNS ~10s each on libuv's 4-thread resolver pool, starving the route's shared 6s budget so healthy upstreams aborted without ever opening a socket (#157–#165). All 7 remaining upstreams are live and `defillama-yields` is 19/19. Each estimate still carries `sources[key] = 'estimate'`; the 24 unmeasured FALLBACK values are flagged in `fallbackProvenance`. |
| Staking discovery | 🟢 Live | DefiLlama + Yearn + Pendle + Beefy | 95 pools. **Slow: ~18 s.** |
| News + sentiment + categories | 🟢 Live | 4 keyless publisher RSS feeds + optional keyed providers | **Verified 2026-07-29 (evening): 10 articles from 4 providers; `v1 news` 5 articles.** The outage earlier that day was **structural, not a feed failure**: every built-in crypto news provider required an API key, and CryptoPanic's free tier — the one carrying this — ended April 2026. With no key saved all four resolved to `disabled`, so the route found zero providers and returned `ok:false`, which `/api/v1/news` reported as "all news providers failed upstream" — blaming the upstream for a config state. Fixed by adding keyless RSS built-ins (CoinDesk, Cointelegraph, Decrypt, Bitcoin Magazine), matching what equities and macro already had, so the feed has a default that needs no key. Articles use `headline` (not `title`); sentiment/category are heuristic classifiers (labeled derived). |
| Social sentiment (crypto) | 🟡 Partial | Reddit **Atom/RSS** feeds | Reddit's JSON API 403s server-side; the `.rss` feeds work but 429 aggressively (~1 request per window per IP), so coverage is partial by nature. **Live vs derived, stated 2026-09-08 (code reading, not a re-measurement):** LIVE — post title/body/link/author/timestamp from the Atom feed, plus `mentionsCount` (Santiment) and `social_volume_24h`/`galaxy_score` (LunarCrush), both **key-gated**, so with no key those signals are ABSENT rather than zero. DERIVED — every sentiment label, all computed in `social/route.ts`: Reddit's from a keyword regex over the post text, LunarCrush's from a galaxy-score threshold (≥60 / ≤35) rather than the provider's own `sentiment` field, Santiment's hardcoded `neutral`. The per-asset `sentimentScore` counts those derived labels, so it is derived twice over. NEITHER — Reddit `score` is a literal `0` and `upvoteRatio` is never set, because Atom carries no vote data; both pages render those badges only when present, so nothing shows rather than a fake zero. |
| Videos | 🟢 Live | RSS | 60 videos. |
| Video search / analyze | 🔑 Key-gated | YouTube Data API | Reports `configured: false`; returns empty rather than fabricating. |

### Crypto — portfolio & wallets
| Feature / Page | Status | Source | Notes |
|----------------|--------|--------|-------|
| Portfolio prices | 🟢 Live | CoinGecko | `source: live \| partial \| error`. |
| Portfolio history | 🔴 **FAILING (2026-07-29)** | CoinGecko history | **No historical prices, `source=error`.** The param validation is fine — the missing-params case still correctly returns HTTP 400 — so this is the upstream call, not the handler. Likely the same CoinGecko rate-limiting that fails `coin-discovery`. |
| Wallet — BTC / ETH / SOL / TRON / XRP | 🟢 Live | Public explorers + JSON-RPC | **ETH/EVM fixed 2026-07-20:** was hard-502ing on Ethereum and Polygon because each chain had a single RPC and `cloudflare-eth.com` / `polygon-rpc.com` both broke. Now walks a fallback ladder and reports the serving endpoint in `rpc`. All 7 EVM chains verified. |
| Exchange connections | ⚪ **Removed 2026-08-18 (RP-5)** | — | Exchange API-key linking was withdrawn on security grounds: plaintext `apiKey`/`apiSecret` at rest for a read-only balance view that watched addresses already approximate. Routes and credential store deleted; the wallet store's v2 migration drops persisted connection metadata. Do not reintroduce without a decision reversing RP-5. |
| Pump report metrics | 🟢 Live | derived | 20 metrics. `scan`/`investigate`/`chat` are POST-only (405 on GET is correct). |

### Equities module
| Feature / Page | Status | Source | Notes |
|----------------|--------|--------|-------|
| Quotes | 🟡 Key-gated _(was 🟢, pre-2026-08-06 measurement)_ | ladder: FMP → Finnhub → Twelve Data → Tiingo → Alpha Vantage → catalog | **Every live rung needs a key** since Yahoo was removed. With none configured, stocks and funds render catalog reference prices behind an amber `ref` tag and macro instruments render a dash. **Stooq was removed earlier** (2026-07-28) — 404s on every variant. |
| OHLCV / TA / backtests | 🟡 Key-gated _(was 🟢)_ | Tiingo → FMP | Both keyed. Route reports `source: 'none'` and the surfaces show their no-live-source state rather than synthetic candles. |
| Price chart | 🟡 Key-gated _(was 🟢)_ | Tiingo → FMP | Close-only series by design. Tiingo supplies `adjClose`, so charts and candles agree across a split. **Takes range vocab `6mo`, unlike its sibling `security-ohlcv` (`6M`)** — mismatched vocab returns 400. |
| Trailing returns | 🟡 Key-gated _(was 🟢)_ | Tiingo | One request per symbol now, so `?universe=` is **refused** rather than truncated, and `?symbols=` is capped at 60. Fund return screening/sorting disabled; per-page Returns columns still live. |
| Stock Registry universe | 🟡 Partial | **curated catalog fallback** | FMP `company-screener` is **PAID-only**; without it the registry is 79 hand-maintained names. P/E backfill from SEC XBRL frames only runs on the FMP path. |
| Equity screener / outliers | 🟡 Partial | derived from the above | Screens 66 evaluable names across 7 sectors — inherits the catalog's narrowness. Backs the `equity-screener` agent. |
| Market news | 🟡 Partial _(was 🟢)_ | MarketWatch / CNBC RSS | Keyless and unaffected in themselves. What went is the **per-ticker** feed — Yahoo's was the only free one — so symbol news is now these general wires filtered to articles that actually name the company. An empty result for a symbol is the honest answer, not a fault. |
| Stock social | 🟡 Partial | StockTwits + **Reddit (fixed 2026-07-20)** | Reddit was calling the `.json` API, which **403s 100% of the time server-side** — a permanently dead provider that looked like a quiet feed. Switched to the `.rss` Atom feeds already proven in the crypto route. **Starvation fixed 2026-07-22** (`lib/server/socialBlend.ts`, unit-tested): merging by recency let StockTwits — minutes old, against Reddit's hours — fill every slot at `limit ≤ 30`. The blend now allocates the budget round-robin across providers and orders the winners by recency, so the slower source keeps its share. **Separately, since the 2026-08-29 terms review, reddit.com is gated off** — its robots.txt disallows this app's agent — unless `REDDIT_CLIENT_ID` is set, enforced in `pinnedFetch`. So expect StockTwits-only in server/CI environments, by policy rather than by bug. |
| SEC filings | 🟢 Live | SEC EDGAR | Keyless. |
| Company fundamentals / ratios | 🟢 Live | SEC EDGAR XBRL | AAPL rev $416B, net margin 26.9% — sanity-checked. |
| Company profile | 🟢 Live | SEC EDGAR + Wikipedia | |
| Market calendar | 🔑 Key-gated | FMP | Reports `configured: false`. Earnings calendar needs a free key; economic calendar needs a paid one. |

### ETFs & Funds module
| Feature / Page | Status | Source | Notes |
|----------------|--------|--------|-------|
| Fund universe | 🟢 Live | SEC + providers | 28,977 entries. **Slow: ~11 s, 14 MB payload** — payload slimmed 2026-07-30 (action item 11), pending re-measurement. |
| Fund holdings | 🟢 Live | SEC N-PORT (keyless, authoritative) | Verified full books: VOO 511, IVV 507, VTI 1500, QQQ 101, ARKK 46. |
| Fund holdings — UITs | 🟡 Partial | catalog | **SPY, and UITs generally, file no N-PORT**, so they correctly fall back to indicative top holdings. Not a bug. |
| Fund holdings history | 🔑 Key-gated | SEC N-PORT diff → FMP | Works only where an N-PORT series exists; no FMP key configured as fallback. |

### Macro Markets module
Shipped 2026-07-21 and **measured for the first time on 2026-07-29 (evening run)**. The harness
had no macro checks until that day, so these rows sat ⬜ Not measured for eight days while the
routes were in production — the doc gap and the harness gap were the same gap. Four checks now
cover the module; only the shared quote path is still inferred rather than observed.

| Feature / Page | Status | Source (measured) | Notes |
|----------------|--------|-------------------|-------|
| Macro news | 🟢 Live | 8 keyless RSS feeds (Investing.com ×3, OilPrice, FXStreet, MarketWatch, CNBC ×2) | `macro-news` — **20 articles across 3 pillars** (commodities, bonds, currencies) in 1.7s. Content-first pillar classifier; 14-day staleness cutoff. Note only 3 of 4 pillars were represented in this sample; the balanced merge caps each at ¼ of slots, so an empty pillar means that feed set returned nothing in-window, not that classification failed. Several of these publishers bot-block elsewhere in this report — expect per-feed variance by IP. |
| FX rates — official tier | 🟢 Live | ECB daily reference via frankfurter.dev (keyless) | `fx-rates` — **30 currencies**, `date=2026-07-29`, `source=frankfurter-ecb`. Confirms the 30-currency set is ECB's complete published list, not a subset. |
| FX rates — extended tier | 🟡 Partial | community `fawazahmed0/currency-api` (keyless) | `fx-rates-extended` — **124 of 126 allowlisted currencies priced; KPW and SYP unpriced upstream.** Classified FALLBACK by the harness, which is the honest reading: the tier works, two codes have no rate. North Korean won and Syrian pound are both effectively unquoted in open markets, so this is the source being accurate rather than broken. **Decided 2026-09-08: keep them, accepted as-is.** Dropping the two codes would make the harness report REAL, and that is the whole argument against it — the route's behaviour would be identical while the audit line got tidier, which is optimising the measurement rather than the thing measured. A user who picks KPW learns that nobody quotes it; a user who cannot find KPW learns nothing. The permanent FALLBACK on this row is therefore expected, not an open item. Labeled community-sourced in the UI, never blended with the ECB tier unattributed. |
| Treasury yield curve | 🟢 Live | treasury.gov daily par curve XML (keyless) | `treasury-yield-curve` — **13 maturities**, 2s10s=+0.45, 3m10y=+0.84, `shape=normal`. Both spreads positive and the curve un-inverted as of this run. 4h revalidate. |
| Commodity / currency / rate quotes | 🟡 Key-gated, expected partial _(never measured directly)_ | existing `security-quotes` ladder | **The surface the Yahoo removal hit hardest, and still the least-measured.** `GC=F` / `EURUSD=X` / `^TNX` were quoted keylessly and are **not** covered by Tiingo, so coverage now depends entirely on which keyed provider is configured. Unpriced renders a dash — the catalogs carry no reference prices by design. A dedicated check is now the highest-value gap to close. |
| Futures term structure (forward curve) | 🔴 Not available _(was 🟢, P2-O4)_ | — | Dated contract months (`CLZ26.NYM`) had exactly one reachable source and it was Yahoo. FMP/Tiingo/Finnhub/Twelve Data/Alpha Vantage carry continuous front-months at best; exchange settlement files are licensed. `/live-data/futures-curve` still resolves the months and returns `ok:false` with the reason, and `TermStructureCard` prints it — the section says why rather than vanishing. Front-month prices are unaffected. |
| CUSIP-level bond quotes | 🔴 Not available | — | Licensed data. Intentionally absent and stated on-page; this row needs no measurement. |

### Not available
| Feature | Status | Notes |
|---------|--------|-------|
| TA — liquidation heatmap / OI depth / exchange flows | 🔴 Not available | Coinglass/Glassnode are paid. Shown as explicit "not available (paid feed)" rows. |
| TA — event markers (unlocks, CPI/FOMC) | 🟡 Partial | News events plotted from the live feed; token unlocks and macro prints need a paid calendar — explicitly omitted, not faked. |
| Peg deviation history | 🔴 Not available | No free historical peg series. Returns empty. |
| Per-row price sparklines | 🔴 Not available | No free per-asset trend source at list scale; shows "n/a". |
| Reports (AUM, risk tables) | 🔴 Not available | Explicit "not available" notice. |
| Backtests (crypto) | 🔴 Not available | Requires a backtesting backend; not present. Equity strategy backtests (`/equities/backtests`) DO work off live `security-ohlcv`. |
| `/live-data/tier` | 🔴 **Route does not exist** | The directory is empty and nothing references the path — tier data is client-side (`src/lib/tier.ts`). Listed in older inventories in error. |

---

## Reference data (legitimately static — NOT mock)

Not real-time and not fabricated; stable reference facts that belong in the app as static data:

- **Asset metadata catalog** — id, symbol, name, asset type, blockchain, contract address, issuer, description, website, whitepaper, peg target. (`lib/data/assetCatalog.ts`)
- **News categories** — the fixed taxonomy of category labels. (`lib/data/newsCategories.ts`)
- **Asset launch dates & notable historical events** — chart annotations. (`lib/data/priceHistoryMeta.ts`)
- **Network / address-format reference** — chains, address formats, examples. (`lib/data/transferFees.ts`)
- **Staking provider risk profiles** — qualitative risk dimensions per provider. (`lib/data/stakingProviders.ts`)
- **Equity / fund catalogs** — `equityCatalog.ts` (~79), `fundCatalog.ts` (~55). Legitimate reference data, but note they double as the **fallback** path for `stock-universe` and `fund-holdings`, which is where the silent-degradation risk comes from.

---

## Route conventions audit

Project convention (CLAUDE.md): every `/live-data` route needs `export const dynamic = 'force-dynamic'`,
`next: { revalidate: N }` on each fetch, and `Promise.allSettled` for any multi-fetch.

- ✅ **`force-dynamic`** — all **56** route files comply (`chart` was the sole exception; fixed 2026-07-20).
  Count and compliance re-verified **statically** on 2026-07-28 (`find src/app/live-data -name route.ts`
  vs `grep -l "export const dynamic"`, 56/56). This one line needs no running server, so it is current
  even though the availability statuses above are not.
- ✅ **`revalidate`** — present on every outbound fetch in all routes that fetch.
- ✅ **`Promise.allSettled`** — resolved 2026-07-22. The earlier flag listed 8 routes found by grepping for
  multi-fetch without `allSettled`; reading them showed **7 were already correct and 1 had a real bug that
  `allSettled` would not have fixed**:
  - `markets`, `portfolio-prices`, `cbdc-data` — deliberate **sequential fallback ladders** (try provider A,
    fall back to B, then C), each leg try/caught. `allSettled` would be actively **wrong** here: it fires every
    provider in parallel, burning rate limit on calls the ladder exists to avoid.
  - `company-profile` — `Promise.all([SEC, wiki])` is safe because `fetchWikiSummary` is fail-silent (returns
    `null`). Only the SEC leg can reject, and that *should* fail the route: it is the primary data.
  - `stock-universe` — already has an explicit inner boundary so a SEC hiccup costs the P/E column, not the
    response. `wallet/exchange` and `config` are **not multi-fetch at all** — one exchange / one provider test
    per request, each try/caught.
  - `sec-filings` — **the one genuine bug.** Its archive-page walk is sequential by design (it stops as soon as
    `limit` is satisfied, so parallel fetching would request pages nobody asked for). A non-`ok` response broke
    the loop gracefully, but a *thrown* fetch propagated to the outer handler and **503'd the whole route,
    discarding the filings already collected from `recent`**. Now per-page try/catch: partial results return with
    `hasMore: true`. Verified by fault injection — old code 503 / 0 filings, new code 200 / 11 filings.

  Conclusion: the convention as stated ("`Promise.allSettled` for any multi-fetch") is too blunt. A sequential
  fallback ladder is a multi-fetch that must *not* be parallelised. What every multi-fetch actually needs is a
  **failure boundary that preserves partial results** — sometimes `allSettled`, sometimes try/catch per leg.

---

## Performance outliers

| Route | Latency | Note |
|-------|---------|------|
| `staking-discovery` | ~18 s **at the time of measurement** | 4 upstreams (DefiLlama, Yearn, Pendle, Beefy) — **bounded 2026-09-08.** The fan-out is parallel, so the response was gated by the slowest leg, and with no timeout "slowest" had no upper bound. Each upstream now gets a 6 s budget, and a TIMEOUT is not retried — the retry exists for upstreams that throw and immediately succeed, whereas retrying a slow one buys the same answer for twice the wait. The fan-out is `allSettled`, so a timed-out leg drops its pools and the other three still serve. **The new figure needs re-measuring on the owner's machine** — the bound is ~6 s, not a measurement. |
| `fund-universe` | ~11 s / **14 MB** | 28,977 entries in one payload — payload slimmed 2026-07-30 (see action item 11), size pending re-measurement; first-fetch latency is upstream, 24 h-cached after |
| `staking-rates` | ~6 s | 18 parallel upstreams with a 6 s per-fetch timeout |
| `stock-social` | ~6 s | Reddit RSS fetches frequently hit the 429 path |

---

## Refresh intervals (free tier)

CoinGecko's public API rate-limits to ~30 calls/minute, making **60 seconds the practical
minimum** for free-tier polling without hitting 429.

| Surface | Endpoint | Refresh interval | Stale after |
|---------|----------|-----------------|-------------|
| Technical Analysis — screener prices | `/live-data/markets` | 60 s | 60 s |
| Technical Analysis — chart (1H range) | `/live-data/ohlcv` | on demand | 60 s |
| Technical Analysis — chart (4H / 1M) | `/live-data/ohlcv` | on demand | 5 min |
| Technical Analysis — chart (3M / 6M / 1Y / MAX) | `/live-data/ohlcv` | on demand | 15 min |
| Asset prices / market data | `/live-data/markets` | 30 s | 30 s |
| Network fees | `/live-data/network-fees` | on demand | 5 min |
| Staking APRs | `/live-data/staking-rates` | on demand | 5 min |
| News | `/live-data/news` | on demand | 1 min |

> The chart price display is derived from the last candle's close — it updates whenever
> OHLCV refetches, not on a separate price tick.

---

## Action items tracked from this report

1. ✅ Classify every surface (this document).
2. ✅ Remove all mock generators; relocate legitimate reference data out of `lib/api/mock/`. There is no mock/demo data path.
3. ✅ Reports page confirmed to show "not available" (no live-mode mock leak).
4. ✅ De-duplicate network-fee logic into one source of truth (`lib/data/networkFees.ts`), consumed by both layers. Verified identical at runtime + by the audit's cross-layer checks.
5. ✅ Provenance primitive (`DataBadge`) wired into the transfer-fees page; fees carry `lastVerified` + staleness warning.
6. ✅ Network fee-feed **infrastructure** built (`FeeProvider` + `FEE_PROVIDERS` + BTC reference provider). Live EVM gas providers remain the next step to flip more 🟡 chains to 🟢.
7. ✅ **Audit harness classifies real vs fallback data** (`npm run audit`). Replaces the old pass/fail smoke test, which reported 43/43 green while two routes served static catalogs.
8. ✅ Surface data provenance in-app. Done — a canonical registry (`src/lib/data/dataSources.ts`) now powers the
   **/data-sources** page (in-app catalog), per-page `<SourceLine/>` badges, and the generated
   [`DATA-SOURCES.md`](./DATA-SOURCES.md). `npm run data-sources -- --verify` fails if a route fetches a host the
   registry doesn't name, so the docs/app can't silently drift from the code.
9. ⏳ **Get a paid FMP plan or a different universe source** — `stock-universe` and `stock-outliers` are the largest remaining fallback surface.
10. ✅ ~~**Fix Reddit starvation in `stock-social`**~~ Done 2026-07-22 — `lib/server/socialBlend.ts` allocates the
    response budget round-robin per provider (newest-first within each), then re-sorts by recency for display, so
    the feed still reads chronologically. Unused share flows to other providers, so one active source still fills
    the limit. Measured before → after at `limit=20`: **20/0 → 10/10** StockTwits/Reddit; at `limit=40`: 30/10 →
    20/20. `providers` now lists only sources that actually placed a signal in the response — previously it named
    Reddit at limit=20 while showing zero Reddit posts, which is what hid the starvation. 7 unit tests.
    ⚠ Separately: the `/equities/social` **page** currently never issues its query (stuck on "Fetching social
    signals…" while the app reports Offline/DISCONNECTED). Pre-existing and unrelated — the route and a direct
    fetch from that page both work; tracked separately.
11. 🔧 ~~Paginate `fund-universe` — 14 MB in one response.~~ **Payload fix shipped 2026-07-30,
    pending re-measurement.** Not pagination — that would have broken FundsClient's client-side
    screening, which needs the whole universe. The 14 MB was shape: ~29k uncurated funds each
    serialized as a full 18-field entry with 14 fields always null. Discovered funds now ship as
    compact `{symbol, name}` lists per type (`discoveredEtfList` / `discoveredMutualList`),
    hydrated client-side; `entries` carries only the 118 rich catalog rows, and the `?symbol=`
    lookup path is unchanged. Expected ~80% size cut; the ~11 s first fetch is upstream directory
    latency (24 h-cached thereafter) and is untouched. **Re-run the audit on the owner's machine
    to record the new size** — the container cannot reach NASDAQ/SEC.
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
    (#157–#165). What remains is genuinely sourceless: 24 keys have no upstream that publishes a rate, and
    their FALLBACK values are now dated and disclosed via `fallbackProvenance` rather than presented as
    equivalent to live.
16. ✅ ~~**Re-run for Macro.**~~ Done 2026-07-29 (evening). 3 of 4 checks REAL, `fx-rates-extended`
    FALLBACK on two unquoted currencies (KPW, SYP). See the Macro Markets table.
17. ⏳ **Clear the CoinGecko rate-limit artifact.** `coin-discovery`, `portfolio-history` and `alerts` all
    fail together on free-tier 429s during a burst run, while `markets`/`coin-list`/`coin-search` in the
    same run succeed. Either set `COINGECKO_API_KEY` or pace the harness's CoinGecko checks — as it stands
    every full audit reports three failures that say nothing about the app's real availability, which
    devalues the failure list.
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
