# Scaling Runbook

> **Correction, 2026-09-20.** This runbook reads as the operating manual for a running
> cluster: `kubectl` against namespace `fn`, `aws rds` against `fn-staging-aurora`,
> `terraform apply` against a live ElastiCache group. **As of 2026-09-20, no cluster,
> Aurora cluster or ElastiCache replication group has ever existed.**
>
> The manifests, though, are real — this is not the `backup-restore.md` case.
> `infrastructure/kubernetes/backend/hpa.yaml` exists and its values match this page
> exactly: min 3, max 20, CPU 70%, memory 80%, 300-second scale-down. So does the apply
> path: `.github/workflows/cd-staging.yml:235-266` and `cd-production.yml:264-285`
> `kubectl apply` the whole Kubernetes tree, `hpa.yaml` included (`cd-staging.yml:256`,
> `cd-production.yml:274`). What has never existed is anything to apply them *to*.
> Staging is gated off behind `STAGING_DEPLOY_ENABLED`, which has never been set
> (`cd-staging.yml:87`); before that gate it ran on every push to `main` from 2026-07-18
> and failed every time — **90 runs, zero successes**, workflows "committed complete
> against infrastructure that was never provisioned"
> (`docs/deployment/aws-provisioning.md:12-15`). Production fires on `v*.*.*` tags, and
> as of 2026-09-20 the repository has none. `terraform/rds.tf:162` records that the
> caep → fn rename was safe because it happened "while no cluster exists".
>
> (Do not read the absence of `.tfstate`, `.terraform/` or `.tfvars` under
> `infrastructure/` as evidence either way. `main.tf:50` puts root-module state in an S3
> backend and `.gitignore:47-50` ignores all three patterns, so a fully provisioned
> account would look identical from here. The citations above are the load-bearing ones.)
>
> **So this is "never provisioned", not "retired".** Nothing here ran and was then
> stopped — it was designed on paper and never stood up, and as of 2026-09-20 no
> `kubectl` or `aws` command below has ever had a target. That is worth saying plainly,
> because a scaling runbook is read under load, when the reader has the least time left
> to discover that the cluster they are scaling is fiction.
>
> **The backend HPA is moot twice over.** It targets `Deployment/fn-backend` — the
> FastAPI backend, retired and frozen under owner decision D2, 2026-09-14
> (`backend/FROZEN.md`, `docs/decisions/2026-09-14-owner-decisions.md`). Against a real
> cluster it would be autoscaling a service that is no longer built or deployed.
> `fn-frontend` is a narrower case: it is **not** retired — it is still built and
> shipped — but it is not running in a cluster either. As of 2026-09-20 there is no
> production deployment of this application at all
> (`docs/audits/production-readiness-scorecard.md:150` and `:234`); "live-only" in this
> repo means live data rather than mock, which is not a deployment claim.
>
> The page is kept as the provisioning intent it is, and the commands are left in place —
> the same posture `cd-staging.yml:25-29` already records for the deploy workflows: gated
> and kept, not rewritten, because editing an unexecuted deployment plan is guesswork
> about a topology nobody has built. There is no owner decision for this runbook, and
> none is invented here.
>
> **Corrected below, 2026-09-20:** the HPA section's tense and its incomplete trigger
> list (the manifest declares four metrics and a scale-up stabilization window; the page
> showed two metrics and only the scale-down window); one `terraform -target` address
> that matched no resource at all; and the capacity table, whose "Current" column
> asserted observed state for a system that has never run and whose Postgres and Redis
> ceilings match nothing in the tree. The TimescaleDB 90-day figure is the one that does
> have a source — `docs/architecture/data-flow.md:296` and `:306` — but it is a design
> snippet, implemented by no migration.

## Horizontal Pod Autoscaling (HPA)

The backend HPA is **written but has never been applied**. The manifest is real
(`infrastructure/kubernetes/backend/hpa.yaml`) and these are the values it would create;
as of 2026-09-20 no HPA object has ever existed in a cluster:
- Min replicas: 3
- Max replicas: 20
- Scale-up triggers — four metrics, not the two this page listed. Under `autoscaling/v2`
  whichever metric asks for the most pods wins:
  - CPU > 70% average utilization
  - memory > 80% average utilization
  - `fn_active_websocket_connections` above 500 per pod (Pods metric)
  - `fn_api_requests_per_second` above 100 **per pod** (External metric with
    `AverageValue`, so the reported rate is divided by the pod count — this is not a
    cluster-wide 100 req/s)
