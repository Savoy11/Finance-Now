# CNBC terms and robots — first actual reading, 2026-09-20

**This is a reading, not a verdict.** Captured and read on the owner's machine over a
verified clean residential egress (`Spectrum`, `proxy:false`, `hosting:false`). The
`verdict` and any withdrawal are the owner's acts.

⚠ **This matters more than a routine entry: CNBC is now the only equity news source.**
MarketWatch was withdrawn on terms grounds earlier the same day, leaving
`/live-data/market-news` single-sourced. CNBC also supplies 2 of the 7 remaining
macro-news feeds.

---

## 1. The entry claimed a reading that never happened

Before today, `cnbc.com` carried `review: 'verified'`, `reviewedAt: '2026-09-14'`, with:

> finding: *"Publishes public RSS feeds per desk for syndication of headline/link/summary
> with attribution and a link back."*

**No audit anywhere quotes an NBCU or CNBC clause.** A search across all of `docs/` for
"NBCUniversal" returns three hits: two are *"Registered terms URL"* rows inside unfilled
generated worksheets, and the third is `docs/decisions/2026-09-14-owner-decisions.md`
listing **T-147 — "CNBC (NBCUniversal) terms — read, conclude, verify"** as a task.

The queue still carries T-147 as `open`, with `next_action`: *"Read
nbcuniversal.com/terms … flip the cnbc.com entry to verified via PR."* **The entry was
flipped without the reading the queue was still asking for**, and its finding was the
same invented-syndication template that `transferFees`, CoinDesk, Investing.com and both
MarketWatch entries carried — except those were honestly marked `seeded`.

`verified` is now true because the document has been opened, not because the flag was
re-set.

## 2. The registered terms URL was wrong

`https://www.nbcuniversal.com/terms` returns the **NBCUniversal corporate site** — 27 KB
of navigation (Home, About, Leadership, Comcast, Brands, Careers) with **zero** hits for
"RSS", "automated", "robot" or "scrape". It is not a terms-of-use document.

The operative document is CNBC's own, at
`https://www.cnbc.com/nbcuniversal-terms-of-service/` (689 KB; `cnbc.com/terms/` resolves
to the same page). That is now the registered URL.

## 3. The terms do NOT bar automated use of the free feeds

The anti-automation language appears three times and reads, each time:

> You may not scrape, repackage, reproduce, republish, recirculate, offer for sale, sell,
> create derivative works from, integrate into other products or services, or otherwise
> share with others for profit or commercial gain …

⚠ **Every one of the three sits inside Supplemental Terms for a PAID product** — CNBC+,
Investing Club, and CNBC Pro — each introduced by a licence grant scoped to that service
(*"We grant you a limited … license to access and use the Investing Club Services for
your personal and non-commercial use"*). There is no general clause barring automated
access to the free site, and **the free public RSS feeds are not addressed anywhere**.

This is the opposite of Dow Jones, whose §9.4.1 was general, named "any Content made
available through one of our RSS feeds", and explicitly reached intermediaries.

**Practical consequence:** the paid products are hard limits regardless of anything else.
CNBC+, Investing Club and CNBC Pro content must not be touched.

## 4. But robots.txt disallows this app, on the host it actually fetches

`search.cnbc.com/robots.txt` is **383 bytes in total** — the complete file:

```
User-agent: Amazonbot
Disallow: /
Allow: /rs/search/news/view.rss?partnerId=amznalx01

User-agent: *
Disallow: /
```

The app fetches `search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=…`,
which is inside the disallowed `/` and is **not** the single path carved out for
Amazonbot.

`www.cnbc.com/robots.txt` separately enumerates GPTBot, ClaudeBot, anthropic-ai, CCBot,
PerplexityBot, Bytespider, Diffbot and others in its own directives.

⚠ **Recorded as `robotsDisallowed`, separately from the verdict**, because they answer
different questions: robots.txt is an instruction we either honour or do not, a terms
verdict is our interpretation of a document. Same split applied to Reddit (2026-08-29)
and marketwatch.com (2026-09-20). Folding one into the other would launder a first-hand
observation into looking like a completed terms reading.

## 5. Why this is a decision and not a note

| | |
|---|---|
| Terms | Do **not** bar free-feed use. `conditional` is defensible. |
| robots.txt | Disallows this agent from the host we fetch. Unambiguous. |
| Enforcement today | **None.** The news routes use an unwrapped `fetch`, so `assertRobotsPermits` — which lives in `pinnedFetch` — never runs for them. |
| Blast radius | Honouring it **empties** equity news. CNBC is the only source left. |

That last row is new. Every previous withdrawal in this registry degraded a surface;
this one would remove one. Nothing has been withdrawn on this basis, and the entry says
so.

### The options, none of them free

1. **Honour robots and withdraw CNBC.** Consistent with how marketwatch.com was treated.
   Equity news goes to zero sources until a replacement is vetted — the discovery feature
   shipped the same day is how that roster grows again.
2. **Keep fetching and record the conflict**, as now. Honest in the registry, but the app
   is knowingly fetching a path robots disallows.
3. **Ask CNBC.** The Amazonbot carve-out shows they do grant named-agent exceptions for
   partner feeds, so there is a precedent to point at. Drafted alongside the other
   enquiries in `docs/licensing/`.

Option 3 is the only one that ends with a working, permitted feed. It is also the slowest.
