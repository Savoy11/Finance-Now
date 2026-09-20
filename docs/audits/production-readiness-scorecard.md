# Finance Now — Production Readiness Scorecard

> **Scope correction, 2026-09-20.** This scorecard's scope line reads "Full-stack
> (backend API, scoring engine, data pipelines, infrastructure, frontend)", and sixteen
> of its eighteen findings cite that backend's source by path. (The two that do not:
> #15 cites only the docker/k8s manifests, and #5 names two config settings and no file.
> #9 cites both — the manifests *and* `rate_limiter.py:88` / `auth.py:240`.) **That
> backend was retired on 2026-09-14** — owner decision D2,
> `docs/decisions/2026-09-14-owner-decisions.md:37`. It is **frozen, not deleted**
> (`backend/FROZEN.md`), so every file cited below still exists, and — after the three
> corrections listed at the end of this banner — still reads as described. But nothing
> in the shipping app calls it, and `.github/workflows/ci.yml` no longer builds or tests
> it (`backend-lint` and `backend-test` were removed the same day; see the comment at
> `ci.yml:28`).
>
> **Retired and never-built are different states, and this document contains one of
> each.** The backend was built and it ran; a decision stopped it. The AWS
> infrastructure the roadmaps below assume was **never provisioned** — and "never
> provisioned" covers two different things here, which is worth separating because both
> are checkable:
>
> - **Written, never applied.** `infrastructure/kubernetes/` (backend, frontend,
>   postgres, redis, ingress, configmap, secrets), `infrastructure/terraform/`
>   (`eks.tf`, `rds.tf`, `elasticache.tf`, `vpc.tf`, `iam.tf`, and the WAF Web ACL at
>   `main.tf:314`, wired to the ALB at `kubernetes/ingress.yaml:41`), and both CD
>   workflows. RDS encryption at rest — the Phase 1 "TDE" row — is here too
>   (`rds.tf:175–176`). All of it is complete, on disk, and has never run: the deploy
>   has never once succeeded. `cd-staging.yml:24` records that `STAGING_DEPLOY_ENABLED`
>   has never been set; the gate at `cd-staging.yml:87` reads
>   `vars.STAGING_DEPLOY_ENABLED == 'true' || github.event_name == 'workflow_dispatch'`,
>   so automatic staging deploys are off while a manual dispatch would still run. Before
>   that gate, CD to staging failed on every push to `main` from 2026-07-18 — 90 runs,
>   zero successes, against infrastructure that did not exist
>   (`docs/deployment/aws-provisioning.md`).
> - **Never written at all.** CloudTrail and GuardDuty (Phase 2) and multi-region
>   (Series A) have no manifest anywhere: neither `cloudtrail` nor `guardduty` appears
>   under `infrastructure/`, and `infrastructure/terraform/variables.tf:26` declares one
>   `aws_region`, "Primary AWS region for all resources", with no secondary region in
>   the tree. These are unticked checkboxes and have never been more — which is what the
>   roadmap row below already says ("single-region manifests").
>
> Calling any of it "retired" would invent a history for a cluster nobody stood up, and
> erase the backend's.
>
> **This matters because a scorecard is read as evidence of what ships.** "Security &
> Auth 91" is the figure that gets copied into a security questionnaire, and the SOC 2
> phases below are read as a live plan — and both describe a service that no longer
> runs and a cluster nobody has built.
>
> **Nothing here is re-scored or re-verified.** The stale flags stay flagged and the
> 2026-07-29 verification stands: this is a dated audit record, and its worth is that it
> says what was found on the day it was found. The rule is the steward charter's —
> historical records are annotated, never edited
> (`docs/agents/checklist-steward.md:75`, `:197`), and for this file specifically,
> Verification-column changes need file:line proof and scores flagged stale stay flagged
> until re-scored (`:24`).
>
> **Spot-checked against the frozen tree on 2026-09-20.** The cited lines resolve, with
> three corrections applied in place and each dated where it appears: #17's line
> reference (`config.py:67–73` → `107–113`), the SSL/TLS roadmap row's path and line
> (`docker-compose.yml:199` → `infrastructure/docker/docker-compose.yml:201`), and
> deferred risk D's evidence sentence, which was unscoped rather than wrong. One
> imprecision is left as found rather than quietly corrected: #9's `auth.py:240` is
> `exp = payload.get("exp")`, inside `_revoke_jti`; the TTL'd write it stands for is
> `auth.py:245`.
>
> **Reading the citations:** every path below is under `backend/app/`, and the bare
> filenames are not all in one directory. `main.py`, `config.py` and `dependencies.py`
> sit at `backend/app/` itself — note that `config.py` is **not** under `core/`.
> `auth.py` is `backend/app/api/v1/auth.py`; `security.py`, `rate_limiter.py` and
> `middleware.py` are under `backend/app/core/`; `manager.py` is
> `backend/app/streaming/manager.py`; `api_key.py` is `backend/app/models/api_key.py`;
> `002_scoring_fixes.py` is `backend/app/db/migrations/versions/002_scoring_fixes.py`.
> Citations that already carry a directory (`scoring/`, `pipelines/`, `analytics/`,
> `models/`, `db/`, `core/`, `streaming/`) take the same `backend/app/` prefix.
**Audit Date:** 2026-06-14 (as CAEP)  
**Auditor:** Principal Architecture Review  
**Scope:** Full-stack (backend API, scoring engine, data pipelines, infrastructure, frontend) — **the backend, scoring engine and pipelines audited here were retired on 2026-09-14 (D2), and the AWS infrastructure was never provisioned; see the banner above.**

