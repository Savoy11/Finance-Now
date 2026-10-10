/**
 * Pure helpers for the rating validation (T-420 item 7; methodology §8). No I/O, so
 * src/lib/server/__tests__/ratingValidation.test.ts checks each one: these numbers decide
 * the owner's choice of weights and curves, and a wrong rank or a leaked patch would
 * decide it wrongly.
 */

// ── statistics ───────────────────────────────────────────────────────────────

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const v = [...xs].sort((a, b) => a - b)
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

/** Ranks from 1, ties sharing the average of the ranks they span. */
export function ranks(xs: number[]): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0])
  const out = new Array<number>(xs.length)
  for (let i = 0; i < order.length;) {
    let j = i
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) out[order[k][1]] = avg
    i = j + 1
  }
  return out
}

function pearson(xs: number[], ys: number[]): number | null {
  const mx = mean(xs)!, my = mean(ys)!
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy)
}

/** Spearman's rank correlation; null below three pairs or when either side is constant. */
export function spearman(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length) throw new RangeError('spearman needs paired samples')
  if (xs.length < 3) return null
  return pearson(ranks(xs), ranks(ys))
}

// ── the regulators' bands (docs/assessments/risk-rating-methods-survey-2026-10-07.md §1.1) ──

/** EU PRIIPs market-risk class edges, as annualised volatility: < 0.5%, 0.5–5%, 5–12%, 12–20%, 20–30%, 30–80%, > 80%. */
export const PRIIPS_EDGES = [0.005, 0.05, 0.12, 0.2, 0.3, 0.8] as const

/**
 * The PRIIPs class a plain annualised volatility would fall in. Indicative only: PRIIPs
 * measures a VaR-equivalent volatility that counts fat tails, which is at or above plain
 * volatility for most assets, so this is a lower bound on the class PRIIPs would give.
 */
export function priipsBandClass(volatility: number): number {
  return 1 + PRIIPS_EDGES.filter((edge) => volatility >= edge).length
}

// ── dates (UTC) ──────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000

/** The first day of each quarter (Jan, Apr, Jul, Oct) from `from` to `to`, inclusive. */
export function quarterStarts(from: Date, to: Date): Date[] {
  const out: Date[] = []
  let y = from.getUTCFullYear()
  let m = Math.ceil(from.getUTCMonth() / 3) * 3
  let d = new Date(Date.UTC(y, m, 1))
  if (d.getTime() < from.getTime()) { m += 3; d = new Date(Date.UTC(y, m, 1)) }
  while (d.getTime() <= to.getTime()) {
    out.push(d)
    m += 3
    if (m >= 12) { m -= 12; y += 1 }
    d = new Date(Date.UTC(y, m, 1))
  }
  return out
}

/** Every Monday from `from` to `to`, inclusive. */
export function mondays(from: Date, to: Date): Date[] {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const first = start + ((8 - new Date(start).getUTCDay()) % 7) * DAY_MS
  const out: Date[] = []
  for (let t = first; t <= to.getTime(); t += 7 * DAY_MS) out.push(new Date(t))
  return out
}

/** The first value in each calendar month, in order. `dates` and `values` are paired. */
export function monthlySamples<T>(dates: Date[], values: T[]): T[] {
  const out: T[] = []
  let last = ''
  dates.forEach((d, i) => {
    const key = d.toISOString().slice(0, 7)
    if (key !== last) { out.push(values[i]); last = key }
  })
  return out
}

/** How many times consecutive values differ. */
export function countChanges<T>(seq: T[]): number {
  let n = 0
  for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) n++
  return n
}

// ── trying a variant of the method ───────────────────────────────────────────

function restoreInPlace(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    const s = source[key]
    const t = target[key]
    if (s && typeof s === 'object' && t && typeof t === 'object' && Array.isArray(s) === Array.isArray(t)
      && (!Array.isArray(s) || (s as unknown[]).length === (t as unknown[]).length)) {
      restoreInPlace(t as Record<string, unknown>, s as Record<string, unknown>)
    } else {
      target[key] = structuredClone(s)
    }
  }
}

/**
 * Runs `fn` with `patch` applied to `method` IN PLACE, then puts every value back, even if
 * `fn` throws. In place because the engine reads the methodology object it imported, so a
 * copy would change nothing. The validation checks after every run that the baseline is
 * reproduced exactly, so a restore that failed could not pass silently.
 */
export function withPatch<M extends object, R>(method: M, patch: (m: M) => void, fn: () => R): R {
  const snapshot = structuredClone(method) as unknown as Record<string, unknown>
  try {
    patch(method)
    return fn()
  } finally {
    restoreInPlace(method as unknown as Record<string, unknown>, snapshot)
  }
}
