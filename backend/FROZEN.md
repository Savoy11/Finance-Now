# ⚠ FROZEN — this backend is retired and is not part of the build

**Owner decision D2, 2026-09-14** (`docs/decisions/2026-09-14-owner-decisions.md`).

The FastAPI backend is **retired**. Nothing in the shipping application calls it, no
CI job builds or tests it, and it is not deployed. It is **kept, not deleted** — the
same posture this repo applies to retired branches, hidden pages and removed modules.

## Why it is frozen rather than deleted

The owner's standing rule is that project files are preserved, not removed: *"I will
not enable or authorize any auto delete functions for any project files related to the
build"* (2026-09-11), alongside *"I dont want to delete any branches"*. Retiring a
component here has always meant making it inert and saying so in writing — see the
branch-archiving convention in `CLAUDE.md`, the hidden Transfer Fees and Wallets pages,
and the Budget module whose DB tables were deliberately retained.

Deleting 98 Python modules and 17 test files to save disk space, when the cost of
keeping them is a directory nobody opens, would trade something irreversible for
something worthless.

## It was already dormant before this decision

This is a retirement on paper of a service that had already stopped running:

- **The frontend's axios client was removed in the M8 sweep.** No frontend module
  imports it, and `lib/constants.ts`'s `API_BASE_URL` export had zero importers.
  `CLAUDE.md` claimed the backend "still serves assets/market-data/alerts/risk-scores
  through the axios client" — that had not been true since M8.
- **Auth moved off it.** Sign-in is Auth.js against the app's own `users` table.
- **`/live-data/risk-scores` and the whole per-coin risk surface were removed** in
  RP-6 (2026-08-29), and D14 (2026-09-14) removed the remaining staking composites.
  `app/scoring/` therefore has no counterpart left in the app at all.
- **AWS was never provisioned**, so the CD workflows that would have deployed it have
  never run a single successful deploy (`docs/deployment/aws-provisioning.md`).

## What was kept

- **The Postgres schema is untouched.** It lives in `frontend/src/lib/db/schema/`
  (drizzle) and is the live schema for users, portfolios, watchlists, builder plans and
  wallets. **Nothing in this directory owns any table the app uses.** The alembic
  migrations here describe this backend's own historical view of the database; do not
  run them against a live database.
- Every source file, test, `pyproject.toml`, `poetry.lock`, `Dockerfile` and
  `alembic.ini`, exactly as they were.

## What was removed elsewhere

| Where | What |
|---|---|
| `.github/workflows/ci.yml` | the `backend-lint` (ruff + mypy) and `backend-test` (pytest + coverage) jobs, and their entries in the `CI Success Gate` |
| `.github/workflows/ci.yml` | the backend Docker image build and its container-structure test |
| `.github/workflows/ci.yml` | the `safety check` Python dependency audit (this also closes T-338's Python half) |
| `frontend/next.config.mjs` | the `/api/*` → backend proxy rewrite |
| `frontend/src/lib/constants.ts` | the unused `API_BASE_URL` export |

Removing the rewrite has a second effect worth knowing: `/api/*` routes with **dynamic
segments** no longer have to live under `/api/user/`. That constraint existed only
because the rewrite resolved before dynamic routes and silently proxied them to this
service. `CLAUDE.md` carried it as a hard rule; it is now gone.

## The CD workflows still reference this backend, deliberately

`cd-staging.yml` and `cd-production.yml` still build, push and deploy a backend image.
They were **not** rewritten, because they are gated off (`STAGING_DEPLOY_ENABLED` has
never been set) and describe a two-service Kubernetes deployment to infrastructure that
has never existed. Rewriting an unexecuted deployment plan would be guesswork about a
topology nobody has built.

**If you are the person provisioning AWS: read this file first.** The backend half of
those workflows is retired and should be removed as part of that work, not before it.

## Reviving it

There is no automated path back, on purpose — a component that can be silently
reactivated is not retired. Reviving it means an explicit decision that reverses D2, and
then:

1. Restore the `backend-lint` and `backend-test` jobs in `ci.yml` and re-add them to the
   `CI Success Gate`'s `needs:` and `check` calls (keep the gate's **name** unchanged —
   branch protection matches on `CI Success Gate`).
2. Restore the backend image build in `docker-build`.
3. Decide what it is *for*. Its API surface (`app/api/v1/`: assets, market_data, alerts,
   reserves, risk_scores, watchlists, reports, auth, websocket) is either already served
   by the Next.js app's own routes or was deliberately removed:
   - `auth` — superseded by Auth.js.
   - `risk_scores` — **removed by owner decision** (RP-6, then D14). Do not restore.
   - `websocket` — the app opens no socket; the reconnect client was removed in M8.
   - `assets` / `market_data` / `alerts` / `reserves` / `watchlists` — served by
     `/live-data/*` and `/api/user/*`.
   - `app/scoring/` — its 0–100 bands (80/65/50/30) **disagree with the frontend's**
     (80/60/40/20). It must not be reactivated without adopting the canonical bands
     (`docs/architecture/risk-scale-spec.md`).

A revival that skips step 3 would reintroduce a second, divergent implementation of
surfaces the app already serves — which is the condition that made this retirement the
right call.
