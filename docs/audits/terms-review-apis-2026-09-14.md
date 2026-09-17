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


---

# Addendum — T-252, the withdraw-fee exchange hosts

`withdrawFeeAdapters.ts` fetches five exchange endpoints keylessly for the withdrawal-fee
overlay. All five were seeded LOW confidence and unread. One is now read in full, one was
read above, three remain.

## ⚠ A systemic registry defect: four more `termsUrl`s point at API documentation

The same fault found in Bitget on 2026-09-13 is present in every other withdraw-fee
entry. None of these is a terms document:

| Entry | Registered `termsUrl` | What it actually is |
|---|---|---|
| `poloniex.com` | `api-docs.poloniex.com/` | API documentation |
| `lbkex.com` | `lbank.com/docs/index.html` | API documentation |
| `bitfinex.com` | `docs.bitfinex.com/reference/rest-public-conf` | API reference page |
| `xt.com` | `doc.xt.com/` | API documentation |

**Every one returns HTTP 200**, so every probe this project has run scored all four as
"terms reachable". They never were. This is the failure mode the `seeded` flag cannot
catch: it records that nobody read the document, not that the link points somewhere that
is not a document. Five of five withdraw-fee entries had it.

## T-252a Bitfinex — read in full, and the operative document was not the obvious one

Two documents, and the first one sent me to the second:

**API Terms of Service** (updated 2025-01-07) opens with a requirement we do not meet:

> **API Keys Required to Access the Bitfinex API.** In order to use the Bitfinex API, you
> must first sign up for an Account through the Site.

We call `api-pub.bitfinex.com/v2/conf/pub:map:currency:tx:fee` keylessly, with no account.
But that same document points elsewhere for what we actually consume — *"your access and
use of Bitfinex Market Trading Data is subject to the Bitfinex Market Trading Data Terms
of Use"* — so the API Terms are not the operative document here.

**Market Data Terms of Use** (updated 2022-07-06) are, and they bind differently:

> **By accessing or using the Bitfinex Market Data, you agree to be legally bound** by
> the terms and conditions of these Market Data Terms.

No account required — access alone binds. That resolves the ambiguity Bitget's terms left
open, at least for Bitfinex.

> **Permitted Use** means your use of Bitfinex Market Data solely for: (i) **personal
> and/or internal use**; (ii) **general informational purposes**; or (iii) analysis of
> prices and markets…

> **Prohibited Use.** Absent prior express written consent… you may not: …
> (g) **Distribute, redistribute, disseminate, sell, resell, license, or sublicense
> Bitfinex Market Data to any party for any reason**

Personal and internal use is expressly permitted, and "general informational purposes" is
arguably wide enough to cover a fee table. Clause (g) is the counterweight, and the
question it raises is the one every source now raises: whether showing the data to your
own users is "disseminating to a party".

Also worth noting for any future clause-scan: (b) and (c) prohibit using the data to
create a **financial benchmark, reference rate, or index**, or to price a financial
product. Nothing in Finance Now does that, but a "composite fee index" or similar would.

## Three remain unread, and why

> **⚠ SUPERSEDED 2026-09-15 — two of the three are now read, and one of them changed a
> verdict. Read the "T-252 closed" addendum at the end of this document before relying on
> anything in this section.** It is kept unedited because the reason the first attempt
> failed turned out to be wrong in an instructive way.

Poloniex, LBank and XT.com are all client-rendered, and unlike Bitget and Tiingo they
resisted the browser too — Poloniex's footer "User Agreement" is a JS-routed control that
did not navigate on click, and the direct `/terms-of-use/` path 404s. Rather than keep
poking one turn at a time, they are recorded as unread.

**Their terms are NOT assumed to match the pattern**, even though five of five read so
far do. That assumption is exactly what the `seeded` flag exists to prevent.

The useful next step for all three is the same and is not a fetch: their API
documentation pages (the URLs currently in the registry) usually link the operative
terms from within the docs site itself.

## What the five readings add up to

| Source | Licence shape |
|---|---|
| FMP | Personal use only; multi-user display needs a specific agreement, "irrespective of whether such usage is complimentary or paid" |
| Twelve Data | Internal Use; display to third parties needs a tier, add-on, or separate agreement |
| Tiingo | "All data via the API is for internal consumption only"; redistribution on request, with fees |
| Bitget | "non-commercial personal or internal business use" |
| **Bitfinex** | **"personal and/or internal use"; redistribution to any party for any reason prohibited** |

**Five for five.** The wording differs; the line does not. This is no longer a pattern
that might not hold — it is the industry's standard posture, and the D3 launch ruling has
to be measured against all five at once rather than source by source.

---

# Addendum — T-252 closed, 2026-09-15

Read on the owner's machine, clean residential US egress, VPN off. Two of the three
remaining hosts are now read; the third is unread for a reason that matters more than the
reading would have. **T-252 is closed.**

## The method note first, because it explains the previous failure

The 2026-09-14 pass recorded Poloniex's footer "User Agreement" as *"a JS-routed control
that did not navigate on click"*. That diagnosis was wrong. It is an ordinary
`<a href="/support/terms">`; the click handler is broken, but the `href` was in the DOM
the whole time. Enumerating anchors and reading their `href` — rather than driving the UI
and observing what happens — found Poloniex's document in one step and LBank's in two.

