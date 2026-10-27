import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  EQUITY_SESSIONS_PER_YEAR, annualisedSharpe, maxDrawdownFraction, medianSpacingDays,
  perTradeRatios, periodsPerYear, sampleStdev,
} from '../backtestMetrics'
import { runEquityBacktest } from '../equityBacktest'
import { runBacktest } from '../backtest'
import { MIN_BARS, backtestGap } from '../backtestGap'
import type { OhlcvCandle } from '../indicators'

// The backtests' shared arithmetic (T-018, T-019; D172, 2026-10-26). The bar size is
// measured from the timestamps: both engines used to assume it, and both were wrong.

const DAY = 86_400
const MON = 1_767_571_200 // 2026-01-05, a Monday (unix seconds)

/** Weekday closes only, as a stock trades: Friday to Monday is one session. */
function weekdays(n: number): number[] {
  const out: number[] = []
  for (let t = MON; out.length < n; t += DAY) {
    const dow = new Date(t * 1000).getUTCDay()
    if (dow !== 0 && dow !== 6) out.push(t)
  }
  return out
}
const every = (n: number, days: number) => Array.from({ length: n }, (_, i) => MON + i * days * DAY)
const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

describe('the bar size, measured', () => {
  it('reads the median gap, so a weekend or a missing bar does not move it', () => {
    expect(medianSpacingDays(weekdays(260))).toBe(1)
    expect(medianSpacingDays(every(50, 4))).toBe(4)
    expect(medianSpacingDays([MON])).toBeNull()
    expect(medianSpacingDays([])).toBeNull()
  })

  it('a stock year is 252 daily sessions; longer stock bars and every crypto bar are calendar time', () => {
    expect(periodsPerYear(weekdays(1300), 'equity')).toBe(EQUITY_SESSIONS_PER_YEAR)
    expect(periodsPerYear(every(260, 7), 'equity')).toBeCloseTo(52.18, 2)
    expect(periodsPerYear(every(60, 30), 'equity')).toBeCloseTo(12.18, 2)
    expect(periodsPerYear(every(365, 1), 'crypto')).toBe(365)
    // CoinGecko's free service sends 4-day candles on long ranges.
    expect(periodsPerYear(every(92, 4), 'crypto')).toBe(91.25)
    expect(periodsPerYear([MON], 'crypto')).toBeNull()
  })
})

describe('the ratios', () => {
  it('annualise a Sharpe by the root of the bars in a year, and refuse what cannot be worked out', () => {
    const rets = [0.01, -0.005, 0.02, 0.0, 0.004]
    const m = rets.reduce((a, b) => a + b, 0) / rets.length
    expect(annualisedSharpe(rets, 252)).toBeCloseTo((m / sampleStdev(rets)!) * Math.sqrt(252), 12)
    expect(annualisedSharpe(rets, null)).toBeNull()
    expect(annualisedSharpe([0.01], 252)).toBeNull()
    expect(annualisedSharpe([0.01, 0.01, 0.01], 252)).toBeNull() // no spread
  })

  it('scale per-trade ratios by how many trades of the average length fit in a year', () => {
    const rets = [5, -2, 3, -4, 6]
    const { sharpe, sortino } = perTradeRatios(rets, 10, 365)
    const m = rets.reduce((a, b) => a + b, 0) / rets.length
    expect(sharpe).toBeCloseTo((m / sampleStdev(rets)!) * Math.sqrt(36.5), 12)
    expect(sortino).toBeCloseTo((m / Math.sqrt((4 + 16) / 2)) * Math.sqrt(36.5), 12)
    expect(perTradeRatios([5], 10, 365)).toEqual({ sharpe: null, sortino: null })
    expect(perTradeRatios(rets, 10, null)).toEqual({ sharpe: null, sortino: null })
    expect(perTradeRatios([5, -2, 3], 10, 365).sortino).toBeNull() // one losing trade
  })

  it('measure the worst fall from a running peak', () => {
    expect(maxDrawdownFraction([1.1, 1.2, 0.9, 1.3, 1.04])).toBeCloseTo(0.25, 12)
    expect(maxDrawdownFraction([1.1, 1.2, 1.3])).toBe(0)
    expect(maxDrawdownFraction([0.8])).toBeCloseTo(0.2, 12)
  })
})

