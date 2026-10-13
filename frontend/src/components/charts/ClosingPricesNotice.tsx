import { candleSizeWords } from '@/lib/utils/candleGranularity'
import { NOT_FROM_CLOSES } from '@/components/charts/indicatorRegistry'
import type { ClosesReason } from '@/hooks/useCryptoChartSeries'

// Shown wherever a crypto chart draws DefiLlama's closing prices instead of
// candles (T-423, D103), so the line, the shorter indicator menu and the missing
// panels read as a stated substitution rather than a broken page.

const WHY: Record<ClosesReason, string> = {
  'no-candles': 'No candle source answered for this range.',
  'coarse-candles': 'For this range CoinGecko’s free service sends only 4-day candles.',
}

/** "a", "a and b", "a, b and c". */
function listed(items: readonly string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export function ClosingPricesNotice({
  reason, size, source, candleError, panelsOff, className,
}: {
  reason: ClosesReason
  /** The measured spacing of the prices drawn, e.g. '1D'. */
  size: string | null | undefined
  source?: string
  /** The candle request's own failure, kept for whoever wants the detail. */
  candleError?: string
  /** This page's panels that need ranges, e.g. ['the signal summary', 'key levels']. */
  panelsOff: readonly string[]
  className?: string
}) {
  const words = candleSizeWords(size)
  const lead = `${words ? words.charAt(0).toUpperCase() + words.slice(1) + ' closing' : 'Closing'} prices${source ? ` from ${source}` : ''}, drawn as a line.`
  const off = listed(['the candle chart types', `the ${NOT_FROM_CLOSES.length} indicators that read them`, ...panelsOff])
  return (
    <div
      className={`rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-400/90 ${className ?? ''}`}
      title={candleError}
    >
      <strong className="font-semibold">{lead}</strong> {WHY[reason]} One price per period has no high,
      low or volume, so {off} are off for this view.
    </div>
  )
}
