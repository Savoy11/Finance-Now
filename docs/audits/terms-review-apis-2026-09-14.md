# API-source terms — read on the owner's machine, 2026-09-14

**Readings, not verdicts.** Companion to `terms-review-news-2026-09-14.md`, same clean
residential egress (Charter/AS11426, `proxy:false`, verified before and after). Covers
T-240 (YouTube), T-241 (Tiingo), T-242 (Bitget), T-243 (CoinGecko), T-244 (Reddit),
T-249 (StockTwits), T-251 (publicnode).

Setting any `verdict` or flipping any `review` to `verified` is the owner's act.

## Result

| # | Source | Document reached | Finding |
|---|---|---|---|
| T-249 | **StockTwits** | ✅ | **Favourable** — the pointed clause has a carve-out we fall inside |
| T-244 | **Reddit** | ✅ | **Wrong document for our use** — governs a path we don't take |
| T-251 | **publicnode** | ✅ | ⚠ **Very broad boilerplate** — needs a judgement |
| T-243 | **CoinGecko** | ✅ | Consistent with the 2026-08-29 verified reading |
| T-240 | **YouTube** | ✅ | Different axis — attribution, not personal-vs-commercial |
| T-242 | **Bitget** | ✅ via browser | ⚠ **Two findings** — non-commercial licence, and the US is a Prohibited Country |
| T-241 | **Tiingo** | ✅ via browser | ⚠ **The most specific clause read today**, and it implicates our caching |

## T-249 StockTwits — the clause has a carve-out, and we are inside it

The terms are pointed about automated extraction:

> You may not **scrape, harvest, mirror, frame, deep-link to, data-mine, or otherwise
> extract data or content from the Service by automated means** except as expressly
> authorized by us in writing **or through an approved API, widget, developer offering,
> or other product rule**.

A keyword scan stops at "scrape… prohibited" and flags it. The carve-out is the
operative half, and the code lands inside it: `/live-data/stock-social` calls

```
https://api.stocktwits.com/api/2/streams/symbol/<SYM>.json
https://api.stocktwits.com/api/2/streams/trending.json
```

— StockTwits' own API, not the website. **This is the difference between the clause
prohibiting what we do and expressly permitting it**, and it turns entirely on which
host the code calls.

⚠ One residual question, and it is not settled by the document: *"an approved API"* may
mean "an API you have been approved to use" (i.e. with issued credentials) rather than
"an API endpoint they publish". We call it keylessly. Worth one email; not worth
blocking on.

## T-244 Reddit — read, and it governs a path we don't take

The Data API Terms grant:

> …a non-exclusive, non-transferable, non-sublicensable, and revocable license solely to
> access and use **the Data APIs**…
>
> If you are interested in using the Data APIs **for commercial purposes**, research in
> excess of rate limits, or for any use not expressly permitted… you will need to
> enter [into a separate agreement].

**We do not use the Data API.** `/live-data/social` reads twelve public `.rss` endpoints
on `reddit.com` directly. So this document — the one T-244 named — describes the
licence we would need *if* `REDDIT_CLIENT_ID` were ever set, and says nothing about
reading public RSS.

The control that actually binds today is the robots gate: Reddit's `robots.txt`
disallows this app's agent, `pinnedFetch` refuses `reddit.com` unless `REDDIT_CLIENT_ID`
is set, and it is not set. **The conservative state is already in force**, and the
reading confirms that lifting it — D8's deferred question — means accepting these Data
API Terms, including the commercial-purposes clause. That is a cleaner framing of D8
than "should we register an app".

## T-251 publicnode — the one that needs a judgement

The broadest clause read today, by a distance:

> …you agree not to modify, copy, frame, scrape, rent, lease, loan, sell, re-use,
> **display**, distribute, transmit, publish, re-publish, distribute or create
> derivative works based on the Service or the Service Content **commercially and
> non-commercially**, either in whole or in part, in all forms and media…

Read literally this prohibits using the service for anything, since an RPC provider's
entire product is answering RPC calls and any consumer necessarily "re-uses" the
response. That literal reading cannot be the intent — but it is what the document says,
and I am not the person to decide that it doesn't mean it.

Scope, which limits the exposure: **publicnode is called by exactly one route**,
`/live-data/wallet/eth`, where it is the first rung of the EVM ladder. `/wallets` is
already **hidden from rollout** (2026-08-22), so no user currently reaches it.

## T-243 CoinGecko — consistent with the existing verified reading

Nothing contradicts the 2026-08-29 reading that made CoinGecko one of only two
`verified` entries. The clauses found concern rate and monthly call limits, varied at
CoinGecko's discretion, plus the separate-agreement path. The attribution requirement
(API Terms 4.4, "Powered by CoinGecko") is already implemented with a 10px floor a test
enforces. **No change proposed.**

## T-240 YouTube — a different question than the one it was filed under

YouTube's API Services ToS produced no personal-vs-commercial restriction. Its clauses
are about **attribution and Brand Features** — a limited licence to display YouTube
brand marks per the Branding Guidelines, a requirement not to remove notices, and
YouTube's retained ownership of API Data.

So this entry does not belong in the personal-vs-commercial group at all. It belongs on
an **attribution-compliance** question: does `/videos` render the YouTube brand
attribution the Branding Guidelines require? That is a UI check, not a terms reading,
and it is not done. **Recommend re-scoping T-240 accordingly.**

## T-242 Bitget — read via browser, two findings