> **Verified against the tree on 2026-07-29.** Every "✅ Fixed" claim below was
> re-checked in source rather than taken on trust. **14 of 18 hold. Three were
> false and one was ineffective** — see the Verification column. The 58 roadmap
> checkboxes were also checked: all are genuinely unticked, and none of the
> code-verifiable ones are implemented, so nothing is stale in that direction.
>
> This matters because a scorecard is read as evidence. An unticked box that is
> actually done costs credibility; a ticked box that is actually undone costs
> more than that, because it stops anyone from looking again.
>
> **The count changed from 15 to 14 later the same day, and how is worth
> recording.** Item #3 (JWT revocation) was first marked as holding because the
> blocklist writer and the blocklist checker both existed in source. They did —
> but nothing called the checker, so logout revoked nothing. Confirming that
> each part is present is not confirming they are connected, and a
> parts-inventory reads exactly like a working system right up until someone
> traces a call. **Verify a claim by following the path a request takes, not by
> grepping for the pieces it should contain.**

---

## Overall Score: 74 / 100 → POST-AUDIT: 89 / 100

⚠ **The post-audit score was computed from the fix claims, four of which did
not hold.** Security & Auth was credited for JWT revocation that was never
wired up and for a `/metrics` guard that was bypassable; Infrastructure for
image pinning and a Redis eviction fix that were not in effect. Treat 89 as
unverified until the score is recomputed.

---

## Dimension Scores

| Dimension | Pre-Audit | Post-Audit | Weight | Notes |
|-----------|-----------|------------|--------|-------|
| Security & Auth | 62 | 91 | 20% | **91 is not defensible.** Lockout verified, but **token revocation was never wired up** (blocklist written, never read) and the **metrics guard was bypassable** via a spoofed `X-Forwarded-For`. Both fixed 2026-07-29; the score predates the fixes and was earned by neither |
| Data Integrity | 55 | 88 | 15% | schema type mismatch, missing UNIQUE, upsert race — all three verified in migration 002 / `scoring/engine.py` |
| Scalability | 68 | 78 | 15% | WebSocket horizontal scaling still requires Redis pub/sub (deferred; `streaming/manager.py` has no backplane) |
| Quant Methodology | 70 | 87 | 15% | Event rate normalization, staleness decay, per-asset-type weights — all three verified |
| Infrastructure | 72 | 88 | 10% | `pool_pre_ping` verified. **Image pinning and the Redis eviction fix did not hold** — see #9 and #15. Corrected 2026-07-29 |
| Observability | 80 | 88 | 10% | Gauge metric verified; structured logging solid |
| API Design | 82 | 82 | 5% | Versioned, paginated, RBAC — no changes needed |
| Frontend/UX | 71 | 71 | 5% | **Stale.** Predates the M1–M8 audit sweep, the Next 15 upgrade, and the entitlement-gated module suite. Needs re-scoring, not carrying forward |
| Testing | 75 | 75 | 5% | **Stale.** The floor is **45%**, not 80% — reconciled deliberately in 2026-07 so `pyproject.toml` matched what CI actually enforced |

