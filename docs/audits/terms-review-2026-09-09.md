# Source terms review worksheet — 2026-09-09

54 host(s). Probe output is **advisory**: it locates the document and
highlights candidate clauses. Read the linked terms, then record your conclusion and
flip the entry's `review` to `'verified'` in `src/lib/server/sourceTerms.ts`.

For a news feed, the four questions that actually settle it:

1. Is there a **separate RSS/syndication policy**, distinct from the site ToS? Publishers
   often permit far more via RSS than their general ToS suggests.
2. Does it restrict use to **personal / non-commercial**? Most news RSS terms do. Decide
   whether this deployment is inside that line.
3. What may be **displayed** — headline and link only, or headline + summary? The app shows
   the feed summary, so a headline-and-link-only policy is a code change, not a note.
4. Is **attribution** required, and in what form (name, logo, link back)? Record it as a
   `conditions` entry so it survives the next person.

---

## Yahoo (incl. Yahoo Finance) — `yahoo.com`

| | |
|---|---|
| Current verdict | `prohibited` (confidence: high) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html |
| Probe outcome | `blocked` |
| robots.txt | not checked |
| Terms found at | _none found at the usual locations_ |
| Summary | Yahoo (incl. Yahoo Finance)'s terms do not permit this use, so Finance Now does not fetch from yahoo.com. The query1/query2.finance.yahoo.com v8/v10 endpoints are undocumented internals of Yahoo's own web app — Yahoo publishes no third-party API terms granting programmatic access to them, and its Terms of Service prohibit accessing the services by automated means and reproducing or redistributing content. Covers finance.yahoo.com and feeds.finance.yahoo.com (per-ticker RSS) as well: the RSS feeds are published under the same ToS with no separate grant. Removed as a data source 2026-08-06. |

**Recorded finding:** The query1/query2.finance.yahoo.com v8/v10 endpoints are undocumented internals of Yahoo's own web app — Yahoo publishes no third-party API terms granting programmatic access to them, and its Terms of Service prohibit accessing the services by automated means and reproducing or redistributing content. Covers finance.yahoo.com and feeds.finance.yahoo.com (per-ticker RSS) as well: the RSS feeds are published under the same ToS with no separate grant. Removed as a data source 2026-08-06.

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## U.S. SEC (EDGAR) — `sec.gov`

| | |
|---|---|
| Current verdict | `conditional` (confidence: high) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.sec.gov/os/webmaster-faq#developers |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | _none found at the usual locations_ |
| Summary | U.S. SEC (EDGAR): permitted subject to 2 condition(s) — Send a descriptive User-Agent including a contact email on every request; Stay under 10 requests/second across all EDGAR hosts. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** EDGAR is public-domain U.S. government data and explicitly open to programmatic access, subject to a published access policy: a declared User-Agent carrying a contact address, and no more than 10 requests/second. Covers data.sec.gov and www.sec.gov.

**Recorded conditions:**
- Send a descriptive User-Agent including a contact email on every request
- Stay under 10 requests/second across all EDGAR hosts

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## DefiLlama — `llama.fi`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://defillama.com/docs/api |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (Could not resolve host: llama.fi) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | DefiLlama: permitted subject to 2 condition(s) — Attribute DefiLlama; Keep request volume within fair use — no bulk mirroring. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes a free, keyless, openly documented API for TVL, stablecoin supply and yields, offered for third-party use. No registration; fair-use rate limiting. Covers api.llama.fi, stablecoins.llama.fi, coins.llama.fi and yields.llama.fi.

**Recorded conditions:**
- Attribute DefiLlama
- Keep request volume within fair use — no bulk mirroring

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Financial Modeling Prep — `financialmodelingprep.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://site.financialmodelingprep.com/terms-of-service |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (fetch failed) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | Financial Modeling Prep: permitted subject to 2 condition(s) — A valid FMP API key must be configured — no keyless path; Stay within the plan's request cap and redistribution scope. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Commercial market-data API. Access is granted by the licence attached to the API key the operator holds; the free tier permits personal/development use at a documented request cap. Redistribution beyond the licensed application requires a higher plan.

**Recorded conditions:**
- A valid FMP API key must be configured — no keyless path
- Stay within the plan's request cap and redistribution scope

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Finnhub — `finnhub.io`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://finnhub.io/terms-of-service |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://finnhub.io/terms-of-service |
| Summary | Finnhub: permitted subject to 2 condition(s) — Valid API key required; Free tier is personal / non-commercial only. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Commercial market-data API with a registered free tier for personal and non-commercial use. Access is by API key; the free tier is explicitly not for commercial redistribution.

**Recorded conditions:**
- Valid API key required
- Free tier is personal / non-commercial only

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **prohibits redistribution** — “Redistribution Rights and Personal Use You hereby agree to not redistribute or share access to data or derived results from the data obtained from Finnhub with anyone or any 3rd party without written approval from Finnhub.”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Twelve Data — `twelvedata.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://twelvedata.com/terms |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://twelvedata.com/terms |
| Summary | Twelve Data: permitted subject to 2 condition(s) — Valid API key required; Respect the plan credit budget. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Commercial market-data API. Keyed access under the plan's licence; the free tier carries a hard credit budget (8 credits/min) and is for non-commercial use.

