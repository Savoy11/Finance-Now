# Terms review — CoinGecko API Terms of Service, read in full (2026-09-24)

**Closes T-243.** The 2026-08-29 probe read Scope of Use (Section 4) on the owner's machine and
the registry entry said so honestly: *"Scope of Use was read in full; the remainder of the
document was not."* This is the remainder — Sections 5 through 14 — read on 2026-09-24 in a
browser on the owner's machine over a residential egress (Spectrum, `proxy:false`,
`hosting:false`, checked first). Every quotation below is verbatim from the page as served.

| | |
|---|---|
| Document | https://www.coingecko.com/en/api_terms — **"Latest Version: 5 Sept 2025"** |
| Also read | https://landing.coingecko.com/excluded-countries/ (redirects to the support-centre article; "23 days ago Updated") |
| Governs | Gecko Labs Pte. Ltd., Singapore |
| Registry entry | `frontend/src/lib/server/sourceTerms.ts` — `coingecko.com`, `verified`, `conditional`, `reviewedAt` moved 2026-08-29 → 2026-09-24 |
| Verdict change | **None.** Still `conditional`. Six conditions added; the existing six stand |

> ⚠ Not legal advice. A careful reading, quoted verbatim, by someone who is not a lawyer.

---

## 1. What the remainder settles that Section 4 could not

**§11.4 confirms the entry's central reasoning.** The 2026-08-29 probe had read the *Website*
Terms and flagged "personal / non-commercial use only"; the entry argued that the *API*
Terms govern API use instead. The document now says so itself:

> "In the event of any conflict between the various applicable agreements/terms and
> conditions, the terms of this API Terms (based on its latest version) will take precedent
> in relation to your use of our CoinGecko API."

And names the route to broader rights, consistent with 4.1.6's "Executed Agreement":

> "However, if you have executed or signed off on any other specific agreements or terms and
> conditions ("Executed Agreement") in relation to your use of our CoinGecko API, such
> Executed Agreement will take precedence in the event of conflict with any provision of any
> other documents/terms"

---

## 2. ⚠ §7 — a launch requirement that was not on record anywhere

This is the finding that matters, and it is the same shape as D22: satisfied today, binding at
the first non-owner page load.

> **User Agreement for your Products**
> "In the event that any your Products are offered for use to others outside your entity, you
> agree that you will have in place a binding user agreement and privacy policy which must at
> the very least: (a) identify the CoinGecko API as being the property of CoinGecko; (b) ensure
> that your users/customers abide by terms and conditions in your user agreement that are no
> less protective of CoinGecko than the provisions of this API Terms; (c) exclude and disclaim
> all liability of CoinGecko for all usage of the CoinGecko API (or part thereof); (d) stipulate
> your assumption of full responsibility and liability for offering the CoinGecko API as part
> of your Products to your users/customers; (e) set out clearly in your easily accessible
> privacy policy your purpose and methods for collection, storage, use, processing, disclosure
> and transfer of personal data of your users in accordance with privacy and data protection
> laws applicable to you, in no event to be less stringent than the requirements thereunder our
> Privacy Policy; (f) stipulate that you are solely responsible for all disclosures,
> disclaimers, and warnings to your users/customers regarding the nature, accuracy, and
> limitations of the data provided through your Products, especially concerning the inherent
> volatility and risks associated with cryptocurrency markets, and that CoinGecko bears no
> responsibility or liability for any financial decisions or outcomes of your users/customers
> based on your Products or the CoinGecko API."

**What this means.** `docs/LEGAL-REVIEW.md` §3.C (disclosure documents — T-291) had treated the
terms of service and privacy policy as things the owner *should* write before launch. CoinGecko
makes six of their clauses **contractually required** the moment a second person can use the
app. Under D22 that is the same trigger as everything else — but this is the first place a
*provider* dictates the content of the app's own user agreement, rather than merely requiring
one. T-291 is annotated with this as a concrete input.

Today: nobody outside the owner's entity uses the app, so §7 does not yet bind. Verified in
the tree on 2026-09-23 (no staging deploy, no `.tfstate`, production deploy `workflow_dispatch`
only).

---

## 3. §6 — caching, storage, and "derive from"

> **Data Caching and Storage**
> "We do not encourage caching or storage of Data. However, if you must cache or store Data:-
> You should refresh the cache at least every 24 hours; Strong encryption and other security
> measures should be applied to stored Data; When a User requests that you delete all User
> Data that you have collected … you must promptly delete all such User Data …"
>
> "Except as expressly permitted hereunder this API Terms, you are not allowed to duplicate,
> reproduce, copy, store, derive from or translate any Data, API Documentation, or any
> information expressed by the Data (including but not limited to hashed or transferred
> data)."

