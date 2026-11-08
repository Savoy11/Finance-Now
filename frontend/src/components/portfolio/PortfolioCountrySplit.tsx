import { Globe2 } from 'lucide-react'
import { ExposureBars } from '@/components/markets/ExposureBars'
import { topSlices, type PortfolioCountries } from '@/lib/utils/fundExposure'

// Countries across a whole portfolio (T-455 c, D212): each fund's country split from its own
// N-PORT filing, weighted by the fund's share of the portfolio and added up. What it cannot see is
// named rather than spread over what it can: funds with no filing, and anything held directly.

const SHOWN = 10

export function PortfolioCountrySplit({ result, basis }: { result: PortfolioCountries; basis: 'target' | 'value' }) {
  const t = topSlices({ slices: result.slices, statedPct: result.countedPct, listedPct: 100, unstatedCount: 0 }, SHOWN)
  const without = result.fundsWithout
  return (
    <section aria-labelledby="portfolio-countries-heading" className="rounded-card border border-border bg-bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Globe2 size={14} className="text-text-muted" aria-hidden />
        <h3 id="portfolio-countries-heading" className="text-sm font-medium text-text-secondary">
          Countries across your funds
        </h3>
      </div>
      <p className="text-xs text-text-muted leading-relaxed">
        Each fund&rsquo;s split by country, from its own SEC N-PORT filing, weighted by its share of
        {basis === 'target' ? ' this portfolio’s target mix' : ' the portfolio’s live value'} and added up. Figures are shares of the
        whole portfolio. A holding&rsquo;s country is where its issuer is based, not where a company sells.
      </p>
      {result.slices.length > 0
        ? <ExposureBars title="By country" slices={t.shown} rest={t.rest} restNoun="countries" />
        : <p className="text-xs text-text-muted">None of the funds here has a country split to add up.</p>}
      <ul className="space-y-1 text-[11px] text-text-muted leading-relaxed">
        <li>Countries known for {result.countedPct.toFixed(1)}% of the portfolio.</li>
        {result.notStatedPct > 0.05 && (
          <li>{result.notStatedPct.toFixed(1)}% sits inside the funds with no country in their filings: cash, swaps and blank fields, left out rather than guessed.</li>
        )}
        {without.length > 0 && (
          <li className="text-amber-400/90">
            No country split for {without.map((w) => w.symbol).join(', ')} ({without.reduce((s, w) => s + w.weightPct, 0).toFixed(1)}% of
            the portfolio): {without.length === 1 ? 'its' : 'their'} own filing is not available here, so {without.length === 1 ? 'it is' : 'they are'} left out.
          </li>
        )}
        {result.directPct > 0.05 && (
          <li>
            {result.directPct.toFixed(1)}% is held directly, not through a fund, and is left out: the app does not record a
            company&rsquo;s or coin&rsquo;s home country outside a fund&rsquo;s filing.
          </li>
        )}
      </ul>
    </section>
  )
}
