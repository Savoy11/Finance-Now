import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { LegalBlock } from '@/lib/legal/disclosures'
import { LegalText } from './LegalText'

/** Paragraphs, lists, tables and "read more" pointers, in the order given. */
export function LegalBlocks({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'p':
            return (
              <p key={i} className="text-sm leading-relaxed text-text-secondary">
                <LegalText text={b.text} />
              </p>
            )
          case 'list':
            return (
              <ul key={i} className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-text-secondary marker:text-text-muted">
                {b.items.map((item, j) => (
                  <li key={j}><LegalText text={item} /></li>
                ))}
              </ul>
            )
          case 'table':
            return (
              <div key={i} className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-bg-elevated text-text-primary">
                    <tr>
                      {b.head.map((h, j) => (
                        <th key={j} scope="col" className="px-3 py-2 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-text-secondary">
                    {b.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) =>
                          k === 0 ? (
                            <th key={k} scope="row" className="px-3 py-2 align-top font-medium text-text-primary">
                              <LegalText text={cell} />
                            </th>
                          ) : (
                            <td key={k} className="px-3 py-2 align-top leading-relaxed"><LegalText text={cell} /></td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'more':
            return (
              <p key={i} className="text-sm">
                <Link href={b.href} className="inline-flex items-center gap-1 text-accent-blue hover:underline">
                  {b.text} <ArrowRight size={13} aria-hidden />
                </Link>
              </p>
            )
        }
      })}
    </>
  )
}
