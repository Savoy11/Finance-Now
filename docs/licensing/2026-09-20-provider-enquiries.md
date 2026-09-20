# Provider licensing enquiries — drafts, 2026-09-20

**These are drafts for the owner to review, edit and send.** Nothing here has been sent,
and no vendor has been contacted. Sending is the owner's act.

## Why these exist

Four provider terms were read on 2026-09-20 (FMP on 2026-09-13). All four say the same
thing in different words: **a deployment other people can reach is outside the default
licence, and buying a higher tier does not change that.** Three name a route through; one
does not.

| Source | The clause | Route it names |
|---|---|---|
| FMP | §2.2.2 — no showcasing on applications "designed for utilization by multiple individuals, irrespective of whether such usage is complimentary or paid" | Order Form under §2.1 |
| Finnhub | "not redistribute or share access to data or derived results … with anyone or any 3rd party" | written approval |
| Twelve Data | §2.2(e) — redistribution "or external display" only as authorised | Redistribution Rights Add-On or separate written agreement |
| Binance.US | IP licence does not permit "distribution, public performance, or public display" | **none stated** |

Readings: `docs/audits/terms-review-fmp-2026-09-13.md`,
`terms-review-finnhub-2026-09-20.md`, `terms-review-twelvedata-binanceus-2026-09-20.md`.

## Three things to decide before sending

1. **Scale and commercial posture are genuinely undecided** (D21 defers paid decisions).
   Each draft therefore asks what options exist rather than committing to one. That is
   honest, and it is also the right negotiating position — but if the owner has a firmer
   answer, saying so will get a more useful reply.
2. **These disclose the project to vendors.** A licensing enquiry tells a provider that an
   application exists, roughly what it does, and that a launch is contemplated. That is
   normal and low-risk, but it is a disclosure and it is the owner's to make.
3. **None of this is legal advice.** The readings are careful but they are readings, and
   two of the four carry unresolved questions (below). Anything that becomes a signed
   agreement deserves a lawyer's eye.

## ⚠ Two questions to ask even if no licence is pursued

These are not commercial questions and they bear on the app **today**, solo:

- **Twelve Data** — "Internal Use" is defined as "internal **business** purposes". Whether
  an unpaid personal project is an internal *business* purpose is unclear, and the app may
  sit outside the only permitted-use category even now.
- **Binance.US** — the IP licence does not permit "the modification or derivative uses of
  the Materials". Finance Now computes indicators from price data, which is arguably
  exactly that.

---

## 1. FMP — Order Form for a multi-user application

> **Subject:** Licensing question — multi-user application under §2.2.2
>
> Hello,
>
> I maintain a multi-asset financial analytics web application that uses the FMP API
> server-side for quotes, a stock-screener universe, a market calendar and historical
> OHLCV. It is currently a solo development project and is not publicly accessible.
>
> I have read the Terms of Service (last updated 1 August 2023) and want to get the
> licensing right before anyone else can reach the application, rather than after.
>
> My reading is that §2.2.1 covers my present use — an individual, own purposes, no
> third-party access — but that §2.2.2 forecloses any deployment "designed for utilization
> by multiple individuals, irrespective of whether such usage is complimentary or paid",
> absent a specific agreement, and that broader rights come from an Order Form under §2.1
> rather than from a higher subscription tier. Three questions:
>
> 1. Is that reading correct — specifically, that no subscription tier by itself permits a
>    multi-user deployment, and that an Order Form is the mechanism?
> 2. What does an Order Form covering a small multi-user application involve, and what is
>    the typical lead time? Scale is modest and not yet fixed; I would rather describe it
>    accurately than guess.
> 3. §2.6.2 incorporates an "Acceptable Data Use Policy" by reference at
>    financialmodelingprep.com/acceptable-data-use-policy and defines its violation as a
>    material breach. That URL currently returns 404 on both financialmodelingprep.com and
>    site.financialmodelingprep.com. Could you point me to the operative document?
>
> Thank you,

*Note: question 3 is worth asking regardless of the licensing outcome. A term incorporated
by reference, whose breach is defined as material, should be readable at the address the
contract gives.*

---

## 2. Finnhub — written approval, and two missing documents