**Against the tree.** Every CoinGecko route uses Next's `revalidate` in seconds-to-minutes,
well inside 24 hours, and nothing persists Data past the fetch cache — no CoinGecko figure is
written to Postgres (portfolios store *holdings*, and prices are fetched live). "Derive from"
reads, in context, as a bar on building a copied or transformed *dataset*, not on an
Application computing with the licensed feed — §3's grant is precisely "to develop, test, and
support any software application … as well as to integrate or incorporate the CoinGecko API
with your Application", and §4.1.6 expressly contemplates charging for such products. The same
tension exists on Binance.US ("derivative uses", LEGAL-REVIEW §1) and is recorded here for the
same reason: it is a reading, and a professional may read it differently.

**§10.4 sharpens it.** On termination:

> "you undertake to promptly and permanently delete all Data and other information procured
> from or relating to CoinGecko … You agree to certify in writing the aforesaid destruction of
> stored Data and information should CoinGecko request such certification from you."

So the cache must be *purgeable on demand*. Next's `.next/cache` is regenerable build output,
which the standing no-deletion rule already exempts — that is fortunate rather than designed,
and worth stating.

---

## 4. §11.2 — Excluded Countries, and the answer is no

> "you hereby represent and warrant to CoinGecko that you, your entity and any personnel and
> officer thereunder are not under any sanctions by any authorities (including without
> limitation the U.S. Department of the Treasury's Office of Foreign Assets Control (OFAC)) nor
> ordinarily resident nor domiciled in any of the countries listed on
> https://landing.coingecko.com/excluded-countries/ ("Excluded Countries")."

The list was opened and read the same day. **Twenty-two countries plus three regions of
Ukraine** — Afghanistan, Belarus, Burma/Myanmar, Central African Republic, Cuba, Congo,
Ethiopia, Iran, Iraq, Lebanon, Libya, Mali, Nicaragua, North Korea, Russia, Somalia, South
Sudan, Sudan, Syria, Venezuela, Yemen, Zimbabwe; Crimea, Donetsk, Luhansk. **The United States
is not on it.** The owner is US-resident. Satisfied.

The page reserves the right to amend the list without notice and says it is the user's
responsibility to check it; the entry records the date read.

This is the clause Bitget's §1 made alarming (T-407): there the *United States* is on the
prohibited list. Here it is a sanctions list of the ordinary kind. Same clause shape, opposite
answer, which is why each source is read rather than pattern-matched.

---

## 5. §8, §10, §12, §13 — the rest, briefly

**§8 Security Measures** — an obligation, and a notification duty:

> "In the event that any of your Systems are howsoever compromised (whether via hacking,
> unauthorised use or access or other security breaches), you must inform us immediately by
> submitting a ticket at https://support.coingecko.com/hc/en-us/requests/new and we shall
> determine in our sole discretion whether to terminate your access"

**§10.3 Termination, and §3.2** — the contract itself says not to rely on it:

> "We may at any time vary, amend, change, suspend or discontinue provision of any of our
> Property, including but not limited to the CoinGecko API, suspend or terminate your use of
> the CoinGecko API and/or the CoinGecko Brand without notice or reasons to you."
>
> (§3.2) "you agree that you will not rely on any function, behaviour, capability or other
> aspects of our CoinGecko API"

CoinGecko is load-bearing for the crypto module — `markets`, `alerts`, `portfolio-history`,
`coin-list`, `global`, `coin-profile`'s keyless rung. D21 already says no provider may be
load-bearing and `npx tsx scripts/gen-coverage-matrix.ts` measures it. This reading does not
change that requirement; it makes the counterparty's own position on it explicit.

**§12 Liability** — "AS IS", and a cap that is effectively nil on a free plan:

> "FOR ANY AMOUNT FOR ALL CLAIMS CUMULATIVE IN EXCESS OF THE FEES ACTUALLY PAID BY YOU TO
> COINGECKO IN THE SIX (6) MONTHS IMMEDIATELY PRECEDING THE EARLIEST EVENT GIVING RISE TO YOUR
> CLAIM OR, IF NO FEES HAVE BEEN PAID BY YOU TO COINGECKO, SINGAPORE DOLLARS ONE HUNDRED
> (S$100) ONLY"

plus an indemnity (§12.5) covering "any third party claim arising from or in any way related
to your or your users'/customers' use of any of your Products". §12.1 also states the data is
"strictly for general informational purposes only" and "not … investment advice" — which
aligns with, and in no way loosens, RP-3.

**§13 Governing law** — "the laws of the Republic of Singapore" and "the exclusive
jurisdiction of the Courts of Singapore".

**§14.6 Confidentiality** — not engaged; nothing non-public has been received.

---

## 6. What changed in the registry

Six conditions appended to `coingecko.com` (each cites its clause), the finding's *"remainder
… was not"* sentence replaced with a pointer to this document, `reviewedAt` → 2026-09-24. The
verdict stays `conditional` and the original six Section-4 conditions stand unchanged.

**And one thing deliberately not changed:** `confidence: 'high'` stays. The document is
unambiguous about what it requires; the only interpretive question (§6.3 "derive from") is
recorded as such rather than resolved.
