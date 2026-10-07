# Screener Consistency Pass — 2026-07-30

Owner-backlog item ("Fine-tune all screeners — consistency of filters, defaults, and
result quality"). Scope: Stock Registry (`/equities`), Fund Registry (`/funds`),
Coin Registry (`/assets`), coin discovery, and the two TA screeners. Findings were
verified in source; code changes are limited to the one capability gap found.

## Verified consistent (no change needed)

| Dimension | Finding |
|-----------|---------|
| Null semantics in range filters | Identical by design across Stock and Fund registries: a row with a null value is **excluded** when a range on that dimension is active, included otherwise. Equities inlines the checks (`e.peRatio != null && …`); Funds centralizes them (`inRange()` returns false on null when active). Same observable behavior — a blank P/E can never satisfy a P/E screen, matching the documented negative-P/E→null decision. |
| Clear/reset affordance | All three registries have one (equities "Clear all", funds `clearFilters`, coins `resetFilters` from the store). |
| Empty-result state | Identical copy pattern on all three: "No {equities\|funds\|coins} match the current filters." |
| Pagination interaction | All three reset to page 0 on any filter/sort change and clamp `safePage`; quotes fetch for the visible page only. |
| Filter persistence | Consistent in effect: none is durable. Coins holds filters in `useAssetStore` (in-memory Zustand, no `persist` middleware — survives in-app navigation but not reload); equities/funds hold local state. Not unified further on purpose: the store buys coins nothing durable, and adding localStorage persistence to screeners is a product decision (stale hidden filters confuse more than they help). |

## Gap found and fixed: URL deep-linking

No registry screener could be linked in a filtered state (T7's wish list flagged this
for equities; the coins page already deep-links only its `?tab=`). Fixed with one
shared hook, `src/lib/hooks/useScreenerUrl.ts`, wired into both:

- `/equities?sector=technology&peMax=20&sort=pe&dir=asc` — sector, search, sort,
  and all six range bounds.
- `/funds?type=etf&cat=sector&r_expense=:0.2&sort=expense` — all seven selects,
  curated toggle, search, sort, and each of the nine range dimensions as one
  compact `r_<key>=min:max` param.

Design constraints the hook encodes (they are why this isn't `useSearchParams`):
- **No `useSearchParams`** — it demands a Suspense boundary at build time, the exact
  failure class that once broke `next build` on the TA page. The hook reads
  `location.search` once on mount and writes with `history.replaceState` (no
  navigation, no Suspense requirement).
- **Read-in-effect, not in initial state** — first paint renders defaults and params
  apply one tick later, avoiding SSR hydration mismatches on prerendered pages.
- **Untouched foreign params** — only keys the screener declares are written or
  deleted, so page-owned params like `/assets?tab=reserves` survive.
- **Minimal URLs** — values equal to their default are removed, so an unfiltered
  screen has a clean URL.
- Incoming values are validated against the known unions (sector ids, sort keys,
  category ids…) before being applied; junk params are ignored.

Coins was deliberately left on its store: its `?tab=` handling already uses
`useSearchParams` inside the existing component structure, and moving its store
state into URLs is a larger refactor than the consistency win justifies. If wanted
later, the same hook applies.

## Noted, not changed

- **TA screeners differ by design.** Crypto TA scans every tracked asset on a
  selectable timeframe with auto-refresh; equity TA screens a bounded 24-large-cap
  list (one OHLCV fetch per symbol — the bound is a fan-out budget, documented in
  code). Unifying them means either unbounded equity fetches or crippling the
  crypto side; neither is a consistency win.
- **Coin discovery** is a scored-candidate surface, not a range screener — its
  filters (store-backed) follow the coins pattern.
- **Verification limit:** URL application is client-side; this container verified
  the pages render (200) with deep-link params and that types/lint/build pass, but
  a real browser click-through should confirm filter application end-to-end on the
  owner's machine.

  > **Click-through done 2026-10-07 (T-282, D90), and it found a bug.** Run in a real
  > browser (headless Chromium driving `npm run dev`) in the cloud session rather than
  > on the owner's machine. That was enough here because both screeners filter the
  > built-in lists, 79 stocks and 140 funds, which need no live data. Results:
  >
  > - `/funds?type=etf&cat=sector&r_expense=:0.2&sort=expense`: the ETFs button and the
  >   Sector chip show selected, the expense range shows `– 0.2`, and the table holds
  >   exactly the 11 sector ETFs at or under 0.2%, in expense order. Clicking Mutual
  >   rewrites the link to `type=mutual`. ✅
  > - `/equities?sector=technology&peMax=20&sort=pe&dir=asc`: the Technology chip is
  >   selected, P/E max shows 20, and the table holds the one matching stock (QCOM, P/E 17).
  >   Typing 30 into P/E max and clicking Financials rewrites the link to
  >   `sector=financials&…&peMax=30`, and the table shows the 10 expected rows. ✅
  > - **The stock screener dropped five of its filters from a link.** W3-5 added max
  >   yield, min beta, a price range and "dividend payers only", and the page wrote all of
  >   them into the link, but the code that restores a link on opening was never
  >   extended. `/equities?yieldMax=1&betaMin=1.2&priceMin=100&priceMax=2000&payers=1`
  >   opened on all 79 stocks with every box empty, and the link was then rewritten to a
  >   bare `/equities`. Fixed in `EquitiesClient.tsx`: the same link now shows the 7
  >   expected stocks with every box filled in. `lib/hooks/__tests__/screenerUrlKeys.test.ts`
  >   now fails for any screener whose link carries a filter that opening the link does
  >   not restore; run against the old file, it names exactly those five.
