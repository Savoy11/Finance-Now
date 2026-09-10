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
  // ⚠ Allow a qualifier between "Sponsor's" and "fee". Trusts write
  //   "the Sponsor's ANNUAL fee of 0.10%" and "an annual fee EQUAL TO 0.10%" at
  //   least as often as the bare "Sponsor's Fee" of a fee table. Requiring
  //   adjacency left GLDM, SGOL, AAAU, BAR, SIVR and PALL unresolved on the
  //   2026-09-10 run — six funds reported as "no fee label matched" whose fee was
  //   stated in plain English a few words further along.
  { label: "Sponsor's Fee", re: /Sponsor.{0,3}s?\s+(?:\w+\s+){0,2}fees?\b[^0-9%]{0,120}?([0-9]+\.[0-9]{1,2})\s*%/i, structure: 'grantor trust' },
  { label: 'Trustee Fee', re: /Trustee.{0,3}s?\s+(?:\w+\s+){0,2}fees?\b[^0-9%]{0,120}?([0-9]+\.[0-9]{1,2})\s*%/i, structure: 'grantor trust' },
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

/**
 * The substantive document in a filing, when `primaryDocument` is not it.
 *
 * ⚠ EDGAR's `primaryDocument` is frequently a 1-2 KB cover page or supplement,
 * not the prospectus. On the 2026-09-10 run that alone accounted for most of the
 * "no fee label matched" rows — SGOL returned 1,192 bytes, IBIT 1,464, CORN 5,165,
 * none containing a single percentage. Reporting those as "fee not found" blamed
 * the extractor for fetching the wrong file.
 *
 * So a thin primary falls back to the accession's own index and takes the largest
 * HTML document, which is the prospectus in every case checked. Returns null
 * rather than guessing when the index cannot be read.
 */
async function largestDocInAccession(cik, accNoDashes) {
  const url = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accNoDashes}/index.json`
  const res = await politeFetch(url)
  if (!res.ok) return null
  const items = (await res.json())?.directory?.item ?? []
  const html = items
    .filter((i) => /\.html?$/i.test(i.name) && !/^0*\d+\.htm/i.test(i.name))
    .map((i) => ({ name: i.name, size: Number(i.size) || 0 }))
    .sort((a, b) => b.size - a.size)
  if (!html.length) return null
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accNoDashes}/${html[0].name}`
}

/** Below this, a "prospectus" is a cover page and the real document is elsewhere. */
const THIN_DOC_BYTES = 20_000

/** How much of a filing counts as its cover page — where a prospectus names its
 *  subject. Wide enough for a title page and its preamble, narrow enough to
 *  exclude a related-series aside (CPER's only mention in USCI's prospectus is at
 *  character 13,423). */
const COVER_PAGE_CHARS = 3_000

/**
 * Candidate filings, newest first — NOT just the newest.
 *
 * ⚠ The most recent 424B3 is very often a SUPPLEMENT that incorporates the base
 * prospectus by reference, and states no fee at all. SGOL's newest is 4,465 bytes
 * and its whole accession holds nothing larger; the fee is in an earlier filing,
 * not another file in the same one. Looking only at the newest filing reported
 * six funds as "fee not found" when the fee was published, just not there.
 *
 * So the caller walks back through candidates until one actually states a fee.
 * Capped, because each candidate costs requests and a fund whose last few
 * filings are all supplements needs a human rather than more fetching.
 */
const MAX_FILING_CANDIDATES = 4

