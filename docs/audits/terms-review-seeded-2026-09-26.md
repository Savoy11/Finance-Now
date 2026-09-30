# The 30 seeded source-terms entries — read on the owner's machine, 2026-09-26

**Readings, not verdicts.** T-005. Same discipline as `terms-review-apis-2026-09-14.md`:
every document below was fetched from this machine over a clean residential egress
(Charter Communications, AS11426, `proxy:false hosting:false`, checked before the run),
and quoted verbatim where it decides anything. Three fetch paths were needed and each is
named per host: `curl` with a browser agent; `curl` with the SEC-compliant declared agent;
and local headless Chrome for pages that render only in a browser (Messari, LunarCrush,
mempool, jsDelivr, the two CoinMarketCap API agreements). Setting any `verdict` or
flipping any `review` to `verified` remains the owner's act; the registry entries carry
a dated `READ` comment pointing here and nothing else changed.

Worksheet the run started from: `npm run terms:report -- --seeded` (30 hosts). Registry
before the run: 56 entries, 26 verified, 30 seeded.

## Result

| # | Host | App use | Document reached | Reading |
|---|---|---|---|---|
| 1 | **sec.gov** | EDGAR filings, XBRL, N-PORT, ticker maps | ✅ Webmaster FAQ (declared UA) | **Favourable** — free to reuse; the two recorded conditions are verbatim |
| 2 | **home.treasury.gov** | daily par yield curve | ⚠ registered URL 404; site-policies page found | **Favourable** — no reuse restriction; federal work |
| 3 | **frankfurter.dev** | ECB reference FX | ✅ | **Favourable** — "free for commercial use" |
| 4 | **wikipedia.org** | company summaries | ✅ Terms of Use | **Conditional** — CC BY-SA attribution + link; API etiquette / UA policy |
| 5 | **cdn.jsdelivr.net** | extended FX tier JSON | ✅ (headless) | **Favourable** — free for personal and commercial use |
| 6 | **alternative.me** | Fear & Greed | ✅ | **Conditional** — "attribution … right next to the display of the data" |
| 7 | **mempool.space** | BTC fees, stats | ✅ (headless) | **Favourable** — disclaimers only |
| 8 | **blockchain.info** | BTC stats | ⚠ registered URL is now an OpenAPI spec | **Favourable, no document** — "Free endpoints under /public/*" |
| 9 | **llama.fi** | yields, TVL, stablecoins, hacks | ⚠ docs only, no terms text | **Favourable, no document** — free tier + $300/mo plan |
| 10 | **nasdaqtrader.com** | symbol directory | ⚠ registered page has no terms; Copyright & Disclaimer page read | ⚠ **Restrictive on its face** — needs a judgement |
| 11 | **okx.com** | funding rates, OHLCV fallback | ✅ ToS + **API Agreement** | ⚠ **Reads as prohibited** for a deployed analytics platform (§9.4) |
| 12 | **kucoin.com** | withdrawal fees | ✅ Terms of Use | ⚠ **Conditional-personal** — Article 91 |
| 13 | **huobi.pro** (HTX) | withdrawal fees | ❌ docs only; ToS unreachable | **Unread** |
| 14 | **xt.com** | withdrawal fees | ❌ interstitial; /terms 404 | **Unread** |
| 15 | **binance.com** | OHLCV (first rung) | ❌ page serves navigation only, to curl and to Chrome | **Unread — and moot for a US deployment** (451 geo-block; Binance.US verified separately) |
| 16 | **alphavantage.co** | equity quotes, last rung, keyed | ✅ ToS (PDF) | ⚠ **Personal, non-commercial** — same class as FMP/Finnhub/Twelve Data (T-151) |
| 17 | **coinmarketcap.com** | coin profiles, keyed | ✅ both API agreements (headless) | ⚠ **Personal key = personal use only; commercial plan needs "Data provided by CoinMarketCap.com" + link** |
| 18 | **cryptopanic.com** | news, keyed | ⚠ site terms only (2017); developer terms JS | **No data clause found** — API terms unread |
| 19 | **messari.io** | news/metrics, keyed | ✅ (headless) | ⚠ **Internal use only; no republishing** except via marked widgets/APIs |
| 20 | **lunarcrush.com** | social, keyed | ✅ User Agreement (headless) | **Conditional** — licence "solely for purposes approved by LunarCrush"; scraping barred, API use is not scraping |
| 21 | **santiment.net** | social, keyed | ✅ T&C (July 2023) | ⚠ **"solely for your own private use"** — personal-only |
| 22 | **lido.fi** | stETH APR | ⚠ docs carry no terms; DAO Terms of Use read | **Favourable, no API document** — ToU governs the web interface |
| 23 | **marinade.finance** | mSOL APY | ⚠ docs carry no terms; Terms of Use read | **Favourable, no API document** |
| 24 | **jito.network** | jitoSOL APY | ✅ Terms of Use (footer) | ⚠ **Ambiguous** — anti-scraping clause names "the Interfaces", not the API |
| 25 | **rocketpool.net** | rETH APR | ✅ ToS (PDF) | ⚠ **Ambiguous** — anti-scraping clause names "the Site", not the API |
| 26 | **stride.zone** | stATOM etc. | ❌ no terms anywhere (site, docs) | **No document exists** |
| 27 | **beefy.finance** | discovery | ❌ no terms anywhere (site 404, docs) | **No document exists** |
| 28 | **pendle.finance** | discovery | ✅ Terms of Use (docs) | ⚠ **Ambiguous** — bars republishing "any data … of Pendle Protocol" except as law permits |
| 29 | **yearn.finance** | — (rung dropped 2026-09-26, T-399) | not read | **No longer fetched** |
| 30 | **yahoo.com** | — (prohibited since 2026-08-06) | ✅ | **Confirmed** — automated collection barred without permission |

