# Incident Response Runbooks

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

# Compare to Finance Now stored value
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.financenow.example.com/api/v1/market-data/<asset-id>/latest
```

**Step 2 — Assess Impact**
- Check DefiLlama for on-chain TVL changes
- Check Dune Analytics for redemption queue volume
- Verify alert was triggered from validated data source (not a bad data point)

**Step 3 — Validate Data Pipeline**
```bash
kubectl logs -l app=fn-backend -n fn | grep "coingecko" | tail -50
```

**Step 4 — Escalate if Confirmed**
- Page on-call analyst via PagerDuty
- Notify institutional clients via alert email if deviation > 200 bps for > 30 minutes
- Document in incident ticket

---

## Runbook: API Outage

**Trigger**: Error rate > 5% for 5+ minutes OR health check failing.

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
