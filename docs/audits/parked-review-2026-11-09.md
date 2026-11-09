# Review of every parked and blocked item — 2026-11-09

The owner asked to "take another look at parked and blocked items" (after D215). This is the
record of that review: what each of the 137 items waits on, checked against the tree and
the decisions made since it was parked, and what the owner decided (D216 to D219,
`docs/decisions/2026-11-09-owner-decisions.md`).

**Method.** Each item's `next_action` and `blocking_decision` were read against the decisions
since its `parked_on` date, and the claims that would change its state were checked in the
tree: the options calculator's leg limit and presets (`MAX_LEGS = 4`), the L2 RPC hosts'
terms entries (verified 2026-10-14, D105), the /api/v1 key and limit (`lib/server/apiKeys.ts`,
D173), D92's ruling on bond, fund and futures ratings, and the notes T-312 and T-246 asked
for. The ledger page's workspace log held nothing newer than the ledger itself. The one price
condition (T-393: Bitcoin above $126,300) read about $74,600 on Crypto.com's public ticker that
day, so it has not fired.

**What changed.** Four groups were put to the owner: the options follow-ups that no longer
waited on anything (D216), live L2 gas (D217), three risk-score items with no surface left
(D218), and ten items whose wording was out of date (D219). One claim in that last question
was wrong: the note T-246 asks for was never written. T-246 was left as it was and raised
with the owner. Every other item stays parked or blocked as it was.

## Acted on today (D216 to D219) (8)

The owner's answers to the four questions. Closed: T-061, T-062 (built on the calculator), T-352, T-353, T-355 (superseded by D92). Re-parked with the reason: T-057, T-060, T-063. Reworded: T-026, T-088, T-094, T-113, T-188, T-191, T-192, T-312, T-315 (listed in their own groups below).

| Item | Title | State after the review |
|---|---|---|
| T-061 | S4 — UI parity with the API (8 legs, more presets) | closed (close) |
| T-062 | S4 — what-if sliders (IV / underlying move) | closed (close) |
| T-352 | Bond profile follow-up — scale duration by realized rate volatility | closed (superseded) |
| T-353 | ETF/fund risk profile (fund.ts) | closed (superseded) |
| T-355 | Futures position risk profile | closed (superseded) |
| T-057 | Live L2 gas (Arbitrum/Optimism/Base) via GasPriceOracle predeploy + Fjord size model | parked |
| T-060 | S4 first decision — do saved options positions join the DB? | parked |
| T-063 | S4 — plain-language explanations per risk dimension | parked |

## Choosing a host and setting up the live site (25)

All wait on T-112 (the host; the brief is docs/deployment/hosting-brief-2026-10-26.md) or on the rollout gate that follows it.

| Item | Title | State after the review |
|---|---|---|
| T-112 | Choose and set up the deployment target, rate limiting and monitoring | parked |
| T-204 | Put a web firewall in front of the live site, using what the chosen host offers | parked |
| T-205 | Record changes to the hosting account and alert on suspicious activity, using what the chosen host offers | parked |
| T-341 | Turn on automatic database backups on the chosen host (7-day minimum; on AWS, RDS) | parked |
| T-342 | Confirm the hosted site's security certificate renews itself (on AWS with Kubernetes, cert-manager) | parked |
| T-363 | Set up a test copy of the site (staging) on the chosen host | parked |
| T-365 | Decide what to spend on hosting, with the host (AWS: about $1,350 a month per copy at the committed defaults) | parked |
| T-366 | Decide whether to provision production or stop at staging | parked |
| T-367 | Set SLACK_BOT_TOKEN, SLACK_DEPLOY_CHANNEL_ID, STAGING_SMOKE_TEST_KEY secrets | parked |
| T-368 | Check the test copy works and watch an automatic update reach it | parked |
| T-378 | Replace financenow.example.com placeholders once a real domain exists | parked |
| T-379 | Provision or descope incident escalation paths (PagerDuty, client email, tickets) | parked |
| T-189 | Enforce SSL/TLS everywhere (sslmode=require) | parked |
| T-339 | Set fresh production secrets for the app (AUTH_SECRET, FN_ADMIN_TOKEN) when the site is first hosted | parked |
| T-340 | Enter real provider keys on the hosted site through its secret store or the Integrations page | parked |
| T-260 | L8 reopen — revisit apiGuard Host/x-forwarded-for trust behind a non-normalizing proxy | parked |
| T-200 | SOC 2 — secrets rotation policy | parked |
| T-207 | SOC 2 — business continuity / DR plan with RTO/RPO | parked |
| T-208 | SOC 2 — automated backup verification drills | parked |
| T-195 | Multi-region deployment | parked |
| T-237 | Decide whether the tag-triggered CD pipeline should be live (0 tags) | parked |
| T-134 | Go/no-go gate: Phase 0 (auth + multi-tenant + hosted) complete before marketing | parked |
| T-077 | P3-W3 rollout gate — not yet run; owner said not ready (2026-09-05) | parked |
| T-324 | Add the proposed release-gate checker agent | parked |
| T-311 | Post-launch go/no-go metric milestones | parked |

