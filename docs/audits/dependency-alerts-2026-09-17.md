# Dependency alert sweep — 2026-09-17

Worked the 26 Dependabot alerts the 2026-09-16 session handoff named as unblocked.
All 26 are cleared in PR #199. This file records what the remaining open PRs are,
what each would cost, and which of them PR #199 supersedes.

**Measured on a cloud session.** Nothing here depends on network reachability or
the owner's IP, so the usual owner-machine caveat does not apply — these are
manifest, lockfile and advisory facts, re-derivable anywhere with a registry.

---

## What the 26 alerts actually were

GitHub counts **advisories**; `npm audit` counts **packages**. The two numbers
never matched in the handoff's notes and that is why. Twelve vulnerable packages
carry the 26 advisories, and they split exactly the way the handoff predicted:

| Workspace | Packages | Advisories | Severity |
|---|---|---|---|
| `mcp-server` | 5 | 20 | 6 HIGH, 13 moderate, 1 low |
| `frontend` | 7 | 6 | all moderate |

The handoff's "20 of 26 alerts are in `mcp-server`" is confirmed, and its
explanation holds: it is built once and rarely rebuilt, so its dependencies
drifted furthest.

**All five `mcp-server` packages are transitive through
`@modelcontextprotocol/sdk`, which is already at its latest (1.30.0).** That is
the structural fact that decided the fix. There is no upstream bump to wait for,
and `mcp-server` has only two direct dependencies, so nothing can be fixed by
bumping what the manifest actually declares. Declarative `overrides` are the only
honest instrument.

---

## Three defects in the open Dependabot PRs

These are the reason the queue was not simply merged.

### `ip-address` had no PR at all

A HIGH (`GHSA-mwp4-54f8-5fhr`, SSRF and trust-boundary bypass) reached through
`@modelcontextprotocol/sdk` → `express-rate-limit`. Nothing in the PR queue
tracked it. A per-package PR queue only covers what Dependabot chose to open;
an override sweep covers what is actually installed.

### #194 over-bumps by a major for no security gain

It proposes `@hono/node-server` 1.19.14 → **2.1.1**. The advisory
(`GHSA-frvp-7c67-39w9`) is fixed in **1.19.15**, and **1.19.17** exists on the
1.x line. The major buys nothing the patch does not, and costs an API review of
a package the MCP SDK — not this repo — consumes.

### #184 declares a combination that cannot resolve

It bumps `@vitest/coverage-v8` alone to `^5.0.0` and leaves `vitest` at
`^3.0.0`. `@vitest/coverage-v8@5.0.1` declares
`peerDependencies: { vitest: "5.0.1" }` — an **exact** pin, not a range. The
combination fails `npm ci` with ERESOLVE. The runner and its coverage provider
have to move together, always.

---

## And one defect in npm's own advice

`npm audit fix` proposes **`drizzle-kit@0.18.1`** to clear the esbuild
dev-server advisory. The repo is on **0.31.10**, which is already the latest
published version. That "fix" is a **13-minor-version downgrade** of the
migration tool, and npm presents it in the same sentence as the real fixes.

The advisory arrives through `@esbuild-kit/core-utils`, a package deprecated in
favour of `tsx`, which `drizzle-kit@0.31.10` still depends on. There is no
upstream fix. PR #199 scopes an override to that chain so drizzle-kit's own
`esbuild@0.25.12` and tsx's `0.28.1` are untouched.

**Worth knowing before anyone runs `audit fix --force` here.**

---

## `postcss: "$postcss"` is load-bearing — do not remove it

`frontend/package.json` carries an override reading `"postcss": "$postcss"`.
It looks like boilerplate. It is not.

`next@15.5.25` pins `postcss` to **exactly `8.4.31`**, which carries two HIGH
advisories. The `$postcss` override redirects that to the hoisted `8.5.28`, so
a pristine install of this repo contains exactly one postcss and it is the safe
one. Dropping the override lets npm honour next's exact pin and materialises a
nested vulnerable copy.

This was found by deleting it accidentally during PR #199's development and
watching a HIGH appear. Recorded here so the next person to tidy that block
knows what it is doing.

