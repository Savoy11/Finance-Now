# Finance Now Data Flow Documentation

> **Correction, 2026-09-20.** This document diagrams six live pipelines: Celery Beat
> dispatching price-fetch, scoring and alert workers every 60s/300s/30s; a
> `price_history` hypertable under compression and retention policies; a Redis `MSET`
> cache and `PUBLISH` fan-out to a `WebSocketManager`; alert cooldowns and an email
> queue; RS256 sessions in Redis; and Parquet archival to `s3://fn-data`, queryable
> through Athena. **As of 2026-09-20, none of it runs, and most of it was never
> built.** The 2026-09-20 accuracy sweep (`ed54f11`) tagged the line below "see the
> banner below" and then did not add one. This is the banner that pointer promised.
>
> **Retired — built, ran, stopped by a decision.** The FastAPI backend is frozen, not
> deleted (owner decision D2, 2026-09-14 — `backend/FROZEN.md`). It genuinely carried a
> scheduler (`backend/app/pipelines/scheduler.py`), a scoring engine
> (`backend/app/scoring/`), an alerts model and API (`backend/app/models/alert.py`,
> `backend/app/api/v1/alerts.py`), a WebSocket surface
> (`backend/app/api/v1/websocket.py` plus `app/streaming/manager.py`) and TimescaleDB
> hypertables (`backend/app/db/migrations/versions/001_initial.py`). As of 2026-09-20
> nothing in the app calls it, and the `/api/*` proxy rewrite that reached it was
> removed at D2 (`frontend/next.config.mjs:19`). No CI job builds it: `ci.yml`'s
> `backend-lint` and `backend-test` were deleted at D2 (`ci.yml:28`) and its
> `docker-build` job builds the frontend image only — though both CD workflows still
> contain a "Build and push backend image" step (`cd-staging.yml:148`), gated off and
> never once successful. Read the whole paragraph narrowly: it ran locally and in dev,
> and was **never deployed** — `CD — Deploy to Staging` failed all 90 times against
> infrastructure nobody provisioned (`docs/deployment/aws-provisioning.md`).
>
> **Never built — nobody wrote it, in that backend or anywhere since.** Checked by grep
> across `backend/`, `frontend/src/` and `infrastructure/` on 2026-09-20:
>
> | This document diagrams | The tree has |
> |---|---|
> | Celery Beat, `PriceFetchWorker`, `ScoringWorker`, `AlertWorker` | **No Celery anywhere.** `backend/pyproject.toml:24` pins `apscheduler = "^3.10.4"`; `scheduler.py` registers **three** APScheduler jobs — `market_data`, `onchain_metrics`, `risk_scores` — on settings-driven intervals defaulting to 5 min, 15 min and 1 hour (`backend/app/config.py:137-139`). Not 60s/300s/30s, and none of those four class names exists in the repo |
> | Redis `MSET` price cache, `PUBLISH channel:price_updates`, `WebSocketManager` | **No pub/sub at all.** `backend/app/` contains no publish call; Redis served rate limiting, auth sessions and config. The real class is `ConnectionManager` (`app/streaming/manager.py:27`), an in-process `defaultdict` registry that was never a Redis subscriber |
> | `price_history` / `asset_scores` tables, `add_compression_policy`, `add_retention_policy` | **In none of the four migrations.** `001_initial.py` creates `users, assets, market_data, reserve_attestations, risk_scores, liquidity_metrics, blockchain_metrics, wallet_concentration, alerts, watchlists, api_keys, audit_logs`, puts hypertables on four of those, and calls neither policy function; `002`–`004` add no hypertable and no policy. `price_history` survives in the tree only as the agent tool name `get_price_history` |
> | The five-factor composite — Volatility .30 / Liquidity .25 / DeFi .25 / MktCap .15 / Sentiment .05 | **Four different factors.** `backend/app/scoring/weights.py`: `reserve_transparency` .35, `peg_liquidity` .30, `network_velocity` .20, `security_compliance` .15. The formula in §2 never described this system |
> | Six alert types, per-type cooldowns, `EmailQueue` | **None of these six, and no evaluator — but alerts as such were built.** Five of the six strings (`price_above`, `price_below`, `price_change_pct`, `risk_score_below`, `tvl_change`) appear in this file and nowhere else; the sixth, `depeg_event`, matches only `detect_depeg_events()` in `backend/app/analytics/peg_stability.py`, a peg-analytics function, not an alert type. "cooldown" appears nowhere in `backend/app/`, there is no `EmailQueue`, and the scheduler has no alert job. What the frozen backend does have is a different taxonomy: an `alerts` table whose enum holds seven values (`001_initial.py:33`) against ten differently-named ones in `backend/app/models/alert.py:17`. As of 2026-09-20 the live `/live-data/alerts` emits `depeg` and `price_move`, computed per request |
> | RS256 JWTs | `backend/app/config.py:36` — `ALGORITHM: str = "HS256"` |
> | `s3://fn-data/...` Parquet cold storage via Athena | **Never provisioned.** The only `aws_s3_bucket` in `infrastructure/terraform/` is the Terraform **state** bucket (`bootstrap/main.tf:74`); `s3://fn-data` and "athena" appear nowhere else in this repository |
>
> Accurate, and worth saying so rather than sweeping it in: §5's nginx limit is real
> config — `infrastructure/docker/nginx/nginx.conf:94` sets `auth_limit … rate=10r/m`,
> applied at line 163. As of 2026-09-20 it is in no request path.
>
> **Why this document in particular.** The line below names *incident responders* as an
> audience. A responder reading it would go hunting for a Celery queue, a Redis channel
> and an Athena archive — three things to check, under time pressure, none of which has
> ever existed. That is the failure the backup-restore runbook was corrected for on
> 2026-09-08, and the reason there is the reason here: these documents are read during
> an incident, when there is no time to discover they are fiction.
>
> **What the data path is, as of 2026-09-20.** Client component → TanStack React Query,
> polling on `staleTime`/`refetchInterval` → one of the **58** route handlers under
> `frontend/src/app/live-data/` (counted 2026-09-20) → the public provider API. No
> broker, no worker, no queue, no cache layer and no socket: the app opens no WebSocket,
> and `frontend/src/lib/feed/useFeedStatus.ts` derives feed health from React Query's own
> cache. User data goes through `/api/user/*` to Postgres via Drizzle, `/api/v1/*` is the
> agent-facing read of those same routes, and sign-in is Auth.js against the app's own
> `users` table.
>
> **Kept as a design record, not corrected into a description**, per
> `docs/agents/checklist-steward.md`: *"Never rewrite a design rationale — add a dated
> banner when the tree contradicts it."* Kept rather than deleted under the owner's
> standing rule against removing project files, the same posture as `backend/FROZEN.md`.
> **As of 2026-09-20 no decision has been taken to build any of this**, and §2 would not
> be revisited in any case: per-coin risk scores were removed by decision (RP-6,
> 2026-08-29) and the remaining composites by D14, 2026-09-14.

