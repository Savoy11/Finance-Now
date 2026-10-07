#!/usr/bin/env node
// Probe the keyless exchange withdrawal-fee endpoints behind
// /live-data/withdraw-fees — RUN THIS ON THE OWNER'S MACHINE.
//
// Availability is IP-dependent (exchanges block datacenter ranges, and every
// exchange domain is egress-blocked from the remote dev environment), so this
// script exists to produce the real verdict: does each endpoint answer
// keyless from a residential IP, and does the payload carry per-chain
// withdrawal fees we can parse?
//
// Usage:  npm run fee-probe        (tsx — the script imports the TS adapters)
//
// It prints, per source: HTTP status, row counts through the same parsers the
// route uses, and a couple of sample parsed rows to eyeball against the
// exchange's own withdrawal page. Since D66 (T-054) it also counts the rows that
// carried a deposit status, and warns when a source documented to report one
// parsed none: that is how a renamed field shows up.

import {
  WITHDRAW_FEE_SOURCES,
  buildFeeOverrideMap,
} from '../src/lib/server/withdrawFeeAdapters.ts'

// Single source of truth — shared with the overlay and the reconcile tool, so
// an endpoint change lands in one place.
const SOURCES = WITHDRAW_FEE_SOURCES.map(s => ({ id: s.exchangeId, url: s.url, parse: s.parse, reportsDeposits: s.reportsDeposits }))

const allRows = []
for (const s of SOURCES) {
  process.stdout.write(`\n── ${s.id} ─ ${s.url}\n`)
  try {
    const res = await fetch(s.url, { headers: { Accept: 'application/json' } })
    process.stdout.write(`   HTTP ${res.status}\n`)
    if (!res.ok) continue
    const json = await res.json()
    const rows = s.parse(json)
    allRows.push(...rows)
    process.stdout.write(`   parsed rows: ${rows.length}\n`)
    for (const r of rows.slice(0, 4)) {
      process.stdout.write(
        `   sample: ${r.coin.toUpperCase()} on ${r.network} → fee ${r.withdrawFee}` +
        (r.minWithdraw !== undefined ? `, min ${r.minWithdraw}` : '') +
        (r.withdrawEnabled === false ? ' (withdrawals disabled)' : '') +
        (r.depositEnabled === false ? ' (deposits disabled)' : '') + '\n'
      )
    }
    // Deposit status (D66). Counted, never sampled alone: the point is whether
    // the field arrives at all, and how many networks report closed.
    const withDeposit = rows.filter(r => r.depositEnabled !== undefined)
    const depositsClosed = withDeposit.filter(r => r.depositEnabled === false)
    if (s.reportsDeposits) {
      process.stdout.write(`   deposit status on ${withDeposit.length} of ${rows.length} rows (${depositsClosed.length} closed)\n`)
      if (rows.length > 0 && withDeposit.length === 0) {
        process.stdout.write('   ⚠ documented to report deposit status, but none parsed — the field may have been renamed; save the JSON and report it.\n')
      }
      for (const r of depositsClosed.slice(0, 3)) {
        process.stdout.write(`   deposits closed: ${r.coin.toUpperCase()} on ${r.network} — check it against the exchange's own status page\n`)
      }
    } else if (withDeposit.length > 0) {
      process.stdout.write(`   deposit status on ${withDeposit.length} rows, from a source not marked as reporting it — update reportsDeposits\n`)
    }
    if (rows.length === 0) {
      process.stdout.write('   ⚠ endpoint answered but nothing parsed — payload shape may have changed; save the JSON and report it.\n')
    }
  } catch (err) {
    process.stdout.write(`   FAILED: ${err?.message ?? err}\n`)
  }
}

const { applied, skipped, depositAvailabilityRows } = buildFeeOverrideMap(allRows)
process.stdout.write(
  `\n── overlay summary ──\n` +
  `   ${allRows.length} live rows parsed; ${applied} match routes in the static table (will overlay), ` +
  `${skipped} have no matching curated route (dropped — overlay never adds routes).\n` +
  `   ${depositAvailabilityRows.length} of the matching routes carry a live deposit status.\n\n` +
  `Verdict guide: a source is USABLE if HTTP 200 with parsed rows > 0.\n` +
  `Spot-check 2–3 sample fees against the exchange's withdrawal page before trusting the overlay.\n`
)
