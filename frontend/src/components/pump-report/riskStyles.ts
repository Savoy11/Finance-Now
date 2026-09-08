/**
 * Shared presentation for pump-report risk levels.
 *
 * These lived inside PumpReportTab. The batch scan panel needs the identical
 * mapping — two surfaces colouring the same `riskLevel` differently is how a
 * reader learns to distrust the colour — so they moved here rather than being
 * copied.
 *
 * Note `error` is deliberately its own slate band and NEVER falls through to
 * the green default: a scan that failed must not read as a clean verdict.
 */

export function riskColor(level: string) {
  if (level === 'error') return 'text-slate-400'
  if (level === 'critical') return 'text-red-400'
  if (level === 'flagged'  || level === 'high')    return 'text-orange-400'
  if (level === 'suspicious' || level === 'elevated') return 'text-amber-400'
  return 'text-emerald-400'
}

export function riskBg(level: string) {
  if (level === 'error')      return 'bg-slate-500/15 border-slate-500/30'
  if (level === 'critical')   return 'bg-red-500/15 border-red-500/30'
  if (level === 'flagged'   || level === 'high')    return 'bg-orange-500/15 border-orange-500/30'
  if (level === 'suspicious'|| level === 'elevated') return 'bg-amber-500/15 border-amber-500/30'
  if (level === 'moderate')   return 'bg-yellow-500/15 border-yellow-500/30'
  return 'bg-emerald-500/10 border-emerald-500/20'
}

export function riskLabel(level: string) {
  const map: Record<string, string> = {
    critical: 'CRITICAL', flagged: 'FLAGGED', suspicious: 'SUSPICIOUS',
    high: 'HIGH', elevated: 'ELEVATED', moderate: 'MODERATE', low: 'LOW', clean: 'CLEAN', error: 'SCAN FAILED',
  }
  return map[level] ?? level.toUpperCase()
}