**Recorded conditions:**
- Valid API key required
- Respect the plan credit budget

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **prohibits redistribution** — “"Internal Use" means use solely for Customer's internal business purposes and not for redistribution or external commercial purposes.”
- 🔴 **requires prior written permission** — “(b) If the dispute is not resolved through such negotiations, it shall be referred to binding arbitration administered by the Singapore International Arbitration Centre ("SIAC") in Singapore in accordance with the Arbitration Rules of the Singapore International Arbitration Centre ("SIAC Rules") for the time being in force (c) Injunctive relief available for IP and confidentiality breaches 14.3 As”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Tiingo — `tiingo.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.tiingo.com/about/terms |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://tiingo.com/tos |
| Summary | Tiingo: permitted subject to 2 condition(s) — Valid API key required; Free tier is personal use — no redistribution. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Commercial market-data API with a free tier for personal use. Keyed access; end-of-day and IEX data carry exchange-derived redistribution limits set by the plan.

**Recorded conditions:**
- Valid API key required
- Free tier is personal use — no redistribution

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **prohibits automated access** — “(e) you shall not use any manual or automated software, devices or other processes (including but not limited to spiders, robots, scrapers, crawlers, avatars, data mining tools or the like) to “scrape” or download data from any web pages contained in the Website (except that we grant the operators of public search engines revocable permission to use spiders to copy materials from the Website for t”
- 🔴 **prohibits scraping** — “(e) you shall not use any manual or automated software, devices or other processes (including but not limited to spiders, robots, scrapers, crawlers, avatars, data mining tools or the like) to “scrape” or download data from any web pages contained in the Website (except that we grant the operators of public search engines revocable permission to use spiders to copy materials from the Website for t”
- 🔴 **prohibits redistribution** — “Subject to your compliance with the Terms, Company grants you a limited non-exclusive, non-transferable, non-sublicensable, revocable license to download, install and use a copy of the Application on unlimited mobile devices or computers that you own or control and to run such copy of the Application solely for your own personal or internal business purposes.”
- 🔴 **requires prior written permission** — “You may not use the Widget for any other purpose without our prior written consent, and nothing in the Terms shall be deemed to grant you any right, title or interest in the Widget.”
- 🟢 **grants a licence to use the data** — “Subject to your compliance with the Terms, we hereby grant you a non-exclusive, non-transferable, non-sublicensable, revocable license to use and display the Widget on your website for your own personal or internal business purposes.”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Alpha Vantage — `alphavantage.co`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.alphavantage.co/terms_of_service/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (HTTP 404) — no stated restriction |
| Terms found at | https://www.alphavantage.co/terms_of_service/ |
| Summary | Alpha Vantage: permitted subject to 2 condition(s) — Valid API key required; Free tier is 25 requests/day — do not exceed. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Documented public API issued against a free key, offered for third-party application use at 25 requests/day on the free tier.

**Recorded conditions:**
- Valid API key required
- Free tier is 25 requests/day — do not exceed

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## CoinMarketCap — `coinmarketcap.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://coinmarketcap.com/api/documentation/v1/#section/Terms-of-Use |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://coinmarketcap.com/currencies/aptos/ |
| Summary | CoinMarketCap: permitted subject to 2 condition(s) — Valid API key required; Attribute CoinMarketCap on any surface showing its data. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Commercial API. Keyed access under a plan licence; attribution to CoinMarketCap is required wherever its data is displayed.

**Recorded conditions:**
- Valid API key required
- Attribute CoinMarketCap on any surface showing its data

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Binance — `binance.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.binance.com/en/terms |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (fetch failed) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | Binance: permitted subject to 1 condition(s) — Respect the published per-endpoint request weights. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes documented, keyless public market-data REST endpoints intended for programmatic use, under per-endpoint request weights. Note this is a terms verdict, not an availability one: binance.com answers 451 from many hosts on geographic grounds.

**Recorded conditions:**
- Respect the published per-endpoint request weights

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Binance.US — `binance.us`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.binance.us/terms |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://binance.us/terms-of-use |
| Summary | Binance.US: permitted subject to 2 condition(s) — Respect the published per-endpoint request weights; Report the serving venue — it is a different market than binance.com. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Same documented keyless public market-data endpoints as the global venue, under US terms and weights.

**Recorded conditions:**
- Respect the published per-endpoint request weights
- Report the serving venue — it is a different market than binance.com

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **prohibits automated access** — “(2) use any robot, spider, other automatic device, or manual process to monitor or copy our Website without our prior written permission;”
- 🔴 **prohibits scraping** — “harvest or otherwise collect information from the Website about others, including without limitation email addresses, without proper consent.”
- 🔴 **prohibits redistribution** — “We hereby grant you a limited, nonexclusive, and non-sublicensable license to access and use the Materials for your non-commercial personal or internal business uses.”
- 🔴 **requires prior written permission** — “(2) use any robot, spider, other automatic device, or manual process to monitor or copy our Website without our prior written permission;”
- 🟢 **grants a licence to use the data** — “We hereby grant you a limited, nonexclusive, and non-sublicensable license to access and use the Materials for your non-commercial personal or internal business uses.”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## OKX — `okx.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.okx.com/docs-v5/en/#overview |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://okx.com/en-us/help/terms-of-service-us |
| Summary | OKX: permitted subject to 1 condition(s) — Respect the published v5 rate limits. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Documented keyless public market-data API (v5) with published rate limits, offered for programmatic use.

