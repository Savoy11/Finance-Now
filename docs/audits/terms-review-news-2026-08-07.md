# Source terms review worksheet — 2026-08-07

> ⚠ **THIS RUN READ NOTHING. It is the work queue, not the review.**
>
> Generated in an environment whose network policy blocks every publisher host
> at the gateway (`connect_rejected` on all ten). Every `robots.txt` line below
> says 403 and every `Terms found at` says none — that is this machine, not the
> publishers, and per the probe's own rule "couldn't read it" is neither
> permission nor refusal.
>
> **Re-run it from a machine that can reach these sites:**
> `npm run terms:report -- --news --out docs/audits/terms-review-news-<date>.md`
>
> Then read each linked document, fill in the conclusion boxes, and flip the
> entries in `frontend/src/lib/server/sourceTerms.ts` from `review: 'seeded'` to
> `review: 'verified'` with an updated `reviewedAt`. The registry's UI counts and
> its `confidence` grade key off that field, so they correct themselves.


10 host(s). Probe output is **advisory**: it locates the document and
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

## CoinDesk — `coindesk.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.coindesk.com/terms |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (HTTP 403) — no stated restriction |
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
| robots.txt | robots.txt not readable (HTTP 403) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | Cointelegraph: permitted subject to 2 condition(s) — Headline, link and feed summary only; Attribute and link back to the origin article. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

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

## Decrypt — `decrypt.co`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://decrypt.co/terms |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (HTTP 403) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
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
| robots.txt | robots.txt not readable (HTTP 403) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | Bitcoin Magazine: permitted subject to 2 condition(s) — Headline, link and feed summary only; Attribute and link back to the origin article. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

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
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (HTTP 403) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | MarketWatch: permitted subject to 3 condition(s) — Headline, link and feed summary only; Attribute and link back; Personal, non-commercial use. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

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
| robots.txt | robots.txt not readable (HTTP 403) — no stated restriction |
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
| robots.txt | robots.txt not readable (HTTP 403) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
| Summary | OilPrice.com: permitted subject to 2 condition(s) — Headline, link and feed summary only; Attribute and link back. ⚠ Seeded entry — the terms document has not been read for this project; treat as a working assumption, not a clearance. |

**Recorded finding:** Publishes a public RSS feed and permits syndication of headline/link/summary with attribution and a link back.

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

## FXStreet — `fxstreet.com`

| | |
|---|---|
| Current verdict | `conditional` (confidence: medium) |
| Review state | ⚠️ **seeded — never read** (2026-08-06) |
| Registered terms URL | https://www.fxstreet.com/about/terms-of-service |
| Probe outcome | `registry-seeded` |
| robots.txt | robots.txt not readable (HTTP 403) — no stated restriction |
| Terms found at | _none found at the usual locations_ |
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

## ⚠ Added 2026-09-10 — MarketWatch is the priority, and for a reason the worksheet understates

The 2026-09-09 probe run recorded `marketwatch.com` as **`blocked`**. That is the one
outcome the registry enforces automatically, and the cause is **robots.txt, not the
paywall**:

    robots.txt disallows / for financenow

**The live inconsistency.** `robotsDisallowed` is set on exactly one entry —
`reddit.com`, gated in `pinnedFetch` since 2026-08-29 and lifted only by
`REDDIT_CLIENT_ID`. MarketWatch has no such record, so nothing gates it, and the
2026-09-09 audit shows `market-news` serving **"10 articles from CNBC, MarketWatch"**.
So the app is currently fetching a host whose robots.txt disallows its agent, on a
shipping surface (`/equities/news`, and the markets half of `/headlines`).

That is the same situation Reddit was in before it was gated, and the registry's own
rule is unambiguous: robots.txt "is an instruction we either honour or don't."

**Why this is a decision and not a fix.** Gating MarketWatch leaves CNBC as the *only*
equity news provider. That is a product call about a live surface, so it is recorded
here rather than acted on. The three options:

1. Gate it like Reddit (`robotsDisallowed`, no credential exists to lift it) — honours
   the file, halves equity news.
2. Read the robots file properly first: a disallow on `/` does not always cover the
   feed path, and several publishers permit `/rss` explicitly. **This is the cheap
   step and it has not been done** — the probe recorded the disallow on `/`, not
   whether the specific feed URL is excluded.
3. Decide the RSS feed is published for syndication and that its robots posture does
   not govern it — defensible for some publishers, but it needs to be a stated
   decision with the clause quoted, not a default.

**Separately, the paywall (owner, 2026-09-10):** MarketWatch requires a membership
after a small number of articles. That does not affect what we *fetch* — the feed
carries headline, link and summary, which is all the recorded conditions permit us to
show — but it does mean **every article link we render lands the reader on a wall.**
Worth disclosing at the link rather than discovering by clicking. It also reinforces
the existing "headline, link and feed summary only" condition: we must not be seen to
substitute for the article we cannot show.

### The cheap step, done — 2026-09-10

Option 2 above was run instead of left as advice, and it changes the framing: **the
feed is not on marketwatch.com at all.**

| Host | robots.txt | Do we fetch it? |
|---|---|---|
| `feeds.content.dowjones.io` — the URL `market-news` and `macro-news` actually read | **No robots.txt exists.** `/robots.txt` returns HTTP 403 `AccessDenied` (an object store, not a web server) | **Yes** — `mw_topstories` served HTTP 200, 8,259 bytes |
| `www.marketwatch.com` — the host the `blocked` verdict is about | `User-agent: * / Disallow: /`, with only Google's crawlers exempted | **No** — nothing fetches it |

So the automatic `blocked` verdict fired on a host this app never requests, and the
host it does request publishes no directive to honour or break. The Reddit parallel
in the section above is therefore **weaker than it first appeared**: Reddit's
disallow covered the very path being fetched, and this one does not.

**What actually remains open, and it is a terms question rather than a robots one.**
The marketwatch.com robots file carries a prose notice, quoted verbatim:

> Collection of content and other data on https://www.marketwatch.com/ through
> automated means is prohibited unless you have express written permission from Dow
> Jones & Company, Inc.

It scopes itself to `https://www.marketwatch.com/` — the site, not the feed host — and
points at the Dow Jones Terms of Use. So the question to answer is narrow and specific:

**Does Dow Jones's ToU govern an RSS feed they publish on a separate host, and does it
permit the headline/link/summary use already recorded as this entry's conditions?**

That is a reading of https://www.dowjones.com/terms-of-use/ — the document the notice
itself names, and the one neither entry has been read against. It is not answerable
from a robots file, and it applies to `dowjones.io` at least as much as to
`marketwatch.com`.

⚠ Do NOT gate marketwatch.com on the strength of the `blocked` verdict alone. It would
halve equity news to CNBC and would not stop a single request the app currently makes,
because the request goes somewhere else.