Twelve read clean or better than the seed. **Nine carry a finding the owner must weigh**
(rows 10, 11, 12, 16, 17, 19, 21, 24, 25, 28). Three could not be read from any path
this machine has (13, 14, 15). Four have no document at all (8, 9, 26, 27) — which is a
fact to record, not a clearance.

---

## The one that changes something: OKX

`www.okx.com` serves `/live-data/funding-rates` and is an OHLCV fallback. The Terms of
Service (17 September 2026) point at a separate **OKX API Agreement** (§4.3), last updated
**28 July 2026**, which the registry had never named. Its §9.4, verbatim:

> **9.4 Market Data — Non-Commercial Use and Redistribution Restrictions**
> General Restriction. Market Data obtained through the API Services is proprietary to OKX
> or its data licensors. You may access and use Market Data **solely for your own personal,
> non-commercial trading and account management purposes**. You may not:
> (a) resell, redistribute, publish, **display**, or otherwise make Market Data available to
> any third party, whether for commercial gain or otherwise, without OKX's prior written
> consent;
> (b) use Market Data to build, operate, or contribute to any competing data product, market
> data service, **financial data aggregator, price feed, or analytics platform**;
> …
> Public Endpoint Data. … The restrictions in this Section 9.4 **apply equally to Market Data
> accessed through public endpoints** as to Market Data accessed through authenticated
> endpoints. The fact that Market Data is publicly accessible does not grant any right to
> redistribute, resell, or commercially exploit that data.

"Market Data" is defined (§1.8) to include funding rates and OHLCV explicitly. This is the
Dow Jones / Poloniex shape: not a pricing question, and D21 does not defer it. Two readings
are available and the owner picks:

- **Personal-only (D22).** A single-user run on the owner's machine is "your own personal
  … purposes"; the "analytics platform" clause in (b) is aimed at products. Keep OKX, mark
  it `⚠ SINGLE-USER ONLY` like Tiingo and Bitget, and it goes at the first non-owner page
  load.
- **Prohibited now.** (b) bars building an analytics platform on the data at all, personal
  or not; the app is one. Same treatment as Dow Jones: `prohibited`, socket block, and
  `funding-rates` loses its only source (it already answers with a stated reason when a
  source is missing).

