import { formatShare, type ExposureSlice } from '@/lib/utils/fundExposure'

// One split from a fund's filing as labelled bars (T-455): a fund's countries, currencies,
// borrowers or maturities, or a portfolio's countries. Bars are scaled to the largest slice; the
// figures beside them are shares of the whole, never rescaled. A negative share (a short
// position) keeps its sign in the figure while its bar clamps at zero.

export function ExposureBars({ slices, rest, restNoun, title, note }: {
  slices: ExposureSlice[]
  rest?: { count: number; pct: number } | null
  /** "countries": "and 12 more countries". */
  restNoun?: string
  title: string
  note?: React.ReactNode
}) {
  const max = Math.max(...slices.map((s) => s.pct), rest?.pct ?? 0, 0.0001)
  return (
    <div className="min-w-0">
      <h3 className="text-xs font-medium text-text-secondary mb-2">{title}</h3>
      {slices.length === 0 ? (
        <p className="text-xs text-text-muted">The filing states none.</p>
      ) : (
        <ul className="space-y-1.5">
          {slices.map((s) => <Bar key={s.code} label={s.label} pct={s.pct} max={max} />)}
          {rest && <Bar label={`${rest.count} more ${restNoun ?? ''}`.trim()} pct={rest.pct} max={max} muted />}
        </ul>
      )}
      {note && <p className="mt-1.5 text-[10px] leading-relaxed text-text-muted">{note}</p>}
    </div>
  )
}

function Bar({ label, pct, max, muted }: { label: string; pct: number; max: number; muted?: boolean }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className={`w-32 sm:w-56 truncate shrink-0 ${muted ? 'text-text-muted italic' : 'text-text-muted'}`} title={label}>{label}</span>
      <div className="flex-1 min-w-0 h-1.5 rounded-full bg-bg-elevated">
        <div className="h-full rounded-full bg-accent-blue" style={{ width: `${Math.max(0, Math.min(100, (pct / max) * 100))}%`, opacity: muted ? 0.4 : 0.7 }} />
      </div>
      <span className="w-14 text-right font-mono tabular-nums text-text-secondary shrink-0">{formatShare(pct)}</span>
    </li>
  )
}