## Sign-in, accounts and per-user access (11)

Wait on turning sign-in on at launch (T-131).

| Item | Title | State after the review |
|---|---|---|
| T-131 | Re-enable the Auth.js login wall (fix the wrong recipe, set AUTH_SECRET, REQUIRE_AUTH via middleware) | parked |
| T-132 | Goal B step 5 — disable local-user mode in production and add a signup UI | parked |
| T-133 | Goal B step 6b — password reset flow | parked |
| T-115 | Auth.js OAuth providers via @auth/drizzle-adapter (Goal B 6c) | parked |
| T-113 | Extend /api/v1 + MCP to personal data behind per-user API keys | parked |
| T-088 | Phase 6 hardening — 2FA, rate limiting on /api/v1, audit logging | parked |
| T-191 | Per-API-key IP allowlist enforcement | parked |
| T-185 | Risk C — WORM append-only audit log trigger | parked |
| T-209 | MFA enforcement for all admin accounts | parked |
| T-206 | Penetration test before production launch | parked |
| T-309 | Move provider config/keys from local JSON to per-user encrypted DB storage | parked |

## Pricing, billing and business tiers (16)

Wait on the paid-versus-free decision and the billing model (T-083, T-085), and, for the enterprise items, D5's trigger: the first paying customer or enterprise conversation.

| Item | Title | State after the review |
|---|---|---|
| T-083 | D1 — rollout posture on entitlements: serve from DB instead of localStorage | parked |
| T-084 | Phase 6 — entitlement issuance + Stripe billing writing the entitlements table | parked |
| T-085 | Decide billing model: per-module licences vs tiered bundles | parked |
| T-086 | Decide freemium pricing tiers and turn on a Pro tier | parked |
| T-188 | Risk F — API usage metering for billing | parked |
| T-192 | Plan-based rate limit tiers | parked |
| T-094 | Package /api/v1 + MCP as a product for agent builders | parked |
| T-190 | SSO — SAML 2.0 / OIDC | parked |
| T-193 | Signed audit log export | parked |
| T-194 | Custom alerting webhooks (SIEM) | parked |
| T-212 | Enterprise — SLA documentation | parked |
| T-213 | Enterprise — data-residency region selector | parked |
| T-214 | Enterprise — dedicated environments / tenant isolation | parked |
| T-215 | Enterprise — API versioning / deprecation policy | parked |
| T-216 | Enterprise commercial requirements (DPA, MSA, questionnaire, pentest report, insurance) | parked |
| T-217 | Enterprise operational requirements (CS, SLA dashboard, support, onboarding) | parked |

## Paid data plans near release (D21) (10)

Whatever a paid plan cures waits until near release.

