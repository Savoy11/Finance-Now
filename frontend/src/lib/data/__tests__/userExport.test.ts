import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  EXCLUDED_TABLES, LEFT_OUT, buildUserExport, csvField, exportFileName, holdingsCsv, tradesCsv,
  type CollectedExport,
} from '../userExport'
import { collectUserExport, tablesWithUserId, userExportTables } from '@/lib/server/userExportCollect'
import { defaultExportFolder, parseExportCommand } from '../../../../scripts/lib/exportCommand'

const NOW = new Date('2026-11-06T12:00:00Z')
const UID = '11111111-1111-1111-1111-111111111111'

const sample = (): CollectedExport => ({
  account: { id: UID, email: 'me@example.com', password_hash: '$2b$10$secret', name: null, created_at: new Date('2026-10-01T00:00:00Z') },
  tables: {
    portfolios: [
      { id: 'p-what', user_id: UID, name: 'What-if mix' },
      { id: 'p-real', user_id: UID, name: 'Real account' },
    ],
    holdings: [
      { id: 'h1', user_id: UID, portfolio_id: 'p-what', instrument_id: 'i-voo', target_alloc_pct: '60.0000', avg_cost_basis: null, quantity: null },
      { id: 'h2', user_id: UID, portfolio_id: 'p-what', instrument_id: 'i-bnd', target_alloc_pct: '40.0000', avg_cost_basis: '72.10', quantity: null },
    ],
    trade_transactions: [
      { id: 't2', user_id: UID, portfolio_id: 'p-real', instrument_id: 'i-voo', side: 'sell', quantity: '1', price_per_unit: '600', fee_usd: '0', executed_at: new Date('2026-10-20T00:00:00Z'), opening: false, note: '=HYPERLINK("x")', created_at: new Date('2026-10-20T01:00:00Z') },
      { id: 't1', user_id: UID, portfolio_id: 'p-real', instrument_id: 'i-voo', side: 'buy', quantity: '10', price_per_unit: '590', fee_usd: '1.50', executed_at: new Date('2026-10-01T00:00:00Z'), opening: true, note: 'first, "big" buy', created_at: new Date('2026-10-01T01:00:00Z') },
      { id: 't3', user_id: UID, portfolio_id: 'p-real', instrument_id: 'i-voo', side: 'split', quantity: '0', price_per_unit: '0', fee_usd: '0', executed_at: new Date('2026-10-25T00:00:00Z'), opening: false, note: null, created_at: new Date('2026-10-25T01:00:00Z') },
      { id: 't4', user_id: UID, portfolio_id: 'p-real', instrument_id: 'i-voo', side: 'income', quantity: '0', price_per_unit: '0', fee_usd: '0', executed_at: new Date('2026-10-30T00:00:00Z'), opening: false, note: null, created_at: new Date('2026-10-30T01:00:00Z') },
    ],
    trade_income: [{ trade_id: 't4', user_id: UID, amount_usd: '4.12', kind: 'dividend' }],
    trade_cancellations: [{ trade_id: 't2', user_id: UID, reason: 'typed the wrong price' }],
    trade_splits: [{ trade_id: 't3', user_id: UID, units_after: 2, units_before: 1, cash_in_lieu_usd: null }],
    password_reset_tokens: [{ id: 'r1', user_id: UID, token_hash: 'abc' }],
    user_wallets: [{ id: 'w1', user_id: UID, address: '0xabc', some_token_hash: 'zzz' }],
  },
  notSetUp: [],
  instruments: [
    { id: 'i-voo', symbol: 'VOO', name: 'Vanguard S&P 500 ETF', user_id: null },
    { id: 'i-bnd', symbol: 'BND', name: 'Vanguard Total Bond Market ETF', user_id: null },
  ],
})

