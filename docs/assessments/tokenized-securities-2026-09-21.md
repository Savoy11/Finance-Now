# Tokenized securities — where regulation stands (2026-09-21) and what Finance Now has to change

_Read-only assessment. **No code changed.** Requested by the owner on 2026-09-21: "a deep
search on tokenized securities and how my application will need to adapt to consider
regulation and trading as these securities become publicly available."_

> ⚠ **None of this is legal advice, and none of it was written by a lawyer.** It is a dated
> research record plus an engineering gap analysis. Anything that becomes a published
> disclosure, a product decision that lets other people load the app, or a trading
> integration deserves a professional. Same footing as `docs/LEGAL-REVIEW.md`.
>
> ⚠ **How the research was done, and its limit.** The session ran in a sandbox whose egress
> policy blocks `sec.gov`, `api.coingecko.com`, DefiLlama, most law-firm sites and every
> venue's own pages (the same limit CLAUDE.md records for data audits). Facts below come from
> web-search summaries of primary and secondary sources, not from opening the documents.
> Every primary URL is listed in §12 so the owner can open it. **A search summary is not a
> reading** — the same rule the source-terms registry applies. Anything a decision will rest
> on (a clause of the SEC order, a venue's terms of use) must be opened on the owner's
> machine first. Items marked **[reported]** rest on a secondary source only; items marked
> **[UNVERIFIED]** could not be pinned down at all.

---

## 1. The short answer

1. **This became a live, US-legal market four days ago.** On 2026-09-17 the SEC issued a
   five-year "innovation exemption" that lets permissioned on-chain venues trade tokenized
   versions of listed US stocks for US persons. Nasdaq's and NYSE's rules to trade the *same*
   shares in tokenized form were approved in March and April 2026, and DTC's pilot goes to
   full rollout this quarter. Coinbase, Robinhood, Kraken and Ondo already run tokenized-stock
   products **outside** the US; Dinari runs one **inside** it. The tokenized-stock market is
   ~$3B and ~3 million holder addresses; tokenized Treasuries are ~$26–28B (§4).

2. **The app already has this problem in miniature, and it is misfiled.** The Coin Registry
   carries Ondo's USDY — a tokenized US-Treasury *note*, a security sold only to non-US
   persons — typed as a **stablecoin with a $1.00 peg**, and the catalog itself records it as
   282 bps "off peg" because it accrues yield by design (§6, F2). The registry also renders a
   "Tokenized" filter chip that no catalog entry can ever satisfy (F1). Coin Discovery's
   heuristics would label BlackRock's BUIDL — a $5M-minimum private fund — "Stablecoin
   (heuristic)" if it enters the universe, and by market cap it should already be inside it
   (F3, needs an owner-machine probe).

3. **The core adaptation is a data-model one, not a regulatory one.** Today an instrument is
   one thing with one class and one price. A tokenized security is a *representation* of an
   instrument: the same Tesla share can exist as an NYSE share, a DTC-pilot tokenized share
   with the same CUSIP, a Coinbase wrapper on Base for non-US holders, a Dinari dShare for US
   holders, and a Robinhood debt token in the EU — with **different prices, hours, rights,
   and eligibility**. Every other change (pricing, hours copy, disclosure, agents, risk) falls
   out of modelling that distinction. Section 7A specifies it.

4. **The app's regulatory posture does not change as long as it stays analytics-only.** The
   exemption gives relief to *venues* and *liquidity providers*, none to information
   services, and none to broker-dealers. Displaying, comparing and explaining tokenized
   securities keeps the app on the side of the line RP-3/RP-6 already drew (explanation, not
   recommendation), provided the labelling is truthful (§7C). **Adding "trading" — routing an
   order to a venue or a broker — would change the category entirely** (broker-dealer or
   introducing-broker questions, RP-5's ban on exchange-key custody, and T-151). The
   recommendation is to reaffirm analytics-only explicitly (§8, decision 6).

5. **What to do now, before rollout:** the four P0 hygiene items in §9 (USDY, the empty chip,
   the discovery/scanner bucket, the README claim) are cheap and stop the USDY class of error
   compounding as tokenized stocks climb into the top-750 universe the scanner sweeps. The
   representation model and disclosure component are the P1 work. Price series and
   premium/discount analytics come after that. Trading is not proposed.

---

## 2. Plain-language primer

**A tokenized security** is an ordinary security (a share, a fund share, a bond, a note)
whose ownership record is kept, wholly or partly, on a blockchain. The SEC staff's
definition (2026-01-28): "a financial instrument enumerated in the definition of 'security'
… that is formatted as or represented by a crypto asset, where the record of ownership is
maintained in whole or in part on … one or more crypto networks." Tokenizing does not take
it outside the securities laws — the SEC, ESMA, IOSCO and the WFE all say this in as many
words.

**The three structures** (the SEC staff taxonomy, which the app should adopt as its
vocabulary):

| Structure | What the token is | Who you have a claim on | Examples |
|---|---|---|---|
| **Native / issuer-sponsored** | *Is* the share. The issuer's own register (kept by an SEC-registered transfer agent) lives on-chain | The issuer — full shareholder rights | Galaxy Digital GLXY via Superstate; Franklin's BENJI fund shares; DTC-pilot shares on Nasdaq/NYSE (same CUSIP as the ordinary share) |
| **Wrapped / custodial** (third-party sponsored) | A token backed 1:1 by a real share held by a custodian | The wrapper issuer / custodian structure, not the company. Usually **no voting rights**; dividends handled by the wrapper | Kraken/Backed xStocks (Jersey issuer), Ondo Global Markets, Coinbase's Base tokens (ADGM SPV, Alpaca custody), Dinari dShares (a US broker-dealer + transfer agent; passes through dividends and voting) |
| **Synthetic / derivative** | Price exposure only — a contract or a debt instrument referencing the share | The counterparty | Robinhood's EU "Classic Stock Tokens" (derivative contracts) and its Robinhood Chain tokens (**debt securities**, no shareholder rights) |

**Words that come up:**

- **NMS stock** — a stock listed on a US national exchange (NYSE, Nasdaq…). "Tokenized NMS
  Stock" is the SEC's term for a tokenized version of one. OTC-market stocks are excluded.
- **TSV (Tokenized Securities Venue)** — the SEC's new name for an on-chain venue that trades
  Tokenized NMS Stock under the exemption without registering as an exchange.
- **AMM / liquidity pool** — an automated on-chain market where prices come from the ratio of
  assets in a pool rather than from an order book. Thin pools move violently.
- **DTC** — the US central securities depository; nearly every US share sits there. Its pilot
  lets participants hold their DTC entitlements in tokenized form.
- **Reg S / "not available to US persons"** — an offering made only outside the US. The
  token may be freely transferable on-chain, but a US person is not an eligible holder.
- **Same CUSIP** — the exchange-track model: the tokenized share *is* the ordinary share (same
  identifier, fungible), not a wrapper.

---

## 3. Regulatory state, dated

### 3.1 United States — the sequence that matters

| Date | What | Status | Why it matters here |
|---|---|---|---|
| 2025-05-15 | SEC Division of Trading & Markets FAQ on crypto-asset activities and DLT; withdrew the 2019 joint SEC–FINRA custody statement. A transfer agent **may keep its official master securityholder file on a blockchain**; a broker-dealer may take control of crypto-asset securities under Rule 15c3-3(c) | In effect (staff position) | Native on-chain shares are legally ordinary shares with an on-chain register — the app should treat them as equities, not coins |
| 2025-07 | Commissioner Peirce, "Enchanting, but Not Magical": tokenized securities are still securities | Statement | The vocabulary the whole industry now uses |
| 2025-12-11 | SEC staff **no-action letter to DTC** for a three-year tokenization pilot (participants may record DTC security entitlements on DLT). **[reported]** limited production trades July 2026, full rollout October 2026; Russell 1000 names, major-index ETFs and Treasuries; 50+ firms | Pilot live | The same-CUSIP model: one security, two record formats. No new instrument for the app — a *representation* flag on an existing one |
| 2025-12-17 | Trading & Markets statement on broker-dealer custody of crypto-asset securities; Peirce "No Longer Special" — the 2020 special-purpose broker-dealer framework is no longer the only route | In effect | Ordinary broker-dealers can custody tokenized securities; expect more US venues |
| 2026-01-28 | Three-division **staff statement on tokenized securities taxonomy**: issuer-sponsored vs third-party (custodial vs synthetic). No relief, no new framework | Staff view, no legal force | §2's table. The app should encode this taxonomy |
| 2026-03-12 | SEC **Investor Advisory Committee recommendation** on tokenized equity: cautioned against a *blanket* exemption; third-party tokenizers need oversight; **new disclosure frameworks for ownership rights**; mandatory reporting; fair handling of customer orders | Advisory | The disclosure list in §7C is drawn from this and from ESMA/WFE |
| 2026-03-18 | SEC **approved Nasdaq's rule** (Rel. 34-105047, SR-NASDAQ-2025-072) to trade securities in tokenized form during the DTC pilot: same security, same CUSIP and symbol, same rights, DTC settlement. **[reported]** first tokenized trades possible by end of Q3 2026 once DTC completes system work | Approved | The exchange track. Prices are the exchange's prices; Reg NMS applies; no separate "token price" |
| 2026-04-10 | SEC accelerated approval of **Nasdaq 23-hour trading** (SR-Nasdaq-2025-109, Rel. 34-105199); overnight session 9 pm–4 am ET; **[reported]** launch targeted 2026-12-06; NYSE and 24X have comparable 23×5 approvals | Approved, launch pending | Unrelated to tokenization but it breaks the app's "US exchange hours, weekdays" copy on the same timeline (§6, F8) |
| 2026-04-17 | **NYSE** rule SR-NYSE-2026-17 immediately effective (Rule 7.50): tokenized securities tradable only if fungible with, same CUSIP/symbol as, and same rights as the traditional class; NYSE American, Arca, Texas and National filed the same | Effective | Same as Nasdaq |
| 2026-05-04 | **FINRA approved Securitize** as the first broker-dealer to custody tokenized securities and underwrite on-chain IPOs and secondaries | Approved | Native issuance is now a regulated US product line |
| 2026-06-02 | SEC draft Strategic Plan FY2026–2030 makes digital assets/DLT the first regulatory objective | Draft | Direction of travel |
| 2026-08-21 | SEC proposed **Regulation Crypto Assets** (offering exemptions of $5M/four years and $75M/twelve months; investment-contract safe harbor) | Proposed | About crypto-asset *offerings*, not tokenized securities. Listed so it is not confused with the exemption below |
| **2026-09-15** | **CLARITY Act cloture failed in the Senate, 49–50.** House-passed bill (H.R. 3633, July 2025) stalled on ethics language, not on the market-structure text. Passage in 2026 now priced at ~5% | Stalled | No statutory change to expect this year; the SEC is acting by exemption instead |
| **2026-09-17** | **SEC "innovation exemption"** (order reported as Rel. 34-106402; request for comment). Two five-year conditional exemptions: (a) **TSVs** exempt from the definition of "exchange" to run permissioned AMM liquidity pools in Tokenized NMS Stock; (b) liquidity providers in those pools exempt from the definition of "dealer". Expires **2026-09-17 + 5 years = 2031-09-17** | In effect | The on-chain track for US persons. Conditions below |

**Conditions of the 2026-09-17 exemption that an analytics app should model** (from the
SEC release as summarised by Markets Media, Sullivan & Cromwell and Jones Day — confirm
against the order):

- **Permissioned, US persons only.** Access is limited to approved participants; venues set
  access standards.
- **Same rights.** The TSV must verify that the tokenized stock gives holders "the same
  rights and privileges" as the traditional class — dividends and voting included. That
  excludes today's offshore wrappers as they stand; CoinDesk quotes analysts saying Kraken's
  xStocks "would need to change" to use the pathway.
- **Synthetic tokens excluded. OTC-market stocks excluded.** NMS stocks only.
- **Issuer notice and 30-day objection right** before a third-party tokenization trades.
- **Halts mirror the listing exchange.** A TSV must stop trading when the primary listing
  exchange halts the underlying.
- **Symbol and volume caps** per venue.
- **Public, auditable smart contracts on a public permissionless ledger.**
- **Transaction transparency — the item that matters most for this app.** A TSV must make
  USD-denominated transaction data for the trailing 30 days "freely and publicly available
  in machine-readable format", updated within 10 minutes: symbol of the tokenized stock and
  of the paired asset, price, size, time, direction. **That is a new class of free, public,
  regulator-mandated market data** — but "publicly available" is a disclosure obligation on
  the venue, not a redistribution licence for us. Each venue's terms still need a reading
  before a fetch (§7G).
- **No relief for registered entities.** A broker-dealer transacting on a TSV keeps its
  best-execution and reporting duties. Nothing in the order touches information services.
- **30-day advance public notice** on the venue's site, then notice to the SEC.

**Reactions worth knowing:** SIFMA (statement, September 2026) warned that "multiple
tokenized versions of U.S.-listed securities" could trade "in parallel, lightly regulated
markets", causing "investor confusion and harm" and "price and liquidity fragmentation";
Citadel Securities and SIFMA had opposed proceeding by "special arrangements"; the World
Federation of Exchanges wrote to the SEC's Crypto Task Force, ESMA and IOSCO in August 2025
and again in November 2025. There was no dissent on the order — Commissioner Crenshaw left
the SEC on 2026-01-02 and the Commission is all one party. SIFMA's fragmentation point is
exactly the app's data problem stated from the other side: **one security, several prices.**

**Two adjacent US items:**

- **GENIUS Act** (stablecoins, enacted 2025-07-18): regulators missed the 2026-07-18 final-rule
  deadline, so the statutory backstop governs — effective **2027-01-18**. Treasury's NPRM was
  published 2026-08-18 (comments due 2026-10-19). Relevant because the settlement leg of
  every tokenized-stock trade is a stablecoin (USDC on Dinari and Coinbase).
- **Tax.** Digital-asset brokers file **Form 1099-DA** for sales from 2026-01-01. Its Box 1i
  (wash-sale disallowed loss) applies only to digital assets that are "stock or securities"
  for tax purposes — "such as tokenized equity in a registered company", same CUSIP, same
  account. Most crypto stays property, outside §1091. So a tokenized *native* share is taxed
  like the share; a wrapper's treatment is the open question. The app publishes no tax
  figures (T-058/T-059 hold), so this is a disclosure fact, not a computation.
- **UCC Article 12** (commercial-law title to "controllable electronic records"): 24 states +
  DC by March 2025, more than 30 by early 2026; New York effective 2026-06-03.

### 3.2 Outside the US

| Jurisdiction | Governing law for tokenized securities | Retail tokenized-stock trading | 24/7 | Latest development |
|---|---|---|---|---|
| **EU** | MiFID II / CSDR / Prospectus Regulation — **not MiCA** (financial instruments are carved out of MiCA). The **DLT Pilot Regime** (Reg. 2022/858, applied since 2023-03) is the on-chain venue route | Yes, via MiFID firms: Robinhood Europe UAB (Lithuania) sells stock tokens as derivatives / debt securities, i.e. synthetic | Robinhood: yes | ESMA's 2025-06-25 review recommended making the pilot permanent with flexible thresholds; only **three** DLT market infrastructures were ever authorised. ESMA's Art. 14 report to the Commission was due 2026-03-24; the Commission's own report and any legislative outcome are **[UNVERIFIED]** from here. ESMA warned in September 2025 that tokenised stocks "risk investor misunderstanding" because they "generally do not confer shareholder rights" |
| **UK** | Digital Securities Sandbox (FCA + BoE, open since 2024-09-30); BoE guidance updated 2026-06-30 to admit qualifying stablecoins as settlement assets | Not yet on-venue. **2026-09-01: LSEG announced UK tokenised equity structures and a partnership with Payward (Kraken)**: the 100 largest London-listed companies to be issued as xStocks "in the coming weeks", listing on "LSE 24" in 2027 subject to approval, plus a native UK equity token with "the same rights as conventional shares" | Planned | The first incumbent exchange to adopt a wrapper product *and* pursue native tokens |
| **Switzerland** | DLT Act (2021) ledger-based securities (Art. 973d CO); SDX holds the FINMA DLT trading-facility licence | Institutional | — | **[reported]** FINMA approved the merger of SDX into SIX SIS on 2026-05-05 — a single regulated CSD spanning traditional, DLT and crypto |
| **Hong Kong** | SFC circulars on tokenised securities (2023 →); Stablecoins Ordinance (2025-08); HKMA Project Ensemble → **EnsembleTX** running through 2026 | **Yes**, on licensed VATPs with an upgraded licence; 13 tokenised products sold to the public by March 2026 **[reported]** | **Yes — overnight and weekend secondary trading of authorised tokenised products is permitted [reported]** | The first major regulator to say "24/7" out loud for authorised products |
| **Singapore** | MAS Project Guardian — Guardian Fixed Income and Guardian Funds frameworks; 40+ institutions | Institutional pilots | — | Commercialisation plans (2024-11) continue |
| **International** | IOSCO Final Report FR/17/25 (2025-11): adoption still mostly pilots; risks are legal certainty, operational/cyber, interoperability, lack of credible settlement assets, and **settlement finality (especially on L2s)**; "same activities, same risks, same regulatory outcomes". BIS FSI and IMF (2026 Notes 001) reach the same shape | — | — | The risk dimensions in §7E come from here |

### 3.3 Dates to watch (the regulatory clock this document should be re-read against)

| Date | Event | What to re-check in the app |
|---|---|---|
| By 2026-09-30 | Nasdaq's first tokenized-form trades possible **[reported]**; DTC pilot full rollout October 2026 **[reported]** | Whether any catalog equity now has a same-CUSIP tokenized representation |
| Mid-Sept 2026 → | ARK Investment Management's application for a **"Tokenized Class"** share class of a 40-Act fund (filed 2026-05-20, amended 06-11 and 08-07) — hearing-request deadline passed; SEC action could follow | Fund catalog: tokenized share classes of registered funds |
| 2026-10-19 | GENIUS NPRM comments close | — |
| 2026-12-06 | Nasdaq 23-hour trading launch **[reported]** | Every "US exchange hours, weekdays" string (§6, F8) |
| 2027-01-18 | GENIUS Act effective | Settlement-leg disclosure copy |
| 2027 | LSE 24 lists xStocks (subject to approval) | UK equities are outside the catalog today; note only |
| 2031-09-17 | Innovation exemption expires unless replaced by rules | Any representation whose regulatory basis is the exemption |

---

## 4. What is actually live, and how it behaves

### 4.1 Products

| Product | Structure | Chains | US persons? | Hours | Voting | Dividends | Since / scale |
|---|---|---|---|---|---|---|---|
| **Kraken / Backed xStocks** | Wrapped 1:1, bankruptcy-remote; issuer Backed Assets (JE) Ltd, Jersey, now in the Kraken group | Solana (main), others | **No** (also excludes Canada, UK and others) | 24/5 on Kraken, 24/7 on-chain | No | Handled by the wrapper (reinvested/adjusted) | 2025-06-30; 100 assets, target 500 by end-2026; >$25B cumulative volume, >$3.5B on-chain |
| **Robinhood stock tokens** (EU, then 120+ countries) | Synthetic: EU "Classic" tokens are **derivative contracts**; Robinhood Chain tokens (mainnet 2026-07-01) are **debt securities** — "no shareholder rights" | Arbitrum → Robinhood Chain | **No** (CEO: "tokenization is coming to America", no date) | 24/7 planned | No | Economic pass-through | 2025-06-30 (EU); no US launch |
| **Coinbase tokenized stocks** | Wrapped: issuer Coinbase Onchain SPV Ltd (ADGM), custodian Alpaca; "direct claim on the underlying share" | Base | **No** — US customers cannot buy; Coinbase's June 2025 relief request outstanding | 24/7 on eligible on-chain venues | Not stated | On-chain dividend payments | 2026-08-24; 13 names at launch (NVDAc, AAPLc, TSLA…) |
| **Ondo Global Markets → "Ondo Stocks"** | Wrapped | Solana, Ethereum, BNB Chain | **No** | Mint/redeem 24/7 for six top assets since July 2026; others windowed | No | Pass-through | 2025-09; 430+ assets by June 2026; >$1B TVL May 2026; ~70% of tokenized-equity issuance |
| **Dinari dShares** | Wrapped **by a US SEC-registered broker-dealer + transfer agent**; reflects dividends, **voting rights**, splits | Multiple | **Yes** — 724 US stocks incl. the whole S&P 500 to eligible US investors since 2026-08-04, funded in USDC from self-custody wallets | — | Yes (per Dinari) | Pass-through | Turnkey platform with tZERO for broker-dealers (2026-07) |
| **Superstate Opening Bell** (Galaxy GLXY) | **Native** — Superstate is the SEC-registered transfer agent; on-chain register | Solana | Yes, KYC-approved wallets | 24/7 transfer | Yes | Yes | 2025-09; small (32,374 shares tokenized by 21 investors in its first weeks) |
| **DTC pilot / Nasdaq / NYSE** | **Native, same CUSIP** | DTC ledger (Stellar integration mid-2027 **[reported]**) | Yes | Exchange hours (23h from Dec 2026) | Yes | Yes | Rollout Q3–Q4 2026 |
| **Tokenized Treasuries / funds** — BlackRock **BUIDL** (Reg D 506(c), **qualified purchasers, $5M minimum**, Securitize transfer agent, BNY custody, ~$2.8B); Franklin **BENJI/FOBXX** (**registered 1940-Act money market fund**, blockchain as transfer-agent record, retail from $20, ~$2.44B; SEC cleared Franklin funds to use BENJI for cash management 2026-08-12); Ondo **USDY** (yield note, non-US only) and **OUSG**; Superstate USTB; Circle USYC | Native fund shares or notes | Ethereum and others | Varies by product | 24/7 transfer; NAV/accrual daily | n/a | **Accrue** — BUIDL/BENJI mint dividend tokens; USDY's *price* rises | ~$26–28B of a ~$33.5B tokenized-RWA total (July 2026) |

### 4.2 Market size and behaviour (RWA.xyz, early September 2026)

- Tokenized stocks: **~$2.9B across 5,246 assets**, up 14% in 30 days; other trackers put
  "active" market cap at $3–4B. Supply grew from ~$0.4B (Sept 2025) to ~$3B (Aug 2026).
- Holders: **3.51M addresses** (+164% in 30 days), of which stocks account for 2.96M.
- Monthly transfer volume **fell 57% to $12.85B** — more holding, less flipping.
- Liquidity is concentrated in a few names (TSLAx, NVDAx, CRCLx, SPCX per Pine Analytics);
  the long tail "quotes wide and slips hard on any real size".

### 4.3 Mechanics an analytics app must get right

1. **Two prices.** A wrapped token has a 24/7 on-chain price *and* an underlying that trades
   ~6.5 hours a day. During US hours arbitrage keeps swap slippage at ~0.1–0.5%; off-hours
   the peg opens up. Documented episodes: an AAPL token +12% intraday on 2025-07-03 and an
   AMZN token at ~4× the underlying off-hours on 2025-07-05 (Pine Analytics / Coin Metrics).
   Peg tightness tracks the issuer's mint/redeem window — the shorter the window, the wider
   the weekend dislocation. **A price shown without its venue and time is a wrong number.**
2. **Weekend series.** Tokenized stocks trade Saturday and Sunday; the underlying does not.
   Compare's shared-trading-days caveat already covers crypto-vs-stock; a tokenized share vs
   its own underlying is the same problem in a sharper form.
3. **Corporate actions.** Wrappers reinvest dividends into more tokens, adjust the token, or
   pay out — each issuer differently. Splits, spin-offs and delistings depend on the wrapper's
   documents. Native tokens behave like the share.
4. **Rights.** Wrappers: usually no voting (Dinari says yes). Synthetic: none. Native: all.
5. **Eligibility.** Every offshore wrapper excludes US persons; Dinari includes them; the
   exemption venues are US-only. A token can be freely transferable on-chain and still be
   one a given viewer may not lawfully hold.
6. **Settlement leg.** Stablecoins — with their own peg and issuer risk, and a law that takes
   effect in January 2027.
7. **Halts.** Under the exemption a TSV halts with the listing exchange; offshore venues need
   not.

---

## 5. Data sources an app could use, and their terms status

| Source | What it gives | Keyed? | Terms status in `lib/server/sourceTerms.ts` | Note |
|---|---|---|---|---|
| **CoinGecko categories** — `tokenized-stock`, `xstocks-ecosystem`, `robinhood-chain-stocks-ecosystem`, `tokenized-exchange-traded-funds-etfs`, `tokenized-products` (ids from CoinGecko's own how-to article; **confirm on the owner's machine**, §10) | Price, market cap, 24h volume per token via `/coins/markets?category=`; contract addresses per chain via `/coins/{id}` `detail_platforms` | No | **`verified` · conditional** (attribution "Powered by CoinGecko", ≥10px) | The only registered, verified, keyless source that already covers this. CoinGecko says the tokenized-stock category's coin count grew +3,314% Jan 2024 → May 2026 |
| **DefiLlama** (stablecoins, yields, protocols) | Tokenized-treasury protocol TVL; yields | No | `seeded` · conditional | Already used by reserves/staking; staking-discovery's filters keep RWA pools out by construction (F9) |
| **RWA.xyz** | Market-wide tokenized-asset analytics (stocks, treasuries, holders) | Unknown | **Not registered** | The industry's reference tracker. Needs a terms reading before any fetch; the suite fails on an unregistered host |
| **Chainlink Data Feeds / Streams** | 24/5 on-chain prices for US stocks and ETFs; feeds for xStocks and Coinbase's Base tokens; Proof of Reserve for Backed | On-chain reads (RPC) | **Not registered** | Reading an on-chain feed is an RPC call, not an API — terms of the feed operator still apply. Pyth's equity feeds: **[UNVERIFIED]** |
| **TSV public transaction feeds** (required by the exemption) | 30 days of USD trades per venue, ≤10 min lag: symbol, pair, price, size, time, direction | No | **Not registered** (none exist yet — venues must give 30 days' notice first) | Mandated *availability*; redistribution rights per venue **must be read** |
| **SEC EDGAR** | N-PORT for registered tokenized funds (BENJI files; BUIDL does not — Reg D); 8-K exhibits (Galaxy's GLXY launch); ARK's exemptive application | No | `seeded` · conditional | `fund-holdings` already works for any registered fund — a tokenized share class of a 40-Act fund needs no new route |
| Issuer transparency pages (Backed, Ondo, Dinari, Superstate, Securitize) | Contract addresses, backing, mint/redeem windows, eligibility | No | **Not registered** | Reference data, best hand-maintained with provenance rather than scraped |

Nothing here requires a paid tier (D21 holds). CoinGecko is the load-bearing keyless source
for prices, which is the same single-vendor exposure the crypto module already carries.

---

## 6. Where Finance Now stands today — verified in the tree

Every line reference was read on 2026-09-21 at `ef9e499`.

- **F1 — The "Tokenized" filter can never match anything.** `frontend/src/types/asset.ts:1`
  declares `AssetType = 'stablecoin' | 'tokenized' | 'cbdc' | 'defi' | 'layer1'`, and
  `frontend/src/app/(dashboard)/assets/AssetRegistryClient.tsx:44-51` renders a "Tokenized"
  chip. **Zero** entries in `frontend/src/lib/data/assetCatalog.ts` carry
  `assetType: 'tokenized'` (grep count 0). The chip filters the registry to an empty table.
  `README.md:7` says the product "evaluates crypto assets — stablecoins, Layer 1s, tokenized
  assets, and CBDCs". An inert control that implies rows exist is the same defect class as the
  absent scanner filters CLAUDE.md records, and the README claim is the doc-accuracy class
  the 2026-09-19 sweep was for.

- **F2 — USDY is a tokenized security filed as a stablecoin, and its yield reads as a
  depeg.** `assetCatalog.ts:436-455`: `assetType: 'stablecoin'`, `pegTarget: 1.0`,
  reference `price: 1.0282`, `pegDeviationBps: 282.0`, `reserveRatio: 1.028`, description
  "Tokenized US Treasury and bank demand deposit yield product". `assetList.ts:30` lists it
  under `category: 'stablecoin'`; `coingeckoIds.ts:26` tracks it (`ondo-us-dollar-yield`).
  USDY is a *note* whose price is designed to rise as yield accrues; it is a security, and
  Ondo offers it only to non-US persons. The catalog therefore records a working product as
  282 bps off a peg it does not have. It is **not** in the alerts depeg list
  (`live-data/alerts/route.ts:30-46`) nor the Reserve Monitor's target set
  (`stablecoinMeta.ts:53`), so no alert fires today — the error is confined to the registry,
  the detail page and anything that reads `pegDeviation`. The other yield-bearing catalog
  entries carry par reference prices, so USDY is the only visible instance; it is the shape
  of the problem, not its size.

- **F3 — Coin Discovery would call a private fund a stablecoin.**
  `live-data/coin-discovery/route.ts:48-57` (`classifyUtility`): any CoinGecko id containing
  `usd` is labelled "Stablecoin (heuristic)". The universe is the top 250 by market cap,
  configurable to 750 (`:70-72`). BlackRock's BUIDL (`blackrock-usd-institutional-digital-liquidity-fund`,
  ~$2.8B) and Ondo's USDY sit inside that universe by market cap, so a **$5M-minimum,
  qualified-purchaser-only Reg D fund** would be offered as a "candidate coin" with a
  stablecoin note. Whether CoinGecko ranks them there today needs the owner-machine probe
  in §10 — this sandbox cannot reach CoinGecko.

- **F4 — The scanner sweeps the same universe.** `live-data/coin-list/route.ts:10`: 3 × 250 =
  750 coins. Setup detectors over a Treasury fund token produce a result that means nothing
  and is labelled like every other row. Tokenized stocks are individually below the cutoff
  today (a few tens of millions each) but the category is the fastest-growing on CoinGecko.

- **F5 — The instrument layer has no notion of a representation.**
  `lib/data/instruments.ts:21`: `InstrumentClass = 'crypto' | 'equity' | 'etf' | 'mutual' |
  'commodity' | 'currency' | 'rate'`. `lib/server/instrumentResolve.ts:24-55`: anything that
  is not a `sec:` key resolves to `assetClass: 'crypto'`, `priceSource: 'coingecko'`. The
  Portfolios add-search accepts any CoinGecko coin (`(dashboard)/portfolios/page.tsx:242`),
  so a holding of TSLAx or a Dinari dShare becomes **class crypto, `riskTier: null` ("not
  rated", `:916-917`)**, counted as crypto in the class breakdown, and invisible to the
  look-through — the opposite of what it is (Tesla exposure through a wrapper).

- **F6 — Compare would print a false structural statement.**
  `lib/data/assetClassProfiles.ts:80-88`, the crypto profile: "The token itself — no claim
  on any company's cash flows or assets", "24/7 — the market never closes". For a tokenized
  share held as a crypto instrument, the first line is wrong (a native token *is* the share;
  a wrapper is a claim on the wrapper) and the "facts, not advice" rule the module states
  at the top cuts the other way: a wrong fact is worse than no panel.

- **F7 — Quote plumbing is split by market, and tokenized securities straddle it.**
  `lib/api/live/providers.ts:8`: `ProviderMarket = 'crypto' | 'equities' | 'macro'`, and
  CLAUDE.md's rule that "the two sides never cross". A tokenized Tesla share is priced on the
  crypto side (CoinGecko) while being an equity. Nothing links the two price series for the
  same underlying, so nothing can compute or disclose the premium/discount in §4.3.

- **F8 — Market hours are strings, and they are about to be wrong anyway.**
  `assetClassProfiles.ts` carries "US exchange hours, weekdays" for stocks and ETFs and the
  Compare caveat at `:162`. There is no market-hours utility; `getUTCDay` appears only in the
  OHLCV weekly resampler and the calendar grid. Nasdaq's 23-hour day (planned 2026-12-06) and
  NYSE/24X's 23×5 make the string stale without any tokenization work at all.

- **F9 — Staking discovery is safe by construction.** `live-data/staking-discovery/route.ts:186-189`
  keeps only pools whose base symbol is one of the 16 stakeable coins and drops
  `stablecoin`/IL pools, so a tokenized-Treasury yield cannot appear as a "staking pool".
  Recorded so nobody "fixes" it into existence — a T-bill fund's yield is not staking.

- **F10 — Wallets read native balances only.** `live-data/wallet/sol/route.ts:37`
  (`getBalance`); ETH likewise. xStocks or dShares held in a watched wallet are invisible.
  Wallets is hidden from the rollout, so this is a note, not a defect.

- **F11 — Source terms cover CoinGecko and nothing else in §5.** The registry (56 hosts) has
  CoinGecko `verified`/conditional and DefiLlama and EDGAR `seeded`/conditional; no entry for
  rwa.xyz, chain.link, pyth.network, backed.fi, dinari.com, ondo.finance, superstate.com or
  any venue. `sourceTerms.test.ts` fails the suite on an unregistered host — the guard works
  as designed and will bite the first new fetch.

- **F12 — Agents and taggers do not know the distinction.** The prompts carry the no-advice
  and RP-6 rules (`lib/agents/prompts.ts:201`, `:240`) but no tool or rule distinguishes a
  token's price from its underlying's, or states rights and eligibility.
  `live-data/news/route.ts:222-226` maps "Clarity Act" to USDC/USDT/PYUSD only; nothing tags
  tokenization news to the underlying tickers or to a tokenization category.

- **F13 — The DB can hold a token but not the link.** `lib/db/schema/instruments.ts:19-20`
  (`ASSET_CLASSES` is a text union — no migration to extend) and `instrument_crypto`
  (`:66-75`) has `network`, `contractAddress`, `categories`. A tokenized representation could
  be stored as a crypto extension row today, but nothing relates it to the
  `instrument_equity` row of its underlying, which is the whole point.

- **F14 — Standing decisions this work must respect.** RP-3 / RP-6 / D14 (no published score
  or ranking); **D18** (no new risk profiles until a surface is approved to render one);
  **D21** (no paid decisions; no provider load-bearing); **RP-5** (no exchange API-key
  custody — which is also the practical bar to any "trading" integration); the 2026-09-05
  "not ready for rollout" ruling; and **T-151**, the personal-vs-public keystone, which
  decides whether eligibility disclosures are a nicety or a duty.

---

## 7. What has to change — by layer

### 7A. Data model: add a *representation* layer (P1, the keystone)

**Principle.** A representation is not a new instrument class. TSLAx is not a coin and not a
seventh asset class; it is *a way of holding Tesla* with its own price, hours, rights and
eligibility. Model it as a row that points at an existing instrument.

Proposed `frontend/src/lib/data/tokenizedRepresentations.ts` (hand-maintained, with the
standard provenance block — `TOKENIZED_REPRESENTATIONS_LAST_VERIFIED`, a stale window,
injectable-`now` helpers, `getTokenizedRepresentationsProvenance()`, a
`// STALENESS-ACK` discipline, and `npm run staleness:check` discovering it):

```ts
export type RepresentationKind = 'native' | 'native-same-cusip' | 'wrapped' | 'synthetic' | 'fund-share-class'
export interface TokenizedRepresentation {
  /** Underlying instrument key — 'sec:TSLA', 'sec:SPY', or a rate/fund key. */
  underlyingKey: string
  kind: RepresentationKind
  sponsor: string                    // 'Backed Assets (JE) Ltd', 'Coinbase Onchain SPV Ltd', 'Dinari'
  regulatoryBasis: string            // 'SEC innovation exemption 2026-09-17' | 'DTC pilot' | 'Reg S' | 'MiFID II (LT)'
  chain: string
  contractAddress: string | null
  coingeckoId: string | null         // price series, when CoinGecko lists it
  venues: string[]
  hours: '24/7' | '24/5' | 'exchange' | 'issuer-window'
  mintRedeemWindow?: string
  rights: { voting: boolean | 'per-issuer'; dividends: 'cash' | 'reinvested' | 'accrued' | 'none'; corporateActions: string }
  eligibility: { usPersons: boolean; excludedJurisdictions?: string[] }
  sameCusip: boolean
  source: string                     // issuer document URL the row was read from
  verifiedAt: string                 // ISO date the ROW was read — separate from the table's compile date
}
```

Rules that follow from the repo's existing ones:

- **Rights and eligibility are separately knowable from price**, exactly as `SalesCharge`
  splits a load's existence from its rate. Unknown voting is `'per-issuer'`, never `false`.
- **A row requires `source` + `verifiedAt`**, enforced by a test, like fund sales charges.
- **The table is dated by when it was compiled as a whole** (CLAUDE.md, Data Files
  Reference). Representations change monthly right now; expect a short window (60 days).
- DB: a later `instrument_representations` table (`instrument_id` → `underlying_instrument_id`,
  plus the fields above) is an *extension* in the ROADMAP's sense — no migration of any
  personal-finance table. Not needed until a user can hold one knowingly (7D).

### 7B. Classification hygiene in the crypto module (P0)

1. **USDY** → `assetType: 'tokenized'` (F2); drop `pegTarget`/`pegDeviation*` for accruing
   instruments, or model accrual explicitly (`accrues: true`, so the registry says "price
   rises by design" instead of "282 bps off peg"). Its description already says what it is.
2. **Coin Discovery and the scanner** (F3, F4): add a `tokenized-security` bucket to
   `classifyUtility` keyed on CoinGecko **category membership** (one call to
   `/coins/categories` or a curated id list), ahead of the `usd` heuristic. Then either
   exclude the bucket from candidate lists and setup sweeps **and say so on-page** (the
   house rule for an absent filter), or keep them and badge them. Recommendation: exclude
   from Discovery ("a fund you cannot buy is not a candidate"), badge in the scanner.
3. **The "Tokenized" chip** (F1): populate it (USDY and any category-derived rows) or remove
   it. An empty filter must not ship.
4. **README** (F1): make the claim true or remove "tokenized assets" from the product line.

### 7C. Disclosure: a truthful label wherever a representation is shown (P0 copy, P1 component)

From the SEC IAC recommendation, ESMA's warning, the WFE letter and the exemption's own
conditions, the facts a reader must be able to see **without clicking**, per
`docs/policies/source-labeling.md` §1:

| Fact | Why |
|---|---|
| **Structure** — native / wrapped / synthetic, in those words | The single most-warned-about misunderstanding (ESMA: "generally do not confer shareholder rights") |
| **What you own** — the share, a claim on the wrapper, or price exposure | IAC: disclosure of "the ownership rights they confer" |
| **Rights** — voting, dividend handling, corporate actions | WFE: investors "miss out on voting rights, dividends and other safeguards" |
| **Eligibility** — "not offered to US persons" / "US persons via approved venues only" | Every offshore wrapper; the exemption is US-only |
| **Price basis** — venue, time, and the underlying's last close beside it; premium/discount as a `<DerivedNote>` | §4.3 "two prices"; SIFMA's fragmentation point |
| **Hours** — 24/7 vs exchange; halts follow the listing exchange or not | Exemption condition; weekend dislocations |
| **Not covered** — no SIPC / investor-compensation coverage where the issuer says so | Robinhood's own KID says it; FINRA's 2026 report asks members to disclose the same difference |

Implementation: a `<TokenizedNotice representation={…}>` in `components/ui`, **always
visible** (the ProvenanceNotice rule), plus a `GAP_REASONS` use of `by-design` for "this
representation is not shown because the viewer's jurisdiction cannot hold it" if the owner
chooses to hide rather than label (§8, decision 4). Facts only — the RP-3 line holds, and
nothing here scores or ranks.

### 7D. Pricing, hours and comparison (P1–P2)

- **Route:** `/live-data/tokenized-representations?underlying=TSLA` — reads the
  representation table, prices CoinGecko-listed rows through the existing CoinGecko client
  (verified host, attribution rule, throttle via `coingeckoThrottle.ts`), and returns each
  row with `price`, `priceAt`, `venue`, the underlying's last close from `security-quotes`,
  and a **derived** `premiumPct` labelled as computed by Finance Now. Failure boundary:
  `Promise.allSettled` per representation — they are independent.
- **Compare:** allow "TSLA vs TSLAx". The shared-trading-days caveat extends to "the token
  trades on days the underlying does not; the overlap is exchange days". Add a class profile
  for representations (F6) rather than reusing crypto's.
- **Portfolios / Watchlist (7A's DB half):** a holding that resolves to a representation is
  shown as exposure to the underlying with a wrapper caveat, counted under the underlying's
  class in the breakdown, included in look-through, and left `riskTier: null` until D18 is
  revisited — never defaulted.
- **Market hours:** a `lib/utils/marketHours.ts` that knows NYSE/Nasdaq regular hours, the
  Nasdaq 23-hour schedule from its launch date, and `24/7`/`24/5`/`issuer-window` for
  representations; the class-profile strings and Compare's caveat read from it. This is
  needed by 2026-12-06 regardless (F8).

### 7E. Risk framework — record the profile, do not build it (deferred by D18)

The dimensions serious analyses list for a tokenized security beyond the underlying's
market risk, for the day a surface is approved:

| Dimension | Source |
|---|---|
| Sponsor / wrapper counterparty and bankruptcy remoteness | WFE 2025; SEC staff taxonomy |
| Custodian | IOSCO FR/17/25 |
| Smart-contract and chain (finality, especially L2) | IOSCO; BIS FSI |
| On-chain liquidity depth and off-hours dislocation | Pine Analytics / Coin Metrics episodes |
| Redemption mechanics and peg friction (mint/redeem window) | §4.3 |
| Eligibility and regulatory basis (exemption expiry 2031) | SEC order |
| Settlement asset (stablecoin) | GENIUS timeline |
| Oracle / price-feed dependence | Chainlink/Pyth feeds |

A profile would compose these on the canonical 0–100 scale in `lib/risk/profiles/`. It
stays a spec until D18's trigger fires, and if it ever renders it is **explanation of the
representation the reader opened**, never a ranking across representations (RP-3, item 4).

### 7F. Agents, v1 API, MCP (P1)

- Prompt rule for every equity-facing agent and the assistant: when a question concerns a
  tokenized stock, state structure, rights and eligibility first; **never quote an on-chain
  token price as "the stock's price"**; name the venue and time. Same posture as the D3
  Treasury-yield rule.
- `get_security_quotes` / `GET /api/v1/securities/quotes` gain an optional
  `representations` array from 7D's route; the MCP tool description says the array is
  informational and carries eligibility. `get_coin_prices` should refuse or badge ids that
  are tokenized securities rather than price them as coins.
- Agent eval (D20): add one fixed task — "Is TSLAx the same as Tesla stock?" — so the
  worksheet catches an agent answering from its weights.

### 7G. Source terms (P0 for any new host)

- CoinGecko: already `verified`, conditional on the attribution string — no change.
- Any new host in §5 needs an entry **and a reading on the owner's machine** before a route
  fetches it; `npm run terms:report` covers the probe. The venue transaction feeds mandated
  by the exemption are the interesting case: availability is compelled, redistribution is
  not. Read each venue's terms; do not infer permission from the order.
- Issuer reference data (contract addresses, windows, eligibility) belongs in the
  hand-maintained table with `source` URLs, not in a scraper.

### 7H. Where it lives (module boundaries)

Not a new module. The representation table and its route are `lib/` core and `/live-data`
(boundary rule 2); the surfaces are a panel on `/equities/[symbol]` and `/funds/[symbol]`
(their own modules), a badge and chip in the Coins registry (crypto), and later Compare and
Portfolios (core). A "Tokenized" module with its own entitlement is a later option once the
surfaces exist and only if there is a reason to gate them separately.

### 7I. Trading — what it would take, and why not to

"Trading" would mean one of: (a) deep-linking a buy button to a venue or broker, (b) routing
orders through a broker's API, or (c) holding keys. (c) is barred by RP-5. (b) makes the app
an introducing channel for a broker-dealer — a status question for counsel, and a
multi-user deployment question that T-151 has not answered. (a) is the affiliate programme
(ROADMAP P2, gated on integrity rules) — and a link from a US-facing surface to a product
that excludes US persons is not a neutral link. The exemption gives nothing to any of the
three. Recommendation: **reaffirm analytics-only** (decision 6) and add a sentence to
the affiliate integrity rules: *no placement for a security the viewer's jurisdiction may
not hold.*

---

## 8. Owner decisions required

| # | Decision | Recommendation |
|---|---|---|
| 1 | **Adopt the SEC taxonomy (native / wrapped / synthetic) as the app's vocabulary and classify tokenized securities as their own type across the crypto module** | Yes — P0 hygiene (7B); it is the cheapest way to stop F2/F3 recurring |
| 2 | **Build the representation table now, pre-rollout, or wait for T-151?** | Build the table and the notice now (small, pure, tested); defer the DB half and Portfolios until a user can hold one knowingly |
| 3 | **Which surfaces show representations first?** | Equity and fund detail panel; Coins badge. Compare and Portfolios second |
| 4 | **Eligibility display policy: show non-US-only products with a notice, or hide them from US-facing surfaces?** | Show with the notice (information is not solicitation), never with a purchase path; hide only if counsel says otherwise |
| 5 | **Risk profile for representations** | D18 stands; 7E is recorded as a spec, not built |
| 6 | **Trading posture** | Reaffirm analytics-only explicitly, and add the affiliate exclusion in 7I |
| 7 | **Market-hours utility before 2026-12-06** | Yes, independent of tokenization |
| 8 | **Owner-machine probes in §10** | Run before filing any of §9 — they decide whether F3 is live today |

---

## 9. Proposed work items — for the scout to file, not filed here

Per `docs/IMPROVEMENT-AGENT-SETUP.md` the queue changes only through the propose → approve
→ file flow, so nothing below is in `TASK-QUEUE.md`. Each row was checked against
`docs/audits/rejected-proposals.md` (RP-1…RP-6): none publishes a score, ranks a universe,
adds a paid tier, or touches key custody. IDs are provisional.

| ID | Item | Priority | Size | Depends on |
|---|---|---|---|---|
| TS-1 | USDY: `assetType: 'tokenized'`; accrual modelled as accrual, not depeg; test that no accruing instrument carries a `pegTarget` | P0 | S | — |
| TS-2 | Coins "Tokenized" chip: populate from TS-1 + category-derived rows, or remove; test that every chip value has ≥1 possible match | P0 | S | TS-1 |
| TS-3 | `classifyUtility`: `tokenized-security` bucket via CoinGecko category membership; Discovery excludes it and says why on-page; scanner badges it | P0 | S–M | §10 probe |
| TS-4 | README product line: make "tokenized assets" true or remove it | P0 | XS | TS-1 |
| TS-5 | `lib/data/tokenizedRepresentations.ts` with provenance, `source`+`verifiedAt` test, staleness clock (7A) | P1 | M | decision 1–2 |
| TS-6 | `<TokenizedNotice>` (7C), always visible; gap-reason usage for hidden rows | P1 | S | TS-5 |
| TS-7 | `/live-data/tokenized-representations` route; premium/discount as `<DerivedNote>` (7D) | P1 | M | TS-5, `dataSources.ts` entry |
| TS-8 | Equity and fund detail "Tokenized representations" panel | P1 | M | TS-6, TS-7 |
| TS-9 | `lib/utils/marketHours.ts`; class profiles and Compare caveat read from it (7D, F8) — **needed by 2026-12-06** | P1 | M | — |
| TS-10 | Compare: representation class profile; TSLA vs TSLAx with the overlap caveat | P2 | M | TS-7, TS-9 |
| TS-11 | Portfolios / Watchlist representation-aware resolution and breakdown; DB extension table | P2 | L | TS-5, decision 2 |
| TS-12 | Agents / v1 API / MCP awareness; one agent-eval task (7F) | P1 | S–M | TS-7 |
| TS-13 | News taggers: tokenization regex → underlying tickers + category; Clarity Act mapping widened | P2 | S | — |
| TS-14 | Source-terms readings for rwa.xyz, chain.link, issuer pages, TSV feeds — owner machine | P1 | S each | — |
| TS-15 | Risk-profile spec for representations, recorded under `docs/architecture/risk-framework.md`, not built (7E) | P2 | S | D18 |
| TS-16 | Affiliate integrity rule: no placement for a security the viewer's jurisdiction may not hold (7I) | P1 | XS | decision 6 |
| TS-17 | Regulatory-watch entries for §3.3's dates in the steward's ledger; re-read this document at each | P1 | XS | — |

---

## 10. Verification that needs the owner's machine

This sandbox could not reach CoinGecko or DefiLlama (403 at the egress proxy), so the two
facts that decide whether F3 is live today are unmeasured. PowerShell-safe forms, per
CLAUDE.md's `curl.exe` rule:

```powershell
# 1. Which tokenized-asset categories exist, and their ids (confirm §5's ids)
curl.exe -s "https://api.coingecko.com/api/v3/coins/categories/list" |
  Select-String -Pattern 'tokeniz|xstocks|robinhood' -AllMatches

# 2. Which tokenized securities sit inside the scanner's top-750 universe today
curl.exe -s "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=tokenized-stock&order=market_cap_desc&per_page=100"
curl.exe -s "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=tokenized-products&order=market_cap_desc&per_page=100"
#    → compare each market_cap_rank against 750 (coin-list) and 250 (coin-discovery default)

# 3. USDY's live price, to confirm the accrual (expect > 1.00 and rising, not a depeg)
curl.exe -s "https://api.coingecko.com/api/v3/simple/price?ids=ondo-us-dollar-yield&vs_currencies=usd"
```

Respect the CoinGecko pacing note in CLAUDE.md — three calls a minute apart is plenty. Record
the result as a dated audit file, not by editing this one.

---

## 11. Legal questions to route (not answered here)

1. **Does showing a security the viewer cannot buy create any obligation?** Working
   assumption: information with a truthful eligibility label is not an offer or solicitation;
   a purchase link is a different act. Counsel should confirm for a public deployment (T-151).
2. **Is on-chain price data for a security "market data" in the licensed sense?** It is not
   exchange data (no SIP, no exchange licence), but each venue's and feed operator's terms
   govern redistribution — the same reading discipline as every other host.
3. **Does the RP-3 line (explanation, not recommendation) hold for a premium/discount
   figure?** It is arithmetic on two published prices, like Sharpe — the D14 distinction
   between "traditional financial formulas" and editorial composites — so the working answer
   is yes, provided it is labelled derived and never framed as "cheap"/"expensive".
4. **Affiliate placements for products that exclude US persons** — see 7I.
5. **If trading is ever wanted**, the questions are broker-dealer / introducing-broker
   status, RP-5's reversal conditions (encrypted custody design), and T-151 first.

`docs/LEGAL-REVIEW.md` §G carries these forward.

---

## 12. Sources

Primary URLs are listed first in each group; secondary sources after. None were opened from
this environment — see the banner at the top.

**SEC and US regulators**
- SEC press release 2026-90, Innovation Exemption (2026-09-17): https://www.sec.gov/newsroom/press-releases/2026-90-sec-issues-innovation-exemption-facilitate-trading-tokenized-nms-stock-request-comment
- Chairman Atkins, "A Bridge Toward Durable Rulemaking" (2026-09-17): https://www.sec.gov/newsroom/speeches-statements/atkins-innovation-exemption-bridge-toward-durable-rulemaking-091726
- Commissioner Uyeda statement (2026-09-17): https://www.sec.gov/newsroom/speeches-statements/uyeda-statement-innovation-exemption-091726
- SEC staff statement on tokenized securities (2026-01-28): https://www.sec.gov/newsroom/speeches-statements/corp-fin-statement-tokenized-securities-012826-statement-tokenized-securities
- Investor Advisory Committee recommendation (approved 2026-03-12): https://www.sec.gov/files/recommendation-tokenization-equity-securities.pdf
- Nasdaq approval order, Rel. 34-105047: https://www.sec.gov/files/rules/sro/nasdaq/2026/34-105047.pdf ; Federal Register notice (2026-01-30): https://www.federalregister.gov/documents/2026/01/30/2026-01823/self-regulatory-organizations-the-nasdaq-stock-market-llc-notice-of-filing-of-a-proposed-rule-change
- NYSE SR-NYSE-2026-17: https://www.sec.gov/rules-regulations/self-regulatory-organization-rulemaking/sr-nyse-2026-17 ; NYSE Arca SR-NYSEARCA-2026-45, NYSE American SR-NYSEAMER-2026-36 (same site)
- Nasdaq 23-hour trading approval, Rel. 34-105199: https://www.sec.gov/files/rules/sro/nasdaq/2026/34-105199.pdf ; Federal Register (2026-04-15): https://www.federalregister.gov/documents/2026/04/15/2026-07259/
- Trading & Markets custody statement (2025-12-17): https://www.sec.gov/newsroom/speeches-statements/trading-markets-121725-statement-custody-crypto-asset-securities-broker-dealers ; Peirce, "No Longer Special": https://www.sec.gov/newsroom/speeches-statements/peirce-121725-no-longer-special-statement-division-trading-markets-statement-related-custody-crypto-asset
- SEC proposed Regulation Crypto Assets (2026-08-21): https://www.sec.gov/newsroom/press-releases/2026-76-sec-proposes-new-regulation-crypto-assets
- SIFMA memo to the Crypto Task Force (2025-09-10): https://www.sec.gov/files/ctf-memo-sifma-091025.pdf ; Coinbase written input (2026-04-01): https://www.sec.gov/files/ctf-written-input-coinbase-global-inc-040126.pdf
- Galaxy/Superstate launch, 8-K exhibit: https://www.sec.gov/Archives/edgar/data/1859392/000185939225000052/galaxyxsuperstateoblaunchf.htm
- IRS Form 1099-DA instructions (2026): https://www.irs.gov/instructions/i1099da
- GENIUS Act NPRM, Federal Register (2026-08-18): https://www.federalregister.gov/documents/2026/08/18/2026-16796/genius-act-regulations-on-payment-stablecoin-issuance-offer-and-sale ; Treasury release: https://home.treasury.gov/news/press-releases/sb0605 ; OCC Bulletin 2026-3: https://www.occ.gov/news-issuances/bulletins/2026/bulletin-2026-3.html
- H.R. 3633 text: https://www.congress.gov/bill/119th-congress/house-bill/3633/text
- FINRA 2026 Annual Regulatory Oversight Report: https://www.finra.org/rules-guidance/guidance/reports/2026-finra-annual-regulatory-oversight-report

**Secondary (US)**
- Sullivan & Cromwell memo (Sept 2026): https://www.sullcrom.com/insights/memo/2026/September/SEC-Issues-Innovation-Exemption-for-Tokenized-Securities
- Jones Day (Sept 2026): https://www.jonesday.com/en/insights/2026/09/the-secs-new-innovation-exemption-fiveyear-relief-for-trading-on-tokenized-securities-venues
- Markets Media (conditions): https://www.marketsmedia.com/sec-issues-innovation-exemption-for-trading-tokenized-nms-stock/
- CoinDesk (2026-09-17): https://www.coindesk.com/policy/2026/09/17/sec-rolls-out-long-awaited-innovation-exemption-for-tokenized-securities-venues and https://www.coindesk.com/business/2026/09/17/sec-opens-door-to-tokenized-u-s-stock-trading-here-s-who-could-benefit
- SIFMA statement on the exemption: https://www.sifma.org/news/press-releases/sifma-statement-on-sec-innovation-exemption
- Securities Lawyer 101 (release number; OTC exclusion): https://www.securitieslawyer101.com/2026/09/17/sec-innovation-exemption-tokenized-stock-trading/ and https://www.securitieslawyer101.com/2026/09/18/sec-tokenized-stocks-exemption-otc-markets/
- Dechert on the Nasdaq approval: https://www.dechert.com/knowledge/onpoint/2026/3/sec-issues-landmark-interpretation-on-the-application-of-federal.html ; Free Writings & Perspectives: https://www.freewritings.law/2026/03/sec-approves-nasdaq-rule-change-enabling-trading-of-certain-tokenized-securities/ and https://www.freewritings.law/2026/04/nyse-rule-change-enabling-trading-of-tokenized-securities/
- DTC no-action letter: Carlton Fields https://www.carltonfields.com/insights/publications/2025/sec-staff-no-action-letter-to-dtc-for-tokenization-services ; Morgan Lewis https://www.morganlewis.com/pubs/2026/01/new-sec-guidance-provides-regulatory-pathway-for-dtc-securities-tokenization-services ; rollout timing [reported]: https://www.kucoin.com/news/flash/dtcc-to-launch-blockchain-based-securities-tokenization-pilot-in-2026
- Staff taxonomy statement summaries: MoFo https://www.mofo.com/resources/insights/260129-sec-staff-statement-on-tokenized-securities-innovation ; Dechert https://www.dechert.com/knowledge/onpoint/2026/2/sec-staff-maps-tokenization-models--tokenized-securities-are-sti.html ; Cleary https://www.clearygottlieb.com/news-and-insights/publication-listing/sec-staff-issues-guidance-on-tokenized-security-taxonomies
- IAC recommendation coverage: CoinDesk https://www.coindesk.com/policy/2026/03/12/sec-s-advisory-group-backs-push-for-tokenized-securities-outlines-how-to-keep-it-safe
- CLARITY Act: CNBC https://www.cnbc.com/2026/09/15/senate-cloture-vote-on-clarity-act-fails-dealing-regulatory-setback-to-crypto-industry.html ; CoinDesk https://www.coindesk.com/policy/2026/08/05/here-are-the-possible-outcomes-for-clarity-right-now ; Latham tracker https://www.lw.com/en/us-crypto-policy-tracker/legislative-developments
- Nasdaq 23-hour trading: Arnold & Porter https://www.arnoldporter.com/en/perspectives/advisories/2026/04/sec-approves-nasdaq-proposal-to-expand-trading-hours ; launch date [reported] https://news.bitcoin.com/finance/nasdaq-23-hour-trading-december-2026-launch/
- Securitize FINRA approval: The Block https://www.theblock.co/news/regulation/2026-05-04-finra-green-lights-securitize-for-tokenized-ipo-underwriting-and-custody-399895
- T&M FAQ summaries: Katten https://quickreads.ext.katten.com/post/102kbe2/secs-division-of-trading-and-markets-issues-new-faq-guidance-on-broker-dealer-cu ; Dechert https://www.dechert.com/knowledge/onpoint/2026/1/sec-staff-clarifies-broker-dealer-custody-and-trading-of-crypto-.html
- GENIUS effective date: https://astraea.law/insights/genius-act-effective-date-countdown
- Tax: The Tax Adviser https://www.thetaxadviser.com/issues/2025/nov/digital-asset-transactions-broker-reporting-amount-realized-and-basis/
- UCC Article 12: ABA https://www.americanbar.org/groups/business_law/resources/business-law-today/2026-january/2022-ucc-revisions-unlock-digital-assets-potential/ ; Cleary (NY) https://www.clearygottlieb.com/news-and-insights/publication-listing/new-york-enactment-of-2022-ucc-amendments-for-digital-assets-and-emerging-technologies
- FINRA report summaries: Sidley https://www.sidley.com/en/insights/newsupdates/2025/12/finra-issues-2026-regulatory-oversight-report

**Products and venues**
- Kraken xStocks FAQ and availability: https://support.kraken.com/articles/xstocks-faq ; https://support.kraken.com/articles/xstocks-availability ; volume: https://blog.kraken.com/product/xstocks/25-billion-in-total-transaction-volume ; 100 assets: https://blog.kraken.com/product/xstocks/celebrating-100-xstocks
- LSEG press release (2026): https://www.lseg.com/en/media-centre/press-releases/2026/london-stock-exchange-launches-uk-tokenised-equity-structures-and-announces-partnership-with-payward ; Bloomberg (2026-09-01): https://www.bloomberg.com/news/articles/2026-09-01/lse-to-roll-out-tokenized-stocks-in-push-into-digital-assets
- Robinhood: About Stock Tokens https://www.robinhood.com/eu/en/support/articles/about-stock-tokens ; EU KID https://cdn.robinhood.com/assets/robinhood/legal/stock_tokens_kid_eu.pdf ; Robinhood Chain launch and ownership caveat https://www.techtimes.com/articles/319564/20260702/robinhood-chain-goes-live-tokenized-stocks-key-ownership-caveat.htm ; US prediction https://www.fool.com/investing/2026/09/21/prediction-robinhood-will-launch-tokenized-stock-trading-in-the-u-s-before-the-end-of-2027/
- Coinbase: CoinDesk (2026-08-24) https://www.coindesk.com/business/2026/08/24/coinbase-debuts-tokenized-stocks-on-base-network-joining-race-to-bring-equities-on-blockchain ; (2026-06-16) https://www.coindesk.com/business/2026/06/16/coinbase-to-join-tokenized-stock-race-with-onchain-shares-dividend-payments ; The Defiant https://thedefiant.io/news/defi/coinbase-launches-tokenized-stocks-on-base
- Ondo: $1B TVL release https://www.prnewswire.com/news-releases/ondo-global-markets-surpasses-1-billion-in-total-value-locked-a-first-for-tokenized-stocks-302768520.html ; Ondo Stocks https://ondo.finance/ondo-stocks ; rebrand and 24/7 windows https://genfinity.io/2026/07/13/ondo-global-markets-becomes-ondo-stocks-tokenized-equities-leader/
- Dinari: 724 stocks for US investors https://www.prnewswire.com/news-releases/in-an-industry-first-dinari-launches-724-tokenized-stocks-available-to-both-us-investors-and-businesses-302842099.html ; CoinDesk https://www.coindesk.com/business/2026/08/04/dinari-brings-tokenized-u-s-stocks-to-american-investors-as-equity-race-heats-up ; dShares https://dinari.com/dshares
- Superstate: Opening Bell https://superstate.com/opening-bell ; GLXY https://superstate.com/assets/glxy ; Davis Polk https://www.davispolk.com/experience/galaxy-launches-glxy-tokenized-public-shares-solana
- Tokenized funds: Franklin SAI https://www.franklintempleton.com/forms-literature/download-preview/9001-SAI ; The Block (2026-08-12) https://www.theblock.co/news/defi/2026-08-12-sec-clears-franklin-templeton-funds-use-onchain-benji-system-cash-management-411654 ; ARK tokenized class https://www.kucoin.com/news/flash/ark-investment-management-seeks-sec-approval-for-tokenized-share-class ; BUIDL/BENJI structure (secondary) https://astraea.law/insights/tokenized-treasury-funds-securities-compliance-2026
- Market data: RWA.xyz stocks https://app.rwa.xyz/stocks ; treasuries https://app.rwa.xyz/treasuries ; holders/volume https://finance.yahoo.com/markets/crypto/articles/tokenized-stocks-now-nearly-3-110835202.html ; market cap https://cryptobriefing.com/tokenized-stocks-hit-3b-market-cap-etfs-644m/ ; RWA total (secondary) https://eco.com/support/en/articles/15254020-tokenized-rwa-market-size-2026-20b-aum-growth-trajectory ; CoinGecko 2026 RWA Report https://assets.coingecko.com/reports/2026/CoinGecko-2026-RWA-Report.pdf
- Pricing mechanics: Pine Analytics https://pineanalytics.substack.com/p/tokenized-equities-on-solana ; Coin Metrics SOTN #341 https://coinmetrics.substack.com/p/state-of-the-network-issue-341 ; CMC Research https://coinmarketcap.com/events/tokenized-stocks-cex-vs-onchain/
- CoinGecko categories and API how-to: https://www.coingecko.com/learn/track-tokenized-stocks-rwa-data ; https://www.coingecko.com/en/categories/tokenized-stock ; https://www.coingecko.com/en/categories/xstocks-ecosystem ; https://www.coingecko.com/en/categories/tokenized-products
- Chainlink: Backed feeds https://backed.fi/news-updates/chainlink-price-feeds ; 24/5 equity feeds https://finance.yahoo.com/news/chainlink-launches-24-5-price-040708261.html

**Non-US and international**
- ESMA DLT Pilot review (2025-06-25): https://www.esma.europa.eu/sites/default/files/2025-06/ESMA75-117376770-460_Report_on_the_functioning_and_review_of_the_DLTR_-_Art.14.pdf ; press https://www.esma.europa.eu/press-news/esma-news/esma-suggests-amendments-dlt-pilot-regime-make-it-permanent ; DLA Piper https://www.dlapiper.com/en/insights/publications/2025/07/esma-suggests-amendments-to-the-dlt-pilot-regime-to-make-it-permanent-and-attractive
- ESMA warning on tokenised stocks (Reuters, Sept 2025): https://www.investing.com/news/stock-market-news/european-regulator-says-tokenised-stocks-risk-investor-misunderstanding-4218193
- WFE letter (Aug 2025): https://crypto.news/global-stock-exchanges-call-on-regulators-to-crack-down-on-tokenised-stocks/
- UK DSS: FCA https://www.fca.org.uk/firms/innovation/digital-securities-sandbox ; BoE dashboard https://www.bankofengland.co.uk/financial-stability/digital-securities-sandbox/digital-securities-sandbox-dashboard ; Latham UK tracker https://www.lw.com/en/uk-cryptoasset-regulatory-tracker
- Switzerland: FINMA SDX approval (2021) https://www.finma.ch/en/news/2021/09/finma-issues-first-ever-approval-for-a-stock-exchange-and-a-central-securities-depository-for-the-trading-of-tokens/ ; SIF DLT page https://www.sif.admin.ch/en/dlt-blockchain-en ; SDX–SIS merger [reported] https://swisstoken.substack.com/p/one-plug-to-two-worlds-six-sdx-sis
- Hong Kong: HKMA EnsembleTX (2025-11-13) https://www.hkma.gov.hk/eng/news-and-media/press-releases/2025/11/20251113-3/ ; 24/7 authorised products [reported] https://www.cryptopolitan.com/hong-kong-24-7-markets-tokenized-products/
- Singapore: MAS (2024-11) https://www.mas.gov.sg/news/media-releases/2024/mas-announces-plans-to-support-commercialisation-of-asset-tokenisation ; Guardian funds https://www.mas.gov.sg/-/media/mas-media-library/development/fintech/guardian/project-guardian-operationalising-tokenised-funds.pdf
- IOSCO FR/17/25 (2025-11): https://www.iosco.org/library/pubdocs/pdf/IOSCOPD809.pdf ; BIS FSI summary https://www.bis.org/fsi/fsisummaries/exsum_23905.htm ; IMF Notes 2026/001 https://www.elibrary.imf.org/view/journals/068/2026/001/article-A001-en.xml