**Recorded conditions:**
- Respect the published v5 rate limits

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **requires prior written permission** — “19.3 Assignment : You may not assign any rights, obligations and/or licenses granted under these Terms without our prior written consent.”
- 🟢 **grants a licence to use the data** — “USERS’ RIGHTS AND LIMITATIONS TO USE We grant you a limited, non-exclusive, non-transferable permit, subject to these Terms, to access and use the Services, solely for purposes approved by us.”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## StockTwits — `stocktwits.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: low) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://stocktwits.com/terms |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://stocktwits.com/about/legal/terms |
| Summary | StockTwits: permitted subject to 2 condition(s) — Attribute StockTwits on any surface showing its messages; Display only — do not mirror, store long-term, or re-serve message content. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Public symbol-stream endpoints are reachable without a key and are widely used by third-party apps, but the terms reserve the platform's content and require attribution. Treat message text as StockTwits content shown with credit, not as data to store or re-serve.

**Recorded conditions:**
- Attribute StockTwits on any surface showing its messages
- Display only — do not mirror, store long-term, or re-serve message content

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **prohibits automated access** — “No Unauthorized Managed, Automated, or Scraping Access You may not share your account credentials, provide managed access to your account, or use the Service through an unauthorized third-party posting service, scraping service, automation service, signal service, copy-trading service, account-management service, or similar arrangement.”
- 🔴 **prohibits scraping** — “No Unauthorized Managed, Automated, or Scraping Access You may not share your account credentials, provide managed access to your account, or use the Service through an unauthorized third-party posting service, scraping service, automation service, signal service, copy-trading service, account-management service, or similar arrangement.”
- 🔴 **prohibits redistribution** — “You grant Stocktwits a worldwide, non-exclusive, royalty-free, transferable, sublicensable license to host, store, cache, reproduce, copy, transmit, distribute, display, perform, modify, adapt, reformat, excerpt, index, moderate, and otherwise use your User Content as necessary to operate, secure, improve, troubleshoot, enforce, promote, and provide the Service and its functionality.”
- 🟢 **grants a licence to use the data** — “Limited License to Use the Service Subject to your compliance with these Terms, we grant you a limited, revocable, non-exclusive, non-transferable license to access and use the Service for its intended purposes.”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Reddit — `reddit.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: low) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://redditinc.com/policies/data-api-terms |
| Probe outcome | `blocked` |
| robots.txt | robots.txt disallows / for financenow |
| Terms found at | _none found at the usual locations_ |
| Summary | reddit.com publishes a robots.txt that disallows automated access to /. Finance Now honours it. |

**Recorded finding:** Reddit's Data API Terms govern programmatic access and require registered OAuth credentials for anything beyond incidental use; unauthenticated datacenter requests are refused (403) by design rather than by accident. Public .rss/.json endpoints are read at low volume for display only.

**Recorded conditions:**
- Read-only, low volume, display only — no dataset building
- Register OAuth credentials before increasing volume
- Expect and accept 403s from datacenter IPs rather than working around them

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## YouTube — `youtube.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://developers.google.com/youtube/terms/api-services-terms-of-service |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://youtube.com/terms |
| Summary | YouTube: permitted subject to 2 condition(s) — Link or embed via the YouTube player — never download or re-host video; Data API searches only on an explicit user action (quota). ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Per-channel Atom feeds (/feeds/videos.xml) and the Data API v3 are published for third-party use. The API is keyed and quota-metered (100 units per search against 10,000/day); embedding must use the YouTube player, and video content must not be downloaded.

**Recorded conditions:**
- Link or embed via the YouTube player — never download or re-host video
- Data API searches only on an explicit user action (quota)

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **prohibits scraping** — “access the Service using any automated means (such as robots, botnets or scrapers) except (a) in the case of public search engines, in accordance with YouTube’s robots.txt file;”
- 🔴 **prohibits redistribution** — “License to YouTube By providing Content to the Service, you grant to YouTube a worldwide, non-exclusive, royalty-free, sublicensable and transferable license to use that Content (including to reproduce, distribute, prepare derivative works, display and perform it) in connection with the Service and YouTube’s (and its successors' and Affiliates') business, including for the purpose of promoting and”
- 🔴 **personal / non-commercial use only** — “You may view or listen to Content for your personal, non-commercial use.”
- 🔴 **requires prior written permission** — “or (b) with prior written permission from YouTube and, if applicable, the respective rights holders;”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## jsDelivr (currency-api mirror) — `cdn.jsdelivr.net`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.jsdelivr.com/terms |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (HTTP 400) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | jsDelivr (currency-api mirror): permitted subject to 1 condition(s) — Label extended-tier FX as community-sourced, never as ECB — the UI already does. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Open-source CDN serving the community `fawazahmed0/currency-api` dataset. The CDN permits public asset delivery; the dataset itself is community-maintained and is not an official central-bank source.

