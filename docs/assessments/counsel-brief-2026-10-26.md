# Brief for counsel — Finance Now (T-289)

**Status:** draft, 2026-10-26, for the owner to review before it goes to a lawyer. It is not
legal advice. Everything in it was gathered from this repository, and each question says where
the project records it.

**Why this exists.** Many decisions in this project wait on "the lawyer review before launch"
(owner decision D4, 2026-09-14), but the questions for that review were spread across a dozen
documents and nearly 400 ledger items. Only one area had been written up for a lawyer (the
risk-ratings memo, T-419). This brief puts every open question in one place, in the order a
lawyer would want them, so the owner can engage counsel with one document.

## How to read it

- Questions are numbered by area: A1, A2 … for area A, and so on.
- Each one is tagged:
  - **Live**: a feature that is built and would ship as it is, so counsel's answer may change
    something that already works.
  - **Unblocks**: work is parked until the answer comes.
  - **Launch**: it only matters once anyone other than the owner can use the app.
- Where a source document holds the full reasoning, the question points to it rather than
  repeating it. Paths are from the repository root; "Dnnn" is a dated owner decision in
  `docs/decisions/`; "T-nnn" is a ledger item in `docs/audits/task-queue-2026-09-07.json`.
- Two inputs are **not in this repository** and go with the brief as attachments (section 5):
  the data-breach response plan and the electronic-consent comments in the Disclosure Set.

---

## 1. The app and the people behind it

| | |
|---|---|
| **What it is** | A web app of market data and analysis: crypto, US stocks, ETFs and mutual funds, commodities, currencies and Treasury rates. It shows prices, charts, news, fund facts and calculators, and has an AI assistant that answers from the same data. It does not trade, hold money, take exchange keys or route orders (RP-5). |
| **Who runs it** | One person, the owner, with no lawyer or CPA engaged so far (D30, `docs/decisions/2026-09-28-owner-decisions.md`). Vendor letters are signed in the owner's own name until the company exists. |
| **Entity** | Planned: one new North Carolina LLC, around January 2027, owning Finance Now and a sister product (News Charts) as assumed names; single-member and disregarded for tax (D28). The draft Terms choose North Carolina law and the courts of Guilford County. |
| **Where** | The owner lives in the United States. Development is US-only (D3, D13). The draft Terms limit the service to people who are 18 or older and in the United States. |
| **Commercial intent** | *"The goal will be commercial; currently it is personal but we are building with the goal of it being public"* (D22, 2026-09-23). Nothing is charged, and no paid plan is defined. No paid or affiliate links at launch (D49). |
| **What "launch" means** | The first page load by anyone other than the owner (D22). That includes a private beta, a demo link or a shared test site. Nothing is deployed today: no staging or production site has ever run. |
| **Before launch** | Everything done before launch is treated as personal use under every data source's terms (D96, 2026-10-09). That rule cannot cure a ban on automated access, and sources with one were removed. |
| **Data it holds** | Accounts: email, an optional name, and a bcrypt password hash. A user's portfolios, trades, watchlists, watched wallet addresses, and Portfolio Builder answers, including risk tolerance and years to a goal. The owner's own provider API keys, encrypted at rest (D122). No postal addresses or phone numbers. |
| **No email yet** | No email provider is chosen until launch (D21, D123). Password resets are links the owner hands over. |
| **AI providers** | Anthropic for the assistant and research; Google Gemini for questions about videos. |
| **What is switched off** | Every risk rating, score and grade, until counsel answers area A (D64, D92). The one exception the owner chose is the Pump Report's alert (A8). |
| **Draft documents** | Terms of Use, Privacy Policy and Not Investment Advice are drafted and shown on the app's About pages under a "Draft — not yet in force" notice (`frontend/src/lib/legal/disclosures.ts`, T-291). |

**A caution about our own research.** The memos this brief draws on were written from web-search
summaries of the law, without opening the primary texts. They say so, and two points are marked
unverified (A1, A5). Please treat their statements of law as questions, not findings.