## Overview

This document provides detailed sequence diagrams — ⚠ **HISTORICAL, see the correction banner above** — and narrative descriptions for every major data flow in the Finance Now platform. It was written for backend engineers, data engineers, and incident responders who need to understand how data moves through the system — but **incident responders should stop at the banner**: as of 2026-09-20 none of the pipelines below run, and the live path has no broker, no worker, no queue and no socket to check.

---

## 1. Real-Time Price Ingestion Pipeline

### Actors
- **Celery Beat**: Periodic task scheduler running on a dedicated container
- **PriceFetchWorker**: Celery worker task
- **CoinGecko API**: External price data provider (rate limit: 30 req/min free tier; 500 req/min Pro)
- **TimescaleDB**: PostgreSQL with time-series extension for price history
- **Redis**: Cache layer and pub/sub broker
- **WebSocket Manager**: Async pub/sub manager inside FastAPI

### Sequence

```
CeleryBeat (60s interval)
  │
  ├─── dispatch_task(FetchPricesTask)
  │
PriceFetchWorker
  │
  ├─── coingecko.get_prices(ids=[...], vs_currencies=["usd"])
  │    │   GET https://api.coingecko.com/api/v3/simple/price
  │    │   Response: { "bitcoin": {"usd": 67500.12}, "ethereum": {...} }
  │    │
  │    └─── [on rate limit 429] → exponential backoff + retry (max 3 attempts)
  │
  ├─── [batch write] TimescaleDB
  │    INSERT INTO price_history (asset_id, timestamp, price_usd, volume_24h, market_cap)
  │    VALUES ($1, NOW(), $2, $3, $4)
  │    ON CONFLICT DO NOTHING
  │
  ├─── [parallel] Redis MSET
  │    price:bitcoin    → "67500.12"    (EX 30s)
  │    price:ethereum   → "3420.87"    (EX 30s)
  │    price_updated_at → "1700000000" (EX 60s)
  │
  └─── Redis PUBLISH "channel:price_updates" 
       payload: {"assets": [{"id": "bitcoin", "price": 67500.12, "ts": 1700000000}]}

WebSocketManager (subscribed to Redis pub/sub)
  │
  └─── on_message(channel="channel:price_updates", data=payload)
       └─── for each subscribed_connection in subscriptions["price_updates"]:
            └─── await connection.send_json(price_event)
```