| Item | Title | State after the review |
|---|---|---|
| T-076 | DATA-AVAILABILITY item 9 — paid FMP plan or a different Stock Registry universe source | parked |
| T-075 | Restore fund return screening/sorting if a batched FMP tier is bought (D2 / 12b) | parked |
| T-010 | Futures term structure (P2-O4 / NT8) has no source — keyed provider decision | parked |
| T-314 | At release: buy paid provider plans / commercial data licences so nothing renders blank | parked |
| T-315 | Plan upstream rate-limit mitigation (shared cache, paid tiers) | parked |
| T-383 | Wire the paid FMP rung of the IPO calendar once a live response is read | parked |
| T-387 | Coins technical screener — server-side snapshot past ~250 coins on a paid tier | parked |
| T-390 | Verify ICE (.NYB) and CME (.CME) contract-month suffixes in termStructure | parked |
| T-440 | Re-read the fund catalog’s approximate figures: 87 yields and 28 undated asset figures | parked |
| T-154 | FMP rollout-scope decision on market-calendar and stock-universe if the reading is restrictive | parked |

## The hidden pages: Transfer Fees, Wallets, Backtests (30)

Kept, not deleted; each waits on the owner restoring its page. The fee checks are worked on the Transfer Fee Check page (T-031, D52) whenever the owner chooses.

| Item | Title | State after the review |
|---|---|---|
| T-028 | Transfer Fees withheld from rollout (S3) — four-surface restore recipe | parked |
| T-029 | Revert test-live-data transfer-route 503 assertions when Transfer Fees is restored | parked |
| T-030 | Wallets page hidden from rollout — restore recipe | parked |
| T-016 | P3-W2-S1 backtests SUSPENDED — restore recipe for all three hidden surfaces | parked |
| T-031 | Manual withdrawal-fee worksheet pass over the 428 unreached rows (CORE 45 first) and move TRANSFER_FEES_LAST_VERIFIED | parked |
| T-036 | Verify SPOT_TRADING_FEES seeded maker/taker rates (LOW confidence) per exchange | parked |
| T-038 | Re-check Bitfinex trading fees (reportedly 0%/0% since 2025-12-17) | parked |
| T-039 | Re-check Hyperliquid fee tier framing (table looks like $25M+ tier) | parked |
| T-040 | Re-check Coinbase Advanced entry-tier maker/taker | parked |
| T-041 | Re-check Gate.io fee section after the 2026-04-09 update | parked |
| T-042 | Check whether Kraken ERC-20 withdrawal fees are dynamic; add notes | parked |
| T-043 | Check MATIC→POL migration across exchange rows | parked |
| T-045 | Close Gemini 'legacy free-tier' caveat on remaining zero-fee rows | parked |
| T-046 | Re-check Upbit BTC withdrawal fee (0.0005 vs 0.0009) | parked |
| T-047 | Extend Upbit trading-fee note with the 0.25% BTC/USDT-market rate if verified | parked |
| T-049 | Re-check Bybit ETH/erc20 0.005 fee and 'free via Mantle' note | parked |
| T-050 | Distinguish Crypto.com App vs Exchange fee schedules on the re-run | parked |
| T-052 | Re-confirm Kraken has no BEP-20 support | parked |
| T-053 | Verify OKX dynamic BTC/ETH withdrawal-fee notes | parked |
| T-056 | Hand-verify the two held-back zero-fee rows (Bitfinex DOT, Bitget USDC/BEP-20) | parked |
| T-032 | S3 build-out — route fee history | parked |
| T-033 | S3 build-out — fee alerts | parked |
| T-034 | S3 — spread modelling for zero-commission venues needs a data-source decision | parked |
| T-035 | S3 build-out — more exchanges/networks (curated rows only) | parked |
| T-058 | Federal sale-tax estimator (tax panel part 2) — surface the legality question first | parked |
| T-122 | Extend affiliate links to the Transfer Fee Calculator | parked |
| T-312 | Decide whether the transfer-fee optimizer is still the free-tier wedge | parked |
| T-313 | Content/SEO route-cost pages per exchange pair | parked |
| T-428 | After launch: rebuild Transfer Fees from live fee feeds instead of a hand-checked table | parked |
| T-055 | Flip TAX_GUIDANCE_REVIEW from seeded to verified after reading primary tax sources | parked |

## Forming the business, legal, insurance and SOC 2 (18)

