# Owner decisions — 2026-09-23

## D22 — Finance Now is personal today and commercial by intent (answers T-151)

**Owner, 2026-09-23, verbatim:**

> *"The goal will be commercial; currently it is personal but we are building with the goal
> of it being public."*

This answers **T-151**, which `docs/LEGAL-REVIEW.md` §2 names as the keystone — the
question "everything below bends around". It had been open since the 2026-08-29 probe and
gates eight sources: FMP, Finnhub, Twelve Data, Tiingo, Binance.US, YouTube, OilPrice and
Bitget.

The item's own `next_action` anticipated this shape: *"Owner states whether Finance Now is
personal/internal or a commercially served product (and, if commercial, whether that is
true now or only at release)."* The answer is **only at release**.

---

### What the answer is measured against

LEGAL-REVIEW §2 states the operative test, and it is narrower than "is it a business":

> *"Answering T-151 does not require answering whether the product is ever monetised. It
> requires answering whether **anyone other than the owner will be able to load a page**,
> because that is the line every one of these documents draws."*

So D22 resolves into two states with a trigger between them.

### State 1 — today: inside every default licence

Verified in the tree on 2026-09-23, not assumed from intent:

| Check | Finding |
|---|---|
| Staging deploy | `STAGING_DEPLOY_ENABLED` has never been set (`cd-staging.yml`) |
| Production deploy | gated on `workflow_dispatch` only — never automatic |
| Infrastructure | no `.tfstate` anywhere in the tree; nothing has been provisioned |
| Reachability | the app runs locally; no deployed instance exists |

Nobody other than the owner can load a page. The four personal-use licences are therefore
**satisfied as the app stands**, and no remediation is owed today.

### State 2 — at release: outside all four, with no tier that cures it

The four readings were taken on the owner's machine and are recorded in
`docs/audits/terms-review-fmp-2026-09-13.md`,
`terms-review-finnhub-2026-09-20.md` and
`terms-review-twelvedata-binanceus-2026-09-20.md`:

| Source | Multi-user deployment | Route it names |
|---|---|---|
| FMP §2.2.2 | barred | Order Form / specific agreement |
| Finnhub | barred | written approval |
| Twelve Data §2.2(e) | barred | Redistribution Rights Add-On or written agreement |
| Binance.US | barred | **none stated** |

FMP §2.2.2 bars multi-user deployment *"irrespective of whether such usage is complimentary
or paid"*, which is why upgrading a plan does not resolve it. This is a **licensing**
constraint, not a pricing one.

### ⚠ The trigger is the first non-owner page load

Not a launch date, not a monetisation event, not incorporation. The moment a second person
can load a page, the app is operating outside four default licences it is inside today.
That distinction matters because a private beta, a demo link, a shared staging URL and a
screenshare-with-a-friend all cross the same line while feeling nothing like "going
commercial".

---

### What D22 changes

**It converts the question from "are we compliant?" to "what must be secured before the
first non-owner sees a page?"** Those are different problems with different owners, and
only the second has a deadline.

**The seven drafted provider enquiries become launch-blocking.**
`docs/licensing/2026-09-20-provider-enquiries.md` holds them; **none has been sent.** Under
D22 they stop being optional diligence and become the mechanism by which State 2 is
reached legally. Three of the four providers name a route to ask down; sending the letter
is the owner's act and nothing in the repo can do it.

**Binance.US is the sharp one.** It is the only one of the four that names **no route at
all** to a multi-user licence. That may mean the route exists and is undocumented, or that
there is none — the reading cannot distinguish those, and only Binance.US can. It should
be treated as the longest-lead item of the four, not the smallest.

**D21 still defers the paid half, and still does not defer this half.** D21 (2026-09-18)
defers decisions "around a paid service" until late production. LEGAL-REVIEW §2 already
records why that does not cover this: *"That is not a pricing problem, so D21 — which
defers paid decisions — does not defer it."* The operative half of D21 here is the other
one — **no provider may be load-bearing** — and it now has teeth it did not have before,
because a provider that refuses a multi-user licence must be survivable rather than
negotiable. `npx tsx scripts/gen-coverage-matrix.ts` is the measurement.

**It unblocks T-153, T-149 and T-152**, per T-151's `next_action`.

---

### What D22 deliberately does NOT decide

- **Whether the product is monetised**, or how. LEGAL-REVIEW §2 is explicit that T-151 does
  not require it, and D22 does not supply it.
- **Any timeline.** "Building toward public" sets a direction, not a date. Nothing here
  should be read as committing to one.
- **The news publishers.** T-140–T-150 rest on syndication policy rather than an API
  licence, and are a separate cluster with separate reasoning. D22 does not reach them.
- **Whether any of this is legally sufficient.** These are readings of published terms
  recorded by the people who read them. The decision to rely on them, or to take advice
  before relying on them, is the owner's and sits outside the repo.
