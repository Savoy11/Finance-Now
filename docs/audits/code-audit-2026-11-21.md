# Code audit — 2026-11-21

**Commit:** main `96f1276` (working tree `97ffa30` on `claude/upbeat-allen-cru6ir`, identical to that main — merge
commits only). **Scope:** `git diff 22be98e..96f1276`, PRs #503–#509 and #511–#512, weighted to the sign-in and
accounts cluster built dark since the last audit — D232 (sign-in launch kit), D233 (TOTP two-step sign-in),
D234 (database-backed entitlements), D235 (append-only audit log) — plus the D227 email swap and the #508
staking backup-rate refresh. **Run by:** the `code-auditor` agent in a cloud container, read-only.
**Checks run:** `tsc --noEmit`, `eslint .`, `vitest run` (full suite), `next build`, `docs:check`, `queue:check`,
`staleness:check`, `deps:check`, `data-sources -- --verify`. **Checks skipped:** `npm run audit` and
`npm run smoke` (not the owner's machine: REAL/FALLBACK classification is IP-dependent and both call outside
hosts, the SEC with the project contact among them — results would be systematically wrong); the `mcp-server`
type-check (nothing in scope touches `mcp-server/`); the frozen backend (D2).

**Network:** none. No outside host was contacted and the app was not started. Findings 1 and 2 were reproduced by
running the repository's own functions (`verifyTwoFactorSignIn`, `walledPath`) under vitest with `@/lib/db` mocked,
from a scratch folder outside the repository; `git status` was clean before and after.

## Summary

Type-check, lint, all 3,985 tests, the production build and every docs and ledger guard pass, and the D232–D235
cluster's dark-until-launch and idle-not-outage properties hold everywhere they were checked. The most important
defect is in the new sign-in's replay guard: two requests racing the same authenticator code BOTH sign in, while the
recovery-code branch beside it refuses exactly this — fix the TOTP update to the sibling branch's conditional
pattern before the launch flip arms it. Second, close the sign-in wall's dot rule, which any dotted dynamic segment
(`/equities/BRK.B`) walks through.

## Findings

### 1. The TOTP replay guard admits two sign-ins racing the same code · `P2` — reproduced

**Evidence:** `frontend/src/lib/auth/twoFactorStore.ts:134-138` — the TOTP branch of `verifyTwoFactorSignIn`
records the matched step with an **unconditional** update (`.set({ lastUsedStep … }).where(eq(userId))`). The
recovery branch directly below (`:140-147`) spends its code with a conditional update
(`isNull(usedAt)` + `.returning()`, failing on 0 rows) under the comment *"Two sign-ins racing the same code: only
the one that spent it gets in"* — the standard the TOTP branch does not meet. Probe (the repo's own function, db
mocked so each request's SELECT returns the pre-update row, which is what Postgres serves while two requests
overlap): two `verifyTwoFactorSignIn('u1', code, now)` racing the same authenticator code return `['ok', 'ok']`;
sequentially the second returns `'bad'`; two requests racing the same recovery code return one `'ok'`, one `'bad'`.
No test executes the store's success path at all — `twoFactorSignIn.test.ts`'s db mock resolves only at `.limit()`
and has no `update`, and its `verifyTwoFactorSignIn` cases (`:144-151`) exercise failures only.

**What is wrong:** the guard the code documents — `totp.ts:110-113`: *"a code seen over a shoulder cannot be
replayed inside its 30 seconds (RFC 6238 §5.2)"*; CLAUDE.md: *"a code that signed someone in cannot be used again
inside its window (`last_used_step`)"* — holds sequentially but not under the one timing an attacker chooses.
Someone holding the password and the victim's current code (a real-time phishing relay, a shoulder-surf) who submits
while the victim's own sign-in is in flight gets a second session from the same code.

**Why it matters:** this is the launch sign-in's second factor, and the scenario it exists for is exactly "the
password is already in the wrong hands". Dark until `FN_REQUIRE_AUTH` — but that flip is environment-only, with no
code review between. The window is narrow (the victim's read-to-commit span), which is why this is P2, not P1.

**Suggested fix:** mirror the recovery branch: make the update conditional
(`lastUsedStep IS NULL OR lastUsedStep < matchedStep`) with `.returning()`, and treat 0 rows as `fail()`. Add the
race to `twoFactorSignIn.test.ts` with an update-capable mock.
*Importance:* medium-high · *Efficiency:* high (the sibling branch is the pattern) · *Practicality:* high

### 2. The sign-in wall opens for any dynamic segment containing a dot · `P3` — reproduced

**Evidence:** `frontend/src/lib/server/authWall.ts:37-39` — *"A dot in the last segment is a file (robots.txt,
icons); pages have none"* — returns `false` for any such path. Probe with the repo's own `walledPath`:
`/equities/BRK.B`, `/assets/usd.coin`, `/funds/X.Y` all return `false` while `/equities/AAPL` returns `true`.
Dynamic routes (`assets/[id]`, `equities/[symbol]`, `funds/[symbol]`, the three `macro/*/[slug]`s) accept arbitrary
segments, so once `FN_REQUIRE_AUTH` is on, a signed-out visitor who puts a dot in the segment mounts the page and
runs its queries with no redirect — and `BRK.B` is a ticker's real-world dotted form, not an exotic input.
`authWall.test.ts:38-47` pins the dot rule only for genuine static files (`/robots.txt`,
`/apple-touch-icon.png`); the dotted-dynamic-segment case is tested nowhere.

