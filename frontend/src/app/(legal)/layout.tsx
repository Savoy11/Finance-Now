import Link from 'next/link'
import { Activity } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'
import { SiteFooter } from '@/components/layout/SiteFooter'

/**
 * The public shell for About & Legal (D50).
 *
 * WHY NOT THE DASHBOARD LAYOUT. That layout renders nothing to a signed-out
 * visitor once REQUIRE_AUTH is switched back on, and these pages are exactly
 * the ones a signed-out visitor must be able to read: the sign-in page links to
 * the Terms and the Privacy Policy, and California's online privacy law expects
 * the privacy link on the first page a visitor sees to work. So they live in
 * their own route group with no sign-in gate, no sidebar and no live-data
 * queries — the URLs are unchanged (/about…), since a route group adds no path.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/headlines" className="flex items-center gap-2 text-sm font-semibold text-text-primary hover:text-accent-blue">
            <Activity size={16} className="text-accent-blue" aria-hidden />
            {APP_NAME}
          </Link>
          <Link href="/headlines" className="text-xs text-text-muted hover:text-accent-blue">
            Back to {APP_NAME}
          </Link>
        </div>
      </header>
      <main role="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
