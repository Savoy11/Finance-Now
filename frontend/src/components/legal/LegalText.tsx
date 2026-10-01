import Link from 'next/link'
import { parseInline } from '@/lib/legal/inline'

/**
 * One string of legal copy, with its three marks rendered: bold lead-ins, links,
 * and unfilled blanks — highlighted, so "[CONTACT EMAIL]" can never pass for a
 * finished sentence.
 */
export function LegalText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((t, i) => {
        switch (t.kind) {
          case 'text':
            return <span key={i}>{t.text}</span>
          case 'bold':
            return <strong key={i} className="font-semibold text-text-primary">{t.text}</strong>
          case 'blank':
            return (
              <mark key={i} className="rounded bg-amber-500/15 px-1 font-mono text-[0.85em] text-amber-300" title="Blank in the draft — not filled in yet">
                {t.text}
              </mark>
            )
          case 'link':
            return t.href.startsWith('/') || t.href.startsWith('#') ? (
              <Link key={i} href={t.href} className="text-accent-blue hover:underline">{t.text}</Link>
            ) : (
              <a key={i} href={t.href} target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline">{t.text}</a>
            )
        }
      })}
    </>
  )
}