### Error Handling

- **CoinGecko 429 (rate limited)**: The worker backs off using exponential backoff (1s, 2s, 4s) and retries. After 3 failures, the task is marked failed and retried by Celery with `max_retries=5`.
- **Database write failure**: The worker logs the error and raises an exception. Celery retries the task. Price data is not lost — the next successful fetch will write the current price.
- **Redis connection failure**: The price cache update is skipped. The API falls through to PostgreSQL for subsequent requests. An alert fires if Redis is down for more than 60 seconds.

---

## 2. Risk Score Computation Pipeline

### Actors
- **Celery Beat**: Triggers scoring tasks every 5 minutes per asset
- **ScoringWorker**: Processes scoring tasks
- **AnalyticsEngine**: Core scoring computation module
- **TimescaleDB**: Source of historical price and volume data
- **Redis**: Score cache

### Composite Score Formula

```
CompositeScore(asset) = weighted_sum([
    VolatilityScore     × 0.30,   # Lower volatility → higher score
    LiquidityScore      × 0.25,   # Higher liquidity → higher score
    DefiMetricsScore    × 0.25,   # Higher TVL, lower utilization risk → higher score
    MarketCapScore      × 0.15,   # Larger market cap → higher score
    SentimentScore      × 0.05,   # Social + on-chain sentiment signals
])
```

All component scores are normalized to [0, 100].

### Sequence

```
CeleryBeat (300s interval)
  │
  ├─── for each asset_id in active_assets:
  │    dispatch_task(ComputeRiskScoreTask, asset_id=asset_id)
  │
ScoringWorker (per asset)
  │
  ├─── [parallel fetch]
  │    ├─── PostgreSQL: 
  │    │    SELECT timestamp, close_price, volume
  │    │    FROM price_history 
  │    │    WHERE asset_id = $1 AND timestamp > NOW() - INTERVAL '90 days'
  │    │    ORDER BY timestamp ASC
  │    │
  │    ├─── defillama.get_tvl_history(protocol_slug)
  │    │    GET https://api.llama.fi/protocol/{slug}
  │    │
  │    └─── Redis: GET price:{asset_id}  (current price for normalization)
  │
  ├─── VolatilityEngine.compute(price_series)
  │    ├─── rolling_std_30d = price_series[-30d:].pct_change().std() * sqrt(365)
  │    ├─── rolling_std_90d = price_series[-90d:].pct_change().std() * sqrt(365)
  │    └─── volatility_score = normalize_to_100(rolling_std_30d, low=0.1, high=3.0)
  │
  ├─── LiquidityEngine.compute(volume_series, current_price)
  │    ├─── avg_daily_volume = volume_series[-30d:].mean()
  │    ├─── volume_to_mcap = avg_daily_volume / market_cap
  │    └─── liquidity_score = normalize_to_100(volume_to_mcap)
  │
  ├─── DefiMetricsEngine.compute(tvl_series)
  │    ├─── current_tvl = tvl_series.iloc[-1]
  │    ├─── tvl_change_30d = (current_tvl - tvl_series[-30d]) / tvl_series[-30d]
  │    └─── defi_score = normalize_to_100(current_tvl + tvl_change_30d_weight)
  │
  ├─── CompositeScore = weighted_sum([...])
  │
  ├─── PostgreSQL: 
  │    INSERT INTO asset_scores (asset_id, computed_at, composite_score, 
  │                              volatility_score, liquidity_score, defi_score)
  │    ON CONFLICT (asset_id) DO UPDATE SET ...
  │
  └─── Redis: SET score:{asset_id} {score_json} EX 300
```

