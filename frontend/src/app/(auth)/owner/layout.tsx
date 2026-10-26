import type { Metadata } from 'next'

// The (auth) layout titles every page "Sign In"; this page is not one.
export const metadata: Metadata = {
  title: 'Owner access',
}

export default function OwnerAccessLayout({ children }: { children: React.ReactNode }) {
  return children
}