describe('the engines use the measured size', () => {
  it('equity: five years of daily bars are annualised over 252 sessions, not the 52 the old label implied', () => {
    const times = weekdays(1300)
    const closes = times.map((_, i) => 100 * (1 + 0.0004 * i + 0.02 * Math.sin(i / 7)))
    const r = runEquityBacktest(times, closes, closes.map(() => true))
    expect(r.periodsPerYear).toBe(252)
    const returns = closes.slice(1).map((c, i) => c / closes[i] - 1)
    expect(r.sharpe).toBeCloseTo(annualisedSharpe(returns, 252)!, 9)
    // Under the old label this would have been √52 instead of √252: about 2.2× smaller.
    expect(r.sharpe! / annualisedSharpe(returns, 52)!).toBeCloseTo(Math.sqrt(252 / 52), 9)
  })

  it('crypto: candles four days apart are annualised over 91.25 a year, not 252', () => {
    const candles: OhlcvCandle[] = every(400, 4).map((time, i) => {
      const close = 100 * (1 + 0.15 * Math.sin(i / 9)) + i * 0.05
      return { time, open: close * 0.995, high: close * 1.01, low: close * 0.99, close, volume: 1000 }
    })
    let checked = 0
    for (const key of ['ema_cross_fast', 'macd_trend', 'rsi_oversold', 'bollinger_bounce', 'sma20_reversion']) {
      const r = runBacktest(candles, key)
      if (!r) continue
      expect(r.metrics.periodsPerYear).toBe(91.25)
      if (r.metrics.sharpeRatio !== null) {
        const rets = r.trades.map((t) => t.returnPct)
        const hold = r.trades.reduce((a, t) => a + t.bars, 0) / r.trades.length
        expect(r.metrics.sharpeRatio).toBeCloseTo(perTradeRatios(rets, hold, 91.25).sharpe!, 9)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('neither engine keeps an annualisation constant of its own', () => {
    const crypto = read('src/lib/utils/backtest.ts').replace(/\/\/.*$/gm, '')
    const equity = read('src/lib/utils/equityBacktest.ts').replace(/\/\/.*$/gm, '')
    expect(crypto).not.toMatch(/Math\.sqrt\(252/)
    expect(equity).not.toMatch(/barsPerYear/)
    expect(read('src/app/(dashboard)/equities/backtests/page.tsx').replace(/\/\/.*$/gm, '')).not.toMatch(/barsPerYear|\(weekly\)|\(monthly\)/)
  })
})

describe('why there is no result (T-021)', () => {
  it('tells a missing key from failed providers and from short history', () => {
    expect(backtestGap({ ok: false, candles: [], error: 'no_provider_configured: add a key' }, 'AAPL').reason).toBe('needs-api-key')
    const failed = backtestGap({ ok: false, candles: [], error: 'fetch_failed', failures: ['tiingo: Tiingo 429'] }, 'ZZZZ')
    expect(failed.reason).toBe('upstream-failed')
    expect(failed.message).toContain('tiingo: Tiingo 429')
    expect(failed.message).not.toMatch(/key on the Integrations/)
    const short = backtestGap({ ok: true, candles: Array(12).fill({ time: 0, open: 1, high: 1, low: 1, close: 1, volume: 0 }) }, 'NEWCO')
    expect(short.reason).toBe('no-upstream')
    expect(short.message).toContain(`12 daily bars in this range, and a backtest needs at least ${MIN_BARS}`)
  })
})

describe('kept hidden (owner, 2026-10-26: "I want it to remain hidden")', () => {
  it('the equity page still redirects, has no nav entry, and the crypto and portfolio tabs stay off', () => {
    expect(read('next.config.mjs')).toMatch(/\{ source: '\/equities\/backtests', destination: '\/equities', permanent: false \}/)
    expect(read('src/lib/modules/registry.ts')).not.toMatch(/href: '\/equities\/backtests'/)
    expect(read('src/app/(dashboard)/technical-analysis/page.tsx')).toMatch(/^type Tab = 'chart' \| 'patterns'$/m)
    expect(read('src/app/(dashboard)/portfolios/page.tsx')).toMatch(/^type DetailTab = 'overview' \| 'analysis' \| 'look-through'$/m)
  })

  it('the data route serves the 2-year range the backtest offers (T-095)', () => {
    const route = read('src/app/live-data/security-ohlcv/route.ts')
    expect(route).toMatch(/'2Y':\s+\{ revalidate: 3600 \}/)
    expect(route).toMatch(/'2Y': 520/)
  })
})
