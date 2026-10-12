# Keyless crypto chart feeds — terms read for T-423, 2026-10-12

**Readings, not verdicts.** Under D102 (owner, 2026-10-12: *"1. a 2. yes"*) the Binance rungs
stay on `/live-data/ohlcv` until a second keyless chart source is read and approved. This is
that reading, for the five candidates T-423 named: Kraken, Coinbase Exchange, Bitstamp,
Gemini and CoinPaprika. A source had to pass two tests: its terms allow its data to be shown
to the public, and it serves daily candles older than 365 days.

**The app fetches none of these hosts, so nothing in `sourceTerms.ts` changed.** Whether to
pursue any of them is the owner's call.

---

## Method

- **Egress:** Spectrum (Charter Communications, AS11426), `proxy:false hosting:false`, checked
  before the run.
- **Capture:** each document was saved as served (or as rendered, for two of them) and as text
  in which every block element starts a new line, headings and list items marked. The
  2026-09-20 reading records why: a capture that flattens a numbered agreement into one line
  produced quotations that do not exist in the document.
- **Fetch path:** a plain request for Kraken, Gemini and CoinPaprika; local headless Chrome for
  Coinbase (a plain request gets 403) and Bitstamp (an Incapsula bot wall).
- **Quotations:** every quotation below was checked by script against its capture, word for
  word and on one line of the document.
- **Kraken's permission address** is hidden by Cloudflare's email protection in the page text.
  It was decoded from the `data-cfemail` attribute beside that sentence in the HTML.
- **Feed measurements** (coins listed, history depth) were one listing request and one daily
  candle request per exchange, against the 80 coins in `COINGECKO_IDS`.

---

## Result

| Source | Document read | Public display | Route named | Coins listed (of 80) | Daily history |
|---|---|---|---|---|---|
| **Kraken** | Global Terms of Service, last updated 6 October 2026 | ❌ "only for your own benefit" | prior permission, marketdata@kraken.com | **58** | the last 720 candles (from 2024-10-22) |
| **Coinbase Exchange** | Market Data Terms of Use, last updated 7 August 2026 | ❌ no application "intended for use by end users" | prior express written consent; marketdata@coinbase.com | 44 | back to 2020 and earlier, 300 candles a request |
| **Bitstamp** (USA) | Terms of Use – Bitstamp USA Inc, last updated 23 July 2026 | ❌ data, prices and charts may not be republished | **none** | 46 | back to 2020 and earlier, 1,000 candles a request |
| **Gemini** | Market Data Agreement, 12 October 2025, and the API Agreement | ❌ may not disseminate "to any party for any reason" | Redistribution Agreement, bizdev@gemini.com | 29 | **364 days**, no paging |
| **CoinPaprika** | Terms of Use (in force 21.09.2022), API pricing and API FAQ | ❌ free plan is personal use; sharing only on Enterprise | Enterprise contract, custom price | not measured | free plan: 1 year of daily prices, 1 day of OHLCV |

For comparison, Binance.US served the charts for 47 of the 80 coins, and its terms bar public
display and name no route (`terms-review-twelvedata-binanceus-2026-09-20.md`).

**None of the five passes.** Every one restricts its free path to the reader's own use, the
same answer the FMP, Finnhub, Twelve Data, Binance.US, Bitget, KuCoin and OKX readings gave. Three name an
address to ask; one sells it; one names nothing.

---

## Kraken — `kraken.com` (api.kraken.com)

Global Terms of Service, **"Last Updated: 06 October, 2026"**. They apply in the US: Kraken
keeps separate terms only for Canada, the EEA and Brazil.

### They govern the API too

> as they are binding and govern your use of our services, and our websites (including but not limited to kraken.com, and pro.kraken.com), and mobile applications through which you access our services and any other interfaces we make available

The phrase "any other interfaces we make available" takes in the public API.

### The licence is for your own benefit

> We or our licensors own (1) our services and Platforms, (2) all content, materials, software, and trademarks found on them, (3) the selection and arrangement of them, and (4) all intellectual property rights in them (collectively, “Our Content”).

> So long as you comply with these Terms, you are permitted to use our services, and Our Content made available to you as part of our services, but only for your own benefit.

> If you wish to use Our Content for any other purpose you must seek prior permission to do so by contacting

The address, decoded from the page: **marketdata@kraken.com**. That Kraken routes this to a
market-data address says it licenses the data as its own product.

### Restrictions

