'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { StatusBar } from '@/components/layout/StatusBar'
import { DataStatusBanner } from '@/components/layout/DataStatusBanner'
import { PopoutLayer } from '@/components/layout/PopoutLayer'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { AssistantWidget } from '@/components/agents/AssistantWidget'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useSession }       from 'next-auth/react'
import { useFeedStatus }    from '@/lib/feed/useFeedStatus'
import { useRecentAlerts }  from '@/hooks/useAlerts'
import { useGlobalRefresh } from '@/hooks/useGlobalRefresh'
import { usePriceAlertMonitor } from '@/hooks/usePriceAlertMonitor'
import { usePlanReminderMonitor } from '@/hooks/usePlanReminderMonitor'
import { PullToRefresh }    from '@/components/ui/PullToRefresh'
import { SiteFooter }       from '@/components/layout/SiteFooter'
// SIGN-IN STAYS OFF UNTIL LAUNCH (D174). The wall itself moved out of this
// client component into src/middleware.ts behind FN_REQUIRE_AUTH (D232,
// 2026-11-16): a page request without a signed-in session is redirected to
// /login before anything renders, which is what auth.md's Goal B step 3 asked
// for. Launch is environment only — FN_REQUIRE_AUTH=true, AUTH_SECRET
// (Auth.js reads it straight from env, so it appears in no source file and
// grep won't find it) and FN_SITE_OPEN=true — with no code flip here or on
// the login page.
//
// This client-side check is KEPT FALSE on purpose and is no longer the wall:
// the middleware walls pages server-side, so flipping this would only add a
// second, later redirect. History: the comment here once prescribed
// `const REQUIRE_AUTH = !LIVE_DATA`, a broken recipe (LIVE_DATA is hardcoded
// true), and until D232 the wall was this client effect plus a LOGIN_DISABLED
// constant on the login page.
const REQUIRE_AUTH = false

function DashboardInner({ children }: { children: React.ReactNode }) {
  useFeedStatus()                          // drives the Sidebar/StatusBar feed dot
  useRecentAlerts(20)
  const { refresh } = useGlobalRefresh()   // registers auto-refresh interval
  usePriceAlertMonitor()                   // user price alerts, app-wide
  usePlanReminderMonitor()                 // builder-plan drift reminders (T-116, D237)

  // Mobile navigation drawer (hidden on lg+ where the sidebar is always visible)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const pathname = usePathname()
  useEffect(() => { setMobileNavOpen(false) }, [pathname])

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Backdrop for the mobile drawer */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-xs lg:hidden"
          aria-hidden
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <div className="flex-1 min-w-0 lg:ml-sidebar flex flex-col min-h-screen">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <PullToRefresh
          onRefresh={refresh}
          className="flex-1 mt-topbar mb-statusbar"
        >
          <main role="main">
            <DataStatusBanner />
            <div className="p-4 sm:p-6"><ErrorBoundary>{children}</ErrorBoundary></div>
          </main>
          <SiteFooter />
        </PullToRefresh>
        <StatusBar />
      </div>
      <PopoutLayer />
      <CommandPalette />
      <AssistantWidget />
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { status } = useSession()

  // 'loading' is deliberately not treated as unauthenticated: the session is
  // fetched after mount, so redirecting on it would bounce a signed-in user to
  // /login on every page load.
  const blocked = REQUIRE_AUTH && status === 'unauthenticated'

  useEffect(() => {
    if (blocked) router.push('/login')
  }, [blocked, router])

  if (REQUIRE_AUTH && status !== 'authenticated') return null

  return <DashboardInner>{children}</DashboardInner>
}
