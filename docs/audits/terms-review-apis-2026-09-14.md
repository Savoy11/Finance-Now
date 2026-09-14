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
| T-242 | **Bitget** | ❌ JS-rendered | Unread — stays `seeded` |
| T-241 | **Tiingo** | ❌ SPA, no findable terms route | Unread — stays `seeded` |

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

## Two could not be read

| Source | Why |
|---|---|
| **Bitget** | `bitget.com/terms/legal` returns 200 but is JS-rendered — 0 substantive lines extract. The registry URL was corrected to this page on 2026-09-13 (it previously pointed at an API *documentation* page that returned 200, so every prior probe scored it "reachable"). Reading it needs a browser |
| **Tiingo** | An Angular SPA. Every valid route returns the identical 20,263-byte shell, so HTTP status cannot distinguish a real route from a guess; the shell has no terms link and the main bundle no `terms` route string. Nine paths tried across two sessions |

Both stay `seeded`. **"Couldn't read it" is not permission** — and in Bitget's case the
registry now at least points at a real terms page rather than documentation, so the next
attempt starts from the right URL.

## The decision this hands you

1. **StockTwits** — the favourable reading is on the record; `conditional` with the
   condition rewritten to "via their API only, not the website" reflects the document.
2. **Reddit** — no change today. D8 is now better framed: lifting the gate means
   accepting the Data API Terms, not merely registering an app.
3. **publicnode** — the judgement call. Its literal text prohibits use; its business is
   selling that use. Scope is one route behind a hidden page.
4. **YouTube** — re-scope from personal-vs-commercial to attribution compliance, and
   check what `/videos` renders.
5. **Bitget, Tiingo** — need a browser. I have browser automation available and can do
   both in a few minutes if you want them.