**Recorded conditions:**
- Label extended-tier FX as community-sourced, never as ECB — the UI already does

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Wikipedia — `wikipedia.org`

| | |
|---|---|
| Current verdict | `conditional` (confidence: high) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://foundation.wikimedia.org/wiki/Special:MyLanguage/Policy:Terms_of_Use |
| Summary | Wikipedia: permitted subject to 2 condition(s) — Send an identifying User-Agent; Attribute Wikipedia and preserve CC BY-SA on reused text. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Article text is CC BY-SA licensed and the REST summary API is public, subject to the Wikimedia User-Agent policy requiring an identifying agent string.

**Recorded conditions:**
- Send an identifying User-Agent
- Attribute Wikipedia and preserve CC BY-SA on reused text

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **prohibits redistribution** — “Licensing of Content To grow the commons of free knowledge and free culture, all users contributing to the Projects or Project Websites are required to grant broad permissions to the general public to redistribute and reuse their contributions freely, so long as that use is properly attributed and the same freedom to reuse and redistribute is granted to any derivative works.”
- 🟢 **open / permissive licence** — “Part of our mission is to : Empower and Engage people around the world to collect and develop educational content and either publish it under a free license or dedicate it to the public domain.”
- 🟢 **attribution-based permission** — “When reusing any content that we host, you agree to comply with the relevant attribution requirements as they pertain to the underlying license or licenses.”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## U.S. Treasury — `home.treasury.gov`

| | |
|---|---|
| Current verdict | `approved` (confidence: high) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://home.treasury.gov/footer/data-quality |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | _none found at the usual locations_ |
| Summary | U.S. Treasury: terms permit programmatic use. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Daily par yield curve XML published by a U.S. federal agency. U.S. government works are not subject to copyright and the data is published expressly for public reuse.

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Frankfurter (ECB reference rates) — `frankfurter.dev`

| | |
|---|---|
| Current verdict | `approved` (confidence: high) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://frankfurter.dev/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | _none found at the usual locations_ |
| Summary | Frankfurter (ECB reference rates): terms permit programmatic use. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Open-source, keyless API republishing the ECB's daily reference rates, which the ECB publishes for free reuse with attribution. No registration and no usage restriction stated.

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Nasdaq Trader (symbol directory) — `nasdaqtrader.com`

| | |
|---|---|
| Current verdict | `approved` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.nasdaqtrader.com/Trader.aspx?id=symboldirdefs |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | http://www.nasdaqtrader.com/content/MarketStatistics/MarketShare/terms.pdf |
| Summary | Nasdaq Trader (symbol directory): terms permit programmatic use. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Symbol directory files published on a public FTP/HTTP endpoint expressly as a reference resource for market participants. Listing metadata only — no quotes.

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## mempool.space — `mempool.space`

| | |
|---|---|
| Current verdict | `approved` (confidence: high) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://mempool.space/docs/api/rest |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (The operation was aborted due to timeout) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | mempool.space: terms permit programmatic use. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Open-source Bitcoin explorer publishing a documented, keyless REST API for public use.

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Bitget (public market-data API) — `bitget.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: low) |
| Review state | ⚠️ **seeded — never read** (2026-08-21) |
| Registered terms URL | https://www.bitget.com/api-doc/spot/market/Get-Coin-List |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://bitget.com/terms/legal/360014944032 |
| Summary | Bitget (public market-data API): permitted subject to 2 condition(s) — Respect documented rate limits; Keyless public endpoints only — no authenticated endpoints (RP-5). ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes a documented public REST API; the spot public coin list (incl. per-chain withdrawal fees) is documented as unauthenticated. Seeded from the published API documentation — the exchange ToS have not been read for this project, and the endpoint itself is unprobed (see the Bybit removal: a seeded public claim loses to the owner probe).

**Recorded conditions:**
- Respect documented rate limits
- Keyless public endpoints only — no authenticated endpoints (RP-5)

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **requires prior written permission** — “(xv) create, or purport to create, any security over your Digital Assets held in your Account without our prior written consent;”
- 🟢 **grants a licence to use the data** — “Bitget hereby grants to you a non-exclusive license for the duration of these Terms, or until we suspend or terminate your access to the Services, whichever is sooner, to use the Bitget IP Rights, excluding the Trade Marks, solely as necessary to allow you to receive the Services for non-commercial personal or internal business use, in accordance with these Terms.”
- 🟢 **open / permissive licence** — “and (iv) to the extent that the relevant confidential information is in the public domain other than as a result of a breach of these Terms.”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Poloniex (public market-data API) — `poloniex.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: low) |
| Review state | ⚠️ **seeded — never read** (2026-08-21) |
| Registered terms URL | https://api-docs.poloniex.com/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | _none found at the usual locations_ |
| Summary | Poloniex (public market-data API): permitted subject to 2 condition(s) — Respect documented rate limits; Keyless public endpoints only — no authenticated endpoints (RP-5). ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes a documented public REST API; the currencies reference (incl. withdrawal fees) is documented as unauthenticated. Seeded from the published API documentation — the exchange ToS have not been read for this project, and the endpoint itself is unprobed (see the Bybit removal: a seeded public claim loses to the owner probe).

