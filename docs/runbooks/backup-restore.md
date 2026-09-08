# Backup and Restore Runbook

> **Correction, 2026-09-08.** This runbook listed an hourly `pg_dump` CronJob
> writing to `s3://fn-backups`. **Neither exists** — there is no CronJob
> manifest under `infrastructure/kubernetes/`, and no `aws_s3_bucket` for
> backups in `infrastructure/terraform/`. A runbook that names a backup
> mechanism nobody built is worse than one that names none, because it is read
> during an incident, when there is no time to discover it is fiction.
>
> **Aurora's automated backups and point-in-time recovery are the only backup
> mechanism this deployment has.** The row and the bucket references are removed
> below; the ad-hoc dump procedure is kept, relabelled as ad-hoc and pointed at
> local disk. Owner decision, 2026-09-08: remove rather than provision.
>
> Note also that this repository carries **two** Postgres paths — Aurora via
> Terraform (what production uses) and a Postgres StatefulSet under
> `infrastructure/kubernetes/postgres/` (a self-hosted/dev arrangement). The
> `kubectl exec postgres-0` commands below only apply to the second. If
> self-hosted Postgres ever becomes the production database, this runbook needs
> a real backup mechanism written for it first.

## Backup Strategy

| Data | Method | Frequency | Retention |
|------|--------|-----------|----------|
| PostgreSQL (RDS Aurora) | Automated snapshots + PITR | Daily (continuous for PITR) | `rds_backup_retention_days`, default 7 |
| PostgreSQL (self-hosted k8s) | Ad-hoc `pg_dump` only — **no scheduled backup exists** | On demand | Operator-managed |
| Redis | AOF + RDB snapshots | On write + hourly | 24 hours |
| Application code | Git + ECR images | Every commit | Indefinite |

## PostgreSQL Backup

### Automated (AWS RDS)
Aurora automated backups are enabled with 7-day retention. To list available backups:
```bash
aws rds describe-db-cluster-snapshots \
  --db-cluster-identifier fn-staging-aurora \
  --query 'DBClusterSnapshots[*].{Id:DBClusterSnapshotIdentifier,Time:SnapshotCreateTime}'
```

### Ad-hoc dump (self-hosted Postgres only)

Not a backup strategy — a one-off you run before a risky migration. It applies
to the k8s StatefulSet, not to Aurora; for Aurora take a manual cluster snapshot
instead (`aws rds create-db-cluster-snapshot`).

```bash
# Dump to the operator's local disk
kubectl exec -n fn postgres-0 -- \
  pg_dump -U fn -Fc fn > fn-backup-$(date +%Y%m%d-%H%M%S).dump
```

Store the file somewhere durable yourself. There is deliberately no
`aws s3 cp` step here: the `s3://fn-backups` bucket this runbook used to name
has never existed in Terraform, and a command that silently fails — or worse,
creates an unversioned, unencrypted bucket on the fly — is not a backup.

## Restore Procedures

### Restore from RDS Snapshot
```bash
aws rds restore-db-cluster-from-snapshot \
  --db-cluster-identifier fn-restored \
  --snapshot-identifier <snapshot-id> \
  --engine aurora-postgresql \
  --engine-version 15.4
```

### Restore from an ad-hoc dump (self-hosted Postgres only)
```bash
# From the .dump file you took above, on local disk
kubectl exec -i -n fn postgres-0 -- \
  pg_restore -U fn -d fn --clean --if-exists < <backup-file>.dump
```

### Point-in-Time Recovery (PITR)
```bash
aws rds restore-db-cluster-to-point-in-time \
  --db-cluster-identifier fn-pitr \
  --source-db-cluster-identifier fn-staging-aurora \
  --restore-to-time 2024-01-15T14:30:00Z
```

## Recovery Time Objectives

| Scenario | RTO | RPO |
|---------|-----|-----|
| Pod failure | < 30 seconds (HPA replaces) | 0 |
| Single AZ failure | < 2 minutes (Aurora failover) | 0 |
| Full DB restore from snapshot | < 30 minutes | 24 hours |
| Full DB restore from PITR | < 30 minutes | 5 minutes |
| Complete region failure | < 4 hours (manual) | 24 hours |