> **Subject:** Written approval for a multi-user application, and two referenced documents
>
> Hello,
>
> I maintain a multi-asset financial analytics web application that uses the Finnhub API
> server-side for equity quotes. It is a solo development project today and is not publicly
> accessible.
>
> Reading the Terms of Service, the operative clause appears to be under "Redistribution
> Rights and Personal Use": that I may not "redistribute or share access to data or derived
> results from the data obtained from Finnhub with anyone or any 3rd party without written
> approval from Finnhub". I want to resolve this before anyone else can reach the
> application. Four questions:
>
> 1. What is the process for obtaining that written approval, and what does it typically
>    involve?
> 2. The same section says "All plan listed on Finnhub website is strictly for personal use
>    unless explicitly stated otherwise." Is there a plan or licence that does explicitly
>    state otherwise — i.e. one permitting display of Finnhub-derived data to users?
> 3. How far does "derived results" reach? A computed indicator or chart derived from price
>    data, displayed to a user, appears to be covered on a plain reading. Is that the
>    intended scope?
> 4. Two documents are referenced but I have not been able to locate them: "Page 23-24 of
>    UTP plan data policies", which governs the Non-Professional definition, and the
>    Subscriber Agreement form. Could you send both?
>
> Thank you,

*Note: the Terms carry no date anywhere and reserve the right to change without notice, so
it is worth asking, informally, whether a dated copy can be provided.*

---

## 3. Twelve Data — Redistribution Rights Add-On, and a definitional question

> **Subject:** Redistribution Rights Add-On, and a question about "Internal Use"
>
> Hello,
>
> I maintain a multi-asset financial analytics web application that uses the Twelve Data
> API server-side for quotes and historical price data. It is a solo development project
> today and is not publicly accessible.
>
> I have read the Terms of Use (last updated 1 January 2026). Three questions, the first of
> which applies to my use right now rather than to any future launch:
>
> 1. **"Internal Use"** is defined as "use solely for Customer's internal business purposes
>    and not for redistribution or external commercial purposes", and §2.1/§2.2(a) scope the
>    licence to it. My use is an individual's own project, not a business activity. Does
>    "internal business purposes" cover an individual using the data for their own
>    non-commercial project, or is a different licence appropriate for that?
> 2. §2.2(e) permits redistribution "or external display" only as authorised by a
>    Redistribution Rights Add-On or a separate written agreement. What does the Add-On
>    cover and cost, and does "external display" include showing data within a web
>    application's own UI to its users, as distinct from re-serving the data through an API?
> 3. §2.3(g) limits storage and caching to "permitted timeframes specified in the
>    Documentation". I have not been able to locate those timeframes at
>    twelvedata.com/docs — could you point me to them? I would like to confirm my cache
>    TTLs are inside the limit.
>
> Thank you,

*Note: question 3 has a concrete engineering consequence — this app's cache TTLs are
currently unverified against a binding limit it cannot find.*

---

## 4. Binance.US — no stated route, so this one asks a different question

Binance.US names **no mechanism** for multi-user permission. So rather than requesting one,
this enquiry asks whether a different instrument governs API market data at all.

> **Subject:** Which terms govern programmatic market-data access?
>
> Hello,
>
> I maintain a multi-asset financial analytics web application that reads public market-data
> endpoints from binance.us server-side, at low volume and without an account. It is a solo
> development project and is not publicly accessible.
>
> I want to confirm which terms govern that use. Three questions:
>
> 1. Is the Terms of Use (last updated 5 June 2026) the operative document for programmatic
>    market-data access, or is there a separate API or market-data licence?
> 2. The Intellectual Property licence is granted "for your non-commercial personal or
>    internal business uses" and states it does not permit "the modification or derivative
>    uses of the Materials". My application computes technical indicators from price data
>    and displays the results. Is that within the licence, or does it require separate
>    permission?
> 3. If an application were to become accessible to other users, is there a route to
>    permission for displaying binance.us market data to them? The Terms of Use does not
>    appear to describe one.
>
> Thank you,

*Note: question 2 is the one that matters most and it is not a launch question — it bears on
what the app does today. Question 3 may simply have the answer "no", which is itself useful:
it would make Binance.US a source to design away from rather than negotiate with.*

---

## 5. Dow Jones / MarketWatch — the one that would restore a removed feed

⚠ **This is the only enquiry where the feed has already been withdrawn.** `dowjones.io`
and `marketwatch.com` were set to `prohibited` on 2026-09-20 and the fetchers removed, so
this request is not about avoiding a future problem — it is the sole route back.

