import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { LegalDocument } from '@/lib/legal/disclosures'
import { LEGAL_PATHS } from '@/lib/legal/links'
import { DraftNotice } from './DraftNotice'
import { LegalBlocks } from './LegalBlocks'
import { LegalText } from './LegalText'

/** One full legal document: title, effective date, draft notice, contents, sections. */
export function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  return (
    <article className="space-y-6">
      <div className="space-y-2">
        <Link href={LEGAL_PATHS.about} className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-accent-blue">
          <ArrowLeft size={12} aria-hidden /> About &amp; Legal
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary">{doc.title}</h1>
        {doc.effective && (
          <p className="text-xs text-text-muted"><LegalText text={doc.effective} /></p>
        )}
      </div>

      <DraftNotice />

      <div className="space-y-3">
        <LegalBlocks blocks={doc.intro} />
      </div>

      {doc.sections.length > 6 && (
        <nav aria-label="Contents" className="rounded-lg border border-border bg-bg-card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Contents</p>
          <ol className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-text-secondary hover:text-accent-blue">{s.heading}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {doc.sections.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-6 space-y-3">
          <h2 className="text-base font-semibold text-text-primary">{s.heading}</h2>
          <LegalBlocks blocks={s.blocks} />
        </section>
      ))}
    </article>
  )
}
