# Incident Response Runbooks

> **Correction, 2026-09-20.** Three of the four runbooks below are written for a
> Kubernetes cluster on AWS, an Aurora database and an on-call analyst. **As of
> 2026-09-20 none of those exist.** EKS, Aurora and the `fn` namespace were designed
> and never provisioned: `infrastructure/terraform/` carries `eks.tf` and `rds.tf`, but
> there is no `*.tfstate`, no `*.tfvars` and no `.terraform/` anywhere under
> `infrastructure/`, and the S3 state backend `fn-terraform-state` that `main.tf:50`
> declares was never created either; `docs/deployment/aws-provisioning.md:12-17` records
> that `CD — Deploy to Staging` ran on every push to `main` from 2026-07-18 and failed
> every time — 90 runs, zero successes; and both `.github/workflows/cd-staging.yml` and
> `cd-production.yml` state in identical headers that they describe "a two-service
> Kubernetes deployment to AWS infrastructure that has never been provisioned".
> (`cd-staging.yml:87` is additionally gated on the repository variable
> `STAGING_DEPLOY_ENABLED`, which has never been set. `cd-production.yml`'s header claims
> the same gate but carries none — it fires on `v*` tags and is stopped only by the
> missing `AWS_ACCOUNT_ID` secret. Note also that `infrastructure/kubernetes/secrets.yaml`
> holding only `<REPLACE_WITH_…>` placeholders is *not* evidence either way: that file
> says on its own first line that real secrets must never be committed.)
>
> This was **never built** — not retired. The distinction matters at 3am: "retired" would
> tell a responder there is a cluster to reach.
>
> **`fn-backend` is the one thing here that genuinely was retired**, and it is frozen
> rather than deleted (owner decision D2, 2026-09-14 — `backend/FROZEN.md`). So every
> `kubectl … fn-backend` line below names a retired service on a cluster that was never
> created.
>
> **Nothing pages.** As of 2026-09-20 PagerDuty exists in this repo as a Terraform
> variable defaulting to `""` (`infrastructure/terraform/variables.tf:278`), as a
> `routing_key_file` in an Alertmanager config that has no Kubernetes manifest and no
> entry in `docker-compose.prod.yml`
> (`infrastructure/monitoring/alertmanager/alertmanager.yml:123`), and as a box in the
> diagram at `docs/architecture/overview.md:79`. There is no on-call rotation, no
> institutional-client alert list and no ticketing system; outside these runbooks and the
> 2026-09-07 audit that quotes them, "on-call" appears nowhere in this repository.
>
> A runbook is read during an incident, when there is no time to discover it is fiction.
> **The fourth runbook, "Upstream Data Source Unreachable", is the exception — it is
> first-hand, current as of 2026-09-20, and describes the system that actually runs. Do
> not discard it with the rest.** Per `docs/agents/checklist-steward.md:36` the remainder
> is bannered, not deleted: the provisioning intent is the record. Corrections are marked
> inline and dated below. Whether to provision real paging or descope these procedures to
> their actual single-operator shape is an open owner decision (task-queue T-379, parked
> with the rollout gate on 2026-09-05).

## Severity Classification

| Severity | Definition | Response Time |
|----------|-----------|---------------|
| **P0 - Critical** | Platform down / data integrity breach | 15 minutes |
| **P1 - High** | Major feature unavailable / significant data lag | 1 hour |
| **P2 - Medium** | Degraded performance / non-critical pipeline failure | 4 hours |
| **P3 - Low** | Minor issues / cosmetic bugs | Next business day |

---

## Runbook: Stablecoin Depeg Alert

**Trigger**: `depeg` alert with severity `critical` (>100 bps deviation).

