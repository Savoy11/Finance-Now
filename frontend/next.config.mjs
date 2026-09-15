/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Linting runs as its own step (`npm run lint` → eslint, and a dedicated CI
  // job), NOT during the build. Decided on Next 14, whose built-in build lint
  // drove the ESLint 8 API and errored against ESLint 9:
  //   ⨯ ESLint: Invalid Options: - Unknown options: useEslintrc, extensions
  // It printed that while still exiting 0, i.e. the build *looked* linted and
  // wasn't. Turning it off makes the truth explicit instead. Kept off on
  // Next 15 deliberately — build-lint is deprecated in 15 and removed in 16,
  // and the dedicated lint step is the one CI actually gates on. See
  // eslint.config.mjs.
  eslint: { ignoreDuringBuilds: true },
  images: {
    domains: ['assets.coingecko.com', 'cryptologos.cc', 'raw.githubusercontent.com'],
    formats: ['image/avif', 'image/webp'],
  },
  // ─── The /api/* proxy rewrite was REMOVED 2026-09-14 (owner decision D2) ─────
  //
  // It forwarded every /api/* path without a concrete route file to the legacy
  // FastAPI backend at NEXT_PUBLIC_API_URL. That backend is retired and frozen
  // (backend/FROZEN.md), so the rewrite pointed at a service that is not running
  // and is not meant to be — an unmatched /api/* path now returns a clean 404
  // instead of hanging on a dead origin.
  //
  // ⚠ THIS LIFTS A REAL CONSTRAINT, and CLAUDE.md carried it as a hard rule.
  // The rewrite ran in the default `afterFiles` phase, which resolves AFTER
  // concrete file routes but BEFORE dynamic ones — so any /api/ route with a
  // dynamic segment lost to it and was silently proxied. That is why first-party
  // dynamic routes were forced under /api/user/ (plus the auth/ and affiliate/
  // exclusions the rule had accumulated). It had already cost real bugs:
  // /api/auth/csrf and /api/auth/callback/* are served by the [...nextauth]
  // catch-all and were proxied to the dormant backend, where they 500'd.
  //
  // New /api/* routes with dynamic params may now live wherever they belong.
  // If anything is ever proxied from /api/* again, that constraint comes back
  // with it — restore this comment along with the rewrite.

  async redirects() {
    return [
      // Global page CUT 2026-09-14 (owner decision D10, T-135 resolved to CUT).
      // De-routed in the T5 triage for data-honesty reasons — a mislabeled CBDC
      // tracker on stale static data under a fabricated live timestamp — and the
      // page, its /live-data/cbdc-data route, cbdcProvenance and their test are now
      // DELETED, not merely unreachable. INVEST was the alternative and was not
      // chosen: a real tracker needs a CBDC data feed that does not exist keyless.
      // The redirect STAYS so existing bookmarks land somewhere rather than 404,
      // and because re-adding the entry is no longer what would restore the page —
      // recovery is `git checkout <archive tag> -- <paths>`. Note the CBDC *asset
      // type* on /assets is a different thing and was deliberately left alone.
      { source: '/global-adoption', destination: '/headlines', permanent: false },
      // Risk Case Studies removed (2026-07): static educational replay with no
      // clear user value — page deleted, deep links land on Headlines.
      { source: '/backtests', destination: '/headlines', permanent: false },
      // Transfer Fees hidden from the initial rollout 2026-08-22 (owner). Kept,
      // not deleted — see the note in lib/modules/registry.ts for the full list
      // of surfaces and how to restore. `permanent: false` on purpose: this is a
      // rollout decision, not a dead page.
      { source: '/transfer-fees', destination: '/headlines', permanent: false },
      // Wallets hidden from the initial rollout 2026-08-22 (owner), same
      // posture and same reasoning as Transfer Fees above. Kept, not deleted.
      // This also darkens the Pump Report, which is a tab on that page and has
      // no route of its own — see the note in lib/modules/registry.ts.
      // `permanent: false`: a rollout decision, not a dead page.
      { source: '/wallets', destination: '/headlines', permanent: false },
      // Reserve Transparency Monitor folded into the Coins page (2026-07-29).
      // It duplicated /assets' "Reserve Monitor" tab — same route, same table,
      // same detail panel — while being the only copy that carried the
      // provenance disclosure and the peg-mechanism fix. One surface now, with
      // those corrections, in components/analytics/reserves.
      //
      // Unlike the two redirects above this preserves the destination content:
      // ?tab=reserves opens the same monitor the old URL showed, so bookmarks
      // still work rather than dumping the reader on an unrelated page.
      { source: '/reserves', destination: '/assets?tab=reserves', permanent: false },
      // Risk Scores leaderboard removed (2026-08-18, P3-W2 short-list item 4).
      // Owner decision: "these scores may represent a recommendation, which is
      // a regulated activity." The line drawn was RANKING vs EXPLANATION —
      // scoring a coin the user opened explains; ranking a universe to surface
      // winners is closer to a recommendation. So the leaderboard went here.
      //
      // ⚠ SUPERSEDED 2026-08-29 by RP-6 — do not act on the paragraph that used
      // to sit here. It said the per-coin risk panel on /assets/[id] "STAYS" and
      // that /live-data/risk-scores was "intentionally LEFT IN PLACE", which was
      // true for eleven days. RP-6 then removed the per-coin score everywhere:
      // the panel, the route, lib/api/live/riskScores.ts, useRiskScoreIndex,
      // RiskScoreBadge, and the Asset.riskScore / riskBand fields themselves.
      // A maintainer reading the old text would have "restored" a surface that
      // was withdrawn on regulatory grounds. Guarded by
      // lib/risk/__tests__/riskScoringRemoved.test.ts.
      //
      // Still true: lib/risk/ stays, and with it the options Trade Risk Scorer,
      // staking-provider risk and the macro/equity profiles — separate decisions.
      { source: '/risk-scores', destination: '/headlines', permanent: false },
      // Equity Strategy Backtests HIDDEN 2026-08-20 — owner decision, explicitly
      // revisitable ("I may revisit back testing"). Page + engine + tests +
      // subproject P3-W2-S1 all retained; this redirect is the only thing that
      // removes access. Restore = delete this line + re-add the nav entry in
      // lib/modules/registry.ts.
      { source: '/equities/backtests', destination: '/equities', permanent: false },
      // Staking Discovery merged into /staking (2026-08-20, W3-3 option B):
      // its curated directory duplicated the Staking page's provider cards,
      // and its one unique feature — live on-chain pool discovery — became the
      // Live Pools tab there. Content-preserving redirect, like /reserves.
      { source: '/staking-discovery', destination: '/staking?tab=pools', permanent: false },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ]
  },
}

export default nextConfig
