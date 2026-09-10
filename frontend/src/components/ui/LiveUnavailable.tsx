'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { Info, KeyRound } from 'lucide-react'
import { type GapFixability, type GapReasonId, gapReason } from '@/lib/data/dataGaps'

interface LiveUnavailableProps {
  title?: string
  /** What is missing and why there is no live source for it. */
  message: string
  /**
   * Which kind of gap this is. Optional only because it postdates the call
   * sites; supply it on anything new.
   *
   * Passing it does three things `message` alone cannot: it colours the panel by
   * whether anyone should act, it decides the Integrations link instead of
   * leaving that to a default, and it puts this notice in the same vocabulary as
   * the inline `DataGapNote` markers — so a surface and the cells inside it
   * cannot describe the same gap two different ways.
   */
  reason?: GapReasonId
  className?: string
  compact?: boolean
  /**
   * Force the Integrations link on or off.
   *
   * Prefer `reason` and let this derive. The default used to be an unconditional
   * `true`, which is a landmine: the first gap added that a key CANNOT fix would
   * have told users to go buy one. W3-7 was right that a notice naming a fix with
   * nothing to click is a dead end — but the inverse, offering a fix that does
   * not exist, is worse, because the reader spends money to find out.
   */
  showIntegrationsLink?: boolean
}

/** Panel tint by what would actually close the gap — mirrors DataGapNote. */
const TONE: Record<GapFixability, { box: string; icon: string }> = {
  'add-a-key':  { box: 'border-amber-500/20 bg-amber-500/5',  icon: 'text-amber-400/70' },
  'needs-work': { box: 'border-orange-500/20 bg-orange-500/5', icon: 'text-orange-400/70' },
  'no-source':  { box: 'border-slate-500/20 bg-slate-500/5',   icon: 'text-slate-400/70' },
  'by-design':  { box: 'border-slate-500/20 bg-slate-500/5',   icon: 'text-slate-400/70' },
  transient:    { box: 'border-sky-500/20 bg-sky-500/5',       icon: 'text-sky-400/70' },
}

/**
 * Strict-live placeholder for a WHOLE SURFACE with no reachable source.
 *
 * For a single value, cell or KPI use `DataGapNote` instead — it takes no layout,
 * where this deliberately occupies the space the data would have filled so the
 * absence cannot be mistaken for an empty result.
 */
export function LiveUnavailable({
  title,
  message,
  reason,
  className,
  compact,
  showIntegrationsLink,
}: LiveUnavailableProps) {
  const resolved = gapReason(reason)
  const tone = TONE[resolved?.fixability ?? 'add-a-key']

  // Derive from the reason where one is given; fall back to the historical
  // default only for call sites that predate it.
  const showLink = showIntegrationsLink ?? (resolved ? resolved.fixability === 'add-a-key' : true)
  const heading = title ?? resolved?.label ?? 'Not available with live data'

  return (
    <div
      className={clsx(
        'rounded-xl border text-center',
        tone.box,
        compact ? 'p-4' : 'p-8',
        className,
      )}
    >
      <Info className={clsx('mx-auto', compact ? 'h-5 w-5' : 'h-7 w-7', tone.icon)} aria-hidden />
      <p className={clsx('mt-2 font-medium text-slate-200', compact ? 'text-xs' : 'text-sm')}>{heading}</p>
      <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto leading-relaxed">{message}</p>
      {resolved?.fix && !showLink && (
        <p className="mt-2 text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">{resolved.fix}</p>
      )}
      {showLink && (
        <Link
          href="/settings"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
        >
          <KeyRound size={12} aria-hidden /> Add a data source in Integrations
        </Link>
      )}
    </div>
  )
}