Either way the registry's current `conditional` with a seeded "documented public endpoints"
finding is wrong and should not stand.

## Findings the owner must weigh

**Nasdaq Trader.** The symbol-directory page the registry names carries no terms. The
site's Copyright & Disclaimer page does:

> …the "Content", are owned … by The Nasdaq, Inc. … and **may not be copied, reproduced,
> transmitted, displayed, performed, distributed, rented, sublicensed, altered, stored for
> subsequent use or otherwise used** in whole or in part in any manner without the prior
> written consent of Nasdaq, except to the extent that such use constitutes "fair use" …
> and except for one temporary copy … for personal and non-commercial use only. … **Nasdaq
> stock symbols are proprietary to Nasdaq, Inc.**

The app reads `nasdaqlisted.txt` / `otherlisted.txt` — plain-text lists published for the
trading community, of facts (a symbol, a name, an exchange). Whether that is "Content" in
the sense of "design, text and images" is exactly the judgement CoinDesk and Investing.com
are parked on (T-407). Recommend adding it to that item rather than deciding it here.

**KuCoin** (Terms of Use, last updated 09/24/2026), Article 91:

> The Users are not allowed to resell or make commercial use of the Platform or any content
> thereof; the Users may not: … use any data collection robots or similar data collection
> and extraction tools for other commercial interests. Without the written permission of the
> Platform, it is strictly prohibited to systematically obtain the content of the Platform to
> directly or indirectly create or edit collections, compilations, databases…

A personal run reads inside it; a deployed product does not. `api.kucoin.com` carries the
withdrawal-fee overlay, which is a hidden surface (Transfer Fees is held out of rollout).
Recommend `⚠ SINGLE-USER ONLY` and the D22 trigger, same as Tiingo.

**Alpha Vantage** (Terms of Service, PDF), §2(a): the licence is "for personal,
non-commercial use", and use is commercial if, among four tests, "You plan to use or
provide information accessed through the Alpha Vantage Platform as part of any type of
commercial activity that allows individuals or entities other than User to access
information directly or indirectly". Commercial use is by written agreement
(premium@alphavantage.co). Identical shape to FMP/Finnhub/Twelve Data — joins T-151. It is
the last keyed rung of the equity quote ladder, so nothing is load-bearing on it.

**CoinMarketCap** — the registered URL now redirects to a docs landing; the operative
documents are two API agreements at `pro.coinmarketcap.com`. *Personal* terms: "The Service
is strictly for your personal use"; you may not "Copy, manipulate or aggregate any Content
(including data) for the purpose of making it available to any third party" nor "Download
or store Content other than for caching purposes". *Commercial* terms: a licence to "use,
reproduce, display, adapt, perform and store the Content solely on Your Product", and
**"Your Product shall prominently provide attribution to CoinMarketCap as follows: 'Data
provided by CoinMarketCap.com' and shall include a hyperlink to such website."** Which
agreement binds depends on which plan the owner's key is on. Two actions if it is ever the
commercial plan: the attribution string is not rendered today (`providers.ts` carries no
`attribution` for CMC, unlike CoinGecko) and would need to be; and the D22 trigger applies
on the personal plan.

**Messari** (Terms of Service): "your use of any and all Services … is for your internal
use only and only by one end user, and may not be resold, shared, redistributed,
published, posted publicly or remarketed", with a carve-out only for portions "clearly,
prominently, and expressly marked as permissible to share publicly (i.e., certain of our
APIs or widgets…)". Keyed and optional. Personal today; a public deployment needs the
marked widgets or an agreement.

**Santiment** (Terms and Conditions, July 2023), §10.3: "You shall use the Services solely
for your own private use and not for resale or other transfer to, or use by or for the
benefit of, any third party. You agree not to use, transfer, distribute, or dispose of any
data or information contained in the Services in any manner that could compete with the
business of Santiment." Keyed and optional. Personal-only on its face.

