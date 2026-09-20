# News publisher terms — CoinDesk, Dow Jones, Investing.com, 2026-09-20

**These are readings, not verdicts.** All three documents were captured and read on the
owner's machine. Changing any `verdict` or `review` flag is the owner's act.

⚠ **Two of the three read as `prohibited`, and both adversarial checks sustained that.**
`prohibited` in this codebase is enforced by `assertSourceNotProhibited` inside
`pinnedFetch` — a socket-level block, not a label. Nothing here has been flipped. The
decision, and its consequences, are set out at the end.

## Scope correction

The queue lists ten news-publisher items (T-140 to T-150). **Six are already `verified`** —
Cointelegraph, Decrypt, Bitcoin Magazine, CNBC, FXStreet, OilPrice. Four remained seeded,
and MarketWatch *is* Dow Jones, so this is **three documents covering four entries**.

---

## 1. Dow Jones / MarketWatch — the strongest finding

Terms of Use, **Effective Date 2026-06-30**, Dow Jones & Company, Inc.

### The host distinction, which is the entry's whole history

`www.marketwatch.com/robots.txt` carries an explicit notice — *"Collection of content and
other data … through automated means is prohibited unless you have express written
permission from Dow Jones & Company, Inc."* — followed by `User-agent: * / Disallow: /`
with an allowlist of named search bots.

**The app does not fetch that host.** It fetches `feeds.content.dowjones.io`
(`mw_topstories`, `mw_bulletins`), a different origin. robots.txt is per-origin, so that
`Disallow` does not reach the feed host — which has **no robots.txt at all** (403
AccessDenied, an S3 missing-key error) and serves its feed 200 publicly.
`www.dowjones.com/robots.txt` is `User-agent: * / Disallow:` — empty, allowing everything.

**That distinction does not survive the Terms.** §9.1 binds by *content*, not by host:

> The Services are for your individual, personal and non-commercial use only. Thus, you may
> not access or use the Content, including without limitation, any Content made available
> through one of our RSS feeds, in any commercial product or service, without our express
> written consent.

And §9.4.1 forecloses the intermediary argument explicitly:

> You shall not access, view, retrieve, refresh, reload, scrape, text or data mine, index,
> process, store, harvest, or otherwise ingest the Services or any Content, whether directly
> or through an intermediary, using any automated means, webcrawler, spider, script, site
> search/retrieval application, extension, bot, browser automation tool, API client, AI agent
> or assistant, or other manual or automated device, tool, process, software or other means,
> without our prior written consent.

A server-side RSS fetcher is "automated means … script … API client". "Whether directly or
through an intermediary" answers the separate-feed-host argument on its face.

### What remains genuinely open

The document never states that `mw_topstories` and `mw_bulletins` **are** "one of our RSS
feeds". That identification is an inference from MarketWatch branding and a `dowjones.io`
domain — strong, but an inference. It is the narrowest remaining doubt, and it is narrow.

### ⚠ A concrete defect in the registry

Both `marketwatch.com` and `dowjones.io` record `termsUrl:
'https://www.marketwatch.com/terms-of-use'`. **That URL returns a "Page Not Found" page**
(HTTP 403). The live document is `https://www.dowjones.com/terms-of-use/` — which
marketwatch.com's own robots.txt names, and which reads fine.

---

## 2. CoinDesk

Terms Of Use, **Effective Date 2025-11-14**.

**No RSS or syndication policy exists in the document.** A case-insensitive search for
"rss", "syndicat" and "feed" returns **zero hits** across 300 lines. Publishers often permit
far more by a dedicated feed policy than their general ToS implies; if CoinDesk has one, it
is neither in this document nor linked from it.

The operative clause, under Copyright, Trademark and Ownership:

> Except as may be otherwise indicated on the Services, you are only authorized to view,
> play, print and download documents, audio and video found on our Services for personal,
> informational, and non-commercial purposes only. You may not use, copy, reproduce,
> republish, upload, post, transmit, distribute, or modify the Content or the Company's
> trademarks in any way, including in advertising or publicity pertaining to distribution of
> materials on the Services, without Company's prior written consent.

⚠ **`whatMayBeDisplayed` is recorded as `unclear`, not `headline-and-link-only`, and the
distinction is deliberate.** The clause grants neither shape. Recording "headline and link
only" would read a grant of headline display into a document that grants none — the exact
inference-from-silence this registry's `seeded`/`verified` split exists to prevent.

