> # ⚠ ARCHIVED — not a live document, and never was a reading
>
> **Archived 2026-09-20, the day it was generated.** Kept rather than deleted, per the
> owner's standing rule against deleting project files.
>
> **What it is.** Output of `npm run terms:report -- --seeded` — a generated *checklist*
> that locates each host's registered terms URL and restates the verdict already in the
> registry. Every "Your conclusion" box below is blank, because nobody filled one in.
>
> **Why it is archived.** It duplicates `docs/audits/terms-review-2026-09-09.md` (54 hosts,
> 80 KB), which is the same generated template — also with every box blank. Running the
> probe again produced another checklist, not another reading. Two unfilled worksheets in
> `docs/audits/` read like two audits; they are zero.
>
> **The lesson worth keeping.** The probe reports `registry-seeded` and "Terms found at:
> _none found at the usual locations_" for almost every host. That is the tool being
> honest — it did not fetch and read the documents, and it says so. Reaching for it again
> will not advance the backlog. Reading the documents will.
>
> **What superseded it**, all dated 2026-09-20 unless noted:
> `terms-review-fmp-2026-09-13.md`, `terms-review-finnhub-2026-09-20.md`,
> `terms-review-twelvedata-binanceus-2026-09-20.md`.
>
> **Residual value, and the only reason to open this file.** It is a dated snapshot of the
> registry immediately *before* the 2026-09-20 ratification — 38 `seeded` of 56. After that
> ratification the split is 34/56. If you need to know what was unread on the morning of
> 2026-09-20, this is the record.

# Source terms review worksheet — 2026-09-20

38 host(s). Probe output is **advisory**: it locates the document and
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
| Summary | Financial Modeling Prep: permitted subject to 4 condition(s) — A valid FMP API key must be configured — no keyless path; Stay within the plan's request cap (sections 2.5, 2.9); Section 2.2.1: solo non-commercial use only under the posted ToS — covers development and testing by one individual; Section 2.2.2: ANY multi-user deployment needs a specific agreement with FMP. A higher tier does NOT grant it — the clause reads irrespective of whether such usage is complimentary or paid. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Commercial market-data API, READ 2026-09-13 (ToS last updated 2023-08-01). The posted ToS grants ONE licence: section 2.2.1 Personal Use — an individual, for their own personal, non-business, non-commercial purposes, who may not integrate the Data into any tools or applications accessible by any third parties. Section 2.2.2 separately forbids showcasing FMP data on applications designed for utilization by multiple individuals, irrespective of whether such usage is complimentary or paid, absent a specific agreement with FMP. There is NO commercial-use licence section; broader rights come from an Order Form under section 2.1, NOT from a higher subscription tier.

**Recorded conditions:**
- A valid FMP API key must be configured — no keyless path
- Stay within the plan's request cap (sections 2.5, 2.9)
- Section 2.2.1: solo non-commercial use only under the posted ToS — covers development and testing by one individual
- Section 2.2.2: ANY multi-user deployment needs a specific agreement with FMP. A higher tier does NOT grant it — the clause reads irrespective of whether such usage is complimentary or paid

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
| Registered terms URL | https://www.binance.us/terms-of-use |
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
| robots.txt | robots.txt permits / for financenow |
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

## XT.com (public market-data API) — `xt.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: low) |
| Review state | ⚠️ **seeded — never read** (2026-08-21) |
| Registered terms URL | https://doc.xt.com/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (fetch failed) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | XT.com (public market-data API): permitted subject to 3 condition(s) — Respect documented rate limits; Keyless public endpoints only — no authenticated endpoints (RP-5); UNRESOLVED: XT states it does not provide services in this region — the owner-decision question, not a condition code can enforce. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes a documented public REST API; the public wallet-support currency endpoint is documented as unauthenticated. Seeded from the published API documentation — the exchange ToS have NOT been read, and as of 2026-09-15 no terms document is reachable at all: XT publishes none in its 33k-URL sitemap, twelve conventional paths 404, and the docs site carries no legal links. Separately and more importantly, XT geo-blocks the owner's US residential egress outright ("XT does not provide services in your country or region"), which makes it a second and stronger instance of the unresolved Bitget US-prohibition question rather than a pure terms matter. The endpoint itself remains unprobed (see the Bybit removal: a seeded public claim loses to the owner probe).

**Recorded conditions:**
- Respect documented rate limits
- Keyless public endpoints only — no authenticated endpoints (RP-5)
- UNRESOLVED: XT states it does not provide services in this region — the owner-decision question, not a condition code can enforce

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

## CryptoPanic — `cryptopanic.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://cryptopanic.com/developers/api/ |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://cryptopanic.com/terms |
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
| Terms found at | https://lunarcrush.com/terms |
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
| robots.txt | robots.txt permits / for financenow |
| Terms found at | https://coindesk.com/terms |
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

