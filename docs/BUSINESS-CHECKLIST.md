# Business & Compliance Checklist

Company-level work that belongs to **neither product's backlog**. Finance Now (this repo) and
Chronolens are developed independently, but they are shipped by one business — entity
structure, regulatory research, disclosures and tax compliance are decided once, for both.

**This doc is worked separately from the website and the software.** Product work lives in
`docs/ROADMAP.md` (Finance Now) and Chronolens's `docs/MASTER-CHECKLIST.md`.

**Last updated:** 2026-07-26 · Source: owner brain dump

> Nothing here is legal or tax advice. These are the questions to take to a lawyer and an
> accountant, plus the homework to do before those meetings so they're cheap and short.

---

## 1. Entity & filings

- [ ] **How to structure the business filing** covering both the website and the desktop
      application.
- [ ] **LLC vs S-Corp** — S-Corp is a *tax election*, not a separate entity type, so the real
      questions are: form an LLC now, and does electing S-Corp treatment save enough
      self-employment tax to be worth the payroll overhead (it usually only pays off past a
      meaningful profit level).
- [ ] **One entity or two? Should the website and software file separately?** Decide on the
      real trade-off, not vibes:
      - *One entity, two products* — cheaper, simpler books, single tax return; but the two
        products share liability.
      - *Two entities* — liability isolation and a clean sale of one product later; costs
        double filings/registered agents/bookkeeping.
      - A middle path exists: one holding entity with the products as separate DBAs or
        wholly-owned subsidiaries.
      - Note the products have genuinely different risk surfaces: Finance Now touches financial data,
        risk scoring and (potentially) brokerage links; Chronolens is a research/media site.
- [ ] Registered agent, EIN/TIN, state of formation, operating agreement.
- [ ] Business bank account + bookkeeping separate from personal, from day one.

## 2. Regulatory research (both products)

- [ ] **Federal regulations applicable to the website and the software.** Priority areas:
      - **Investment advice vs. information** — SEC/state investment-adviser rules. Risk scores
        and "recommendations" at scale is exactly the line flagged in
        `docs/MARKET-ASSESSMENT.md`'s risk register. Keep framing informational; know where the
        line actually is.
      - **Broker-dealer** — triggered only if the brokerage-linking work goes beyond read-only.
      - **FTC** — affiliate disclosure, endorsement rules, "clear and conspicuous".
      - **Data licensing / redistribution** — serving third-party data from our keys.
      - **Privacy** — GDPR/UK GDPR (EU/UK visitors), CCPA (California), plus cookie/consent
        rules if analytics or ad tech ships.
      - **Crypto-specific promotion rules** — UK FCA financial promotion regime covers crypto
        referrals; several jurisdictions restrict crypto affiliate marketing.
- [ ] **Which countries can access which product**, and whether geo-blocking is cheaper than
      compliance in the hard jurisdictions. (Chronolens tracks the site-side implementation;
      the *decision* is here.)
- [ ] 🔁 **Standing item: re-check data-source licensing on a cadence, for both products.**
      Not a one-time gate. A licence change is *silent* — a broken feed announces itself, but a
      provider changing its terms breaks nothing: the code keeps fetching while the business
      becomes non-compliant. Applies to CAEP's provider registry (CoinGecko, FMP, Finnhub,
      Twelve Data, Tiingo, Alpha Vantage, exchange APIs) exactly as it does to Chronolens's
      eleven feeds. Quarterly once live, plus on every trigger: a new source is added, ads or
      affiliate links go live, beta → public, a new jurisdiction opens, a provider announces
      terms/pricing changes, or a plan is upgraded. Each product's checklist tracks its own
      per-source verification; the obligation to keep looking lives here.

## 3. Disclosures & public documents

- [ ] **Develop the required disclosure documents and decide where they're posted.** At minimum:
      Terms of Service, Privacy Policy, "Not investment advice" disclaimer, affiliate/ad
      disclosure ("How we make money"), data-source attribution page, and a contact/complaints
      route.
