import Link from 'next/link'
import { FOOTER_LINKS, FOOTER_NOTICE } from '@/lib/legal/links'

/**
 * The footer on every page (D50, T-293): the one-line not-advice notice and the
 * links to About, Terms, Privacy and the full notice. Rendered by all three
 * layouts — the app, the sign-in page and the public About & Legal pages — so
 * a visitor who is not signed in still reaches the Privacy Policy (CalOPPA;
 * CoinGecko API Terms §7(e)).
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-2 text-[11px] leading-relaxed text-text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{FOOTER_NOTICE}</p>
        <nav aria-label="About and legal">
          <ul className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {FOOTER_LINKS.map((l, i) => (
              <li key={l.href} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>·</span>}
                <Link href={l.href} className="hover:text-accent-blue hover:underline">{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  )
}