async function candidateFilings(cik) {
  const res = await politeFetch(`https://data.sec.gov/submissions/CIK${cik}.json`)
  if (!res.ok) throw new Error(`submissions: HTTP ${res.status}`)
  const d = await res.json()
  const f = d.filings?.recent
  if (!f) return []
  const out = []
  for (const formRe of FORMS) {
    for (let i = 0; i < f.form.length && out.length < MAX_FILING_CANDIDATES; i++) {
      if (!formRe.test(f.form[i])) continue
      const acc = f.accessionNumber[i].replace(/-/g, '')
      const doc = f.primaryDocument[i]
      if (!doc) continue
      out.push({
        form: f.form[i],
        filed: f.filingDate[i],
        accession: f.accessionNumber[i],
        url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${doc}`,
        accDir: acc,
        cik,
        registrant: d.name,
      })
    }
    if (out.length >= MAX_FILING_CANDIDATES) break
  }
  return out
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
        accDir: acc,
        cik,
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

  // ⚠ GROSS vs NET. A sponsor may charge a contractual rate and voluntarily waive
  //   part of it, and the number a holder actually pays is the reduced one.
  //   SIVR states a 0.45% Sponsor's Fee and a waiver reducing it to 0.30%; the
  //   catalog's 0.30 is right, and reporting 0.45 as a DIFFERENCE argued for
  //   making the app wrong. Waivers are also revocable, so neither figure alone
  //   tells the whole story — both are surfaced and the row is marked, rather
  //   than one being chosen here.
  const waiver = /waive[sd]?|waiver/i.test(text)
    ? /reduce[sd]?\s+the\s+[^.]{0,60}?fee\s+to\s+([0-9]+\.[0-9]{1,2})\s*%/i.exec(text)
      ?? /waiv[^.]{0,80}?to\s+([0-9]+\.[0-9]{1,2})\s*%/i.exec(text)
    : null

  return { hits, waivedTo: waiver ? Number(waiver[1]) : null }
}

function catalogEntries() {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/data/fundCatalog.ts'), 'utf8')
  const block = /export const FUND_CATALOG[\s\S]*?\n\]/.exec(src)
  if (!block) throw new Error('FUND_CATALOG not found')
  const out = []
  // Name as well as symbol: the cover-page check needs it, because many
  // prospectus covers print the fund's name and never its ticker.
  for (const m of block[0].matchAll(/\{\s*symbol:\s*'([A-Z0-9.-]+)'\s*,\s*name:\s*'([^']+)'[^}]*?expenseRatioPct:\s*([0-9.]+)/g)) {
    out.push({ symbol: m[1], name: m[2], catalogPct: Number(m[3]) })
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
  const byCatalog = new Map(catalog.map((c) => [c.symbol, c]))
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
    const catalogEntry = byCatalog.get(symbol) ?? null
    const catalogPct = catalogEntry?.catalogPct ?? null
    const catalogName = catalogEntry?.name ?? null
    const cik = cikMap.get(symbol)
    if (!cik) { rows.push({ symbol, catalogPct, status: 'no-cik' }); log(`  ${symbol.padEnd(6)} no CIK in company_tickers.json`); continue }

    let candidates
    try { candidates = await candidateFilings(cik) } catch (err) { rows.push({ symbol, catalogPct, cik, status: 'submissions-error', detail: err.message }); log(`  ${symbol.padEnd(6)} submissions error: ${err.message}`); continue }
    if (!candidates.length) { rows.push({ symbol, catalogPct, cik, status: 'no-prospectus' }); log(`  ${symbol.padEnd(6)} no prospectus-type filing found`); continue }

    // Walk back until a filing actually states a fee: the newest is often a
    // supplement that incorporates the base prospectus by reference.
    let filing = null, html = null, hits = [], waivedTo = null, lastErr = null, tried = 0, wrongDoc = null
    for (const cand of candidates) {
      tried++
      try {
        const res = await politeFetch(cand.url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        let body = await res.text()

        // A cover page is not a prospectus — try the largest doc in the same
        // accession before giving up on this filing.
        if (body.length < THIN_DOC_BYTES) {
          const alt = await largestDocInAccession(cand.cik, cand.accDir)
          if (alt && alt !== cand.url) {
            const res2 = await politeFetch(alt)
            if (res2.ok) {
              const b2 = await res2.text()
              if (b2.length > body.length) { body = b2; cand.url = alt; cand.viaIndex = true }
            }
          }
        }

        // ⚠ CONFIRM THE DOCUMENT IS ABOUT THIS FUND before believing its number.
        //
        //   A registrant can file for many series. CPER (Copper) shares CIK
        //   1479247 with USCI (Commodity Index), and the walk-back landed on
        //   `i26209_usci-424b3.htm` — whose 1.05% total is USCI's. Reported
        //   without this check it read as "CPER 0.65 → 1.05", which would have
        //   put a sibling fund's fee on CPER: exactly the wrong-fund error this
        //   script's report-never-write split exists to prevent, arriving through
        //   the front door as a confident recommendation.
        //
        //   Mere PRESENCE of the ticker is too weak a test, and measurably so:
        //   USCI's prospectus mentions CPER 5 times — "Other series of the Trust
        //   include the United States Copper Index Fund ('CPER')" — against 1,196
        //   mentions of USCI. A presence check passes and still reads the wrong
        //   fund's fee.
        //
        //   The COVER PAGE is the discriminator. A prospectus names its subject in
        //   the first breath: USCI appears at character 242 ("PROSPECTUS United
        //   States Commodity Index Fund"), CPER not until 13,423, buried in a
        //   related-series aside.
        //   Accept the TICKER **or** the fund's NAME. Many covers print only the
        //   name — "SPDR S&P 500 ETF Trust" never says SPY — so a ticker-only
        //   test rejected SPY, DIA, IBIT and ETHA, every one of which had
        //   resolved correctly before the guard existed. A false negative is
        //   safer than reading the wrong fund's fee, but it is still a loss, and
        //   the name is the discriminator those covers actually carry.
        const cover = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, COVER_PAGE_CHARS).toLowerCase()
        //   Match the name as a CONTIGUOUS PHRASE, not as overlapping words.
        //   Word overlap cannot separate sibling funds: "United States Copper
        //   Index Fund" and "United States Commodity Index Fund" share four
        //   words of five, so an overlap test happily read USCI's 1.05% as
        //   CPER's. The phrase does separate them, because each cover prints its
        //   own fund's name in full.
        const phrase = (catalogName ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
        const namedOnCover =
          new RegExp(`\\b${symbol}\\b`, 'i').test(cover) ||
          (phrase.length >= 8 && cover.includes(phrase))
        if (!namedOnCover) {
          wrongDoc = { url: cand.url, form: cand.form, filed: cand.filed }
          continue
        }

        const found = extractFees(body)
        if (found.hits.length) { filing = cand; html = body; hits = found.hits; waivedTo = found.waivedTo; break }
        if (!filing) { filing = cand; html = body }   // remember the newest for reporting
      } catch (err) { lastErr = err.message }
    }

    if (!filing && wrongDoc) {
      // Found filings, but none of them mention this ticker — a shared-registrant
      // case. Say so precisely: "wrong fund's prospectus" is a different problem
      // from "no filing" and from "fee label not recognised".
      rows.push({ symbol, catalogPct, cik, status: 'wrong-fund-document', detail: wrongDoc })
      log(`  ${symbol.padEnd(6)} candidate filings do not name ${symbol} — shared registrant; last tried ${wrongDoc.form} ${wrongDoc.filed}`)
      continue
    }
    if (!filing) {
      rows.push({ symbol, catalogPct, cik, status: 'fetch-error', detail: lastErr ?? 'unknown' })
      log(`  ${symbol.padEnd(6)} could not fetch any of ${tried} candidate filings: ${lastErr ?? 'unknown'}`)
      continue
    }
    if (tried > 1 && hits.length) filing.viaWalkback = tried

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

    // Compare against what a holder PAYS. A waived fee makes the contractual rate
    // the wrong basis for a "differs" verdict.
    const effectivePct = waivedTo ?? best.pct
    const delta = catalogPct != null ? Number((effectivePct - catalogPct).toFixed(4)) : null
    rows.push({ symbol, catalogPct, cik, filing, status: ambiguous ? 'ambiguous' : 'ok', hits, filedPct: best.pct, waivedTo, effectivePct, matchedLabel: best.label, delta })

    const flag = delta == null ? '' : Math.abs(delta) >= 0.005 ? `  ⚠ DIFFERS by ${delta > 0 ? '+' : ''}${delta}pp` : '  ✓ agrees'
    log(`  ${symbol.padEnd(6)} ${String(effectivePct).padStart(5)}%  ${best.label.padEnd(38)} ${filing.form} ${filing.filed}${flag}${ambiguous ? '  [AMBIGUOUS — see all labels]' : ''}`)
    if (waivedTo != null) log(`         · contractual ${best.pct}%, WAIVED to ${waivedTo}% — waivers are revocable, so record both`)
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
  // Print the EFFECTIVE rate — the one the delta was computed from. Printing the
  // contractual figure here produced the nonsense line "catalog 0.25 → filed 0.25"
  // for a waived fund, which reads as a bug in the comparison rather than a
  // waiver.
  for (const r of differing) log(`   ${r.symbol.padEnd(6)} catalog ${r.catalogPct}  →  ${r.effectivePct}${r.waivedTo != null ? ` (contractual ${r.filedPct}, waived)` : ''}   (${r.matchedLabel}, ${r.filing.form} ${r.filing.filed})`)
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
