# Terms ratification — proposal, 2026-09-18

**Nothing here is applied.** This is the propose half of propose → owner approves →
apply. Every row can be approved or rejected on its own.

## What this fixes

Eighteen sources were read on 2026-09-14 from a verified clean residential egress
(`docs/audits/terms-review-news-2026-09-14.md`, `…-apis-2026-09-14.md`). The registry
still shows **17 of them `seeded`** — 52 of 56 registry-wide, against 4 `verified`.

That understates what the project knows, and it is not cosmetic: `seeded` is badged
everywhere it surfaces and drives the review work queue, so seventeen documents that
*have* been read keep appearing as work that has not been done. The audits deliberately
stopped short of flipping anything, because both say that is the owner's act.

## The key distinction, which makes most of this safe

`review` and `verdict` are different fields answering different questions. From the type
itself:

> **`review`** — *"Has anyone actually READ this site's terms for this project?"*
> **`verdict`** — the licensing conclusion, `allowed` / `conditional` / `prohibited`.

So ratifying a **reading** is a statement of fact — a human opened the named document
and the `finding` text describes it. Setting a **verdict** is a judgement. They can move
independently, and this proposal separates them:

- **Group A** flips `review` only. No verdict changes. Low risk, and it is the part that
  stops the registry lying about its own state.
- **Group B** lists the verdicts that are genuinely unresolved, and the single ruling
  that settles nine of them at once.

⚠ **No row here proposes `prohibited`.** In this codebase that verdict is enforced by
`assertSourceNotProhibited` inside `pinnedFetch` — a socket-level block. Marking
Cointelegraph, OilPrice and FXStreet prohibited would empty `/live-data/news` and most
of `/live-data/macro-news` the moment it merged.

---

## Group A — ratify the readings (17 sources)

For each: `review: 'seeded'` → `'verified'`, and `reviewedAt` → `'2026-09-14'`. Verdict
unchanged at `conditional` in every case.

| Source | Now | Basis for ratifying the reading |
|---|---|---|
| bitcoinmagazine.com | seeded, medium | Read. Terms contain **0** mentions of RSS/feed/syndication. |
| cnbc.com | seeded, medium | Read. Restrictive clauses scoped to paid products (Investing Club, CNBC+); general terms silent on the RSS endpoint called. |
| coindesk.com | seeded, medium | Read. Public RSS feed; terms do not address it. |
| cointelegraph.com | seeded, medium | Read. Clause quoted verbatim in the audit — bars "automated scraping, or creation of independent content pipelines", permits "quoting". |
| decrypt.co | seeded, medium | Read. 2 mentions of RSS, only within a list of site features. |
| dowjones.io | seeded, medium | Read. Feed host for MarketWatch; needs an email, not a fetch. |
| fxstreet.com | seeded, medium | Read. Prohibits redistribution "regardless of its purpose"; even links need express consent. |
| investing.com | seeded, medium | Read. Three feeds confirmed 200 from clean egress. |
| marketwatch.com | seeded, medium | Read. |
| oilprice.com | seeded, medium | Read. Clearest personal-use restriction of the eight; bars robots/spiders. |
| reddit.com | seeded, low | Read — and it is the **wrong document for our path**. The Data API Terms govern `REDDIT_CLIENT_ID` use; `/live-data/social` reads twelve public `.rss` endpoints. |
| stocktwits.com | seeded, low | Read. The anti-scraping clause has a carve-out for "an approved API… or other product rule", and the code calls `api.stocktwits.com`, not the website. |
| tiingo.com | seeded, medium | Read via browser. §1.6(a) already actioned — all five call sites uncached. |
| youtube.com | seeded, medium | Read. API Services ToS is about **attribution and Brand Features**, not personal-vs-commercial. |
| googleapis.com | seeded, medium | Same document as youtube.com. |
| publicnode.com | seeded, low | Read. Broadest clause of the day, quoted verbatim. |
| bitget.com | seeded, low | Read via browser — the registry URL was an index of 17 documents; the operative one is `/terms/legal/360014944032`. |