---

## 2. The central question

The owner has answered the business question: the app is meant to be public and commercial
(D22). So the question for counsel is what that requires, and it turns mostly on one line:
**information versus advice**. The design so far assumes that publishing the same analysis to
every reader, with the method shown, is the publisher's side of the line, and that anything
worked out from a user's own holdings is the personal side. The draft disclosures promise the
first and disclaim the second.

Area A tests that assumption. Most of the other areas follow from it. Insurance depends on the
app being described as an information tool, and so do the not-advice texts and the AI
assistant's limits.

---

## 3. Questions by area

The first six areas are T-289's priority areas, as recorded in `docs/BUSINESS-CHECKLIST.md`
(the "Federal regulations" item). G and H gather what the project added since.

### A. Investment advice versus information

Background: `docs/assessments/risk-ratings-by-asset-type-2026-10-07.md`. §3 covers the rules; §6
is the nine conditions any rating that returns would meet: method shown, limits stated, universe
named, the same for every reader, no suitability words, provenance, not timed, no paid interest,
and the not-advice text. The owner's answers are in §7 (D92): an impersonal rating on the asset's
own page, for crypto coins and stocks only; facts everywhere else; never a rating of a user's
holdings or portfolio. Nothing is shown until counsel confirms.

These are the memo's §8 questions, in its numbering, with what each would release.

| # | Question | Tag | An answer would release |
|---|---|---|---|
| A1 | Does the publisher's exclusion, federal and in the states where users will be, cover an impersonal risk rating on each asset's page that updates continuously? Does continuous updating count as "regular circulation"? What did the Second Circuit decide in *Lingley v. Seeking Alpha* (No. 24-2437)? Our note of that outcome is unverified. | Unblocks | The coin and stock ratings (T-420), which are built and hidden behind `ASSET_PAGE_RATINGS_SHOWN`. Turning them on needs A1, A2 and A6, plus A10's policy (D95) |
| A2 | Is that same rating, shown beside a user's holdings, still impersonal? Does a figure worked out from the user's own mix become personal advice? | Unblocks | Confirms D92's "never beside holdings", or reopens the Portfolios ratings, which are switched off (D64) |
| A3 | Are standard statistics and concentration figures on a user's own holdings, with no rating and no label, on the information side? | Live | The Compare page's volatility, drawdown, beta and correlation, and the Portfolios concentration figures, shown today |
| A4 | Does "the same inputs give anyone the same result", which the draft disclosures rely on, make a tool impersonal? Does that hold for a graded judgement, as opposed to arithmetic? | Live | The Portfolio Builder, which builds an allocation from a questionnaire (risk tolerance, years to a goal). The owner cleared one part of it without a review (D47), relying on this argument. Please say whether the Builder as a whole is on the information side |
| A5 | Futures and FX: does the app fit the Commodity Exchange Act's publisher exclusion, given "solely incidental", or must it rely on CFTC Rule 4.14(a)(9)? Does that rule cover retail-forex advice? (Unverified in our notes.) | Launch | The macro pages, which show facts only (D92) |
| A6 | Crypto: after the SEC's 2026-03-17 interpretation, is an impersonal rating of a "digital commodity" outside every federal and relevant state registration system? How must the app classify tokens, and handle tokenized securities such as USDY? | Unblocks | Coin ratings (T-420: "before any coin is rated, the coin catalog marks which tokens are securities"). See also B1 |
| A7 | Options: is an arithmetic calculator on a trade the user enters (maximum loss, breakevens, Greeks) advice? Is a graded score? | Live; Unblocks | The calculator is shown at `/equities/options-calculator` by the owner's choice before this answer (D93). The graded scorer stays off. Parked: T-060 to T-063 (saved positions and the scorer's extensions) |
| A8 | The Pump Report (live, D70) gives a coin a 0–10 pump signal and a "collapse risk" grade, refreshed every 2 minutes, and an AI search of fraud reports on wallet addresses. Is a grade refreshed that often "timed to market activity"? Separately from advice, is there exposure (such as defamation) in labelling a wallet or a coin's promoters "flagged" or "critical"? | Live | The owner kept it on purpose: its aim is to warn users that an asset is being targeted (D70). Its notice reads "Not a finding of fraud, and not advice" (`frontend/src/lib/legal/featureNotices.ts`) |
| A9 | What limits should apply when a user asks the AI assistant whether their own portfolio is too risky? | Live; Unblocks | The assistant's instructions; and whether any rating may reach the AI tools or the public API (D77, T-420) |
| A10 | Is a written policy on the owner's own holdings and trading in rated assets needed to keep the "bona fide" condition? | Unblocks | A precondition for turning ratings on (D95) |
| A11 | If ratings ever became personal: state registration or the SEC's internet-adviser route, and what each costs and requires. | — | Background only: the owner chose not to (D92, option C) |
| A12 | Non-US access: block it, or comply where the app can be reached (for example the EU's MiCA rules on advice on crypto-assets, the UK's crypto financial-promotion and risk-warning rules)? | Launch; Unblocks | T-290 (country access, parked). The draft Terms already say US-only; please say whether that is enough or a block is needed |

