'use client'

import { clsx } from 'clsx'
import { ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import type { OutboundLink } from '@/lib/data/affiliates'

/**
 * The single outbound-link component for anything that might be monetised.
 *
 * Every affiliate surface renders through this, so a new page cannot ship a
 * paid link without its disclosure — the ROADMAP's requirement that disclosure
 * "can't be forgotten on a new surface" is met by there being nowhere else to
 * put the link.
 *
 * What it guarantees, per link:
 *
 * - **`rel="sponsored noopener noreferrer"`** on a paid link. Google requires
 *   `sponsored`; `noopener` is the security half and is on every link either way.
 * - **A visible tag beside the link**, not a footer. The FTC standard is "clear
 *   and conspicuous", and a disclosure the reader has to go looking for fails it.
 *   The tag is rendered from the same value that decides the URL, so a link
 *   cannot be sponsored while the tag says otherwise.
 * - **A click count** fired to `/api/affiliate/clicks`, aggregate-only. Fired
 *   with `keepalive` so the navigation is never delayed or blocked by it, and
 *   any failure is swallowed: a lost statistic must not cost the reader the
 *   click they asked for.
 */

interface Props {
  link: OutboundLink
  /** Catalog id of the thing being linked to — the only thing the counter stores. */
  providerId: string
  children: ReactNode
  className?: string
  title?: string
  /** Hide the inline tag ONLY where an ancestor already discloses this exact link. */
  suppressTag?: boolean
  showIcon?: boolean
}

/** Fire-and-forget. Never awaited, never surfaced, never allowed to block a navigation. */
function countClick(providerId: string) {
  try {
    void fetch('/api/affiliate/clicks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // A blocked or unavailable counter is not the reader's problem.
  }
}

export function SponsoredLink({
  link, providerId, children, className, title, suppressTag = false, showIcon = true,
}: Props) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <a
        href={link.href}
        target="_blank"
        // `sponsored` only when it is actually a paid link — applying it to
        // every outbound link would make the signal meaningless to both search
        // engines and anyone reading the markup.
        rel={link.sponsored ? 'sponsored noopener noreferrer' : 'noopener noreferrer'}
        onClick={() => { if (link.sponsored) countClick(providerId) }}
        className={className}
        title={title}
      >
        {children}
        {showIcon && <ExternalLink size={11} className="shrink-0 ml-1 inline align-baseline" aria-hidden />}
      </a>
      {link.sponsored && !suppressTag && <SponsoredTag program={link.program} />}
    </span>
  )
}

/**
 * The visible disclosure. Exported so a surface that groups several paid links
 * can label them consistently — never so a caller can render a paid link
 * without one.
 */
export function SponsoredTag({ program, className }: { program?: string; className?: string }) {
  return (
    <a
      href="/how-we-make-money"
      title={
        program
          ? `We may earn a commission if you sign up through this link (${program}). It costs you nothing and does not affect this provider's risk score or its position in any list.`
          : 'We may earn a commission if you sign up through this link. It costs you nothing and does not affect this provider’s risk score or its position in any list.'
      }
      className={clsx(
        'shrink-0 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5',
        'text-[10px] font-semibold uppercase tracking-wider text-amber-300/90',
        'transition-colors hover:border-amber-400/50 hover:text-amber-200',
        className,
      )}
    >
      Paid link
    </a>
  )
}
