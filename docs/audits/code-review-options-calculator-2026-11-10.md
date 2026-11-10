# Code review: the Options Calculator's "what if" sliders, 8 legs and 15 presets — 2026-11-10

**What was reviewed:** the code part of `8483d35` (#492, D216): `lib/options/whatIf.ts`,
`lib/options/presets.ts`, the calculator page and their tests. **Who:** an independent agent
working to `docs/agents/code-checker.md`, given the code and not the author's conclusions.
**Outcome:** the owner chose to fix every finding (D221). Each finding below was reproduced
by the author before the fix, and its test was seen failing first.

## Findings and what was done

| # | Severity | Finding | Reproduced | Fix |
|---|---|---|---|---|
| 1 | 🟠 | The call butterfly rounded each strike on its own, so its wings were unequal at about a quarter of all prices (25,530 of 99,901 one-cent prices from $1 to $1,000). Its note, "Max loss is the net debit paid", was then false: at $87.30 the strikes were 83/87/87/92, and a stock ending above $92 lost more than was paid | 87.30 → 83/87/92, maximum loss $210 on a $110 debit | `wingsAround`: at the money, and one equal step either side. 87.30 → 83/87/91 |
| 2 | 🟡 | On cheap stocks a strike that collided with another was pushed up, so structures drifted above the price: the iron condor at $1.20 sold a $1.50 put; the bear put spread at $5 bought a $5.50 put, though described as at the money. A covered call at $2.60 was written at $2.50, below the price | All three | `strikesAround`: every strike on the underlying's own grid, anchored at the money; below-the-price strikes step down, above-the-price ones step up. A structure that would need a strike at $0 or less is refused with a message ("At $1.20 this structure would need a strike of $0 or less on a $0.50 strike grid") |
| 3 | 🟡 | The amber "what if" line vanished when the slider moved past the chart's edge (Recharts drops a reference line outside its axis), while the caption still described it | A $100 call bought at $5: no line at −30% | `chartRange` takes the "what if" price; the line shows at −30% and +50% |
| 4 | 🟡 | The volatility slider kept its old shift when its range narrowed and sprang back to it when the range widened | Shift −19 on a 20% leg; type 15; set 20 again → back to −19 | The stored shift follows its range; it stays at −14 |
| 5 | 🟡 | Changes the tests did not catch: the expiry figure or the Greeks worked out at the unmoved price, the dividend dropped from the model, the bear put spread's strikes swapped, the straddle as two calls, the strangle's call sold, a condor's maximum loss from the narrower wing | By mutation (the reviewer's) | New tests; each of those changes, and three more, now fails a test |
| 6 | 🟢 | The no-risk-engine check missed a relative import from the page, `./../risk`, `require()` and a template-string `import()`, and could have flagged a comment | The old pattern misses all four | One pattern over code with comments removed, tested against ten imports and five non-imports |
| 7 | 🟢 | The sliders had no spoken values, and the volatility slider's spoken name did not contain its visible label | — | `aria-valuetext` on both ("−30%, $70.00"; "−19 points"); spoken names begin with the visible labels |
| 8 | 🟢 | The switched-off scorer page lists the same presets | — | Nothing to do: every preset is four legs or fewer, as its form takes |

## Unchanged

The arithmetic (`modelPnlNow`, `whatIf`, `modelPnlAt`) was checked by the reviewer against
`greeks.ts` and found correct, and the slider limits threw at none of 25,740 positions tried.
The first four presets give the same strikes as before at $200 and $87.30.