---

## 3. Alert Evaluation and Delivery Pipeline

### Alert Types Supported

| Type | Trigger Condition | Example |
|---|---|---|
| `price_above` | Current price > threshold | BTC > $70,000 |
| `price_below` | Current price < threshold | ETH < $2,000 |
| `price_change_pct` | % change in time window > threshold | BTC +10% in 1h |
| `risk_score_below` | Composite score < threshold | Asset score < 30 |
| `tvl_change` | TVL change > threshold in window | Protocol TVL -20% in 24h |
| `depeg_event` | Stablecoin price deviation > 0.5% | USDC < 0.995 |

### Sequence

```
CeleryBeat (30s interval)
  │
  └─── dispatch_task(EvaluateAlertsTask)

AlertWorker
  │
  ├─── PostgreSQL:
  │    SELECT a.*, u.notification_preferences
  │    FROM alerts a JOIN users u ON a.user_id = u.id
  │    WHERE a.enabled = true AND a.status != 'cooldown'
  │
  ├─── for each alert:
  │    │
  │    ├─── fetch current_value from Redis (price, score, etc.)
  │    │
  │    ├─── AlertConditionEvaluator.evaluate(alert.condition, current_value)
  │    │
  │    └─── if triggered:
  │         │
  │         ├─── PostgreSQL: INSERT INTO alert_events
  │         │    (alert_id, triggered_at, trigger_value, condition_snapshot)
  │         │
  │         ├─── PostgreSQL: UPDATE alerts SET 
  │         │    last_triggered_at = NOW(),
  │         │    status = 'cooldown'
  │         │    WHERE id = alert_id
  │         │
  │         ├─── Redis PUBLISH "user:{user_id}:alerts"
  │         │    payload: {alert_event}
  │         │
  │         └─── [if email notifications enabled]:
  │              EmailQueue.enqueue(AlertEmailTask, user_id, alert_event)
  │
WebSocketManager
  │
  └─── on_message(channel="user:{user_id}:alerts")
       └─── find WebSocket connection for user_id
            └─── await connection.send_json(alert_event)
```

### Alert Cooldown

To prevent notification spam, each alert has a cooldown period after triggering:
- `price_above` / `price_below`: 15-minute cooldown
- `price_change_pct`: 5-minute cooldown (high-frequency signal)
- `depeg_event`: 2-minute cooldown (urgent)
- `risk_score_below`: 60-minute cooldown

---

## 4. WebSocket Streaming Protocol

### Connection Lifecycle

```
Client                          FastAPI Backend                    Redis
  │                                    │                              │
  ├─── WSS /ws/stream?token=JWT ──────→│                              │
  │                                    ├─── Validate JWT              │
  │                                    ├─── Load user session         │
  │◄── 101 Switching Protocols ────────┤                              │
  │                                    ├─── Redis SUBSCRIBE ──────────→
  │                                    │    channels:                 │
  │                                    │    - channel:price_updates   │
  │                                    │    - user:{id}:alerts        │
  │                                    │                              │
  ├─── {"type":"subscribe",           │                              │
  │     "channels":["BTC","ETH"]} ────→│                              │
  │                                    ├─── track subscription        │
  │◄── {"type":"subscribed",...} ──────┤                              │
  │                                    │                              │
  │   (60 seconds later)              │                              │
  │◄── {"type":"ping"} ───────────────┤                              │
  ├─── {"type":"pong"} ──────────────→│                              │
  │                                    │                              │
  │   (price update arrives)          │◄── PUBLISH price_updates ───┤
  │◄── {"type":"price","asset":"BTC"  │                              │
  │     "price":67500.12} ────────────┤                              │
  │                                    │                              │
  ├─── [client disconnects] ──────────→│                              │
  │                                    ├─── Redis UNSUBSCRIBE ────────→
  │                                    └─── cleanup connection         │
```

