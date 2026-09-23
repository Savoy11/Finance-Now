# Finance Now Architecture Overview

> **Correction, 2026-09-20.** This document describes a four-tier platform — a FastAPI backend on `:8000` serving `/api/` and `/ws/`, Celery workers, TimescaleDB, and Kubernetes 1.29 on AWS EKS — and, apart from its opening sentence, states it in the present tense. **That is not what ships as of 2026-09-20.** The shipping application is the **Next.js 15 app in `frontend/` alone**: its 58 `/live-data/*` route handlers call providers directly from the server (`live-data/markets/route.ts` fetches `api.binance.com` and `pro-api.coinmarketcap.com` itself), Auth.js signs in against the app's own `users` table (`frontend/src/lib/auth/config.ts`), and Postgres holds user data through drizzle (`frontend/src/lib/db/schema/`). On this date nothing under `frontend/src` names port 8000, nothing there opens a WebSocket, and `frontend/next.config.mjs` has no rewrites at all.
>
> **Four different things are wrong below, and they are not the same kind of wrong:**
>
> - **Retired — built, ran, stopped by a decision.** The FastAPI backend. `backend/app/` still holds its routers, pipelines, `scoring/`, `streaming/` and `api/v1/websocket.py`, and `db/migrations/versions/001_initial.py` creates twelve tables with four `create_hypertable(...)` calls, so TimescaleDB was genuinely part of the schema. **Owner decision D2, 2026-09-14 — retire, keep the DB schema (drizzle)** (`docs/decisions/2026-09-14-owner-decisions.md:37`); it was frozen rather than deleted under the owner's 2026-09-11 no-delete rule, as `backend/FROZEN.md` records. The REST API, the WebSocket interface and TimescaleDB are all this: real, and inert since that date.
>
> - **Designed and committed, never provisioned.** Kubernetes and EKS, and with them the ALB, the WAF, Aurora, ElastiCache, Nginx and the Prometheus/Grafana/Alertmanager stack. (ALB and WAF are in the diagram; Aurora appears only in Scaling Characteristics and the Failure Modes table; ElastiCache and the WAF's Terraform live outside this page.) The files are real — **thirteen** manifests under `infrastructure/kubernetes/`, a full Terraform root module whose `eks_cluster_version` defaults to `"1.29"` (`variables.tf:117`, which is where the version in the table below comes from), monitoring config under `infrastructure/monitoring/`, and Nginx as an `fn-nginx-config` ConfigMap plus a service in both `infrastructure/docker/` compose files. But no cluster was ever created: as of 2026-09-20 there is no `.tfstate` anywhere in the tree, `backend/FROZEN.md` states "AWS was never provisioned", and `docs/deployment/aws-provisioning.md` (written 2026-08-07) records `CD — Deploy to Staging` failing on all 90 runs since 2026-07-18 against infrastructure that did not exist.
>
> - **Designed on paper, never written in code. Celery.** There is no Celery dependency, worker, beat schedule or broker: `grep -rni celery backend` returns zero files, and `backend/pyproject.toml` carries `apscheduler = "^3.10.4"` instead. What the backend actually ran was in-process **APScheduler** (`backend/app/pipelines/scheduler.py`, `AsyncIOScheduler` + `IntervalTrigger`). Celery was not a fiction invented by this page, though, and a contributor will find it: on 2026-09-20 `infrastructure/terraform/eks.tf:238` still declares a spot node group "for non-critical batch workloads (Celery workers)", `infrastructure/monitoring/prometheus/prometheus.yml:141` still scrapes `celery-flower:5555` as `service: celery, component: worker`, `rules/fn-alerts.yml:252` still tells an operator to check Celery worker health, and `docs/architecture/data-flow.md` still narrates Celery Beat dispatching tasks. It belongs beside Kubernetes: chosen, committed as configuration, never implemented and never run.
>
> - **Wrong even for the backend that did exist.** `FastAPI 0.109` was never the pin — `backend/pyproject.toml` has held `^0.110.0`, then `^0.140.13`, and on 2026-09-20 `>=0.140.13,<0.142.0`; Python 3.11 is correct. `price_history` and `asset_scores` are not tables in either schema (the migration creates `market_data` and `risk_scores`), and they recur in the Data Flow section below. And the cadences below never matched the scheduler: `scheduler.py` registered three jobs — market data every 5 minutes, on-chain every 15 minutes, risk scores hourly — not every 60 seconds and every 5 minutes, and it never scheduled alert evaluation at all.
>
> **The design rationale is kept, not rewritten** — the Decision Log at the end records what was chosen and why, the Celery row included, and it stands as written. Only statements of fact are corrected, each carrying 2026-09-20 and the file and line that settles it, so the next reader can re-check rather than trust this note. (The opening sentence's "WAS designed as" is an undated in-place edit made the same day in commit `ed54f11`; this banner is what dates it.) That matters more here than in most documents: this is the first file a new contributor opens in `docs/architecture/` and the only one claiming to describe the system as a whole, so read as current it sends them to build against a frozen service, a queue nobody ever implemented, and a cluster nobody ever created.

## Introduction

Finance Now — called CAEP, the Crypto Asset Evaluation Platform, when this was written — WAS designed as a full-stack, cloud-native analytics platform designed to ingest real-time and historical data from multiple blockchain and market data sources, compute composite risk and opportunity scores across an asset universe, and deliver insights to analysts and traders via a low-latency REST API and WebSocket streaming interface.

This document describes the architecture decisions, component interactions, and operational characteristics of the platform at the level of detail required for engineering teams, platform operators, and technical reviewers.

---

## System Context

Finance Now operates as a read-heavy analytical system with write-intensive background pipelines. The platform consists of four primary logical tiers:

1. **Data Ingestion Layer** — fetches external market data, on-chain metrics, and DeFi protocol data on configurable schedules
2. **Analytics and Scoring Engine** — computes composite risk scores, liquidity metrics, volatility signals, and alert conditions
3. **API Layer** — exposes the computed data via REST endpoints and real-time WebSocket streams
4. **Presentation Layer** — a Next.js frontend that renders dashboards, portfolio views, and risk alerts

---

## Technology Stack

> **Not the running stack (2026-09-20).** Only **Next.js 15** ships (`frontend/package.json`
> pins `next` 15.5.25). FastAPI, TimescaleDB and Redis belong to the backend retired by
> **D2, 2026-09-14** (`backend/FROZEN.md`). Kubernetes/EKS, Terraform, Nginx and
> Prometheus/Grafana/Alertmanager are committed configuration that was never applied —
> thirteen manifests under `infrastructure/kubernetes/`, a Terraform root module,
> monitoring config under `infrastructure/monitoring/`, and Nginx as both an
> `fn-nginx-config` ConfigMap and a service in each `infrastructure/docker/` compose file —
> and on this date there is no `.tfstate` anywhere in the tree and no AWS account was ever
> provisioned, so there is no cluster for any of it to run on. The Task Queue row is a
> different case again; see its own note.

| Layer | Technology | Rationale |
|---|---|---|
| Backend API | ~~FastAPI 0.109~~ — **retired, D2 2026-09-14** (`backend/FROZEN.md`). The version was never `0.109` either: `backend/pyproject.toml` pins `fastapi = ">=0.140.13,<0.142.0"`. Python 3.11 is correct | Native async support, excellent type annotations, auto-generated OpenAPI docs |
| Task Queue | ~~Celery 5.3 + Redis Broker~~ — **designed, never written in code.** No Celery dependency, worker, beat schedule or broker exists: `grep -rni celery backend` returns zero files, and `backend/pyproject.toml` has `apscheduler = "^3.10.4"` instead. The backend ran its pipelines on in-process **APScheduler** (`backend/app/pipelines/scheduler.py`), retired with the rest at **D2, 2026-09-14**. It was not imaginary, though, and a contributor will find traces: as of 2026-09-20 `infrastructure/terraform/eks.tf:238` still declares a spot node group "for non-critical batch workloads (Celery workers)" and `infrastructure/monitoring/prometheus/prometheus.yml:141` still scrapes `celery-flower:5555`. Committed as configuration; never implemented; never run | Reliable distributed task execution; beat scheduler for periodic jobs |
| Time-Series DB | TimescaleDB 2.x on PostgreSQL 15 | Columnar compression, time-series indexes, compatibility with SQLAlchemy ORM |
| Cache / Pub-Sub | Redis 7 | Sub-millisecond latency for pricing cache; pub/sub for WebSocket fan-out |
| Frontend | Next.js 15 (React, TypeScript) | Server-side rendering, App Router, built-in API routes for BFF patterns |
| Reverse Proxy | Nginx 1.25 | Rate limiting, WebSocket upgrade, gzip, security headers |
| Container Orchestration | Kubernetes 1.29 on AWS EKS | Declarative deployments, HPA, anti-affinity for HA |
| Infrastructure as Code | Terraform 1.6 | Reproducible AWS infrastructure; remote state in S3 + DynamoDB |
| Monitoring | Prometheus + Grafana + Alertmanager | Industry-standard open-source observability stack |

---

## Component Architecture

> **As designed, not as deployed (2026-09-20).** Nothing above the data stores runs: no
> ALB, no WAF, no Nginx in front of anything, and no FastAPI process on `:8000` serving
> `/api/` or `/ws/`. The Next.js app is the entire server tier and reaches providers
> itself. Two labels in the PostgreSQL box are wrong as well — `price_history` and
> `asset_scores` are tables in neither schema. The backend's migration creates twelve
> tables, among them `market_data` and `risk_scores`; `frontend/src/lib/db/schema/` has
> neither name. Both recur in the Data Flow section below, in the lines reading
> `INSERT INTO price_history`, `SELECT price_history` and `UPSERT asset_scores`; they are
> wrong there too.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Finance Now Platform Architecture                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [Browser / Mobile Client]                                                 │
│         │ HTTPS / WSS                                                       │
│   [AWS ALB + WAF]  ←── DDoS protection, TLS termination                    │
│         │                                                                   │
│   [Nginx Reverse Proxy]  ←── Rate limiting, security headers, gzip         │
│         ├──── /          → [Next.js Frontend  :3000]                        │
│         ├──── /api/      → [FastAPI Backend   :8000]                        │
│         └──── /ws/       → [FastAPI WebSocket :8000]                        │
│                                                                             │
│   ┌──────────────────── FastAPI Backend ───────────────────────┐           │
│   │                                                             │           │
│   │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │           │
│   │  │  REST API   │  │  WebSocket   │  │  Background Jobs  │  │           │
│   │  │  (routers)  │  │  Manager     │  │  (Celery Tasks)   │  │           │
│   │  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘  │           │
│   │         │                │                    │            │           │
│   │  ┌──────▼──────┐  ┌──────▼───────┐  ┌────────▼─────────┐  │           │
│   │  │  Analytics  │  │  Streaming   │  │  Data Ingestion   │  │           │
│   │  │  Engine     │  │  Pub/Sub     │  │  Pipeline         │  │           │
│   │  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘  │           │
│   │         │                │                    │            │           │
│   └─────────┼────────────────┼────────────────────┼────────────┘           │
│             │                │                    │                        │
│   ┌─────────▼────────┐  ┌────▼────────┐  ┌────────▼───────────────────┐   │
│   │ PostgreSQL 15    │  │  Redis 7    │  │  External Data Sources     │   │
│   │ /TimescaleDB     │  │  Cache +    │  │  ┌──────────────────────┐  │   │
│   │                  │  │  Pub/Sub +  │  │  │ CoinGecko API        │  │   │
│   │ • price_history  │  │  Sessions   │  │  │ DefiLlama API        │  │   │
│   │ • asset_scores   │  │             │  │  │ Chainlink Oracles    │  │   │
│   │ • alerts         │  │             │  │  │ Alchemy/Infura RPC   │  │   │
│   │ • users          │  └─────────────┘  │  └──────────────────────┘  │   │
│   └──────────────────┘                   └───────────────────────────┘    │
│                                                                             │
│   ┌──────────────────── Observability Stack ──────────────────────────┐    │
│   │  Prometheus → Grafana → Alertmanager → Slack / PagerDuty          │    │
│   └───────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Descriptions

> **History, and not accurate history (2026-09-20).** These four flows describe pipelines
> that were real — `coingecko.py`, `defillama.py`, `chainlink.py`, `onchain.py` and
> `scoring/engine.py` all exist under `backend/app/` — but three things below were never
> true of them. **Celery Beat never drove them:** the backend scheduled work with in-process
> APScheduler (`backend/app/pipelines/scheduler.py`, `AsyncIOScheduler` +
> `IntervalTrigger`); Celery was committed as infrastructure config
> (`infrastructure/terraform/eks.tf`, the Prometheus scrape job) but never written in code.
> **The cadences are wrong:** `scheduler.py` registered three jobs — market data every
> **5 minutes**, on-chain every **15 minutes**, risk scores **hourly**
> (`backend/app/config.py`) — not every 60 seconds and every 5 minutes. **Alert evaluation
> was never scheduled at all:** there is no alert job in `scheduler.py` and no alert
> pipeline module. And none of it runs now — the backend is frozen (D2, 2026-09-14), the
> shipping app fetches on request inside its `/live-data/*` handlers and opens no socket.
> The latency and cache-hit figures below belong to that retired service; nothing in the
> current app produces them.

### 1. Price Ingestion Flow

```
Celery Beat (every 60s)
  └→ PriceFetchTask
       └→ CoinGeckoClient.get_prices(asset_ids)
            └→ PostgreSQL: INSERT INTO price_history (timescaledb hypertable)
                 └→ Redis: SET price:{asset_id} {price} EX 30
                      └→ Redis PUBLISH channel:prices {update_event}
                           └→ WebSocket Manager: broadcast to subscribed clients
```

**Latency characteristics**: Price updates reach connected WebSocket clients within 200–500ms of the Celery task completing. The Redis pub/sub fan-out adds approximately 1–5ms per connected backend instance.

### 2. Risk Score Calculation Flow

```
Celery Beat (every 5 minutes)
  └→ RiskScoringTask(asset_id)
       ├→ PostgreSQL: SELECT price_history (last 90 days) via TimescaleDB
       ├→ DefiLlamaClient.get_tvl_history(protocol)
       ├→ ChainlinkClient.get_price_feed(asset)
       ├→ AnalyticsEngine.compute_composite_score()
       │    ├→ VolatilityEngine (30d/90d rolling stddev)
       │    ├→ LiquidityEngine (bid/ask spread, volume)
       │    ├→ DefiMetricsEngine (TVL, utilization)
       │    └→ MarketCapEngine (mcap rank, dominance)
       └→ PostgreSQL: UPSERT asset_scores
            └→ Redis: SET score:{asset_id} {score_json} EX 300
```

**Latency characteristics**: Full score recalculation for a single asset takes 50–300ms depending on data availability. Scores are cached in Redis with a 5-minute TTL, so API reads are sub-millisecond for cached assets.

### 3. Alert Evaluation Flow

```
Celery Beat (every 30s)
  └→ AlertEvaluationTask
       └→ PostgreSQL: SELECT alerts WHERE enabled=true
            └→ For each alert:
                 ├→ Redis: GET current price/score
                 ├→ AlertConditionEvaluator.evaluate(condition, current_value)
                 └→ If triggered:
                      ├→ PostgreSQL: INSERT alert_events
                      └→ WebSocket Manager: PUBLISH to user's alert channel
```

### 4. API Request Flow

```
Client → Nginx → FastAPI Router
  ├→ AuthMiddleware: validate JWT, load user from Redis session
  ├→ RateLimitMiddleware: check Redis counter for IP/user
  └→ Route Handler:
       ├→ Redis: GET cached response (if available)
       │    └→ Return 200 with cache hit (< 1ms)
       └→ PostgreSQL: query if cache miss
            └→ Redis: SET response cache
                 └→ Return 200 response
```

**Cache hit rate**: Approximately 85–95% for public endpoints (price data, asset scores) under normal load. Cache TTLs are configured per data type: prices (30s), scores (60s), asset metadata (300s), market stats (120s).

---

## Scaling Characteristics

> **Correction, 2026-09-22.** Nothing in this section describes how the shipping
> application scales. It describes a FastAPI service behind a Kubernetes HPA, in front of
> Aurora and ElastiCache — and none of those four things runs. The backend is frozen
> (D2, 2026-09-14, `backend/FROZEN.md`); the AWS side was never provisioned, there is no
> `.tfstate` anywhere in the tree, and `.github/workflows/cd-staging.yml:87` still gates
> every automatic deploy behind an unset `STAGING_DEPLOY_ENABLED`. The HPA numbers below
> are real as *configuration* and were never applied to a cluster —
> `infrastructure/kubernetes/backend/hpa.yaml:18-19` (3→20) and `:27`/`:34` (70% / 80%).
>
> **Redis is not part of the shipping app at all.** No file under `frontend/src` names it;
> Auth.js issues a **JWT** session rather than using a server-side session store
> (`frontend/src/lib/auth/config.ts:24`), and route-handler responses are cached by Next's
> own `next: { revalidate: N }`. So "stateless because sessions are in Redis", the pub/sub
> WebSocket fan-out and the `allkeys-lru` degradation story have nothing left to describe —
> and the app opens no WebSocket in any case.
>
> **The Database Connection Pooling figures were wrong for the backend too**, which is
> worth knowing before anyone reuses the arithmetic: `backend/app/db/session.py:44-48` sets
> `max_overflow` from `DATABASE_MAX_OVERFLOW`, whose default is **10**
> (`backend/app/config.py:65`) and not 40, and hardcodes `pool_recycle=1800`, not 3600. The
> real per-pod ceiling was 30, so the derived 180 and 1200 totals never held at any pod
> count. **Today the ceiling is one number in one file:** `max: 10` in
> `frontend/src/lib/db/index.ts:37`, one `postgres-js` pool per app instance, stashed on
> `globalThis` to survive hot reload.

### Horizontal Scaling

The FastAPI backend is stateless (sessions stored in Redis, no local state). It can be scaled horizontally without coordination. The Kubernetes HPA scales from 3 to 20 replicas based on CPU (>70%) and memory (>80%) utilization.

WebSocket connections use Redis pub/sub for fan-out, meaning any backend pod can serve any client's subscription. There is no sticky session requirement.

### Vertical Scaling Limits

**PostgreSQL / TimescaleDB** is the primary vertical scaling concern. TimescaleDB's chunk-based compression reduces storage by 90–95% for time-series data, but query performance degrades as the dataset grows without proper index maintenance. Partition pruning via time-range queries is essential for maintaining query performance at scale.

**Redis** memory is the primary constraint for the caching layer. With maxmemory set to allkeys-lru eviction, the system degrades gracefully under memory pressure (cache miss rate increases, but correctness is maintained).

### Database Connection Pooling

The backend uses SQLAlchemy async connection pooling:
- Pool size: 20 connections per pod
- Max overflow: 40 additional connections
- Pool recycle: 3600s (prevents stale connections)
- Pre-ping: enabled (validates connections before use)

With 3 backend pods, the maximum sustained connection count to PostgreSQL is approximately 180 connections (3 pods × 60 max connections). The HPA can scale to 20 pods × 60 = 1200 max connections, which is within Aurora PostgreSQL's max_connections of 5000 for `db.r6g.large`.

---

## Failure Modes and Resilience

> **Correction, 2026-09-22.** **This table names seven mitigations and the app has none of
> them.** That matters more here than anywhere else on this page: a failure-modes table is
> read during an incident, when there is no time to discover it is describing 2026-07.
>
> **Six of the seven rows are about components that do not run.** Redis, Aurora, EKS nodes,
> the ALB and Celery workers are all covered above — Redis and the ALB appear nowhere in
> `frontend/src`, Aurora and EKS were never provisioned, and Celery was never written in
> code at all. The Chainlink row is the sixth: the backend had a `chainlink.py` client and
> is frozen, and the only "chainlink" left in the shipping app is CoinGecko's **coin id for
> the LINK token** (`frontend/src/lib/api/live/coingeckoIds.ts:88`), not an oracle price
> feed. There is no oracle to go stale and no fallback to make.
>
> **The CoinGecko row is the one with a live counterpart, and it is wrong in the detail a
> reader would act on: no stale-data alert fires after 3 minutes, or at all.**
> `/live-data/alerts` generates exactly two alert types, `depeg` and `price_move`
> (`frontend/src/app/live-data/alerts/route.ts:12`), and the comment above that line records
> why the others are gone — they "were never implemented — removed so the contract is
> honest". What an upstream failure actually produces today is a per-route fallback or a
> disclosed "not available" state, recorded per surface in `DATA-AVAILABILITY.md`.

| Component | Failure Mode | Mitigation |
|---|---|---|
| CoinGecko API down | Price data becomes stale | Fallback to cached prices; stale-data alert fires after 3 minutes |
| Redis down | Cache misses, sessions lost | Backend falls through to PostgreSQL; graceful degradation |
| PostgreSQL writer down | Write failures | Aurora auto-failover to reader (< 30s); brief write outage |
| Single EKS node down | Pod eviction | Anti-affinity ensures replicas on different nodes; HPA maintains min 3 replicas |
| Celery worker down | Delayed data updates | Beat scheduler retries tasks; dead-letter queue captures failures |
| Chainlink oracle stale | Stale on-chain prices | Fallback to CoinGecko prices; staleness logged and alerted |
| ALB unhealthy | Traffic routed to healthy targets | ALB health checks every 30s; unhealthy targets drained within 60s |

---

## API Design Principles

> **Correction, 2026-09-22.** **Five of these six conventions describe the retired FastAPI
> API and are followed nowhere in the shipping app** — and this is the section most likely
> to be acted on, because unlike the rest of the page it names a surface that is *not*
> retired. `/api/v1/` is live and shipping (`frontend/src/app/api/v1/`), so a contributor
> reading this as the house style would build a route against rules nothing else obeys.
>
> Searched across all of `frontend/src` on 2026-09-22: **`Idempotency-Key`, `cursor`,
> `filter[...]` and RFC 7807 / `application/problem+json` occur zero times each, in any
> file.** The real error shape is a flat `{ error: "<message>" }` with a plain status —
> `frontend/src/app/api/v1/prices/route.ts:32` is representative — plus a `details[]` array
> on the one validating endpoint, `POST /api/v1/options/score`, which returns every problem
> found rather than the first (`api/v1/openapi.json/route.ts:209,220`). List endpoints take
> flat query parameters (`?coins=`, `?tier=`, `?coin=&category=`) and a `limit`, never a
> cursor. **There is no rate limiting on `/api/v1/` at all**: no route under it has a 429
> path. Per-IP limits do exist in `frontend/src/lib/server/apiGuard.ts`, but they guard the
> agent, config and pump-report surfaces — not this API, and not by authenticated-vs-anonymous.
>
> **Versioning is the one that holds.** The API really is at `/api/v1/`, and the OpenAPI 3.0
> spec really is served at `/api/v1/openapi.json`. Treat the other five lines as a design
> intent that was never implemented on either service, not as a contract to match.

The REST API follows these conventions:
- **Versioning**: URI-based (`/api/v1/`). Breaking changes increment the version.
- **Pagination**: Cursor-based pagination for lists (`cursor` + `limit` parameters).
- **Error format**: RFC 7807 Problem Details (`type`, `title`, `status`, `detail`, `instance`).
- **Idempotency**: Mutation endpoints accept `Idempotency-Key` headers for safe retries.
- **Rate limiting**: Per-user: 100 req/min for authenticated; 20 req/min for unauthenticated.
- **Filtering**: Query parameters follow `filter[field]=value` convention for list endpoints.

---

## Decision Log

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| Time-series storage | TimescaleDB | InfluxDB, QuestDB, ClickHouse | PostgreSQL compatibility; SQLAlchemy support; avoid polyglot persistence |
| Task queue | Celery + Redis | Dramatiq, RQ, Temporal | Ecosystem maturity; built-in beat scheduler; broad documentation |
| Frontend framework | Next.js 15 | Vite+React SPA, Remix | SSR for SEO; App Router for server components; Vercel ecosystem |
| Container orchestration | EKS | ECS, self-managed k8s | Managed control plane; Helm ecosystem; team familiarity |
| IaC tool | Terraform | Pulumi, CDK | Provider ecosystem; module registry; team familiarity |
| Reverse proxy | Nginx | Traefik, Caddy | Proven performance; flexible rate limiting; extensive documentation |