Worth generalising: **when a page is client-rendered, read the DOM, don't drive it.** The
earlier attempt failed at the interaction layer and recorded the result as a property of
the document's availability. That is the same category error as the three wrong network
attributions in CLAUDE.md — one observation read as a property of the world.

## T-252b Poloniex — READ, and it broke the pattern

**Operative document:** `https://www.poloniex.com/support/terms` — Poloniex User
Agreement, last revised **2026-04-01**. The registry previously pointed at
`api-docs.poloniex.com`, which is API documentation.

**It binds without an account.** "Services" is defined to include "use the Poloniex
Application Programming Interface ( "API" )", and acceptance reads:

> By registering for a Poloniex account ( "Account" ) **or using any of the Services**,
> you agree that you have read, understood and accept all of the terms and conditions
> contained in this Agreement

Same access-binds shape as Bitfinex's Market Data Terms. Calling `api.poloniex.com`
keylessly and anonymously is inside its scope.

**§9 API USE is the finding:**

> Subject to your compliance with this Agreement…, Polo hereby grants you a limited,
> revocable, non-exclusive, non-transferable, non-sublicensable license, to use the API
> **solely for the purposes of trading on Poloniex**. You agree not to use the API or data
> provided through the API **for any other commercial purpose**.

**§23 RESTRICTED ACTIVITIES** adds, among the prohibited activities: "use a web crawler or
similar technique to access our Services or to extract data".

### Why this is `prohibited` and not a tighter `conditional`

The five sources read before it — FMP, Twelve Data, Tiingo, Bitget, Bitfinex — all say
some version of *internal use only*. That is a **condition on a licence we hold**, which
is what `conditional` is for, and it is why the FMP entry carries an explicit warning
against reflexively flipping to `prohibited`.

Poloniex is a different shape. It grants a licence **solely for trading on Poloniex**.
Finance Now does not trade on Poloniex, so the withdrawal-fee overlay is not a licensed
use failing a condition — it is **outside the grant entirely**. There is no licence here
to condition.

The "five for five" conclusion in the main document was right about the five and wrong as
a forecast. The `seeded` flag existed precisely to stop that forecast becoming a record,
and on the sixth source it paid for itself.

### What was removed

Owner decision, 2026-09-15: record it as `prohibited`. Consequences, all landed together
because the registry's design requires it — a prohibited host in `dataSources.ts` fails
`__tests__/sourceTerms.test.ts`, and `assertSourceNotProhibited` in `pinnedFetch` would
refuse the call at the socket regardless:

| File | Change |
|---|---|
| `lib/server/sourceTerms.ts` | Entry moved to the PROHIBITED block; `verified`, confidence `high`, real `termsUrl` |
| `lib/data/dataSources.ts` | Poloniex provider removed from the `withdraw-fees` entry |
| `lib/server/withdrawFeeAdapters.ts` | `parsePoloniexCurrencies` deleted; source removed from `WITHDRAW_FEE_SOURCES` |
| `__tests__/withdrawFeeAdapters.test.ts` | Parser tests replaced by a four-assertion removal guard |

This is the Yahoo precedent (2026-08-06) applied a second time, and the same reasoning
applies to the deleted parser: an unused parser is an invitation to re-register the
source.

**The overlay loses 31 of its ~280 live rows.** Poloniex's endpoint answers fine — that is
exactly what makes the guard worth having, because a source removed on terms looks, to a
later reader, like a working endpoint someone forgot to wire up.

> **⚠ OPEN, and deliberately not acted on: the static `transferFees.ts` Poloniex rows.**
> They were left in place. Several carry the note *"the stored value is a 2026-08-22
> reading"* — one day after this endpoint was wired up, and `WITHDRAW_FEE_SOURCES`
> records the owner probe of **2026-08-22** returning 31 Poloniex rows. That is
> suggestive, not established. Nobody has checked whether those hand-maintained values
> were copied from the API or read from Poloniex's published fee page, and the two have
> different answers under §9. **Someone should establish the provenance before the next
> `TRANSFER_FEES_LAST_VERIFIED` bump.** It is not a deletion decision to make on a
> suspicion.

## T-252c LBank — READ, and it does not reach us

**Operative document:** `https://www.lbank.com/support/articles/21436496711705` — LBank
User Service Agreement, dated **2026-07-22**. The footer's "Terms of Use" link points at a
support *section* listing several articles; this is the operative one inside it. The
registry previously pointed at `lbank.com/docs/index.html`, which is API documentation.

Two findings that pull in opposite directions.

**1. Its acceptance clause is triggered only by registration.**

> By clicking "Agree and Register" on the LBank registration page and **completing the
> full registration process** to obtain an LBank account and password, the User is deemed
> to have fully read, understood, and accepted all terms of this Agreement. This Agreement
> shall become effective **immediately upon such completion**.

Registration is the only trigger named. We never register. And the agreement contains
**no API clause at all** — the only occurrence of "API" in the document is a footer
navigation link.