---

## Critical Issues Fixed in This Audit

Verification column added 2026-07-29 — each claim re-checked in source, with the
file and line that proves or disproves it.

| # | Severity | Issue | Claimed | Verified 2026-07-29 |
|---|----------|-------|---------|---------------------|
| 1 | 🔴 CRASH | `broadcast_system_status` called with wrong arity on shutdown | ✅ Fixed | ✅ Holds — `main.py:42` passes all three params `manager.py:267` declares |
| 2 | 🔴 CRASH | `score_date` column type DateTime vs Date mismatch | ✅ Fixed (migration 002) | ✅ Holds — `002_scoring_fixes.py:20` alters to `date` |
| 3 | 🔴 SECURITY | JWT tokens not revoked on logout | ✅ Fixed (Redis JTI blocklist) | ❌ **False — and this verification pass got it wrong first time.** Re-checked 2026-07-29 and marked "Holds" on the grounds that `auth.py` wrote the entry and `security.py` had a checker. It did. But `verify_token_not_revoked` had **zero call sites**: `get_current_user`, the WebSocket handshake and `/refresh` all used plain `verify_token`, so the blocklist was **write-only** and logout revoked nothing. Checking that the parts exist is not checking that they are connected — the same error the scorecard itself made, repeated. Wired up, access tokens now blocklisted at logout too, lifetime cut 30→10 min, 7 tests incl. one that fails when unwired |
| 4 | 🔴 SECURITY | Account lockout never triggered on failed logins | ✅ Fixed | ✅ Holds — `auth.py:110–138`, 30-minute lockout |
| 5 | 🔴 SECURITY | `/metrics` endpoint publicly exposed | ✅ Fixed (IP allowlist guard) | ⚠️ **Was ineffective.** The guard preferred `X-Forwarded-For` unconditionally, so any caller could send `X-Forwarded-For: 127.0.0.1` and scrape it. Its docstring also promised "explicitly configured IPs" that did not exist. Both fixed 2026-07-29 (`METRICS_TRUST_FORWARDED_FOR`, `METRICS_ALLOWED_IPS`) |
| 6 | 🟠 DATA | Race condition in score upsert (SELECT + INSERT) | ✅ Fixed (ON CONFLICT DO UPDATE) | ✅ Holds — `scoring/engine.py:447` |
| 7 | 🟠 DATA | Missing UNIQUE(asset_id, score_date) constraint | ✅ Fixed (migration 002) | ✅ Holds — `002_scoring_fixes.py:54`, with a de-dup pass first |
| 8 | 🟠 PERF | 6 sequential DB queries in scoring gather | ✅ Fixed (asyncio.gather) | ✅ Holds — `scoring/engine.py:326` (five queries, not six) |
| 9 | 🟠 PERF | Redis allkeys-lru evicts rate-limit keys under load | ✅ Fixed (volatile-lru) | ❌ **False, and the fix is a no-op.** Applied only to dev compose; prod compose and the k8s manifest were still `allkeys-lru`. More importantly the premise is wrong: **both** Redis writers set a TTL (`rate_limiter.py:88`, `auth.py:240`), so every key is volatile and the two policies evict from an identical set. Aligned 2026-07-29 for parity, but see the real risk below |
| 10 | 🟠 PERF | `_seen_hashes` memory leak in pipeline workers | ✅ Fixed (auto-clear at 50k) | ✅ Holds — `pipelines/base.py:43,242` |
| 11 | 🟠 QUANT | Peg event rate penalizes assets with more history | ✅ Fixed (normalised window) | ✅ Holds — `analytics/peg_stability.py:246` |
| 12 | 🟠 QUANT | Confidence ignores data staleness | ✅ Fixed (temporal decay) | ✅ Holds — `scoring/engine.py:253–265` |
| 13 | 🟠 QUANT | Single static scoring weights for all asset types | ✅ Fixed (per-asset-type weights) | ✅ Holds — `scoring/weights.py:77` |
| 14 | 🟡 BUG | `calculate_percentile` declared async unnecessarily | ✅ Fixed | ✅ Holds — `scoring/engine.py:274` is a plain `def` |
| 15 | 🟡 INFRA | `timescale/timescaledb:latest` not reproducible | ✅ Fixed (pinned 2.14.2-pg15) | ❌ **False.** All three manifests still read `latest-pg15` — still not reproducible, and 2.14.2 was never applied. Pinned to `2.28.3-pg15` on 2026-07-29 (same digest `latest-pg15` resolves to today, so behaviourally a no-op) |
| 16 | 🟡 INFRA | No `pool_pre_ping` on DB engine | ✅ Fixed | ✅ Holds — `db/session.py:48` |
| 17 | 🟡 SECURITY | Wildcard CORS allow-headers | ✅ Fixed (explicit header list) | ✅ Holds — `config.py:107–113`, five named headers (cited as `67–73` on 2026-07-29; re-checked 2026-09-20) |
| 18 | 🟡 METRIC | `REQUEST_IN_PROGRESS` wrong Prometheus type (Counter) | ✅ Fixed (Gauge) | ✅ Holds — `core/middleware.py:39`, with matching `.inc()`/`.dec()` |