**Step 1 — Verify**
```bash
# Check raw price from CoinGecko directly
curl "https://api.coingecko.com/api/v3/simple/price?ids=<coin-id>&vs_currencies=usd"

# Compare to Finance Now's own reading.
# ⚠ 2026-09-20: this block used to read
#     curl -H "Authorization: Bearer $ADMIN_TOKEN" \
#       https://api.financenow.example.com/api/v1/market-data/<asset-id>/latest
#   — an example.com placeholder host, and an endpoint that was never built.
#   frontend/src/app/api/v1/ holds exchanges, macro, network-fees, news, options,
#   prices, securities, staking and transfer. There is no market-data route.
#   (The app's admin variable is also FN_ADMIN_TOKEN, not ADMIN_TOKEN — see
#   frontend/src/lib/server/apiGuard.ts:72.)
#
# The depeg alert originates here, and this is the only endpoint that covers
# every monitored stablecoin:
curl http://localhost:3000/live-data/alerts
#
# /api/v1/prices accepts ONLY these 16 tickers (prices/route.ts:7):
#   btc eth usdt usdc bnb sol dai xrp ltc trx doge matic avax ada dot atom
# Of the 14 stablecoins live-data/alerts watches, it covers USDT, USDC and DAI.
# Anything else — USDe, USDS, FDUSD, FRAX, PYUSD, crvUSD, GHO, TUSD, USDP,
# GUSD, LUSD — returns HTTP 400 "No valid coins specified".
curl "http://localhost:3000/api/v1/prices?coins=usdc"   # usdt | usdc | dai only
#
# For any other monitored stablecoin, take its CoinGecko id from the STABLECOINS
# table in frontend/src/app/live-data/alerts/route.ts (e.g. gho, crvusd,
# paxos-standard for USDP) and use it with the Step-1 CoinGecko call above.
```

**Step 2 — Assess Impact**
- Check DefiLlama for on-chain TVL changes
- Check Dune Analytics for redemption queue volume
- Verify alert was triggered from validated data source (not a bad data point)

**Step 3 — Validate Data Pipeline**

> ⚠ **2026-09-20:** `fn-backend` is the retired FastAPI service (D2, 2026-09-14 —
> `backend/FROZEN.md`) and there is no cluster to run `kubectl` against. The live
> equivalent is the audit harness, and it answers a better question: it classifies
> **REAL vs FALLBACK** rather than reporting HTTP status, and a 200 carrying fallback
> data is exactly the failure mode that sends this investigation to the wrong layer.
> Run from `frontend/`:
>
> ```bash
> npm run audit          # npm run smoke for the quick subset
> ```

```bash
# Retained as the record of what was designed: the retired backend, on the EKS
# cluster that was never provisioned.
kubectl logs -l app=fn-backend -n fn | grep "coingecko" | tail -50
```

**Step 4 — Escalate if Confirmed**

> ⚠ **2026-09-20: none of the three paths below exists.** PagerDuty appears in this
> repo only as `pagerduty_integration_key` (default `""`,
> `infrastructure/terraform/variables.tf:278`), as a `routing_key_file` in an
> Alertmanager config deployed nowhere (`infrastructure/monitoring/alertmanager/`
> — no Kubernetes manifest, absent from `docker-compose.prod.yml`, present only in the
> dev `docker-compose.yml`), and as a box in the diagram in
> `docs/architecture/overview.md`. There is no on-call rotation, no institutional-client
> alert list and no ticketing system; "institutional clients" appear in these runbooks
> and nowhere in the application. **In practice this is a single-operator system and
> the escalation is you.** Provisioning real paging or descoping these steps is an open
> owner decision (task-queue T-379).

- Page on-call analyst via PagerDuty
- Notify institutional clients via alert email if deviation > 200 bps for > 30 minutes
- Document in incident ticket

---

## Runbook: API Outage

**Trigger**: Error rate > 5% for 5+ minutes OR health check failing.

> ⚠ **2026-09-20: every step below is unrunnable as written.** All five drive `kubectl`
> against namespace `fn` and deployment `fn-backend`: the namespace has never been
> created (`infrastructure/kubernetes/namespace.yaml` exists, was never applied) and
> `fn-backend` is retired (D2 — `backend/FROZEN.md`). Steps are kept as the
> provisioning intent. For the app as it actually runs — one Next.js process — the
> equivalents are the process itself, `npm run audit` from `frontend/` for route health,
> and `frontend/restart-dev.ps1` to restart (it also clears the `.next` lock OneDrive
> causes). There is no Redis and no separate database pod to exec into.

