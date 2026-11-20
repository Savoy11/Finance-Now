import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { eq, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { mustResetPassword } from './passwordResetStore'
import { twoFactorRequired, verifyTwoFactorSignIn } from './twoFactorStore'

/**
 * The password was right, but the owner has forced a reset (T-435, D123), e.g. after a
 * breach. A distinct code so the login page can say so instead of "incorrect password".
 */
export class MustResetPasswordError extends CredentialsSignin {
  code = 'must_reset_password'
}

// Two-factor sign-in (T-088, D233). Three codes, all thrown only AFTER the password
// matched, so none of them tells anyone but the account's holder anything:
/** The account is enrolled and this attempt carried no code — the login form shows its second step. */
export class TwoFactorRequiredError extends CredentialsSignin {
  code = 'totp_required'
}
/** A code came and was wrong (or an already-used one was replayed). */
export class TwoFactorInvalidError extends CredentialsSignin {
  code = 'totp_invalid'
}
/** Too many wrong codes in a row; the account waits a few minutes (lib/auth/twoFactor.ts). */
export class TwoFactorThrottledError extends CredentialsSignin {
  code = 'totp_throttled'
}

// ─── Auth.js configuration ───────────────────────────────────────────────────
// Credentials-only for now (docs/ROADMAP.md Phase 0: "credentials now, OAuth
// later"). The users table already carries Auth.js-shaped columns, so adding
// @auth/drizzle-adapter + an OAuth provider later is additive.
//
// Session strategy is JWT rather than database sessions because the credentials
// provider does not support database sessions — Auth.js only persists a session
// row for providers it brokers itself.
//
// NOTE: the dashboard's auth wall is currently OFF by the owner's explicit
// request (see src/app/(dashboard)/layout.tsx). Everything here works, and
// /login will authenticate against the database, but nothing forces a user
// through it. See getCurrentUserId() in ./session.ts for how DB-backed features
// resolve an owner while the wall is down.

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        // The second step's code (authenticator or recovery), sent only once the first
        // attempt answered totp_required. Absent for accounts that never enrolled.
        otp: { label: 'Authentication code', type: 'text' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : ''
        const password = typeof credentials?.password === 'string' ? credentials.password : ''
        if (!email || !password) return null

        const [user] = await db
          .select()
          .from(users)
          // Match the lower(email) unique index rather than comparing raw
          // strings, so a user who signed up as Foo@x.com can log in as
          // foo@x.com.
          .where(eq(sql`lower(${users.email})`, email))
          .limit(1)

        if (!user?.passwordHash) return null

        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null

        // Checked only after the password matched, so the refusal tells nobody but the
        // account's holder that a reset is pending.
        if (await mustResetPassword(user.id)) throw new MustResetPasswordError()

        // Two-factor (T-088, D233), also only after the password matched. Not enrolled —
        // or migration 0012 not run, which reads as not enrolled — costs nothing here.
        if (await twoFactorRequired(user.id)) {
          const otp = typeof credentials?.otp === 'string' ? credentials.otp.trim() : ''
          if (!otp) throw new TwoFactorRequiredError()
          const check = await verifyTwoFactorSignIn(user.id, otp, new Date())
          if (check === 'throttled') throw new TwoFactorThrottledError()
          if (check !== 'ok') throw new TwoFactorInvalidError()
        }

        return { id: user.id, email: user.email, name: user.name ?? undefined, image: user.image ?? undefined }
      },
    }),
  ],
  callbacks: {
    // Persist the database user id into the token, then surface it on the
    // session. Without this, session.user.id is undefined and every
    // tenant-scoped query would have nothing to filter on.
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id
      return token
    },
    async session({ session, token }) {
      if (session.user && typeof token.uid === 'string') session.user.id = token.uid
      return session
    },
  },
})
