# Risk ratings by asset type: what the law allows, and what to show instead (T-419)

_Memo for the owner's answers and then for the legal review before launch (D4). Opened
2026-10-07 by the session steward under D90's work order. **No code changed.** Nothing in
the app turns on or off because of this memo; D64's switch stays where it is._

> ⚠ **None of this is legal advice, and none of it was written by a lawyer.** It is a research
> record written so the owner can decide what to ask for and the lawyer can start from the
> facts. Same footing as `docs/LEGAL-REVIEW.md`.
>
> ⚠ **How the research was done, and its limit.** This session runs in a cloud sandbox whose
> network blocks the government and legal sites themselves (sec.gov, ecfr.gov, govinfo.gov,
> uscode.house.gov, law.cornell.edu, finra.org, courtlistener.com, the law firms). The legal
> points below come from **web-search summaries** of those sources, not from opening them.
> The statutes and cases cited are long-standing and the summaries agree with each other, but
> **a search summary is not a reading**: the lawyer should work from the primary texts listed
> in §9. Two points could not be pinned down at all and are marked **[UNVERIFIED]**.

---

## 1. The short answer

1. **In US law the line is personal versus impersonal, not asset type.** Publishing the same
   information to everyone is protected. Advice tailored to one person's situation is the
   regulated activity. A risk rating that is the same for every reader, published on a
   regular basis, honest about how it is made, and free of any paid interest sits on the
   protected side (the "publisher's exclusion", *Lowe v. SEC*, 1985). In 2024 a federal court
   applied that exclusion to a financial website whose **ratings**, alerts and screening
   tools were challenged as unregistered advice (*Lingley v. Seeking Alpha*).
2. **A rating of _your_ holdings is a different thing.** Showing the same per-asset rating
   beside a user's holdings is probably still impersonal (the *Seeking Alpha* court called
   portfolio-based alerts a filter over content everyone can see). A figure **worked out from
   the user's own mix**, such as the Weighted Risk label "Aggressive" or the warning
   "suitable only for high-risk tolerance", is the closest thing in this app to personal
   advice, and it uses suitability language, which is the vocabulary of brokers and advisers.
3. **The asset type decides which regulator is asking, not where the line is.** Stocks, funds,
   options, and crypto tokens that are securities fall under the SEC and the states. Futures,
   options on futures and retail forex fall under the CFTC, which has its own version of the
   same line (an exemption for advice "not tailored" to a client's positions). Crypto that is
   **not** a security (the SEC's March 2026 interpretation puts digital commodities,
   collectibles and tools outside the securities laws) is outside both registration systems
   for an impersonal rating, though fraud and false-advertising rules still apply everywhere.
4. **What still applies to every form, everywhere: accuracy.** A rating that claims more
   precision than it has, or that is wrong when it matters (a stablecoin graded safe before it
   breaks its peg), is a false-advertising and fraud question even where no registration is.
5. **The app's own draft disclosures already promise the impersonal form.** The Draft v1
   Not Investment Advice text says everything in the Services is "published the same way for
   everyone" and that tools apply "fixed, published rules" so "anyone entering the same
   figures gets the same result" (`lib/legal/disclosures.ts`). A personal rating would make
   that statement untrue: it would need new disclosures as well as a legal opinion.

**Recommendation, in one line:** keep every rating off until the lawyer has answered (the
Pump Report aside, D70); let the rebuild (T-420) target **one form only**, an impersonal rating
on the asset's own page with its method shown, and only for **crypto coins and stocks**; show
facts and standard statistics everywhere else; and never rate a user's portfolio as a whole.
§7 asks the owner for an answer per asset type.

---

## 2. What "a risk rating" has meant in this app

Every surface that has ever put a risk judgment on screen, and where each stands. "Form" uses
§4's terms: **impersonal** (same for every reader), **filtered** (an impersonal rating shown
beside the user's holdings), **personal** (worked out from the user's own inputs), **ranking**
(a universe sorted by risk).

