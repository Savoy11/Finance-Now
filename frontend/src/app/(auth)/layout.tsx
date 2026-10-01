import type { Metadata } from 'next'
import { SiteFooter } from '@/components/layout/SiteFooter'

export const metadata: Metadata = {
  title: 'Sign In',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
      {/* The sign-in page is the first page a visitor sees while sign-in is on,
          so its footer is where the Privacy link has to be (D50). */}
      <SiteFooter />
    </div>
  )
}
