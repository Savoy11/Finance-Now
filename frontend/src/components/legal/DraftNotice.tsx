import { FileWarning } from 'lucide-react'
import { disclosuresInForce, unfilledBlanks } from '@/lib/legal/disclosures'

/**
 * Shown on every page that carries the disclosure text until the owner approves
 * the set AND every blank is filled (`disclosuresInForce`). The list of blanks is
 * read from the text itself, so it shrinks as they are filled and cannot claim a
 * blank that is gone or miss one that is not.
 */
export function DraftNotice() {
  if (disclosuresInForce()) return null
  const blanks = unfilledBlanks()
  return (
    <div role="note" className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
        <FileWarning size={14} aria-hidden /> Draft — not yet in force
      </p>
      <p className="mt-2 text-xs leading-relaxed text-text-secondary">
        This is the first draft of Finance Now&rsquo;s public documents. It has not been approved yet,
        the highlighted blanks are still to be filled in, and some statements describe the site as it
        should stand at launch rather than as it is today.
      </p>
      {blanks.length > 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
          Blanks still to fill ({blanks.length}): {blanks.join(', ')}
        </p>
      )}
    </div>
  )
}