describe('buildUserExport (T-452)', () => {
  const doc = buildUserExport(sample(), NOW)

  it('never carries the password hash or a reset link', () => {
    // Two guards: OMITTED_COLUMNS names the hash, and any *_password_hash / *_token_hash column
    // goes too (some_token_hash below). Mutation: drop the second guard and this fails.
    expect(doc.account).not.toHaveProperty('password_hash')
    expect(JSON.stringify(doc)).not.toContain('$2b$10$secret')
    expect(doc.data).not.toHaveProperty('password_reset_tokens')
    expect(doc.data.user_wallets[0]).not.toHaveProperty('some_token_hash')
    expect(doc.account).toMatchObject({ email: 'me@example.com' })
  })

  it('says what it leaves out and what lives only in the browser', () => {
    expect(doc.leftOut).toEqual(LEFT_OUT)
    expect(doc.leftOut.map((l) => l.what)).toEqual(['Your password', 'Password reset links'])
    expect(doc.onThisDevice).toMatch(/only in your browser/)
  })

  it('keeps every other table and row as stored, and dates the file', () => {
    expect(Object.keys(doc.data)).toEqual(['holdings', 'portfolios', 'trade_cancellations', 'trade_income', 'trade_splits', 'trade_transactions', 'user_wallets'])
    expect(doc.data.trade_transactions).toHaveLength(4)
    expect(doc.exportedAt).toBe('2026-11-06T12:00:00.000Z')
    expect(doc).not.toHaveProperty('notSetUp')
  })

  it('names the tables a database has not set up yet', () => {
    expect(buildUserExport({ ...sample(), notSetUp: ['trade_splits'] }, NOW).notSetUp).toEqual(['trade_splits'])
  })
})

describe('the spreadsheets', () => {
  it('lists trades in date order with ticker, portfolio, cancellation and split filled in', () => {
    const lines = tradesCsv(sample()).trimEnd().split('\r\n')
    expect(lines[0]).toBe('portfolio,date,symbol,name,side,starting_position,quantity,price_per_unit_usd,fee_usd,split_units_after,split_units_before,cash_in_lieu_usd,income_usd,income_kind,cancelled,cancel_reason,note,recorded_at')
    expect(lines[1]).toBe('Real account,2026-10-01T00:00:00.000Z,VOO,Vanguard S&P 500 ETF,buy,yes,10,590,1.50,,,,,,no,,"first, ""big"" buy",2026-10-01T01:00:00.000Z')
    expect(lines[2]).toContain(',sell,no,1,600,0,,,,,,yes,typed the wrong price,')
    expect(lines[3]).toContain(',split,no,0,0,0,2,1,,,,no,')
    // T-451: cash income carries its amount and kind.
    expect(lines[4]).toContain(',income,no,0,0,0,,,,4.12,dividend,no,')
  })

  it('opens a typed formula as text, not as a formula', () => {
    // Mutation: drop the apostrophe rule in csvField and this fails.
    expect(tradesCsv(sample())).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csvField('=1+1')).toBe("'=1+1")
    expect(csvField('@cmd')).toBe("'@cmd")
    expect(csvField('-12.50')).toBe('-12.50')
    expect(csvField(null)).toBe('')
  })

  it('lists what-if holdings with their target and entry price', () => {
    expect(holdingsCsv(sample()).trimEnd().split('\r\n')).toEqual([
      'portfolio,symbol,name,target_allocation_pct,entry_price_usd,quantity',
      'What-if mix,BND,Vanguard Total Bond Market ETF,40.0000,72.10,',
      'What-if mix,VOO,Vanguard S&P 500 ETF,60.0000,,',
    ])
  })

  it('names the files by day', () => {
    expect(exportFileName('json', NOW)).toBe('finance-now-data-2026-11-06.json')
    expect(exportFileName('trades', NOW)).toBe('finance-now-trades-2026-11-06.csv')
  })
})

