import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { LEGAL_PATHS } from '@/lib/legal/links'
import { DATA_METHODS } from '@/lib/legal/dataMethods'

export const metadata: Metadata = { title: 'How our figures are worked out' }

// Public, like the rest of About & Legal: the rules behind the figures (D163). The text is in
// lib/legal/dataMethods.ts, read from the code that applies each rule.
export const dynamic = 'force-static'

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })

export default function DataMethodsPage() {
  return (
    <article className="space-y-6">
      <div className="space-y-2">
        <div><Link href={LEGAL_PATHS.about} className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-accent-blue">
          <ArrowLeft size={12} aria-hidden /> About &amp; Legal
        </Link></div>
        <h1 className="text-2xl font-semibold text-text-primary">How our figures are worked out</h1>
        <p className="text-sm leading-relaxed text-text-secondary">
          The rules Finance Now follows when it shows a figure: where it comes from, what it means, and
          what is done when a source gives a range or nothing at all. Where a rule came from a recent
          decision, its date is shown.
        </p>
      </div>

      <nav aria-label="On this page" className="text-sm">
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {DATA_METHODS.map((s) => (
            <li key={s.id}><a href={`#${s.id}`} className="text-accent-blue hover:underline">{s.title}</a></li>
          ))}
        </ul>
      </nav>

      {DATA_METHODS.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-20 space-y-2">
          <h2 className="text-lg font-semibold text-text-primary">{s.title}</h2>
          {s.decided && <p className="text-xs text-text-muted">Rule as of {formatDate(s.decided)}</p>}
          {s.paragraphs.slice(0, s.items ? 1 : undefined).map((p) => (
            <p key={p} className="text-sm leading-relaxed text-text-secondary">{p}</p>
          ))}
          {s.items && (
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-text-secondary">
              {s.items.map((i) => (
                <li key={i.term}><span className="font-medium text-text-primary">{i.term}:</span> {i.text}</li>
              ))}
            </ul>
          )}
          {s.items && s.paragraphs.slice(1).map((p) => (
            <p key={p} className="text-sm leading-relaxed text-text-secondary">{p}</p>
          ))}
        </section>
      ))}
    </article>
  )
}