The registry URL corrected on 2026-09-13 to `bitget.com/terms/legal` turned out to be an
**index of seventeen legal documents**, not a terms document. The operative one is
*Terms of Use* at `/terms/legal/360014944032`. Reached by clicking through in a browser;
the index renders client-side, which is why every fetch returned an empty shell.

**The app does call Bitget.** `withdrawFeeAdapters.ts:305` fetches
`api.bitget.com/api/v2/spot/public/coins`, keylessly, marked `probed: true`.

**Finding 1 — the licence is internal-use.** §10.1:

> Bitget hereby grants to you a non-exclusive license… to use the Bitget IP Rights…
> solely as necessary to allow you to receive the Services for **non-commercial personal
> or internal business use**.

Same shape as FMP and Twelve Data. This is now the fourth source on that pattern.

**Finding 2 — ⚠ the United States is a Prohibited Country.** Listed by name in §1's
definition, alongside Austria, Canada, France, Germany, Hong Kong, Japan and Singapore,
with US territories enumerated. "Restricted Person" is defined to include anyone who
"resides or is established… in any of the Prohibited Countries", and §2.8 makes not
being one an eligibility condition.

**How far that reaches is genuinely unclear, and I am not the one to decide it.** The
argument that it binds: "Platform" is defined to include access "via website, mobile
app, **API**", and the preamble says "By accessing the Platform… it is deemed that you
have… irrevocably agreed to these Terms". The argument that it does not: the eligibility
and Prohibited-Country clauses attach to registering an **Account** and using
**Services**, both of which §3.1 gates behind account opening, and we have no account.

The owner is US-resident. This is the first source read where a clause may bar use
outright rather than restrict its scope, and it deserves a real answer before launch.

## Two could not be read — now resolved

Both were read in a browser after the fetch approach failed. Neither failure was about
the sites being closed — both were about **client-side rendering**, which a `curl` cannot
follow and a browser can.

### T-241 Tiingo — `/tos`, the one path nine guesses missed

`tiingo.com` is an Angular SPA: every valid route returns the identical 20,263-byte
shell, so HTTP status cannot distinguish a real route from a guess, and the main JS
bundle carries no `terms` route string. Nine URLs were tried across two sessions —
`/about/terms`, `/terms`, `/about/terms-of-service`, `/about/apiterms` and more. **The
real path is `/tos`**, which redirects to `app.tiingo.com/tos/`. The footer link renders
only in a browser. Registry `termsUrl` should be corrected to it.

**§7.3 Use of the Tiingo API** is the most specific clause read from any source today:

> **All data via the API is for internal consumption only.** If you are an individual,
> you may sign up for an Individual plan; however, if you are representing an
> organization or business, you must sign up for a Commercial plan. **Redistribution is
> only available upon special request and permission, and comes with additional fees.**
>
> In the event that Tiingo permits you to redistribute any data… you must include… the
> phrase **"Data sourced by Tiingo"** with a link to https://www.tiingo.com.

⚠ **§1.6(a) Starter Plans is the one to act on, because it is technical and checkable:**

> …you may **not write, save, archive, back up, or otherwise retain Tiingo Data in any
> persistent or durable storage**. You may process Tiingo Data only **transiently in
> volatile memory or in a temporary, non-persistent cache**… You must permanently remove
> the Tiingo Data from that memory or cache **immediately after the calculation or
> operation is completed**… This prohibition applies to all storage systems… including
> local devices, databases, object stores, file systems, logs, queues, archives, backups…

**The app caches Tiingo responses to disk.** Both `security-ohlcv` and `security-returns`
fetch `api.tiingo.com` with Next.js `next: { revalidate: … }` — 900 seconds for returns,
per-range for OHLCV. Next's fetch cache is a **durable on-disk store** under `.next/cache`,
not volatile memory. On a Starter plan that appears to be exactly what §1.6(a) forbids.

This is not a launch-only question like the others. It describes what the code does
**today**, on whatever plan the key belongs to. Two things need establishing, in order:
**(1)** which Tiingo plan the configured key is on — Starter/Trial or Paid; **(2)** if
Starter, whether `revalidate` on those two routes should be dropped to `0`. That is a
two-line change, and it costs upstream requests, which is a trade worth making
deliberately rather than by default.

§1.6(c) Derived Products is unusually detailed — indicator outputs and aggregate
backtest statistics are named as *potentially* permitted, while "charts… that display,
deliver, or permit extraction of Tiingo Data" are named as prohibited. Worth reading in
full before the TA surfaces are pointed at a public audience.

## The decision this hands you

1. **StockTwits** — the favourable reading is on the record; `conditional` with the
   condition rewritten to "via their API only, not the website" reflects the document.
2. **Reddit** — no change today. D8 is now better framed: lifting the gate means
   accepting the Data API Terms, not merely registering an app.
3. **publicnode** — the judgement call. Its literal text prohibits use; its business is
   selling that use. Scope is one route behind a hidden page.
4. **YouTube** — re-scope from personal-vs-commercial to attribution compliance, and
   check what `/videos` renders.
5. **Tiingo caching — the only item here that describes today rather than launch.**
   Establish the plan; if Starter, decide whether `revalidate` comes off those two routes.
6. **Bitget's US prohibition** — needs a real answer, not a maintainer's reading.
7. **Registry URL fix**: Tiingo `termsUrl` → `https://www.tiingo.com/tos`; Bitget →
   `https://www.bitget.com/terms/legal/360014944032` (the document, not the index).
