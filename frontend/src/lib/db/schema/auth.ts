import { pgTable, text, timestamp, uuid, boolean, uniqueIndex, index, bigint } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { ModuleId } from '@/lib/modules/registry'

// ─── Identity & entitlements ─────────────────────────────────────────────────
// Multi-tenant from day one (docs/ROADMAP.md): every user-owned row elsewhere
// carries user_id referencing users.id.

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  // bcrypt hash. Null for users who only ever sign in through OAuth — that path
  // doesn't exist yet (credentials-only for now) but the column shouldn't have
  // to change when it lands.
  passwordHash: text('password_hash'),
  name: text('name'),
  // Auth.js-shaped columns so adding @auth/drizzle-adapter later is additive
  // (it brings its own accounts/sessions tables) rather than a users rewrite.
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Indexed on lower(email), not email. A plain unique index would happily let
  // Foo@x.com and foo@x.com both exist and then let either one shadow the
  // other at login. Application code lowercases on signup too, but this is the
  // constraint that actually holds the line.
  emailUnique: uniqueIndex('users_email_unique').on(sql`lower(${t.email})`),
}))

// One row per (user, module) that has been explicitly granted or revoked.
// Absence of a row means "use the default" — which in local dev is granted.
// This is what billing writes to in Phase 6.
export const entitlements = pgTable('entitlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  moduleId: text('module_id').$type<ModuleId>().notNull(),
  enabled: boolean('enabled').notNull().default(true),
  // Set when a license has a term; null = perpetual.
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userModuleUnique: uniqueIndex('entitlements_user_module_unique').on(t.userId, t.moduleId),
}))

// ─── Password reset (T-435, D123, migration 0008) ────────────────────────────
// Two tables of their own, and no new column on `users`, on purpose: every existing
// `select().from(users)` would otherwise name a column a database without migration 0008
// does not have, and sign-in itself would break until `npm run db:migrate` ran. A missing
// table here only means "no reset flag yet". Rows go only with their user (CASCADE); a
// spent token is marked, never removed.

/** Owner-issued, single-use reset links. Only the SHA-256 of a token is stored. */
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  issuedBy: text('issued_by').notNull().default('owner-command'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
}, (t) => ({
  tokenHashUnique: uniqueIndex('password_reset_tokens_hash_unique').on(t.tokenHash),
  byUser: index('password_reset_tokens_user_idx').on(t.userId),
}))

/** One row per user whose password state has ever been touched; absence means "nothing forced". */
export const passwordStates = pgTable('password_states', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  /** Sign-in is refused until the password is reset (the owner forced it, e.g. after a breach). */
  mustReset: boolean('must_reset').notNull().default(false),
  mustResetSince: timestamp('must_reset_since', { withTimezone: true }),
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Consent to email notices (T-436, D124, D127, migration 0009) ────────────
// A table of its own, for the reason password_states is one (above): a column on `users`
// would break every select().from(users), sign-in included, on a database without 0009.
// One row per agreement, holding the exact words agreed to (lib/legal/signupConsent.ts).
// A withdrawal is marked, never removed; rows go only with their user (CASCADE).

export const communicationConsents = pgTable('communication_consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** SIGNUP_CONSENT.version when it was given: a short hash of `wording`. */
  wordingVersion: text('wording_version').notNull(),
  /** The box's label and the Terms clause it points to, as shown. */
  wording: text('wording').notNull(),
  /** Where it was given. Only 'sign-up' so far. */
  givenVia: text('given_via').notNull().default('sign-up'),
  agreedAt: timestamp('agreed_at', { withTimezone: true }).notNull().defaultNow(),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
}, (t) => ({
  byUser: index('communication_consents_user_idx').on(t.userId),
}))

// ─── Two-factor sign-in (T-088, D233, migration 0012) ────────────────────────
// Tables of their own, for the reason password_states is one (above): a column on `users`
// would break sign-in on a database without 0012. A missing table reads as "not enrolled",
// never a lockout (lib/auth/twoFactorStore.ts). The TOTP secret is stored as written —
// verifying a code needs it back, so it cannot be hashed, and sealing it under
// FN_SECRETS_KEY would turn a mislaid key into every enrolled account locked out — and
// "Download my data" strips it with the password hash (lib/data/userExport.ts). Recovery
// codes are stored only as SHA-256. Rows go with their user (CASCADE); turning two-factor
// off removes them, because a revoked shared secret kept around is a live credential, not
// a record (D233 — the no-deletion standing rule is about project files and branches).

/** One enrollment per user; confirmed_at null is a begun, unconfirmed one that gates nothing. */
export const twoFactorSecrets = pgTable('two_factor_secrets', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  /** TOTP secret, base32 (lib/auth/totp.ts). */
  secret: text('secret').notNull(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  /** The last TOTP time step that signed someone in, so that exact code cannot be replayed. */
  lastUsedStep: bigint('last_used_step', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Single-use sign-in codes for a lost phone. Only each code's SHA-256 is stored; spent ones are marked. */
export const twoFactorRecoveryCodes = pgTable('two_factor_recovery_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  usedAt: timestamp('used_at', { withTimezone: true }),
}, (t) => ({
  userCodeUnique: uniqueIndex('two_factor_recovery_codes_user_hash_unique').on(t.userId, t.codeHash),
  byUser: index('two_factor_recovery_codes_user_idx').on(t.userId),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Entitlement = typeof entitlements.$inferSelect
