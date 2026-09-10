// Read expense ratios straight from a fund's own PROSPECTUS, for the funds the
// structured datasets cannot reach.
//
//   node scripts/probe-fund-prospectus-fees.mjs                 # the unreachable set
//   node scripts/probe-fund-prospectus-fees.mjs --symbols GLD,SLV
//   node scripts/probe-fund-prospectus-fees.mjs --json
//
// WHY THIS EXISTS.
// `build-fund-fees.mjs` reconciles against the SEC's quarterly Risk/Return Summary
// dataset, which covers '40-Act funds that file a structured fee table. 37 of the
// 126 catalog entries are absent from it — SPY, GLD, SLV, USO, the CurrencyShares
// trusts, IBIT — because they are UITs, grantor trusts or commodity pools, which
// file differently.
//
// For months that absence was recorded as "no primary source in hand", and USO's
// expense ratio sat wrong at 0.81 on the strength of it. It was 0.86, stated
// plainly in USO's own 424B3, one request away (see the USO note in
// fundCatalog.ts). Absent from the dataset we habitually read is NOT the same as
// unobtainable, and this script exists so that conflation cannot happen again.
//
// IT REPORTS, NEVER WRITES — same split as build-fund-fees.mjs and
// apply-fee-updates.ts. An automated fee overwrite is how a correct number lands
// on the wrong fund, and share classes and near-identical trust names make that
// easy. It also never touches FUND_DATA_LAST_VERIFIED: that date asserts the
// whole table was compiled on one day, and only a human who reviewed every row
// can move it.
//
// ⚠ IT DOES NOT DECIDE. Different structures name the same quantity differently:
// a '40-Act ETF states "Total Annual Fund Operating Expenses", a grantor trust
// states a "Sponsor's Fee", a commodity pool itemises management plus other
// expenses. The script reports WHICH label it matched alongside the number, so a
// reader can see what they are agreeing to. Where several plausible labels match,
// it prints them all and marks the row ambiguous rather than picking.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const symbolArg = (() => {
  const i = args.indexOf('--symbols')
  return i >= 0 && args[i + 1] ? args[i + 1].split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : null
})()

// EDGAR requires a descriptive UA identifying the requester, and asks for no more
// than 10 requests/second. This stays well under it — a fee probe is not urgent
// and being throttled mid-run produces a half-answer that reads like missing data.
const UA = { 'User-Agent': 'Finance Now research dashboard (marcusowens94@gmail.com)' }
const REQUEST_GAP_MS = 250

