# News-publisher terms — read on the owner's machine, 2026-09-14

**Readings, not verdicts.** Eight publisher terms documents were opened and their
licensing clauses read from a verified clean residential egress (Charter/AS11426,
`proxy:false`). Flipping any entry to `review: 'verified'`, and setting any `verdict`,
are the owner's acts — see "The decision this hands you".

Covers T-141 through T-150 (the news publishers) and T-140 (the probe re-run).
Supersedes the probe section of `terms-review-2026-09-09.md` for these hosts, which
ran behind AS62651 and could not read most of them.

## Why this could not have been done yesterday

The first attempt at this task, earlier the same day, ran while a VPN was up on
**AS62651** — the same exit node that made mempool.space look dead and left FMP's terms
unread for 11 days. On that egress: CoinDesk `429`, Cointelegraph and Decrypt both `404`
with full-size bodies (soft 404s indistinguishable from a wrong URL), while the control
request to FMP returned `200`. Twenty readings from there would have produced twenty
"couldn't read it" results, which by this project's own rule is **not permission** — so
every entry would have stayed `seeded` and nothing would have moved.

The egress check is now the first step of this task, not an afterthought:

```bash
curl -s https://api.ipify.org
curl -s "http://ip-api.com/json/<ip>?fields=isp,as,proxy,hosting"
```

## What the app actually fetches

Scoping first, because a prohibitive clause on a host we never touch is noise. Eleven
feeds across three routes, **all returning 200** from the clean egress today:

| Route | Feeds |
|---|---|
| `/live-data/news` (crypto) | bitcoinmagazine.com/feed · cointelegraph.com/rss · decrypt.co/feed · coindesk.com/arc/outboundfeeds/rss/ |
| `/live-data/market-news` | feeds.content.dowjones.io/public/rss/**mw_topstories** · search.cnbc.com/…/view.xml |
| `/live-data/macro-news` | feeds.content.dowjones.io/public/rss/**mw_bulletins** · oilprice.com/rss/main · fxstreet.com/rss/news · investing.com/rss/{news_1,news_11,bonds_Fundamental}.rss · 3× search.cnbc.com |

⚠ **A correction to my own working note.** An earlier pass in this session reported the
MarketWatch and Investing.com feeds returning 404. That was wrong and the fault was
mine: the regex I used to extract feed URLs omitted the underscore from its character
class, so `mw_bulletins` truncated to `mw` and `news_11.rss` to `news`. I then fetched
URLs I had invented. Both real feeds return 200, and the running app serves MarketWatch
and Investing.com articles from them right now. Recorded because "the feed is dead"
would have been a plausible, wrong, and expensive finding.

## The central result: the terms are silent on RSS

Every one of these publishers **publishes an RSS feed**, and every feed answers a plain
unauthenticated request. Their terms of use, meanwhile, barely acknowledge that RSS
exists:

| Publisher | Mentions of "RSS" / "feed" / "syndicat*" in its terms |
|---|---|
| Cointelegraph | **0** |
| Bitcoin Magazine | **0** |
| CNBC | **0** |
| OilPrice | **0** |
| FXStreet | **0** |
| Decrypt | 2 — and only as *"any of the features of the Site, including but not limited to RSS feeds, APIs, and Software"* |

This is the answer to the question `CLAUDE.md` posed — *"their permission rests on a
publisher syndication policy rather than an API licence"* — and the answer is that
**none of them published a syndication policy.** The documents do not address the
mechanism actually in use.

That matters because a keyword scan of these same documents reports the opposite. Every
one contains a broad anti-automation or anti-redistribution clause, and a scan would
flag all eight as prohibitive. The accurate statement is narrower and more useful:
**these terms govern the website, do not mention the feed, and the publisher offers the
feed openly.** Neither "cleared" nor "in violation" — unresolved, on the record, for a
human to weigh.

## The clauses, verbatim

**Cointelegraph** — the most pointed, and it cuts both ways:

> Redistribution, reproduction, **automated scraping, or creation of independent content
> pipelines** based on Cointelegraph reputation is strictly prohibited without prior
> written authorization. **Quoting Cointelegraph Content is permitted** when it reflec…

An RSS-driven headline feed is arguably "an independent content pipeline"; showing a
headline with a link to the source is arguably "quoting". The sentence does not settle
which one this is.

**OilPrice** — the clearest personal-use restriction of the eight:

> (a) The information provided on the Oilprice.com website is for **personal,
> non-commercial use**.
>
> (b) User agrees to **not use any robot, spider, other automatic device**, or manual
> process to monitor or copy any of Oilprice.com's web pages…

**FXStreet** — prohibits redistribution outright, and even links require consent:

> …the **reproduction, retransmission, copying, transfer, or redistribution**, in whole
> or in part, of the information contained on the Page, **regardless of its purpose**…
> is prohibited without prior authorization from the Company.
>
> If you are interested in activating a link to any of the Company's pages, you must
> communicate it, **obtaining express consent to create the link**.

**CNBC** — the restrictive clauses are **scoped to paid products**, not the free feed.
The "may not scrape, repackage, reproduce, republish, recirculate" language belongs to
the Investing Club terms, and the personal-use restriction to CNBC+. The general terms
say nothing about the RSS endpoint we call.

**Bitcoin Magazine** — a single generic reservation:

> Unauthorized reproduction, distribution, or modification is prohibited without our
> prior written consent.

**Decrypt** — names RSS as a Site feature; its detailed licence grant concerns
user Submissions, not third-party consumption.

## Two publishers could not be read at all

| Host | Result, clean residential egress | Note |
|---|---|---|
| **CoinDesk** | `429` on `/terms` and on the homepage, twice, 20s apart | Their **RSS feed returns 200** from the same IP in the same minute. They rate-limit the terms page while serving the feed |
| **MarketWatch** | `401` on the homepage | The feed we actually use is `feeds.content.dowjones.io`, whose `robots.txt` also returns `403`. So the host we fetch publishes no readable robots policy and no reachable terms |

"Couldn't read it" is not permission. Both stay `seeded`, and CoinDesk and Dow Jones are
the two worth a direct approach rather than another fetch.

## The decision this hands you

1. **The framing question.** Does a publisher's website ToU govern its RSS feed? These
   eight documents do not say. That is a judgement about eight sources at once, and it
   is the same shape as the FMP question answered on 2026-09-13 — except FMP's document
   *did* address the mechanism and these do not.
2. **The three pointed cases** — Cointelegraph, OilPrice, FXStreet — are where a
   literal reading is hardest to square with what the app does. If the ruling is
   restrictive, those three go first.
3. **CNBC is the most comfortable** of the eight: its restrictions are explicitly scoped
   to paid products.
4. **CoinDesk and Dow Jones/MarketWatch need a different route** — an email, not a
   fetch.
5. This is a **launch** question, not a development one, on the same reasoning as D3:
   the feeds are consumed by a solo developer today.

⚠ **Do not reflexively flip any of these to `prohibited`.** In this codebase that verdict
is enforced by `assertSourceNotProhibited` inside `pinnedFetch` — a socket-level block.
Prohibiting Cointelegraph, OilPrice and FXStreet would empty `/live-data/news` and take
most of `/live-data/macro-news` down immediately. `conditional`, with the conditions
rewritten to say what the terms actually say and what they leave open, is the honest
interim.
