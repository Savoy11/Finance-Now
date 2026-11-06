# Code audit — 2026-11-05

**Run by:** the `code-auditor` agent (`.claude/agents/code-auditor.md`), in a cloud container, at the
owner's request ("Repo-wide defect audit"). **Commit:** `507f864` on `claude/dazzling-volta-lbbz61`
(which then held #468, D191). The clone was shallow, back to `8ed2ec9` (2026-10-19).

**Every finding below was re-checked before acting on it.** What was fixed, and the two points where
the report was not quite right, are in the last section. The owner chose to fix all six (D193).

## Checks run

- `npx tsc --noEmit` (frontend and `mcp-server/`): exit 0.
- `npx eslint .`: 0 errors, 46 warnings, the same count recorded on 2026-09-19.
- `npx vitest run`: 226 files, 3,373 tests passed; coverage over the scoped layers 85.15% of
  statements, 78.21% of branches.
- `npx next build`: exit 0, 54 pages.
- `npm run data-sources -- --verify`: no drift across 61 routes. It rewrites the date line in
  `DATA-SOURCES.md` even when nothing changed, which leaves the tree dirty; that line was restored.
- `docs:check` (19 counts), `queue:check` (0 failing, 1 to review: T-407), `staleness:check`
  (11 clocks, all fresh or acknowledged), `deps:check` (nothing high or critical).
- A local `next start` probe of the site lock (finding 1).

**Not run:** `npm run audit` and `npm run smoke` (not the owner's machine, so the results would be
IP-skewed); terraform (not installed); the frozen backend (D2).

## Findings

### 1. The site lock and the keyless public API trusted the client's `Host` header (P1)

`siteLock.ts:48` let a request through when `isLocalRequest(req)` was true, before the owner cookie
was checked, and `isLocalRequest` (`apiGuard.ts:27`) reads the `Host` header. `apiKeys.ts:115-116`
made the same check for `/api/v1` with no keys set. Measured against a built app with
`FN_ADMIN_TOKEN` set:

```
Host=app.example.com  /headlines=307  /live-data/config=401  /api/v1/exchanges=401
Host=localhost        /headlines=200  /live-data/config=200  /api/v1/exchanges=200
Host=127.0.0.1        /headlines=200  /live-data/config=200  /api/v1/exchanges=200
Host=localhost        POST /api/agents/chat=401   (the token check held)
```

The client chooses its Host header, and the repo's own nginx config forwards it unchanged
(`proxy_set_header Host $host`). So one forged header opened the lock that keeps a hosted copy
private to the owner until launch (D174), which is what keeps the app inside its personal-use
data licences (D22, D96). The comment in `apiGuard.ts` called the Host check "sound … no proxy in
front"; with no proxy the client sets Host outright.

### 2. The Reserve Monitor showed a failed DefiLlama read as live (P2)

The route answers a failure with `{ ok: false, assets: [] }` and HTTP 200. The panel's loader
checked only the HTTP status, so it showed "Live supply via DefiLlama (updated <now>)" over an empty
table. The `notFound` list #467 added was never read by the page, so a coin that dropped out
disappeared without a word.

### 3. Every reserve donut slice was the same grey (P2)

`ReserveComposition.tsx` coloured slices from a map keyed `Cash & Equivalents`, `T-Bills`,
`Commercial Paper`, `Crypto Assets`, `Other`. None of the 17 categories in `COMPOSITION_MAP` matched
one, so every slice and legend swatch fell back to `#64748b`.

### 4. The Nasdaq "trades overnight" label switched before the session opened (P2)

`launchTime` was `${launch}T00:00:00Z`, which is 7 pm ET on Saturday 5 December. The first session
opens at 9 pm ET on Sunday 6 December. The report also said nothing schedules the 2026-12-07 check
and that the test guard is off once the start is confirmed.

### 5. README's feature table contradicted the code (P2)

It still advertised Binance quotes (`BINANCE_SYMBOL_MAP`, removed 2026-10-12, T-423) and listed
Binance as a data provider, said 126 funds (140), 55 staking providers (53), and counted Stride's
rates (dropped 2026-10-14). `docs:check` watched only the transfer-fee counts in README.

### 6. The no-deletion record missed a third deletion (P2)

`frontend/package.json:31`'s `restart` script runs `rmdir /s /q .next`. It deletes only build
output, which the rule allows, but CLAUDE.md said the repo held exactly two deletions and that no
npm script deletes, and its search patterns could not match `rmdir`, `rd` or `del`.

**Set aside as minor:** two stale comments in `reserves/route.ts`; the Google Fonts `@import` in
`globals.css` sits after `@import 'tailwindcss'`, so JetBrains Mono never loads; `npm ls` exits 1 on
the D189 minimatch override (nothing calls it); `data-sources --verify` dirtying `DATA-SOURCES.md`;
`docker-compose.prod.yml` mounting an `nginx.prod.conf` that does not exist.

## What was done (D193)

1. **Site lock.** `isOwnerRequest()` (`apiGuard.ts`) is the one test of "is this the owner": with
   `FN_ADMIN_TOKEN` set, only the token or the owner cookie counts and the Host header is never
   consulted; with no token, a localhost Host is the owner's own machine, as before. The site lock
   and the keyless public API both use it; `guardSensitiveRoute` already followed the same rule.
   Tests in `siteLock.test.ts` and `apiKeys.test.ts` fail if the old rule returns. **Still open:** a
   host deployed **without** `FN_ADMIN_TOKEN` is still open to the forged header; the hosting brief
   requires the token on every host. The rate limiter's per-address key still reads
   `x-forwarded-for`, which T-260 tracks.
2. **Reserve Monitor.** The loader treats `ok: false` as an error, so the panel shows its "Could not
   reach DefiLlama" state; coins not found are listed in a notice; an empty answer says so.
3. **Donut colours.** Slices are coloured by position from a palette that leaves out the app's
   risk-level colours (red, orange, amber, emerald), so no slice reads as a grade; a slice the
   sources do not name stays grey. Tested over every coin in `COMPOSITION_MAP`.
4. **Nasdaq label.** The schedule carries `opensAt` (`2026-12-06T21:00:00-05:00`), and the label
   switches then. **Correction to the report:** the 2026-12-07 check *is* scheduled, as a task in the
   owner's Claude session (set up 2026-11-05 with #466); the auditor could not see scheduled tasks.
   The early switch was 26 hours, not 31 (7 pm ET Saturday to 9 pm ET Sunday).
5. **README.** The four rows are corrected, and `docs:check` now holds README's fund total, ETF and
   mutual-fund counts and staking-provider count.
6. **Deletion record.** CLAUDE.md lists the third deletion and its search now includes `rmdir`,
   `rd /s` and `del /`; re-run, it finds the three rows and nothing else.
