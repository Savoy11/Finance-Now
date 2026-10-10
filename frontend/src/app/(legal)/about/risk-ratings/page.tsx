import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ASSET_PAGE_RATINGS_SHOWN } from '@/lib/risk/visibility'
import { RatingMethodology } from '@/components/legal/RatingMethodology'

export const metadata: Metadata = { title: 'How the measured-risk rating works' }

// The published method behind the coin and stock ratings (T-420 item 5). Public, like the
// rest of About & Legal, once the ratings are shown; a 404 until then (lib/risk/visibility.ts).
export default function RiskRatingsMethodologyPage() {
  if (!ASSET_PAGE_RATINGS_SHOWN) notFound()
  return <RatingMethodology />
}