**Step 1 — Check pod status**
```bash
kubectl get pods -n fn
kubectl describe pod <failing-pod> -n fn
```

**Step 2 — Check logs**
```bash
kubectl logs -l app=fn-backend -n fn --tail=200 | grep "ERROR\|CRITICAL"
```

**Step 3 — Check database**
```bash
kubectl exec -it postgres-0 -n fn -- psql -U fn -c "SELECT count(*) FROM pg_stat_activity;"
# High connection count may indicate pool exhaustion
```

**Step 4 — Restart if necessary**
```bash
kubectl rollout restart deployment/fn-backend -n fn
kubectl rollout status deployment/fn-backend -n fn
```

**Step 5 — Scale up if load-related**
```bash
kubectl scale deployment fn-backend --replicas=10 -n fn
```

---

## Runbook: Database Failover

**Trigger**: Primary RDS instance unavailable.

> ⚠ **2026-09-20: there is no RDS instance.** `infrastructure/terraform/rds.tf:156`
> defines the cluster as `${local.name_prefix}-aurora`, and `main.tf:132` makes that
> prefix `${project_name}-${environment}` — which is where the authentic-looking name
> `fn-staging-aurora` below comes from. The plan was never applied: no `*.tfstate`, no
> `*.tfvars`, no `.terraform/` anywhere under `infrastructure/`, and the S3 state backend
> `fn-terraform-state` the config declares does not exist either. The database this app
> uses is whatever `DATABASE_URL` points at, owned by the frontend's drizzle schema.
> **Aurora's ~30-second automatic replica promotion is a property of a cluster nobody
> has created — do not plan a recovery around it.**

Aurora automatically promotes a read replica within ~30 seconds. To verify:
```bash
aws rds describe-db-clusters --db-cluster-identifier fn-staging-aurora \
  --query 'DBClusters[0].DBClusterMembers[*].{Instance:DBInstanceIdentifier,Writer:IsClusterWriter}'
```

If manual intervention is required:
```bash
aws rds failover-db-cluster --db-cluster-identifier fn-staging-aurora
```

**Post-failover**: Update `DATABASE_URL` in Kubernetes secret if the writer endpoint changed.

---

## Alert Escalation Matrix

| Alert Type | P0 | P1 | P2 |
|-----------|----|----|-----|
| API health check failure | ✅ Page | | |
| Depeg > 200 bps | ✅ Page | | |
| Depeg 50–200 bps | | ✅ Notify | |
| DB connections > 90% | ✅ Page | | |
| Redis memory > 90% | | ✅ Notify | |
| Pipeline lag > 30 min | | ✅ Notify | |
| Score staleness > 1 hour | | | ✅ Ticket |

> ⚠ **2026-09-20: this matrix routes to systems that do not exist, and three rows name
> subsystems that do not either.** Two of those three are removals from the system that
> once ran; one was never in the current app at all.
>
> - **Score staleness** — there is no scoring engine. The Prometheus rule behind this
>   row (`RiskScoringEngineStale`) reads `fn_scoring_last_update_timestamp`, a metric
>   emitted by the retired backend, and the current app publishes no composite risk
>   score anywhere (RP-6, 2026-08-29; D14, 2026-09-14 — guarded by
>   `lib/risk/__tests__/riskScoringRemoved.test.ts`).
> - **Redis memory** — the Next.js app uses no Redis; `frontend/package.json` carries no
>   such dependency. Redis survives in `infrastructure/` manifests and the dev
>   `docker-compose.yml` as part of the backend-era stack.
> - **Pipeline lag** — there are no scheduled pipelines. Data is fetched per request by
>   the `/live-data/*` route handlers; no scheduler or cron package is installed.
>
> **And where this table does map to a written rule, it disagrees with it.**
> `infrastructure/monitoring/prometheus/rules/fn-alerts.yml`:
>
> | Row | Rule | Rule fires at | This table says |
> |---|---|---|---|
> | API health check failure | `APIDown` | `up{job="fn-backend"} == 0` | Page |
> | Depeg > 200 bps | *none* | — | Page |
> | Depeg 50–200 bps | *none* | — | Notify |
> | DB connections > 90% | `HighDatabaseConnections` | **80%** | 90% |
> | Redis memory > 90% | `RedisHighMemoryUsage` | **80%** | 90% |
> | Pipeline lag > 30 min | nearest: `PriceDataStale` | **180 s** | 30 min |
> | Score staleness > 1 hour | `RiskScoringEngineStale` | **600 s (10 min)** | 1 hour |
>
> Neither depeg row has a rule at all — the depeg alert is generated in the app, by
> `frontend/src/app/live-data/alerts/route.ts`, and never reaches Prometheus. Every API
> rule scrapes `job="fn-backend"`, the retired service, and the business rules read
> `fn_scoring_last_update_timestamp`, `fn_price_last_update_timestamp` and
> `fn_websocket_connections_total` — metrics only that backend ever emitted. As of
> 2026-09-20 nothing scrapes any of it, so the disagreements are harmless; they stop
> being harmless the day someone provisions Prometheus and trusts this table.