### Message Types (Client → Server)

| Type | Payload | Description |
|---|---|---|
| `subscribe` | `{"channels": ["price:BTC", "alerts"]}` | Subscribe to data channels |
| `unsubscribe` | `{"channels": ["price:ETH"]}` | Unsubscribe from channels |
| `pong` | `{}` | Heartbeat response |
| `ping` | `{}` | Client-initiated keepalive |

### Message Types (Server → Client)

| Type | Description |
|---|---|
| `price_update` | Real-time price change for subscribed assets |
| `score_update` | Risk score recalculated for an asset |
| `alert_triggered` | User alert condition fired |
| `ping` | Server keepalive (every 20s); client must pong within 10s |
| `error` | Subscription or protocol error |
| `connected` | Confirmation of WebSocket connection establishment |

---

## 5. Authentication Flow

```
Client                    Nginx                FastAPI              Redis/PostgreSQL
  │                          │                    │                        │
  ├─── POST /api/auth/login ─→│                    │                        │
  │    {email, password}      ├─── rate limit ────→│                        │
  │                           │    (10 req/min)     ├─── bcrypt verify ─────→│
  │                           │                    │    SELECT user WHERE   │
  │                           │                    │    email = $1          │
  │                           │                    │◄── {user_record} ──────┤
  │                           │                    │                        │
  │                           │                    ├─── generate JWT        │
  │                           │                    │    (RS256, 15min TTL)  │
  │                           │                    ├─── generate refresh    │
  │                           │                    │    (opaque, 7d TTL)    │
  │                           │                    │                        │
  │                           │                    ├─── Redis SETEX ────────→
  │                           │                    │    session:{jti}       │
  │                           │                    │    {user_data} EX 900  │
  │◄── 200 {access_token,     │◄───────────────────┤                        │
  │         refresh_token}    │                    │                        │
  │                           │                    │                        │
  │ (subsequent requests)     │                    │                        │
  ├─── GET /api/v1/assets     │                    │                        │
  │    Authorization: Bearer  │                    │                        │
  │    {jwt} ─────────────────→                    │                        │
  │                           │                    ├─── verify JWT sig      │
  │                           │                    ├─── Redis GET ──────────→
  │                           │                    │    session:{jti}       │
  │                           │                    │◄── {user_data} ────────┤
  │◄── 200 {assets} ──────────────────────────────┤                        │
```

---

## 6. Data Retention and Archival

> ⚠ **Never built — verified 2026-09-20. There is no archive to query, and nothing in this section is actionable during an incident.** `infrastructure/terraform/` declares exactly one `aws_s3_bucket`: `bootstrap/main.tf:74`, the Terraform **state** bucket. `s3://fn-data` and "athena" appear nowhere else in this repository. The two `add_*_policy` calls below are in no migration — all four files under `backend/app/db/migrations/versions/` were checked, and neither function is called anywhere in the tree; `001_initial.py` puts its hypertables on `market_data`, `liquidity_metrics`, `blockchain_metrics` and `wallet_concentration`, and `002`–`004` add no hypertable and no policy. The only `aws_cloudwatch_log_group` resources in Terraform are the two for ElastiCache (`elasticache.tf:185,193`). The table is kept as the retention design that was intended.

| Data Type | Hot Storage (TimescaleDB) | Cold Storage (S3) |
|---|---|---|
| Price history (tick data) | 90 days (compressed) | Indefinite (Parquet) |
| Asset scores | 365 days | Indefinite (Parquet) |
| Alert events | 90 days | 2 years |
| API access logs | 30 days (CloudWatch) | 1 year (S3) |
| User sessions | 15 minutes (Redis) | Not archived |
| Audit log | 365 days (PostgreSQL) | 7 years (S3, compliance) |

TimescaleDB compression is applied automatically via compression policies:
```sql
SELECT add_compression_policy('price_history', INTERVAL '7 days');
SELECT add_retention_policy('price_history', INTERVAL '90 days');
```

Archived data in S3 is organized by `s3://fn-data/{environment}/{table}/{year}/{month}/{day}/*.parquet` and queryable via AWS Athena.
