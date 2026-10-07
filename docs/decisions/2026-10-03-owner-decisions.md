# Owner decisions — 2026-10-03

Recorded from the owner's answer to the session's question about the red Security Scan.
Same form as `2026-10-01-owner-decisions.md`: one row per ruling, what it cascades to, and
what was actually done.

| # | Decision | Ruling | Cascades to |
|---|---|---|---|
| D53 | The Security Scan's dependency audit, red on `main` and every PR since GHSA-vfj7-8cjw-p6xm (braces ≤ 3.0.3, high) reached npm's audit data with no patched release | **Handle it now, with a dated exception.** *"Lets handle the security issue,"* in reply to three options: a dated exception (recommended), waiting for a patched braces release, or a Tailwind 4 migration, which does not clear the second path braces comes in by. The session read the reply as the recommended option, and merging the pull request that applies it is the owner's confirmation. → APPLIED | `npm run deps:check` replaces the bare `npm audit --audit-level=high` for `frontend/` in CI. Every high or critical advisory still fails it, except one listed in `frontend/audit-exceptions.json`: this one, allowed until **2026-11-03**. The exception ends early if npm reports a fix that needs no major upgrade. `mcp-server/` keeps its plain audit, which is clean. T-418 tracks the removal |

## Notes

**Why the exception is safe to grant.** braces expands the `{a,b}` part of file patterns such
as `src/**/*.{ts,tsx}`, for the tools that match files against them. The advisory is a crash
on a deeply nested pattern. In this app it runs only on patterns written in the repository,
never on anything a visitor sends:

- `tailwindcss` 3.4.19 uses it, through chokidar and micromatch, to read the `content` paths
  in `tailwind.config` when CSS is built;
- `eslint-config-next` 16 uses it, through `@next/eslint-plugin-next`, fast-glob and
  micromatch, to match the files ESLint checks.

**Why there was nothing to upgrade to.** 3.0.3 is the newest braces release and the advisory
covers it. npm's own suggestions were breaking changes: Tailwind 4, which removes the first
path but not the second, or `eslint-config-next` 14.2.35, a downgrade of two major versions
from the 16 in use. The other scanner in the same CI job, Trivy, already passes
over advisories with no fix (`ignore-unfixed: true`). This exception is the same idea, but it
names the advisory, cites this decision and expires.

**How it ends.** The gate stops allowing the advisory on whichever comes first:

1. **npm reports a fix that needs no major upgrade.** Most likely a braces 3.0.4 that
   micromatch's `^3.0.3` range picks up. The step goes red, and `npm audit fix` clears it.
2. **2026-11-03 passes.** The step goes red with the exception's expiry named. Keeping the
   advisory allowed after that takes a new decision with a new date. The checker caps a
   single exception at 92 days, so an edited expiry cannot quietly stand in for a decision.

Once npm stops reporting the advisory, the gate prints a warning that the entry is no longer
needed. Removing it is a hand edit, in keeping with the standing rule that nothing deletes
project files automatically.