**Recorded conditions:**
- Respect documented rate limits
- Keyless public endpoints only — no authenticated endpoints (RP-5)

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## LBank (public market-data API) — `lbkex.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: low) |
| Review state | ⚠️ **seeded — never read** (2026-08-21) |
| Registered terms URL | https://www.lbank.com/docs/index.html |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (Could not resolve host: lbkex.com) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | LBank (public market-data API): permitted subject to 2 condition(s) — Respect documented rate limits; Keyless public endpoints only — no authenticated endpoints (RP-5). ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes a documented public REST API; withdrawConfigs is documented as an unauthenticated public endpoint. Seeded from the published API documentation — the exchange ToS have not been read for this project, and the endpoint itself is unprobed (see the Bybit removal: a seeded public claim loses to the owner probe).

**Recorded conditions:**
- Respect documented rate limits
- Keyless public endpoints only — no authenticated endpoints (RP-5)

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Bitfinex (public conf API) — `bitfinex.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: low) |
| Review state | ⚠️ **seeded — never read** (2026-08-21) |
| Registered terms URL | https://docs.bitfinex.com/reference/rest-public-conf |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://bitfinex.com/legal/exchange/terms/ |
| Summary | Bitfinex (public conf API): permitted subject to 2 condition(s) — Respect documented rate limits; Keyless public endpoints only — no authenticated endpoints (RP-5). ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes a documented public REST API; the v2 public conf endpoints (incl. the currency tx-fee map) are documented as unauthenticated. Seeded from the published API documentation — the exchange ToS have not been read for this project, and the endpoint itself is unprobed (see the Bybit removal: a seeded public claim loses to the owner probe).

**Recorded conditions:**
- Respect documented rate limits
- Keyless public endpoints only — no authenticated endpoints (RP-5)

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## XT.com (public market-data API) — `xt.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: low) |
| Review state | ⚠️ **seeded — never read** (2026-08-21) |
| Registered terms URL | https://doc.xt.com/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (fetch failed) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | XT.com (public market-data API): permitted subject to 2 condition(s) — Respect documented rate limits; Keyless public endpoints only — no authenticated endpoints (RP-5). ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes a documented public REST API; the public wallet-support currency endpoint is documented as unauthenticated. Seeded from the published API documentation — the exchange ToS have not been read for this project, and the endpoint itself is unprobed (see the Bybit removal: a seeded public claim loses to the owner probe).

**Recorded conditions:**
- Respect documented rate limits
- Keyless public endpoints only — no authenticated endpoints (RP-5)

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## PublicNode (Allnodes) — free public RPC gateways — `publicnode.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: low) |
| Review state | ⚠️ **seeded — never read** (2026-08-22) |
| Registered terms URL | https://www.publicnode.com/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://aptos.publicnode.com/ |
| Summary | PublicNode (Allnodes) — free public RPC gateways: permitted subject to 3 condition(s) — Read-only public JSON-RPC methods only; One request per chain per revalidate window — do not poll; Degrade to the static estimate rather than retrying on failure. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Operates free, keyless public JSON-RPC gateways for ~75 chains, advertised for open public use with no signup or API key. Used here for a single eth_gasPrice read per chain per revalidate window — far inside any reasonable public-endpoint budget. Seeded from the service's publicly advertised posture; the terms document has not been read for this project, and the endpoints themselves are unprobed from this environment.

**Recorded conditions:**
- Read-only public JSON-RPC methods only
- One request per chain per revalidate window — do not poll
- Degrade to the static estimate rather than retrying on failure

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## KuCoin (public market-data API) — `kucoin.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-21) |
| Registered terms URL | https://www.kucoin.com/docs |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://kucoin.com/legal/special-treatment |
| Summary | KuCoin (public market-data API): permitted subject to 2 condition(s) — Respect documented rate limits; Keyless public endpoints only — no authenticated endpoints (RP-5). ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** KuCoin publishes a documented public REST API; the currencies endpoint (incl. per-chain withdrawal fees) is unauthenticated. Docs impose public rate limits. Seeded from the published API documentation — the exchange ToS have not been read for this project.

**Recorded conditions:**
- Respect documented rate limits
- Keyless public endpoints only — no authenticated endpoints (RP-5)

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## HTX / Huobi (public market-data API) — `huobi.pro`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-21) |
| Registered terms URL | https://huobiapi.github.io/docs/spot/v1/en/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (fetch failed) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | HTX / Huobi (public market-data API): permitted subject to 2 condition(s) — Respect documented rate limits; Keyless public endpoints only — no authenticated endpoints (RP-5). ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** HTX publishes a documented public REST API; v2/reference/currencies (incl. per-chain withdrawal fees) is unauthenticated. Seeded from the published API documentation — the exchange ToS have not been read for this project.