### Blocklist durability — resolved 2026-07-29

The #9 verification raised this as an open design question: `blocklist:{jti}`
carries a TTL, so LRU can drop it early and silently un-revoke a logged-out
token, and neither eviction policy prevents that.

Investigating it is what turned up the larger problem behind #3 — the blocklist
was never read at all, so eviction was the *second* reason revocation did not
work. Both are now addressed:

- **Wired.** `verify_token_not_revoked` is called by `get_current_user`, the
  WebSocket handshake, and `/refresh`. Logout blocklists the access token as
  well as the refresh token.
- **Bounded.** `ACCESS_TOKEN_EXPIRE_MINUTES` cut 30 → 10. This is the load-
  bearing choice: the expiry is the only limit that holds when Redis is
  unreachable, so it caps exposure in *every* failure mode — eviction, outage,
  and theft alike — rather than defending one path.
- **Explicit.** A failed blocklist lookup logs a warning and, by default,
  allows the request: a Redis outage degrades revocation instead of locking
  every user out. `BLOCKLIST_FAIL_CLOSED=true` inverts that for deployments
  running Redis HA.

`noeviction` on the shared instance remains **unsafe** — `rate_limit_dependency`
(`dependencies.py:168`) has no error handling, so a memory-full instance would
500 every rate-limited endpoint. An isolated Redis DB for the blocklist under
`noeviction` is still the belt-and-braces option; it is a deployment change, is
no longer load-bearing given the 10-minute lifetime, and was deliberately not
attempted here.

---

## Remaining Known Risks (Deferred)

All six re-confirmed as still open on 2026-07-29 — none has been quietly closed.

| # | Severity | Issue | Mitigation | Still open? |
|---|----------|-------|------------|-------------|
| A | 🟠 | WebSocket `ConnectionManager` in-memory — won't scale past 1 pod | Use Redis Pub/Sub as backplane (Q3 sprint) | Yes — no pub/sub anywhere in `streaming/manager.py` |
| B | 🟠 | `mfa_secret` stored in plaintext | Add AES-256 column encryption via `pgcrypto` (Q3 sprint) | Yes — `models/user.py:49` is a bare `String(64)` |
| C | 🟡 | No audit log integrity protection (tamper-evident) | Implement WORM append-only log table with trigger (Q4) | Yes — `models/audit_log.py` exists, no trigger in any migration |
| D | 🟡 | No data retention policy enforced in code | Add TimescaleDB retention policies (Q3 sprint) | Yes — no retention policy anywhere in `backend/`: `retention` does not appear in that tree at all, and none of the four migrations (`backend/app/db/migrations/versions/001`–`004`) calls `add_retention_policy`. The policy is designed but unimplemented — `docs/architecture/data-flow.md:306` specifies `SELECT add_retention_policy('price_history', INTERVAL '90 days')`. Scoped and re-checked 2026-09-20; cited as "no `retention` reference in the tree" on 2026-07-29, which holds for `backend/` but not for the repository — `infrastructure/` has eleven `retention` hits (Prometheus TSDB at `docker/docker-compose.yml:153`, Terraform backup and log windows), none of them data retention |
| E | 🟡 | API docs disabled in production | Deploy separate internal `/docs` route behind auth (Q3) | Yes — `main.py:59–61` gate all three on `DEBUG`; no authed alternative |
| F | 🟡 | No API usage metering for billing | Add metering counter to API key middleware (Q4) | Yes — `api_key.py:31` mentions `rate_limit_override` in a comment only |

