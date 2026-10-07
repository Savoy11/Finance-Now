import clsx from 'clsx'
import { FEATURE_NOTICES, type FeatureNoticeId } from '@/lib/legal/featureNotices'

/**
 * One of the disclosure draft's short not-advice lines, beside the feature it
 * qualifies (T-293). The words live in lib/legal/featureNotices.ts and nowhere
 * else. The footer on every page links the full notice.
 *
 * `className` is for spacing and alignment only. Size and colour are fixed so
 * every line reads the same, and the colour is the secondary text tone rather
 * than the muted one: muted text sits near 2.6:1 contrast on the app's
 * background, and a notice nobody can read protects nobody.
 */
export function FeatureNotice({ feature, className }: { feature: FeatureNoticeId; className?: string }) {
  return (
    <p role="note" data-feature-notice={feature} className={clsx('text-[11px] leading-relaxed text-text-secondary', className)}>
      {FEATURE_NOTICES[feature]}
    </p>
  )
}