**Recorded conditions:**
- Respect documented rate limits
- Keyless public endpoints only — no authenticated endpoints (RP-5)

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Blockchain.com (explorer) — `blockchain.info`

| | |
|---|---|
| Current verdict | `approved` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.blockchain.com/explorer/api |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://blockchain.info/terms |
| Summary | Blockchain.com (explorer): terms permit programmatic use. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Documented keyless explorer API published for public use; used here only as a fallback for chain stats.

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **prohibits scraping** — “UK regulatory protections do not apply","poppy.institutional.otc.carousel.card_8.title":"REGULATED","poppy.institutional.otc.carousel.card_8.title.uk":"Regulated {br} \u0026 trusted","poppy.institutional.otc.carousel.title":"Full suite of OTC capabilities","poppy.institutional.otc.options.accordion1.body":"BTC and ETH derivatives built on an institutional OTC framework for precise risk management,”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## alternative.me (Fear & Greed) — `alternative.me`

| | |
|---|---|
| Current verdict | `approved` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://alternative.me/crypto/fear-and-greed-index/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://alternative.me/terms/ |
| Summary | alternative.me (Fear & Greed): terms permit programmatic use. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes the Fear & Greed Index over a documented keyless API and asks only for a link back to the index page.

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **prohibits scraping** — “(i) to spam, phish, pharm, pretext, spider, crawl, or scrape;”
- 🔴 **prohibits redistribution** — “You agree not to reproduce, duplicate, copy, sell, resell or exploit any portion of the Service, use of the Service, or access to the Service or any contact on the website through which the service is provided, without express written permission by us.”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Lido — `lido.fi`

| | |
|---|---|
| Current verdict | `approved` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://docs.lido.fi/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://lido.fi/terms-of-use |
| Summary | Lido: terms permit programmatic use. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Protocol publishes documented keyless APR endpoints for public/integrator use.

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **prohibits redistribution** — “12 License to Use Interface Each User, subject to their eligibility, acceptance, and adherence to these Terms, is hereby granted a personal, revocable, non-exclusive, non-transferable, non-sublicensable license to view, access and use the Interface for the Permitted Uses in accordance with these Terms.”
- 🟢 **grants a licence to use the data** — “12 License to Use Interface Each User, subject to their eligibility, acceptance, and adherence to these Terms, is hereby granted a personal, revocable, non-exclusive, non-transferable, non-sublicensable license to view, access and use the Interface for the Permitted Uses in accordance with these Terms.”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Marinade — `marinade.finance`

| | |
|---|---|
| Current verdict | `approved` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://docs.marinade.finance/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://marinade.finance/terms |
| Summary | Marinade: terms permit programmatic use. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Protocol publishes documented keyless APY endpoints for public/integrator use.

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **prohibits redistribution** — “Subject to your compliance with these Terms, we grant you a non-exclusive, non-sublicensable license, and any limited license to merely use or access the Website and the Services as permitted hereunder.”
- 🔴 **requires prior written permission** — “Assignment You may not assign or transfer any right to use the Services or any of your rights or obligations under these Terms without prior written consent from Marinade Finance, including any right or obligation related to the enforcement of laws or the change of control.”
- 🟢 **grants a licence to use the data** — “Subject to your compliance with these Terms, we grant you a non-exclusive, non-sublicensable license, and any limited license to merely use or access the Website and the Services as permitted hereunder.”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Jito — `jito.network`

| | |
|---|---|
| Current verdict | `approved` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://docs.jito.network/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (HTTP 403) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | Jito: terms permit programmatic use. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Protocol publishes documented keyless APY endpoints for public/integrator use.

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Google APIs (YouTube Data API v3) — `googleapis.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://developers.google.com/youtube/terms/api-services-terms-of-service |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (HTTP 404) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | Google APIs (YouTube Data API v3): permitted subject to 3 condition(s) — Registered API key required; Search only on an explicit user action — 100 quota units each; Do not persist API responses beyond the permitted cache window. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Reached only for the YouTube Data API v3 search endpoint, under the YouTube API Services Terms: a registered project key, a 10,000-unit daily quota (100 per search), and no storing of API data beyond the permitted caching window.

**Recorded conditions:**
- Registered API key required
- Search only on an explicit user action — 100 quota units each
- Do not persist API responses beyond the permitted cache window

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## CryptoPanic — `cryptopanic.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://cryptopanic.com/developers/api/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | _none found at the usual locations_ |
| Summary | CryptoPanic: permitted subject to 2 condition(s) — Paid API key required; Attribute CryptoPanic and link back to source articles. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Commercial news-aggregation API. Keyed access under a plan licence; the free tier ended April 2026, so any use now is under a paid plan's terms.

**Recorded conditions:**
- Paid API key required
- Attribute CryptoPanic and link back to source articles

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Messari — `messari.io`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://messari.io/terms-of-service |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (HTTP 429) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | Messari: permitted subject to 2 condition(s) — Valid API key required; Display with attribution — no redistribution of research content. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Commercial research and data API. Keyed access under the plan licence; redistribution of research content is restricted.