---

## Roadmap checkbox verification (2026-07-29)

All **58** checkboxes across the three roadmaps below are unticked, and that is
accurate — every one that can be checked in source was checked, and none is
implemented:

| Checked in source | Result |
|---|---|
| Encrypt `mfa_secret` at column level | Not done — plaintext `String(64)` |
| SSL/TLS enforced everywhere (`sslmode=require`) | Not done — the only `sslmode` in any config in the tree is `sslmode=disable` (`infrastructure/docker/docker-compose.yml:201`, metrics exporter — cited as `docker-compose.yml:199` on 2026-07-29; path and line re-checked 2026-09-20). `docs/architecture/security.md:100` asserts `sslmode=require`; no configuration implements it |
| WORM audit log (append-only, trigger-enforced) | Not done — no trigger in any migration |
| SSO / SAML 2.0 / OIDC | Not done — no SAML or OIDC reference anywhere |
| Per-API-key IP allowlist | Not done |
| Plan-based rate limit tiers | Not done — a single global `RATE_LIMIT_REQUESTS = 100` |
| Audit log export | Not done |
| Custom alerting webhooks | Not done — no webhook code |
| Multi-region deployment | Not done — single-region manifests |
| WebSocket horizontal scale (Redis pub/sub) | Not done — same as deferred risk A |

Two wording corrections, since these are read as claims:

- **"all 5 asset monitoring pipelines"** — there are **4** (`chainlink`, `coingecko`,
  `defillama`, `onchain`); `base` and `scheduler` are infrastructure, not pipelines.
- **"Live data, not mock"** — true of the **frontend** since it went live-only
  (`LIVE_DATA` hardcoded, no mock path, see `DATA-AVAILABILITY.md`). The item is
  about backend pipelines *in production*, and there is no production deployment,
  so it stays unticked. Worth not conflating the two when this is next reviewed.

Everything else on the three roadmaps is commercial, procedural, or
organisational (engage an auditor, ARR targets, insurance, advisory board) and
cannot be verified from the repository.

---

## SOC 2 Readiness Roadmap

**Target:** SOC 2 Type I within 9 months; Type II within 18 months

### Phase 1 — Foundation (Months 1–3)
- [ ] Engage SOC 2 auditor (e.g., Vanta, Drata, or Secureframe)
- [ ] Document all data flows and system inventory
- [ ] Implement formal access control policy (least privilege, quarterly reviews)
- [ ] Encrypt `mfa_secret` and any PII fields at the column level
- [ ] Implement WORM audit log (append-only, no DELETE privilege on audit table)
- [ ] Enable PostgreSQL TDE (Transparent Data Encryption) on RDS
- [ ] Enable SSL/TLS enforcement everywhere (`sslmode=require` in DB URL)
- [ ] Implement secrets rotation policy (AWS Secrets Manager, 90-day rotation)
- [ ] Formalize incident response procedure (runbook exists, needs sign-off)

### Phase 2 — Controls (Months 3–6)
- [ ] Implement change management policy (PR reviews, deploy approvals)
- [ ] Add vendor risk assessments for CoinGecko, DefiLlama, Chainlink
- [ ] Deploy WAF (AWS WAF) in front of ALB
- [ ] Enable CloudTrail + GuardDuty on all AWS accounts
- [ ] Conduct internal penetration test
- [ ] Implement formal business continuity / DR plan with RTO/RPO targets
- [ ] Set up automated backup verification (restore drills, at minimum quarterly)
- [ ] Add MFA enforcement policy for all admin accounts

### Phase 3 — Evidence Collection (Months 6–9) — Type I
- [ ] Collect 30-day evidence for all controls
- [ ] Complete auditor review and issue management
- [ ] Resolve any exceptions found in audit
- [ ] Achieve SOC 2 Type I report