**Attribution is silent, and silence here cuts the wrong way.** The Advertising Rights
clause reserves "attribution, links, promotional and distribution rights" to CoinDesk as
revenue-generating rights it sells — the opposite of a free attribution licence.

### What remains open

Scope, and it is genuinely two-sided. The feed sits on the same host and carries the same
articles, and "Services" is defined expansively; but a ToS that never mentions feeds may
simply not reach them, and a publisher that deliberately publishes one is inviting
automated consumption. **The document does not close either reading.** Unlike Dow Jones,
there is no clause binding by content rather than host.

---

## 3. Investing.com

Terms and Conditions, delivered as a **21-page PDF** behind hotlink protection (the CDN
403s any request without a `Referer` — not a UA filter).

The document **never mentions RSS or syndication**. Limitations on Use item (c):

> You are expressly forbidden from employing any automated system or software to extract
> data for content from this website for any purpose. This includes, but is not limited to,
> scraping, data mining, robot or spider programs, and other automatic devices, tools, or
> processes to access, extract, download, or copy any data or information from the website.

§20 Trademarks and Copyrights adds that reproducing or distributing protected material
requires "the prior written consent of Fusion Media (on a case by case basis)".

⚠ **This one carries a real internal tension**, and it should not be resolved by quoting
only one side. Investing.com *publishes* RSS feeds at `/rss/*.rss`, and its **robots.txt
permits `/rss/`** — publishing a feed and allowing it in robots is an invitation to
automated consumption. The ToS forbids automated extraction "for any purpose" in general
terms. Both are true at once.

⚠ **Fidelity caveat.** These quotes come from a text extraction of the PDF written for this
reading (no poppler on the machine). The extraction is readable but choppy — justified text
comes out word-per-line in places. **Re-check any quote against the PDF page before relying
on it in correspondence.**

---

## Three block mechanisms, three cures

Recorded because the probe reports all of them identically as "couldn't read it", and this
repo has already misattributed one of them twice:

| host | cause | cure |
|---|---|---|
| `site.financialmodelingprep.com` | user-agent filtering | a browser UA |
| `www.marketwatch.com` | blocks every UA; robots `Disallow: /` | express written permission |
| `cdn.investing.com` | hotlink protection (`Referer`) | send the referring page |

---

## Blast radius, measured

| source | share | if dropped |
|---|---|---|
| CoinDesk | 1 of 4 crypto feeds | Cointelegraph, Decrypt, Bitcoin Magazine remain — all `verified` |
| MarketWatch | 1 of **2** equity feeds | CNBC remains (`verified`) |
| MarketWatch | 1 of 8 macro feeds | general pillar; 2 CNBC feeds remain |
| Investing.com | 3 of 8 macro feeds | commodities keeps OilPrice, bonds keeps CNBC Economy, forex keeps FXStreet |

**All four are D21-compliant: dropping any one degrades a surface rather than removing it.**
The bonds pillar looked single-sourced until the route's own comment corrected it — *"CNBC
Economy is here mainly to feed the bonds pillar — the dedicated Investing.com bonds feed
publishes op-eds every few weeks, not news."*

## The decision this hands you

1. **Dow Jones / MarketWatch** — the evidence is the strongest of any source read to date:
   an express RSS clause, an automated-access bar naming "AI agent or assistant", and
   "whether directly or through an intermediary" closing the host argument. ⚠ Flipping to
   `prohibited` is a socket block that takes MarketWatch out of equity news (leaving CNBC
   alone) and macro news. Fix the dead `termsUrl` regardless of the verdict.
2. **CoinDesk** — same proposed verdict on weaker footing: a broad republication bar, but
   no clause reaching feeds by content, and a genuinely open scope question.
3. **Investing.com** — an express anti-automation clause against a deliberately published
   feed and a permissive robots.txt. The tension is real and unresolved here.
4. **The shape of the answer may not be binary.** Every one of these publishers permits
   automated use *with prior written consent*. That is the same instrument the four API
   providers named, so it belongs in the same conversation — see
   `docs/licensing/2026-09-20-provider-enquiries.md` and `docs/LEGAL-REVIEW.md`.
