import { clsx } from 'clsx'
import type { RequiredCredit } from '@/lib/data/dataSources'

/**
 * Licence-required credits, verbatim and at the size the licence sets. CoinGecko's API
 * Terms clause 4 prescribes the MESSAGE ("Powered by CoinGecko") and a size of at least
 * 10; 11px clears that with a margin. One component sets the size for every place a
 * credit appears: SourceLine, and the AI answers that quote CoinGecko figures (D101).
 * lib/data/__tests__/attribution.test.ts reads the class and fails below the floor.
 *
 * `separated` puts a "·" before each credit, for a credit that follows other text on
 * the same line, as in SourceLine.
 */
export function RequiredCredits({ credits, separated = false, className }: {
  credits: readonly RequiredCredit[]
  separated?: boolean
  className?: string
}) {
  if (credits.length === 0) return null
  return (
    <span className={clsx('inline-flex flex-wrap items-center gap-x-1.5 gap-y-1', className)}>
      {credits.map((a) => (
        <span key={a.text} className="text-[11px] leading-none text-text-secondary">
          {separated && '· '}
          {a.href?.startsWith('https://') ? (
            <a href={a.href} target="_blank" rel="noopener noreferrer" className="hover:text-accent-blue">
              {a.text}
            </a>
          ) : a.text}
        </span>
      ))}
    </span>
  )
}