describe('which tables are read', () => {
  it('reads every table with a user_id column except the ones named with a reason', () => {
    // The list is found from the schema, so a new table is exported without being listed.
    const all = tablesWithUserId()
    for (const t of ['portfolios', 'holdings', 'tracked_portfolios', 'trade_transactions', 'trade_cancellations',
      'trade_splits', 'trade_income', 'trade_imports', 'trade_import_rows', 'trade_import_layouts',
      'watchlists', 'watchlist_items', 'builder_plans', 'builder_plan_snapshots', 'user_wallets',
      'communication_consents', 'password_states', 'entitlements', 'instruments', 'finance_transactions', 'goals']) {
      expect(all, t).toContain(t)
    }
    expect(userExportTables()).not.toContain('password_reset_tokens')
    expect(userExportTables()).toEqual(all.filter((t) => !(t in EXCLUDED_TABLES)))
  })

  it('excludes only tables that exist, each with a reason', () => {
    for (const [t, why] of Object.entries(EXCLUDED_TABLES)) {
      expect(tablesWithUserId(), t).toContain(t)
      expect(why.length).toBeGreaterThan(20)
    }
  })
})

describe('collectUserExport', () => {
  it('reads the account, every table and the instruments the rows point at', async () => {
    const calls: string[] = []
    const c = await collectUserExport(async (table, column, value) => {
      calls.push(`${table}.${column}=${value}`)
      if (table === 'users') return [{ id: value, email: 'me@example.com' }]
      if (table === 'holdings') return [{ id: 'h1', instrument_id: 'i-voo' }]
      if (table === 'instruments' && column === 'id') return [{ id: value, symbol: 'VOO' }]
      return []
    }, UID)
    expect(calls[0]).toBe(`users.id=${UID}`)
    expect(calls).toContain(`holdings.user_id=${UID}`)
    expect(calls).toContain('instruments.id=i-voo')
    expect(calls.some((x) => x.startsWith('password_reset_tokens'))).toBe(false)
    expect(c.instruments).toEqual([{ id: 'i-voo', symbol: 'VOO' }])
    expect(c.account).toMatchObject({ email: 'me@example.com' })
  })

  it('names a table a migration has not created, and stops on any other error', async () => {
    const missing = Object.assign(new Error('relation does not exist'), { code: '42P01' })
    const c = await collectUserExport(async (table) => { if (table === 'trade_splits') throw missing; return [] }, UID)
    expect(c.notSetUp).toEqual(['trade_splits'])
    await expect(collectUserExport(async () => { throw new Error('connection refused') }, UID)).rejects.toThrow('connection refused')
  })
})

describe('the route, the command and the button', () => {
  const route = readFileSync(join(__dirname, '../../../app/api/user/export/route.ts'), 'utf8')

  it('exports the signed-in account only: nothing in the request can name another', () => {
    // Mutation: read ?user= or ?email= and this fails.
    expect(route).toMatch(/getCurrentUserId\(\)/)
    expect(route).not.toMatch(/searchParams\.get\('(user|email|userId|id|account)'\)/)
    expect(route).toMatch(/'Cache-Control': 'no-store'/)
  })

  it('is on the Settings page', () => {
    const settings = readFileSync(join(__dirname, '../../../app/(dashboard)/settings/page.tsx'), 'utf8')
    expect(settings).toMatch(/<YourDataPanel \/>/)
  })

  it('has an owner command whose output is never committed', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../../../package.json'), 'utf8')) as { scripts: Record<string, string> }
    expect(pkg.scripts['user:export']).toBe('tsx scripts/user-export.ts')
    expect(readFileSync(join(__dirname, '../../../../.gitignore'), 'utf8')).toMatch(/^user-export-\*\/$/m)
    expect(defaultExportFolder(NOW)).toBe('user-export-2026-11-06')
  })

  it('reads its arguments strictly', () => {
    expect(parseExportCommand(['--user', 'Me@Example.com'])).toEqual({ email: 'me@example.com', out: null })
    expect(parseExportCommand(['--user', 'me@example.com', '--out', 'C:\\out'])).toEqual({ email: 'me@example.com', out: 'C:\\out' })
    expect(parseExportCommand([])).toHaveProperty('error')
    expect(parseExportCommand(['--user'])).toHaveProperty('error')
    expect(parseExportCommand(['--user', 'me@example.com', '--delete'])).toHaveProperty('error')
  })
})