- [x] **Source-labeling policy (both products).** ✅ **DRAFTED 2026-09-14 — awaiting approval.**
      Written up as `docs/policies/source-labeling.md` rather than inline here, because it ran
      to a page: the rule ("every number traceable to a named third party or to us, tellable
      without clicking"), the four labels and when each is required, licence-required wording
      (CoinGecko API Terms 4.4 verbatim, with a 10px floor a test enforces), how derived figures
      are marked, how absence is stated, placement, and — deliberately — a table of which rules
      are machine-checked and which are convention only. Three are convention only; that is the
      honest gap. Each product's checklist tracks its own rendering.
- [ ] Placement rules: linked in the footer of every page **and** surfaced at the point of
      relevance (a disclaimer nobody sees does not protect anyone).
- [ ] Keep one canonical copy per document, shared by both products where the text is identical,
      so they can't drift.

## 4. Tax & ongoing compliance

- [ ] **Tax paperwork / TIN / compliance tracking — an internal tool for the owner.** Confirmed
      scope: this tracks *the company's own* obligations (filings due, TIN/EIN records,
      quarterly estimates, 1099s from affiliate programs) so taxes get filed correctly. It is
      **not** a user-facing product feature and ships in neither product. Cheapest first
      version is a deadline calendar plus a document checklist; only build an agent for it if
      the manual version proves it earns its keep.
- [ ] Affiliate income is reportable — expect 1099s once affiliate links go live; bookkeeping
      must be in place **before** the first payout, not after.
- [ ] Annual entity filings / franchise tax calendar.

## 5. Definition of "done": releasable and sellable

- [ ] **Answer the question: what does a releasable, sellable product actually look like?** —
      so there's an objective switch from *building* to *maintaining and updating*. This is one
      business decision with a **per-product answer**; write the bar here, then mirror it as a
      release gate in each product's checklist.
- [ ] Suggested shape for each bar (fill in per product):
      - Feature floor: the specific list that must work, with nothing half-built behind a nav link
      - Data honesty: every surface either shows real data or says plainly that it can't
        (Finance Now: the REAL-vs-FALLBACK audit rule · Chronolens: the ⛔ pre-release feed gate)
      - Legal floor: sections 1–3 of this document closed
      - Operational floor: backups, error monitoring, a support inbox someone reads
      - Quality floor: no known data-corrupting bug; tests green

### 5.1 Finance Now — the release bar

~~**DRAFT 2026-09-14 (T-298, owner decision D15) — awaiting approval.**~~ ✅ **ADOPTED AS THE
RELEASE GATE 2026-09-24 (D23)** — owner: *"Ill let then stand as they are."* Adopted **as it
stands**: two floors met, the data-honesty FAIL not met and not waived, the Feature floor
structurally approved but its list still the owner's to supply (T-298 is now that gap alone).
Record: `docs/decisions/2026-09-24-owner-decisions.md`. Mirrored at `docs/TASK-QUEUE.md` §P3-W3.
The draft note that follows is left as written. Two of the five
floors are measurable today and are filled in with real numbers and the command that
checks them. Three need the owner and are marked so; a floor nobody can test is a wish.

| Floor | Bar | Status today |
|---|---|---|
| **Data honesty** | `npm run audit` on the owner's machine, from a **verified non-VPN egress**, reports **0 FAIL**, and every FALLBACK is explained by design or a missing key — not by an unreachable upstream | ⚠ **Nearly met, 2026-09-12** (`docs/audits/live-data-audit-2026-09-12.md`). The non-VPN run — the one that counts — was **64 REAL / 9 FALLBACK / 1 FAIL**. All 9 fallbacks qualify: by design or key-gated. The 1 FAIL does **not** meet a 0-FAIL bar as written, and is recorded as not-met rather than waved through: it was a Tronscan `429` that reproduced against Tronscan directly, outside the app, so it is a provider rate limit and not our defect — but "someone else's transient" is a judgement, and a bar that accepts judgements is not a bar. **Owner call: re-run to confirm it clears, or amend the bar to allow a documented transient upstream failure.** For reference the VPN run the same evening was 65/9/0, which is why the egress precondition below matters |
| **Quality** | `npx tsc --noEmit` clean · `npx eslint .` 0 errors · full vitest suite green · `npx next build` succeeds · no known data-corrupting bug | ✅ **Met — re-measured 2026-09-24**: tsc clean, 0 errors / 46 warnings, 117 files / 1613 tests, build succeeds in CI on every PR (`CI Success Gate` is a required check since 2026-09-23). The 2026-09-14 figures were 44 warnings / 1444 tests; the warning count is the React-compiler lint baseline and has not moved by intent |
| **Feature** | The specific list of surfaces that must work, with nothing half-built behind a nav link | ✅ **FILLED 2026-09-24 (D24)** — the list is §5.1.1 **in full**; owner: *"Keep all."* Each 🟡 surface counts as working *in its disclosed degraded state*. **Provisional**: the owner will review this after the worklist is finished and may change it — until then, this is the floor. ~~⚠ OWNER — needs the list.~~ §5.2 names what is *out*, which is the other half |
| **Legal** | Sections 1–3 of this document closed | ⚠ **OWNER** — and gated: the FMP reading (2026-09-13) established that public-facing display needs a vendor agreement, not a plan upgrade. Lead time, not a checkout |
| **Operational** | Backups, error monitoring, a support inbox someone reads | ⚠ **OWNER** — parked under the 2026-09-05 rollout ruling (D1); provisioning is not being done yet by decision |

