# Source Terms — "are we allowed to use this website?"

_Added 2026-08-06, alongside the removal of Yahoo Finance as a data source._

Finance Now reads about forty external hosts. Until now the question the codebase
answered carefully was **where does this data come from** (`lib/data/dataSources.ts`,
the `/data-sources` page, the per-page `SourceLine` badges). The question it did not
answer anywhere was **may we take it** — and the answer for the app's single most
load-bearing source turned out to be no.

This document describes the safeguard that now answers it, on both sides: built-in
sources the maintainer adds in code, and arbitrary feed URLs a user pastes into the
Integrations page.

> **This is a compliance-tracking mechanism, not legal advice.** Every verdict is
> this project's reading of a published document on a stated date. The code's job is
> to make that reading explicit, dated, enforced, and re-checkable — not to be right
> about the law on its own.

> ⚠ **The registry ships almost entirely `seeded`, and that is a deliberate,
> visible state — not a claim of review.** It was authored in an environment whose
> network policy blocked every publisher and provider host at the gateway, so no
> terms document could be opened. **54 of 56 entries** are starting positions drawn
> from documented posture. Two are `verified`, both read on the owner's machine:
> **Cboe** (P2-O1, 2026-08-05) and **CoinGecko** (the first real probe run,
> 2026-08-29 — see `docs/audits/terms-review-2026-08-29.md`).
>
> By verdict, the 56 are 14 `approved`, 40 `conditional`, 2 `prohibited`.
> *(Counts refreshed 2026-09-08; this section said 47 of 48 with Cboe the only
> verified entry, written 2026-08-06.)*
>
> The first cut of this file had no `review` field at all, and gave every entry a
> `verifiedAt` date — which made 47 assumptions look like 47 readings. That is the
> specific failure this field exists to prevent, and it is worth stating plainly
> because a compliance record that overstates its own basis is more dangerous than
> no record: it stops the next person from checking.

---

## The three pieces

| Piece | File | What it does |
|---|---|---|
| **Registry** | `frontend/src/lib/server/sourceTerms.ts` | A dated verdict per domain, with the terms URL and what the document actually says |
| **Probe** | `frontend/src/lib/server/termsProbe.ts` | Live check of an unreviewed site: robots.txt, terms discovery, clause scan |
| **Enforcement** | `pinnedFetch`, `/live-data/config`, `__tests__/sourceTerms.test.ts` | Blocks at the socket, gates at save time, fails the build for an unreviewed built-in |

---

## The registry

```ts
{
  domain: 'yahoo.com',            // matches the host or ANY subdomain, on a label boundary
  name: 'Yahoo (incl. Yahoo Finance)',
  verdict: 'prohibited',          // 'approved' | 'conditional' | 'prohibited'
  termsUrl: 'https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html',
  finding: '…what the document says, specific enough to find the clause again…',
  conditions: ['…'],              // required when verdict is 'conditional'
  review: 'seeded',               // 'verified' = someone read it | 'seeded' = nobody has
  reviewedAt: '2026-08-06',       // date of that read, or of writing for a seeded entry
  confidence: 'high',

  // Optional, and deliberately SEPARATE from `review` — see below.
  robotsDisallowed: {
    observedAt: '2026-08-29',     // ISO date the robots.txt was actually read
    liftedBy: 'REDDIT_CLIENT_ID', // env var whose presence lifts the block
    note: '…what the directive says…',
  },
}
```

### `robotsDisallowed` is not a terms verdict, and the split is the point

A robots.txt directive and a terms reading are different kinds of thing. **robots.txt
is a machine-readable instruction we either honour or do not**; a terms verdict is
*our interpretation* of a legal document. Folding the first into the second would
launder a first-hand observation into looking like a completed review — an entry can
legitimately be `seeded` on its terms while carrying a dated, verified robots
reading, which is exactly Reddit's state after the 2026-08-29 probe.

When present, `assertRobotsPermits` (inside `pinnedFetch`) refuses the fetch unless
the named credential is configured — the credential being the thing that moves the
request off the disallowed anonymous path. Enforcing it at the socket means a new
call site inherits the block rather than having to remember it. One entry currently
carries this: **reddit.com**, lifted by `REDDIT_CLIENT_ID`.

Three verdicts, because two would collapse a real distinction:

- **`approved`** — permitted, unconditionally enough to just use. Public-domain
  government data, open-source keyless APIs, protocol-published rate endpoints.
