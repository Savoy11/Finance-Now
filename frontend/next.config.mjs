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
  async rewrites() {
    // The destination below appends `/api/:path`, so the base must be the
    // backend ORIGIN, not an API path. Several config files and runbooks set
    // NEXT_PUBLIC_API_URL to `http://localhost:8000/api/v1`, which produced
    // `http://localhost:8000/api/v1/api/...` — every /api/* path without a
    // concrete route file 500'd. Harmless while the backend is dormant; it
    // would bite whoever revives it. Normalising here fixes it for every
    // deployment at once, rather than depending on each one setting the
    // variable the way this rule happens to want.
    const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const apiUrl = rawApiUrl.replace(/\/+$/, '').replace(/\/api(\/v\d+)?$/, '')
    return [
      {
        // Proxies leftover /api/* traffic to the legacy backend.
        //
        // `/api/auth/` is excluded because Auth.js owns it, and `/api/user/`
        // because the DB-backed user-data routes (builder plans, portfolios…)
        // live there. This rewrite runs in the default `afterFiles` phase,
        // which resolves *after* concrete file routes but *before* dynamic
        // ones — so /api/auth/signup (a real file) reached its handler while
        // /api/auth/csrf and /api/auth/callback/* (served by the [...nextauth]
        // catch-all) were silently proxied to the dormant backend and 500'd.
        // The same trap catches any dynamic segment: /api/user/builder-plans/
        // [id] would proxy too. First-party routes with dynamic params MUST
        // live under an excluded prefix — add new prefixes here, not routes
        // outside /api/user/ — or add the prefix to the exclusion above, as
        // `affiliate/` does: its counts are aggregate rather than user-scoped,
        // so `/api/user/` would have been the wrong namespace for them.
        source: '/api/:path((?!auth/|user/|affiliate/).*)',
        destination: `${apiUrl}/api/:path`,
      },
    ]
  },
  async redirects() {
    return [
      // Global page de-routed pending a post-production rework (see T5 triage:
      // docs/assessments/T5-utility-triage.md). The page and its
      // /live-data/cbdc-data route are intentionally LEFT IN PLACE — this only
      // removes user access. The page is ModuleGate-wrapped (crypto), so
      // deleting this entry re-enables it INSIDE the entitlement gate — but
      // check the T5 triage first: it was de-routed for data-honesty reasons
      // (stale static data under a fabricated live timestamp), not for scope.
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
