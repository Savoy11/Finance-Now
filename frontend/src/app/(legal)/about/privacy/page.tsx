import type { Metadata } from 'next'
import { PRIVACY_POLICY } from '@/lib/legal/disclosures'
import { LegalDocumentView } from '@/components/legal/LegalDocumentView'

export const metadata: Metadata = { title: 'Privacy Policy' }

/** The full Privacy Policy, from the disclosure draft (lib/legal/disclosures.ts). */
export default function PrivacyPage() {
  return <LegalDocumentView doc={PRIVACY_POLICY} />
}