---

## The remaining open PRs

None is a security fix. Each is a genuine major needing its own read.

| PR | Change | Risk | Recommendation |
|---|---|---|---|
| #183 | `lucide-react` 1.44→1.45, `eslint-config-next` 16.3.4→16.3.5 | Low — patch/minor only, despite the group name | **Merge.** Not a major at all |
| #188 | `actions/github-script` 7→9 | Low, and **covered by a test** | **Merge after reading the v8/v9 notes.** See below |
| #187 | `eslint` 9.39.5→10.10.0 | **Broken — lint does not run** | **Do not merge. Blocked upstream.** See below |
| #186 | `zustand` 4.5→5.0.15 | Low — verified clean | **Merge.** See below |
| #185 | `tailwindcss` 3.4→4.3.3 | **High — a rewrite, not an upgrade** | **Do not merge as-is** |
| #184, #194, #195, #196, #197 | vitest-coverage, hono-node-server, qs, hono, fast-uri | — | **Superseded by #199; close them** |

### #188 — `actions/github-script` 7→9

Used in exactly two workflows: `archive-branch.yml` and
`dependabot-triage.yml`. The first is the auto-archive whose script is
extracted from the YAML and executed against a mocked API by
`lib/server/__tests__/archiveBranchWorkflow.test.ts` — so a regression there
fails a test rather than silently mis-archiving, which is the whole reason that
test exists. That makes this the best-covered of the majors.

Note the handoff's own finding: this PR is the one the D6 triage classifier
mislabelled as in-scope when it is a major. Merging it does not fix that
classifier bug.

### #187 — `eslint` 9→10 — TESTED 2026-09-18, DO NOT MERGE

**This entry originally read "likely safe". That was a prediction from a peer
range, and it was wrong.** Bumped and run: eslint 10 does not lint this repo at
all. It crashes before reporting a single file:

```
TypeError: scopeManager.addGlobals is not a function
    at addDeclaredGlobals (eslint/lib/languages/js/source-code/source-code.js:221)
```

The misleading part is the range the original note reasoned from.
`eslint-config-next@16.3.5` really does declare `eslint: ">=9.0.0"`, which
*permits* eslint 10 — but the plugins it bundles do not, and npm marks them
`invalid` on install:

| Bundled plugin | Peer range | Latest published |
|---|---|---|
| `eslint-plugin-import` | `^2 ‖ … ‖ ^9` | 2.32.0 — still caps at 9 |
| `eslint-plugin-jsx-a11y` | `^3 ‖ … ‖ ^9` | 6.10.2 — still caps at 9 |
| `eslint-plugin-react` | `^3 ‖ … ‖ ^9.7` | still caps at 9 |

So there is **no version combination available today** that lints this repo on
eslint 10 — not a config fix like the vitest 4 one, and not something bumping
`eslint-config-next` solves. It is blocked until those three plugins publish
eslint 10 support upstream. Re-test then; the check is one `npm run lint`.

**A top-level peer range is not evidence that the tree resolves.** That is the
transferable lesson here, and it is the same shape as the `@vitest/coverage-v8`
finding above — the declared range and the installable graph disagreed.

### #186 — `zustand` 4→5 — TESTED 2026-09-18, SAFE TO MERGE

**This entry originally said to watch the persist migrations. There are none.**
`grep` for `version:` or `migrate:` across `src` returns nothing: no zustand
store in this repo uses persist versioning at all. The "v2 migration" other docs
mention is `migrateStorageKey()` in `lib/utils/storageMigration.ts` — a
hand-rolled localStorage key rename for the CAEP → Finance Now change, which
runs at module scope *before* `create()` and has no relationship to zustand's
persist machinery. The original warning pointed at a risk that does not exist.

What is actually exposed, and why it is clean:

- **No default import.** All 14 root-entry imports are `import { create } from
  'zustand'`, so v5's headline removal touches nothing. Six more import
  `persist` from `zustand/middleware`, which is unchanged.
