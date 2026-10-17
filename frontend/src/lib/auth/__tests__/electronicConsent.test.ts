import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  checkSignupConsent, consentPrompt, signupConsentRecord, consentStandings, mayEmailNotices,
  CONSENT_REQUIRED_MESSAGE, CONSENT_STALE_MESSAGE, type ConsentRow,
} from '../electronicConsent'
import { SIGNUP_CONSENT, SIGNUP_CONSENT_WORDING } from '@/lib/legal/signupConsent'
import { getTableColumns } from 'drizzle-orm'
import { DISCLOSURE_SOURCE, EMAIL_NOTICES_CLAUSE, PRIVACY_POLICY, TERMS_OF_USE } from '@/lib/legal/disclosures'
import { parseConsentCommand } from '../../../../scripts/lib/consentCommand'
import { communicationConsents } from '@/lib/db/schema'

// T-436 / D124, D127 (2026-10-17): creating an account requires agreeing to get notices by
// email, breach notices included, and the agreement is stored with the words agreed to.

const NOW = new Date('2026-10-17T12:00:00Z')
const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('the wording', () => {
  it('carries a version that is the hash of exactly these words', () => {
    // Change the label or the clause and this fails until the version moves with it, so a
    // stored agreement never points at words it was not given to.
    const hash = createHash('sha256').update(SIGNUP_CONSENT_WORDING, 'utf8').digest('hex').slice(0, 16)
    expect(SIGNUP_CONSENT.version).toBe(hash)
    expect(SIGNUP_CONSENT_WORDING).toBe(`${SIGNUP_CONSENT.label}\n\n${EMAIL_NOTICES_CLAUSE}`)
  })
  it('is the Terms of Use’s own section 6 paragraph, not a second copy', () => {
    const section6 = TERMS_OF_USE.sections.find((s) => s.heading.startsWith('6. '))
    expect(section6).toBeDefined()
    const texts = section6!.blocks.flatMap((b) => (b.kind === 'p' ? [b.text] : []))
    expect(texts).toContain(EMAIL_NOTICES_CLAUSE)
    expect(SIGNUP_CONSENT.clause).toBe(EMAIL_NOTICES_CLAUSE)
    expect(SIGNUP_CONSENT.termsHref).toBe(`${TERMS_OF_USE.path}#${section6!.id}`)
    expect(SIGNUP_CONSENT.label).toMatch(/section 6 of the Terms of Use/)
  })
  it('was copied from the owner’s document at the revision the set records', () => {
    expect(SIGNUP_CONSENT.source.document).toBe(DISCLOSURE_SOURCE.document)
    expect(SIGNUP_CONSENT.source.clause.revision).toBe(DISCLOSURE_SOURCE.revisions[SIGNUP_CONSENT.source.clause.tab])
    expect(DISCLOSURE_SOURCE.recopied['Terms of Use'].on).toBe(SIGNUP_CONSENT.source.copiedOn)
    expect(read('../../legal/disclosures.ts')).toMatch(/Terms of Use \(draft tab rev 6\)/)
  })
  it('names a breach notice outright, since that is what the agreement is for', () => {
    expect(SIGNUP_CONSENT.label).toMatch(/data breach/)
    expect(EMAIL_NOTICES_CLAUSE).toMatch(/security breach/)
    // The E-SIGN disclosures the draft carries for counsel: scope, paper copies, withdrawal and
    // its consequence, and what is needed to receive email.
    for (const term of [/every notice the law requires/, /paper copy/, /withdraw/, /close your account/, /device that can open email/]) {
      expect(EMAIL_NOTICES_CLAUSE).toMatch(term)
    }
  })
  it('stays importable in the browser: plain strings, no crypto', () => {
    expect(read('../../legal/signupConsent.ts')).not.toMatch(/from 'node:/)
  })
})

describe('the rule', () => {
  it('accepts a ticked box for the current wording', () => {
    expect(checkSignupConsent(true, SIGNUP_CONSENT.version)).toEqual({ ok: true })
  })
  it('refuses anything but the boolean true', () => {
    for (const bad of [undefined, null, false, 'true', 1, 'yes', {}]) {
      expect(checkSignupConsent(bad, SIGNUP_CONSENT.version)).toEqual({ ok: false, status: 400, message: CONSENT_REQUIRED_MESSAGE })
    }
  })
  it('refuses an agreement to wording other than the current one', () => {
    for (const bad of [undefined, '', '0000000000000000', SIGNUP_CONSENT.version.toUpperCase()]) {
      expect(checkSignupConsent(true, bad)).toEqual({ ok: false, status: 400, message: CONSENT_STALE_MESSAGE })
    }
  })
  it('shows a refused sign-up what it is being asked to agree to', () => {
    expect(consentPrompt()).toEqual({ label: SIGNUP_CONSENT.label, version: SIGNUP_CONSENT.version, terms: SIGNUP_CONSENT.termsHref })
  })
  it('stores the words themselves, not only a pointer to them', () => {
    expect(signupConsentRecord('u1', NOW)).toEqual({
      userId: 'u1', wordingVersion: SIGNUP_CONSENT.version, wording: SIGNUP_CONSENT_WORDING, givenVia: 'sign-up', agreedAt: NOW,
    })
  })
})

describe('who may be sent notices by email', () => {
  const at = (iso: string) => new Date(iso)
  const row = (email: string, agreedAt: string | null, withdrawnAt: string | null = null): ConsentRow => ({
    email, agreedAt: agreedAt ? at(agreedAt) : null, withdrawnAt: withdrawnAt ? at(withdrawnAt) : null,
    wordingVersion: agreedAt ? SIGNUP_CONSENT.version : null,
  })

  it('an account that agreed, one that withdrew and one with no agreement', () => {
    const s = consentStandings([
      row('c@x.com', null),
      row('a@x.com', '2026-10-17T00:00:00Z'),
      row('b@x.com', '2026-10-17T00:00:00Z', '2026-10-18T00:00:00Z'),
    ])
    expect(s.map((x) => [x.email, x.state])).toEqual([['a@x.com', 'agreed'], ['b@x.com', 'withdrawn'], ['c@x.com', 'none']])
    expect(s.map(mayEmailNotices)).toEqual([true, false, false])
  })
  it('an agreement given again after a withdrawal counts', () => {
    const [s] = consentStandings([
      row('a@x.com', '2026-10-17T00:00:00Z', '2026-10-18T00:00:00Z'),
      row('a@x.com', '2026-10-19T00:00:00Z'),
    ])
    expect(s).toMatchObject({ state: 'agreed', since: at('2026-10-19T00:00:00Z') })
  })
  it('a withdrawal reports its latest date', () => {
    const [s] = consentStandings([
      row('a@x.com', '2026-10-17T00:00:00Z', '2026-10-18T00:00:00Z'),
      row('a@x.com', '2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z'),
    ])
    expect(s).toEqual({ email: 'a@x.com', state: 'withdrawn', since: at('2026-10-20T00:00:00Z') })
  })
})

describe('npm run auth:consent', () => {
  it('parses each mode', () => {
    expect(parseConsentCommand(['--status'])).toEqual({ kind: 'status' })
    expect(parseConsentCommand(['--withdraw', '--user', ' A@X.com '])).toEqual({ kind: 'withdraw', email: 'a@x.com' })
    expect(parseConsentCommand(['--user', 'a@x.com', '--withdraw'])).toEqual({ kind: 'withdraw', email: 'a@x.com' })
  })
  it('refuses what it cannot mean', () => {
    for (const argv of [[], ['--withdraw'], ['--withdraw', '--user'], ['--withdraw', '--user', 'nobody'],
      ['--status', '--withdraw'], ['--status', '--user', 'a@x.com'], ['--delete'], ['--user', 'a@x.com']]) {
      expect(parseConsentCommand(argv)).toHaveProperty('error')
    }
  })
  it('marks a withdrawal and deletes nothing', () => {
    const script = read('../../../../scripts/auth-consent.ts')
    expect(script).toMatch(/update communication_consents set withdrawn_at/)
    expect(script).not.toMatch(/\bdelete\s+from\b/i)
  })
})

describe('the Privacy Policy', () => {
  it('names the record sign-up keeps, in section 2', () => {
    const section2 = PRIVACY_POLICY.sections.find((s) => s.heading.startsWith('2. '))
    const items = section2!.blocks.flatMap((b) => (b.kind === 'list' ? b.items : []))
    const item = items.find((i) => i.startsWith('**Your agreement to email notices:**'))
    expect(item).toBeDefined()
    for (const stored of [/the date you gave it/, /the exact wording/, /the date you withdraw it/]) expect(item).toMatch(stored)
    // Copied from the Privacy Policy tab at rev 17, rev 16 plus this item.
    expect(DISCLOSURE_SOURCE.revisions['Privacy Policy']).toBe(17)
    expect(DISCLOSURE_SOURCE.recopied['Privacy Policy'].on).toBe(SIGNUP_CONSENT.source.copiedOn)
    expect(read('../../legal/disclosures.ts')).toMatch(/Privacy Policy \(draft tab rev 17\)/)
  })
  it('is reviewed whenever the record gains a field', () => {
    // A new column is new personal data. If this list changes, read the section 2 item above
    // against it (and change the owner's document first) before updating the list.
    expect(Object.keys(getTableColumns(communicationConsents)).sort()).toEqual(
      ['agreedAt', 'givenVia', 'id', 'userId', 'withdrawnAt', 'wording', 'wordingVersion'],
    )
  })
})

describe('the table and its migration', () => {
  it('is a table of its own, holding the wording', () => {
    expect(Object.keys(communicationConsents)).toEqual(
      expect.arrayContaining(['userId', 'wordingVersion', 'wording', 'agreedAt', 'withdrawnAt']),
    )
  })
  it('0009 creates it, cascades with the user and changes no other table', () => {
    const sql = read('../../../../drizzle/0009_communication-consents.sql')
    expect(sql).toMatch(/CREATE TABLE "communication_consents"/)
    expect(sql).toMatch(/REFERENCES "public"\."users"\("id"\) ON DELETE cascade/)
    expect(sql).not.toMatch(/ALTER TABLE "(?!communication_consents")/)
    expect(sql).not.toMatch(/\bDROP\b/)
    expect(read('../../../../drizzle/meta/_journal.json')).toMatch(/"0009_communication-consents"/)
  })
})