**Recorded conditions:**
- Valid API key required
- Display with attribution — no redistribution of research content

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## LunarCrush — `lunarcrush.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://lunarcrush.com/about/terms |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | _none found at the usual locations_ |
| Summary | LunarCrush: permitted subject to 2 condition(s) — Valid API key required; Attribute LunarCrush on any surface showing its scores. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Commercial social-analytics API. Keyed access under the plan licence. Note this is a terms verdict, not an availability one — LunarCrush also blocks datacenter IPs.

**Recorded conditions:**
- Valid API key required
- Attribute LunarCrush on any surface showing its scores

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Santiment — `santiment.net`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://santiment.net/terms-and-conditions/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://santiment.net/terms/ |
| Summary | Santiment: permitted subject to 2 condition(s) — Valid API key required; Stay within the plan's metric and history entitlements. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Commercial on-chain and social analytics GraphQL API. Keyed access under the plan licence.

**Recorded conditions:**
- Valid API key required
- Stay within the plan's metric and history entitlements

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **prohibits redistribution** — “In case that You wish to resell Santiment’s Data to third parties, a corporate subscription is required.”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Rocket Pool — `rocketpool.net`

| | |
|---|---|
| Current verdict | `approved` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://docs.rocketpool.net/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | _none found at the usual locations_ |
| Summary | Rocket Pool: terms permit programmatic use. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Protocol publishes documented keyless network-stats endpoints for public/integrator use.

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Stride — `stride.zone`

| | |
|---|---|
| Current verdict | `approved` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://docs.stride.zone/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | _none found at the usual locations_ |
| Summary | Stride: terms permit programmatic use. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Protocol publishes documented keyless liquid-staking APY endpoints for public/integrator use.

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Beefy Finance — `beefy.finance`

| | |
|---|---|
| Current verdict | `approved` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://docs.beefy.finance/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | _none found at the usual locations_ |
| Summary | Beefy Finance: terms permit programmatic use. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Protocol publishes a documented keyless vault/APY API for public/integrator use.

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Yearn Finance — `yearn.finance`

| | |
|---|---|
| Current verdict | `approved` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://docs.yearn.fi/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | _none found at the usual locations_ |
| Summary | Yearn Finance: terms permit programmatic use. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Protocol publishes a documented keyless vault/APY API for public/integrator use.

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Pendle — `pendle.finance`

| | |
|---|---|
| Current verdict | `approved` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://docs.pendle.finance/Developers/Overview |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://docs.pendle.finance/pendle-v2/TermsOfUse?utm_source=landing&amp;utm_medium=landing |
| Summary | Pendle: terms permit programmatic use. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Protocol publishes a documented keyless market/yield API for public/integrator use.

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **prohibits automated access** — “User shall not crawl, scrape, cache or otherwise access any content from the Website via automated means, and User shall not use automated data collection, data mining, robots or any other data gathering methods of any kind on the Website and/or Pendle Protocol.”
- 🔴 **prohibits scraping** — “User shall not crawl, scrape, cache or otherwise access any content from the Website via automated means, and User shall not use automated data collection, data mining, robots or any other data gathering methods of any kind on the Website and/or Pendle Protocol.”
- 🔴 **prohibits redistribution** — “Unless with our prior written consent, the Website and its contents must not be reproduced, modified, redistributed or otherwise used for any other reason.”
- 🔴 **requires prior written permission** — “Unless with our prior written consent, the Website and its contents must not be reproduced, modified, redistributed or otherwise used for any other reason.”
- 🟢 **grants a licence to use the data** — “You are hereby granted a non-exclusive, non-transferable, revocable, limited licence to electronically access and use the Website in the manner described in these Terms.”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## CoinDesk — `coindesk.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.coindesk.com/terms |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (HTTP 429) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | CoinDesk: permitted subject to 2 condition(s) — Headline, link and feed summary only; Attribute and link back to the origin article. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes a public RSS feed. Syndication of headline/link/summary with attribution and a link back is the intended use; full-text reproduction is not.

**Recorded conditions:**
- Headline, link and feed summary only
- Attribute and link back to the origin article

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Cointelegraph — `cointelegraph.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://cointelegraph.com/terms-and-privacy |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://cointelegraph.com/terms-and-privacy |
| Summary | Cointelegraph: permitted subject to 2 condition(s) — Headline, link and feed summary only; Attribute and link back to the origin article. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes a public RSS feed for syndication of headline/link/summary with attribution.

**Recorded conditions:**
- Headline, link and feed summary only
- Attribute and link back to the origin article

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **prohibits automated access** — “Redistribution, reproduction, automated scraping, or creation of independent content pipelines based on Cointelegraph reputation is strictly prohibited without prior written authorization.”
- 🔴 **prohibits scraping** — “Redistribution, reproduction, automated scraping, or creation of independent content pipelines based on Cointelegraph reputation is strictly prohibited without prior written authorization.”
- 🔴 **prohibits redistribution** — “Redistribution, reproduction, automated scraping, or creation of independent content pipelines based on Cointelegraph reputation is strictly prohibited without prior written authorization.”
- 🔴 **personal / non-commercial use only** — “Rights of use In accessing and using the Website you agree that you may only download the content, including text, pictures, graphics, video, audio material, software or any other form, of the Website or any portion of it (“Content”), for your own personal non-commercial use.”
- 🔴 **requires prior written permission** — “Redistribution, reproduction, automated scraping, or creation of independent content pipelines based on Cointelegraph reputation is strictly prohibited without prior written authorization.”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Decrypt — `decrypt.co`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://decrypt.co/terms |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://decrypt.co/price/aptos |
| Summary | Decrypt: permitted subject to 2 condition(s) — Headline, link and feed summary only; Attribute and link back to the origin article. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes a public RSS feed for syndication of headline/link/summary with attribution.

**Recorded conditions:**
- Headline, link and feed summary only
- Attribute and link back to the origin article

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Bitcoin Magazine — `bitcoinmagazine.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://bitcoinmagazine.com/terms-of-use |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://bitcoinmagazine.com/terms-of-use |
| Summary | Bitcoin Magazine: permitted subject to 2 condition(s) — Headline, link and feed summary only; Attribute and link back to the origin article. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes a public RSS feed for syndication of headline/link/summary with attribution.