- **`conditional`** — permitted *while specific conditions hold*. This is most of the
  registry, and the conditions are the maintainer's obligation, not something code can
  enforce: attribution, a rate limit, "personal use only", "headline and link only,
  never full article text". Writing them down is the point — an obligation nobody
  recorded is one nobody keeps.
- **`prohibited`** — forbidden, or no terms grant it and the site's general ToS forbid
  automated access. Hard-blocked in code.

**`review` and `confidence` are orthogonal, and both matter.** `review` says whether
anyone opened the document; `confidence` says how clear-cut the answer is once you
have. A `seeded` entry with `high` confidence means "the provider's posture is
unambiguous and we expect the document to confirm it" — still not a reading.

**Staleness, not expiry.** A verdict older than `SOURCE_TERMS_REVIEW_AFTER_DAYS` (180)
is reported stale; it is *not* disallowed. Terms change, but breaking the app because
nobody re-read a document is the wrong failure. `getSourceTermsProvenance()` dates the
registry by its **oldest** entry — re-reading one site's terms does not refresh the
other forty, the same rule the hand-maintained data catalogs follow.

---

## Two assertion forms, and why the split matters

```ts
assertSourceAllowed(url)        // STRICT — unreviewed fails
assertSourceNotProhibited(url)  // RUNTIME — only 'prohibited' fails
```

The distinction is the design, not an accident:

- **`prohibited` is a decision about someone else's terms.** It binds every request,
  forever, with no override. This is what makes the Yahoo removal *stick*: it is not a
  provider-list edit someone can undo by pasting a URL into Integrations.
- **`unreviewed` is a decision about us** — nobody has looked yet. Blocking that at the
  socket would break a source the user was shown the terms for and explicitly approved,
  since acknowledging a feed does not add a registry entry. So it is gated where the
  human is: at save time.

Collapsing them would either let a prohibited host through or make the acknowledgement
flow a lie.

---

## Enforcement, by path

### Built-in sources → test time

`src/lib/server/__tests__/sourceTerms.test.ts` walks every `host` declared in
`lib/data/dataSources.ts` and fails if one is unregistered or prohibited. Built-ins
never pass through a form, so there is no human to ask at save time; the review has to
be enforced somewhere and this is it.

Adding a `/live-data` route that fetches a new host means listing it in
`dataSources.ts` (the project already requires this, and `npm run data-sources --
--verify` cross-checks it against the code). The test then fails until someone reads
that site's terms and records a verdict. **It worked on its first run** — it caught ten
hosts already in production with no review on record.

### User-added feeds → save time, then socket

1. User pastes a URL into **Integrations → Add custom source**.
2. `POST /live-data/config` (`add-custom` / `update-custom` — edits go through the same
   gate, or "add an approved feed, then edit the URL" is a hole straight through it)
   calls `probeSiteTerms(url)`.
3. Outcome:
   - **hard block** → `403`, no override. Registry says prohibited, *or* the site's own
     robots.txt disallows the path. There is no checkbox for this, deliberately.
   - **needs acknowledgement** → `409` carrying the full report. The UI shows the
     matched clauses, the robots.txt result and a link to the terms, and asks the user
     to confirm they have read them. Re-POST with `termsAcknowledged: true`.
   - **clear** → saved.
4. Thereafter `pinnedFetch` re-checks the registry on **every request**. Putting the
   check at the socket rather than only at the save means a source configured before a
   verdict changed stops working when the verdict changes, instead of quietly
   continuing.

---

## What the probe actually checks

Three independent signals, reported separately rather than mashed into a score:

1. **robots.txt** — the one hard, machine-readable signal a site publishes about
   automated access. A disallow is a block. The parser follows the real spec:
   consecutive `User-agent` lines share one rule group, the most specific matching
   agent group wins outright, longest matching rule wins within a group, and `Allow`
   takes the tie — which is what lets a site say "stay out of `/api`, except
   `/api/public`".
2. **Terms discovery** — conventional paths (`/terms`, `/legal`, …) plus a scan of the
   homepage for links matching on **href *and* link text**, because plenty of sites
   link "Legal" to `/policies/9182` and an href-only scan misses exactly the pages
   hardest to guess.
3. **Clause scan** — restrictive patterns (automated access, scraping, redistribution,
   personal/non-commercial, prior written permission) and permissive ones (public API,
   RSS syndication, open licence). Every match carries **the sentence it came from**, not
   just a label: a verdict a human cannot check is not reviewable, and this report
   exists to be reviewed.