// The route, against a stand-in database: what it writes, in what order, and when it writes nothing.
const dbMock = vi.hoisted(() => ({
  existing: [] as unknown[],
  failConsentInsert: null as unknown,
  calls: [] as string[],
  inserts: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
}))
vi.mock('@/lib/db', () => {
  const selectChain = {
    select: () => { dbMock.calls.push('select'); return selectChain },
    from: () => selectChain,
    where: () => selectChain,
    limit: () => Promise.resolve(dbMock.existing),
  }
  return {
    isDbConfigured: true,
    db: {
      select: selectChain.select,
      async transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
        dbMock.calls.push('transaction')
        const tx = {
          insert: (table: unknown) => ({
            values: (values: Record<string, unknown>) => {
              dbMock.inserts.push({ table, values })
              const isConsent = 'wordingVersion' in values
              const done = isConsent && dbMock.failConsentInsert ? Promise.reject(dbMock.failConsentInsert) : Promise.resolve(undefined)
              return Object.assign(done, { returning: () => Promise.resolve([{ id: 'u-new', email: values.email }]) })
            },
          }),
        }
        return fn(tx)
      },
    },
  }
})
vi.mock('bcryptjs', () => ({ default: { hash: async () => 'bcrypt-hash' } }))

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    dbMock.existing = []
    dbMock.failConsentInsert = null
    dbMock.calls = []
    dbMock.inserts = []
  })
  const post = async (body: Record<string, unknown>) => {
    const { POST } = await import('@/app/api/auth/signup/route')
    return POST(new Request('http://localhost/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }))
  }
  const valid = { email: 'New@Example.com', password: 'a-long-enough-password', electronicConsent: true, consentVersion: SIGNUP_CONSENT.version }

  it('refuses an unticked box before touching the database, and says what to agree to', async () => {
    const res = await post({ ...valid, electronicConsent: undefined })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe(CONSENT_REQUIRED_MESSAGE)
    expect(body.consent).toEqual(consentPrompt())
    expect(dbMock.calls).toEqual([])
  })
  it('refuses an agreement to old wording', async () => {
    const res = await post({ ...valid, consentVersion: 'an-older-version' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(CONSENT_STALE_MESSAGE)
    expect(dbMock.inserts).toEqual([])
  })
  it('writes the account and its agreement in one transaction', async () => {
    const res = await post(valid)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'u-new', email: 'new@example.com' })
    expect(dbMock.calls).toEqual(['select', 'transaction'])
    expect(dbMock.inserts).toHaveLength(2)
    expect(dbMock.inserts[0].values).toMatchObject({ email: 'new@example.com', passwordHash: 'bcrypt-hash' })
    expect(dbMock.inserts[1].table).toBe(communicationConsents)
    expect(dbMock.inserts[1].values).toMatchObject({ userId: 'u-new', wordingVersion: SIGNUP_CONSENT.version, wording: SIGNUP_CONSENT_WORDING })
  })
  it('answers 503 with the instruction, creating nothing, before migration 0009 runs', async () => {
    dbMock.failConsentInsert = Object.assign(new Error('relation "communication_consents" does not exist'), { code: '42P01' })
    const res = await post(valid)
    expect(res.status).toBe(503)
    const { error } = await res.json()
    expect(error).toMatch(/migration 0009/)
    expect(error).toMatch(/npm run db:migrate/)
    expect(error).toMatch(/No account was created/)
  })
  it('still refuses a taken email', async () => {
    dbMock.existing = [{ id: 'u-old' }]
    const res = await post(valid)
    expect(res.status).toBe(409)
    expect(dbMock.calls).toEqual(['select'])
  })
})

describe('the sign-up page, when it is built (T-132)', () => {
  it('shows this box and sends its version', () => {
    // No page exists yet: T-132 builds it with the sign-in wall (T-131, D84). The route above
    // already refuses a sign-up without the agreement, so a page cannot skip it; this holds the
    // page to showing the stored words rather than its own.
    const page = resolve(__dirname, '../../../app/(auth)/signup/page.tsx')
    if (!existsSync(page)) return
    const src = readFileSync(page, 'utf8')
    expect(src).toMatch(/SIGNUP_CONSENT/)
    expect(src).toMatch(/consentVersion/)
    expect(src).toMatch(/electronicConsent/)
  })
})
