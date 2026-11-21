import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
// Import the Tailwind SOURCE, not a pre-compiled snapshot. Next's postcss
// pipeline (postcss.config.js) compiles it on every build, so new utility
// classes always ship. The old globals.compiled.css import froze the CSS at
// whenever `npm run css:build` last ran — the market-calendar grid rendered
// single-column because grid-cols-7 postdated the snapshot.
import './globals.css'
import { Providers } from './providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// The chart axes and every `font-mono` figure ask for JetBrains Mono by name
// (globals.css --font-mono). It used to come from a Google Fonts @import in
// globals.css, which a browser ignores because Tailwind's own rules come first,
// so the font never loaded (code audit 2026-11-05). next/font serves it from
// the app's own build instead, as it does Inter.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Finance Now — Multi-Asset Financial Analytics',
    template: '%s | Finance Now',
  },
  description:
    'Institutional-grade multi-asset analytics: crypto, equities, funds, and macro — reserve transparency, technical analysis, and real-time alerts.',
  robots: 'noindex, nofollow',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="bg-bg-primary text-text-primary font-sans antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
