import type { VideosResponse } from '@/app/live-data/videos/route'

/**
 * Why the Videos page has no channel videos to show, from the route's own account (2026-11-09).
 *
 * "No channels are switched on" only when the feed answered and asked no channel. A request that
 * failed (a rate limit, a lock, an unreadable answer) leaves no count at all, and used to read as
 * "no channels switched on", sending the reader to Settings for nothing (code audit 2026-11-09, D214).
 */
export function videoFeedNote(data: unknown, error?: unknown): string {
  const d = (data && typeof data === 'object' ? data : {}) as Partial<VideosResponse> & { error?: unknown }
  if (typeof d.tried !== 'number') {
    const why = typeof d.error === 'string' ? d.error : error instanceof Error ? error.message : null
    return `The video feed could not be loaded right now${why ? ` (${why})` : ''}.`
  }
  const failed = d.failed ?? []
  if (d.tried === 0) return 'No video channels are switched on. Turn some on in Settings → Integrations.'
  if (failed.length === 0) return 'No videos available: the channel feeds answered with none.'
  const reasons = [...new Set(failed.map((f) => f.error))]
  const shown = reasons.slice(0, 2).join('; ')
  const more = reasons.length > 2 ? ` and ${reasons.length - 2} more reasons` : ''
  return failed.length === d.tried
    ? `None of the ${d.tried} channel feeds could be read (${shown}${more}).`
    : `No videos available: ${failed.length} of ${d.tried} channel feeds could not be read (${shown}${more}).`
}