**Three `finding`/`conditions` corrections belong with this group**, because ratifying a
reading while leaving text the reading disproved would launder the error in the other
direction:

1. **reddit.com** — the `finding` should say the Data API Terms describe the licence
   needed *if* a key were configured, and say nothing about public RSS, which is the
   path actually taken.
2. **stocktwits.com** — the conditions should name the API carve-out the code relies on,
   since the verdict turns entirely on calling the API host rather than the site.
3. **bitget.com** — `termsUrl` should point at the operative document, not the index.

**Confidence** — proposed `medium` for all of Group A. Not `high`: every one of these is
a single reading of a single document on one day, and `high` is what CoinGecko earned
with a clause that addresses the mechanism directly.

---

## Group B — the verdicts, which are yours

### B1. The one ruling that settles nine

**Does a publisher's website ToU govern its public RSS feed?**

The audit's central finding is that these documents *do not say*. Every publisher offers
an RSS feed; every feed answers an unauthenticated request; and the terms barely
acknowledge RSS exists — Cointelegraph, Bitcoin Magazine, CNBC, OilPrice and FXStreet
mention it **zero** times. Meanwhile every one contains a broad anti-automation clause
that a keyword scan would flag.

So the honest statement is neither "cleared" nor "in violation": *these terms govern the
website, do not mention the feed, and the publisher offers the feed openly.*

Affects: bitcoinmagazine.com, cnbc.com, coindesk.com, cointelegraph.com, decrypt.co,
dowjones.io/marketwatch.com, fxstreet.com, investing.com, oilprice.com — and
reddit.com, whose public-RSS path lands on the same question.

| If you rule | Then |
|---|---|
| **The feed is offered, so using it is permitted** | Verdicts stay `conditional`; conditions rewritten to headline + link + attribution, no full text. Nothing goes dark. |
| **The website ToU governs everything** | Cointelegraph, OilPrice and FXStreet go first — and `prohibited` is a socket-level block, so `/live-data/news` empties. The audit's recommended interim is `conditional` with honest conditions, **not** `prohibited`. |
| **Ask the publishers** | CoinDesk and Dow Jones/MarketWatch need an email rather than a fetch; the rest could follow the same route. |

The audit also notes this is a **launch** question rather than a development one, on the
same reasoning as D3 — the feeds are consumed by a solo developer today.

### B2. publicnode.com — needs a judgement of its own

Its clause bars re-use, display, distribution "commercially and non-commercially". Read
literally it prohibits using an RPC provider for RPC, which cannot be the intent — but
it is what the document says.

Scope limits the exposure: called by exactly one route, `/live-data/wallet/eth`, as the
first rung of the EVM ladder, and `/wallets` is **already hidden from rollout**
(2026-08-22), so no user reaches it today.

### B3. bitget.com — two findings, one of them shared

1. **Internal-use licence** (§10.1) — the fourth source on the FMP/Twelve Data pattern.
2. ⚠ **The United States is a Prohibited Country**, named in §1 alongside Austria,
   Canada, France, Germany, Hong Kong, Japan and Singapore, with §2.8 making
   non-Restricted-Person status an eligibility condition.

This pairs with **XT.com**, which geo-blocks this region outright and publishes no
reachable terms. One ruling covers both: Bitget's is written, XT's is enforced at the
edge.

### B4. youtube.com — re-scope rather than rule

The reading found no personal-vs-commercial restriction; the obligations are
**attribution and Brand Features**. So T-240 was filed under the wrong question. The
open item becomes a UI check — *does `/videos` render the YouTube attribution the
Branding Guidelines require?* — which is not a terms reading and is not done.

---

## If Group A is approved

The edit is mechanical: 17 entries change `review` and `reviewedAt`, three also get
corrected `finding`/`conditions`/`termsUrl` text, and no verdict moves. The registry
then reads **21 of 56 verified**, and the remaining 35 `seeded` entries are genuinely
unread rather than a mix of unread and un-filed.