| Surface | What it said | Form | Status |
|---|---|---|---|
| Coin page Safety Score gauge, band pill, search badge | 0–100, higher is safer, with a band word | impersonal | Removed 2026-08-29 (RP-6) |
| Coin page Composite Risk panel | The same score with its pillars and method | impersonal | Removed 2026-08-29 (RP-6, amended same day) |
| `/risk-scores` leaderboard, sortable Coins column, risk heatmap | Coins ranked by score | ranking | Removed 2026-08-18 (item 4, RP-3) |
| Coin Discovery verdicts, then its score | "Strong Add … Too Speculative", then a score | ranking | Removed 2026-08-18 and 2026-08-20 |
| Staking providers | Composite Safety Score; then six 1–10 dimensions | impersonal / ranking | Removed 2026-09-14 (D14) and 2026-09-25 (D26) |
| Portfolios, per holding | A 1–10 tier for each holding | filtered | **Off since 2026-10-04 (D64)**, code kept |
| Portfolios, whole portfolio | Weighted Risk with a label (Conservative to Speculative) and two warnings: "Portfolio risk score is very high — suitable only for high-risk tolerance", "Portfolio leans aggressive" | personal | **Off (D64)**, code kept |
| Fund pages | "Risk Profile": Conservative, Moderate, Aggressive or Speculative, read from the fund's structure (the code calls it "a coarse suitability band") | impersonal | **Off (D64)**, code kept |
| Options Trade Risk Scorer, its API, agent and MCP tools | 0–100 for a trade the user types in, across liquidity, IV environment, assignment, time decay and defined risk | personal | **Off (D64)**, code kept |
| Pump Report tab on 20 coins' pages | A 0–10 pump signal and a "collapse risk" grade (low to critical) from 24-hour price and volume, refreshed every 2 minutes | impersonal | **Live** (D70: an alert about pump activity, not a rating of how risky a coin is to own) |
| Pump Report page | A wallet address labelled clean, suspicious, flagged or critical from an AI search of fraud reports | impersonal | **Live** (D70) |
| Compare; Portfolios' Concentration card | Sharpe, Sortino, volatility, drawdown, beta; stablecoin share, category count, largest position | statistics | **Live**: arithmetic, kept by D14 |

So the question T-419 answers is narrower than it looks: what may come back, in which form,
for which asset type. Every rating the engine can produce is already off except the Pump
Report's, which the owner has ruled on.

---

## 3. The rules, in plain words

### 3.1 Who counts as an investment adviser (SEC and the states)

The Investment Advisers Act covers anyone who, **for compensation and as a business**, advises
others about the value of securities or whether to buy or sell them, **or issues analyses or
reports concerning securities** (Advisers Act §202(a)(11), 15 U.S.C. §80b-2(a)(11)). The SEC
and the state regulators read that as three tests: advice or analysis about securities, done
as a business, for compensation, where compensation means **any economic benefit**,
subscriptions and advertising included (SEC Release IA-1092, 1987).

A risk rating of a stock, fund or option is very likely an "analysis concerning securities".
The owner's answer to the keystone question was that the goal is commercial (D22, 2026-09-23),
so the business and compensation tests should be assumed met at launch. **Whether the app is
an adviser therefore turns on the exclusions**, chiefly the next one.

### 3.2 The publisher's exclusion

The Act excludes "the publisher of any bona fide newspaper, news magazine or business or
financial publication of general and regular circulation" (§202(a)(11)(D)). The Supreme Court
read it broadly in *Lowe v. SEC*, 472 U.S. 181 (1985): a newsletter of stock picks was outside
the Act because its advice was **impersonal**, not "attuned to any specific portfolio or to any
client's particular needs". The Court added that "the mere fact that a publication contains
advice and comment about specific securities does not give it the personalized character that
identifies a professional investment adviser." Three conditions come out of *Lowe*:

| Condition | What it means | What would break it in this app |
|---|---|---|
| **Impersonal** | The same content for every reader, not fitted to anyone's holdings or needs | A figure worked out from the user's portfolio; an AI agent answering "is my portfolio too risky?" |
| **Bona fide** | Genuine, disinterested commentary, not promotion | Paid placement (none: D49); the owner trading around a rating without saying so (*Zweig v. Hearst*, 9th Cir. 1975: a columnist could be liable for touting a stock he owned without saying so) |
| **General and regular circulation** | Offered to the public on a regular basis, **not timed to specific market activity** | Alerts pushed because a price just moved; a rating published to catch a move |

How the courts have applied it online:

