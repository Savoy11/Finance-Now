import type { Metadata } from 'next'
import { NOT_INVESTMENT_ADVICE } from '@/lib/legal/disclosures'
import { LegalDocumentView } from '@/components/legal/LegalDocumentView'

export const metadata: Metadata = { title: 'Not Investment Advice' }

/** The full Not Investment Advice, from the disclosure draft (lib/legal/disclosures.ts). */
export default function NotInvestmentAdvicePage() {
  return <LegalDocumentView doc={NOT_INVESTMENT_ADVICE} />
}