**Jito, Rocket Pool, Pendle — the same ambiguity three times.** Each protocol publishes a
public API the app reads, and each has a Terms document written for its *web interface*
that bars automated extraction from that interface:

- Jito (Terms of Use): "use any data mining tools, robots, crawlers, or similar data
  gathering and extraction tools to scrape or otherwise remove data from **the Interfaces
  or Features**" — `kobe.mainnet.jito.network` is documented as an API, not listed as an
  Interface.
- Rocket Pool (Terms of Service, PDF): "Use any robot, spider, crawler, scraper, or other
  automated means or interface not provided by us, to access **the Site** to extract data"
  — `api.rocketpool.net` is an interface provided by them.
- Pendle (Terms of Use): users shall not "copy, reproduce, republish, upload, post,
  transmit, resell, or distribute in any way, **any data, content, or any part of Pendle
  Protocol** except as expressly permitted by applicable laws".

Reading them as governing the APIs would put three staking-rate rungs and one discovery
rung on the wrong side; reading them as interface terms leaves the APIs where the seed put
them. Recommend the narrow reading (the one D25 chose for publicnode) with the ambiguity
recorded, and no flip to `verified` on any of the three.

## Read clean

**SEC** — Webmaster FAQ, fetched with the declared agent the FAQ itself prescribes:
"All Government-created content on sec.gov and EDGAR public filing content are free to
access and reuse"; "our current maximum access rate is 10 requests per second";
"Please declare your user agent in request headers" with the sample
`User-Agent: Sample Company Name AdminContact@sample company domain.com`. Both recorded
conditions are exact.

**Treasury** — the registered `/footer/data-quality` URL 404s, as do every guessed
variant; the live policy page is `/subfooter/site-policies-and-notices`, which states no
reuse restriction. Works of the federal government are not subject to copyright
(17 U.S.C. §105). Recommend the termsUrl be updated to the live page.

**Frankfurter** — "Is the API free for commercial use? Yes. The rates themselves fall
under each provider's terms." "There are no quotas. Requests are rate-limited to prevent
abuse." Open source; self-hostable.

**Wikimedia** — §7 Licensing: text under CC BY-SA 4.0 / GFDL; "these licenses do allow
commercial uses of your contributions, as long as such uses are compliant"; attribution
"Through hyperlink (where possible) or URL to … a stable online copy"; §12 API Terms
incorporate "the User-Agent Policy, the Robot Policy, and the API:Etiquette". The app
links each summary to its article; the UA should be descriptive.

**jsDelivr** — "using jsDelivr CDN is free for both personal and commercial use";
prohibited: "Scraping large amounts of otherwise infrequently accessed content …
Requesting unique files across hundreds of packages". One JSON file a day is the opposite
of that.

**alternative.me** — "Commercial use is allowed as long as the attribution is given right
next to the display of the data"; "You may not use our data to impersonate us". The
condition is specific: *beside the number*, not on a sources page. Worth confirming the
Fear & Greed surfaces do that.

**mempool.space** — the Terms of Service cover "their associated API services" and
consist of disclaimers, acceleration-service terms and sanctions exclusions; nothing
restricts reading the API.

**Blockchain.com** — the registered URL now returns an OpenAPI document whose
`x-guidance` reads "Free endpoints under /public/* return blockchain explorer data … no
payment required", contact `api@blockchain.com`. It is a spec, not terms; the site's own
Terms were not read.

**DefiLlama** — the docs (browser-rendered) publish `https://api.llama.fi` as the free
server and "a premium plan for 300$/mo" for "higher rate limits or priority support";
`/pools`, `/stablecoins` and the TVL endpoints the app reads are all on the free tier. No
terms-of-use text exists anywhere on the docs. The most load-bearing keyless source in the
app has no licence document to point at — that is the finding.

**Lido, Marinade** — the docs landings the registry names carry no terms; each project's
Terms of Use governs its web interface and says nothing about the data endpoints the app
reads (`eth-api.lido.fi`, `api.marinade.finance`). Lido's states its protocol code is
"freely licensed to the public". Marinade's states "any yield, return, or APY figures
displayed are estimates".