- ***Lingley v. Seeking Alpha Inc.*** (S.D.N.Y. 2024-08-15, Judge Marrero). Paying subscribers
  said Seeking Alpha was an unregistered adviser. The court dismissed the claim: its
  articles, **ratings**, recommendations, alerts and screening tools were generally available
  and regularly updated publications, not individualized advice. Alerts and recommendations
  based on a subscriber's portfolio only filtered content that every subscriber could see.
  The court distinguished the auto-trading cases, where the publisher placed trades in
  subscribers' accounts. An appeal was argued in the Second Circuit (No. 24-2437) on 2025-04-07; **its
  outcome could not be confirmed from here [UNVERIFIED]**, and the lawyer should check it
  first, because it is the closest case to this app.
- ***SEC v. Park*** ("Tokyo Joe", N.D. Ill. 2000). An internet stock-picking service with
  personal emails, a members' chat room and the publisher trading ahead of his own picks. The
  court refused to dismiss the SEC's case: the complaint plausibly alleged he was an adviser.
- ***SEC v. Terry's Tips*** (D. Vt. 2006) and ***In re Weiss Research*** (SEC, 2006). Newsletters
  that also traded subscribers' accounts automatically were treated as unregistered advisers.

States have their own adviser laws, mostly modelled on the Uniform Securities Act, with a
similar exclusion for publications, electronic ones included, that do not give advice based
on each client's specific investment situation. Vermont sanctioned Terry's Tips' owner under
its own act, for not registering as an adviser, alongside the SEC case.

### 3.3 If the app ever crossed into personal advice

That is a business decision, not something a disclaimer fixes. An adviser too small for SEC
registration registers with the states. The other route, the SEC's **internet adviser
exemption** (Rule 203A-2(e)), was narrowed in 2024: since 2025-03-31 it covers only advice
given **exclusively through an operational interactive website**, with no human-directed
advice. Either way, registration brings fiduciary duties, a Form ADV brochure, books and
records, the marketing rule and examinations. The SEC staff's robo-adviser guidance (IM
Guidance Update 2017-02) shows what is then expected of an algorithm: say what it does, its
limits and risks, and when a person overrides it.

### 3.4 Futures, options on futures and retail forex (CFTC)

The Commodity Exchange Act has its own adviser category, the **commodity trading advisor
(CTA)**: anyone who, for compensation or profit, advises others on the value or advisability
of trading futures, options on futures, swaps or retail forex, or issues analyses or reports
about that (7 U.S.C. §1a(12)). Two differences from the SEC side matter here:

- Its publisher exclusion covers "the publisher or producer of any print or electronic data of
  general and regular dissemination", but **only where the advice is "solely incidental" to
  the business** (§1a(12)(B)(iv) and (C)). For an analytics product, advice may not be
  incidental, so the exclusion may not reach it.
- The CFTC's answer is a registration **exemption**, Rule 4.14(a)(9) (2000): a CTA need not
  register if it does not direct client accounts and does not give advice "based on, or
  tailored to, the commodity interest or cash market positions or other circumstances or
  characteristics of particular clients". It answered court rulings that requiring
  publishers of impersonal commodity advice to register breached the First Amendment
  (*Taucher v. Born*, D.D.C. 1999; the *Commodity Trend Service v. CFTC* litigation in the
  Seventh Circuit). An exempt CTA is still bound by the CFTC's anti-fraud rules and by
  Rule 4.41 on advertising and hypothetical results.

**So on this side the personal line is drawn in words that fit this app exactly:** a rating
of a user's own futures or FX positions is advice "tailored to the … positions … of particular
clients", which is what the exemption leaves out. Search results say Rule 4.14(a)(9) also
covers retail-forex advice; the CFTC's retail forex rules (17 C.F.R. Part 5) were not read
here, so confirm it **[UNVERIFIED]**.

### 3.5 Crypto: which tokens are securities

- **The SEC's interpretation of 2026-03-17**, which the CFTC joined, sorts crypto assets into
  five groups: **digital commodities, digital collectibles and digital tools are not
  securities**; **stablecoins may or may not be**; **digital securities are**. It is
  interpretive guidance, not a new rule, and a token's group still depends on its facts.
- **The GENIUS Act** (signed 2025-07-18) makes a payment stablecoin from a permitted issuer
  neither a security nor a commodity. It takes effect **no later than 2027-01-18**.
- **The CLARITY Act** (crypto market structure) failed to advance in the Senate on
  **2026-09-15** (cloture 49–50). A market-structure law before 2027 now looks unlikely, so the
  2026 interpretation is the working map for now.