**Recorded conditions:**
- Headline, link and feed summary only
- Attribute and link back to the origin article

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **requires prior written permission** — “Unauthorized reproduction, distribution, or modification is prohibited without our prior written consent.”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Dow Jones (MarketWatch feed delivery) — `dowjones.io`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.marketwatch.com/terms-of-use |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (Could not resolve host: dowjones.io) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | Dow Jones (MarketWatch feed delivery): permitted subject to 3 condition(s) — Headline, link and feed summary only; Attribute MarketWatch and link back; Personal, non-commercial use. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** feeds.content.dowjones.io serves MarketWatch's public top-stories RSS. Dow Jones publishes it for syndication; the terms are personal, non-commercial use with attribution, and expressly not bulk reproduction of article text.

**Recorded conditions:**
- Headline, link and feed summary only
- Attribute MarketWatch and link back
- Personal, non-commercial use

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## MarketWatch — `marketwatch.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.marketwatch.com/terms-of-use |
| Probe outcome | `blocked` |
| robots.txt | robots.txt disallows / for financenow |
| Terms found at | _none found at the usual locations_ |
| Summary | marketwatch.com publishes a robots.txt that disallows automated access to /. Finance Now honours it. |

**Recorded finding:** Same terms as the Dow Jones feed host — syndication of headline/link/summary, personal and non-commercial, with attribution.

**Recorded conditions:**
- Headline, link and feed summary only
- Attribute and link back
- Personal, non-commercial use

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## CNBC — `cnbc.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.nbcuniversal.com/terms |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (HTTP 404) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | CNBC: permitted subject to 2 condition(s) — Headline, link and feed summary only; Attribute CNBC and link back. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes public RSS feeds per desk for syndication of headline/link/summary with attribution and a link back.

**Recorded conditions:**
- Headline, link and feed summary only
- Attribute CNBC and link back

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## Investing.com — `investing.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.investing.com/about-us/terms-and-conditions |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (HTTP 403) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | Investing.com: permitted subject to 2 condition(s) — RSS feed only — never scrape the HTML site; Headline, link and summary only, with attribution. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes per-desk RSS feeds for syndication. Terms permit personal, non-commercial use of the feed with attribution; scraping the site itself is prohibited separately.

**Recorded conditions:**
- RSS feed only — never scrape the HTML site
- Headline, link and summary only, with attribution

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## OilPrice.com — `oilprice.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://oilprice.com/terms-of-use |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://oilprice.com/terms-and-conditions |
| Summary | OilPrice.com: permitted subject to 2 condition(s) — Headline, link and feed summary only; Attribute and link back. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes a public RSS feed and permits syndication of headline/link/summary with attribution and a link back.

**Recorded conditions:**
- Headline, link and feed summary only
- Attribute and link back

**Clauses the probe flagged** (read them in context — a keyword is not a clause):

- 🔴 **personal / non-commercial use only** — “Disclaimers (a) The information provided on the Oilprice.com website is for personal, non-commercial use.”
- 🔴 **requires prior written permission** — “User agrees to not take any action that imposes an unreasonable or disproportionately large load on the Oilprice.com infrastructure and User agrees not to engage in any unauthorized framing, linking, or deep-linking to the Oilprice.com website without the prior written consent of Oilprice.com.”

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---

## FXStreet — `fxstreet.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.fxstreet.com/about/terms-of-service |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://www.fxstreet.com/cryptocurrencies/news/cryptos-638-million-buyback-boom-may-not-be-as-bullish-as-it-looks-202609040732 |
| Summary | FXStreet: permitted subject to 2 condition(s) — Headline, link and feed summary only; Attribute and link back. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes a public RSS feed for syndication with attribution and a link back to the origin article.

**Recorded conditions:**
- Headline, link and feed summary only
- Attribute and link back

_No clauses matched. That is not a pass — it may mean the document was not the
right one, or the wording is unusual. Check the page the probe actually read._

**Your conclusion:**

- [ ] Verdict confirmed as recorded
- [ ] Verdict changed to: `________`
- [ ] Conditions to add/change: `________`

---
