import type { Metadata } from 'next'
import { TERMS_OF_USE } from '@/lib/legal/disclosures'
import { LegalDocumentView } from '@/components/legal/LegalDocumentView'

export const metadata: Metadata = { title: 'Terms of Use' }

/** The full Terms of Use, from the disclosure draft (lib/legal/disclosures.ts). */
export default function TermsPage() {
  return <LegalDocumentView doc={TERMS_OF_USE} />
}