### Two things the probe will not do

**It will not call a keyword scan a reading.** `inconclusive` — nothing prohibitive
found — still requires human acknowledgement. Only `blocked` is enforced automatically.

**It will not treat "couldn't read it" as permission.** Publishers 403 datacenter IPs,
including on their legal pages (both terms documents consulted while writing the seed
registry returned 403 from this environment). `unknown` is its own outcome and asks a
human, exactly as `needs-review` does. This mirrors the rule already in `CLAUDE.md`:
availability findings must come from the owner's machine, never from CI.

---

## Closing out the seeded entries

```bash
npm run terms:report -- --seeded     # everything unread
npm run terms:report -- --news       # just the news publishers (do these first)
npm run terms:report -- --news --out docs/audits/terms-review-news-<date>.md
```

Run it **from a machine that can reach these sites** — the same rule as
`npm run audit`. It writes a markdown worksheet per host: current verdict, what the
probe saw, a link to the document, the clauses it flagged, and a conclusion box.
Read the documents, fill the boxes, then flip `review` to `'verified'` with an
updated `reviewedAt`. The `/data-sources` counts and the registry `confidence` grade
key off that field, so they correct themselves.

**Do the news publishers first.** They are the app's only keyless content sources,
and unlike the market-data APIs their permission rests on a publisher syndication
policy rather than a licence attached to a key. Four questions settle each one:

1. Is there a **separate RSS/syndication policy** distinct from the site ToS?
   Publishers often permit far more via RSS than their general terms suggest.
2. Does it restrict use to **personal / non-commercial**? Most news RSS terms do.
3. What may be **displayed** — headline and link only, or headline + summary? The
   route renders the feed summary, so a headline-and-link-only policy is a code
   change, not a note.
4. Is **attribution** required, and in what form? Record it as a `conditions` entry.

The open queue is `docs/audits/terms-review-news-2026-08-07.md`.

### What the first real probe run settled (2026-08-29)

`docs/audits/terms-review-2026-08-29.md` is the first run from an environment that
could actually reach these hosts. Two findings were acted on:

- **CoinGecko → `verified`**, against its **API Terms** — not the Website Terms the
  probe read by mistake. Clause 4.1.6 permits charging for products built on the API
  and bars only reselling API *access*, so the "non-commercial" alarm never applied
  here. Clause 4.4 prescribes the attribution **wording**, so
  `SourceProvider.attribution` carries "Powered by CoinGecko" verbatim with a 10px
  floor, and a test parses the rendered class and fails below it.
- **Reddit's robots.txt disallows this app's agent** — recorded as
  `robotsDisallowed`, not as a terms verdict, for the reason above.

**One question is still open and it decides eight sources**: whether this project's
use counts as personal or commercial (Finnhub, Twelve Data, Tiingo, Binance.US,
YouTube, OilPrice, Bitget — and **FMP**, added 2026-09-02). FMP is the load-bearing
one: first rung of the quote ladder, sole source for the Stock Registry universe and
the market calendar, and the OHLCV fallback — 7 live-data routes across 20 files. Its
seeded finding asserts the permission is tier-dependent; a 2026-09-01 fund-fee
assessment asserts personal use on every tier. Neither is a reading, and the seeded
finding read as already settled, so it never joined the queue. That is precisely what
`seeded` exists to expose.

## Maintenance

- **Adding a source:** read the terms, add an entry with `review: 'verified'`, run
  `npx vitest run sourceTerms`. If you are adding it without reading the document,
  say so with `review: 'seeded'` — that is a legitimate state, and pretending
  otherwise is what this field exists to stop.
- **Re-verifying:** `POST /live-data/source-terms { url }` runs the probe, or
  `GET /live-data/source-terms` returns the whole registry. Both are surfaced on the
  **/data-sources** page, prohibited entries first — they explain missing functionality
  elsewhere in the app, so burying them under thirty approvals would defeat the point.
- **Changing a verdict:** read the document yourself and update `verifiedAt`. Never
  downgrade a verdict on the strength of a CI probe.

Entries also carry a `confidence` field, orthogonal to `review`: `review` says whether
anyone read the document, `confidence` says how clear-cut the answer is once you have.
The `low` ones (Reddit, StockTwits) are where public terms are least explicit about
third-party display use.