⚠ **The data-honesty floor has a precondition that is easy to skip.** "Owner's machine"
is not the same claim as "owner's IP". Check the egress *first* —
`curl -s https://api.ipify.org` then `ip-api.com/json/<ip>?fields=isp,proxy,hosting` —
and if `proxy` or `hosting` is true the run does not count, whichever machine made it.
This has produced four wrong conclusions in this repo, most recently on 2026-09-14 when
a VPN on AS62651 would have made twenty publisher terms pages read as unreachable.

#### 5.1.1 Feature floor — ~~candidate list (DRAFT 2026-09-24, T-298 — owner strikes from it)~~ ADOPTED IN FULL 2026-09-24 (D24)

> **Owner, 2026-09-24:** *"Keep all, once we finish the worklist I will review this and we may make changes."* Nothing was struck. The list below is the Feature floor as adopted; the "how it was built" note is kept because it defines what "must work" means for a 🟡 line. **Provisional** — a post-worklist review is expected and any change to it is a decision, recorded here.


**How this list was built, so the owner knows what a strike means.** Every surface below is
either 🟢 Live or 🟡 Partial in `DATA-AVAILABILITY.md` (run of 2026-09-19) and is **not** on the
§5.2 fence. A 🟢 row is listed by name. A 🟡 row is listed **with the degraded state that is
accepted at v1**, because the data-honesty floor already requires that a surface either show
real data or say plainly that it cannot — so "must work" for a 🟡 surface means *works in its
disclosed state*, not *becomes 🟢 before launch*. Striking a line means it is not required to
work at v1; it does **not** move the line onto the fence, which takes a decision.

**Core (always on)**
- `/headlines` — the landing page; cross-module merge of the crypto and equities wires
- `/watchlist`, `/portfolios` — DB-backed; live prices; the Look-through tab
- `/compare` — 2–6 assets of any class · *accepted 🟡: macro series are provider-dependent and render a dash when unpriced*
- `/research`, `/brief`, the Assistant widget — *accepted: dark without `ANTHROPIC_API_KEY`, and say so*
- `/settings` (Integrations, Suite Modules), `/data-sources`, `/how-we-make-money` — *the last one's four sections are owner-copy placeholders today (§3) and are part of the Legal floor, not this one*

**Crypto module**
- Coins (`/assets`) with the Reserves tab · Coin detail (`/assets/[id]`) · Alerts (TopBar)
- `/news` · `/videos` · `/coin-discovery` with the "About this project" panel
- `/staking` — both tabs · *accepted 🟡: 27 of 51 live APRs, the rest labelled static estimates; Live Pools lands DefiLlama only (T-399)*
- `/technical-analysis` (Backtest tab hidden — on the fence) · `/scanner` · `/pump-report`
- Network fees — *accepted 🟡: BTC + four EVM L1s live, L2s and non-EVM chains are labelled estimates*
- `/social` — *accepted 🔑: Reddit withheld without `REDDIT_CLIENT_ID` (its robots gate), volume signals absent without Santiment/LunarCrush keys; the page says which*

**Equities module**
- Stock Registry (`/equities`) — *accepted 🟡: the 79-name curated catalog on the free FMP tier; the paid universe is deferred under D21*
- Equity detail · SEC filings · fundamentals · company profile — all keyless and 🟢
- Quotes, price chart, OHLCV/TA, trailing returns — *accepted 🔑: keyed; catalog `ref` prices with the amber tag when no key is held; returns `source: none` rather than fabricated*
- `/equities/news` — *accepted 🟡: CNBC only (MarketWatch removed on terms), no per-ticker feed*
- `/equities/social` — *accepted 🟡: StockTwits only*
- `/equities/scanner` · `/equities/options` (Trade Risk Scorer) · `/equities/calendar` — *accepted 🟡: earnings live, economic calendar empty on the free tier*