> use (except as expressly permitted in these Terms), license, sublicense, sell, resell, transfer, assign, distribute or otherwise commercially exploit or make available to any third party Our Content in any way,

> develop any third-party applications that interact with Our Content without our prior written consent,

> create, use, operate, or employ any bots, robots, parsers, spiders, scripts, programs, routines, or any other forms of automation to engage in any activity on Our Content,

⚠ Read literally, the last one reaches the public API itself, which exists to be called by
programs. The document does not resolve that, and this reading does not either.

**Before launch (D96):** personal use is what the licence grants.

---

## Coinbase Exchange — `coinbase.com` (api.exchange.coinbase.com)

Market Data Terms of Use, **"Last updated: August 7, 2026"**. A separate document from the
user agreement, written for exactly this data.

### It binds a keyless caller, and it covers exchange candles

> By accessing or using Coinbase Market Data, you agree to be bound by these Market Data Terms of Use (the “Terms”), including all amendments and updates made between your initial acceptance of these Terms and any future access or use.

> For purposes of these Terms, “Market Data” means all data made available to you by Coinbase, which may include, without limitation, order and transaction information related to trading on Coinbase exchanges.

### The licence names the case exactly

> Your use of Market Data is exclusively for you or your entity’s personal or research purposes and may not be used to build an application intended for use by end users other than for you or your officers/employees.

> Restrictions and Responsibilities. Absent prior express written consent from Coinbase, you may not:

> Redistribute, display, or disseminate the Market Data—or any data, charts, analytics, research, or other works based on, referring to, or derived from the Market Data (“Derived Works”) — to any third party outside of your organization by electronic means or otherwise;

Charts and analytics derived from the data are named. An indicator computed from Coinbase
candles is a Derived Work.

### ⚠ The AI restriction applies before launch too

> Use any Market Data to, or permit or authorize any third party to, in whole or in part, develop, train, fine-tune, teach, validate, benchmark, or otherwise improve any artificial intelligence or machine learning model, algorithm, chatbot, agent, or other automated system, whether generative or non-generative, or for any other purpose related to the research, development, or operation of artificial intelligence technologies.

The app's agents read price history through the `get_price_history` tool and pass it to an AI
model. With Coinbase as a chart source, that is "operation of artificial intelligence
technologies", and it is barred **whoever uses the app**. D96 makes pre-launch use personal; it
does not make this permitted.

### Route

Prior express written consent. The address the terms give for questions about Market Data:

> If you have a question, complaint, or otherwise wish to contact us regarding the Market Data or these Terms, please contact us at: marketdata@coinbase.com.

---

## Bitstamp — `bitstamp.net` (USA)

Terms of Use – Bitstamp USA Inc, **"Last Updated Date: 23 July 2026"**. The site now trades
as Bitstamp by Robinhood.

### It binds use of the data, account or not

> By using this website (“Site”), registering for a Bitstamp Account (“Account”) or using any other services, products, data, content or other material available through the Site (“Services”) and provided by Bitstamp USA, Inc. (“we”, “us”, “our”), you (“you, your, or yourself”) are agreeing to accept and comply with the terms and conditions of use stated below (“Terms of Use” or “Terms”).

### §17, Limited Right of Use

> You may view, print and/or download a copy of the Materials from this Site on any single computer solely for your personal, informational and/or non-commercial use, provided you comply with all copyright and other proprietary notices.

> The software, text, images, graphics, data, prices, trades, charts, graphs, video and audio used on this Site belong to Bitstamp. The Trademarks and Material may not be copied, reproduced, modified, republished, uploaded, posted, transmitted, scraped, collected or distributed in any form or by any means, whether manual or automated.

### §16, Unacceptable Use

> promote, offer, use or otherwise exploit the Services or use or otherwise exploit any data related thereto in connection with the formation, operation or offering of any index fund or similar product or any data package or similar product or any other derivative product utilizing the Site or the Services; or

> develop any third-party applications that interact with our Services without our prior written consent, or unless otherwise agreed;

### No stated route

The only consent the document mentions is for third-party applications (above) and for framing
the site. It names no market-data licence and no address for one, the same gap as Binance.US.

---

## Gemini — `gemini.com` (api.gemini.com)

Market Data Agreement, dated **October 12, 2025**, read with the API Agreement it is tied to.

### It binds a keyless caller

> You agree and understand that by accessing or using Gemini Market Data in any way, you are agreeing to enter into this market data agreement (the “Market Data Agreement”) and be legally bound by its terms and conditions, so please read them carefully.