Three tools wait on D4's review because they come close to planning advice. None is built.

| # | Question | Tag | An answer would release |
|---|---|---|---|
| A13 | A federal tax estimator for selling an asset, from the user's own cost basis and holding period: information or advice? (`docs/LEGAL-REVIEW.md` §3.D) | Unblocks | T-058 (parked until the Transfer Fees page returns) |
| A14 | Contribution modelling (how much to put in, and when) and asset location (which holdings to put in taxable or tax-sheltered accounts) in the Portfolio Builder: information, advice or financial planning? | Unblocks | T-064, T-067, T-068 (blocked) |
| A15 | Rebalance reminders that send a user the trades that would bring a saved plan back to target when it drifts: does that make the Builder "timed" advice? | Unblocks | T-116 (blocked) |

### B. Broker-dealer and securities

| # | Question | Tag | An answer would release |
|---|---|---|---|
| B1 | Tokenized securities: the app shows tokens that represent shares, funds or Treasury notes (USDY is filed that way). Does showing a security the viewer cannot lawfully buy, with an eligibility label, create any obligation? Is a token's premium or discount to its underlying, labelled as worked out, still information? | Launch | `docs/assessments/tokenized-securities-2026-09-21.md` §11 (five questions with our working answers) and `docs/LEGAL-REVIEW.md` §3.G |
| B2 | We do not plan trading, order routing or "buy" buttons. Please confirm that linking out to an exchange's or issuer's own page, as the app does, raises no broker-dealer or introducing-broker question. | Launch | Confirms the posture. RP-5 already bars holding exchange keys |

### C. Consumer protection, the FTC and the disclosures

