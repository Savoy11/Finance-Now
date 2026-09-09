/**
 * Limits shared between the batch-scan route and the UI that calls it.
 *
 * This lives OUTSIDE the route file on purpose. A route module may export
 * handlers and types only: a client component importing a *value* from
 * `app/live-data/pump-report/scan/route.ts` drags that route's imports —
 * including the Anthropic SDK and its `node:path` dependency — into the browser
 * bundle, and the build fails with an unhandled-scheme error. Types are erased
 * at compile time and are safe; constants are not. (Same constraint noted on
 * `hydrateDiscovered` in FundsClient.)
 */

/**
 * Hard cap on targets per scan. Each target costs one web search, so this is a
 * cost ceiling as much as a latency one. Shared so the UI states the number the
 * server actually enforces — a silently truncated list is how a reader
 * concludes an address came back clean when it was never scanned at all.
 */
export const SCAN_TARGET_CAP = 5