**Macro Markets module**
- `/macro/news` · `/macro/currencies` with the two-tier converter · `/macro/rates` with the Treasury curve — all 🟢 keyless
- `/macro` overview, `/macro/commodities` — *accepted 🔑: instrument quotes have measured UNCONFIGURED on every run since 2026-09-09 and render a dash; the catalog copy, categories and ETF proxies are unaffected*
- `/macro/scanner` (29 of 45 instruments, exclusion stated on-page) · `/macro/technical-analysis` (51 indicators, volume ones withheld and named)

**ETFs & Funds module**
- `/funds` registry · fund detail with the Fee Drag Analyzer and sales-load disclosure · holdings from N-PORT — *accepted 🟡: UITs such as SPY fall back to indicative top holdings, and say so*

**Portfolio Builder (premium)** — both modes, saved plans, the drift monitor

**Programmatic surfaces** — `/api/v1/*` (every listed endpoint answers; `transfer/routes` answers 503 by decision) and the MCP server's tools, less `find_transfer_routes` (withheld) and with `run_audit`'s shipping status still open (D5)

**Deliberately absent from this list, and why:** Transfer Fees and Wallets (hidden — fence) ·
every backtest surface (hidden — fence) · futures term structure and CUSIP bond quotes (🔴, no
source, stated on-page) · everything ⚪ Removed.

### 5.2 Finance Now — explicitly out of v1

~~**DRAFT 2026-09-14 (T-299, owner decision D15) — awaiting approval.**~~ ✅ **APPROVED AS
WRITTEN 2026-09-24 (D23)** — owner: *"Ill let then stand as they are."* T-299 closed. Record:
`docs/decisions/2026-09-24-owner-decisions.md`. Consolidated from
`CLAUDE.md`'s feature inventory and `docs/audits/rejected-proposals.md`. This is the
fence scope creep bounces off: **anything here returning to v1 is a decision, not a
bug report.**

**Removed — code deleted, recoverable from `archive/*` tags**
- Risk Scores page (`/risk-scores`) and all per-coin risk scores anywhere — *RP-6, item 4*
- Budget module and Retirement Planner — *moved to a separate product, 2026-08-20*
- Risk Case Studies (`/backtests`) — *static educational replay, no user value*
- Global adoption / CBDC tracker (`/global-adoption`) — *D10, 2026-09-14*
- The 30d sparkline column and the coin-detail on-chain analytics panels — *D11, 2026-09-14*
- Exchange API-key custody — *RP-5, security grounds*

**Hidden from rollout — built, kept, deliberately unreachable**
- Transfer Fee Calculator (`/transfer-fees`) · Wallets (`/wallets`) — *owner, 2026-08-22*
- Strategy Backtests (`/equities/backtests`) and the crypto/portfolio backtest tabs — *owner, 2026-08-20, "I may revisit back testing"*

**Declined, with a recorded reopen trigger**
- Options chain browser — *RP-1: no usable keyless source*
- Score-history persistence — *RP-4*
- Composite risk scores on `/staking` cards, in `/api/v1`, and in MCP — *RP-3 and D14*

**Deferred to post-launch by decision, not by capacity**
- SOC 2 — *D5, trigger: first paying customer or first enterprise conversation*
- Affiliate links and their disclosure — *D7*
- Reddit OAuth — *D8* · S4 options subproject — *D9* · new risk profiles — *D18*
- Business entity formation — *D13*

**Gated on external review**
- Build-by-allocation, S5 contribution modeling, the federal sale-tax estimator — *D4: built, dark until a qualified legal review clears them*

## 6. Documentation accuracy

- [ ] **Review all project documents** so they accurately describe what each product actually is
      and does — both repos have docs written at different stages, and stale claims in a public
      repo are a liability once there are customers. Known example: Chronolens's
      `docs/EVENTS-SCHEMA.md` carried a "not yet applied" header long after the migrations
      existed.
- [ ] Same pass over anything user-facing: marketing copy, README, in-app help — no claim that
      overstates what ships.