- Scale-up stabilization: 60 seconds; scale-down stabilization: 300 seconds
- A PodDisruptionBudget in the same file, `fn-backend-pdb`, holds `minAvailable: 2`

The CPU and memory metrics would be served by metrics-server, which `eks.tf:394` does
declare as a helm release. The WebSocket and request-rate metrics need a custom/external
metrics adapter, and `infrastructure/` declares no Prometheus adapter at all — so those
two triggers have no source even in the topology this repo intends to build.

Monitor HPA:
```bash
kubectl get hpa fn-backend-hpa -n fn -w
```

## Manual Scaling Events

**Anticipated high traffic** (institutional client onboarding, market events):
```bash
# Pre-scale before event
kubectl scale deployment fn-backend --replicas=10 -n fn
kubectl scale deployment fn-frontend --replicas=5 -n fn

# Verify
kubectl get pods -n fn | grep -E "backend|frontend"
```

## Database Scaling

**Add Aurora read replica**:
```bash
aws rds create-db-instance \
  --db-instance-identifier fn-reader-2 \
  --db-cluster-identifier fn-staging-aurora \
  --engine aurora-postgresql \
  --db-instance-class db.r6g.large
```

## Redis Scaling

To increase Redis memory or add cluster nodes, update
`infrastructure/terraform/elasticache.tf` and apply. **The resource is labelled `fn`, not
`redis`** — `elasticache.tf:121` declares `resource "aws_elasticache_replication_group"
"fn"`, and it is the only one in the tree, so the address this runbook used to give
(`...replication_group.redis`) matched nothing and the command errored instead of scaling
anything.

Two things stand between you and a plan. The backend block at `main.tf:50` deliberately
omits `key`, so a bare `terraform init` here fails and the key must be passed per
environment. And as of 2026-09-20 nothing has ever been applied from this directory:
with no state, `-target` does not narrow the work to one replication group — the first
apply stands up the environment.
```bash
cd infrastructure/terraform
terraform init -reconfigure -backend-config="key=staging/terraform.tfstate"
terraform plan  -target=aws_elasticache_replication_group.fn
terraform apply -target=aws_elasticache_replication_group.fn
```

## Capacity Planning

| Component | Configured value | Where it is set | Scale action |
|-----------|-----------------|-----------------|--------------|
| Backend pods | min 3 / max 20 | `kubernetes/backend/hpa.yaml` | Raise `maxReplicas` — but see the banner: the target is the retired backend |
| Postgres connections | 500 (Aurora) / 300 (self-hosted k8s) / 500 prod, 200 dev (compose) | `terraform/rds.tf:57`, `kubernetes/postgres/statefulset.yaml:81`, `docker/docker-compose*.yml` | Raise `max_connections`, then the client pool |
| Redis memory | `--maxmemory 1gb` (self-hosted k8s), 2gb prod / 512mb dev (compose); ElastiCache sets no `maxmemory`, so the node type is the ceiling | `kubernetes/redis/deployment.yaml:56`, `docker/docker-compose*.yml`, `terraform/variables.tf:225` (`cache.r6g.large`) | Raise `--maxmemory`, or change `redis_node_type` |
| TimescaleDB retention | **No retention policy exists** | — | `add_retention_policy` appears only as a design snippet in `docs/architecture/data-flow.md:306` (and the 90-day figure in its table at `:296`); no migration implements it, so the action is to write a policy, not extend one |

There is no "current" column because, as of 2026-09-20, nothing is running: these are
the values the committed configuration would produce on a first apply, not observed
state. Note too that the rows straddle three configurations of each store — Aurora and
ElastiCache via Terraform, the Postgres StatefulSet and Redis Deployment under
`infrastructure/kubernetes/`, and the docker-compose stacks, which are the only ones
anyone has actually run. `backup-restore.md`'s banner flags the Postgres half of that
split; the Redis half is flagged nowhere else.
