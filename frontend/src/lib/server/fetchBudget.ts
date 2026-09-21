/**
 * A ceiling on how long any one outbound request may hang.
 *
 * WHY THIS EXISTS. Node's fetch has no default timeout. A route that calls an
 * upstream which accepts the connection and then never answers holds the request
 * open indefinitely, and the surface it feeds shows a spinner rather than a
 * failure. That is the one failure mode this project treats as worse than an
 * error: the page cannot say "unavailable" because nothing ever told it.
 *
 * It is not hypothetical here. `docs/audits/app-audit-2026-07-27.md` records the
 * XRP wallet route burning 10.2 s on an unreachable upstream, and
 * DATA-AVAILABILITY.md records `network-fees` paying an 11 s penalty per call
 * while mempool.space was refusing this machine's exit node. Both were survivable
 * only because something eventually gave up further down the stack.
 *
 * WHY 15 SECONDS, and not the 5 s the wallet routes use. This is a ceiling, not a
 * target — it exists to convert "hangs forever" into "fails and says so", not to
 * enforce a latency budget. Several upstreams here are legitimately slow:
 * `fund-universe` measured ~12 s on 2026-09-19 building a 29,009-fund directory,
 * and SEC EDGAR is routinely seconds. A tighter global value would break working
 * surfaces to fix a hypothetical one, which is the wrong trade. Routes that want
 * a real budget set their own and several already do — wallet at 5 s
 * (WALLET_FETCH_TIMEOUT_MS), staking-discovery at 6 s per upstream.
 *
 * ⚠ DO NOT REACH FOR pinnedFetch TO GET THIS. It takes a `signal` and looks like
 * the natural home for a shared timeout, but requests made through it are NOT
 * covered by Next's fetch cache — a custom dispatcher opts the request out, so
 * `next: { revalidate }` silently stops working. Migrating cached routes onto it
 * would trade an unbounded hang for every call hitting the upstream, and
 * CoinGecko's keyless tier is roughly 30/min. `signal` alongside
 * `next: { revalidate }` on the platform fetch keeps both, and is the shape
 * `news`, `funding-rates` and `fund-universe` already use.
 */
export const EXTERNAL_FETCH_TIMEOUT_MS = 15_000