- **No unstable selectors.** v5's real runtime break is a selector returning a
  fresh object or array each render — under `useSyncExternalStore` that loops
  where v4 tolerated it. Every consumption in this repo is either a single-field
  selector (`(s) => s.field`) or a bare whole-store `useXStore()`. Neither is
  affected, which is why `useShallow` is not needed anywhere.

Verified on the bump: `tsc --noEmit` clean, **1,493 tests across 104 files
pass**, `eslint` unchanged at 0 errors / 46 warnings, `next build` compiles and
prerenders all 44 pages.

⚠ **One limit worth stating rather than hiding:** the suite is pure-TS and
renders no React, so none of the above exercises store rehydration in a browser.
The selector audit is what covers that gap, and it is a read of the code rather
than a run of it. A click through the persisted surfaces (watchlist, portfolios,
entitlement toggles) after merging would close it properly.

### #185 — `tailwindcss` 3→4

**The one to leave alone for now.** Tailwind v4 replaces the JavaScript config
with CSS-first configuration. This repo has both `tailwind.config.js` and
`postcss.config.js`, and the whole styling convention documented in CLAUDE.md
is built on custom CSS variables (`bg-bg-card`, `text-text-primary`,
`w-sidebar`, the emerald/amber/orange/red risk scale). A v4 migration is a
deliberate styling workstream with a visual review at the end, not a dependency
bump — and there is no security pressure forcing it.

---

## What PR #199 changed

`mcp-server` 5 → 0 vulnerable packages, `frontend` 7 → 0. Every override stays
inside its existing major, so no API surface moves.

Verified on the branch: the full suite passes (same file and test counts as the
baseline on `main`), `tsc --noEmit` clean, eslint 0 errors with the warning
count unchanged, `next build` compiles and prerenders every page, `drizzle-kit`
runs, `mcp-server` builds and its entrypoint loads, and `npm audit` reports zero
in both workspaces. Exactly one non-dev package moved — `tinyglobby`
0.2.16 → 0.2.17, a transitive of `eslint-config-next` and tailwind tooling —
confirmed by diffing every entry in the lockfile.

### One lockfile note

`frontend/package-lock.json` was regenerated with **npm 11**, because **npm
10.9.7 crashes** resolving the vitest 4 peer graph:

```
TypeError: Cannot read properties of null (reading 'edgesOut')
    at #loadPeerSet (@npmcli/arborist/lib/arborist/build-ideal-tree.js:1289)
```

That is an npm bug, not a project fault, and the boundary is narrower than it
first looks — **this note originally said it "affects `npm install` only",
which reads as a warning to consumers and is wrong.** Measured both sides
(2026-09-18):

| npm 10.9.7 does this | Result |
|---|---|
| RESOLVE the upgrade itself — `package.json` says `^4.1.11`, lockfile still says 3.2.6 | **crashes** |
| CONSUME the finished lockfile — `npm install` onto an existing vitest-3 tree | **works**, upgrades to 4.1.11 |
| CONSUME the finished lockfile — `npm ci` from scratch | **works** |

So the crash only happens while *generating* this bump, which is why it was hit
here and is why the lockfile was regenerated with npm 11. **Nobody pulling the
finished branch is affected**, on either command, at any npm version — and CI
runs Node 24, which ships npm 11, regardless. The one case that still needs
`npx npm@11 install` is changing a dependency that forces npm 10 to re-resolve
that peer graph from ranges again.

### The vitest 4 JSX trap

Worth recording because the error message points at the wrong fix. vitest 4
ships **Vite 8**, which reads tsconfig's `jsx: "preserve"` — required by Next —
and then refuses to transform JSX, so every test importing a `.tsx` component
fails to parse. Vite's own error says to stop setting `jsx: preserve`, which is
not available here.

Vite 8 transforms with **oxc, not esbuild**, so the `esbuild: { jsx: ... }`
block that would have fixed this under Vite 7 is silently ignored — it fails
exactly as if nothing had been configured. `vitest.config.ts` now sets
`oxc: { jsx: { runtime: 'automatic' } }`, which governs the test pipeline only
and leaves the Next build reading tsconfig unchanged.