> **Subject:** Written consent for RSS feed use in a personal finance application
>
> Hello,
>
> I maintain a multi-asset financial analytics web application. Until this week it read
> MarketWatch headlines from the public RSS feeds at
> `feeds.content.dowjones.io/public/rss/mw_topstories` and `…/mw_bulletins`, server-side and
> at low volume, displaying each item's headline, link and feed summary. It is a solo
> development project and is not publicly accessible.
>
> On reading the Dow Jones Terms of Use (Effective 30 June 2026) I concluded that use was
> not permitted, and I have removed those feeds from the application. §9.4.1 bars ingesting
> Content "whether directly or through an intermediary, using any automated means … API
> client, AI agent or assistant … without our prior written consent", and §9.1 addresses
> "any Content made available through one of our RSS feeds" directly. Three questions:
>
> 1. Is that reading correct — that a server-side reader of the public MarketWatch RSS
>    feeds requires prior written consent, even displaying only headline, link and the
>    feed's own summary, and even for a single-user non-commercial deployment?
> 2. If so, what is the process for requesting that consent, and is there a licence
>    intended for small applications of this kind?
> 3. Are the `mw_topstories` and `mw_bulletins` feeds on `feeds.content.dowjones.io` among
>    the "our RSS feeds" §9.1 refers to? The Terms do not identify which feeds are in scope,
>    and that host publishes no terms of its own.
>
> I would rather ask than assume, which is why the feeds are already switched off.
>
> Thank you,

*Note: question 3 is the one genuine gap in the reading. It is worth asking plainly even if
the answer restores nothing.*

---

## 6. CoinDesk — is there a feed policy at all?

> **Subject:** Is there an RSS/syndication policy separate from the Terms of Use?
>
> Hello,
>
> I maintain a multi-asset financial analytics web application that reads your public RSS
> feed at `www.coindesk.com/arc/outboundfeeds/rss/` server-side, displaying each item's
> headline, link and the feed's own summary with a link back to the original article. It is
> a solo development project and is not publicly accessible.
>
> I have read the Terms of Use (Effective 14 November 2025) and want to get this right.
> Three questions:
>
> 1. Is there an RSS or syndication policy separate from the Terms of Use? The Terms do not
>    mention feeds — "RSS", "syndication" and "feed" do not appear in the document — so I
>    cannot tell whether they are intended to govern the feed at all.
> 2. If the Terms do govern it: the Copyright, Trademark and Ownership section authorises
>    viewing, printing and downloading "for personal, informational, and non-commercial
>    purposes only" and bars republishing "without Company's prior written consent". Does
>    displaying a headline, a link and the feed's own summary count as republishing?
> 3. If some display is permitted, what attribution do you require, and in what form? The
>    Terms are silent on attribution, and separately reserve "attribution, links,
>    promotional and distribution rights" to CoinDesk, so I would rather be told than guess.
>
> Thank you,

---

## 7. Investing.com — a question about an apparent contradiction

> **Subject:** RSS feeds and the automated-access clause in the Terms and Conditions
>
> Hello,
>
> I maintain a multi-asset financial analytics web application that reads three of your
> public RSS feeds server-side (`/rss/news_11.rss`, `/rss/bonds_Fundamental.rss`,
> `/rss/news_1.rss`), displaying each item's headline, link and the feed's own summary with
> attribution and a link back. It is a solo development project and is not publicly
> accessible.
>
> I have read the Terms and Conditions and want to resolve what looks like a conflict.
> Limitations on Use (c) states that customers are "expressly forbidden from employing any
> automated system or software to extract data for content from this website for any
> purpose", naming robot and spider programs among others. At the same time, Investing.com
> publishes these RSS feeds, and `investing.com/robots.txt` permits `/rss/` while
> disallowing other paths. Publishing a feed and allowing it in robots.txt reads as an
> invitation to automated consumption. Three questions:
>
> 1. Is reading the published RSS feeds within Limitations on Use (c), or is that clause
>    aimed at scraping the HTML site rather than at the feeds you publish?
> 2. If feed use is permitted, what display and attribution conditions apply — headline and
>    link only, or headline plus the feed's summary?
> 3. Is there a separate syndication or feed policy? The Terms and Conditions do not mention
>    RSS anywhere.
>
> Thank you,

*Note: this one asks the publisher to resolve a tension in their own documents, so the reply
is likely to be more useful than a yes/no. If the answer is that (c) governs the feeds, that
makes Investing.com a source to design away from — and the blast radius is already measured:
3 of 8 macro-news feeds, with every pillar retaining a non-Investing source.*

---

## After the replies

Whatever comes back is **evidence, not ratification**. Record it the way the readings were
recorded — a dated audit document with verbatim quotes, then the registry entry, then the
`review`/`verdict` flags as a separate, deliberate act. A vendor's email saying "that's
fine" is not a licence amendment, and should not be recorded as one.