What that means for ratings: an impersonal rating of a coin that is a digital commodity is
not advice about a security, so the Advisers Act does not reach it, and it is not CTA advice
either, because the CTA definition covers futures, swaps and leveraged retail transactions,
not plain spot purchases. **Two exceptions bring the securities analysis straight back:**
tokens that are digital securities, and tokenized versions of real securities. The app
already carries one of those misfiled as a stablecoin: Ondo's USDY, a tokenized Treasury note
(tokenized-securities assessment, F2). Before any coin rating returns, the coin catalog has
to know which tokens are securities.

### 3.6 Rules that apply to every form: accuracy and fairness

- **The FTC Act's ban on deceptive practices (§5)** covers any claim a consumer relies on,
  including what a score is said to measure. In September 2024 the FTC began a series of
  cases under it over claims made for AI products ("Operation AI Comply"): a claim about what
  a tool can do must be backed by evidence.
- **Securities fraud rules (Rule 10b-5)** reach misleading statements made in connection with
  securities trading by anyone, publishers included (*Zweig v. Hearst*).
- **The CFTC's anti-fraud rule (Rule 180.1)** reaches deception in connection with any
  commodity sale, which includes crypto that is a digital commodity.

This is the exposure that applies whichever regulator is in charge, and it is the practical
reason RP-6 asked for the method to be stated: a rating whose working the reader can see is
much harder to call misleading than a bare number.

### 3.7 Credit ratings

A "credit rating agency" is anyone in the business of issuing credit ratings on the internet
or by other readily accessible means, free or for a reasonable fee (Securities Exchange Act
§3(a)(61), added 2006). Registering as a nationally recognized rating agency (NRSRO) is
voluntary, and most of the rules attach only to those that register; still, issuing its own
credit grades would make the app a rating agency by definition, a role it has no reason to
take on. The rates profile's "Credit" pillar (treasury, municipal, investment grade, high
yield) is a category, not a rating. Keep it that way: quote the credit quality a fund states
about itself rather than grading issuers.

### 3.8 Outside the United States

The Draft v1 About page says the sites are for people in the United States. Whether to block
other countries is still open (BUSINESS-CHECKLIST §2, "Which countries can access which
product"). If the site stays reachable, the same personal-versus-general line appears under
other names: the EU's MiCA makes "advice on crypto-assets" (personalised recommendations,
Art. 3(1)(24)) a licensed service, and the UK FCA treats advice on a *particular* investment
that carries an opinion as regulated while generic advice is not (PERG 8.28). The UK also
requires a set risk warning on promotions of crypto assets (COBS 4.12A). A rating is not a
promotion in itself, but this is a question for whoever advises on non-US access.

---

## 4. The forms a rating can take, from safest to most exposed

| # | Form | Example in this app | Where the law sees it |
|---|---|---|---|
| 1 | **Facts and standard statistics** | Volatility, drawdown, beta, Sharpe, a fund's own stated strategy | Information. D14 already keeps these |
| 2 | **Impersonal rating on the asset's own page** | The removed Composite Risk panel, with its pillars | The *Lowe* form. Probably excluded if bona fide and regular; needs the disclosures in §6 |
| 3 | **Filtered**: the same rating beside the user's holdings | Portfolios' per-holding 1–10 tier | Probably still impersonal (*Seeking Alpha*); confirm |
| 4 | **Ranking a universe** | The `/risk-scores` leaderboard | Not personal, but a ranked list reads as "buy the top ones" (RP-3). Avoid |
| 5 | **Personal**: worked out from the user's own inputs | Weighted Risk and its label; the options scorer; an AI agent asked about the user's portfolio | Closest to advice; outside *Lowe*'s exclusion and, for futures and FX, outside CFTC Rule 4.14(a)(9). Avoid unless registered |
| 6 | **Timed**: pushed when the market moves | An alert "collapse risk: critical" sent as a price falls | Fails *Lowe*'s test that a publication not be "timed to specific market activity". Avoid for any rating |

Two notes on rows 3 and 5. First, **"same inputs, same result" is the argument the draft
disclosures rely on** for calculators and the Portfolio Builder. It is a reasonable argument
for arithmetic, and the lawyer should say whether it holds for a *graded judgment* worked out
from someone's own holdings. The Portfolio Builder itself is outside T-419 (D47 settled that
build-by-allocation needs no review), but whatever the lawyer says about this argument will
bear on it. Second, **AI agents are row 5 by nature**: an assistant answers one person's
question. That is why D26 and D77 flagged a score read out by an agent as the place "a
reference number most easily becomes advice", and why the agent prompts now tell the
assistant not to produce a rating of its own.

