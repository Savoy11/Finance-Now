import { requireAuthOn } from '@/lib/server/authWall'
import { LoginForm } from './LoginForm'

// Sign-in stays OFF until launch (D174). The switch is the environment, not a
// code flip (D232, 2026-11-16): while FN_REQUIRE_AUTH is unset this page
// redirects away exactly as the old LOGIN_DISABLED constant did, and the
// sign-in wall in src/middleware.ts stays inert. AT LAUNCH set
// FN_REQUIRE_AUTH=true, AUTH_SECRET (openssl rand -base64 32) and
// FN_SITE_OPEN=true — nothing in the code changes. The session Auth.js creates
// is the one getCurrentUserId() reads, so a signed-in user sees their own rows
// rather than local-user mode's shared ones.
export default function LoginPage() {
  return <LoginForm open={requireAuthOn()} />
}
