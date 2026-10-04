# CAEP → FN database identity rename (2026-08-12)

The app is heading to production. Database names, database users, and the
local-user sentinel email are **create-time identity**: renaming them before
the first real deployment is a config change; renaming them after is a data
migration (and on Aurora, `database_name` / `master_username` changes force
**cluster replacement** — they can never be renamed in place). This sweep
closes that window while it is still open. Everything else CAEP-related —
the `CAEP_*` env fallbacks, the `x-caep-token` header, the `caep:*`
localStorage migration shims, historical docs — is deliberately **not**
part of this rename and keeps its own compatibility story.

## What changed

| Identity | Old | New |
|---|---|---|
| Frontend (Drizzle) default database | `caep_app` | `fn_app` |
| Backend database / user (compose, k8s, RDS, config defaults) | `caep` / `caep` | `fn` / `fn` |
| Local compose Postgres password | `caep` | `fn` |
| Local-user sentinel email (`lib/auth/session.ts`) | `local@caep.local` | `local@fn.local` |
| Monitoring queries (`datname=` in Prometheus rules + Grafana) | `caep` | `fn` |
| k8s probes / runbook commands (`-U`, `-d`) | `caep` | `fn` |

## What migrates itself

**The local user's `users` row.** `getOrCreateLocalUser()` now looks up the
new email first, then the legacy one, and **adopts** a legacy row by renaming
it in place — the row id (which every portfolio, watchlist, budget, and
builder plan points at) is preserved. No manual step; runs on first request.

> **Removed 2026-10-04 (owner decision D75)** — see **Sunset** below. Builds from
> that date on no longer look for the legacy email.

## What needs a manual step (existing local installs only)

Fresh clones and fresh deployments need nothing. Installs with data created
before this rename have three options per database — rename the DB, keep the
old name via `DATABASE_URL`, or start over.

**Frontend DB (where user data lives)** — as a superuser, with no active
connections to it:

```sql
ALTER DATABASE caep_app RENAME TO fn_app;
```

Or set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/caep_app`
in `frontend/.env.local` to keep the old name indefinitely.

**Backend local DB** (legacy Python backend, if you use it):

```sql
ALTER DATABASE caep RENAME TO fn;
ALTER USER caep RENAME TO fn;
ALTER USER fn WITH PASSWORD 'fn';  -- re-set: an MD5-hashed password is
                                   -- invalidated by a role rename (SCRAM survives)
```

Or point `DATABASE_URL` at the old names in `backend/.env`.

**Docker compose stack:** `POSTGRES_DB/USER/PASSWORD` apply only at first
initdb — an existing `postgres_data` volume keeps the old names and the
renamed healthcheck/backend will fail against it. Either run the ALTERs above
inside the container (`docker exec -it fn-postgres psql -U caep`), or, if the
volume holds nothing precious, `docker compose down -v` and re-up.

## Rollback caveat

Once the `users` row is renamed, running a **pre-rename build** against the
same database recreates a fresh `local@caep.local` row and writes new data
there; rolling forward again, the app returns to the original (renamed) row
and the rollback-window data is stranded on the fresh row. Single-owner and
pre-production, this is an accepted risk — if it happens, merge the two rows
by hand (`UPDATE ... SET user_id = <original-id>` on the owned tables, then
delete the stray user).

## Sunset

The legacy-email adoption lookup in `getOrCreateLocalUser()` stays until
every install (owner's machines, any long-lived deployment) has run a
post-rename build at least once — after that it is dead code and can go.
The `CAEP_*` env-var fallbacks and `caep:*` localStorage shims are **not**
covered by this sunset; they protect user-facing configuration and browser
data and should outlive it (suggested horizon: mid-2027, a year past the
July-2026 rebrand).

**Applied 2026-10-04 (owner decision D75, T-329).** The lookup is removed from
`getOrCreateLocalUser()`. No long-lived deployment existed to wait for, so the
condition was the owner's machines, with one step on each: if it had not opened the
Watchlist or Portfolios page since 2026-08-12, open one of them once before taking
this change, and check that the saved data is there.

If a database from before the rename is ever opened by a later build, nothing is
lost: the app creates a fresh, empty `local@fn.local` row, and the data stays on
the old `local@caep.local` row. To reconnect it, stop the app and run:

```sql
BEGIN;
UPDATE users SET email = 'local-unused@fn.local' WHERE lower(email) = 'local@fn.local';
UPDATE users SET email = 'local@fn.local' WHERE lower(email) = 'local@caep.local';
COMMIT;
```

The first `UPDATE` moves the fresh row aside rather than deleting it, so anything
saved on it in the meantime is kept.