const log = (...a) => { if (!asJson) console.log(...a) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let lastRequestAt = 0
async function politeFetch(url, init = {}) {
  const wait = REQUEST_GAP_MS - (Date.now() - lastRequestAt)
  if (wait > 0) await sleep(wait)
  lastRequestAt = Date.now()
  return fetch(url, { ...init, headers: { ...UA, ...(init.headers ?? {}) } })
}

/**
 * Fee labels, most specific first.
 *
 * Order matters: a prospectus that states BOTH a total and its components should
 * report the total, not the first component encountered. Each carries the
 * structure it belongs to, so an unexpected pairing (a grantor trust reporting a
 * 12b-1 fee) is visible rather than silently normalised away.
 */
const FEE_LABELS = [
  { label: 'Total Annual Fund Operating Expenses', re: /Total\s+Annual\s+(?:Fund\s+)?(?:Operating\s+)?Expenses[^0-9%]{0,120}?([0-9]+\.[0-9]{1,2})\s*%/i, structure: "'40-Act fund" },
  { label: 'Total Expenses', re: /Total\s+Expenses[^0-9%]{0,120}?([0-9]+\.[0-9]{1,2})\s*%/i, structure: 'various' },
  { label: "Sponsor's Fee", re: /Sponsor.{0,3}s\s+Fee[^0-9%]{0,120}?([0-9]+\.[0-9]{1,2})\s*%/i, structure: 'grantor trust' },
  { label: 'Trustee Fee', re: /Trustee.{0,3}s?\s+Fee[^0-9%]{0,120}?([0-9]+\.[0-9]{1,2})\s*%/i, structure: 'grantor trust' },
  { label: 'Management Fee', re: /Management\s+Fees?[^0-9%]{0,120}?([0-9]+\.[0-9]{1,2})\s*%/i, structure: 'commodity pool' },
]

/**
 * Labels that state a fund's WHOLE cost rather than one line of it.
 *
 * This distinction is what keeps the ambiguity flag meaningful. A prospectus
 * that states a 0.86% total and a 0.45% management fee is not ambiguous — it is
 * a normal fee table, and the total is the answer. Flagging that pairing would
 * fire on essentially every well-formed filing, and a warning that always fires
 * is one nobody reads.
 *
 * Ambiguity is reserved for the case that genuinely needs a human: NO total
 * stated, and two or more component labels disagreeing about the number.
 */
const TOTAL_LABELS = new Set(['Total Annual Fund Operating Expenses', 'Total Expenses'])

/** Prospectus-ish forms, newest first. 10-K is the fallback for trusts that
 *  restate the fee in their annual report rather than re-filing a prospectus. */
const FORMS = [/^424B/, /^485BPOS/, /^S-1/, /^10-K$/]

async function tickerToCik() {
  const res = await politeFetch('https://www.sec.gov/files/company_tickers.json')
  if (!res.ok) throw new Error(`company_tickers.json: HTTP ${res.status}`)
  const payload = await res.json()
  const map = new Map()
  for (const row of Object.values(payload)) {
    map.set(String(row.ticker).toUpperCase(), String(row.cik_str).padStart(10, '0'))
  }
  return map
}

async function latestFiling(cik) {
  const res = await politeFetch(`https://data.sec.gov/submissions/CIK${cik}.json`)
  if (!res.ok) throw new Error(`submissions: HTTP ${res.status}`)
  const d = await res.json()
  const f = d.filings?.recent
  if (!f) return null
  for (const formRe of FORMS) {
    for (let i = 0; i < f.form.length; i++) {
      if (!formRe.test(f.form[i])) continue
      const acc = f.accessionNumber[i].replace(/-/g, '')
      const doc = f.primaryDocument[i]
      if (!doc) continue
      return {
        form: f.form[i],
        filed: f.filingDate[i],
        accession: f.accessionNumber[i],
        url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${doc}`,
        registrant: d.name,
      }
    }
  }
  return null
}

function extractFees(html) {
  // ⚠ DECODE NUMERIC ENTITIES FIRST, before any digit-sensitive matching.
  //
  // Filers separate a fee label from its value with `&#9;` (a tab), and that
  // entity CONTAINS A DIGIT — so the "no digits between label and value" guard
  // in FEE_LABELS cannot cross it. Left undecoded, USO matched
  // "Management Fee 0.45%" instead of "Total Annual Fund Operating Expenses
  // 0.86%": a wrong number reported with full confidence, for the one fund whose
  // right answer was already known.
  //
  // It was caught only because this script was smoke-tested against that known
  // answer before being trusted on 36 unknown ones. Keep that habit — a fee
  // extractor that is confidently wrong is worse than no extractor.
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
  const hits = []
  for (const { label, re, structure } of FEE_LABELS) {
    const m = re.exec(text)
    if (m) hits.push({ label, structure, pct: Number(m[1]) })
  }
  return hits
}

function catalogEntries() {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/data/fundCatalog.ts'), 'utf8')
  const block = /export const FUND_CATALOG[\s\S]*?\n\]/.exec(src)
  if (!block) throw new Error('FUND_CATALOG not found')
  const out = []
  for (const m of block[0].matchAll(/\{\s*symbol:\s*'([A-Z0-9.-]+)'[^}]*?expenseRatioPct:\s*([0-9.]+)/g)) {
    out.push({ symbol: m[1], catalogPct: Number(m[2]) })
  }
  return out
}

/** Symbols the Risk/Return dataset cannot reach — the ones this script is for. */
const UNREACHABLE = [
  'SPY', 'DIA', 'HACK', 'GLD', 'IAU', 'GLDM', 'SGOL', 'AAAU', 'BAR', 'OUNZ',
  'SLV', 'SIVR', 'PSLV', 'DBC', 'PPLT', 'PALL', 'USO', 'USL', 'BNO', 'UNG',
  'UNL', 'UGA', 'CPER', 'CORN', 'WEAT', 'SOYB', 'CANE', 'IBIT', 'ETHA',
  'FXE', 'FXB', 'FXY', 'FXF', 'FXC', 'FXA', 'UUP', 'UDN',
]

async function main() {
  const catalog = catalogEntries()
  const byCatalog = new Map(catalog.map((c) => [c.symbol, c.catalogPct]))
  const targets = symbolArg ?? UNREACHABLE

  log(`catalog: ${catalog.length} funds with an expense ratio`)
  log(`probing: ${targets.length} symbol(s) the Risk/Return dataset does not cover`)
  log('')

  let cikMap
  try {
    cikMap = await tickerToCik()
  } catch (err) {
    console.error(`\n✗ could not reach SEC (${err.message}).`)
    console.error('  This says nothing about the funds — re-run where sec.gov is reachable.')
    process.exit(2)
  }

  const rows = []
  for (const symbol of targets) {
    const catalogPct = byCatalog.get(symbol) ?? null
    const cik = cikMap.get(symbol)
    if (!cik) { rows.push({ symbol, catalogPct, status: 'no-cik' }); log(`  ${symbol.padEnd(6)} no CIK in company_tickers.json`); continue }

    let filing
    try { filing = await latestFiling(cik) } catch (err) { rows.push({ symbol, catalogPct, cik, status: 'submissions-error', detail: err.message }); log(`  ${symbol.padEnd(6)} submissions error: ${err.message}`); continue }
    if (!filing) { rows.push({ symbol, catalogPct, cik, status: 'no-prospectus' }); log(`  ${symbol.padEnd(6)} no prospectus-type filing found`); continue }

    let html
    try {
      const res = await politeFetch(filing.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      html = await res.text()
    } catch (err) {
      rows.push({ symbol, catalogPct, cik, filing, status: 'fetch-error', detail: err.message })
      log(`  ${symbol.padEnd(6)} could not fetch ${filing.form}: ${err.message}`)
      continue
    }

    const hits = extractFees(html)
    if (hits.length === 0) {
      rows.push({ symbol, catalogPct, cik, filing, status: 'no-fee-found' })
      log(`  ${symbol.padEnd(6)} ${filing.form} ${filing.filed} — no fee label matched`)
      continue
    }

    const best = hits[0]
    // A stated total settles it; its components are expected to differ from it.
    // Only competing COMPONENTS with no total need a human.
    const hasTotal = TOTAL_LABELS.has(best.label)
    const ambiguous = !hasTotal && new Set(hits.map((h) => h.pct)).size > 1
    const delta = catalogPct != null ? Number((best.pct - catalogPct).toFixed(4)) : null
    rows.push({ symbol, catalogPct, cik, filing, status: ambiguous ? 'ambiguous' : 'ok', hits, filedPct: best.pct, matchedLabel: best.label, delta })

    const flag = delta == null ? '' : Math.abs(delta) >= 0.005 ? `  ⚠ DIFFERS by ${delta > 0 ? '+' : ''}${delta}pp` : '  ✓ agrees'
    log(`  ${symbol.padEnd(6)} ${String(best.pct).padStart(5)}%  ${best.label.padEnd(38)} ${filing.form} ${filing.filed}${flag}${ambiguous ? '  [AMBIGUOUS — see all labels]' : ''}`)
    if (ambiguous) for (const h of hits) log(`         · ${h.label}: ${h.pct}%  (${h.structure})`)
  }

  const differing = rows.filter((r) => r.delta != null && Math.abs(r.delta) >= 0.005)
  const agreeing = rows.filter((r) => r.delta != null && Math.abs(r.delta) < 0.005)
  const unresolved = rows.filter((r) => r.status !== 'ok' && r.status !== 'ambiguous')

  if (asJson) {
    console.log(JSON.stringify({ probedAt: new Date().toISOString(), rows }, null, 2))
    return
  }

  log('')
  log(`══ ${differing.length} differ from the catalog ══`)
  for (const r of differing) log(`   ${r.symbol.padEnd(6)} catalog ${r.catalogPct}  →  filed ${r.filedPct}   (${r.matchedLabel}, ${r.filing.form} ${r.filing.filed})`)
  if (!differing.length) log('   none at or above 0.005pp')

  log('')
  log(`══ ${agreeing.length} confirmed unchanged ══`)
  log(`   ${agreeing.map((r) => r.symbol).join(', ') || '—'}`)

  if (unresolved.length) {
    log('')
    log(`══ ${unresolved.length} unresolved — NOT evidence of anything ══`)
    log('   A fund whose fee label this script does not recognise still has a fee.')
    log('   Open the filing and read it before concluding.')
    for (const r of unresolved) log(`   ${r.symbol.padEnd(6)} ${r.status}${r.filing ? `  ${r.filing.form} ${r.filing.filed}  ${r.filing.url}` : ''}`)
  }

  log('')
  log('Nothing was changed. Read the filing each figure names, then edit fundCatalog.ts')
  log('by hand. FUND_DATA_LAST_VERIFIED is NOT moved by this script.')
}

main().catch((err) => { console.error(err); process.exit(1) })
