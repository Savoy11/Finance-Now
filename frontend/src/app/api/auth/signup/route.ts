import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db, isDbConfigured } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { passwordProblem } from '@/lib/auth/passwordPolicy'

export const dynamic = 'force-dynamic'

// Account creation. Auth.js's credentials provider only verifies existing
// users; registration is the application's job. The password rule is shared with
// the reset (T-435), so the two cannot drift apart.

export async function POST(request: Request) {
  if (!isDbConfigured) {
    return NextResponse.json(
      { error: 'Database is not configured. See DATABASE_URL in frontend/.env.local.' },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 })
  }

  const { email: rawEmail, password, name } = (body ?? {}) as Record<string, unknown>
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
  }
  const problem = passwordProblem(password)
  if (problem || typeof password !== 'string') {
    return NextResponse.json({ error: problem ?? 'A password is required' }, { status: 400 })
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1)
  if (existing) {
    return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  try {
    const [created] = await db
      .insert(users)
      .values({ email, passwordHash, name: typeof name === 'string' && name.trim() ? name.trim() : null })
      .returning({ id: users.id, email: users.email })

    // No password, no hash, nothing but the identifiers.
    return NextResponse.json({ id: created.id, email: created.email }, { status: 201 })
  } catch (err) {
    // The lower(email) unique index is the real guard — the check above races.
    const message = err instanceof Error ? err.message : ''
    if (message.includes('users_email_unique')) {
      return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 })
    }
    throw err
  }
}