---

## Runbook: Upstream Data Source Unreachable

**Trigger**: A surface shows a labelled estimate or "not available" where it used to
show live data, or `npm run audit` reports FALLBACK/FAIL on a route that previously
passed.

**Read this first.** The app cannot distinguish "the provider is down" from "your
network is blocked from reaching it", because both look identical from inside: the
connection is dropped, the fetch times out, and the route falls back to a labelled
estimate exactly as designed. Diagnosing which requires testing the layers separately.

Do NOT change code before completing Step 1. On 2026-09-10 three plausible explanations
(host down, DNS hijacked, route blackholed) were each disproven in turn, and the actual
cause was a VPN.

**Step 1 — Check what the internet sees you as**
```bash
curl -s https://api.ipify.org
curl -s "http://ip-api.com/json/<that-ip>?fields=isp,org,as,proxy,hosting"
```
If `proxy` or `hosting` is `true`, you are on a VPN/datacenter IP. Many providers refuse
those ranges silently. **Turn it off and retry before anything else** — this is the
single most common cause and costs 30 seconds to rule out.

**Step 2 — Test each layer, in order. They fail differently.**
```bash
# DNS — compare three resolvers. Agreement rules out interception.
nslookup <host>
nslookup <host> 1.1.1.1
nslookup <host> 8.8.8.8

# TCP — can a socket open at all? Test both ports.
timeout 6 bash -c "exec 3<>/dev/tcp/<ip>/443" && echo CONNECTED || echo blocked
timeout 6 bash -c "exec 3<>/dev/tcp/<ip>/80"  && echo CONNECTED || echo blocked

# Route — do packets even arrive?
tracert -h 15 -w 600 -d <ip>

# Control — is anything reaching the internet?
curl -s -o /dev/null -w "%{http_code}\n" https://api.coingecko.com/api/v3/ping
```

**Step 3 — Read the pattern**

| Symptom | Means |
|---|---|
| Traceroute **completes** but TCP never connects | The host is **filtering you**, not down. ICMP is answered, TCP is dropped — the signature of an IP/range block |
| Fails in <100ms, both v4 and v6 | Refused at the edge (often Cloudflare). Usually a per-IP rate-limit ban |
| Times out at 20s+ | Packets are being silently discarded — a firewall, not a refusal |
| All three resolvers agree | DNS is fine. Stop looking there |
| Control host also fails | The problem is your connection, not the provider |

**Step 4 — Rate-limit bans are self-inflicted more often than you'd think**

A burst of requests earns a per-IP ban, and the *next* run then records "provider down".
`npm run audit` is itself capable of triggering this — it hit `publicnode.com` on
2026-09-10. If a host worked an hour ago and now refuses instantly, suspect this before
suspecting an outage. Wait, then retest.

**Step 5 — Only now consider it a real outage**

If the egress is clean, DNS agrees, TCP is refused, and it has not recovered, record it
in `DATA-AVAILABILITY.md` with the evidence — **and state which layer failed**, because
"unreachable" alone sends the next person through all four steps again.

⚠ **A verdict from one machine is not a verdict about the source.** Confirm from a second
network before recording a provider as down. Both the mempool.space and publicnode
failures of 2026-09-10 were IP-scoped, and neither host was ever down.
