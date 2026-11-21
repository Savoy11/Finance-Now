import type { Metadata } from 'next'
import { SIGNUP_CONSENT } from '@/lib/legal/signupConsent'
import { requireAuthOn } from '@/lib/server/authWall'
import { SignupForm } from './SignupForm'

// The sign-up page (T-132, built dark under D232; shown only once
// FN_REQUIRE_AUTH turns the sign-in wall on at launch, D174). The form posts
// to /api/auth/signup with `electronicConsent: true` and the `consentVersion`
// of SIGNUP_CONSENT — the exact wording shown here is the wording stored with
// the agreement (T-436, D127), and the route refuses an account without it.
// electronicConsent.test.ts holds this page and its form to that box.

export const metadata: Metadata = { title: 'Create account' }

export default function SignupPage() {
  return <SignupForm open={requireAuthOn()} consent={SIGNUP_CONSENT} />
}