**What is wrong:** D232's wall is the only page gate at launch (`FN_SITE_OPEN=true` lifts the site lock), and it can
be sidestepped for every detail page. Bounded harm: `/api/*` and `/live-data/*` are deliberately unwalled ("the
routes guard themselves"), so this leaks page access, not data the routes protect.

**Suggested fix:** narrow the dot rule to known static names/extensions (or exclude static assets in the middleware
matcher and wall everything else), and add a dotted dynamic segment to `authWall.test.ts`.
*Importance:* medium-low · *Efficiency:* high · *Practicality:* high

### 3. D227's `[CONTACT EMAIL]` safety net does not exist — the find-replace rewrote the token inside `KNOWN_BLANKS` and two comments · `P3` — read

**Evidence:** `frontend/src/lib/legal/disclosures.ts:77-80` — `KNOWN_BLANKS` now contains
`'FinanceNow72@gmail.com'` where `'[CONTACT EMAIL]'` was. Blanks are detected by the bracket pattern
(`inline.ts:23`, `\[([A-Z][A-Z0-9 ]*[A-Z0-9])\]`; `blanksIn`, `inline.ts:40-43`), which can never produce a bare
lowercase email — the entry is unmatchable, dead. The comment directly above it (`:72-76`) says *"The token stays
on this list so a future draft that reintroduces it still counts as a blank rather than a typo"*; D227's record
says the same (`docs/decisions/2026-11-15-owner-decisions.md`: *"the token stays in `KNOWN_BLANKS` so a future
draft that reintroduces it still reads as a blank"*). The file-header comment (`:29-32`) was rewritten into
*"approving a page that still says 'FinanceNow72@gmail.com' is not possible"* — false, since the pages now say
that email by design.

**What is wrong:** the behaviour is the opposite of the recorded decision: a draft revision that reintroduces
`[CONTACT EMAIL]` now fails `disclosures.test.ts:77` as an unknown typo (the bucket its `[CONTACT EMAL]` example
demonstrates) instead of counting as a known blank the draft notice lists. Failure direction is loud rather than
silent, so nothing ships wrong today — but the code contradicts its own comment, and the comment beside a dead list
entry is exactly what misleads the next editor.

**Suggested fix:** put `'[CONTACT EMAIL]'` back in `KNOWN_BLANKS` (the real email is enforced filled by
`disclosures.test.ts:85-86` regardless) and restore the two comments' token.
*Importance:* low-medium · *Efficiency:* high (three lines) · *Practicality:* high

### 4. The WORM audit log records `data_exported` before the export is built · `P3` — read

**Evidence:** `frontend/src/app/api/user/export/route.ts:54-57` — `recordAudit({ … event: 'data_exported',
detail: 'part=…' })` runs before `collectUserExport(query, userId)` and the CSV/JSON builders. A collect that then
throws (any non-schema database failure) answers 500 with the row already written — and migration 0013's trigger
makes the row permanent. The owner command does it the other way (`scripts/user-export.ts:66`: `insertAudit` after
the files are written).

**What is wrong:** the event's own definition is *"A copy of the account's data was downloaded"*
(`auditEvents.ts:47-48`). In the one log whose design goal is answering "was this account's data downloaded?", a
failed request reads as a download, uncorrectably.

**Suggested fix:** record after the response body is built, as the CLI does.
*Importance:* low · *Efficiency:* high (move one awaited line) · *Practicality:* high

## Set aside (minor, or bounded by a recorded decision)

- **Typed counts in new copy:** `TwoFactorPanel.tsx:232` says "ten one-time recovery codes" beside a derivable
  `RECOVERY_CODE_COUNT`; "6-digit" / "every 30 seconds" appear in copy too, though those two are the authenticator
  standard's fixed values. The derive-counts rule's strongest instance here is the "ten".
- **Pre-hydration premium flash:** a signed-in, ungranted account renders Portfolio Builder pages for the
  entitlements round-trip (`useEntitlementStore.isEnabled` falls back to the persisted map until `server` lands);
  `ModuleGate` then locks. Bounded by D234's own record that server-side module gating is billing-time work.
- The wall's `/login` redirect (`middleware.ts:58`) drops the intended destination — no `callbackUrl`.
- `lib/auth/config.ts:43-47` and `session.ts:10-15` still point readers at `(dashboard)/layout.tsx` for the wall
  story; that file now (correctly) says the wall moved to the middleware. Pointers, not false claims.
- `verifyTwoFactorSignIn` counts a throttle failure for an account with no enrollment (`twoFactorStore.ts:130`);
  reachable only through route-level races, since every caller checks enrollment first.
- `/api/user/entitlements` resolves the session twice per request (`getSessionUserId` then `getCurrentUserId`,
  each calling `auth()`).

## Checks that could not be run

- `npm run audit`, `npm run smoke`: skipped — not the owner's machine, so which sources work would be IP-skewed
  (Binance 451s, Reddit/LunarCrush blocks from datacenter IPs), and both call outside hosts.
- `mcp-server` type-check: not run; the scope's diff touches nothing under `mcp-server/`.

## Results of the checks run

- `npx tsc --noEmit` (frontend): exit 0.
- `npx eslint .`: 0 errors, 45 warnings (the same count as 2026-11-12).
- `npx vitest run`: 265 files, 3,985 tests, all passed (257 files / 3,882 on 2026-11-12).
- `npx next build`: exit 0; the tree was clean afterwards.
- `docs:check`: 23 counts match. `queue:check`: 0 failing, 0 warnings, 1 to review (T-407, unchanged), 405 items.
- `staleness:check`: every clock fresh or acknowledged; `FALLBACK_MEASURED_ON` fires 2026-12-01 (in 10 days —
  owned by the D186 weekly refresh, which #508 shows running: whole reading rewritten, date moved to 2026-11-16).
- `deps:check`: nothing at high or critical. `data-sources -- --verify`: 63 surfaces, no drift across 67 routes,
  `DATA-SOURCES.md` left alone.

## Examined and clean

- **TOTP engine (`totp.ts`):** HOTP dynamic truncation, big-endian counter, drift ±1, constant-time compare —
  RFC-correct, and `totp.test.ts` holds it to the RFCs' published vectors. Base32 round-trip tolerant of case,
  spaces and padding; refuses non-base32.
- **Sign-in order (`config.ts`):** bcrypt → forced reset → two-factor, every refusal only after the password
  matched; audit rows only for an email that matched an account; `authorize` resolves the lower(email) index.
- **The five `/api/user/two-factor/*` routes:** session-only (`getSessionUserId`, pinned by test — never the shared
  local user), disable and regenerate demand a current code, begin refuses while a confirmed enrollment stands (no
  silent authenticator swap on a hijacked session), recovery codes shown exactly once, stored as SHA-256 only.
- **Idle-not-outage, verified everywhere claimed:** an unrun 0012 reads as "not enrolled" (tested), the 2FA routes
  answer 503 with the migrate instruction, `TwoFactorPanel` shows the reason; an unrun 0013 is one `console.warn`
  and `recordAudit` never throws (tested against a mocked db); the owner CLIs note and carry on; the export names a
  missing table in `notSetUp` instead of failing.
- **"Download my data" vs the new tables:** the TOTP secret is stripped twice over (explicit
  `OMITTED_COLUMNS` plus the `SECRET_COLUMN` regex, which catches bare `secret` and `code_hash`); `audit_log` rows
  export via the `user_id` discovery as D235 intended.
- **Migration 0013:** WORM trigger (BEFORE UPDATE OR DELETE, raises) present; `user_id` carries no FK; the 2FA
  tables CASCADE with their user — the right direction for credentials.
- **D234 posture:** `canUserToggle` refuses premium for sessions and the route answers 400 through the shared rule;
  Settings shows Included/Not included instead of a toggle; `ModuleGate`'s grant-locked branch has no dead settings
  link; `expiresAt` honoured and the grant command's upsert clears it, so an expired row revives; `expires_at` has
  been in migration 0000, so "no new migration" holds; rows upserted, never deleted; the one-time import writes
  only OFF toggles and drops a saved "builder off" on a real account; no database keeps browser-only behaviour
  quietly.
- **Signup:** consent gated on the ticked box and the stored wording's version; account + consent written in one
  transaction; the unique-index race answered 409; the password rule shared with the reset.
- **The wall (finding 2 aside):** fail-closed on an unverifiable session, Auth.js loaded lazily so the dark path
  costs nothing, (auth)/(legal)/`/api/*`/`/live-data/*` never walled, site lock first, launch recipe
  environment-only with the no-constants rule pinned by test.
- **Policy:** no new external host; no deletion of tracked files anywhere in the diff (2FA disable deletes
  credential rows, recorded in D233); no risk score, ranking or affiliate link added; the D227 swap took the
  owner's personal address out of every outbound User-Agent; prohibited hosts untouched.
- **Docs vs code:** CLAUDE.md's D232–D235 blocks, `auth.md`'s four updates and the decision records match the code
  as read, finding 3's detail excepted.

Opportunity noted, not pursued: the login redirect could carry a `callbackUrl` so a signed-out deep link lands
where it pointed after sign-in.