### Phase 4 — Continuous Monitoring (Months 9–18) — Type II
- [ ] 12 months of continuous control evidence
- [ ] Quarterly access reviews automated
- [ ] Annual penetration test completed
- [ ] Achieve SOC 2 Type II report

---

## Enterprise Sales Readiness Roadmap

**Target:** Enterprise-ready for Tier 1 financial institution pilots in 6 months

### Technical Requirements
- [ ] **SLA documentation**: Define 99.9% uptime SLA with credits schedule
- [ ] **Data residency**: Add region selector (EU, US-East, US-West) via Terraform workspace
- [ ] **SSO/SAML integration**: Add SAML 2.0 / OIDC support for corporate IdPs (Okta, Azure AD)
- [ ] **IP allowlisting**: Add per-API-key IP allowlist enforcement
- [ ] **Dedicated environments**: Tenant isolation via namespace or separate cluster
- [ ] **API versioning guarantee**: Define deprecation policy (12-month notice)
- [ ] **Rate limit tiers**: Implement plan-based rate limits (Free / Pro / Enterprise)
- [ ] **Audit log export**: Provide signed audit log exports for compliance teams
- [ ] **Custom alerting webhooks**: Allow institutions to receive alerts via their SIEM

### Commercial Requirements
- [ ] **DPA / Data Processing Agreement** template ready
- [ ] **MSA template** with SLA, IP rights, and indemnification
- [ ] **Security questionnaire** pre-filled (based on SOC 2 controls)
- [ ] **Penetration test report** shareable under NDA
- [ ] **Insurance**: Cyber liability coverage in place ($5M minimum)

### Operational Requirements
- [ ] **Dedicated customer success** for enterprise accounts
- [ ] **SLA monitoring dashboard** accessible to customers
- [ ] **Private Slack / support channel** per enterprise account
- [ ] **Onboarding runbook** for enterprise integration

---

## Series A Readiness Roadmap

**Target:** Series A raise in 12–18 months at $15–30M pre-money

### Technical Proof Points Needed
- [ ] **≥3 paying institutional pilots** (hedge funds, banks, or treasury teams)
- [ ] **Live data, not mock** — all 4 asset monitoring pipelines live in production (see the wording note above: the *frontend* is already live-only; this item is about the backend pipelines, and there is no production deployment)
- [ ] **Scoring model validation** — back-test scores against historical depeg events (UST, USDC, BUSD)
- [ ] **SOC 2 Type I** certificate in hand
- [ ] **99.9% uptime** demonstrated over rolling 3 months
- [ ] **Sub-500ms API p95 latency** at 1,000 RPS demonstrated in load test
- [ ] **Multi-region deployment** (at minimum US-East + EU-West)
- [ ] **WebSocket horizontal scale** (Redis pub/sub backplane)
- [ ] **AI/ML differentiation** — at least one predictive risk feature (depeg probability model)

### Business Proof Points Needed
- [ ] **ARR**: $250k–$500k ARR from paying customers
- [ ] **NRR**: >110% (expansion revenue)
- [ ] **TAM analysis**: Documented $2B+ addressable market
- [ ] **Competitive positioning**: Demonstrably superior scoring methodology vs. CryptoCompare / Kaiko
- [ ] **Regulatory tailwind narrative**: Position alongside EU MiCA, US stablecoin legislation
- [ ] **Advisory board**: 2–3 credible names from TradFi or RegTech

### Investor Narrative
The pitch (written when the product was named CAEP) centers on:
1. **Regulatory inevitability** — MiCA (EU) and forthcoming US stablecoin regulation mandate reserve transparency disclosure. Finance Now is the Bloomberg Terminal for that compliance layer.
2. **Institutional FOMO** — $200B+ in stablecoins sits in treasury portfolios with zero systematic risk monitoring. Every institutional DeFi or treasury desk is a buyer.
3. **Data moat** — proprietary scoring history, reserve attestation database, and on-chain analytics create durable defensibility.
4. **Expansion optionality** — CBDC analytics, tokenized RWA monitoring, ETF-grade reporting are natural upsells.

---

*This document should be reviewed and updated quarterly. Last verified against
the tree: 2026-07-29 — claim-by-claim, not by re-reading the previous summary.
That distinction is the point: three of the eighteen "✅ Fixed" rows had survived
six weeks unchallenged because the summary was the only thing anyone re-read.*
