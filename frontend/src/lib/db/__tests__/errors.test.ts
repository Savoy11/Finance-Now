import { describe, expect, it } from 'vitest'
import { DrizzleQueryError } from 'drizzle-orm/errors'
import { isMissingTableError } from '../errors'

/**
 * A table that is not there yet means a migration has not been applied. The
 * saved-checks route (T-065) says so in words instead of failing with a 500,
 * so this pins how the error is recognised, including Drizzle's wrapping.
 */
describe('isMissingTableError', () => {
  const missing = Object.assign(new Error('relation "builder_plan_snapshots" does not exist'), { code: '42P01' })

  it('recognises the driver’s own error', () => {
    expect(isMissingTableError(missing)).toBe(true)
  })

  it('recognises it wrapped by Drizzle, as a query actually throws it', () => {
    expect(isMissingTableError(new DrizzleQueryError('select 1', [], missing))).toBe(true)
  })

  it('leaves every other failure alone', () => {
    const otherCode = Object.assign(new Error('duplicate key'), { code: '23505' })
    for (const e of [otherCode, new DrizzleQueryError('select 1', [], otherCode), new Error('boom'), null, undefined, '42P01'])
      expect(isMissingTableError(e)).toBe(false)
  })
})
