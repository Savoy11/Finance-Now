// The decisions behind `npm run staking:refresh-fallbacks`, without the network or
// the file system, so they can be tested (lib/server/__tests__/stakingFallbackProvenance.test.ts).
//
// ── Why a partial reading is refused ─────────────────────────────────────────
// FALLBACK_MEASURED_ON is ONE date for every key in FALLBACK_MEASURED. A key whose
// upstream did not answer keeps its old value, so writing the new date would
// claim that old value was measured today. Until 2026-10-13 the script refused
// only when no key at all came back live, and a run with two upstreams down
// would have re-dated four unread values (Stride's ATOM, INJ and TIA, and native
// INJ, which were the four then being served from the table). So the write now
// needs every measured key read live, or it writes nothing.

/**
 * The date a reading was measured on: its own `updatedAt`, else today (UTC).
 *
 * A reading saved with `--from` can be written a day after it was taken: on
 * 2026-10-27 one read at 14:17 UTC was written after midnight UTC, and the clock
 * would have dated it 2026-10-28, a day it was not read.
 */
export function readingDate(live, now = new Date()) {
  const at = typeof live?.updatedAt === 'string' ? Date.parse(live.updatedAt) : NaN
  return new Date(Number.isNaN(at) ? now : at).toISOString().slice(0, 10)
}

/** Keys listed in FALLBACK_MEASURED, in source order. */
export function measuredKeys(src) {
  const block = src.match(/const FALLBACK_MEASURED: ReadonlySet<string> = new Set\(\[([\s\S]*?)\]\)/)
  if (!block) throw new Error('FALLBACK_MEASURED not found — has the route changed shape?')
  return [...block[1].matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1])
}

/**
 * Work out what a refresh would write.
 *
 * @param {string} src    stakingRates.ts as it is now
 * @param {{ rates?: Record<string, number>, sources?: Record<string, string>, upstreams?: Record<string, string> }} live
 *                        a /live-data/staking-rates response
 * @param {string} today  YYYY-MM-DD, the date the write would stamp
 * @returns {{
 *   measured: string[], changed: { key: string, old: number, fresh: number }[],
 *   skipped: string[], failedUpstreams: [string, string][], liveCount: number,
 *   next: string, refusal: string | null,
 * }}
 *   `refusal` is null only when every measured key was read live; `next` is the
 *   rewritten source either way, so a report can show what would change.
 */
export function planFallbackRefresh(src, live, today) {
  const measured = measuredKeys(src)
  const liveCount = Object.values(live.sources ?? {}).filter((s) => s === 'live').length
  const failedUpstreams = Object.entries(live.upstreams ?? {}).filter(([, v]) => !String(v).startsWith('live'))

  let next = src
  const changed = []
  const skipped = []

  for (const key of measured) {
    const value = live.rates?.[key]
    if (live.sources?.[key] !== 'live' || typeof value !== 'number') {
      skipped.push(key)
      continue
    }
    // A live ZERO is "no rate reported", not a rate — the same verdict the upstream
    // probe calls `no-rate`. Writing it would publish "0% APR" as a measured fallback
    // the moment the upstream goes quiet, and stakingFallbackProvenance.test.ts
    // rightly refuses a measured value of 0. First seen 2026-09-24: DefiLlama
    // reported the LBTC pool at 0 while every other key was live. Keep the prior
    // value and say so, exactly as a non-live upstream is handled.
    if (value <= 0) {
      skipped.push(`${key} (live upstream reported ${value} — no rate, prior value kept)`)
      continue
    }
    const fresh = parseFloat(value.toFixed(2))
    const re = new RegExp(`(^\\s*${key}:\\s*)([0-9.]+)(,)`, 'm')
    const found = next.match(re)
    if (!found) {
      skipped.push(`${key} (no FALLBACK row)`)
      continue
    }
    const old = parseFloat(found[2])
    if (old !== fresh) changed.push({ key, old, fresh })
    next = next.replace(re, `$1${fresh}$3`)
  }

  next = next.replace(/const FALLBACK_MEASURED_ON = '[0-9-]+'/, `const FALLBACK_MEASURED_ON = '${today}'`)

  const refusal = skipped.length === 0 ? null
    : skipped.length === measured.length
      ? 'not one measured key came back live.'
      : `${skipped.length} of the ${measured.length} measured keys were not read live, and ` +
        `FALLBACK_MEASURED_ON would date their old values as measured today. Run it again when ` +
        `every upstream answers. If an upstream is gone for good, take its keys out of ` +
        `FALLBACK_MEASURED first: they become undated estimates, which is what they would be.`

  return { measured, changed, skipped, failedUpstreams, liveCount, next, refusal }
}