**Stride, Beefy** — no terms document on the site, in the docs, or at any conventional
path. Recorded as absent.

**CryptoPanic** — the site Terms (June 2017) are a generic boilerplate with no data or
API clause; the developer page the registry names renders only in a browser and was not
read. Keyed and optional.

**LunarCrush** — User Agreement §4.1 grants a licence "solely for purposes approved by
LunarCrush from time to time"; Appendix 1 bars "data mining, robots, scraping, or similar
data gathering methods of content or information from the Interface". Reading the API with
a key is not scraping the interface. No redistribution clause was found. Keyed and optional.

**Yahoo** — confirmed verbatim: "access or collect data, or attempt to access or collect
data, from our Services using any automated means … for any purpose without our [prior
written permission]". `prohibited` stands.

## Not read, and why

- **Binance.com** — `/en/terms` returns HTTP 202 with an empty body to curl, and renders
  only the site chrome (no article body) to headless Chrome and to the Chrome extension
  alike. Moot for this deployment: `api.binance.com` answers 451 to a US egress
  (DATA-AVAILABILITY.md, 2026-09-09), the app serves OHLCV from Binance.US, and
  `binance.us` is `verified`.
- **HTX (huobi.pro)** — the registry names the API docs; the Terms link redirects to a
  support landing page under both fetch paths.
- **XT.com** — the site serves an "Important Tips" interstitial to every path tried;
  `/en/terms` is 404. `sapi.xt.com` is one of the unprobed withdrawal-fee overlays.

All three are exchange hosts behind the hidden Transfer Fees surface or a geo-block.
None is load-bearing. They stay `seeded` with this note.

## What the owner is asked to decide (T-005 → T-413)

1. **OKX**: personal-only (D22 trigger) or `prohibited` now. §9.4 is quoted above.
2. **Nasdaq Trader**: add to T-407 with CoinDesk / Investing.com, or rule now.
3. **KuCoin**: `⚠ SINGLE-USER ONLY` + D22 trigger.
4. **Alpha Vantage, Messari, Santiment**: join the T-151 personal-vs-commercial keystone
   (all three are keyed, optional, and off by default).
5. **CoinMarketCap**: confirm which plan the key is on; if commercial, the attribution
   string must be rendered.
6. **Jito / Rocket Pool / Pendle**: accept the narrow (interface-only) reading, as D25 did
   for publicnode.
7. Which of the twelve clean readings to flip to `verified` — the flip is the owner's, as
   before; the registry entries are ready for it.

## Answered 2026-09-30 — D40–D46 (T-413 closed; T-005 waits on sign-off)

Rulings: `docs/decisions/2026-09-30-owner-decisions.md`.

1. **OKX → `prohibited` (D40).** Removed as a data source. `/live-data/funding-rates` has no
   source and answers `ok:false` with the reason.
2. **Nasdaq Trader → T-407 (D41)**, decided with CoinDesk and Investing.com. Kept in use
   meanwhile; the entry is `conditional` with the open question as its condition.
3. **KuCoin → `⚠ SINGLE-USER ONLY` + D22 trigger (D42).**
4. **Alpha Vantage, Messari, Santiment → `⚠ SINGLE-USER ONLY` (D43).**
5. **CoinMarketCap → treated as personal (D44).** The owner's key is free, absent or
   unconfirmed; the commercial plan's credit line is recorded as the route, not rendered.
6. **Jito, Rocket Pool, Pendle → the narrow reading (D45)**, as D25 took for publicnode.
   Each is `conditional` with an "API only" condition.
7. **Mark readings `verified` → not yet (D46).** Nothing flips, the six ruled entries
   included. T-005 stays open on that sign-off alone.

One correction to this audit: it says **nine** findings, but rows 10, 11, 12, 16, 17, 19,
21, 24, 25 and 28 are **ten** hosts.