The API Agreement's request table lists Gemini Market Data as needing no API key, and caps
public entry points at "Up to 120 requests per minute".

### What is permitted, and what overrides it

> As used herein, you agree and understand that Permitted Use means your use of Gemini Market Data solely for: (i) personal and/or internal use; (ii) general informational purposes; or (iii) analysis of prices and markets and financial products relating thereto, but in each case, excluding any Prohibited Use.

Limbs (ii) and (iii) sound broad enough to cover an analytics app, but every limb excludes
Prohibited Use, and Prohibited Use includes:

> (vi) distribute, redistribute, disseminate (other than for the purposes of providing OEMS Services), sell, resell, license, or sublicense Gemini Market Data to any party for any reason;

Showing the data to visitors is dissemination to a party.

### Route

> If you would like to use Gemini Market Data for a commercial purpose, please email bizdev@gemini.com.

> If you would like to distribute, redistribute, disseminate (other than for the purposes of providing OEMS Services), sell, resell, license, or sublicense Gemini Market Data to any party for any reason, please email bizdev@gemini.com for our Redistribution Agreement.

The agreement also incorporates a fee schedule, unread:

> You agree and understand that by accessing or using Gemini Market Data, you are agreeing to accept our Market Data Fee Schedule.

### It fails the history test as well

The daily candle endpoint returned 364 candles (from 2025-10-13) and documents no way to page
further back. Even with a Redistribution Agreement it could not carry a multi-year chart.

---

## CoinPaprika — `coinpaprika.com` (api.coinpaprika.com)

The only non-exchange candidate. Three documents: the Terms of Use (in force since
21.09.2022), the API pricing table, and the API FAQ.

### Terms of Use

> copy, manipulate or aggregate any Content (including data) for the purpose of making it available to any third party,

> The Terms of Use come into effect on 21.09.2022.

### API FAQ, on commercial use

> Yes, the data can be used for commercial purposes inside the customer’s company in all paid packages. However, only the Enterprise package allows data to be redistributed or shared, which requires a dedicated contract.

### API pricing

The table marks the Free plan's usage as **Personal**, every paid plan as **Commercial**, and
**Redistribution** as included on Enterprise alone (custom price; the five plans below it show a
red mark). The Free plan's history is one year of daily prices and **one day** of OHLCV.

So the free path fails both tests on its face, and the one plan that permits display is a
custom contract, which D21 defers. Its feed was not measured.

---

## What this adds up to

1. **No keyless exchange feed read so far permits public display on its default terms.** Eight
   venues now (these four, Binance.US, Bitget, KuCoin and OKX) and one aggregator. Market data
   from a trading venue is licensed separately, and the free path is the reader's own use.
   Binance.com, HTX and XT.com could not be read (2026-09-26).
2. **If a licence is pursued, Kraken fits best on measurement:** 58 of the 80 coins against
   Binance.US's 47, and 720 daily candles. Coinbase and Bitstamp go further back but list fewer
   coins; Gemini fails the history test whatever the licence says. Kraken, Coinbase and Gemini
   name an address; Bitstamp names none.
3. **Before launch (D96), Kraken, Bitstamp and Gemini allow personal use.** Coinbase does too,
   but its AI clause means its data could not feed the app's agents even then.
4. **A lead outside the five, measured once and not read:** DefiLlama's price API
   (`coins.llama.fi`), which the registry already covers under its `llama.fi` entry
   (conditional, seeded, no terms document exists). It answered keylessly with daily Bitcoin
   prices back to 2022, but **one price per day, not candles**: enough for line charts and
   indicators built on closing prices (RSI, moving averages, volatility), not for candlestick
   patterns or anything that needs a day's high and low.

## The decisions this hands you

1. **Whether to write to any of them before launch, and which.** Kraken first, on fit. Gemini's
   reply would not fix its 364-day limit. A licence that costs money is deferred under D21.
2. **Or whether charts launch on CoinGecko alone:** up to 365 days of history, and 4-day candles
   for any window over 30 days. Since PR #323 the screens that need daily candles leave out,
   and count, the coins they cannot read, so this is D21's "degrade, not remove" rather than a
   silent gap.
3. **Whether to look at DefiLlama's daily prices** as the long-history line source. That means
   ruling on a host whose terms do not exist, which the 2026-09-26 reading recorded as a fact
   rather than a clearance.

The Binance rungs stay on `/live-data/ohlcv` under D96 until one of these is chosen; T-423
stays open as a launch step.
