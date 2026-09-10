'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { KeyRound } from 'lucide-react'
import {
  type GapFixability,
  type GapReason,
  type GapReasonId,
  gapReason,
  isActionable,
} from '@/lib/data/dataGaps'

/**
 * The inline "why is this missing?" marker.
 *
 * Takes no layout: a chip the width of its own text, which opens a small panel on
 * hover, focus or click. That is the point — a gap needs an explanation at every
 * site where a figure is absent, and a block-level notice per cell would bury the
 * data it is annotating. `LiveUnavailable` remains the right thing when a whole
 * surface has no source; this is for a value, a cell or a KPI.
 *
 * Colour follows `fixability`, not severity, so the page can be read at a glance:
 * an orange marker is work someone should do, and a grey one is a settled
 * limitation that should stop asking for attention. That distinction is the
 * feature — a gap the reader cannot triage is just a dash with extra steps.
 *
 * Accessibility, since a title= attribute was the thing this replaces: the
 * trigger is a real <button>, so it opens on keyboard focus and on touch, closes
 * on Escape, and is announced through aria-describedby. A native tooltip does
 * none of that, and on touch it simply never appears.
 */

interface DataGapNoteProps {
  /** Which reason. An unknown id renders nothing rather than an empty popover. */
  reason: GapReasonId | GapReason | null | undefined
  /**
   * Site-specific specifics appended under the generic `why` — the coin, the
   * provider, the field. Keep the generic reason in the registry and put the
   * particulars here, so the wording stays consistent across surfaces.
   */
  detail?: string
  /** Override the chip text where a shorter one reads better in a dense table. */
  chip?: string
  /** Render only the dot, no text — for the tightest table cells. */
  iconOnly?: boolean
  className?: string
  /** Where the panel opens. Defaults to above, which is right inside a table row. */
  position?: 'top' | 'bottom'
}

/** Chip colours by what would close the gap — see the component note. */
const STYLE: Record<GapFixability, { chip: string; dot: string; heading: string }> = {
  // Actionable today, one click away. Amber: the app's "warning, but handled".
  'add-a-key': {
    chip: 'border-amber-500/25 bg-amber-500/10 text-amber-300/90',
    dot: 'bg-amber-400',
    heading: 'text-amber-300',
  },
  // A real gap. Orange is the app's "high" band, and that is the intent.
  'needs-work': {
    chip: 'border-orange-500/30 bg-orange-500/10 text-orange-300/90',
    dot: 'bg-orange-400',
    heading: 'text-orange-300',
  },
  // Nothing to do. Deliberately the quietest thing on the page.
  'no-source': {
    chip: 'border-slate-500/20 bg-slate-500/5 text-slate-400',
    dot: 'bg-slate-500',
    heading: 'text-slate-300',
  },
  // Working as intended.
  'by-design': {
    chip: 'border-slate-500/20 bg-slate-500/5 text-slate-400',
    dot: 'bg-slate-500',
    heading: 'text-slate-300',
  },
  // Self-resolving. Blue reads as information, not as a problem.
  transient: {
    chip: 'border-sky-500/25 bg-sky-500/10 text-sky-300/90',
    dot: 'bg-sky-400',
    heading: 'text-sky-300',
  },
}

export function DataGapNote({
  reason,
  detail,
  chip,
  iconOnly,
  className,
  position = 'top',
}: DataGapNoteProps) {
  const resolved = typeof reason === 'string' ? gapReason(reason) : reason ?? null
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)
  const panelId = useId()

  // Escape closes, and a click anywhere else closes — both needed once the
  // trigger is clickable, because a hover-only panel is unreachable on touch and
  // a click-opened one that cannot be dismissed is a trap.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  // An unrecognised reason renders nothing at all. A marker that opens to say
  // nothing is worse than no marker: it reads as "explained" while explaining
  // nothing, which is the exact failure this component exists to fix.
  if (!resolved) return null

  const style = STYLE[resolved.fixability]
  const label = chip ?? resolved.chip
  const showKeyLink = resolved.fixability === 'add-a-key'

  return (
    <span
      ref={wrap}
      className={clsx('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-describedby={open ? panelId : undefined}
        aria-label={`${resolved.label}. ${resolved.why}`}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={clsx(
          'inline-flex items-center gap-1 rounded border leading-none cursor-help',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-blue',
          iconOnly ? 'p-1' : 'px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
          style.chip
        )}
      >
        <span className={clsx('inline-block h-1.5 w-1.5 rounded-full shrink-0', style.dot)} aria-hidden />
        {!iconOnly && <span>{label}</span>}
      </button>

      {open && (
        <span
          id={panelId}
          role="tooltip"
          className={clsx(
            'absolute z-50 w-64 rounded-lg border border-border bg-bg-elevated p-3 text-left shadow-card-hover',
            'left-1/2 -translate-x-1/2 animate-fade-in',
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          <span className={clsx('block text-xs font-semibold', style.heading)}>{resolved.label}</span>
          <span className="mt-1 block text-[11px] leading-relaxed text-text-secondary">{resolved.why}</span>
          {detail && (
            <span className="mt-1.5 block text-[11px] leading-relaxed text-text-muted">{detail}</span>
          )}
          {resolved.fix && (
            <span className="mt-2 block border-t border-border pt-2 text-[11px] leading-relaxed text-text-muted">
              {resolved.fix}
            </span>
          )}
          {showKeyLink && (
            <Link
              href="/settings"
              className="mt-2 inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              <KeyRound size={10} aria-hidden /> Open Integrations
            </Link>
          )}
        </span>
      )}
    </span>
  )
}

/** Re-exported so a caller can style a row by triage state without a second import. */
export { isActionable }