| # | Question | Tag | An answer would release |
|---|---|---|---|
| C1 | Please review the Disclosure Set, Draft v1: Terms of Use, Privacy Policy and Not Investment Advice. Points we would like a view on: §1 "we are not a broker, dealer or investment adviser"; §2 18+ and US-only; §3 not advice and "published the same way for everyone"; §13 the liability cap ($100 or 12 months' fees); §14 indemnity; §16 changes by notice; §17 North Carolina law, Guilford County courts, no arbitration clause; and the short not-advice lines shown beside features. | Launch; Unblocks | T-291. The documents come into force only once approved and every blank is filled (`disclosuresInForce()`) |
| C2 | Electronic consent: the app requires consent to notices by email to open an account (D127), because it holds no other contact detail, and withdrawing consent closes the account. Does that satisfy North Carolina G.S. 75-65(e)(2) and E-SIGN (15 U.S.C. 7001(c)), and is closing the account on withdrawal acceptable? The questions are on two comments in the Disclosure Set (Terms §6, Privacy §2). | Unblocks | T-436, then the sign-up page (T-132) and the sign-in wall (T-131) |
| C3 | Accuracy: the FTC Act's §5 rule on substantiating claims applies to what the app says about its figures and its AI answers. Is the way each figure states its source and date, and the methods page (`/about/data-methods`), enough? | Launch | Background in the memo, §3.6 |
| C4 | Affiliate and endorsement disclosure, if affiliate links are ever added. None are planned at launch (D49). | After launch | T-120, T-123, T-124, T-125 (parked) |

### D. Data licensing and the providers' terms

Background: `docs/LEGAL-REVIEW.md`. Most provider terms grant personal or non-commercial use
only. Before launch that is fine (D96). At launch each needs a licence, a written permission, or
the source dropped, and the enquiries are drafted in `docs/licensing/`, unsent (T-425, parked
until launch). The questions here are the ones for a lawyer rather than for the vendor.

| # | Question | Tag | An answer would release |
|---|---|---|---|
| D1 | CoinDesk publishes an RSS feed and its robots.txt allows it, but its terms never mention feeds and grant viewing for personal, non-commercial purposes. Do the terms govern the feed? May the app show a headline, link and summary, or only a headline and link? | Launch | T-407. The answer is one setting in the app (`whatMayBeDisplayed`) |
| D2 | KuCoin's terms (Article 17(5)) have users undertake that they are not US residents. The app calls KuCoin's public fee feed with no account. Does the undertaking reach a call that opens no account (D130 relies on reading that it does not)? Article 91 also needs written permission for other uses (D42). | Launch | Keeping the KuCoin feed at launch; T-428 |
| D3 | Twelve Data permits "internal business purposes". Does an individual's unpaid project fall inside that, or is the app outside its only permitted category even today? | Live | `docs/LEGAL-REVIEW.md` §1; enquiry §3 |
| D4 | Tiingo §1.6(a): is a risk rating the app computes partly from Tiingo prices, and stores, itself "Tiingo Data"? | Unblocks | T-420's stored stock ratings. If it is, the cure is another price source or no stored readings |
| D5 | CoinGecko's API Terms §7 require the app's own user terms to include six things, (a) to (f), including a privacy policy "no less stringent than" CoinGecko's. Do the draft Terms and Privacy Policy meet them? | Launch | `docs/audits/terms-review-coingecko-2026-09-24.md` |
| D6 | When the vendor agreements arrive (FMP's Order Form, Finnhub's approval, Twelve Data's add-on, Marketaux and the fund issuers' permissions), please review them before signing. | Launch | T-425, T-154 |

### E. Privacy and data-breach notice

| # | Question | Tag | An answer would release |
|---|---|---|---|
| E1 | The data-breach response plan (attached, "draft for counsel", 2026-10-17) carries ten questions of its own, written for you. Among them: the owner chose to record no user's state of residence and to follow the strictest applicable notice rule in every breach (D125). Please confirm or overturn that. | Launch | T-426. If overturned, T-438 reopens: a residence field in the account |
| E2 | The plan quotes California Civil Code §1798.82 from a secondary source, because the official site refused automated reads. Please confirm the text. North Carolina's G.S. 75-61, 75-65 and 14-113.20 were checked against ncleg.gov. | Launch | T-426 |
| E3 | The Privacy Policy says there are no analytics or trackers and that data is stored in the US. With US-only access, do GDPR, UK GDPR or CCPA apply, and does the policy meet CalOPPA through its footer link? | Launch | T-289 area 5, T-290 |
| E4 | Three blanks in the Privacy Policy need a decision that may be legal: how long backups and logs are kept, and naming the host. | Launch | The blanks in `disclosures.ts` |

### F. Crypto-specific promotion rules

| # | Question | Tag | An answer would release |
|---|---|---|---|
| F1 | If the app is reachable from the UK or EU, do the UK's crypto financial-promotion rules or the EU's rules apply to its pages or its AI answers? (Linked to A12.) | Launch | T-290 |
| F2 | Several places restrict crypto affiliate marketing. Before the first affiliate programme is joined, what applies? Not needed for launch. | After launch | T-120, T-123, T-124, T-125 |

### G. The company and insurance

| # | Question | Tag | An answer would release |
|---|---|---|---|
| G1 | Insurance: planned tech E&O, media liability and cyber cover before the first outside visitor (T-427). Standard E&O excludes investment-advisory work, so the cover depends on area A. What should the app be described as to an insurer? | Launch | T-427 |
| G2 | Optional: a check of the LLC plan (one North Carolina LLC with two assumed names, the owner as registered agent; D28, T-287). | Launch | T-287 |

### H. Later, only if the business changes

These are recorded so they are not lost, and need no answer now: business-customer contracts
(data processing, service levels; T-212, T-216, parked under D5 and D71), and a broker-dealer
question if trading were ever proposed (B2).

---

## 4. What each answer unblocks

| Answer | Unblocks |
|---|---|
| A1, A2, A6, A10 (and D4) | Turning on the coin and stock risk ratings (T-420); the ratings in the AI tools and API (A9) |
| A7 | The options items T-060 to T-063, and confirms the calculator already shown |
| A13–A15 | The tax estimator (T-058), contribution modelling and asset location (T-064, T-067, T-068), rebalance reminders (T-116) |
| C1, C2 | The disclosure documents coming into force (T-291), the consent wording (T-436), then the sign-up page and sign-in wall (T-132, T-131) |
| A12, E3, F1 | Country access (T-290) |
| D1, D2, D5, D6 | The data-source launch steps (T-407, T-428, T-425, T-154) |
| E1, E2 | The breach plan (T-426); possibly a residence field (T-438) |
| G1 | Insurance (T-427) |
| C4, F2 | The affiliate items, after launch (T-120, T-123, T-124, T-125) |

If counsel can only take part of this, **A1, A2, A6, A7, A8, C1 and C2** do the most. They
settle the line the whole app is built on, the two features already shown that come closest to
it, and the documents and consent every user will see.

---

## 5. Documents to send with this brief

From this repository:

1. `docs/assessments/risk-ratings-by-asset-type-2026-10-07.md`: the risk-ratings memo, the
   background for area A.
2. `docs/assessments/tokenized-securities-2026-09-21.md`, §11: area B.
3. `docs/LEGAL-REVIEW.md`: the standing note on data licensing, for area D.
4. The Disclosure Set's text as the app shows it: the About pages, or
   `frontend/src/lib/legal/disclosures.ts`.
5. `docs/architecture/risk-ratings-methodology.md`: how the hidden ratings are worked out.

Kept outside this repository, attached by the owner:

6. **The data-breach response plan** ("draft for counsel", 2026-10-17, full update), with its
   ten questions. It is in the Finance Now Ledger's file library.
7. **The Disclosure Set, Draft v1**, the owner's document with the two consent comments (C2). It
   is in the same library, shared with News Charts (D60).

---

## Sources

- T-289's six areas: `docs/BUSINESS-CHECKLIST.md`, the "Federal regulations" item.
- Area A: the risk-ratings memo, §3, §6, §7 and §8; D4, D47, D64, D70, D77, D92, D93, D95;
  `docs/LEGAL-REVIEW.md` §3.D and §3.H.
- Area B: `docs/assessments/tokenized-securities-2026-09-21.md` §7 and §11; `docs/LEGAL-REVIEW.md`
  §3.G.
- Area C: `frontend/src/lib/legal/disclosures.ts`, `featureNotices.ts`, `signupConsent.ts`; D49,
  D124, D127, D128.
- Area D: `docs/LEGAL-REVIEW.md` §1, §3.H, §7; `docs/assessments/source-terms-prelaunch-2026-10-09.md`;
  `docs/licensing/`; D25, D42, D96, D129, D130, D133.
- Area E: the breach plan (attached); D122, D123, D125.
- Facts: D21, D22, D28, D30, D96; CLAUDE.md.