**2. The IP claim does not depend on the contract.**

> All intellectual property rights in the content on the LBank platform, including but not
> limited to platform logos, **databases**, website design, text, graphics, software…are
> owned by LBank. Users shall not reproduce, modify, copy, distribute, or use any of the
> foregoing materials or content **for commercial purposes**.

> Any authorized browsing, copying, printing, or distribution of content on the LBank
> platform **must not be used for commercial purposes**, and all usage of such content or
> any portion thereof must include the applicable copyright notice.

So there is no contractual bar on an anonymous keyless caller, but there is a standing
ownership claim over the data itself — "databases" is named explicitly — that survives the
absence of a contract. It lands in the same place as every other read source (fine
internally, unresolved for public display) by a different route.

Recorded as `conditional` / `verified` / confidence **medium** — medium on a document read
end-to-end, because the *reading* is solid and the *conclusion* has a genuine interpretive
seam. A third condition was added naming the database IP claim.

### Three documents, three different binding triggers

Worth stating plainly, because it is the second forecast this exercise has falsified:

| Source | Bound by |
|---|---|
| Bitfinex | **Access** — "By accessing or using the Bitfinex Market Data, you agree to be legally bound" |
| Poloniex | **Use of the Services**, API use named in the definition |
| LBank | **Completing registration**, and nothing else |

Do not generalise the trigger from one document to the next any more than the licence
shape.

## T-252d XT.com — UNREAD, and the reason is the finding

`https://www.xt.com/` redirects to `/en/restrict`:

> We have detected that your IP is located in a restricted area for XT services. Due to
> relevant laws and regulations, **XT does not provide services in your country or
> region.**

The page offers a "click here to attempt logging in" bypass. **It was not used.**

**No terms document is reachable.** Five approaches, all exhausted:

| # | Approach | Result |
|---|---|---|
| 1 | `www.xt.com` footer | Geo-redirect; zero anchors rendered |
| 2 | `doc.xt.com` (the registered `termsUrl`) | Docusaurus API docs, zero legal links |
| 3 | `/sitemap/en.xml` | 33,246 URLs; 4,697 non-price; **not one** terms/legal/privacy page |
| 4 | `/en/accounts/register` | i18n keys only (`register.terms`, `register.agreeTermsAndPolicy`) — URLs resolve client-side from a locale bundle |
| 5 | 12 conventional paths | `/en/terms`, `/en/legal`, `/en/agreement`, `/en/userAgreement`… all 404 |

`robots.txt` is fully permissive (`User-agent: *` / `Allow: /`) — a machine-readable
signal, and not a licence.

**Recorded as: entry annotated, verdict `conditional`, review stays `seeded`, confidence
stays `low`, and `reviewedAt` deliberately LEFT at 2026-08-21.** Bumping the date would
buy another 180 days of silence from the staleness report on the strength of a search that
failed — the exact laundering `sourceTerms.ts`'s header exists to prevent.

**The geo-block is the real finding, and it is a decision, not a terms question.** It is a
second instance of the unresolved Bitget US-prohibition item, and a harder one: Bitget's
prohibition is written, XT's is *enforced at the edge*. Both belong to the same owner
decision in `docs/decisions/2026-09-14-owner-decisions.md`.

## The systemic `termsUrl` defect is now fully closed

The 2026-09-14 pass found that all five withdraw-fee entries pointed `termsUrl` at API
documentation, every one returning HTTP 200, so every probe ever run scored them "terms
reachable". Final state:

| Entry | Now points at | Status |
|---|---|---|
| `bitget.com` | The terms document | Fixed 2026-09-14 |
| `bitfinex.com` | Market Data Terms | Fixed 2026-09-14 |
| `poloniex.com` | `/support/terms` | **Fixed 2026-09-15** |
| `lbkex.com` | The User Service Agreement | **Fixed 2026-09-15** |
| `xt.com` | Still `doc.xt.com` | **Known-wrong, annotated** — XT publishes nothing to replace it with |

Four of five fixed. The fifth cannot be fixed, which is itself worth recording: the
registry has **no null state** for "this operator publishes no reachable terms", so a
known-wrong URL sits there with a comment telling the reader its 200 means nothing.
Worth considering an explicit `termsUrl: null` with a required reason.

## Six sources read. The tally, corrected

| Source | Licence shape | Binds on |
|---|---|---|
| FMP | Personal use only; multi-user display needs a specific agreement | — |
| Twelve Data | Internal Use; third-party display needs a tier or agreement | — |
| Tiingo | "internal consumption only"; redistribution on request, with fees | — |
| Bitget | "non-commercial personal or internal business use" | — |
| Bitfinex | "personal and/or internal use"; redistribution prohibited | Access |
| **Poloniex** | **Licence solely for TRADING ON POLONIEX; no other commercial purpose** | Use of Services |
| **LBank** | No API clause; database IP claim bars commercial reproduction | Registration only |

**Five of five became six of seven.** The internal-use pattern held for five sources and
then did not. The practical lesson is the one the main document already stated as a
caution and can now state as a result: *the pattern is not evidence about the next
source.*