The owner's own steps, mostly at the rollout date. Two need no launch: T-425 (send the DefiLlama enquiry, already drafted) and, from T-209 in the sign-in group, two-step sign-in on GitHub.

| Item | Title | State after the review |
|---|---|---|
| T-287 | Registered agent, EIN, state of formation, operating agreement | parked |
| T-288 | Open business bank account and separate bookkeeping | parked |
| T-290 | Decide which countries can access which product | parked |
| T-295 | Build the owner's tax/TIN/compliance deadline tracker | parked |
| T-296 | Bookkeeping in place before the first affiliate payout | parked |
| T-297 | Annual entity filings / franchise tax calendar | parked |
| T-427 | Buy insurance before the first outside visitor: tech E&O, media liability and cyber | parked |
| T-425 | Send the data-provider enquiries: DefiLlama now; FMP, CoinDesk, Investing.com and Tiingo near build completion | parked |
| T-196 | SOC 2 — engage an auditor | parked |
| T-197 | SOC 2 — document data flows and system inventory | parked |
| T-198 | SOC 2 — formal access control policy | parked |
| T-201 | SOC 2 — sign off the incident response runbook | parked |
| T-202 | SOC 2 — change management policy | parked |
| T-203 | SOC 2 — vendor risk assessments (CoinGecko, DefiLlama, Chainlink) | parked |
| T-210 | SOC 2 Phase 3 — evidence collection through Type I | parked |
| T-211 | SOC 2 Phase 4 — continuous monitoring through Type II | parked |
| T-125 | Affiliate legal review — FTC disclosure + other jurisdictions (UK FCA) | parked |
| T-120 | Review each affiliate program's terms (app placement, comparison tables, ranking) and open links in the system browser | parked |

## After launch (4)

Affiliate links wait on D49 being revisited; Reddit on applying for its Data API with a live app.

| Item | Title | State after the review |
|---|---|---|
| T-123 | Affiliate signups on Coin Registry / Wallets | parked |
| T-124 | Brokerage referrals on Equities/Funds — only if program terms allow a research context | parked |
| T-245 | Reddit — decide whether to register OAuth and set REDDIT_CLIENT_ID to lift the robots gate | parked |
| T-246 | Restore Reddit vote metrics on crypto Social via JSON endpoints | parked |

## Scope questions for the owner, not tied to launch (13)

Answered only when the owner takes them up. The S5 ones (T-026, T-064, T-067, T-068, T-116) also wait on the legal review (D4).

| Item | Title | State after the review |
|---|---|---|
| T-013 | Options/futures positions as portfolio holdings — deferred | parked |
| T-014 | Brokerage linkage / order routing — scope decision (read-only sync vs execution) | parked |
| T-015 | Separate derivatives module/entitlement — revisit only if options on futures matter | parked |
| T-009 | Settle the delayed-data convention before any keyed chain route ships | parked |
| T-026 | W3-10 — owner to activate and prioritise S3–S6 charters (S4/S5 first decisions) | blocked |
| T-064 | S5 first decision — scope boundary vs the departed personal-finance product | blocked |
| T-067 | S5 — contribution modeling (gated on scope decision) | blocked |
| T-068 | S5 — taxable-vs-sheltered asset location (gated on scope decision) | blocked |
| T-116 | Portfolio Builder rebalance reminders need a notifications mechanism | blocked |
| T-161 | Recover the retirement engine from archive/wave-two-pre-reset if the separate tool wants it | parked |
| T-160 | Export retained budget DB tables / bank history to the separate personal-finance tool | parked |
| T-127 | Decide the desktop update mechanism and whether updates are monetized | parked |
| T-457 | Let the AI see the Funds module and the Reserve Monitor: agent tools for a fund’s filed details and for stablecoin reserves, then the same on /api/v1 and the MCP server | parked |

## Dated (2)

Each has its own date or price to watch.

| Item | Title | State after the review |
|---|---|---|
| T-372 | Sunset CAEP_* env fallbacks and caep:* localStorage shims (mid-2027) | parked |
| T-393 | Close out the 2024 cycle row in CYCLE_HISTORY once its trough is final | parked |

