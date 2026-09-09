# CI Remediation — status & follow-ups

_Context: CI had been red on every recent PR (including #20, which merged anyway).
The failures were chronic **backend/infrastructure** debt, unrelated to the
frontend PRs they were blocking. PR #22 (`claude/new-session-h5t7gn`) fixed the
mechanical/contained issues and documented the rest as F-A/F-B/F-C. The CI
workflow (`.github/workflows/ci.yml`) runs only on pull requests._

**All three follow-ups from PR #22 are now resolved.** This document previously
still listed them as blockers long after they had been fixed, which is its own
kind of stale — a remediation doc that over-reports breakage sends people to
diagnose problems that no longer exist. Status below re-verified 2026-07-28.

## Job status

| Job | Status | Notes |
|-----|--------|-------|
| Frontend Check (ESLint + TS + Build) | 🟢 green | |
| Backend Lint (ruff + mypy) | 🟢 green | ~250 ruff findings resolved in PR #22 |
| Security Scan / Trivy | 🟢 green | |
| Backend Tests (pytest + coverage) | 🟢 green | suite runs; 82 tests collected. Was F-A |
| Terraform Validate | 🟢 green | dependency cycle broken. Was F-B |
| Docker Build Test | 🟢 green | CI targets match the real stage names. Was F-C |

---

## Resolved

### F-C — Docker Build Test → fixed 2026-07-20 (`0ce5cb6`)

`ci.yml` built both images with `--target production`, a stage neither
Dockerfile defines. Fixed by option 1 (align CI to the real stages) rather than
renaming the stages:

- `ci.yml:278` → `target: runtime` (matches `backend/Dockerfile`: `builder`, `runtime`)
- `ci.yml:294` → `target: runner` (matches `frontend/Dockerfile`: `deps`, `builder`, `runner`)

PR #22 warned the real image build had never run in CI and might surface further
errors behind the build-definition fix. It did not — the job has been green since.

### F-A — Backend Tests → fixed 2026-07-28 (`8ffea21`)

pytest failed at **collection** because `app/scoring/engine.py:34` imported
`get_weights_for_asset_type` from `app.scoring.weights`, which never defined it.
The function now exists at `weights.py:85` and the suite is importable.

The warning that this was "resurrect a never-run suite, not a one-line fix" was
accurate: `8ffea21`'s message is *"make the backend suite real again"*, and it
carried the surrounding work, not just the missing function.

Current state: **82 tests collected, suite passes in CI.** Verified locally on
2026-07-28 at 67 passed / 15 errored, where all 15 errors are
`ConnectionRefusedError` on `127.0.0.1:5432` — CI supplies Postgres through
GitHub Actions `services:` (`timescale/timescaledb:latest-pg15`), which a plain
local checkout does not have. Those 15 are not judged from a local run.

### F-B — Terraform Validate → fixed 2026-07-28 (`8ffea21`)

The `kms → iam_role → eks → kms` cycle is broken, and broken the safe way PR #22
argued for rather than by widening the key policy: `aws_kms_key.fn`'s policy now
carries only the account-root statement, with a comment at `main.tf:149-153`
explaining why no per-role statement may be added back. The backend role gets
`kms:Decrypt` / `GenerateDataKey` / `DescribeKey` from its own identity policy
(`iam.tf:112-120`, scoped to `aws_kms_key.fn.arn`), which removes the kms→role
edge without granting anything broader.

The Terraform CLI stays pinned at 1.9.8 (`ci.yml:366`) for the cross-variable
`validation` block.

Note: the KMS resource is `aws_kms_key.fn`, not `.caep` — renamed in the
2026-07-28 rebrand (`b8fc320`). PR #22's cycle description used the old name.

---

## Open

*(Nothing outstanding. The two items that stood here were closed on 2026-09-08 —
see below.)*

---

## Closed 2026-09-08

### Coverage floor is below where it should be — RESOLVED

Closed the way the entry asked for: with tests, not by moving a number. The
weakest modules were the scoring ones (`app/scoring` measured 0%), which is the
layer that turns raw metrics into figures a user reads. Two new test files took
all five of those modules to 100% and the suite from **49.92% to 57.31%**
locally. The floor moved 45 → 55 afterwards.

The two-numbers inconsistency is gone as well: the floor is now declared once,
in `backend/pyproject.toml` (`--cov-fail-under=55`), and `ci.yml` deliberately
does **not** override it on the command line. A bare local `pytest` and CI now
gate on the same number.

It sits under the lower of the two measurements on purpose. CI runs ~1.1pp
higher than a local run, because its Postgres service lets the 15 DB-dependent
API tests execute; a floor set above the local figure would fail a developer's
`pytest` for a reason that has nothing to do with their change.

### eks module pinned to v19 — RESOLVED

`infrastructure/terraform/eks.tf` now pins `~> 20.37`, with
`manage_aws_auth_configmap` / `aws_auth_roles` / `aws_auth_users` replaced by
`authentication_mode = "API"` plus an `access_entries` map.

The upgrade guide's staged migration (interim module, `terraform state rm`, a
one-way `authentication_mode` change on a live cluster) did **not** apply here:
this cluster has never been provisioned, as this document's own opening section
records. With no cluster there is no ConfigMap to preserve, so the end state
could be written directly and `API` chosen at creation rather than migrated to.

Two things surfaced while doing it, both recorded in comments at the code:

- **`create_kms_key` was silently discarding the KMS key this config names.**
  The module defaults it to `true` and its encryption config reads
  `var.create_kms_key ? module.kms.key_arn : provider_key_arn`, so the
  module would have made a second key of its own and ignored `aws_kms_key.fn`
  — leaving cluster secrets encrypted under a key that `iam.tf`'s grants do not
  cover. The default and that expression are byte-identical in v19.21, so this
  was already true before the upgrade; it has simply never been applied. Fixed
  with `create_kms_key = false`.
- **`aws_iam_role.eks_node_group` is assumed by no node.** The node groups never
  set `iam_role_arn`, so the module creates their roles; that role's only
  consumer was the hand-written aws-auth mapping this change removed. Annotated
  in `iam.tf` rather than deleted — removing infrastructure is a separate
  decision from upgrading a module.

`aws` provider floor raised `~> 5.30` → `~> 5.95`, which is what v20.37
declares.

Verified by running `terraform validate` against the real
`terraform-aws-modules/eks` v20.37.2 with the aws 5.95 provider, and confirmed
capable of failing: restoring the three v19 `aws_auth*` arguments produces three
`Unsupported argument` errors, and the migrated config passes. `terraform fmt
-check -recursive` is clean. No `plan` was run — that needs AWS credentials.
