import type { Metadata } from 'next'
import { ABOUT_PAGE, providerCredits } from '@/lib/legal/disclosures'
import { DraftNotice } from '@/components/legal/DraftNotice'
import { LegalBlocks } from '@/components/legal/LegalBlocks'

export const metadata: Metadata = { title: 'About & Legal' }

/**
 * About & Legal (D50, T-293): who makes Finance Now, how it is paid, and the
 * documents that govern it, in the ten sections of the disclosure draft's
 * "About page" tab. Replaces /how-we-make-money, which redirects to the second
 * section. The text lives in lib/legal/disclosures.ts.
 */
export default function AboutPage() {
  const credits = providerCredits()
  return (
    <article className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-text-primary">{ABOUT_PAGE.title}</h1>
        <DraftNotice />
        <nav aria-label="On this page" className="rounded-lg border border-border bg-bg-card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">On this page</p>
          <ol className="grid list-decimal gap-x-6 gap-y-1 pl-4 text-xs text-text-muted sm:grid-cols-2">
            {ABOUT_PAGE.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-text-secondary hover:text-accent-blue">{s.heading}</a>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {ABOUT_PAGE.sections.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-6 space-y-3">
          <h2 className="text-base font-semibold text-text-primary">{s.heading}</h2>
          {s.id === 'where-our-data-comes-from' && credits.length > 0 && (
            // The credits providers' terms require, read from the data-source
            // registry (CoinGecko's must be linked and at least 10px: text-sm).
            <ul className="space-y-1 text-sm text-text-secondary">
              {credits.map((c) => (
                <li key={c.text}>
                  {c.href ? (
                    <a href={c.href} target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline">{c.text}</a>
                  ) : c.text}
                </li>
              ))}
            </ul>
          )}
          <LegalBlocks blocks={s.blocks} />
        </section>
      ))}
    </article>
  )
}