---

## 5. Asset by asset

Each type below answers the four questions T-419 asked: what a rating would say, which rules
could treat it as advice, what disclosures it would need, and what can be shown instead.
"Would say" is read from the engine in `frontend/src/lib/risk/profiles/` and the tier rules in
`frontend/src/lib/data/instruments.ts`, so it describes what the rebuild starts from.

### 5.1 Crypto coins (other than stablecoins)

- **Would say:** a 0–100 score (higher is safer) from 7-day realized volatility, trading volume
  against market cap, market cap as a proxy for maturity, the 30-day price trend and the
  sentiment of recent news; in Portfolios, a hand-set 1–10 tier per coin (Bitcoin 3,
  Ethereum 3, `portfolioCoins.ts`).
- **Rules:** for coins that are digital commodities, collectibles or tools, no registration
  system reaches an impersonal rating (§3.5); fraud and advertising rules do (§3.6). Tokens
  that are securities bring §3.2 back. Outside the US, a personal crypto recommendation is a
  licensed service in the EU.
- **Disclosures, if it returns:** the method (pillars, weights, data window and sources);
  what it does **not** assess (code, team, custody, legal standing: RP-6's list); that it is
  the same for every reader; the token's classification; the crypto line already on every
  crypto page ("Crypto assets are highly volatile and can lose all their value").
- **Instead:** realized volatility, maximum drawdown, 30-day change, the liquidity ratio,
  market cap, category and supply facts, and the Pump Report's alert (live, D70).
- **Recommendation:** facts until the lawyer has answered; then the strongest candidate for
  an impersonal rating in the rebuild, once the catalog flags which tokens are securities.

### 5.2 Stablecoins

- **Would say:** a 0–100 score from the quality of the reserves (discounted when the last
  attestation is old), the distance from $1.00 now and over 7 days, how the peg is held
  (fiat, crypto, algorithmic) and how the issuer is regulated, the supply footprint, and
  news sentiment.
- **Rules:** payment stablecoins from permitted issuers are neither securities nor
  commodities once the GENIUS Act takes effect (by 2027-01-18); yield-bearing ones such as
  USDY can be securities. GENIUS
  regulates issuers and the firms offering stablecoins, not publishers. **This is the rating
  most likely to be relied on and most damaging when wrong**: a grade that calls reserves
  safe works like a credit rating, and a depeg is the moment it gets tested.
- **Disclosures, if it returns:** the reserve source and attestation date (the Reserve
  Monitor's `ReserveProvenance` already does this); "an attestation is not an audit"; the
  method.
- **Instead:** what the Reserve Monitor already shows (supply, collateralization, attester
  and date with provenance), the peg deviation now and its worst point over 7 days, the
  mechanism as a fact, and, once it exists, whether the issuer is permitted under GENIUS.
- **Recommendation:** facts only, now and after the rebuild.

### 5.3 Stocks

- **Would say:** a 0–100 score from volatility (with beta as evidence), maximum drawdown,
  dollar volume and spread, and company size; in Portfolios, a 3–6 tier read from beta alone.
- **Rules:** securities, so the Advisers Act and state law apply. On the stock's own page,
  an impersonal rating is the *Lowe* and *Seeking Alpha* form. A portfolio-level figure is the
  personal form.
- **Disclosures, if it returns:** the method and inputs; the data window; that it is the same
  for every reader; that past volatility does not predict future results (already in the
  draft); a policy on the owner's own holdings (§6).
- **Instead:** volatility, beta with its R², maximum drawdown, the 52-week range, market cap,
  average dollar volume, sector; Compare's Sharpe and Sortino.
- **Recommendation:** facts until the lawyer has answered; then the second candidate for an
  impersonal rating in the rebuild.

### 5.4 ETFs and mutual funds

- **Would say:** Conservative, Moderate, Aggressive or Speculative, read from structure:
  leveraged, inverse and crypto funds are Speculative, bond funds Conservative, broad equity
  Moderate, the rest Aggressive. In Portfolios, a 2–7 tier on the same reading.
- **Rules:** securities, and on each fund's own page the label is impersonal. The trouble is
  the words: they are the vocabulary of investor risk profiles ("a conservative investor"),
  and the code itself calls the label "a coarse suitability band". Suitability is a duty of
  brokers and advisers. The label can also simply be wrong: a long-term Treasury fund is
  "Conservative" by this rule, yet it can lose more than a broad stock fund when rates jump,
  as it did in 2022.
- **Disclosures, if it returns:** that it describes structure, not suitability; the fund's
  prospectus as the authority on its risks.
- **Instead:** facts from the fund's own documents, such as a leveraged fund's statement that
  it aims for its multiple over a single day, so longer holdings can drift from it; the asset
  mix (from N-PORT, already live); expense ratio; the tracked index; duration for bond funds;
  historical volatility and drawdown; a link to the prospectus.
- **Recommendation:** replace the label with these facts. They tell the reader more and
  claim less.

### 5.5 Commodities (front-month futures)

- **Would say:** a 0–100 score from volatility and drawdown, how the market behaves (demand
  drivers, squeezes, limit moves) and contract depth; in Portfolios, a tier by category with a
  step up for thinly traded contracts.
- **Rules:** futures, so the CFTC (§3.4). An impersonal rating rests on Rule 4.14(a)(9) and
  the First Amendment cases, since the "solely incidental" publisher exclusion may not fit. A
  rating of a user's futures positions falls outside the exemption. Commodity ETFs (USO, GLD)
  are securities and belong to §5.4.
- **Disclosures, if it returns:** leverage and margin, the roll, limit moves; Rule 4.41's
  care with anything resembling past or hypothetical results.
- **Instead:** price statistics, contract facts (unit, quote basis, exchange), the
  single-commodity ETF list already on each page.
- **Recommendation:** facts only.

### 5.6 Currencies

- **Would say:** a 0–100 score from the regime (free-floating major, cross, emerging market,
  index), volatility and depth; in Portfolios, a tier by that regime.
- **Rules:** exchange rates are data. Advice on retail forex trades (leveraged, off-exchange)
  is CTA territory (§3.4). Currency ETFs and trusts (FXE, UUP) are securities.
- **Disclosures, if it returns:** whether the figure concerns a leveraged forex trade or
  holding a currency; the method.
- **Instead:** ECB reference rates (official tier, already live), volatility, the regime as
  a fact from the central bank, the ETF list already on each page.
- **Recommendation:** facts only.

### 5.7 Interest rates and bonds

- **Would say:** a 0–100 score from duration (sensitivity to rates, growing with maturity),
  structure (a yield reading versus a margined futures contract) and credit category; in
  Portfolios, a tier by maturity and structure.
- **Rules:** Treasury yields are data and cannot be bought. Rate futures are CFTC (§3.4).
  Bond funds are securities (§5.4). Grading issuers' credit edges toward a credit rating
  (§3.7).
- **Disclosures, if it returns:** the method, and that credit categories are as each fund
  states them.
- **Instead:** the official Treasury par curve and spreads (live); **duration as arithmetic**:
  roughly how much a holding's price moves for a 1-point change in rates, which is the most
  useful "risk" number a bond reader can have and is a formula, not a judgment; credit
  quality as the fund states it.
- **Recommendation:** facts only, with duration explained.

### 5.8 Options

- **Would say:** a 0–100 grade, higher being safer, for one trade the user describes: the
  liquidity of its worst leg, how implied volatility suits the trade, the chance of early
  assignment, time decay, and whether the loss is capped.
- **Rules:** options on stocks are securities (Exchange Act §3(a)(10)); options on futures are
  CFTC. This scorer is **personal by construction**: it grades the trade the user typed in,
  which is the form *Lowe* leaves out. A grade calling a specific trade "safer" is the most
  recommendation-like thing the engine can produce. Brokers must give options customers the
  OCC's disclosure document before they trade (Rule 9b-1), which shows how seriously
  regulators take options risk.
- **Disclosures, if anything returns:** the OCC's "Characteristics and Risks of Standardized
  Options"; that every figure was typed in by the user (there is no chain feed, RP-1).
- **Instead:** a calculator with arithmetic only: maximum loss and gain, breakevens, a payoff
  chart, days to expiry, the ex-dividend date for assignment, and net Greeks from the
  volatility the user enters. No grade and no "safer".
- **Recommendation:** the scorer stays off. Rebuild it as the calculator, and only after the
  lawyer says whether even a calculator on a user's own trade is "analysis" in the Act's
  sense. D9 already put the options tool behind D4's review.

---

## 6. What any rating that comes back would need

A checklist drawn from the sources above. FINRA's rule for brokers' interactive analysis tools
(Rule 2214) does not bind this app, but it is the closest official model for what an honest
tool says about itself.

1. **The method, on the page**: what is measured, from what data, over what window, with what
   weights, and what is **not** assessed (RP-6's list).
2. **Its limits and assumptions**, and that **results change over time** as the data does.
3. **The universe**: which assets are rated and why some are not.
4. **That it is the same for every reader**, which is the *Lowe* condition, stated.
5. **No suitability words.** Not "conservative" or "aggressive"; describe the measurement.
6. **Provenance**: source and date, as every hand-kept table already carries.
7. **Not timed**: no alerts tied to price moves; update on a regular schedule.
8. **No paid interest**: no paid placement (D49), and a written policy on the owner's own
   holdings and trading in rated assets, which keeps the *bona fide* condition true.
9. **The not-advice text already drafted**: the footer line, the Not Investment Advice page,
   and the short line beside each feature (T-293), whose wording the lawyer reviews with the
   rest of the disclosure set (T-291).

---

## 7. The owner's answers

T-419 asks for an answer per asset type; T-420 builds the engine to it. Three choices:

- **A. Facts and standard statistics only.** No rating of any kind. Today's state under D64.
- **B. An impersonal rating on the asset's own page**, the same for every reader, with its
  method shown (§6). Built in the rebuild (T-420); shown only after the lawyer confirms it.
- **C. B, plus ratings of the user's own holdings or portfolio.** Only if the lawyer clears the
  personal form, which may mean registering (§3.3) and would mean rewriting the draft
  disclosures, which promise the opposite.

If you would rather the app never rate at all, **A everywhere is a complete answer**: nothing
in the law requires a rating, and every "Instead" list in §5 stands on its own. B is worth its
cost only where you want ratings to be part of what the app is.

| Asset type | Recommended | Why | Owner's answer |
|---|---|---|---|
| Crypto coins | **B** | Lowest federal exposure for coins that are not securities; real information value | _not yet answered_ |
| Stablecoins | **A** | Most relied on, most damaging when wrong; the Reserve Monitor's facts say more | _not yet answered_ |
| Stocks | **B** | The *Lowe* and *Seeking Alpha* form | _not yet answered_ |
| ETFs and funds | **A**, with structure facts in place of the label | The label speaks the language of suitability; the facts are more precise | _not yet answered_ |
| Commodities | **A** | A second regulator's rules for little extra information | _not yet answered_ |
| Currencies | **A** | As commodities | _not yet answered_ |
| Interest rates and bonds | **A**, with duration as arithmetic | Duration is the useful number and is a formula | _not yet answered_ |
| Options | **A**; a calculator without a grade, after the lawyer's answer | The scorer is personal by construction | _not yet answered_ |
| Any portfolio-level figure | **A**: no rating of a portfolio as a whole | The personal form, which the draft disclosures promise the app does not offer | _not yet answered_ |

The Pump Report is not in the table: the owner decided it on 2026-10-04 (D70), and it ships.
It is in the lawyer's questions below so that the review covers every rating that ships.

---

## 8. Questions for the lawyer

1. Does the publisher's exclusion, federal and in the states where users will be, cover an
   app that publishes an impersonal risk rating on each asset's page and updates it
   continuously? Does continuous updating count as "regular circulation"? What did the Second
   Circuit decide in *Lingley v. Seeking Alpha* (No. 24-2437)?
2. Is showing that same rating beside a user's holdings still impersonal? Does a figure
   worked out from the user's own mix cross into personal advice?
3. Are standard statistics and concentration figures on a user's own holdings, with no rating
   and no label, on the information side?
4. Does "the same inputs give anyone the same result", which the draft disclosures rely on,
   make a tool impersonal? Does that hold for a graded judgment, as opposed to arithmetic?
5. Futures and FX: does the app fit the CEA publisher exclusion, given "solely incidental",
   or must it rely on Rule 4.14(a)(9)? Does Rule 4.14(a)(9) cover retail-forex advice?
6. Crypto: after the 2026-03-17 interpretation, is an impersonal rating of a digital commodity
   outside every federal and relevant state registration system? What must the app do to
   classify tokens, and to handle tokenized securities such as USDY?
7. Options: is an arithmetic calculator on a trade the user enters (maximum loss, breakevens,
   Greeks) advice? Is a graded score?
8. The Pump Report (live under D70): is a coin grade refreshed every 2 minutes "timed to
   market activity"? Separately from advice, is there exposure in labelling a wallet address
   or a coin's promoters "flagged" or "critical" from an AI search of fraud reports?
9. AI agents: what limits should apply when a user asks the assistant whether their own
   portfolio is too risky?
10. Is a written policy on the owner's own holdings and trading in rated assets needed to keep
    the *bona fide* condition?
11. If ratings ever go personal: states or the SEC's internet adviser route, and what each
    costs and requires.
12. Non-US access: block, or comply where reachable?

---

## 9. Sources

Read through web-search summaries from this session; none was opened directly (see the banner).
The lawyer should work from the primary texts.

**Statutes and rules**
- Investment Advisers Act §202(a)(11), incl. (D), the publisher's exclusion: 15 U.S.C. §80b-2(a)(11).
- SEC Release IA-1092 (1987), applicability of the Advisers Act to financial planners and others.
- SEC Rule 203A-2(e), internet adviser exemption, as amended 2024-03-27 (compliance 2025-03-31).
- SEC Division of Investment Management, IM Guidance Update 2017-02, Robo-Advisers (2017-02-23).
- Commodity Exchange Act §1a(12), commodity trading advisor, incl. (B)(iv) and (C): 7 U.S.C. §1a(12).
- CFTC Rule 4.14(a)(9), 17 C.F.R. §4.14(a)(9) (adopted in the Federal Register of 2000-03-10); Rule 4.41; Rule 180.1; Part 5 (retail forex).
- Securities Exchange Act §3(a)(10) (options as securities); §3(a)(61) (credit rating agency); Rule 9b-1 (options disclosure document); Rule 10b-5.
- FINRA Rule 2214, investment analysis tools (binds brokers; used here as a model).
- FTC Act §5; FTC "Operation AI Comply" (announced 2024-09-25).
- SEC interpretive release on crypto assets, joined by the CFTC (2026-03-17; SEC press release 2026-30).
- GENIUS Act, signed 2025-07-18; in effect no later than 2027-01-18.
- Digital Asset Market Clarity (CLARITY) Act: Senate cloture failed 2026-09-15, 49–50.
- EU MiCA, Regulation (EU) 2023/1114, Art. 3(1)(24); UK FCA Handbook PERG 8.28, COBS 4.12A.
- Uniform Securities Act, investment adviser definition and publisher exclusion (state adoptions vary).

**Cases**
- *Lowe v. SEC*, 472 U.S. 181 (1985).
- *Lingley v. Seeking Alpha Inc.*, No. 1:23-cv-05849 (S.D.N.Y. Aug. 15, 2024); appeal No. 24-2437 (2d Cir., argued 2025-04-07; outcome **[UNVERIFIED]**).
- *SEC v. Park*, 99 F. Supp. 2d 889 (N.D. Ill. 2000).
- *SEC v. Terry's Tips, Inc.*, No. 2:05-cv-188 (D. Vt., judgments 2006); *In re Weiss Research, Inc.* (SEC 2006).
- *Zweig v. Hearst Corp.*, 521 F.2d 1129 (9th Cir. 1975).
- *Taucher v. Born*, 53 F. Supp. 2d 464 (D.D.C. 1999); *Commodity Trend Service, Inc. v. CFTC* (the Seventh Circuit litigation and its remand).

**In this repository**
- `frontend/src/lib/risk/visibility.ts` (D64's switch); `frontend/src/lib/risk/profiles/` (what each rating measured); `frontend/src/lib/data/instruments.ts` and `fundCatalog.ts` (Portfolios' tiers, the fund label).
- `docs/audits/rejected-proposals.md`: RP-3, RP-6, RP-7, RP-8.
- `docs/decisions/`: D4, D9, D14 (2026-09-14); D22 (2026-09-23); D26 (2026-09-25); D64, D70 (2026-10-04); D77 (2026-10-05).
- `docs/assessments/tokenized-securities-2026-09-21.md` (USDY, F2); `docs/LEGAL-REVIEW.md`; `docs/BUSINESS-CHECKLIST.md` §2.
- `frontend/src/lib/legal/disclosures.ts` and `featureNotices.ts` (Draft v1 not-advice text and the short lines).
