# House source-labeling policy

**Status: DRAFT for owner approval (T-292, owner decision D15, 2026-09-14).**
Nothing here is new behaviour. The conventions below already ship; this writes down
the rule they were following so a new surface has something to conform to instead of
a precedent to copy. Where a clause states something the code does **not** yet do, it
says so explicitly.

Scope: both products. `BUSINESS-CHECKLIST.md` §3 asks for one house rule; each
product's checklist then tracks its own rendering.

---

## 1. The rule in one sentence

**Every number on screen must be traceable to either a named third party or to us, and
the reader must be able to tell which without clicking anything.**

Everything below is a consequence of that sentence.

## 2. The four labels, and when each is required

These exist as components in `frontend/src/components/ui/`. They are not
interchangeable — each answers a different question a reader might have.

| Label | Answers | Required when |
|---|---|---|
| **`<SourceLine route="…">`** | *Where did this page's data come from?* | **Every surface that renders third-party data.** Reads from the `dataSources.ts` registry by route id, so the name and link cannot drift from the route that actually fetched it |
| **`<ProvenanceNotice>`** | *How old is this, and who checked it?* | **Every hand-maintained table.** Renders `verifiedAt` / `ageDays` / `stale` / `confidence` from the data module's own provenance object |
| **`<DerivedNote>`** | *Did a provider publish this, or did we compute it?* | **Any computed figure sitting beside provider-sourced values**, especially in a table where proximity implies a common origin |
| **`<DataGapNote>`** | *Why is this missing?* | **Any absent value**, so a gap reads as a decision or a known limit rather than a bug |

### 2.1 ProvenanceNotice is always visible, never conditional

A notice that appears only past a staleness threshold teaches readers that its absence
means "live". It must render whether the data is fresh or stale. This is settled — see
`CLAUDE.md` § Data Files Reference, where three separate audit findings (H2, M5, L2)
were the same bug in different places.

### 2.2 Date a table by when it was compiled, not by its last edit

Re-verifying 8 rows of 55 does not refresh the other 47. `*_LAST_VERIFIED` moves only
when the table is re-checked **as a whole**.

## 3. Licence-required attribution

Some licences prescribe the wording, and where they do, **the licence wins over house
style**. Known cases in Finance Now:

| Source | Requirement | How it is met |
|---|---|---|
| **CoinGecko** | API Terms 4.4 prescribes the attribution *message* | `SourceProvider.attribution` carries **"Powered by CoinGecko"** verbatim; `SourceLine` renders it with a **10px minimum font size**, and a test parses the rendered class and fails below that floor |
| **SEC EDGAR / N-PORT / XBRL** | Public domain; no attribution required | Named anyway — a reader should know a holdings figure came from a filing, not a vendor |
| **treasury.gov** | Public domain | Named as the official par curve |
| **ECB via frankfurter.dev** | Attribution expected | Named, and the community extended tier is labelled **separately** so the two are never blended without attribution |

⚠ **Attribution is not the same as permission.** A correctly rendered "Powered by X"
satisfies a wording clause; whether we may use X at all is the source-terms registry's
question (`lib/server/sourceTerms.ts`). Both must hold.

## 4. Derived figures

A computed number must never be able to pass as a publisher's. Three rules:

1. **Mark it** with `<DerivedNote>` wherever it sits beside sourced values.
2. **Say what went in.** "Computed by Finance Now from …" naming the inputs, not just
   the fact of computation.
3. **Never fabricate a timestamp.** A derived or static value carries the date of its
   *inputs*, never `new Date()`. This has been a real bug twice — the CBDC fallback and
   the reserves table both once stamped a static snapshot with a fresh time.

## 5. Absence

"Not available" is a statement we are making, and it has to be true and specific.

- Say **why**, via `<DataGapNote>` and the `GAP_REASONS` taxonomy in `lib/data/dataGaps.ts`
  (`add-a-key` · `needs-work` · `no-source` · `by-design` · `transient`).
- **Never fabricate a placeholder** to fill the space, and never keep a permanent
  placeholder where the real answer is "this was decided against" — a permanent
  "N/A" reads as *missing*, which is a different claim from *withheld*. This is why
  `Asset.riskScore`/`riskBand` (RP-6) and the CR3/CR6 surfaces (D11) were deleted rather
  than left rendering "n/a".
- **Distinguish "not fetched" from "fetched and empty."** A route that returns `ok:true`
  with no rows is making a claim; one that could not reach its upstream is not.

## 6. Placement

`BUSINESS-CHECKLIST.md` §3 requires both:

- **Footer of every page** — the `/data-sources` catalogue, reachable from anywhere.
- **At the point of relevance** — `SourceLine` on the surface itself. A disclaimer
  nobody sees protects nobody.

## 7. Enforcement

What is machine-checked today, and what is not — the distinction matters, because an
unenforced rule is a hope:

| Rule | Enforced by |
|---|---|
| Every fetched host carries a terms verdict | `sourceTerms.test.ts` — walks every host in `dataSources.ts`, fails on unregistered |
| CoinGecko attribution ≥ 10px | A test parses the rendered class |
| Every gap notice has a known reason and a message | `gapNoticeCoverage.test.ts` — walks every `.tsx` |
| Fund sales-charge rates carry `source` + `verifiedAt` | Catalog-wide test |
| **SourceLine present on every data surface** | ⚠ **Not enforced.** Convention only |
| **DerivedNote present on every computed figure** | ⚠ **Not enforced.** Convention only |
| **ProvenanceNotice on every curated table** | ⚠ **Not enforced.** Convention only |

The three unenforced rows are the honest gap in this policy. Closing them means a test
that walks the surfaces the way `gapNoticeCoverage` already does — **proposed, not
done**, and out of scope for a policy document.

---

## Owner decisions still open in this document

1. **Approve or amend** the rule in §1 and the four labels in §2.
2. **§7's three unenforced rows** — worth a coverage test, or left as convention?
3. **Chronolens's rendering** of this same policy is its own checklist item; this
   document is the shared rule, not that product's implementation.
